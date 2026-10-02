/**
 * Small pieces every local editor server needs: request bodies, JSON replies, safe paths, static files,
 * live-reload events, a free port, and opening the browser. Node built-ins only.
 */
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

export const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ttf": "font/ttf", ".json": "application/json",
  ".pdf": "application/pdf",
};

export const readBody = (req: IncomingMessage): Promise<Buffer> => new Promise((ok, fail) => {
  const chunks: Buffer[] = [];
  req.on("data", (c) => chunks.push(c)); req.on("end", () => ok(Buffer.concat(chunks))); req.on("error", fail);
});

export const sendJSON = (res: ServerResponse, code: number, obj: unknown) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
};

/** Resolve a URL path inside `base`, or undefined if it would escape it. */
export const safePathUnder = (base: string, p: string) => {
  const full = normalize(resolve(base, decodeURIComponent(p)));
  return full.startsWith(base + sep) || full === base ? full : undefined;
};

/** Serve a built editor folder. Returns false when the path isn't one of its files. */
export function serveStatic(dir: string, pathname: string, res: ServerResponse): boolean {
  const rel = pathname === "/" ? "index.html" : pathname.slice(1);
  const p = normalize(join(dir, rel));
  if (!p.startsWith(dir) || !existsSync(p) || !statSync(p).isFile()) return false;
  res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" });
  res.end(readFileSync(p));
  return true;
}

/** Server-sent events: the editor listens, we broadcast "the file changed". */
export function eventHub() {
  const clients = new Set<ServerResponse>();
  return {
    attach(req: IncomingMessage, res: ServerResponse, hello: object) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write(`data: ${JSON.stringify(hello)}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
    },
    broadcast(msg: object) { for (const c of clients) c.write(`data: ${JSON.stringify(msg)}\n\n`); },
  };
}

/** Listen on `port`, or the next free one (up to +20). */
export const listenFree = (server: Server, port: number) => new Promise<number>((ok, fail) => {
  const onError = (err: NodeJS.ErrnoException) => {
    const tried = Number((err as { port?: number }).port ?? port);
    if (err.code === "EADDRINUSE" && tried < port + 20) server.listen(tried + 1, "127.0.0.1");
    else { server.off("listening", onListening); fail(err); }
  };
  // report the port we actually got (a failed attempt's callback would otherwise fire for the next one)
  const onListening = () => { server.off("error", onError); const a = server.address(); ok(typeof a === "object" && a ? a.port : port); };
  server.on("error", onError);
  server.once("listening", onListening);
  server.listen(port, "127.0.0.1");
});

export function openBrowser(link: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", link] : [link];
  spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
}
