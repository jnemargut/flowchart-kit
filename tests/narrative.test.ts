/** A board that reads on its own: a lead per frame, a numbered reading order, notes as an outline, and the critique. */
import { describe, expect, it } from "vitest";
import { critique, formatCritique } from "../src/critique";
import { hostOf, layoutBoard, TITLE_H } from "../src/layout";
import { boardSVG } from "../src/render/board";
import { buildSchema } from "../src/schema";
import type { FlowchartFile, FNode } from "../src/types";
import { validate } from "../src/validate";

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const sticky = (text: string, more: Partial<FNode> = {}): FNode => ({ type: "sticky", text, frame: "f", ...more });
const head = (text: string, more: Partial<FNode> = {}): FNode => ({ type: "text", text, frame: "f", ...more });
const one = (nodes: Record<string, FNode>, frame: Record<string, unknown> = {}): FlowchartFile => ({ title: "t", frames: { f: { title: "A frame", ...frame } }, nodes });

describe("a frame's lead", () => {
  it("is allowed, documented and drawn under the title", () => {
    const doc = one({ a: sticky("A") }, { lead: "Lateness isn't what stops people lending." });
    expect(validate(doc).errors).toEqual([]);
    expect(JSON.stringify(buildSchema())).toContain('"lead"');
    expect(boardSVG(doc)).toContain("Lateness isn&#x27;t what stops people lending.");
  });

  it("makes room above the contents, so nothing inside moves", () => {
    const nodes = { a: sticky("A"), b: sticky("B") };
    const plain = layoutBoard(one(nodes)), led = layoutBoard(one(nodes, { lead: "This frame has a point and says it in a sentence." }));
    expect(led.frames.f.lead.length).toBeGreaterThan(0);
    expect(led.frames.f.h).toBeGreaterThan(plain.frames.f.h);
    // the sticky is the same distance from the frame's bottom-left corner
    expect(led.frames.f.y + led.frames.f.h - led.nodes.a.y).toBe(plain.frames.f.y + plain.frames.f.h - plain.nodes.a.y);
    expect(led.nodes.a.x - led.frames.f.x).toBe(plain.nodes.a.x - plain.frames.f.x);
    // and it clears the lead
    expect(led.nodes.a.y).toBeGreaterThanOrEqual(led.frames.f.y + TITLE_H + led.frames.f.lead.length * 28);
  });

  it("wraps a long lead to the frame and keeps a short frame wide enough to read it", () => {
    const L = layoutBoard(one({ a: sticky("A") }, { lead: "A long lead that says quite a lot about what this frame is for, so that it has to wrap onto a second line at least." }));
    expect(L.frames.f.lead.length).toBeGreaterThan(1);
    expect(L.frames.f.w).toBeGreaterThanOrEqual(440);
  });

  it("stays out of the way when there isn't one", () => {
    expect(layoutBoard(one({ a: sticky("A") })).frames.f.lead).toEqual([]);
  });
});

describe("reading order", () => {
  const doc = (present?: string[]): FlowchartFile => ({ title: "t", frames: { a: { title: "First" }, b: { title: "Second", near: ["right of", "a"] }, c: { title: "Aside", near: ["below", "a"] } }, nodes: { x: { text: "X", frame: "a" }, y: { text: "Y", frame: "b" }, z: { text: "Z", frame: "c" } }, ...(present ? { present } : {}) });
  it("numbers the frames in `present`", () => {
    const L = layoutBoard(doc(["b", "a"]));
    expect([L.frames.b.n, L.frames.a.n, L.frames.c.n]).toEqual([1, 2, undefined]);
  });
  it("doesn't number a board with no order, or a single slide", () => {
    expect(layoutBoard(doc()).frames.a.n).toBeUndefined();
    expect(layoutBoard(doc(["a"])).frames.a.n).toBeUndefined();
  });
  it("leaves room for the number in front of a long title", () => {
    const wide = (present?: string[]) => layoutBoard({ ...doc(present), frames: { a: { title: "A title long enough to set the width of its frame all by itself" }, b: { title: "B" } } }).frames.a.w;
    expect(wide(["a", "b"])).toBeGreaterThan(wide());
  });
});

