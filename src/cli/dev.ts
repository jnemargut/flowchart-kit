import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { bakeImage, croppedImage } from "../../vendor/sketch/bake";
import { formatJSON } from "../../vendor/sketch/json";
import { readMeta } from "../../vendor/sketch/pngmeta";
import { eventHub, listenFree, openBrowser, readBody, sendJSON, serveStatic } from "../../vendor/sketch/server";
import { kitScript, nearby, parseRef, resolveCards } from "../cards";
import { boardPNG, boardSVGFile, cacheDirFor, regionPNG, stemOf, toJSONCanvas, toPDF, toPPTX } from "../export";
import type { Cards, FlowchartFile } from "../types";
import { validate } from "../validate";

const EDITOR_DIR = fileURLToPath(new URL("./editor/", import.meta.url));

export interface DevOptions { port: number; open: boolean }

/** Where a storyboard or wireframe with this name is, relative to the board: this folder, one level down, or next door. */
function findSource(base: string, name: string): string | undefined {
  if (!/\.(storyboard|wireframe)\.json$/.test(name) || name.includes("/")) return undefined;
  const hit = nearby(base).find((f) => f.ref.split("/").pop() === name);
  if (hit) return hit.ref;
  const up = join(dirname(base), name);
  return existsSync(up) ? `../${name}` : undefined;
}

