/**
 * Where everything goes. Each frame's flow is laid out by dagre; stickies and text with `near` sit beside their
 * node; everything else in the frame lines up in a grid under the flow. Frames go where the file says
 * ("right of" another), in the nearest free spot. Then the designer's nudges, sizes and frame moves win.
 * Pure and synchronous: the CLI, the exports and the editor all get the same answer.
 */
import dagre from "@dagrejs/dagre";
import { shapeBox, type SketchShape } from "../vendor/sketch/shapes";
import { textWidth, wrap } from "./text";
import { frameOf, isNote, typeOf, type Cards, type FlowchartFile, type FNode, type NodeType, type Side } from "./types";

export interface Box { x: number; y: number; w: number; h: number }
export interface NodeBox extends Box { id: string; type: NodeType; frame: string; lines: string[]; size: number }
export interface FrameBox extends Box { id: string; title: string; /** where frame coordinates start (frame shapes and markup are relative to it) */ ox: number; oy: number; loose: boolean }
export interface Edge {
  i: number; from: string; to: string; d: string;
  start: [number, number]; startAngle: number; end: [number, number]; angle: number;
  label?: string; lx: number; ly: number; lw: number;
  style: "solid" | "dashed" | "dotted"; head: "end" | "start" | "both" | "none"; color?: string; weight?: string;
}
export interface BoardLayout { nodes: Record<string, NodeBox>; frames: Record<string, FrameBox>; edges: Edge[]; bounds: Box }

export const FONT = 18;
const PAD = 32;
export const TITLE_H = 56;
export const FRAME_GAP = 120;
const NOTE_GAP = 18;
const STEP = 40;
const LABEL_SIZE = 16;

const SIZE: Record<string, number> = { s: 14, m: 18, l: 24, xl: 32 };
const TEXT_SIZE: Record<string, number> = { s: 16, m: 20, l: 28, xl: 40 };

/** How big a node is and how its words wrap. */
export function measure(n: FNode, nudge: { w?: number; h?: number } = {}, card?: Cards[string]): { w: number; h: number; lines: string[]; size: number } {
  const t = typeOf(n);
  const text = n.text ?? "";
  const FONT = SIZE[n.size ?? "m"] ?? 18, LH = Math.round(FONT * 1.22), k = FONT / 18;
  const widest = (ls: string[], size = FONT) => Math.max(0, ...ls.map((l) => textWidth(l, "hand", size)));
  if (t === "stamp") {
    const s = nudge.w ?? 44;
    return { w: s, h: s, lines: [], size: FONT };
  }
  if (t === "link") {
    const w = nudge.w ?? Math.round(250 * Math.max(1, k));
    const lines = wrap(text || hostOf(n.url ?? ""), "hand", FONT, w - 56).slice(0, 3);
    return { w, h: nudge.h ?? Math.max(64, lines.length * LH + 44), lines, size: FONT };
  }
  if (t === "sticky") {
    const w = nudge.w ?? Math.round(176 * Math.max(1, k));
    const lines = wrap(text, "hand", FONT, w - 30);
    return { w, h: nudge.h ?? Math.max(Math.round(116 * Math.max(1, k)), lines.length * LH + 44), lines, size: FONT };
  }
  if (t === "text") {
    const size = TEXT_SIZE[n.size ?? "m"] ?? 20;
    const lines = wrap(text, "hand", size, nudge.w ? nudge.w - 8 : 300 * (size / 20));
    return { w: nudge.w ?? Math.max(30, widest(lines, size) + 10), h: nudge.h ?? Math.max(28, Math.round(lines.length * size * 1.25 + 6)), lines, size };
  }
  if (t === "card") {
    const label = card?.label ?? n.ref ?? "";
    const cr = Array.isArray(n.crop) && n.crop.length === 4 ? n.crop : [0, 0, 1, 1];
    const iw = card?.w ? card.w * Math.max(0.01, cr[2] - cr[0]) : undefined, ih = card?.h ? card.h * Math.max(0.01, cr[3] - cr[1]) : undefined;
    let w: number, imgH: number;
    if (iw && ih) {
      const tall = ih > iw;
      w = nudge.w ?? (card?.whole ? 440 : tall ? Math.round((300 * iw) / ih) : card?.kind === "image" ? 260 : 300);
      // the picture keeps its proportions, so the whole storyboard or screen always shows
      imgH = Math.round((w * ih) / iw);
    } else { w = nudge.w ?? 240; imgH = nudge.h ? Math.max(40, nudge.h - 30) : 150; }
    return { w, h: imgH + 30, lines: [label], size: 13 };
  }
  if (t === "diamond") {
    const lines = wrap(text, "hand", FONT, nudge.w ? nudge.w * 0.56 : 118);
    const tw = widest(lines);
    return { w: nudge.w ?? Math.max(Math.round(136 * k), Math.round(tw * 1.75 + 34)), h: nudge.h ?? Math.max(Math.round(88 * k), Math.round(lines.length * LH * 1.75 + 26)), lines, size: FONT };
  }
  const pad = t === "pill" ? 40 : 30;
  const lines = wrap(text, "hand", FONT, nudge.w ? nudge.w - pad : 176 * k);
  const tw = widest(lines);
  return { w: nudge.w ?? Math.max(Math.round((t === "pill" ? 124 : 116) * Math.min(1, k)), Math.min(240 * k, Math.round(tw + pad))), h: nudge.h ?? Math.max(Math.round((t === "pill" ? 46 : 54) * Math.min(1.4, k)), lines.length * LH + 24), lines, size: FONT };
}

