/** Chart cards: the checker's advice, how they're drawn and sized, and how they leave the board. */
import { beforeAll, describe, expect, it } from "vitest";
import { boardPNG, initRenderer, toJSONCanvas } from "../src/export";
import { layoutBoard } from "../src/layout";
import { boardSVG } from "../src/render/board";
import { buildSchema } from "../src/schema";
import type { FlowchartFile, FNode } from "../src/types";
import { validate } from "../src/validate";
import { CHART_KINDS, TYPES } from "../src/vocab";

beforeAll(() => initRenderer());

const DATA: [string, number][] = [["Browse", 1200], ["Cart", 640], ["Checkout", 410], ["Paid", 210]];
const board = (n: FNode, more: Record<string, FNode> = {}): FlowchartFile => ({ title: "c", nodes: { c: n, ...more } });
const issues = (n: FNode) => { const r = validate(board(n)); return { errors: r.errors.map((e) => `${e.path}: ${e.message} ${e.hint ?? ""}`), warnings: r.warnings.map((e) => `${e.path}: ${e.message} ${e.hint ?? ""}`) }; };

describe("checking charts", () => {
  it("a chart is a node type, and a good one is clean", () => {
    expect(TYPES).toContain("chart");
    const r = issues({ type: "chart", kind: "funnel", text: "Drop-off", data: DATA, highlight: "Cart", unit: "people", color: "red" });
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("accepts the numbers as an object too, and any hex accent", () => {
    expect(issues({ type: "chart", kind: "pie", data: { Yes: 3, No: 1 }, color: "#7a3cb5" }).errors).toEqual([]);
  });

  it("suggests the right kind, color and highlight", () => {
    expect(issues({ type: "chart", kind: "bars", data: DATA }).errors.join()).toMatch(/Did you mean "bar"/);
    expect(issues({ type: "chart", data: DATA, color: "blu" }).errors.join()).toMatch(/Did you mean "blue"/);
    expect(issues({ type: "chart", data: DATA, highlight: "cart " }).errors).toEqual([]);
    expect(issues({ type: "chart", data: DATA, highlight: "Carts" }).errors.join()).toMatch(/Did you mean "Cart"/);
  });

  it("nudges: no numbers, rows without numbers, negative pies, a growing funnel, too many slices", () => {
    expect(issues({ type: "chart" }).warnings.join()).toMatch(/no numbers yet/);
    expect(issues({ type: "chart", data: [["A", 1], ["B", "lots"]] as unknown as [string, number][] }).warnings.join()).toMatch(/1 of the rows/);
    expect(issues({ type: "chart", kind: "pie", data: [["A", 3], ["B", -1]] }).warnings.join()).toMatch(/negative/);
    expect(issues({ type: "chart", kind: "funnel", data: [["A", 3], ["B", 5]] }).warnings.join()).toMatch(/narrower/);
    expect(issues({ type: "chart", kind: "pie", data: Array.from({ length: 9 }, (_, i) => [`S${i}`, i + 1] as [string, number]) }).warnings.join()).toMatch(/a lot for a pie/);
    expect(issues({ type: "chart", data: "1,2,3" as unknown as [string, number][] }).errors.join()).toMatch(/list of \[label, number\]/);
  });

  it("chart-only properties on something else get a warning", () => {
    expect(issues({ type: "box", text: "Hi", data: DATA, kind: "bar" }).warnings.join()).toMatch(/only applies to charts/);
  });

  it("the schema knows charts", () => {
    const s = JSON.stringify(buildSchema());
    for (const k of CHART_KINDS) expect(s).toContain(`"${k}"`);
    expect(s).toContain("highlight");
  });
});

describe("drawing charts", () => {
  it("draws the title, every label and the numbers, for every kind", () => {
    for (const kind of CHART_KINDS) {
      const svg = boardSVG(board({ type: "chart", kind, text: "Where people drop off", data: DATA, unit: "people" }));
      expect(svg, kind).toContain("Where people drop off");
      for (const [l] of DATA) expect(svg, kind).toContain(l);
      expect(svg, kind).not.toMatch(/NaN|Infinity/);
    }
  });

  it("is a card-sized node that grows with a longer title, and keeps a resize", () => {
    const short = layoutBoard(board({ type: "chart", text: "Hi", data: DATA })).nodes.c;
    const long = layoutBoard(board({ type: "chart", text: "A much longer title that wraps onto a second line for sure", data: DATA })).nodes.c;
    expect(short.w).toBeGreaterThanOrEqual(300);
    expect(long.h).toBeGreaterThan(short.h);
    const sized = layoutBoard({ ...board({ type: "chart", data: DATA, frame: "f" }), frames: { f: {} }, layout: { c: { w: 520, h: 300 } } } as FlowchartFile).nodes.c;
    expect([sized.w, sized.h]).toEqual([520, 300]);
  });

  it("a sticky beside a chart sits next to it, not on it", () => {
    const L = layoutBoard(board({ type: "chart", data: DATA }, { s: { type: "sticky", text: "Most drop off at the cart", near: "c" } }));
    const a = L.nodes.c, b = L.nodes.s;
    expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
  });

  it("renders to a PNG", () => {
    const png = boardPNG(board({ type: "chart", kind: "donut", text: "Late orders", data: { "Main St": 31, Station: 22 } }), "x.flowchart.json", { scale: 0.5 });
    expect(png.byteLength).toBeGreaterThan(1000);
  });

  it("leaves the board as readable text in JSON Canvas", () => {
    const c = JSON.parse(toJSONCanvas(board({ type: "chart", text: "Drop-off", data: DATA, unit: "people" }), "x.flowchart.json", "."));
    const node = c.nodes.find((x: { id: string }) => x.id === "c");
    expect(node.type).toBe("text");
    expect(node.text).toContain("**Drop-off**");
    expect(node.text).toContain("- Cart: 640 people");
  });
});
