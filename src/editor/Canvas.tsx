import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";
import type { DrawTool } from "../../vendor/sketch/tools";
import { useWheelView, type View } from "../../vendor/sketch/view";
import { shapeBounds, type Box, type BoardLayout } from "../layout";
import { BoardArt } from "../render/board";
import type { Cards, FlowchartFile } from "../types";
import type { Key } from "./model";

export type { View };
type Handle = "nw" | "ne" | "se" | "sw" | "e" | "s";

export interface InlineEdit { key: Key; value: string; box: Box; size: number; face: "title" | "hand"; multiline: boolean; align: "center" | "left" }
export type EditEnd = "enter" | "tab" | "blur" | "escape";

interface Props {
  doc: FlowchartFile;
  L: BoardLayout;
  cards: Cards;
  cardHref: (id: string) => string;
  view: View;
  setView: (v: View | ((v: View) => View)) => void;
  sel: Key[];
  onSelect: (keys: Key[]) => void;
  tool: DrawTool;
  /** Move everything selected by (dx, dy) canvas px: live while dragging, then commit. */
  onMoveSel: (dx: number, dy: number, commit: boolean) => void;
  onResize: (key: Key, from: Box, to: Box, commit: boolean) => void;
  onDraw: (kind: DrawTool, points: [number, number][], commit: boolean) => void;
  onTextTool: (x: number, y: number) => void;
  /** Dragged from a node's dot: to another node, or (to = null) to empty canvas at (x, y). */
  onConnect: (from: string, to: string | null, x: number, y: number) => void;
  onDouble: (key: Key | null, x: number, y: number) => void;
  onDrop: (payload: string, x: number, y: number) => void;
  onDropFile: (file: File, x: number, y: number) => void;
  onPointer: (x: number, y: number) => void;
  editing: InlineEdit | null;
  onEditDone: (value: string | null, how: EditEnd) => void;
  dragging: boolean;
  setDragging: (d: boolean) => void;
}

const inside = (b: Box, x: number, y: number, pad = 0) => x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad;
const hits = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Where a selection key sits on the canvas. */
export function boxOf(doc: FlowchartFile, L: BoardLayout, key: Key): Box | undefined {
  const [kind, id, i] = key.split(":");
  if (kind === "node") return L.nodes[id];
  if (kind === "frame") return L.frames[id];
  if (kind === "edge") { const e = L.edges.find((x) => x.i === Number(id)); return e ? { x: e.lx - Math.max(30, e.lw / 2), y: e.ly - 14, w: Math.max(60, e.lw), h: 28 } : undefined; }
  if (kind === "shape") {
    const s = id ? doc.frames?.[id]?.shapes?.[Number(i)] : doc.shapes?.[Number(i)];
    if (!s?.points?.length) return undefined;
    const b = shapeBounds(s);
    const f = id ? L.frames[id] : undefined;
    return f ? { ...b, x: b.x + f.ox, y: b.y + f.oy } : b;
  }
  return undefined;
}

/** The topmost node under a point: stamps first, then cards and steps, then stickies and the rest. */
export function nodeAt(L: BoardLayout, x: number, y: number, skip?: string): string | undefined {
  const all = Object.values(L.nodes).filter((n) => n.id !== skip && inside(n, x, y));
  return (all.find((n) => n.type === "stamp") ?? all[all.length - 1])?.id;
}