/** "jira.example.com" from a URL, for labels. */
export function hostOf(url: string): string {
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(url.trim());
  return (m ? m[1] : url.trim().replace(/^www\./, "").split(/[/?#]/)[0]).replace(/^www\./, "");
}

const overlaps = (a: Box, b: Box, m = 0) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
export const union = (bs: Box[]): Box | undefined => {
  if (!bs.length) return undefined;
  const x0 = Math.min(...bs.map((b) => b.x)), y0 = Math.min(...bs.map((b) => b.y));
  const x1 = Math.max(...bs.map((b) => b.x + b.w)), y1 = Math.max(...bs.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
export const center = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];

/** A point on a node's outline in the direction of `p` from its center (diamonds and pills aren't rectangles). */
function clipTo(b: NodeBox, p: [number, number]): [number, number] {
  if (b.type !== "diamond") return p;
  const [cx, cy] = center(b);
  const t = 1 / (Math.abs(p[0] - cx) / (b.w / 2) + Math.abs(p[1] - cy) / (b.h / 2) || 1);
  return [cx + (p[0] - cx) * t, cy + (p[1] - cy) * t];
}

/** A curved arrow between two boxes, leaving and entering on the sides that face each other. */
export type SideName = "left" | "right" | "top" | "bottom";
const NORMAL: Record<SideName, [number, number]> = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
const sidePoint = (b: Box, s: SideName): [number, number] => s === "left" ? [b.x, b.y + b.h / 2] : s === "right" ? [b.x + b.w, b.y + b.h / 2] : s === "top" ? [b.x + b.w / 2, b.y] : [b.x + b.w / 2, b.y + b.h];

/**
 * A curved arrow between two boxes, leaving and entering on the sides that face each other. When a side is
 * already used by another arrow (a decision's "yes" goes right), that end picks the next best free side.
 */
export interface RouteOpts { fromSide?: SideName; toSide?: SideName; fromOff?: number; toOff?: number; shape?: "curved" | "angled" | "straight"; /** the flow's direction: leave and arrive along it when the target is ahead */ prefer?: "across" | "down" }
const portPoint = (b: NodeBox, s: SideName, off = 0): [number, number] => {
  const p = sidePoint(b, s);
  if (!off || b.type === "diamond") return p;
  return s === "left" || s === "right" ? [p[0], p[1] + off] : [p[0] + off, p[1]];
};
export function route(a: NodeBox, b: NodeBox, busyA: Set<SideName> = new Set(), busyB: Set<SideName> = new Set(), o: RouteOpts = {}): { d: string; start: [number, number]; startAngle: number; end: [number, number]; angle: number; mid: [number, number]; sides: [SideName, SideName] } {
  const [ax, ay] = center(a), [bx, by] = center(b);
  const dx = bx - ax, dy = by - ay;
  let horiz = Math.abs(dx) / (a.w / 2 + b.w / 2) >= Math.abs(dy) / (a.h / 2 + b.h / 2);
  if (o.prefer === "across" && b.x >= a.x + a.w + 12) horiz = true;
  if (o.prefer === "down" && b.y >= a.y + a.h + 12) horiz = false;
  const h: [SideName, SideName] = dx > 0 ? ["right", "left"] : ["left", "right"];
  const v: [SideName, SideName] = dy > 0 ? ["bottom", "top"] : ["top", "bottom"];
  const pick = (end: 0 | 1, busy: Set<SideName>): SideName => {
    const order = horiz ? [h[end], v[end]] : [v[end], h[end]];
    return order.find((s) => !busy.has(s)) ?? order[0];
  };
  const sa = o.fromSide ?? pick(0, busyA), sb = o.toSide ?? pick(1, busyB);
  const s = portPoint(a, sa, o.fromOff), e = portPoint(b, sb, o.toOff);
  const dist = Math.hypot(e[0] - s[0], e[1] - s[1]);
  const r = (v: number) => Math.round(v * 10) / 10;
  // close together: a straight line reads better than a squashed curve
  const facing = NORMAL[sa][0] * (e[0] - s[0]) + NORMAL[sa][1] * (e[1] - s[1]) > 0 && NORMAL[sb][0] * (s[0] - e[0]) + NORMAL[sb][1] * (s[1] - e[1]) > 0;
  if (o.shape === "angled") return elbow(s, e, sa, sb);
  if (o.shape === "straight" || (dist < 90 && facing)) {
    const ang = Math.atan2(e[1] - s[1], e[0] - s[0]);
    return { d: `M${r(s[0])} ${r(s[1])} L${r(e[0])} ${r(e[1])}`, start: s, startAngle: ang + Math.PI, end: e, angle: ang, mid: [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2], sides: [sa, sb] };
  }
  const c = Math.min(Math.max(30, dist * 0.4), 160);
  const c1: [number, number] = [s[0] + NORMAL[sa][0] * c, s[1] + NORMAL[sa][1] * c];
  const c2: [number, number] = [e[0] + NORMAL[sb][0] * c, e[1] + NORMAL[sb][1] * c];
  const mid: [number, number] = [0.125 * s[0] + 0.375 * c1[0] + 0.375 * c2[0] + 0.125 * e[0], 0.125 * s[1] + 0.375 * c1[1] + 0.375 * c2[1] + 0.125 * e[1]];
  return { d: `M${r(s[0])} ${r(s[1])} C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(e[0])} ${r(e[1])}`, start: s, startAngle: Math.atan2(s[1] - c1[1], s[0] - c1[0]), end: e, angle: Math.atan2(e[1] - c2[1], e[0] - c2[0]), mid, sides: [sa, sb] };
}

/** Right-angle connector: out from each side a little, then across, with softly rounded corners. */
function elbow(s: [number, number], e: [number, number], sa: SideName, sb: SideName) {
  const g = 22;
  const s1: [number, number] = [s[0] + NORMAL[sa][0] * g, s[1] + NORMAL[sa][1] * g];
  const e1: [number, number] = [e[0] + NORMAL[sb][0] * g, e[1] + NORMAL[sb][1] * g];
  const hs = sa === "left" || sa === "right", he = sb === "left" || sb === "right";
  let mids: [number, number][];
  if (hs && he) { const mx = (s1[0] + e1[0]) / 2; mids = [[mx, s1[1]], [mx, e1[1]]]; }
  else if (!hs && !he) { const my = (s1[1] + e1[1]) / 2; mids = [[s1[0], my], [e1[0], my]]; }
  else if (hs) mids = [[e1[0], s1[1]]];
  else mids = [[s1[0], e1[1]]];
  const pts = [s, s1, ...mids, e1, e].filter((p, i, a) => !i || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.5);
  const r = (v: number) => Math.round(v * 10) / 10;
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [p0, p1, p2] = [pts[i - 1], pts[i], pts[i + 1]];
    const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const rad = Math.min(10, l1 / 2, l2 / 2);
    const a: [number, number] = [p1[0] + ((p0[0] - p1[0]) / (l1 || 1)) * rad, p1[1] + ((p0[1] - p1[1]) / (l1 || 1)) * rad];
    const b: [number, number] = [p1[0] + ((p2[0] - p1[0]) / (l2 || 1)) * rad, p1[1] + ((p2[1] - p1[1]) / (l2 || 1)) * rad];
    d += ` L${r(a[0])} ${r(a[1])} Q${r(p1[0])} ${r(p1[1])} ${r(b[0])} ${r(b[1])}`;
  }
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  d += ` L${r(last[0])} ${r(last[1])}`;
  // label on the middle of the longest run
  let best = 0, mid: [number, number] = [(s[0] + e[0]) / 2, (s[1] + e[1]) / 2];
  for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (L > best) { best = L; mid = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2]; } }
  return { d, start: s, startAngle: Math.atan2(s[1] - pts[1][1], s[0] - pts[1][0]), end: e, angle: Math.atan2(last[1] - prev[1], last[0] - prev[0]), mid, sides: [sa, sb] as [SideName, SideName] };
}

/** A polyline from dagre, rounded through its midpoints. */
function smoothPath(pts: [number, number][]): string {
  const r = (v: number) => Math.round(v * 10) / 10;
  if (pts.length < 3) return `M${pts.map((p) => `${r(p[0])} ${r(p[1])}`).join(" L")}`;
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += i === pts.length - 2 ? ` Q${r(pts[i][0])} ${r(pts[i][1])} ${r(pts[i + 1][0])} ${r(pts[i + 1][1])}` : ` Q${r(pts[i][0])} ${r(pts[i][1])} ${r(mx)} ${r(my)}`;
  }
  return d;
}

