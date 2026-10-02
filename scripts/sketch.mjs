// The shared marker drawing kit lives in Storyboard Kit (src/sketch/). This repo keeps an exact copy in
// vendor/sketch/ so it builds on its own.
//   node scripts/sketch.mjs sync    copy it over from Storyboard Kit and record its hash
//   node scripts/sketch.mjs check   fail if vendor/sketch/ was edited by hand (fix it in Storyboard Kit, then sync)
// Storyboard Kit is looked for at $SKETCH_SRC, ../storyboard-kit, or ../StoryboardingTool.
import { createHash } from "node:crypto";
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const VENDOR = "vendor/sketch";
const STAMP = join(VENDOR, ".synced-from");

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (f === ".synced-from" || f === ".DS_Store") return [];
    return statSync(p).isDirectory() ? files(p) : [p];
  }).sort();
}

function hash(dir) {
  const h = createHash("sha256");
  for (const f of files(dir)) h.update(relative(dir, f).split("\\").join("/")).update("\0").update(readFileSync(f)).update("\0");
  return h.digest("hex").slice(0, 16);
}

const mode = process.argv[2];
if (mode === "sync") {
  const src = [process.env.SKETCH_SRC, "../storyboard-kit/src/sketch", "../StoryboardingTool/src/sketch"].filter(Boolean).map((p) => resolve(p)).find((p) => existsSync(join(p, "tokens.ts")));
  if (!src) { console.error("Can't find Storyboard Kit's src/sketch. Set SKETCH_SRC=/path/to/storyboard-kit/src/sketch."); process.exit(1); }
  rmSync(VENDOR, { recursive: true, force: true });
  cpSync(src, VENDOR, { recursive: true, filter: (p) => !p.endsWith(".DS_Store") });
  writeFileSync(STAMP, `${hash(VENDOR)}\n`);
  console.log(`synced ${VENDOR}/ from ${src} (${files(VENDOR).length} files, ${hash(VENDOR)})`);
} else if (mode === "check") {
  if (!existsSync(STAMP)) { console.error(`${VENDOR}/ was never synced. Run npm run sync-sketch.`); process.exit(1); }
  const want = readFileSync(STAMP, "utf8").trim();
  const got = hash(VENDOR);
  if (want !== got) {
    console.error(`${VENDOR}/ doesn't match what was synced (${got} ≠ ${want}).\nIt's a copy of Storyboard Kit's src/sketch/: make the change there, then npm run sync-sketch.`);
    process.exit(1);
  }
} else {
  console.error("usage: node scripts/sketch.mjs sync|check");
  process.exit(1);
}
