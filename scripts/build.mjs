// Builds the self-contained skill at skills/flowchart/ — the thing people install.
//   skills/flowchart/SKILL.md, references/*        docs (generated from src/vocab.ts)
//   skills/flowchart/scripts/flowchart.mjs         the whole engine, every dependency bundled
//   skills/flowchart/scripts/resvg.wasm            renderer (WebAssembly: any OS, no native binaries)
//   skills/flowchart/scripts/editor/               the canvas editor
//   skills/flowchart/assets/fonts, examples/       fonts for rendering, the late-order example (+ its cards)
import { build } from "esbuild";
import { build as vite } from "vite";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = "skills/flowchart";
const only = process.argv[2]; // "cli" = just the script (fast iteration)

rmSync(`${OUT}/scripts/flowchart.mjs`, { force: true });
mkdirSync(`${OUT}/scripts`, { recursive: true });

await build({
  entryPoints: ["src/cli/index.ts"],
  outfile: `${OUT}/scripts/flowchart.mjs`,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node18",
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  // CommonJS dependencies inside an ES module bundle still need `require` for Node built-ins.
  banner: { js: '#!/usr/bin/env node\nimport { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
  logLevel: "warning",
});
cpSync("node_modules/@resvg/resvg-wasm/index_bg.wasm", `${OUT}/scripts/resvg.wasm`);

// fonts used for rendering (the editor bundles its own copies)
mkdirSync(`${OUT}/assets/fonts`, { recursive: true });
for (const f of ["PermanentMarker-Regular.ttf", "PatrickHand-Regular.ttf", "IBMPlexMono-Regular.ttf", "LICENSE-Apache-PermanentMarker.txt", "OFL-PatrickHand.txt", "OFL-IBMPlexMono.txt"])
  cpSync(`vendor/sketch/fonts/${f}`, `${OUT}/assets/fonts/${f}`);
if (only === "cli") process.exit(0);

// docs, references and schema (generated from the vocabulary)
await build({ entryPoints: ["scripts/gen.ts"], outfile: "dist/gen.mjs", bundle: true, platform: "node", format: "esm", packages: "external", logLevel: "warning" });
execFileSync("node", ["dist/gen.mjs"], { stdio: "inherit" });

// the example board, with the storyboard and wireframe its cards show (and their cached pictures)
rmSync(`${OUT}/examples`, { recursive: true, force: true });
cpSync("examples", `${OUT}/examples`, { recursive: true, filter: (p) => !p.includes(".flowchart-cache") && !p.endsWith(".DS_Store") });
const ex = JSON.parse(readFileSync("examples/late-order.flowchart.json", "utf8"));
writeFileSync(`${OUT}/examples/late-order.flowchart.json`, JSON.stringify({ $schema: "../references/schema.json", ...ex }, null, 2) + "\n");

// the editor
await vite({ configFile: "vite.config.ts", logLevel: "warn" });
cpSync("LICENSE", `${OUT}/LICENSE`);
cpSync("LICENSE", "skills/low-fi-think/LICENSE");
console.log(`built ${OUT}/`);
