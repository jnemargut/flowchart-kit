// End to end: the built skill's CLI and editor, driven in a real browser.
// Run after `npm run build`: npm run e2e
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const FC = join(process.cwd(), "skills/flowchart/scripts/flowchart.mjs");
const dir = mkdtempSync(join(tmpdir(), "fc-e2e-"));
cpSync("examples", dir, { recursive: true });
const file = join(dir, "late-order.flowchart.json");
const read = () => JSON.parse(readFileSync(file, "utf8"));
let failures = 0;
const ok = (name, cond, extra = "") => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : ` ${extra}`}`); if (!cond) failures++; };
// a read can land mid-save (half a file): that's "not yet", so keep waiting
const until = async (fn, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch { /* mid-save */ } await new Promise((r) => setTimeout(r, 80)); } return false; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// CLI
const cli = (...a) => execFileSync(process.execPath, [FC, ...a], { cwd: dir, encoding: "utf8" });
ok("validate passes the example", /is valid \(3 frame/.test(cli("validate", file)));
ok("cards lists panels and screens nearby", cli("cards").includes("./late-latte.storyboard.json#asks"));
ok("cards reports the board's cards", /panel\s+late-latte\.storyboard\.json#asks/.test(cli("cards", file)));
cli("render", file, "--quiet");
ok("render writes <name>.png", existsSync(join(dir, "late-order.png")));
ok("the PNG carries its source", JSON.parse(cli("source", join(dir, "late-order.png"))).title === read().title);
cli("render", `${file}#late`, "--quiet");
ok("render #frame writes one frame", existsSync(join(dir, "late-order.late.png")));
cli("export", file, "--svg", "--pdf", "--pptx", "--canvas");
ok("export writes SVG, PDF, PPTX and JSON Canvas", ["svg", "pdf", "pptx", "canvas"].every((x) => existsSync(join(dir, `late-order.${x}`))));
const canvas = JSON.parse(readFileSync(join(dir, "late-order.canvas"), "utf8"));
ok("JSON Canvas has groups, links and file cards", canvas.nodes.some((n) => n.type === "group") && canvas.nodes.some((n) => n.type === "link") && canvas.nodes.some((n) => n.type === "file") && canvas.edges.length === 9);
ok("vocab lists stamps", cli("vocab").includes("thumbs-up"));
ok("kits lists what's installed", cli("kits").includes("Flowchart Kit"));
execFileSync(process.execPath, [FC, "install", "--project"], { cwd: dir, encoding: "utf8" });
ok("install brings /low-fi-think along", existsSync(join(dir, ".claude/skills/flowchart/SKILL.md")) && existsSync(join(dir, ".claude/skills/low-fi-think/SKILL.md")) && existsSync(join(dir, ".claude/skills/low-fi-think/references/plays.md")) && readFileSync(join(dir, "AGENTS.md"), "utf8").includes("low-fi-think/SKILL.md"));
let bad = "";
writeFileSync(join(dir, "bad.flowchart.json"), JSON.stringify({ title: "x", nodes: { a: { type: "dimond", text: "?" }, b: { type: "stamp", icon: "smile" } }, links: [{ from: "a", to: "c" }] }));
try { cli("validate", join(dir, "bad.flowchart.json")); } catch (e) { bad = String(e.stdout); }
ok("validate suggests fixes", bad.includes('Did you mean "diamond"') && bad.includes('Did you mean "smiley"'), bad);

// editor
const port = 4580 + Math.floor(Math.random() * 100);
const server = spawn(process.execPath, [FC, "dev", file, "--no-open", "--port", String(port)], { cwd: dir, stdio: ["ignore", "pipe", "inherit"] });
await new Promise((r) => server.stdout.on("data", (d) => String(d).includes("localhost") && r()));
const actual = await new Promise((r) => { r(port); });
const url = `http://localhost:${actual}/`;
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const errors = [];
process.on("uncaughtException", (e) => { console.error(e); server.kill(); process.exit(1); });
process.on("unhandledRejection", (e) => { console.error(e); server.kill(); process.exit(1); });
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(url);
await page.waitForSelector("svg.board [data-node]");
await sleep(600);
ok("canvas shows every node", (await page.locator("svg.board [data-node]").count()) === Object.keys(read().nodes).length);
ok("cards show their pictures", (await page.locator("svg.board image").count()) === 2);