describe("loose notes read like an outline", () => {
  it("a heading followed by notes becomes a column, and columns sit side by side", () => {
    const L = layoutBoard(one({ h1: head("**Found**"), a: sticky("A"), b: sticky("B"), h2: head("**Assumed**"), c: sticky("C") })).nodes;
    expect(L.a.x).toBe(L.h1.x);
    expect(L.b.x).toBe(L.h1.x);
    expect(L.a.y).toBeGreaterThan(L.h1.y);
    expect(L.b.y).toBeGreaterThan(L.a.y + L.a.h - 1);
    expect(L.h2.y).toBe(L.h1.y);
    expect(L.h2.x).toBeGreaterThan(L.a.x + L.a.w);
    expect(L.c.x).toBe(L.h2.x);
  });

  it("big text starts a section across the frame, with its notes in a row under it", () => {
    const L = layoutBoard(one({ big: head("Three numbers would settle it:", { size: "l" }), a: sticky("A"), b: sticky("B"), next: head("A cheaper thing to try:", { size: "l" }), c: sticky("C") })).nodes;
    expect(L.a.y).toBeGreaterThan(L.big.y);
    expect(L.b.y).toBe(L.a.y);
    expect(L.b.x).toBeGreaterThan(L.a.x);
    expect(L.next.x).toBe(L.big.x);
    expect(L.next.y).toBeGreaterThan(L.a.y + L.a.h);
    expect(L.c.y).toBeGreaterThan(L.next.y);
  });

  it("text on its own runs wide instead of wrapping into a narrow column", () => {
    const L = layoutBoard(one({ p: head("Late on its own gets a shrug, and three other things do not.") })).nodes;
    expect(L.p.lines.length).toBe(1);
  });

  it("stickies with no headings still line up in a grid, in order", () => {
    const L = layoutBoard(one(Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`s${i}`, sticky(`S${i}`)])))).nodes;
    expect(L.s1.x).toBeGreaterThan(L.s0.x);
    expect(L.s1.y).toBe(L.s0.y);
    expect(L.s3.y).toBeGreaterThan(L.s0.y);
  });

  it("nothing overlaps, with a flow above, columns below and a lead on top", () => {
    const doc: FlowchartFile = { title: "t", frames: { f: { title: "Mixed", lead: "A flow, and what we make of it." } }, nodes: { s1: { text: "Start", frame: "f" }, s2: { text: "End", frame: "f" }, h1: head("**Found**"), a: sticky("A"), b: sticky("B"), h2: head("**Open**"), c: sticky("C", { color: "pink" }), n: sticky("About the end", { near: "s2", frame: undefined }) }, links: [{ from: "s1", to: "s2" }] };
    const L = layoutBoard(doc).nodes;
    const ids = Object.keys(L);
    for (const p of ids) for (const q of ids) if (p < q) expect(overlap(L[p], L[q]), `${p} over ${q}`).toBe(false);
    expect(L.h1.y).toBeGreaterThan(L.s1.y + L.s1.h);
  });

  it("the designer's pins and sizes still win", () => {
    const doc = { ...one({ h1: head("**Found**"), a: sticky("A") }), layout: { a: { x: 500, y: 300 }, h1: { w: 320 } } } as FlowchartFile;
    const L = layoutBoard(doc);
    expect(L.nodes.a.x - L.frames.f.ox).toBe(500);
    expect(L.nodes.h1.w).toBe(320);
  });
});

describe("drawing", () => {
  it("ties a note to the step it's about with a dotted line, and not a stamp", () => {
    const doc: FlowchartFile = { title: "t", nodes: { a: { text: "A step" }, b: { text: "Another" }, n: { type: "sticky", text: "About A", near: "a" }, s: { type: "stamp", icon: "star", near: "b" } }, links: [{ from: "a", to: "b" }] };
    expect(boardSVG(doc).match(/stroke-dasharray="1 6"/g)?.length).toBe(1);
    expect(boardSVG({ title: "t", nodes: { a: { text: "A" } } })).not.toContain('stroke-dasharray="1 6"');
  });

  it("numbers frames on the canvas", () => {
    const doc: FlowchartFile = { title: "t", frames: { a: { title: "One" }, b: { title: "Two" } }, nodes: { x: { text: "X", frame: "a" }, y: { text: "Y", frame: "b" } }, present: ["a", "b"] };
    expect(boardSVG(doc)).toMatch(/<circle[^>]*r="14"/);
  });

  it("writes loose text from its left edge", () => {
    const svg = boardSVG(one({ p: head("First line of a note that is long enough to wrap onto a second line for sure, yes it is.", {}), a: sticky("A") }));
    expect(svg).toMatch(/text-anchor="start"[^>]*font-family="Patrick Hand"/);
  });
});

