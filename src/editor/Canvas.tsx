import { useEffect, useRef, useState, type PointerEvent as RPE } from "react";
import type { DrawTool } from "../../vendor/sketch/tools";
import { useWheelView, type View } from "../../vendor/sketch/view";
import { shapeBounds, type Box, type BoardLayout } from "../layout";
import { BoardArt } from "../render/board";
import type { Cards, FlowchartFile, Side4 } from "../types";
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
  /** Pull arrow `i` by its middle to [dx, dy] (undefined straightens it): live while dragging, then commit. */
  onBend: (i: number, bend: [number, number] | undefined, commit: boolean) => void;
  onDraw: (kind: DrawTool, points: [number, number][], commit: boolean) => void;
  onTextTool: (x: number, y: number) => void;
  /** Dragged from a node's dot: to another node (onto one of its dots to pick the sides), or (to = null) to empty canvas at (x, y). */
  onConnect: (from: string, to: string | null, x: number, y: number, sides?: { from: Side4; to: Side4 }) => void;
  onDouble: (key: Key, x: number, y: number) => void;
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

/** Where a node's four connector dots sit. */
export function dotSpots(b: Box, off: number): { side: Side4; x: number; y: number }[] {
  return [
    { side: "left", x: b.x - off, y: b.y + b.h / 2 },
    { side: "right", x: b.x + b.w + off, y: b.y + b.h / 2 },
    { side: "top", x: b.x + b.w / 2, y: b.y - off },
    { side: "bottom", x: b.x + b.w / 2, y: b.y + b.h + off },
  ];
}

/** The topmost node under a point: stamps first, then cards and steps, then stickies and the rest. */
export function nodeAt(L: BoardLayout, x: number, y: number, skip?: string, pad = 0): string | undefined {
  const all = Object.values(L.nodes).filter((n) => n.id !== skip && inside(n, x, y, pad));
  return (all.find((n) => n.type === "stamp") ?? all[all.length - 1])?.id;
}