/** Page coordinates of a node's center (or a fraction of it). */
const at = (id, fx = 0.5, fy = 0.5) => page.evaluate(([i, x, y]) => {
  const { L, view } = window.__fc;
  const b = L.nodes[i];
  const c = document.querySelector(".canvas").getBoundingClientRect();
  return { x: c.left + view.x + (b.x + b.w * x) * view.k, y: c.top + view.y + (b.y + b.h * y) * view.k };
}, [id, fx, fy]);
const frameTitle = (id) => page.evaluate((i) => {
  const { L, view } = window.__fc;
  const f = L.frames[i];
  const c = document.querySelector(".canvas").getBoundingClientRect();
  return { x: c.left + view.x + (f.x + 60) * view.k, y: c.top + view.y + (f.y + 30) * view.k };
}, id);
const click = async (p, o) => page.mouse.click(p.x, p.y, o);
const sel = () => page.evaluate(() => window.__fc.sel);

// zoom in a little so things are easy to hit
await page.locator(".zoom .btn").last().click();
await sleep(200);

// Tab, type, Tab, type: a flow as fast as you think
await click(await at("order"));
ok("click selects a step", (await sel())[0] === "node:order");
await page.keyboard.press("Tab");
await page.waitForSelector(".inline-edit");
await page.keyboard.type("Pays with a tap");
await page.keyboard.press("Tab");
await page.waitForSelector(".inline-edit");
await page.keyboard.type("Gets a receipt");
await page.keyboard.press("Enter");
await until(() => Object.values(read().nodes).some((n) => n.text === "Gets a receipt"));
let d = read();
const pays = Object.entries(d.nodes).find(([, n]) => n.text === "Pays with a tap")?.[0];
const receipt = Object.entries(d.nodes).find(([, n]) => n.text === "Gets a receipt")?.[0];
ok("Tab adds the next step, linked and in the same frame", !!pays && d.nodes[pays].frame === "happy" && d.links.some((l) => l.from === "order" && l.to === pays));
ok("Tab while typing keeps flowing", !!receipt && d.links.some((l) => l.from === pays && l.to === receipt));

// Enter: a sibling from the same parent
await sleep(300);
await click(await at(receipt));
await page.keyboard.press("Enter");
await page.waitForSelector(".inline-edit");
await page.keyboard.type("Gets an email");
await page.keyboard.press("Enter");
await until(() => Object.values(read().nodes).some((n) => n.text === "Gets an email"));
d = read();
const email = Object.entries(d.nodes).find(([, n]) => n.text === "Gets an email")?.[0];
ok("Enter adds a sibling from the same parent", d.links.some((l) => l.from === pays && l.to === email));

// S: a sticky beside the selected step
await sleep(300);
await click(await at(email));
await page.keyboard.press("s");
await page.waitForSelector(".inline-edit");
await page.keyboard.type("Do people want both?");
await page.keyboard.press("Enter");
await until(() => Object.values(read().nodes).some((n) => n.text === "Do people want both?"));
d = read();
ok("S sticks a sticky beside the step", Object.values(d.nodes).some((n) => n.type === "sticky" && n.near === email));

// connect by dragging a dot onto another node
await sleep(300);
const leave = await at("leave");
await page.mouse.move(leave.x, leave.y);
await sleep(150);
const dot = page.locator(".dot-handle").nth(1);
const db = await dot.boundingBox();
const go = await at("go");
await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
await page.mouse.down();
await page.mouse.move(go.x - 20, go.y, { steps: 8 });
await page.mouse.move(go.x, go.y, { steps: 4 });
await page.mouse.up();
await until(() => read().links.some((l) => l.from === "leave" && l.to === "go"));
ok("dragging a dot onto a node links them", read().links.some((l) => l.from === "leave" && l.to === "go"));