describe("critique", () => {
  const pile: FlowchartFile = {
    title: "Do late fees fix the right problem?",
    frames: { ask: { title: "The ask" }, flow: { title: "The ask, as a flow" }, ev: { title: "What the research says" }, q: { title: "Questions for the PM" } },
    nodes: { a: { type: "sticky", text: "Charge a fee", frame: "ask" }, s1: { text: "Borrows", frame: "flow" }, s2: { text: "Returns", frame: "flow" }, ...Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`e${i}`, { type: "sticky", text: `Evidence ${i}`, frame: "ev", color: ["yellow", "gray", "pink"][i % 3] } as FNode])), q1: { type: "sticky", text: "How many?", color: "pink", frame: "q" } },
    links: [{ from: "s1", to: "s2" }],
    present: ["ask", "flow", "ev", "q"],
  };
  const messages = (d: FlowchartFile) => critique(d).map((n) => `${n.where}: ${n.message}`).join("\n");

  it("spots a board that asks a question and never answers it", () => {
    expect(messages(pile)).toMatch(/frames\.ask: The board asks a question and never answers it/);
  });
  it("spots topic titles with no point, and piles of equal-weight stickies", () => {
    const m = messages(pile);
    expect(m).toMatch(/"What the research says" names a topic/);
    expect(m).toMatch(/7 stickies of equal weight in a pile/);
    expect(m).toMatch(/"Questions for the PM" names a topic/);
  });
  it("every note comes with a fix", () => {
    for (const n of critique(pile)) expect(n.fix.length).toBeGreaterThan(20);
    expect(formatCritique(critique(pile), "x.flowchart.json")).toContain("→");
  });

  const argument: FlowchartFile = {
    title: "Late fees",
    frames: {
      answer: { title: "Do late fees fix the right problem?", lead: "Probably not. Lenders shrug at late; what stops them lending is damage." },
      ev: { title: "Lateness isn't what stops people lending", lead: "Late on its own gets a shrug. Two other things don't." },
      next: { title: "Before building anything", lead: "Two answers would settle it." },
    },
    nodes: { c: { type: "sticky", text: "A fee turns a favor into a bill", frame: "answer" }, h1: { type: "text", text: "**Damage**", frame: "ev" }, e1: { type: "sticky", text: "Owners stop lending over damage", frame: "ev" }, h2: { type: "text", text: "**Nobody borrows**", frame: "ev" }, e2: { type: "sticky", text: "Apps died because nobody borrowed", frame: "ev" }, q1: { type: "sticky", text: "How many loans came back late?", color: "pink", frame: "next" } },
    present: ["answer", "ev", "next"],
  };
  it("is happy with an argument: answer first, a point per frame, an order, an ending", () => {
    expect(critique(argument)).toEqual([]);
    expect(formatCritique([], "x.flowchart.json")).toMatch(/reads on its own/);
  });
  it("asks for a reading order, and for every frame to be in it", () => {
    expect(messages({ ...argument, present: undefined })).toMatch(/no reading order/);
    expect(messages({ ...argument, present: ["answer", "ev"] })).toMatch(/"Before building anything" isn't in the reading order/);
  });
  it("flags a topic title even when the frame has a lead, a paragraph of a lead, and an essay on a sticky", () => {
    expect(messages({ ...argument, frames: { ...argument.frames, ev: { title: "Research", lead: "Late gets a shrug." } } })).toMatch(/"Research" names a topic, not a point/);
    expect(messages({ ...argument, frames: { ...argument.frames, ev: { title: argument.frames!.ev.title, lead: "word ".repeat(60) } } })).toMatch(/paragraph, not a point/);
    expect(messages({ ...argument, nodes: { ...argument.nodes, e1: { type: "sticky", text: "long ".repeat(40), frame: "ev" } } })).toMatch(/nodes\.e1: A sticky this long/);
  });
  it("leaves small boards and brainstorm walls mostly alone", () => {
    expect(critique({ title: "t", nodes: { a: { text: "A" }, b: { text: "B" } } })).toEqual([]);
    expect(critique({ title: "t", frames: { f: { title: "Ideas" } }, nodes: { a: { type: "sticky", text: "A", frame: "f" } } })).toEqual([]);
  });
});