export async function dev(file: string, o: DevOptions) {
  const abs = resolve(file);
  const base = dirname(abs);
  if (!existsSync(abs)) throw new Error(`No such file: ${file}. Create it first (fc new ${file}).`);
  if (!existsSync(join(EDITOR_DIR, "index.html"))) throw new Error("Editor build missing. Run `npm run build` in the flowchartkit package.");

  let lastWritten = "";
  let version = 0;
  let cards: Cards = {};
  const events = eventHub();
  const read = (): FlowchartFile => JSON.parse(readFileSync(abs, "utf8"));
  const write = (d: FlowchartFile) => { lastWritten = formatJSON(d); writeFileSync(abs, lastWritten); version++; };
  const reply = (d: FlowchartFile) => { cards = resolveCards(d, abs); return { doc: d, version, file: basename(abs), result: validate(d), cards }; };

  let t: NodeJS.Timeout | undefined;
  watch(abs, () => {
    clearTimeout(t);
    t = setTimeout(() => {
      let text = "";
      try { text = readFileSync(abs, "utf8"); } catch { return; }
      if (text === lastWritten) return;
      try { JSON.parse(text); } catch { events.broadcast({ type: "invalid", message: "The file isn't valid JSON right now (still being written?)." }); return; }
      version++;
      events.broadcast({ type: "change", version, source: "file" });
    }, 120);
  });

  // when a storyboard or wireframe on the board changes, its card catches up
  const mtimes = new Map<string, number>();
  setInterval(() => {
    let changed = false;
    let doc: FlowchartFile;
    try { doc = read(); } catch { return; }
    for (const n of Object.values(doc.nodes ?? {})) {
      if (n?.type !== "card" || !n.ref) continue;
      const p = resolve(base, parseRef(n.ref).file);
      let m = 0;
      try { m = statSync(p).mtimeMs; } catch { /* missing */ }
      if (mtimes.has(p) && mtimes.get(p) !== m) changed = true;
      mtimes.set(p, m);
    }
    if (changed) { version++; events.broadcast({ type: "change", version, source: "file" }); }
  }, 1500).unref();

  const opened = new Map<string, string>();
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    // Writes need a custom header: browsers can't send it cross-site without a CORS preflight we never grant.
    if (req.method !== "GET" && req.headers["x-flowchart"] !== "1") { res.writeHead(403); return res.end("forbidden"); }
    try {
      if (url.pathname === "/api/file" && req.method === "GET") return sendJSON(res, 200, reply(read()));
      if (url.pathname === "/api/file" && req.method === "PUT") {
        const next = JSON.parse((await readBody(req)).toString()) as FlowchartFile;
        write(next);
        events.broadcast({ type: "change", version, source: "editor" });
        return sendJSON(res, 200, reply(next));
      }
      if (url.pathname === "/api/events") return events.attach(req, res, { type: "hello", version });
      if (url.pathname === "/api/find") return sendJSON(res, 200, { ref: findSource(base, url.searchParams.get("file") ?? "") ?? null });
      if (url.pathname === "/api/nearby") return sendJSON(res, 200, { items: nearby(base), kits: { storyboard: !!kitScript("storyboard"), wireframe: !!kitScript("wireframe") } });
      if (url.pathname.startsWith("/card/")) {
        const id = decodeURIComponent(url.pathname.slice(6));
        const c = cards[id];
        if (!c?.png || !existsSync(c.png)) { res.writeHead(404); return res.end(); }
        const node = read().nodes[id];
        // ?full=1: the whole original, for the crop dialog
        const full = url.searchParams.get("full") === "1";
        const raw = full || c.kind !== "image" || node?.sketch === false;
        const crop = full ? undefined : node?.crop;
        const pic = raw ? croppedImage(c.png, cacheDirFor(abs), crop) : { buf: bakeImage(c.png, cacheDirFor(abs), 1, "grey", crop), mime: "image/png" };
        res.writeHead(200, { "content-type": pic.mime, "cache-control": "no-cache" });
        return res.end(pic.buf);
      }
      if (url.pathname === "/api/open-card" && req.method === "POST") {
        const ref = url.searchParams.get("ref") ?? "";
        const { file: f, kind } = parseRef(ref);
        const p = resolve(base, f);
        if (!p.startsWith(base + sep) && p !== base) return sendJSON(res, 400, { error: "That file isn't in this folder." });
        if (kind === "image" || !kind) { openBrowser(`file://${p}`); return sendJSON(res, 200, { ok: true }); }
        const kit = kitScript(kind);
        if (!kit) return sendJSON(res, 200, { error: `Install ${kind === "storyboard" ? "Storyboard Kit" : "Wireframe Kit"} to edit this.` });
        if (opened.has(p)) { openBrowser(opened.get(p)!); return sendJSON(res, 200, { ok: true }); }
        const child = spawn(process.execPath, [kit, "dev", p], { stdio: ["ignore", "pipe", "ignore"], cwd: dirname(p) });
        child.stdout.on("data", (d) => { const m = /http:\/\/localhost:\d+\//.exec(String(d)); if (m && !opened.has(p)) opened.set(p, m[0]); });
        process.on("exit", () => child.kill());
        return sendJSON(res, 200, { ok: true });
      }
      if (url.pathname === "/api/upload" && req.method === "POST") {
        const buf = await readBody(req);
        // a panel copied from Storyboard Kit or a screen from Wireframe Kit: make it a live card, not a flat picture
        const sb = readMeta<{ file?: string; panel?: string }>(buf, "storyboard-kit");
        const wf = sb ? undefined : readMeta<{ file?: string; screen?: string }>(buf, "wireframe-kit");
        const from = sb?.file ?? wf?.file;
        if (from) {
          const found = findSource(base, from);
          if (found) return sendJSON(res, 200, { ref: `${found}${sb?.panel ? `#${sb.panel}` : wf?.screen ? `#${wf.screen}` : ""}` });
        }
        const raw = (url.searchParams.get("name") ?? "image.png").toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
        const ext = [".png", ".jpg", ".jpeg", ".webp"].includes(extname(raw)) ? "" : ".png";
        const dir = join(base, "images");
        mkdirSync(dir, { recursive: true });
        let name = raw + ext, i = 2;
        while (existsSync(join(dir, name))) name = `${basename(raw, extname(raw))}-${i++}${extname(raw) || ext}`;
        writeFileSync(join(dir, name), buf);
        return sendJSON(res, 200, { path: "./" + relative(base, join(dir, name)).split(sep).join("/") });
      }
      if (url.pathname === "/api/region.png") {
        const q = (k: string) => Number(url.searchParams.get(k));
        const box = { x: q("x"), y: q("y"), w: Math.max(1, q("w")), h: Math.max(1, q("h")) };
        if (![box.x, box.y, box.w, box.h].every(Number.isFinite)) { res.writeHead(400); return res.end(); }
        res.writeHead(200, { "content-type": "image/png", "cache-control": "no-cache" });
        return res.end(regionPNG(read(), abs, box, Math.min(3, Math.max(1, Number(url.searchParams.get("scale") ?? 2)))));
      }
      if (url.pathname === "/api/export") {
        const d = read();
        const fmt = url.searchParams.get("format") ?? "png";
        const stem = stemOf(abs);
        const send = (type: string, ext: string, body: string | Uint8Array) => { res.writeHead(200, { "content-type": type, "content-disposition": `attachment; filename="${stem}.${ext}"` }); res.end(body); };
        if (fmt === "pdf") return send("application/pdf", "pdf", Buffer.from(await toPDF(d, abs)));
        if (fmt === "pptx") return send("application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx", await toPPTX(d, abs));
        if (fmt === "svg") return send("image/svg+xml", "svg", boardSVGFile(d, abs));
        if (fmt === "canvas") return send("application/json", "canvas", toJSONCanvas(d, abs, base));
        const frame = url.searchParams.get("frame") ?? undefined;
        return send("image/png", "png", boardPNG(d, abs, { frame, scale: Number(url.searchParams.get("scale") ?? 1.5) }));
      }
      if (serveStatic(EDITOR_DIR, url.pathname, res)) return;
      res.writeHead(404); res.end("not found");
    } catch (e) {
      sendJSON(res, 500, { error: (e as Error).message });
    }
  });

  const port = await listenFree(server, o.port);
  const link = `http://localhost:${port}/`;
  console.log(`flowchart editor → ${link}\n  editing ${relative(process.cwd(), abs)} (changes save to the file; agent edits reload live)\n  Ctrl+C to stop`);
  if (o.open) openBrowser(link);
}