// a stamp from the palette, dropped onto a card, sticks to it
await page.keyboard.press("Escape");
await page.keyboard.press("Meta+0");
await sleep(300);
const card = await at("panel", 0.3, 0.4);
await page.locator(".stamp-tile[title^='heart']").dragTo(page.locator(".canvas"), { targetPosition: await page.evaluate(([x, y]) => { const r = document.querySelector(".canvas").getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }, [card.x, card.y]) });
await until(() => Object.values(read().nodes).some((n) => n.icon === "heart"));
const heart = Object.values(read().nodes).find((n) => n.icon === "heart");
ok("a stamp dropped on a card sticks to it", heart?.near === "panel" && Math.abs(heart.at[0] - 0.3) < 0.08, JSON.stringify(heart));

// drag a sticky from one frame into another
await sleep(300);
const refund = await at("refund");
const into = await at("wait", 0.5, 2.6);
await page.mouse.move(refund.x, refund.y);
await page.mouse.down();
await page.mouse.move(into.x, into.y, { steps: 12 });
await page.mouse.up();
await until(() => read().nodes.refund.frame === "late");
ok("dragging a sticky into another frame moves it there", read().nodes.refund.frame === "late", JSON.stringify(read().nodes.refund));

// paste a link: a link card
await sleep(300);
await page.mouse.move(go.x, go.y + 160);
await page.evaluate(() => { const dt = new DataTransfer(); dt.setData("text/plain", "https://www.figma.com/proto/abc123/late-order"); window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt })); });
await until(() => Object.values(read().nodes).some((n) => n.type === "link" && n.url?.includes("figma.com")));
ok("pasting a URL makes a link card", Object.values(read().nodes).some((n) => n.type === "link" && n.url === "https://www.figma.com/proto/abc123/late-order"));

// double-click empty space does nothing; double-click a step edits its words in place
await page.keyboard.press("Escape");
const empty = await page.evaluate(() => {
  const { L, view } = window.__fc;
  const f = L.frames.happy;
  const c = document.querySelector(".canvas").getBoundingClientRect();
  return { x: c.left + view.x + (f.x + 120) * view.k, y: c.top + view.y + (f.y + f.h + 140) * view.k };
});
const before2 = Object.keys(read().nodes).length;
await page.mouse.dblclick(empty.x, empty.y);
await sleep(400);
ok("double-clicking empty space doesn't make anything", Object.keys(read().nodes).length === before2 && (await page.locator(".inline-edit").count()) === 0);
await page.keyboard.press("Meta+0");
await sleep(300);
const goAt = await at("go");
await page.mouse.dblclick(goAt.x, goAt.y);
await page.waitForSelector(".inline-edit");
await page.keyboard.press("Meta+a");
await page.keyboard.type("A whole new thought");
await page.keyboard.press("Enter");
await until(() => read().nodes.go?.text === "A whole new thought");
ok("double-clicking a step edits its words in place", read().nodes.go?.text === "A whole new thought", read().nodes.go?.text);

// Cmd+B while typing: bold
const fresh = Object.entries(read().nodes).find(([, n]) => n.text === "A whole new thought")[0];
await page.keyboard.press("Escape");
await click(await at(fresh));
await page.keyboard.press("F2");
await page.waitForSelector(".inline-edit");
await page.keyboard.press("Meta+a");
await page.keyboard.press("Meta+b");
await page.keyboard.press("Enter");
await until(() => read().nodes[fresh]?.text === "**A whole new thought**");
ok("Cmd+B bolds the words", read().nodes[fresh]?.text === "**A whole new thought**", read().nodes[fresh]?.text);

// frames: select by title, rename in place
await page.keyboard.press("Escape");
await page.mouse.dblclick(...Object.values(await frameTitle("ideas")));
await page.waitForSelector(".inline-edit");
await page.keyboard.press("Meta+a");
await page.keyboard.type("Ideas to test");
await page.keyboard.press("Enter");
await until(() => read().frames.ideas.title === "Ideas to test");
ok("double-clicking a frame title renames it", read().frames.ideas.title === "Ideas to test");

