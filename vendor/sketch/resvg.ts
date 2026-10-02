/**
 * SVG → PNG via resvg's WebAssembly build, so the skill folder runs on any OS with plain Node
 * (no native binaries, no npm install). Call `initRenderer()` once before rendering.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { initWasm, Resvg } from "@resvg/resvg-wasm";

let ready: Promise<void> | undefined;

function wasmPath(): string {
  // bundled skill: scripts/resvg.wasm next to scripts/storyboard.mjs
  const bundled = fileURLToPath(new URL("./resvg.wasm", import.meta.url));
  if (existsSync(bundled)) return bundled;
  // development (tests, tsx): straight from node_modules
  return createRequire(import.meta.url).resolve("@resvg/resvg-wasm/index_bg.wasm");
}

export function initRenderer(): Promise<void> {
  return (ready ??= initWasm(readFileSync(wasmPath())));
}

export interface RenderOpts {
  scale?: number;
  fonts?: Uint8Array[];
  defaultFont?: string;
}

/** Render after `initRenderer()` has resolved. */
export function renderPNG(svg: string, o: RenderOpts = {}): Buffer {
  const r = new Resvg(svg, {
    fitTo: o.scale && o.scale !== 1 ? { mode: "zoom", value: o.scale } : { mode: "original" },
    font: { fontBuffers: o.fonts ?? [], loadSystemFonts: false, defaultFontFamily: o.defaultFont ?? "Patrick Hand" },
    imageRendering: 0,
  });
  return Buffer.from(r.render().asPng());
}