interface Local { boxes: Record<string, NodeBox>; edges: Edge[]; content: Box | undefined }

/** One frame's contents in its own coordinates (0,0 = the frame's top-left before any growing). */
function layoutFrame(doc: FlowchartFile, fid: string, ids: string[], cards: Cards): Local {
  const loose = fid === "";
  const top = loose ? 0 : TITLE_H, left = loose ? 0 : PAD;
  const nodes = doc.nodes;
  const set = new Set(ids);
  const attached = ids.filter((id) => isNote(nodes[id]) && nodes[id].near && set.has(nodes[id].near!) && nodes[id].near !== id);
  const att = new Set(attached);
  const links = (doc.links ?? []).map((l, i) => ({ ...l, i, shape: l.shape ?? doc.connectors })).filter((l) => set.has(l.from) && set.has(l.to) && l.from !== l.to && !att.has(l.from) && !att.has(l.to));
  const flowIds = ids.filter((id) => !att.has(id) && links.some((l) => l.from === id || l.to === id));
  const flowSet = new Set(flowIds);
  const rest = ids.filter((id) => !att.has(id) && !flowSet.has(id));
  const sizes: Record<string, ReturnType<typeof measure>> = {};
  for (const id of ids) sizes[id] = measure(nodes[id], doc.layout?.[id], cards[id]);

  const boxes: Record<string, NodeBox> = {};
  const put = (id: string, x: number, y: number) => { const s = sizes[id]; boxes[id] = { id, type: typeOf(nodes[id]), frame: fid, x, y, w: s.w, h: s.h, lines: s.lines, size: s.size }; };
  const dagreEdges: Record<number, [number, number][]> = {};
  const labelAt: Record<number, [number, number]> = {};
  let flowBottom = top;

  if (flowIds.length) {
    const g = new dagre.graphlib.Graph({ multigraph: true });
    const down = doc.frames?.[fid]?.dir === "down";
    g.setGraph({ rankdir: down ? "TB" : "LR", nodesep: down ? 50 : 40, ranksep: down ? 64 : 84, edgesep: 24, marginx: 0, marginy: 0 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const id of flowIds) g.setNode(id, { width: sizes[id].w, height: sizes[id].h });
    for (const l of links) g.setEdge(l.from, l.to, l.label ? { width: textWidth(l.label, "hand", LABEL_SIZE) + 14, height: 24, labelpos: "c" } : {}, `e${l.i}`);
    dagre.layout(g);
    for (const id of flowIds) { const n = g.node(id); put(id, Math.round(n.x - n.width / 2 + left), Math.round(n.y - n.height / 2 + top)); }
    for (const l of links) {
      const e = g.edge({ v: l.from, w: l.to, name: `e${l.i}` }) as { points?: { x: number; y: number }[]; x?: number; y?: number };
      if (e?.points) dagreEdges[l.i] = e.points.map((p) => [p.x + left, p.y + top]);
      if (e && typeof e.x === "number" && typeof e.y === "number") labelAt[l.i] = [e.x + left, e.y + top];
    }
    flowBottom = Math.max(...flowIds.map((id) => boxes[id].y + boxes[id].h));
  }

  // everything else in the frame: a tidy grid under the flow
  if (rest.length) {
    const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(rest.length))));
    let y = flowIds.length ? flowBottom + 56 : top, x = left, rowH = 0;
    rest.forEach((id, i) => {
      if (i && i % cols === 0) { y += rowH + 28; x = left; rowH = 0; }
      put(id, x, y);
      x += sizes[id].w + 28;
      rowH = Math.max(rowH, sizes[id].h);
    });
  }

  // pinned nodes stay exactly where they were put; anything new lands next to what it's linked to
  const nudged = new Set<string>();
  const isPinned = (id: string) => typeof doc.layout?.[id]?.x === "number" && typeof doc.layout?.[id]?.y === "number";
  const pinned = Object.keys(boxes).filter(isPinned);
  if (pinned.length) {
    const auto = Object.fromEntries(Object.entries(boxes).map(([k, b]) => [k, { x: b.x, y: b.y }]));
    for (const id of pinned) { boxes[id].x = doc.layout![id].x!; boxes[id].y = doc.layout![id].y!; nudged.add(id); }
    const shiftOf = (id: string): [number, number] => [boxes[id].x - auto[id].x, boxes[id].y - auto[id].y];
    const avg: [number, number] = [pinned.reduce((s, id) => s + shiftOf(id)[0], 0) / pinned.length, pinned.reduce((s, id) => s + shiftOf(id)[1], 0) / pinned.length];
    const placed = new Set(pinned);
    const down = doc.frames?.[fid]?.dir === "down";
    for (const id of [...flowIds, ...rest]) {
      if (placed.has(id) || !boxes[id]) continue;
      const nb = links.find((l) => l.to === id && placed.has(l.from))?.from ?? links.find((l) => l.from === id && placed.has(l.to))?.to;
      const [sx, sy] = nb ? shiftOf(nb) : avg;
      const b = boxes[id];
      b.x = Math.round(auto[id].x + sx); b.y = Math.round(auto[id].y + sy);
      // clear of everything already placed, moving along the flow
      for (let k = 0; k < 200 && [...placed].some((o) => overlaps(b, boxes[o], 16)); k++) { if (down) b.y += 24; else b.x += 24; }
      placed.add(id);
      nudged.add(id);
    }
  }
  for (const id of Object.keys(boxes)) {
    const nd = doc.layout?.[id];
    if (isPinned(id)) continue;
    if (nd?.dx || nd?.dy) { boxes[id].x += nd.dx ?? 0; boxes[id].y += nd.dy ?? 0; nudged.add(id); }
  }

  // arrows and their labels are in the way too
  const obstacles: Box[] = [];
  for (const [i, pts] of Object.entries(dagreEdges)) {
    for (let k = 0; k < pts.length - 1; k++) for (let t = 0; t <= 1; t += 0.25) obstacles.push({ x: pts[k][0] + (pts[k + 1][0] - pts[k][0]) * t - 4, y: pts[k][1] + (pts[k + 1][1] - pts[k][1]) * t - 4, w: 8, h: 8 });
    const lab = labelAt[Number(i)], l = links.find((x) => x.i === Number(i));
    if (lab && l?.label) { const lw = textWidth(l.label, "hand", LABEL_SIZE) + 14; obstacles.push({ x: lab[0] - lw / 2, y: lab[1] - 13, w: lw, h: 26 }); }
  }
  // notes beside their node: above, then below, right, left; whichever is free first
  for (const id of attached) {
    const t = boxes[nodes[id].near!];
    if (!t) { put(id, left, flowBottom + 40); continue; }
    const s = sizes[id];
    if (nodes[id].type === "stamp") {
      // on top of its node, centered on `at` (fractions of the node), default the top-right corner
      const at = Array.isArray(nodes[id].at) ? nodes[id].at! : [1, 0];
      put(id, Math.round(t.x + at[0] * t.w - s.w / 2), Math.round(t.y + at[1] * t.h - s.h / 2));
      const nd = doc.layout?.[id];
      if (nd?.dx || nd?.dy) { boxes[id].x += nd.dx ?? 0; boxes[id].y += nd.dy ?? 0; }
      continue;
    }
    const others = () => [...Object.values(boxes).filter((b) => b.id !== id), ...obstacles];
    const cands: [number, number][] = [
      [t.x + t.w - s.w * 0.35, t.y - s.h - NOTE_GAP],
      [t.x + t.w - s.w * 0.35, t.y + t.h + NOTE_GAP],
      [t.x + t.w + NOTE_GAP, t.y + (t.h - s.h) / 2],
      [t.x - s.w - NOTE_GAP, t.y + (t.h - s.h) / 2],
    ];
    let spot = cands.find(([x, y]) => !others().some((b) => overlaps({ x, y, w: s.w, h: s.h }, b, 6)));
    if (!spot) { let y = t.y - s.h - NOTE_GAP; while (others().some((b) => overlaps({ x: cands[0][0], y, w: s.w, h: s.h }, b, 6))) y -= 24; spot = [cands[0][0], y]; }
    put(id, Math.round(spot[0]), Math.round(spot[1]));
    const nd = doc.layout?.[id];
    if (nd?.dx || nd?.dy) { boxes[id].x += nd.dx ?? 0; boxes[id].y += nd.dy ?? 0; }
  }

  const edges: Edge[] = [];
  for (const l of links) {
    const a = boxes[l.from], b = boxes[l.to];
    if (!a || !b) continue;
    edges.push(edgeFor(l.i, l, a, b, !nudged.has(l.from) && !nudged.has(l.to) ? dagreEdges[l.i] : undefined, labelAt[l.i], undefined, { prefer: doc.frames?.[fid]?.dir === "down" ? "down" : "across" }));
  }
  const shapeBoxes = (doc.frames?.[fid]?.shapes ?? []).filter((s) => s.points?.length).map(shapeBounds);
  return { boxes, edges, content: union([...Object.values(boxes), ...edges.filter((e) => e.label).map(labelBox), ...shapeBoxes]) };
}