// draw a swimlane line inside a frame: it belongs to the frame
await page.keyboard.press("Escape");
await page.keyboard.press("l");
await page.keyboard.press("Meta+0");
await sleep(300);
const [w1, w2] = await page.evaluate(() => {
  const { L, view } = window.__fc;
  const f = L.frames.late;
  const c = document.querySelector(".canvas").getBoundingClientRect();
  const p = (x, y) => ({ x: c.left + view.x + x * view.k, y: c.top + view.y + y * view.k });
  return [p(f.x + 20, f.y + f.h - 30), p(f.x + f.w * 0.6, f.y + f.h - 30)];
});
await page.mouse.move(w1.x, w1.y); await page.mouse.down(); await page.mouse.move(w2.x, w2.y, { steps: 6 }); await page.mouse.up();
await until(() => read().frames.late.shapes?.length === 1);
ok("a line drawn in a frame is stored in that frame", read().frames.late.shapes?.[0]?.type === "line", JSON.stringify({ board: read().shapes, frames: Object.fromEntries(Object.entries(read().frames).map(([k, f]) => [k, f.shapes])) }));
await page.keyboard.press("Escape");

// undo
const before = JSON.stringify(read().frames.late.shapes);
await page.keyboard.press("Meta+z");
await until(() => JSON.stringify(read().frames.late.shapes) !== before);
ok("undo takes the drawing back", !read().frames.late.shapes);

// arrows: style them from the inspector
await page.keyboard.press("Escape");
await page.keyboard.press("Meta+0");
await sleep(300);
await page.locator("svg.board text[data-edge]").first().click({ force: true });
await page.waitForSelector(".inspector h3:text('Arrow')");
const edgeIdx = Number((await sel())[0].slice(5));
await page.locator(".inspector button", { hasText: /^Angled$/ }).click();
await page.locator(".inspector button", { hasText: /^Dotted$/ }).click();
await page.locator(".inspector button", { hasText: /^None$/ }).click();
await until(() => read().links[edgeIdx]?.shape === "angled" && read().links[edgeIdx]?.style === "dotted" && read().links[edgeIdx]?.head === "none");
ok("an arrow can be angled, dotted and headless", read().links[edgeIdx]?.shape === "angled" && read().links[edgeIdx]?.style === "dotted" && read().links[edgeIdx]?.head === "none", JSON.stringify(read().links[edgeIdx]));

// connect onto a particular dot: that side is kept
await page.keyboard.press("Escape");
const ord = await at("order");
await page.mouse.move(ord.x, ord.y);
await sleep(200);
const rightDot = page.locator(".dot-handle[data-side='right']");
const rd = await rightDot.boundingBox();
const topOfGo = await page.evaluate(() => {
  const { L, view } = window.__fc;
  const b = L.nodes.go;
  const c = document.querySelector(".canvas").getBoundingClientRect();
  return { x: c.left + view.x + (b.x + b.w / 2) * view.k, y: c.top + view.y + b.y * view.k - 16 };
});
await page.mouse.move(rd.x + rd.width / 2, rd.y + rd.height / 2);
await page.mouse.down();
await page.mouse.move(topOfGo.x, topOfGo.y + 30, { steps: 8 });
await page.mouse.move(topOfGo.x, topOfGo.y, { steps: 4 });
ok("dragging over a box shows its dots", (await page.locator(".dot-handle.target").count()) === 4);
await page.mouse.up();
await until(() => read().links.some((l) => l.from === "order" && l.to === "go"));
const og = read().links.find((l) => l.from === "order" && l.to === "go");
ok("dropping on a dot pins that side", og?.toSide === "top" && og?.fromSide === "right", JSON.stringify(og));

// box looks from the inspector
await click(await at("wait"));
await page.locator(".inspector button", { hasText: /^Large$/ }).click();
await page.locator(".inspector .swatches button[aria-label='yellow']").first().click();
await page.locator(".inspector .swatches button[aria-label='red']").last().click();
await page.locator(".inspector button", { hasText: /^Thick$/ }).click();
await until(() => read().nodes.wait?.weight === "thick");
const w8 = read().nodes.wait;
ok("a box can change text size, fill, border and weight", w8.size === "l" && w8.fill === "yellow" && w8.stroke === "red" && w8.weight === "thick", JSON.stringify(w8));
ok("editing by hand pins what's on the board", typeof read().layout?.leave?.x === "number");

// layering: to back puts it first
await click(await at("wait"));
await page.keyboard.press("Meta+Shift+BracketLeft");
await until(() => Object.keys(read().nodes)[0] === "wait");
ok("To back moves it to the back", Object.keys(read().nodes)[0] === "wait");

