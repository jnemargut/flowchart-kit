/** Pure edits on a board. Each returns a new document; the app saves it. */
import { layoutBoard, type BoardLayout } from "../layout";
import type { Cards, FlowchartFile, FNode } from "../types";

export type Path = (string | number)[];
/** Selection keys: "node:<id>", "frame:<id>", "edge:<index>", "shape:<frame id or empty>:<index>". */
export type Key = string;

export const clone = <T,>(v: T): T => structuredClone(v);

export function getAt(doc: unknown, path: Path): unknown {
  let cur = doc as Record<string | number, unknown> | undefined;
  for (const k of path) { if (cur == null) return undefined; cur = cur[k] as Record<string | number, unknown>; }
  return cur;
}

/** Set a value deep in the file; undefined removes it (and empties the editor-owned maps it leaves behind). */
export function setAt(doc: FlowchartFile, path: Path, value: unknown): FlowchartFile {
  const next = clone(doc) as unknown as Record<string | number, unknown>;
  let cur = next;
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i];
    if (cur[k] == null || typeof cur[k] !== "object") cur[k] = typeof path[i + 1] === "number" ? [] : {};
    cur = cur[k] as Record<string | number, unknown>;
  }
  const last = path[path.length - 1];
  if (value === undefined) { if (Array.isArray(cur) && typeof last === "number") cur.splice(last, 1); else delete cur[last]; }
  else cur[last] = value;
  return tidy(next as unknown as FlowchartFile);
}

/** Drop empty layout/canvas/markup/shapes so the file stays clean. */
export function tidy(d: FlowchartFile): FlowchartFile {
  if (d.layout) { for (const [k, v] of Object.entries(d.layout)) if (!v || !Object.keys(v).length) delete d.layout[k]; if (!Object.keys(d.layout).length) delete d.layout; }
  for (const k of ["canvas", "markup"] as const) if (d[k] && !Object.keys(d[k]!).length) delete d[k];
  if (d.markup) for (const [k, v] of Object.entries(d.markup)) if (!v?.length) delete d.markup[k];
  if (d.markup && !Object.keys(d.markup).length) delete d.markup;
  if (d.shapes && !d.shapes.length) delete d.shapes;
  if (d.links && !d.links.length) delete d.links;
  for (const f of Object.values(d.frames ?? {})) if (f.shapes && !f.shapes.length) delete f.shapes;
  return d;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);

/** A fresh id: from its words when it has some ("asks-the-barista"), else its type. */
export function newId(doc: FlowchartFile, n: FNode | string, taken: Record<string, unknown> = doc.nodes): string {
  const base = typeof n === "string" ? n : slug(n.text ?? "") || (n.type === "stamp" ? n.icon ?? "stamp" : n.type ?? "step");
  let id = base, i = 2;
  while (taken[id] !== undefined) id = `${base}-${i++}`;
  return id;
}

export function addNode(doc: FlowchartFile, n: FNode, id = newId(doc, n)): { doc: FlowchartFile; id: string } {
  return { doc: { ...clone(doc), nodes: { ...doc.nodes, [id]: n } }, id };
}

export function addLink(doc: FlowchartFile, from: string, to: string, extra: { label?: string; style?: "dashed" } = {}): FlowchartFile {
  if (from === to || (doc.links ?? []).some((l) => l.from === from && l.to === to)) return doc;
  return { ...clone(doc), links: [...(doc.links ?? []), { from, to, ...extra }] };
}

/** Remove nodes and everything that points at them (links, notes sitting beside them stay, unattached). */
export function removeNodes(doc: FlowchartFile, ids: string[]): FlowchartFile {
  const gone = new Set(ids);
  const d = clone(doc);
  for (const id of ids) { delete d.nodes[id]; if (d.layout) delete d.layout[id]; }
  d.links = (d.links ?? []).filter((l) => !gone.has(l.from) && !gone.has(l.to));
  for (const n of Object.values(d.nodes)) if (n.near && gone.has(n.near)) {
    // a stamp on something deleted goes with it; a sticky stays where its frame puts it
    delete n.near; delete n.at;
  }
  for (const [id, n] of Object.entries(d.nodes)) if (n.type === "stamp" && !n.near && ids.some((g) => doc.nodes[id]?.near === g)) { delete d.nodes[id]; if (d.layout) delete d.layout[id]; }
  return tidy(d);
}

/** Remove a frame and everything in it. */
export function removeFrame(doc: FlowchartFile, fid: string, L: BoardLayout): FlowchartFile {
  const inside = Object.values(L.nodes).filter((b) => b.frame === fid).map((b) => b.id);
  let d = removeNodes(doc, inside);
  d = clone(d);
  delete d.frames?.[fid];
  if (d.frames && !Object.keys(d.frames).length) delete d.frames;
  if (d.canvas) delete d.canvas[fid];
  if (d.markup) delete d.markup[fid];
  if (d.present) { d.present = d.present.filter((p) => p !== fid); if (!d.present.length) delete d.present; }
  for (const f of Object.values(d.frames ?? {})) if (f.near?.[1] === fid) delete f.near;
  return tidy(d);
}