describe("copying a style between different kinds of things", () => {
  it("a chart's accent doesn't become a sticky's paper (and the other way round)", async () => {
    const M = await import("../src/editor/model");
    const doc: FlowchartFile = { title: "t", nodes: { c: { type: "chart", data: [["A", 1]], color: "red" }, s: { type: "sticky", text: "S", color: "pink" }, s2: { type: "sticky", text: "S2" }, b: { text: "Box" } } };
    const fromChart = M.styleOf(doc, "node:c")!, fromSticky = M.styleOf(doc, "node:s")!;
    expect(M.styleFits(doc, fromChart, "node:s", "color")).toBe(false);
    expect(M.styleFits(doc, fromSticky, "node:c", "color")).toBe(false);
    expect(M.styleFits(doc, fromSticky, "node:b", "color")).toBe(false);
    expect(M.styleFits(doc, fromSticky, "node:s2", "color")).toBe(true);
    expect(M.styleFits(doc, fromChart, "node:s", "size")).toBe(true);
  });
});

describe("rows of frames", () => {
  // three frames in a row of different heights, then a second row started below the first frame
  const tall = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`t${i}`, { type: "sticky", text: `T${i}`, frame: "b" } as FNode]));
  const board = (extra: Record<string, unknown> = {}): FlowchartFile => ({
    title: "t",
    frames: { a: { title: "One" }, b: { title: "Two", near: ["right of", "a"] }, c: { title: "Three", near: ["right of", "b"] }, d: { title: "Four", near: ["below", "a"] }, e: { title: "Five", near: ["right of", "d"] }, ...extra },
    nodes: { x: { text: "X", frame: "a" }, ...tall(9), y: { text: "Y", frame: "c" }, z: { text: "Z", frame: "d" }, w: { text: "W", frame: "e" } },
    present: ["a", "b", "c", "d", "e"],
  });
  it("a frame below another starts under the whole row, so the next one beside it has room", () => {
    const F = layoutBoard(board()).frames;
    const rowBottom = Math.max(F.a.y + F.a.h, F.b.y + F.b.h, F.c.y + F.c.h);
    expect(F.b.h).toBeGreaterThan(F.a.h);
    expect(F.d.y).toBeGreaterThanOrEqual(rowBottom);
    expect(F.d.x).toBe(F.a.x);
    expect(F.e.y).toBe(F.d.y);
    expect(F.e.x).toBe(F.d.x + F.d.w + 120);
  });
  it("critique asks for rows when the frames make one long strip, and is happy once they're wrapped", () => {
    const strip: FlowchartFile = { ...board(), frames: Object.fromEntries(["a", "b", "c", "d", "e"].map((f, i, all) => [f, { title: `A point number ${i + 1} worth making`, lead: "And why it matters, said plainly.", ...(i ? { near: ["right of", all[i - 1]] } : {}) }])) as FlowchartFile["frames"] };
    expect(critique(strip).map((n) => n.message).join()).toMatch(/one long strip/);
    const wrapped = { ...strip, frames: { ...strip.frames, d: { ...strip.frames!.d, near: ["below", "a"] } } } as FlowchartFile;
    expect(critique(wrapped).map((n) => n.message).join()).not.toMatch(/one long strip/);
  });
  it("leaves a board the designer has arranged alone", () => {
    const strip: FlowchartFile = { ...board(), frames: Object.fromEntries(["a", "b", "c", "d", "e"].map((f, i, all) => [f, { title: `A point number ${i + 1} worth making`, lead: "Said plainly.", ...(i ? { near: ["right of", all[i - 1]] } : {}) }])) as FlowchartFile["frames"], canvas: { a: [0, 0] } };
    expect(critique(strip).map((n) => n.message).join()).not.toMatch(/one long strip/);
  });
});

describe("link cards to files", () => {
  it("name the file, not the scheme", () => {
    expect(hostOf("file:///Users/me/research/brief.html")).toBe("brief.html");
    expect(hostOf("./tickets/PAY-218.md")).toBe("PAY-218.md");
    expect(hostOf("https://example.atlassian.net/browse/ORDER-412")).toBe("example.atlassian.net");
    expect(hostOf("www.figma.com/proto/abc")).toBe("figma.com");
  });
});

