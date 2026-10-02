import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { formatJSON } from "../../vendor/sketch/json";
import { kitScript, nearby, resolveCards } from "../cards";
import { boardPNG, boardSVGFile, ensureDir, initRenderer, prepare, stemOf, toJSONCanvas, toPDF, toPPTX } from "../export";
import { slides } from "../layout";
import { readSource } from "../png";
import { agentsBlock } from "../skill";
import type { FlowchartFile } from "../types";
import { formatResult, validate } from "../validate";
import { FRAME_PROPS, LINK_PROPS, NODE_PROPS, NODE_TYPES, SIDES, STAMPS, STICKY } from "../vocab";
import { dev } from "./dev";

/** This script lives in <skill>/scripts/flowchart.mjs, so the skill folder is one level up. */
const SKILL_ROOT = fileURLToPath(new URL("../", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const RUN = `node "${SELF}"`;

const HELP = `flowchart: low-fi, marker-style flowcharts, stickies and an infinite canvas your coding agent builds and you tweak.
It's an agent skill: ${SKILL_ROOT}

Usage: ${RUN} <command> [options]

  new <file> [--title "…"]        Create a starter board
  vocab [--json]                  Node types, sticky colors, stamps, frame and link properties
  validate <file> [--json]        Check a board; errors include fixes
  kits                            Which kits are installed (Storyboard, Wireframe, Flowchart) and how to run each
  cards [file|dir]                Storyboards and wireframes nearby (with panels/screens), and how each card on a board is doing
  dev [file] [--port 4500]        Open the canvas editor (--no-open); edits save to the file live
  render <file>[#frame] [--scale 1.5]
                                  The board as <name>.png, or one frame as <name>.<frame>.png, next to the file
  export <file> [--png] [--svg] [--pdf] [--pptx] [--canvas] [--scale 1.5] [--out dir]
                                  --pdf: the board plus a page per frame · --pptx: a slide per frame with notes
                                  --canvas: JSON Canvas (.canvas) for Obsidian and other canvas apps
  source <file.png>               Print the board JSON embedded in a rendered PNG
  format <file>                   Rewrite the file in canonical, diff-friendly formatting
  install [--project] [--codex]   Install this skill for Claude Code (~/.claude/skills), or into this project

Docs for agents: ${join(SKILL_ROOT, "SKILL.md")}`;

function args(argv: string[]) {
  const pos: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--no-")) flags[a.slice(5)] = false;
    else if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) flags[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--") && ["port", "scale", "out", "title"].includes(k)) flags[k] = argv[++i];
      else flags[k] = true;
    } else pos.push(a);
  }
  return { pos, flags };
}

function load(ref: string | undefined): { doc: FlowchartFile; abs: string; frame?: string } {
  if (!ref) { console.error("Missing <file>. Example: flowchart validate late-order.flowchart.json"); process.exit(2); }
  const hash = ref.indexOf("#");
  const file = hash >= 0 ? ref.slice(0, hash) : ref;
  const abs = resolve(file);
  if (!existsSync(abs)) { console.error(`No such file: ${file}`); process.exit(2); }
  try { return { doc: JSON.parse(readFileSync(abs, "utf8")), abs, frame: hash >= 0 ? ref.slice(hash + 1) || undefined : undefined }; }
  catch (e) { console.error(`✗ ${file} is not valid JSON: ${(e as Error).message}`); process.exit(1); }
}

function requireValid(doc: FlowchartFile, label: string) {
  const r = validate(doc);
  if (!r.ok) { console.error(formatResult(r, label)); console.error("\nFix the errors above first."); process.exit(1); }
}

const STARTER = (title: string): FlowchartFile => ({
  title,
  frames: { main: { title: "The flow" } },
  nodes: {
    start: { type: "pill", text: "Where it starts", frame: "main" },
    step: { text: "The first step", frame: "main" },
    choice: { type: "diamond", text: "A decision?", frame: "main" },
    yes: { type: "pill", text: "It works out", frame: "main" },
    no: { text: "What happens instead", frame: "main" },
    note: { type: "sticky", text: "A question or an insight", near: "step" },
  },
  links: [
    { from: "start", to: "step" },
    { from: "step", to: "choice" },
    { from: "choice", to: "yes", label: "yes" },
    { from: "choice", to: "no", label: "no" },
  ],
});

