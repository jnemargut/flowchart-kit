/**
 * Cards point at other kits' files. Flowchart Kit never draws storyboards or wireframes itself: each kit renders
 * its own PNG next to its file (late-latte.in-line.png, order.status.png), and a card shows that picture.
 * When the file is newer than its picture and the kit is installed, we ask the kit to re-render first; when
 * it isn't, the cached picture still works on any machine (marked "out of date").
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize } from "../vendor/sketch/bake";
import type { CardInfo, Cards, FlowchartFile } from "./types";

import { parseRef } from "./refs";

export { parseRef };

const SCRIPTS: Record<"storyboard" | "wireframe", string> = { storyboard: "storyboard/scripts/storyboard.mjs", wireframe: "wireframe/scripts/wireframe.mjs" };

/** The installed Storyboard Kit or Wireframe Kit script, if any. */
export function kitScript(kind: "storyboard" | "wireframe"): string | undefined {
  // installed next to this skill (…/skills/flowchart/scripts/flowchart.mjs → …/skills/storyboard/…)
  const sibling = (() => { try { return fileURLToPath(new URL(`../../${SCRIPTS[kind]}`, import.meta.url)); } catch { return ""; } })();
  const home = homedir();
  const env = kind === "storyboard" ? process.env.STORYBOARD_KIT : process.env.WIREFRAME_KIT;
  return [env, sibling, ...[".claude/skills", ".codex/skills", ".agents/skills"].map((d) => join(home, d, SCRIPTS[kind]))]
    .find((c): c is string => !!c && existsSync(c));
}

const stem = (abs: string) => basename(abs).replace(/\.(storyboard|wireframe)\.json$/, "");

/** Where a kit writes the picture for a reference: next to the file, "<name>.png" or "<name>.<part>.png". */
export const pictureFor = (abs: string, part?: string) => join(dirname(abs), `${stem(abs)}${part ? `.${part}` : ""}.png`);

/** The panel ids or screen ids in a storyboard or wireframe, and the default one. */
export function partsOf(abs: string, kind: "storyboard" | "wireframe"): { ids: string[]; titles: Record<string, string>; title: string } {
  try {
    const d = JSON.parse(readFileSync(abs, "utf8"));
    if (kind === "storyboard") {
      const ps = (d.panels ?? []).filter((p: { id?: string }) => typeof p?.id === "string");
      return { ids: ps.map((p: { id: string }) => p.id), titles: Object.fromEntries(ps.map((p: { id: string; label?: string; title?: string; text?: string }) => [p.id, p.label ?? p.title ?? p.text ?? p.id])), title: d.title ?? stem(abs) };
    }
    const ids = Object.keys(d.screens ?? {});
    return { ids, titles: Object.fromEntries(ids.map((id) => [id, d.screens[id]?.title ?? id])), title: d.title ?? stem(abs) };
  } catch { return { ids: [], titles: {}, title: stem(abs) }; }
}

const pngSize = (p: string) => { try { return imageSize(readFileSync(p)); } catch { return undefined; } };

/** Work out every card on the board: its picture (re-rendered by its kit when stale), size and state. */
export function resolveCards(doc: FlowchartFile, boardFile: string, o: { refresh?: boolean } = {}): Cards {
  const base = dirname(resolve(boardFile));
  const out: Cards = {};
  for (const [id, n] of Object.entries(doc.nodes ?? {})) {
    if (n?.type !== "card") continue;
    out[id] = resolveCard(n.ref ?? "", base, o.refresh !== false);
  }
  return out;
}

export function resolveCard(ref: string, base: string, refresh = true): CardInfo {
  const { file, part, kind } = parseRef(ref);
  const label = `${basename(file)}${part ? `#${part}` : ""}`;
  const abs = resolve(base, file);
  if (!kind) return { state: "unknown", kind: "image", label, problem: "cards point at .storyboard.json, .wireframe.json or an image" };
  if (!ref || !existsSync(abs)) return { state: "missing", kind, label, problem: file };
  if (kind === "image") { const s = pngSize(abs); return { state: "ok", kind, png: abs, w: s?.w, h: s?.h, label }; }
  const parts = partsOf(abs, kind);
  if (part && !parts.ids.includes(part)) return { state: "unknown", kind, label, problem: `no ${kind === "storyboard" ? "panel" : "screen"} "${part}"` };
  const png = pictureFor(abs, part);
  const stale = () => !existsSync(png) || statSync(png).mtimeMs < statSync(abs).mtimeMs;
  const kit = kitScript(kind);
  if (stale() && kit && refresh) {
    const args = kind === "wireframe" && !part ? ["export", abs, "--png"] : ["render", part ? `${abs}#${part}` : abs, "--quiet"];
    try { execFileSync(process.execPath, [kit, ...args], { stdio: "ignore", timeout: 90000 }); } catch { /* keep whatever picture there is */ }
  }
  if (!existsSync(png)) return { state: kit ? "missing" : "nokit", kind, label, problem: kit ? "its kit couldn't draw it (run validate on that file)" : undefined };
  const s = pngSize(png);
  return { state: stale() ? "stale" : "ok", kind, png, w: s?.w, h: s?.h, whole: !part, label };
}

/** Storyboards and wireframes in a folder (and one level down), with their panels or screens: "cards nearby". */
export function nearby(dir: string): { ref: string; kind: "storyboard" | "wireframe"; title: string; parts: { id: string; title: string }[] }[] {
  const out: ReturnType<typeof nearby> = [];
  const scan = (d: string, depth: number) => {
    let names: string[] = [];
    try { names = readdirSync(d); } catch { return; }
    for (const f of names.sort()) {
      if (f.startsWith(".") || f === "node_modules") continue;
      const p = join(d, f);
      const kind = /\.storyboard\.json$/.test(f) ? "storyboard" : /\.wireframe\.json$/.test(f) ? "wireframe" : undefined;
      if (kind) {
        const parts = partsOf(p, kind);
        out.push({ ref: "./" + relative(dir, p).split(sep).join("/"), kind, title: parts.title, parts: parts.ids.map((id) => ({ id, title: parts.titles[id] })) });
      } else if (depth > 0) { try { if (statSync(p).isDirectory()) scan(p, depth - 1); } catch { /* skip */ } }
    }
  };
  scan(dir, 1);
  return out;
}