/** Which sides of a box an edge's ends touch. */
function sidesUsed(b: NodeBox, edges: Edge[]): Set<SideName> {
  const out = new Set<SideName>();
  const near = (p: [number, number]) => {
    const [cx, cy] = center(b);
    const nx = (p[0] - cx) / (b.w / 2), ny = (p[1] - cy) / (b.h / 2);
    if (Math.abs(nx) > 1.25 || Math.abs(ny) > 1.25) return;
    out.add(Math.abs(nx) >= Math.abs(ny) ? (nx > 0 ? "right" : "left") : ny > 0 ? "bottom" : "top");
  };
  for (const e of edges) {
    const pts = (e.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    if (pts.length < 4) continue;
    if (e.from === b.id) near([pts[0], pts[1]]);
    if (e.to === b.id) near(e.end);
  }
  return out;
}

export const labelBox = (e: Edge): Box => ({ x: e.lx - e.lw / 2, y: e.ly - 13, w: e.lw, h: 26 });

/** A drawing's extent, text included. */
export function shapeBounds(s: SketchShape): Box {
  const b = shapeBox(s);
  if (s.type !== "text") return b;
  const lines = (s.text ?? "").split("\n");
  const w = Math.max(24, ...lines.map((l) => l.length * 16 * 0.45)) + 8, h = lines.length * 19.2 + 6;
  return { x: b.x - w / 2, y: b.y - h / 2, w, h };
}

type LinkLike = { from: string; to: string; label?: string; style?: string; head?: string; color?: string; weight?: string; fromSide?: SideName; toSide?: SideName; shape?: "curved" | "angled" | "straight" };
const looks = (l: LinkLike) => ({ style: (l.style === "dashed" || l.style === "dotted" ? l.style : "solid") as Edge["style"], head: (["start", "both", "none"].includes(l.head ?? "") ? l.head : "end") as Edge["head"], color: l.color, weight: l.weight });

function edgeFor(i: number, l: LinkLike, a: NodeBox, b: NodeBox, pts?: [number, number][], lab?: [number, number], busy?: [Set<SideName>, Set<SideName>], o: RouteOpts = {}): Edge {
  const lw = l.label ? textWidth(l.label, "hand", LABEL_SIZE) + 14 : 0;
  const forced = l.fromSide || l.toSide || o.fromSide || o.toSide || o.fromOff || o.toOff || (l.shape && l.shape !== "curved");
  // dagre's path only for arrows that detour around other boxes; short hops leave from the middle of a side
  if (pts && pts.length > 3 && !forced) {
    const p = [...pts];
    p[0] = clipTo(a, p[0]);
    p[p.length - 1] = clipTo(b, p[p.length - 1]);
    const e = p[p.length - 1], q = p[p.length - 2];
    const mid = lab ?? p[Math.floor(p.length / 2)];
    return { i, from: l.from, to: l.to, d: smoothPath(p), start: p[0], startAngle: Math.atan2(p[0][1] - p[1][1], p[0][0] - p[1][0]), end: e, angle: Math.atan2(e[1] - q[1], e[0] - q[0]), label: l.label, lx: mid[0], ly: mid[1], lw, ...looks(l) };
  }
  const r = route(a, b, busy?.[0], busy?.[1], { fromSide: l.fromSide, toSide: l.toSide, shape: l.shape, ...o });
  return { i, from: l.from, to: l.to, d: r.d, start: r.start, startAngle: r.startAngle, end: r.end, angle: r.angle, label: l.label, lx: r.mid[0], ly: r.mid[1], lw, ...looks(l) };
}

/** Which side of a box a point sits on. */
function sideAt(b: NodeBox, p: [number, number]): SideName {
  const [cx, cy] = center(b);
  const nx = (p[0] - cx) / (b.w / 2 || 1), ny = (p[1] - cy) / (b.h / 2 || 1);
  return Math.abs(nx) >= Math.abs(ny) ? (nx > 0 ? "right" : "left") : ny > 0 ? "bottom" : "top";
}

/**
 * When several arrows leave or arrive on the same side of a box, fan their ends out along that side (in the order
 * of where their other ends are), so they don't pile up into one blob of arrowheads.
 */
function fanOut(doc: FlowchartFile, nodes: Record<string, NodeBox>, edges: Edge[]): Edge[] {
  const ends: Record<string, { e: number; which: "from" | "to"; side: SideName; other: [number, number] }[]> = {};
  edges.forEach((e, k) => {
    const a = nodes[e.from], b = nodes[e.to];
    if (!a || !b) return;
    const sa = sideAt(a, e.start), sb = sideAt(b, e.end);
    (ends[`${e.from}|${sa}`] ??= []).push({ e: k, which: "from", side: sa, other: center(b) });
    (ends[`${e.to}|${sb}`] ??= []).push({ e: k, which: "to", side: sb, other: center(a) });
  });
  const opts: Record<number, RouteOpts> = {};
  for (const [key, list] of Object.entries(ends)) {
    if (list.length < 2) continue;
    const b = nodes[key.split("|")[0]];
    if (b.type === "diamond") continue;
    const along = (p: [number, number]) => (list[0].side === "left" || list[0].side === "right" ? p[1] : p[0]);
    const room = list[0].side === "left" || list[0].side === "right" ? b.h : b.w;
    const gap = Math.min(22, (room * 0.8) / list.length);
    [...list].sort((p, q) => along(p.other) - along(q.other)).forEach((x, j) => {
      const off = (j - (list.length - 1) / 2) * gap;
      const o = (opts[x.e] ??= {});
      if (x.which === "from") { o.fromSide = x.side; o.fromOff = off; } else { o.toSide = x.side; o.toOff = off; }
    });
  }
  return edges.map((e, k) => {
    if (!opts[k]) return e;
    const l = doc.links?.[e.i];
    const a = nodes[e.from], b = nodes[e.to];
    if (!l || !a || !b) return e;
    // keep both ends on the sides they were already using
    const o = { fromSide: sideAt(a, e.start), toSide: sideAt(b, e.end), ...opts[k] };
    return edgeFor(e.i, { ...l, shape: l.shape ?? doc.connectors } as LinkLike, a, b, undefined, undefined, undefined, o);
  });
}

const shift = (b: NodeBox, dx: number, dy: number): NodeBox => ({ ...b, x: b.x + dx, y: b.y + dy });
function shiftPath(d: string, dx: number, dy: number): string {
  let k = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (m) => String(Math.round((Number(m) + (k++ % 2 === 0 ? dx : dy)) * 10) / 10));
}