/** The second skill that ships with this one: /low-fi-think (it plans the thinking and uses all three kits). */
const THINK_ROOT = join(SKILL_ROOT, "..", "low-fi-think");

/** Copy the whole skill folder (docs, bundled script, editor, fonts, examples), and /low-fi-think next to it. */
function installTo(dst: string): string {
  if (resolve(dst) !== resolve(SKILL_ROOT)) {
    rmSync(dst, { recursive: true, force: true });
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(SKILL_ROOT, dst, { recursive: true, filter: (src) => !src.includes(".flowchart-cache") });
  }
  const think = join(dirname(dst), "low-fi-think");
  if (existsSync(join(THINK_ROOT, "SKILL.md")) && resolve(think) !== resolve(THINK_ROOT)) {
    rmSync(think, { recursive: true, force: true });
    cpSync(THINK_ROOT, think, { recursive: true });
  }
  return dst;
}

/** Each kit the thinking can use, where it's installed, and the command that runs it. */
function kits() {
  const found: [string, string, string | undefined][] = [
    ["Storyboard Kit", "sb", kitScript("storyboard")],
    ["Wireframe Kit", "wf", kitScript("wireframe")],
    ["Flowchart Kit", "fc", SELF],
  ];
  for (const [name, short, path] of found) console.log(path ? `✓ ${name.padEnd(15)} ${short}   docs: ${join(dirname(dirname(path)), "SKILL.md")}` : `✗ ${name.padEnd(15)} not installed (${short === "sb" ? "https://github.com/jnemargut/storyboard-kit" : "https://github.com/jnemargut/wireframe-kit"})`);
  const have = found.filter(([, , p]) => p);
  // shell functions (not variables): they work the same in bash and zsh
  console.log(`\nDefine these once in your shell (bash or zsh), then use ${have.map(([, s]) => s).join(", ")} like commands:\n`);
  for (const [, short, path] of have) console.log(`${short}() { node "${path}" "$@"; }`);
  const missing = found.filter(([, , p]) => !p).map(([n]) => n);
  if (missing.length) console.log(`\nWithout ${missing.join(" and ")}, /low-fi-think works around ${missing.length > 1 ? "them" : "it"} (see its SKILL.md).`);
}

function upsertBlock(path: string, block: string) {
  const start = "<!-- flowchart:start -->", end = "<!-- flowchart:end -->";
  let text = existsSync(path) ? readFileSync(path, "utf8") : "";
  const re = new RegExp(`${start}[\\s\\S]*?${end}\\n?`);
  text = re.test(text) ? text.replace(re, block) : (text.trim() ? text.trimEnd() + "\n\n" : "") + block;
  writeFileSync(path, text);
}

function vocab(flags: Record<string, string | boolean>) {
  if (flags.json) { console.log(JSON.stringify({ nodes: NODE_TYPES, nodeProps: NODE_PROPS, stickies: STICKY, stamps: STAMPS, frameProps: FRAME_PROPS, sides: SIDES, linkProps: LINK_PROPS }, null, 2)); return; }
  console.log("Node types (\"type\", default box):");
  for (const d of Object.values(NODE_TYPES)) console.log(`  ${d.type.padEnd(8)} ${d.doc}\n           ${JSON.stringify(d.example)}`);
  console.log("\nNode properties:");
  for (const [k, v] of Object.entries(NODE_PROPS)) console.log(`  ${k.padEnd(8)} ${v}`);
  console.log("\nSticky colors:");
  for (const [k, v] of Object.entries(STICKY)) console.log(`  ${k.padEnd(8)} ${v.doc}`);
  console.log("\nStamps (\"icon\"):");
  for (const [k, v] of Object.entries(STAMPS)) console.log(`  ${k.padEnd(12)} ${v}`);
  console.log("\nFrame properties:");
  for (const [k, v] of Object.entries(FRAME_PROPS)) console.log(`  ${k.padEnd(8)} ${v}`);
  console.log("\nLink properties:");
  for (const [k, v] of Object.entries(LINK_PROPS)) console.log(`  ${k.padEnd(8)} ${v}`);
}