export function Canvas(p: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [space, setSpace] = useState(false);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [wire, setWire] = useState<{ from: string; side: Side4; x: number; y: number; to?: string; toSide?: Side4 } | null>(null);
  const drag = useRef<{ kind: "pan" | "move" | "resize" | "draw" | "marquee" | "connect" | "bend"; edge?: number; bend0?: [number, number]; sx: number; sy: number; vx: number; vy: number; wx: number; wy: number; moved: boolean; key?: Key; handle?: Handle; from?: Box; points?: [number, number][]; node?: string; side?: Side4; click?: Key } | null>(null);

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
    const bendOf = (target as HTMLElement).dataset?.bend;
    if (bendOf !== undefined) {
      const i = Number(bendOf), cur = p.doc.links?.[i]?.bend;
      return begin(e, { ...base, kind: "bend", edge: i, bend0: Array.isArray(cur) ? [cur[0], cur[1]] : [0, 0] });
    }
    const dot = (target as HTMLElement).dataset?.dot;
    if (dot) { const side = ((target as HTMLElement).dataset.side ?? "right") as Side4; setWire({ from: dot, side, x: w.x, y: w.y }); return begin(e, { ...base, kind: "connect", node: dot, side }); }
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
    else if (d.kind === "bend") p.onBend(d.edge!, [Math.round(d.bend0![0] + dx / k), Math.round(d.bend0![1] + dy / k)], false);
    else if (d.kind === "marquee") setMarquee({ x: Math.min(d.wx, w.x), y: Math.min(d.wy, w.y), w: Math.abs(w.x - d.wx), h: Math.abs(w.y - d.wy) });
    else if (d.kind === "connect") {
      // over a box: show its dots; right on a dot: snap to that side
      const to = nodeAt(p.L, w.x, w.y, d.node, 18 / p.view.k);
      const tb = to ? p.L.nodes[to] : undefined;
      let toSide: Side4 | undefined;
      if (tb && tb.type !== "stamp") {
        const near = dotSpots(tb, 16 / p.view.k).map((s) => ({ ...s, dist: Math.hypot(s.x - w.x, s.y - w.y) })).sort((a, b) => a.dist - b.dist)[0];
        if (near && near.dist < 18 / p.view.k) toSide = near.side;
      }
      setWire({ from: d.node!, side: d.side ?? "right", x: w.x, y: w.y, to: tb && tb.type !== "stamp" ? to : undefined, toSide });
    }
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
      const wv = wire;
      setWire(null);
      p.setDragging(false);
      if (!d.moved) return;
      const to = wv?.to ?? null;
      p.onConnect(d.node!, to, w.x, w.y, to && wv?.toSide ? { from: d.side ?? "right", to: wv.toSide } : undefined);
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
    else if (d.kind === "bend") p.onBend(d.edge!, [Math.round(d.bend0![0] + dx / k), Math.round(d.bend0![1] + dy / k)], true);
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
      onDoubleClick={(e) => {
        if (p.tool !== "select") return;
        const w = world(e);
        // the first click captured the pointer, so ask the page what's really under it
        const under = document.elementFromPoint(e.clientX, e.clientY) ?? (e.target as Element);
        // double-click an arrow's middle handle: straighten it
        const bendAt = (under as HTMLElement).dataset?.bend;
        if (bendAt !== undefined) { p.onBend(Number(bendAt), undefined, true); return; }
        const k = keyAt(under, w.x, w.y) ?? (() => { const n = nodeAt(p.L, w.x, w.y); return n ? `node:${n}` : null; })();
        if (k) p.onDouble(k, w.x, w.y);
      }}
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
          {wire ? (() => {
            const a = p.L.nodes[wire.from];
            if (!a) return null;
            const s = dotSpots(a, 0).find((d) => d.side === wire.side)!;
            const tb = wire.to ? p.L.nodes[wire.to] : undefined;
            const t = tb && wire.toSide ? dotSpots(tb, 0).find((d) => d.side === wire.toSide)! : tb ? { x: tb.x + tb.w / 2, y: tb.y + tb.h / 2 } : { x: wire.x, y: wire.y };
            return <path d={`M${s.x} ${s.y} L${t.x} ${t.y}`} stroke="#e8590c" strokeWidth={2.6 / k} strokeDasharray={`${6 / k} ${5 / k}`} fill="none" />;
          })() : null}
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
        {/* the selected arrow's middle: drag to pull it out of the way, double-click to straighten it */}
        {selEdge && p.sel.length === 1 && p.tool === "select" ? (() => {
          const e = p.L.edges.find((x) => x.i === Number(selEdge.slice(5)));
          if (!e) return null;
          const r = 7 / k;
          return <span className="bend-handle" data-bend={e.i} title="Drag to pull this arrow out of the way · double-click to straighten it"
            style={{ left: e.lx - r, top: e.ly - r, width: r * 2, height: r * 2, borderWidth: 2 / k }} />;
        })() : null}
        {dotNode && !ed && !wire ? dotSpots(dotNode, 16 / k).map(({ side, x, y }) => {
          const r = 6 / k;
          return <span key={side} className="dot-handle" data-dot={dotNode.id} data-side={side} title="Drag onto another box to connect (or into empty space for a new step)" style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, borderWidth: 2 / k }} />;
        }) : null}
        {wire?.to && p.L.nodes[wire.to] ? (() => {
          const tb = p.L.nodes[wire.to];
          return (
            <>
              <div className="target-box" style={{ left: tb.x - 4 / k, top: tb.y - 4 / k, width: tb.w + 8 / k, height: tb.h + 8 / k, borderWidth: 2.5 / k }} />
              {dotSpots(tb, 16 / k).map(({ side, x, y }) => { const r = (wire.toSide === side ? 8 : 6) / k; return <span key={side} className={`dot-handle target${wire.toSide === side ? " on" : ""}`} style={{ left: x - r, top: y - r, width: r * 2, height: r * 2, borderWidth: 2 / k }} />; })}
            </>
          );
        })() : null}
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