/** The frame a node lives in: its own, or for a sticky, text or stamp with `near`, its node's. */
export function homeFrame(doc: FlowchartFile, id: string): string {
  const n = doc.nodes[id];
  const t = n && isNote(n) && n.near && n.near !== id ? doc.nodes[n.near] : undefined;
  const f = frameOf(t && !(isNote(t) && t.near) ? t : n);
  return doc.frames?.[f] ? f : "";
}

/** The frames in the order they're listed, plus "" (the loose area) first when anything lives there. */
export function frameIds(doc: FlowchartFile): string[] {
  const looseUsed = Object.keys(doc.nodes ?? {}).some((id) => homeFrame(doc, id) === "");
  return [...(looseUsed ? [""] : []), ...Object.keys(doc.frames ?? {})];
}

/** Lay out the whole board. `cards` sizes the cards (from the CLI or dev server); without it they get a default size. */
export function layoutBoard(doc: FlowchartFile, cards: Cards = {}): BoardLayout {
  const fids = frameIds(doc);
  const members: Record<string, string[]> = Object.fromEntries(fids.map((f) => [f, []]));
  for (const [id, n] of Object.entries(doc.nodes ?? {})) {
    if (!n || typeof n !== "object") continue;
    const f = homeFrame(doc, id);
    members[f]?.push(id);
  }
  const locals: Record<string, Local> = {};
  const localBox: Record<string, Box> = {};
  for (const f of fids) {
    locals[f] = layoutFrame(doc, f, members[f], cards);
    const c = locals[f].content;
    if (f === "") { localBox[f] = c ?? { x: 0, y: 0, w: 0, h: 0 }; continue; }
    const size = doc.frames?.[f]?.size;
    const title = doc.frames?.[f]?.title ?? f;
    const minW = Math.max(size?.[0] ?? 0, textWidth(title, "title", 24) + PAD * 2, 240);
    const minH = Math.max(size?.[1] ?? 0, TITLE_H + 120);
    const x0 = Math.min(0, (c?.x ?? PAD) - PAD), y0 = Math.min(0, (c?.y ?? TITLE_H) - TITLE_H);
    const x1 = Math.max(minW, (c ? c.x + c.w : 0) + PAD), y1 = Math.max(minH, (c ? c.y + c.h : 0) + PAD);
    localBox[f] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // place frames: the designer's positions first, then relations, then left to right
  const origin: Record<string, [number, number]> = {};
  const placed: Record<string, Box> = {};
  const abs = (f: string, o: [number, number]): Box => ({ x: o[0] + localBox[f].x, y: o[1] + localBox[f].y, w: localBox[f].w, h: localBox[f].h });
  for (const f of fids) {
    const c = doc.canvas?.[f];
    if (Array.isArray(c) && c.length === 2 && c.every((v) => typeof v === "number")) { origin[f] = [c[0], c[1]]; placed[f] = abs(f, origin[f]); }
  }
  const visiting = new Set<string>();
  let lastPlaced: string | undefined;
  const place = (f: string) => {
    if (placed[f] || visiting.has(f)) return;
    visiting.add(f);
    const lb = localBox[f];
    const rel = doc.frames?.[f]?.near;
    let want: [number, number] | undefined; // desired top-left of the frame's box
    let side: Side = "right of";
    if (Array.isArray(rel) && rel.length === 2 && doc.frames?.[rel[1]] && rel[1] !== f) {
      place(rel[1]);
      const t = placed[rel[1]];
      if (t) {
        side = rel[0];
        if (side === "left of") want = [t.x - FRAME_GAP - lb.w, t.y];
        else if (side === "below") want = [t.x, t.y + t.h + FRAME_GAP];
        else if (side === "above") want = [t.x, t.y - FRAME_GAP - lb.h];
        else want = [t.x + t.w + FRAME_GAP, t.y];
      }
    }
    if (!want) {
      const others = Object.values(placed);
      want = others.length ? [Math.max(...others.map((b) => b.x + b.w)) + FRAME_GAP, lastPlaced && placed[lastPlaced] ? placed[lastPlaced].y : 0] : [0, 0];
    }
    const spot = freeSpot({ x: want[0], y: want[1], w: lb.w, h: lb.h }, Object.values(placed), side);
    origin[f] = [Math.round(spot.x - lb.x), Math.round(spot.y - lb.y)];
    placed[f] = abs(f, origin[f]);
    lastPlaced = f;
    visiting.delete(f);
  };
  for (const f of fids) place(f);

  // a frame that grew into its neighbor pushes the neighbor along (the way it's related, else to the right)
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (let j = 1; j < fids.length; j++) for (let i = 0; i < j; i++) {
      const A = placed[fids[i]], B = placed[fids[j]];
      if (!A || !B || !overlaps(A, B, FRAME_GAP / 2 - 1)) continue;
      const rel = doc.frames?.[fids[j]]?.near?.[0];
      let dx = 0, dy = 0;
      if (rel === "below") dy = A.y + A.h + FRAME_GAP - B.y;
      else if (rel === "above") dy = A.y - FRAME_GAP - (B.y + B.h);
      else if (rel === "left of") dx = A.x - FRAME_GAP - (B.x + B.w);
      else if (B.x >= A.x) dx = A.x + A.w + FRAME_GAP - B.x;
      else dy = A.y + A.h + FRAME_GAP - B.y;
      origin[fids[j]] = [origin[fids[j]][0] + dx, origin[fids[j]][1] + dy];
      placed[fids[j]] = abs(fids[j], origin[fids[j]]);
      moved = true;
    }
    if (!moved) break;
  }

  const nodes: Record<string, NodeBox> = {};
  const frames: Record<string, FrameBox> = {};
  const edges: Edge[] = [];
  for (const f of fids) {
    const [ox, oy] = origin[f];
    for (const b of Object.values(locals[f].boxes)) nodes[b.id] = shift(b, ox, oy);
    for (const e of locals[f].edges) edges.push({ ...e, d: shiftPath(e.d, ox, oy), start: [e.start[0] + ox, e.start[1] + oy], end: [e.end[0] + ox, e.end[1] + oy], lx: e.lx + ox, ly: e.ly + oy });
    frames[f] = { id: f, title: f === "" ? "" : doc.frames?.[f]?.title ?? f, ox, oy, loose: f === "", ...placed[f] };
  }
  // links between frames (or between a frame and the loose area)
  (doc.links ?? []).forEach((l, i) => {
    if (edges.some((e) => e.i === i)) return;
    const a = nodes[l?.from], b = nodes[l?.to];
    if (!a || !b || a === b || (a.frame === b.frame && isNote(doc.nodes[l.from]) && doc.nodes[l.from].near)) return;
    if (a.frame === b.frame && edges.some((e) => e.i === i)) return;
    edges.push(edgeFor(i, { ...l, shape: l.shape ?? doc.connectors }, a, b, undefined, undefined, [sidesUsed(a, edges), sidesUsed(b, edges)]));
  });
  edges.sort((a, b) => a.i - b.i);
  const fanned = fanOut(doc, nodes, edges);
  edges.splice(0, edges.length, ...fanned);

  const boardShapes = (doc.shapes ?? []).filter((s) => s.points?.length).map(shapeBounds);
  const all = [...Object.values(frames).filter((f) => !f.loose || f.w), ...Object.values(nodes), ...boardShapes];
  return { nodes, frames, edges, bounds: union(all) ?? { x: 0, y: 0, w: 400, h: 300 } };
}