function cards(target: string | undefined) {
  const isBoard = !!target && target.endsWith(".json") && existsSync(target);
  const dir = resolve(isBoard ? dirname(target!) : target ?? ".");
  if (isBoard) {
    const { doc, abs } = load(target);
    const cs = resolveCards(doc, abs);
    const ids = Object.keys(cs);
    console.log(ids.length ? `Cards on ${basename(abs)}:` : `No cards on ${basename(abs)} yet.`);
    for (const id of ids) {
      const c = cs[id];
      const state = { ok: "✓ up to date", stale: "! out of date (install its kit to refresh it)", missing: "✗ can't find it", nokit: "✗ not drawn yet: install its kit", unknown: "✗ unknown" }[c.state];
      console.log(`  ${id.padEnd(14)} ${c.label.padEnd(44)} ${state}${c.problem ? ` (${c.problem})` : ""}`);
    }
    console.log("");
  }
  const found = nearby(dir);
  if (!found.length) { console.log(`No storyboards or wireframes in ${dir}.`); return; }
  console.log(`Storyboards and wireframes you can put on a board (refs relative to ${dir}):`);
  for (const f of found) {
    console.log(`  ${f.ref}  (${f.kind}: "${f.title}")`);
    for (const p of f.parts) console.log(`      ${`${f.ref}#${p.id}`.padEnd(54)} ${p.title}`);
  }
  for (const k of ["storyboard", "wireframe"] as const) if (found.some((f) => f.kind === k) && !kitScript(k)) console.log(`\n! ${k === "storyboard" ? "Storyboard Kit" : "Wireframe Kit"} isn't installed, so its cards show the last picture it drew (if any).`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = args(rest);
  if (["render", "export", "dev"].includes(cmd)) await initRenderer();
  switch (cmd) {
    case "vocab": return vocab(flags);
    case "validate": {
      const { doc } = load(pos[0]);
      const r = validate(doc);
      if (flags.json) console.log(JSON.stringify(r, null, 2));
      else console.log(formatResult(r, pos[0], r.ok ? doc : undefined));
      process.exit(r.ok ? 0 : 1);
    }
    case "cards": return cards(pos[0]);
    case "kits": return kits();
    case "format": {
      const { doc, abs } = load(pos[0]);
      writeFileSync(abs, formatJSON(doc));
      console.log(`✓ formatted ${pos[0]}`);
      return;
    }
    case "render": {
      const { doc, abs, frame } = load(pos[0]);
      requireValid(doc, pos[0]);
      if (frame && !doc.frames?.[frame]) { console.error(`No frame "${frame}" in ${basename(abs)}. Frames: ${Object.keys(doc.frames ?? {}).join(", ") || "(none)"}`); process.exit(1); }
      const out = join(dirname(abs), `${stemOf(abs)}${frame ? `.${frame}` : ""}.png`);
      writeFileSync(out, boardPNG(doc, abs, { frame, scale: Number(flags.scale ?? 1.5) }));
      if (!flags.quiet) console.log(`✓ rendered ${basename(out)}`);
      return;
    }
    case "export": {
      const { doc, abs } = load(pos[0]);
      requireValid(doc, pos[0]);
      const want = { png: !!flags.png, svg: !!flags.svg, pdf: !!flags.pdf, pptx: !!flags.pptx, canvas: !!flags.canvas };
      if (!Object.values(want).some(Boolean)) want.png = true;
      const outDir = ensureDir(resolve(typeof flags.out === "string" ? flags.out : dirname(abs)));
      const stem = stemOf(abs);
      const written: string[] = [];
      const w = (name: string, data: string | Uint8Array) => { writeFileSync(join(outDir, name), data); written.push(join(outDir, name)); };
      if (want.png) w(`${stem}.png`, boardPNG(doc, abs, { prep: prepare(doc, abs), scale: Number(flags.scale ?? 1.5) }));
      if (want.svg) w(`${stem}.svg`, boardSVGFile(doc, abs));
      if (want.pdf) w(`${stem}.pdf`, await toPDF(doc, abs));
      if (want.pptx) w(`${stem}.pptx`, await toPPTX(doc, abs));
      if (want.canvas) w(`${stem}.canvas`, toJSONCanvas(doc, abs, outDir));
      console.log(`✓ exported ${written.join(", ")}`);
      if (want.pptx || want.pdf) { const p = prepare(doc, abs); console.log(`  ${slides(doc, p.L).length} slide(s): ${slides(doc, p.L).map((s) => s.title).join(" → ")}`); }
      return;
    }
    case "source": {
      if (!pos[0] || !existsSync(pos[0])) { console.error("Usage: flowchart source <file.png>"); process.exit(2); }
      const src = readSource(readFileSync(pos[0]));
      if (!src) { console.error(`${pos[0]} has no flowchart source in it.`); process.exit(1); }
      if (typeof flags.out === "string") { writeFileSync(flags.out, formatJSON(src.source)); console.log(`✓ wrote ${flags.out} (from ${src.file})`); }
      else console.log(formatJSON(src.source));
      return;
    }
    case "dev": {
      const file = pos[0] ?? lastFile();
      if (!file) { console.error("Usage: flowchart dev <file>  (no *.flowchart.json found here)"); process.exit(2); }
      remember(file);
      await dev(file.replace(/#.*$/, ""), { port: Number(flags.port ?? 4500), open: flags.open !== false });
      return;
    }
    case "new": {
      const file = pos[0] ?? "board.flowchart.json";
      if (existsSync(file)) { console.error(`${file} already exists.`); process.exit(1); }
      writeFileSync(file, formatJSON(STARTER(typeof flags.title === "string" ? flags.title : "Untitled board")));
      console.log(`✓ created ${file}\n  next: ${RUN} dev ${file}`);
      return;
    }
    case "install": {
      const done: string[] = [];
      if (flags.project) {
        done.push(installTo(resolve(".claude/skills/flowchart")), installTo(resolve(".agents/skills/flowchart")));
        upsertBlock("AGENTS.md", agentsBlock(".agents/skills/flowchart"));
        done.push("AGENTS.md (pointer for agents that don't load skills on their own)");
      } else {
        done.push(installTo(join(homedir(), ".claude/skills/flowchart")));
        if (flags.codex) done.push(installTo(join(homedir(), ".codex/skills/flowchart")));
      }
      console.log(`✓ flowchart skill installed (with /low-fi-think next to it):\n  ${done.join("\n  ")}\n\nRestart your agent, then type: /flowchart <a flow or board>…\nor /low-fi-think <a problem, a request, some links>…`);
      return;
    }
    case undefined: case "help": case "--help": case "-h":
      console.log(HELP); return;
    default:
      console.error(`Unknown command "${cmd}".\n\n${HELP}`); process.exit(2);
  }
}

/** The file `dev` opens with no argument: the last one used here, else the only one in the folder. */
function lastFile(): string | undefined {
  const mem = join(".flowchart", "last");
  if (existsSync(mem)) { const f = readFileSync(mem, "utf8").trim(); if (existsSync(f)) return f; }
  const here = readdirSync(".").filter((f) => f.endsWith(".flowchart.json"));
  return here.length === 1 ? here[0] : undefined;
}
function remember(file: string) {
  try { mkdirSync(".flowchart", { recursive: true }); writeFileSync(join(".flowchart", "last"), file); } catch { /* read-only folder: fine */ }
}

main().catch((e) => { console.error(`✗ ${(e as Error).message}`); process.exit(1); });
