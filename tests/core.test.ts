import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { nearby, parseRef, resolveCards } from "../src/cards";
import { boardPNG, initRenderer, prepare, toJSONCanvas } from "../src/export";
import { freeSpot, frameAt, homeFrame, layoutBoard, measure, slides } from "../src/layout";
import { readSource } from "../src/png";
import { boardSVG } from "../src/render/board";
import { buildSchema } from "../src/schema";
import type { FlowchartFile } from "../src/types";
import { validate } from "../src/validate";
import { STAMP_NAMES, TYPES } from "../src/vocab";
import * as M from "../src/editor/model";

const EX = "examples/late-order.flowchart.json";
const example = (): FlowchartFile => JSON.parse(readFileSync(EX, "utf8"));
const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

beforeAll(() => initRenderer());

describe("layout", () => {
  it("lays a flow out left to right, in order", () => {
    const L = layoutBoard(example());
    const xs = ["leave", "order", "ready", "go"].map((id) => L.nodes[id].x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });
  it("runs a frame down when asked", () => {
    const d = example();
    d.frames!.happy.dir = "down";
    const L = layoutBoard(d);
    expect(L.nodes.order.y).toBeGreaterThan(L.nodes.leave.y);
  });
  it("places frames by relation, without overlapping", () => {
    const L = layoutBoard(example());
    const { happy, late, ideas } = L.frames;
    expect(late.x).toBeGreaterThan(happy.x + happy.w);
    expect(ideas.y).toBeGreaterThan(late.y + late.h);
    expect(overlap(happy, late) || overlap(late, ideas) || overlap(happy, ideas)).toBe(false);
  });
  it("finds the nearest free spot when the obvious one is taken", () => {
    const spot = freeSpot({ x: 0, y: 0, w: 100, h: 100 }, [{ x: 0, y: 0, w: 100, h: 100 }]);
    expect(overlap(spot, { x: -59, y: -59, w: 218, h: 218 })).toBe(false);
    expect(Math.hypot(spot.x, spot.y)).toBeLessThan(400);
  });
  it("keeps every node inside its frame", () => {
    const L = layoutBoard(example(), resolveCards(example(), EX));
    for (const n of Object.values(L.nodes)) {
      if (!n.frame) continue;
      const f = L.frames[n.frame];
      expect(n.x >= f.x && n.y >= f.y && n.x + n.w <= f.x + f.w && n.y + n.h <= f.y + f.h, n.id).toBe(true);
    }
  });
  it("puts notes beside their node and stamps on top of theirs", () => {
    const L = layoutBoard(example());
    const s = L.nodes.never, t = L.nodes.check;
    expect(Math.hypot(s.x + s.w / 2 - (t.x + t.w / 2), s.y + s.h / 2 - (t.y + t.h / 2))).toBeLessThan(260);
    expect(homeFrame(example(), "never")).toBe("late");
    const st = L.nodes.tap, card = L.nodes.screen;
    expect(st.x + st.w / 2).toBeCloseTo(card.x + card.w * 0.5, 0);
    expect(st.y + st.h / 2).toBeCloseTo(card.y + card.h * 0.36, 0);
  });
  it("applies the designer's nudges and sizes", () => {
    const d = example();
    const before = layoutBoard(d).nodes.go;
    d.layout = { go: { dx: 30, dy: -10, w: 220 } };
    const after = layoutBoard(d).nodes.go;
    expect(after.x - before.x).toBeGreaterThanOrEqual(30);
    expect(after.w).toBe(220);
  });
  it("keeps a frame where the designer put it", () => {
    const d = example();
    d.canvas = { ideas: [-2000, 900] };
    expect(layoutBoard(d).frames.ideas.ox).toBe(-2000);
  });
  it("labels decisions' arrows and sends cross-frame links between frames", () => {
    const L = layoutBoard(example());
    const no = L.edges.find((e) => e.label === "no")!;
    expect(no.from).toBe("ready");
    expect(no.end[0]).toBeGreaterThan(L.frames.late.x - 1);
  });
  it("wraps long words and grows the box", () => {
    expect(measure({ text: "a much longer step that needs to wrap onto lines" }).lines.length).toBeGreaterThan(1);
  });
  it("knows which frame is under a point", () => {
    const L = layoutBoard(example());
    const f = L.frames.late;
    expect(frameAt(L, f.x + 10, f.y + 10)).toBe("late");
    expect(frameAt(L, -5000, -5000)).toBe("");
  });
  it("makes slides from frames, in presenting order", () => {
    const d = example();
    d.present = ["ideas", "happy"];
    expect(slides(d, layoutBoard(d)).map((s) => s.id)).toEqual(["ideas", "happy"]);
    expect(slides({ title: "x", nodes: { a: { text: "hi" } } }, layoutBoard({ title: "x", nodes: { a: { text: "hi" } } }))[0].id).toBe("");
  });
});

describe("validate", () => {
  it("passes the example", () => expect(validate(example()).errors).toEqual([]));
  it("suggests fixes for typos", () => {
    const r = validate({ title: "x", nodes: { a: { type: "dimond" as never }, s: { type: "sticky", color: "pnk" as never, text: "?" }, t: { type: "stamp", icon: "smile" } }, links: [{ from: "a", to: "b" }] });
    const text = r.errors.map((e) => e.hint).join(" ");
    expect(text).toContain('"diamond"');
    expect(text).toContain('"pink"');
    expect(text).toContain('"smiley"');
  });
  it("wants decisions to have labeled ways out", () => {
    const r = validate({ title: "x", nodes: { q: { type: "diamond", text: "?" }, a: { text: "a" } }, links: [{ from: "q", to: "a" }] });
    expect(r.warnings.some((w) => w.message.includes("only one way"))).toBe(true);
  });
  it("checks frames, relations and the presenting order", () => {
    const r = validate({ title: "x", frames: { a: { near: ["beside" as never, "b"] } }, nodes: { n: { text: "x", frame: "z" } }, present: ["q"] });
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
  it("checks urls and link cards", () => {
    const r = validate({ title: "x", nodes: { l: { type: "link", text: "spec" }, b: { text: "x", url: "not a url" } } });
    expect(r.errors.map((e) => e.path)).toEqual(expect.arrayContaining(["nodes.l.url", "nodes.b.url"]));
  });
});

describe("cards", () => {
  it("parses refs", () => {
    expect(parseRef("./x.storyboard.json#in-line")).toEqual({ file: "./x.storyboard.json", part: "in-line", kind: "storyboard" });
    expect(parseRef("./x.wireframe.json").kind).toBe("wireframe");
    expect(parseRef("./photo.JPG").kind).toBe("image");
  });
  it("finds storyboards and wireframes nearby, with their parts", () => {
    const n = nearby("examples");
    expect(n.find((f) => f.kind === "storyboard")?.parts.map((p) => p.id)).toContain("asks");
    expect(n.find((f) => f.kind === "wireframe")?.parts.map((p) => p.id)).toContain("status");
  });
  it("reports missing files and unknown parts", () => {
    const d: FlowchartFile = { title: "x", nodes: { a: { type: "card", ref: "./nope.storyboard.json" }, b: { type: "card", ref: "./late-latte.storyboard.json#nope" } } };
    const c = resolveCards(d, EX, { refresh: false });
    expect(c.a.state).toBe("missing");
    expect(c.b.state).toBe("unknown");
  });
  it("sizes cards from their pictures", () => {
    const L = layoutBoard(example(), resolveCards(example(), EX, { refresh: false }));
    expect(L.nodes.screen.h).toBeGreaterThan(L.nodes.screen.w);
    expect(L.nodes.panel.w).toBeGreaterThan(L.nodes.panel.h - 30);
  });
});

describe("render and export", () => {
  it("draws every node", () => {
    const d = example();
    const svg = boardSVG(d, prepare(d, EX));
    for (const id of Object.keys(d.nodes)) expect(svg).toContain(`data-node="${id}"`);
    expect(svg).toContain("data:image/png;base64");
    expect(svg).toContain('href="https://example.atlassian.net/browse/ORDER-412"');
  });
  it("draws every stamp", () => {
    const nodes = Object.fromEntries(STAMP_NAMES.map((s) => [s, { type: "stamp" as const, icon: s }]));
    expect(validate({ title: "stamps", nodes }).errors).toEqual([]);
    const svg = boardSVG({ title: "stamps", nodes });
    expect((svg.match(/data-node=/g) ?? []).length).toBe(STAMP_NAMES.length);
  });
  it("round-trips the source through a PNG", () => {
    const d = example();
    const png = boardPNG(d, EX, { scale: 0.5, frame: "ideas" });
    expect(readSource(png)?.source).toEqual(d);
  });
  it("exports JSON Canvas", () => {
    const c = JSON.parse(toJSONCanvas(example(), EX, "examples"));
    expect(c.nodes.filter((n: { type: string }) => n.type === "group")).toHaveLength(3);
    expect(c.edges).toHaveLength(9);
  });
  it("has a schema entry for every node type", () => {
    expect((buildSchema().properties.nodes.additionalProperties.properties.type as { enum: string[] }).enum).toEqual(TYPES);
  });
});

describe("staying put", () => {
  it("pinned boxes don't move when an arrow flips", () => {
    const d0 = example();
    const L0 = layoutBoard(d0);
    const flipped = { ...d0, links: d0.links!.map((l) => (l.from === "order" && l.to === "ready" ? { ...l, from: "ready", to: "order" } : l)) };
    const pinned = M.pinAll(d0, L0, flipped);
    const L1 = layoutBoard(pinned);
    for (const id of ["leave", "order", "ready", "go", "wait", "ask"]) expect([L1.nodes[id].x, L1.nodes[id].y], id).toEqual([L0.nodes[id].x, L0.nodes[id].y]);
  });
  it("puts a new step next to what it's linked from", () => {
    const d0 = example();
    const L0 = layoutBoard(d0);
    const r = M.addNode(d0, { text: "Next", frame: "happy" }, "next");
    const d1 = M.pinAll(d0, L0, M.addLink(r.doc, "go", "next"));
    const L1 = layoutBoard(d1);
    const n = L1.nodes.next, g = L1.nodes.go;
    expect(n.x).toBeGreaterThan(g.x + g.w - 1);
    expect(Math.abs(n.y + n.h / 2 - (g.y + g.h / 2))).toBeLessThan(80);
    for (const b of Object.values(L1.nodes)) if (b.id !== "next" && b.type !== "sticky") expect(overlap(n, b), b.id).toBe(false);
  });
  it("tidies up again on request", () => {
    const d0 = example();
    const L0 = layoutBoard(d0);
    const pinned = M.pinAll(d0, L0, { ...d0, layout: { ...(d0.layout ?? {}), go: { dx: 300 } } });
    expect(M.autoLayout(pinned, layoutBoard(pinned)).layout?.go).toBeUndefined();
  });
  it("draws angled and straight connectors, and arrowheads where asked", () => {
    const d = example();
    d.links = d.links!.map((l, i) => (i === 0 ? { ...l, shape: "angled" as const, head: "both" as const } : i === 1 ? { ...l, shape: "straight" as const, head: "none" as const } : l));
    const L = layoutBoard(d);
    expect(L.edges[0].d).toMatch(/Q/);
    expect(L.edges[1].d).toMatch(/^M[\d.\s-]+L[\d.\s-]+$/);
    expect(L.edges[0].head).toBe("both");
    expect(L.edges[1].head).toBe("none");
  });
});

describe("editing", () => {
  it("renames a node and everything that points at it", () => {
    const d = M.renameNode(example(), "check", "checks-app");
    expect(d.nodes["checks-app"]).toBeDefined();
    expect(d.nodes.never.near).toBe("checks-app");
    expect(d.links!.some((l) => l.from === "checks-app")).toBe(true);
  });
  it("removes nodes with their links and the stamps on them", () => {
    const d = M.removeNodes(example(), ["screen"]);
    expect(d.nodes.tap).toBeUndefined();
    expect(d.links!.some((l) => l.to === "screen")).toBe(false);
  });
  it("places a node exactly where it was dropped", () => {
    const d = M.placeAt(example(), "go", 500, 500, {});
    const b = layoutBoard(d).nodes.go;
    expect([b.x, b.y]).toEqual([500, 500]);
  });
  it("removes a frame and what's in it", () => {
    const d0 = example();
    const d = M.removeFrame(d0, "ideas", layoutBoard(d0));
    expect(d.frames!.ideas).toBeUndefined();
    expect(d.nodes.queue).toBeUndefined();
    expect(d.present).toEqual(["happy", "late"]);
  });
});