/** The nearest spot for `b` that doesn't overlap `taken`, searching outward on a grid (away from the relation first). */
export function freeSpot(b: Box, taken: Box[], side: Side = "right of"): Box {
  const clear = (x: number, y: number) => !taken.some((t) => overlaps({ x, y, w: b.w, h: b.h }, t, FRAME_GAP / 2 - 1));
  if (clear(b.x, b.y)) return b;
  const away: [number, number] = side === "left of" ? [-1, 0] : side === "below" ? [0, 1] : side === "above" ? [0, -1] : [1, 0];
  for (let r = 1; r < 200; r++) {
    const cands: [number, number, number][] = [];
    for (let i = -r; i <= r; i++) for (const [dx, dy] of [[i, -r], [i, r], [-r, i], [r, i]] as [number, number][]) {
      // prefer moving along the relation (further away), then sideways, never back toward the anchor frame
      const back = dx * away[0] + dy * away[1] < 0;
      cands.push([dx, dy, Math.hypot(dx, dy) + (back ? 1000 : 0)]);
    }
    cands.sort((p, q) => p[2] - q[2]);
    for (const [dx, dy] of cands) if (clear(b.x + dx * STEP, b.y + dy * STEP)) return { ...b, x: b.x + dx * STEP, y: b.y + dy * STEP };
  }
  return b;
}

/** The topmost frame under a point (not the loose area). */
export function frameAt(L: BoardLayout, x: number, y: number): string {
  const hit = Object.values(L.frames).filter((f) => !f.loose && x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
  return hit.length ? hit[hit.length - 1].id : "";
}

/** Slides for Play and the deck: frames in presenting order, or the whole board when there are none. */
export function slides(doc: FlowchartFile, L: BoardLayout): { id: string; title: string; box: Box }[] {
  const ids = Object.keys(doc.frames ?? {});
  if (!ids.length) return [{ id: "", title: doc.title, box: L.bounds }];
  const order = (doc.present?.length ? doc.present : ids).filter((id) => L.frames[id]);
  return order.map((id) => ({ id, title: L.frames[id].title, box: L.frames[id] }));
}