/** Rename a frame and everything that refers to it. */
export function renameFrame(doc: FlowchartFile, from: string, to: string): FlowchartFile {
  if (!to || from === to || doc.frames?.[to]) return doc;
  const d = clone(doc);
  d.frames = Object.fromEntries(Object.entries(d.frames ?? {}).map(([k, v]) => [k === from ? to : k, v]));
  for (const n of Object.values(d.nodes)) if (n.frame === from) n.frame = to;
  for (const f of Object.values(d.frames)) if (f.near?.[1] === from) f.near = [f.near[0], to];
  for (const m of [d.canvas, d.markup] as (Record<string, unknown> | undefined)[]) if (m && from in m) { m[to] = m[from]; delete m[from]; }
  if (d.present) d.present = d.present.map((p) => (p === from ? to : p));
  return d;
}

/** Rename a node and everything that refers to it. */
export function renameNode(doc: FlowchartFile, from: string, to: string): FlowchartFile {
  if (!to || from === to || doc.nodes[to]) return doc;
  const d = clone(doc);
  d.nodes = Object.fromEntries(Object.entries(d.nodes).map(([k, v]) => [k === from ? to : k, v]));
  for (const n of Object.values(d.nodes)) if (n.near === from) n.near = to;
  for (const l of d.links ?? []) { if (l.from === from) l.from = to; if (l.to === from) l.to = to; }
  if (d.layout && from in d.layout) { d.layout[to] = d.layout[from]; delete d.layout[from]; }
  return d;
}

/** Put a node's top-left exactly at (x, y): clear its nudge, see where the layout puts it, nudge the difference. */
export function placeAt(doc: FlowchartFile, id: string, x: number, y: number, cards: Cards): FlowchartFile {
  const nd = { ...(doc.layout?.[id] ?? {}) };
  delete nd.dx; delete nd.dy;
  let d = setAt(doc, ["layout", id], Object.keys(nd).length ? nd : undefined);
  const b = layoutBoard(d, cards).nodes[id];
  if (!b) return d;
  const dx = Math.round(x - b.x), dy = Math.round(y - b.y);
  if (dx || dy) d = setAt(d, ["layout", id], { ...nd, ...(dx ? { dx } : {}), ...(dy ? { dy } : {}) });
  return d;
}

/** Nudge a node by (dx, dy) on top of whatever nudge it has. */
export function nudge(doc: FlowchartFile, id: string, dx: number, dy: number): FlowchartFile {
  const cur = doc.layout?.[id] ?? {};
  const nx = (cur.dx ?? 0) + dx, ny = (cur.dy ?? 0) + dy;
  const next = Object.fromEntries(Object.entries({ ...cur, dx: Math.round(nx) || undefined, dy: Math.round(ny) || undefined }).filter(([, v]) => v !== undefined));
  return setAt(doc, ["layout", id], Object.keys(next).length ? next : undefined);
}

/** Where the layout put each frame: freeze it into `canvas` (so moving one frame doesn't shuffle the others). */
export function freezeFrame(doc: FlowchartFile, L: BoardLayout, fid: string, dx = 0, dy = 0): FlowchartFile {
  const f = L.frames[fid];
  if (!f) return doc;
  return setAt(doc, ["canvas", fid], [Math.round(f.ox + dx), Math.round(f.oy + dy)]);
}

/** "In late-order.flowchart.json, frame "late", step "Asks the barista" (nodes.ask)": paste this to an agent. */
export function pointer(file: string, doc: FlowchartFile, L: BoardLayout, key: Key): string {
  const [kind, id, extra] = key.split(":");
  if (kind === "node") {
    const n = doc.nodes[id];
    const f = L.nodes[id]?.frame;
    return `In ${file}${f ? `, frame "${f}"` : ""}, ${n?.type ?? "box"} "${n?.text ?? n?.ref ?? n?.icon ?? id}" (nodes.${id}): `;
  }
  if (kind === "frame") return `In ${file}, frame "${doc.frames?.[id]?.title ?? id}" (frames.${id}): `;
  if (kind === "edge") { const l = doc.links?.[Number(id)]; return `In ${file}, the link from "${l?.from}" to "${l?.to}" (links[${id}]): `; }
  return `In ${file}, the drawing ${id ? `in frame "${id}" (frames.${id}.shapes[${extra}])` : `(shapes[${extra}])`}: `;
}
