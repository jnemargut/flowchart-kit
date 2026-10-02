// Across the kits: copy a panel in Storyboard Kit and a screen in Wireframe Kit, paste both onto a board, and
// both land as live cards. Uses the installed kits (~/.claude/skills); skips if they aren't there.
// Run after `npm run build`: npm run e2e:kits
import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

const dir = mkdtempSync(join(tmpdir(), "fc-cross-"));
cpSync("examples", dir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const start = (script, file, port) => new Promise((ok) => {
  const p = spawn("node", [script, "dev", join(dir, file), "--no-open", "--port", String(port)], { cwd: dir, stdio: ["ignore", "pipe", "inherit"] });
  p.stdout.on("data", (d) => { const m = /localhost:(\d+)/.exec(String(d)); if (m) ok({ p, url: `http://localhost:${m[1]}/` }); });
});
const SB = process.env.STORYBOARD_KIT ?? join(homedir(), ".claude/skills/storyboard/scripts/storyboard.mjs");
const WF = process.env.WIREFRAME_KIT ?? join(homedir(), ".claude/skills/wireframe/scripts/wireframe.mjs");
if (!existsSync(SB) || !existsSync(WF)) { console.log("skipped: install Storyboard Kit and Wireframe Kit first"); process.exit(0); }
const sb = await start(SB, "late-latte.storyboard.json", 4610);
const wf = await start(WF, "order-ahead.wireframe.json", 4620);
const fc = await start(join(process.cwd(), "skills/flowchart/scripts/flowchart.mjs"), "late-order.flowchart.json", 4630);
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
const page = await ctx.newPage();
page.setDefaultTimeout(30000);
const read = () => JSON.parse(readFileSync(join(dir, "late-order.flowchart.json"), "utf8"));
let fails = 0;
const ok = (n, c, x = "") => { console.log(`${c ? "✓" : "✗"} ${n} ${c ? "" : x}`); if (!c) fails++; };
const pasteOnBoard = async () => {
  await page.goto(fc.url);
  await page.waitForSelector("svg.board [data-node]");
  await sleep(500);
  await page.mouse.move(700, 700);
  await page.keyboard.press("Meta+v");
};
try {
  // Storyboard Kit: copy the "in-line" panel
  await page.goto(sb.url);
  await page.waitForSelector('g[data-panel="walking"]');
  await page.locator('g[data-panel="walking"] rect[data-el="__panel"]').click({ position: { x: 12, y: 12 }, force: true });
  await page.keyboard.press("Meta+c");
  for (let t = 0; t < 200; t++) { if ((await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types))).includes("image/png")) break; await sleep(150); }
  await pasteOnBoard();
  await sleep(2500);
  const card = Object.values(read().nodes).find((n) => n.type === "card" && n.ref?.includes("#walking"));
  ok("a panel copied in Storyboard Kit pastes as a live card", card?.ref === "./late-latte.storyboard.json#walking", JSON.stringify(Object.values(read().nodes).filter((n) => n.type === "card")));

  // Wireframe Kit: copy the "cart" screen as an image
  await page.goto(wf.url);
  await page.waitForSelector("svg.shot");
  await page.locator(".screen-list button", { hasText: "Your order" }).click();
  await page.locator("button", { hasText: /^Copy as image$/ }).click();
  for (let t = 0; t < 200; t++) { if ((await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types))).includes("image/png")) break; await sleep(150); }
  await pasteOnBoard();
  await sleep(2500);
  const scr = Object.values(read().nodes).find((n) => n.type === "card" && n.ref?.includes("#cart"));
  ok("a screen copied in Wireframe Kit pastes as a live card", scr?.ref === "./order-ahead.wireframe.json#cart", JSON.stringify(Object.values(read().nodes).filter((n) => n.type === "card")));
} finally {
  await browser.close();
  for (const s of [sb, wf, fc]) s.p.kill();
}
console.log(fails ? `\n${fails} failed` : "\nall passed");
process.exit(fails ? 1 : 0);