// cut, then paste it back
await click(await at("eta"));
await page.keyboard.press("Meta+x");
await until(() => !read().nodes.eta);
ok("Cmd+X cuts", !read().nodes.eta);
const clip = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types));
ok("what's copied is a picture (for Slack) plus the things themselves", clip.includes("image/png"), clip.join(", "));
await page.mouse.move(700, 600);
await page.keyboard.press("Meta+v");
await until(() => Object.values(read().nodes).some((n) => n.text === "The app promises 4 minutes"));
ok("pasting brings the sticky back, not a picture of it", Object.values(read().nodes).some((n) => n.type === "sticky" && n.text === "The app promises 4 minutes"));

// crop a card
await page.keyboard.press("Escape");
await page.keyboard.press("Meta+0");
await sleep(300);
await click(await at("screen", 0.5, 0.15));
await sleep(200);
await page.locator(".inspector button", { hasText: /^Crop…$/ }).click();
await page.waitForSelector("[role=dialog][aria-label='Crop the picture']");
await sleep(600);
const se = await page.locator("[role=dialog] span").nth(4).boundingBox();
await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
await page.mouse.down();
await page.mouse.move(se.x - 40, se.y - 160, { steps: 6 });
await page.mouse.up();
await page.locator("[role=dialog] button", { hasText: /^Crop$/ }).click();
await until(() => Array.isArray(read().nodes.screen?.crop));
ok("a card can be cropped", Array.isArray(read().nodes.screen?.crop) && read().nodes.screen.crop[3] < 1, JSON.stringify(read().nodes.screen?.crop));

// tidy up the whole board
await page.keyboard.press("Escape");
await page.locator(".inspector button", { hasText: "Tidy up the whole board" }).click();
await until(() => typeof read().layout?.leave?.x !== "number");
ok("Tidy up lays the board out again", typeof read().layout?.leave?.x !== "number");

// the agent edits the file: the canvas follows
const agent = read();
agent.nodes["from-agent"] = { type: "sticky", text: "Added by the agent", color: "green", frame: "ideas" };
writeFileSync(file, JSON.stringify(agent, null, 2));
ok("agent edits show up live", await until(async () => (await page.locator("svg.board [data-node='from-agent']").count()) === 1));

// Play: frames are slides
await page.keyboard.press("p");
await page.waitForSelector(".play");
ok("Play starts on the first slide", (await page.locator(".play-count").textContent()) === "1 / 3");
await page.keyboard.press("ArrowRight");
ok("→ goes to the next slide", (await page.locator(".play-count").textContent()) === "2 / 3");
await page.keyboard.press("n");
ok("N shows the speaker notes", (await page.locator(".play-notes").textContent()).includes("8am"));
await page.keyboard.press("d");
const sl = await page.locator(".play-slide").boundingBox();
await page.mouse.move(sl.x + 100, sl.y + 100); await page.mouse.down(); await page.mouse.move(sl.x + 220, sl.y + 160, { steps: 6 }); await page.mouse.up();
await until(() => read().markup?.late?.length === 1);
ok("the sharpie saves markup for that frame", read().markup?.late?.length === 1);
await page.keyboard.press("d");
await page.keyboard.press("s");
ok("S shows every slide", (await page.locator(".play-strip .thumb").count()) === 3);
await page.keyboard.press("Escape");
ok("Esc leaves Play", (await page.locator(".play").count()) === 0);

// the properties panel can be hidden (button or Cmd+\\) and comes back
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Properties" }).click();
ok("Properties hides the panel", (await page.locator(".inspector").count()) === 0);
await page.keyboard.press("Meta+Backslash");
ok("Cmd+\\ brings it back", (await page.locator(".inspector").count()) === 1);

// exports from the editor
for (const fmt of ["png", "svg", "pdf", "pptx", "canvas"]) {
  const r = await page.evaluate(async (f) => { const res = await fetch(`/api/export?format=${f}`); return { ok: res.ok, n: (await res.arrayBuffer()).byteLength }; }, fmt);
  ok(`export ${fmt} from the editor`, r.ok && r.n > 200);
}
ok("the board is still valid", /is valid/.test(cli("validate", file)));
ok("no console errors", !errors.length, errors.join("\n"));

await ctx.close();
await browser.close();
server.kill();
console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