export function Canvas(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [space, setSpace] = useState(false);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [wire, setWire] = useState<{ from: string; x: number; y: number } | null>(null);
  const drag = useRef<{ kind: "pan" | "move" | "resize" | "draw" | "marquee" | "connect"; sx: number; sy: number; vx: number; vy: number; wx: number; wy: number; moved: boolean; key?: Key; handle?: Handle; from?: Box; points?: [number, number][]; node?: string; click?: Key } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === "Space" && !(e.target as HTMLElement).closest("input,textarea,select")) { setSpace(true); e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { if (e.code === "Space") setSpace(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useWheelView(ref, p.setView);

  const world = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left - p.view.x) / p.view.k, y: (e.clientY - r.top - p.view.y) / p.view.k };
  };

  /** What's under the pointer, as a selection key. */
  const keyAt = (target: Element, x: number, y: number): Key | null => {
    const el = target.closest("[data-node],[data-edge],[data-shape],[data-frame-title]") as HTMLElement | SVGElement | null;
    if (el) {
      const d = (el as HTMLElement).dataset;
      if (d.node !== undefined) return `node:${d.node}`;
      if (d.edge !== undefined) return `edge:${d.edge}`;
      if (d.shape !== undefined) return `shape:${d.shape}`;
      if (d.frameTitle !== undefined) return `frame:${d.frameTitle}`;
    }
    // a frame's dashed border is a handle too
    const edge = 12 / p.view.k;
    const f = Object.values(p.L.frames).reverse().find((fb) => !fb.loose && inside(fb, x, y, edge) && !inside(fb, x, y, -edge));
    return f ? `frame:${f.id}` : null;
  };

  const begin = (e: RPE, d: NonNullable<typeof drag.current>) => {
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drag.current = d;
  };

  const onDown = (e: RPE) => {
    if (e.button !== 0 || p.editing) return;
    const target = e.target as Element;
    const w = world(e);
    const base = { sx: e.clientX, sy: e.clientY, vx: p.view.x, vy: p.view.y, wx: w.x, wy: w.y, moved: false };
    const handle = (target as HTMLElement).dataset?.handle as Handle | undefined;
    if (handle && p.sel.length === 1) {
      const from = boxOf(p.doc, p.L, p.sel[0]);
      if (from) return begin(e, { ...base, kind: "resize", key: p.sel[0], handle, from });
    }
    const dot = (target as HTMLElement).dataset?.dot;
    if (dot) { setWire({ from: dot, x: w.x, y: w.y }); return begin(e, { ...base, kind: "connect", node: dot }); }
    const link = target.closest("[data-url]") as SVGElement | null;
    if (link && p.tool === "select") { e.preventDefault(); return; }
    if (space) return begin(e, { ...base, kind: "pan" });
    if (p.tool === "text") { p.onTextTool(w.x, w.y); return; }
    if (p.tool !== "select") return begin(e, { ...base, kind: "draw", points: [[Math.round(w.x), Math.round(w.y)]] });
    const key = keyAt(target, w.x, w.y);
    if (!key) {
      if (e.shiftKey) { setMarquee({ x: w.x, y: w.y, w: 0, h: 0 }); return begin(e, { ...base, kind: "marquee" }); }
      p.onSelect([]);
      return begin(e, { ...base, kind: "pan" });
    }
    if (e.shiftKey) { p.onSelect(p.sel.includes(key) ? p.sel.filter((k) => k !== key) : [...p.sel, key]); return; }
    if (!p.sel.includes(key)) p.onSelect([key]);
    if (key.startsWith("edge:")) return;
    begin(e, { ...base, kind: "move", key, click: p.sel.includes(key) && p.sel.length > 1 ? key : undefined });
  };

  const resized = (d: NonNullable<typeof drag.current>, dx: number, dy: number): Box => {
    const f = d.from!, h = d.handle!;
    let { x, y, w, h: hh } = f;
    if (h.includes("e")) w = Math.max(24, f.w + dx);
    if (h.includes("s")) hh = Math.max(24, f.h + dy);
    if (h.includes("w")) { w = Math.max(24, f.w - dx); x = f.x + f.w - w; }
    if (h.includes("n")) { hh = Math.max(24, f.h - dy); y = f.y + f.h - hh; }
    return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(hh) };
  };

  const onMove = (e: RPE) => {
    const w = world(e);
    p.onPointer(w.x, w.y);
    const d = drag.current;
    if (!d) {
      if (p.tool === "select" && !space) {
        if ((e.target as HTMLElement).dataset?.dot) return; // on a node's dot: keep its dots showing
        const k = keyAt(e.target as Element, w.x, w.y);
        // just off a node, on the way to its dots: keep them
        if (!k && hover && p.L.nodes[hover] && inside(p.L.nodes[hover], w.x, w.y, 26 / p.view.k)) return;
        setHover(k?.startsWith("node:") ? k.slice(5) : null);
      }
      return;
    }
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 3) return;
    if (!d.moved) { d.moved = true; p.setDragging(true); }
    const k = p.view.k;
    if (d.kind === "pan") p.setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
    else if (d.kind === "move") p.onMoveSel(Math.round(dx / k), Math.round(dy / k), false);
    else if (d.kind === "resize") p.onResize(d.key!, d.from!, resized(d, dx / k, dy / k), false);
    else if (d.kind === "marquee") setMarquee({ x: Math.min(d.wx, w.x), y: Math.min(d.wy, w.y), w: Math.abs(w.x - d.wx), h: Math.abs(w.y - d.wy) });
    else if (d.kind === "connect") setWire({ from: d.node!, x: w.x, y: w.y });
    else if (d.kind === "draw") {
      const q: [number, number] = [Math.round(w.x), Math.round(w.y)];
      if (p.tool === "pen") { const last = d.points![d.points!.length - 1]; if (Math.hypot(q[0] - last[0], q[1] - last[1]) > 2) d.points!.push(q); }
      else d.points = [d.points![0], q];
      p.onDraw(p.tool, [...d.points!], false);
    }
  };

  const onUp = (e: RPE) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const w = world(e);
    if (d.kind === "connect") {
      setWire(null);
      p.setDragging(false);
      if (!d.moved) return;
      p.onConnect(d.node!, nodeAt(p.L, w.x, w.y, d.node) ?? null, w.x, w.y);
      return;
    }
    if (!d.moved) {
      if (d.kind === "draw") p.onDraw(p.tool, d.points!, true);
      if (d.kind === "move" && d.click) p.onSelect([d.click]);
      if (d.kind === "marquee") setMarquee(null);
      return;
    }
    p.setDragging(false);
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy, k = p.view.k;
    if (d.kind === "move") p.onMoveSel(Math.round(dx / k), Math.round(dy / k), true);
    else if (d.kind === "resize") p.onResize(d.key!, d.from!, resized(d, dx / k, dy / k), true);
    else if (d.kind === "draw") p.onDraw(p.tool, d.points!, true);
    else if (d.kind === "marquee" && marquee) {
      const keys = [
        ...Object.values(p.L.nodes).filter((n) => hits(n, marquee)).map((n) => `node:${n.id}`),
        ...(p.doc.shapes ?? []).map((_, i) => `shape::${i}`).filter((key) => { const b = boxOf(p.doc, p.L, key); return b && hits(b, marquee); }),
      ];
      p.onSelect(keys);
      setMarquee(null);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    const link = (e.target as Element).closest("[data-url]") as SVGElement | null;
    if (link && p.tool === "select") { e.preventDefault(); window.open(link.dataset.url, "_blank", "noopener"); }
  };

  const k = p.view.k;
  const bw = 2 / k;
  const single = p.sel.length === 1 ? p.sel[0] : undefined;
  const singleBox = single ? boxOf(p.doc, p.L, single) : undefined;
  const singleNode = single?.startsWith("node:") ? p.L.nodes[single.slice(5)] : undefined;
  const handles: Handle[] = !single || single.startsWith("edge:") ? [] : single.startsWith("frame:") ? ["se"] : single.startsWith("shape:") ? (boxOf(p.doc, p.L, single) && !isTextShape(p.doc, single) ? ["nw", "ne", "sw", "se"] : []) : ["nw", "ne", "sw", "se"];
  const dotsFor = !p.dragging && p.tool === "select" ? (hover && p.L.nodes[hover]?.type !== "stamp" ? hover : singleNode && singleNode.type !== "stamp" ? singleNode.id : null) : null;
  const dotNode = dotsFor ? p.L.nodes[dotsFor] : undefined;
  const hovBox = hover && !p.sel.includes(`node:${hover}`) ? p.L.nodes[hover] : undefined;
  const ed = p.editing;
  const selEdge = p.sel.find((s) => s.startsWith("edge:"));

  return (
    <div ref={ref} className={`canvas${space ? " panning" : ""}${p.tool !== "select" ? " drawing" : ""}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => setHover(null)} onClick={onClick}
      onDoubleClick={(e) => { if (p.tool !== "select") return; const w = world(e); p.onDouble(keyAt(e.target as Element, w.x, w.y), w.x, w.y); }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("application/x-flowchart") || e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
      onDrop={(e) => {
        e.preventDefault();
        const w = world(e);
        const payload = e.dataTransfer.getData("application/x-flowchart");
        if (payload) { p.onDrop(payload, Math.round(w.x), Math.round(w.y)); return; }
        const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
        if (f) p.onDropFile(f, Math.round(w.x), Math.round(w.y));
      }}
      style={{ backgroundPosition: `${p.view.x}px ${p.view.y}px`, backgroundSize: `${20 * k}px ${20 * k}px` }}>
      <div className="world" style={{ transform: `translate(${p.view.x}px, ${p.view.y}px) scale(${k})` }}>
        <svg className="board" width={1} height={1} overflow="visible">
          <BoardArt doc={p.doc} L={p.L} o={{ cards: p.cards, cardHref: p.cardHref, wobble: !p.dragging, uid: "ed", highlightEdge: selEdge ? Number(selEdge.slice(5)) : undefined, hide: ed?.key.startsWith("node:") && p.L.nodes[ed.key.slice(5)]?.type !== "card" ? new Set([ed.key.slice(5)]) : undefined }} />
          {wire ? (() => { const a = p.L.nodes[wire.from]; return a ? <path d={`M${a.x + a.w / 2} ${a.y + a.h / 2} L${wire.x} ${wire.y}`} stroke="#e8590c" strokeWidth={2.6 / k} strokeDasharray={`${6 / k} ${5 / k}`} fill="none" /> : null; })() : null}
        </svg>
        {hovBox && p.tool === "select" ? <div className="hover-box" style={{ left: hovBox.x, top: hovBox.y, width: hovBox.w, height: hovBox.h, borderWidth: bw }} /> : null}
        {p.sel.filter((s) => !s.startsWith("edge:")).map((s) => {
          const b = boxOf(p.doc, p.L, s);
          if (!b || (ed && ed.key === s)) return null;
          return (
            <div key={s} className={`sel-box${s.startsWith("frame:") ? " frame" : ""}`} style={{ left: b.x - 3 / k, top: b.y - 3 / k, width: b.w + 6 / k, height: b.h + 6 / k, borderWidth: bw * 1.25 }}>
              {s === single && singleBox ? handles.map((h) => <span key={h} className={`handle h-${h}`} data-handle={h} style={{ width: 11 / k, height: 11 / k, borderWidth: 2 / k }} />) : null}
            </div>
          );
        })}
        {dotNode && !ed ? (["left", "right", "top", "bottom"] as const).map((side) => {
          const r = 6 / k, off = 16 / k;
          const [x, y] = side === "left" ? [dotNode.x - off, dotNode.y + dotNode.h / 2] : side === "right" ? [dotNode.x + dotNode.w + off, dotNode.y + dotNode.h / 2] : side === "top" ? [dotNode.x + dotNode.w / 2, dotNode.y - off] : [dotNode.x + dotNode.w / 2, dotNode.y + dotNode.h + off];
          return <span key={side} className="dot-handle" data-dot={dotNode.id} title="Drag to connect (or to empty space for a new step)" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, borderWidth: 2 / k }} />;
        }) : null}
        {marquee ? <div className="marquee" style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, borderWidth: bw }} /> : null}
        {ed ? (
          <textarea className={`inline-edit${ed.align === "center" ? " center" : ""}`} autoFocus defaultValue={ed.value}
            style={{ left: ed.box.x - 4, top: ed.box.y - 4, width: Math.max(ed.box.w + 8, 90), minHeight: ed.box.h + 8, fontSize: ed.size, fontFamily: ed.face === "title" ? "Permanent Marker" : "Patrick Hand", borderWidth: 2 / k }}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              const v = (e.target as HTMLTextAreaElement).value;
              if (e.key === "Escape") p.onEditDone(null, "escape");
              else if (e.key === "Tab") { e.preventDefault(); p.onEditDone(v, "tab"); }
              else if (e.key === "Enter" && (!ed.multiline ? true : !e.shiftKey)) { e.preventDefault(); p.onEditDone(v, "enter"); }
            }}
            onBlur={(e) => p.onEditDone(e.target.value, "blur")}
            onFocus={(e) => e.target.select()} />
        ) : null}
      </div>
    </div>
  );
}

function isTextShape(doc: FlowchartFile, key: Key) {
  const [, f, i] = key.split(":");
  const s = f ? doc.frames?.[f]?.shapes?.[Number(i)] : doc.shapes?.[Number(i)];
  return s?.type === "text";
}
