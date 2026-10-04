import { AnyColor } from "../../vendor/sketch/color";
import { markerHex } from "../../vendor/sketch/tokens";
import { useEffect, useRef, useState } from "react";
import { plainText, RichHTML } from "../../vendor/sketch/rich";
import type { MarkupStroke } from "../../vendor/sketch/shapes";
import { MARKER } from "../../vendor/sketch/tokens";
import { COLORS } from "../../vendor/sketch/tools";
import { slides, type BoardLayout, type Box } from "../layout";
import { BoardArt } from "../render/board";
import type { Cards, FlowchartFile } from "../types";
import { useQuietControls } from "../../vendor/sketch/quiet";

type MarkTool = "pen" | "eraser" | null;
const M = 28;

/**
 * Frames are slides, in your order. The slide is all that's on screen: the controls are a small bar that shows
 * when you move the mouse and steps aside when you stop. A big pointer for the room, a sharpie for the crit,
 * notes for you; Esc leaves.
 */
export function Play({ doc, L, cards, cardHref, start, onExit, onMarkup }: { doc: FlowchartFile; L: BoardLayout; cards: Cards; cardHref: (id: string) => string; start?: string; onExit: (frame: string) => void; onMarkup: (frame: string, strokes: MarkupStroke[]) => void }) {
  const deck = slides(doc, L);
  const [i, setI] = useState(() => Math.max(0, deck.findIndex((s) => s.id === start)));
  const [strip, setStrip] = useState(false);
  const [notes, setNotes] = useState(false);
  const [tool, setTool] = useState<MarkTool>(null);
  const [color, setColor] = useState("red");
  const [picking, setPicking] = useState(false);
  const [live, setLive] = useState<[number, number][] | null>(null);
  // what's being shown is all that's on screen: the controls show when the mouse moves and step aside when it stops
  const { awake, tip: hint, onPointerMove: onQuietMove } = useQuietControls(".play-bar");
  const erased = useRef<Set<number> | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const s = deck[Math.min(i, deck.length - 1)];
  const f = s.id ? L.frames[s.id] : undefined;
  const origin = f ? [f.ox, f.oy] : [0, 0];
  const vb: Box = { x: s.box.x - M, y: s.box.y - M, w: s.box.w + M * 2, h: s.box.h + M * 2 };
  const k = Math.min(2, (size.h - 16) / vb.h, (size.w - 16) / vb.w);
  const marks = doc.markup?.[s.id] ?? [];
  const fade = (doc.transition ?? "fade") === "fade";

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    if (stage.current) ro.observe(stage.current);
    return () => ro.disconnect();
  }, [strip, notes]);

  const go = (n: number) => setI(Math.max(0, Math.min(deck.length - 1, n)));
  const anyMarkup = Object.values(doc.markup ?? {}).some((m) => m?.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input,textarea")) return;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") { if (tool) setTool(null); else onExit(s.id); }
      else if (["arrowright", "arrowdown", "pagedown", " ", "enter"].includes(key)) { e.preventDefault(); go(i + 1); }
      else if (["arrowleft", "arrowup", "pageup", "backspace"].includes(key)) { e.preventDefault(); go(i - 1); }
      else if (key === "home") go(0);
      else if (key === "end") go(deck.length - 1);
      else if (key === "d") setTool((t) => (t === "pen" ? null : "pen"));
      else if (key === "e") setTool((t) => (t === "eraser" ? null : "eraser"));
      else if (key === "s") setStrip((v) => !v);
      else if (key === "n") setNotes((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /** Pointer → this slide's markup coordinates (frame coordinates, so marks move with the frame). */
  const at = (e: { clientX: number; clientY: number; currentTarget: Element }): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.round(vb.x + (e.clientX - r.left) / k - origin[0]), Math.round(vb.y + (e.clientY - r.top) / k - origin[1])];
  };
  const near = (x: number, y: number) => marks.map((m, j) => (m.points.some(([px, py]) => Math.hypot(px - x, py - y) < 14) ? j : -1)).filter((j) => j >= 0);
  const shown = live ? [...marks, { points: live, color }] : marks;
  const docShown = { ...doc, markup: { ...(doc.markup ?? {}), [s.id]: shown } };

  return (
    <div className={`play${tool ? ` marking ${tool}` : ""}`} onPointerMove={onQuietMove}>
      <div className={`play-bar${awake || tool || picking ? "" : " asleep"}`}>
        <button className="nav" disabled={!i} onClick={() => go(i - 1)} title="Previous (←)" aria-label="Back">←</button>
        <span className="play-count">{i + 1} / {deck.length}</span>
        <button className="nav" disabled={i >= deck.length - 1} onClick={() => go(i + 1)} title="Next (→ or Space)" aria-label="Next">→</button>
        <span className="sep" />
        <div className="play-tools" role="group" aria-label="Markup">
          <button className={tool === "pen" ? "on" : ""} aria-pressed={tool === "pen"} onClick={() => setTool(tool === "pen" ? null : "pen")} title="Sharpie: draw over the slide (D)">Sharpie</button>
          {/* the sharpie's own tools only while you're drawing */}
          {tool ? <>
          <span className="pen-color">
            <button className="pen-dot" style={{ background: markerHex(color) }} onClick={() => setPicking(!picking)} aria-expanded={picking} aria-label={`Sharpie color: ${color}`} title="Sharpie color" />
            {picking ? <span className="pen-pop">{COLORS.map((c) => <button key={c} className={`pen-dot${c === color ? " on" : ""}`} style={{ background: MARKER[c] }} aria-label={c} title={c} onClick={() => { setColor(c); setTool("pen"); setPicking(false); }} />)}<AnyColor value={color} onPick={(h) => { setColor(h); setTool("pen"); }} title="Any sharpie color" /></span> : null}
          </span>
          <button className={tool === "eraser" ? "on" : ""} aria-pressed={tool === "eraser"} onClick={() => setTool(tool === "eraser" ? null : "eraser")} title="Eraser: click or drag over strokes (E)">Eraser</button>
          {marks.length ? <button onClick={() => onMarkup(s.id, [])} title="Remove all markup from this slide">Clear slide</button> : null}
          {anyMarkup ? <button onClick={() => { if (window.confirm("Clear the markup on every slide?")) for (const [id, m] of Object.entries(doc.markup ?? {})) if (m?.length) onMarkup(id, []); }} title="Remove markup from every slide">Clear all</button> : null}
          </> : null}
        </div>
        <span className="sep" />
        <button onClick={() => setNotes(!notes)} aria-pressed={notes} title="Speaker notes (N)">Notes</button>
        <button onClick={() => setStrip(!strip)} aria-pressed={strip} title="Every slide (S)">Slides</button>
        <button onClick={() => onExit(s.id)} title="Leave Play (Esc)">Exit</button>
      </div>
      <div className="play-body">
        <div className="play-stage" ref={stage}>
          <div key={fade ? i : "cut"} className={`play-slide${fade ? " fade" : ""}`} style={{ width: vb.w * k, height: vb.h * k }}
            onPointerDown={(e) => {
              if (!tool) return;
              (e.currentTarget as Element).setPointerCapture(e.pointerId);
              const [x, y] = at(e);
              if (tool === "pen") setLive([[x, y]]);
              else { erased.current = new Set(near(x, y)); if (erased.current.size) onMarkup(s.id, marks.filter((_, j) => !erased.current!.has(j))); }
            }}
            onPointerMove={(e) => {
              if (tool === "pen" && live) { const [x, y] = at(e); const last = live[live.length - 1]; if (Math.hypot(x - last[0], y - last[1]) > 2) setLive([...live, [x, y]]); return; }
              if (tool === "eraser" && erased.current) { const hits = near(...at(e)); if (hits.length) onMarkup(s.id, marks.filter((_, j) => !hits.includes(j))); }
            }}
            onPointerUp={() => {
              if (tool === "pen" && live) { if (live.length > 1) onMarkup(s.id, [...marks, { points: live, ...(color !== "red" ? { color } : {}) }]); setLive(null); }
              erased.current = null;
            }}
            onClick={(e) => {
              const link = (e.target as Element).closest("[data-url]") as SVGElement | null;
              if (link && !tool) { e.preventDefault(); window.open(link.dataset.url, "_blank", "noopener"); }
            }}>
            <svg width={vb.w * k} height={vb.h * k} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}>
              <defs><clipPath id="slide-clip"><rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} /></clipPath></defs>
              <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#fbfaf7" />
              <g clipPath="url(#slide-clip)"><BoardArt doc={docShown} L={L} o={{ cards, cardHref, uid: "play", markup: s.id, bare: true }} /></g>
            </svg>
          </div>
        </div>
        {notes ? <aside className="play-notes"><h4>Notes</h4><p><RichHTML src={(s.id ? doc.frames?.[s.id]?.notes : undefined) || "No notes for this slide. Add them in the frame's inspector."} /></p></aside> : null}
      </div>
      {strip ? (
        <div className="play-strip">
          {deck.map((d, j) => {
            const b = { x: d.box.x - M, y: d.box.y - M, w: d.box.w + M * 2, h: d.box.h + M * 2 };
            const h = 84, w = Math.max(60, Math.min(220, (b.w / b.h) * h));
            return (
              <button key={d.id || "board"} className={`thumb${j === i ? " on" : ""}`} onClick={() => go(j)} title={plainText(d.title)}>
                <svg width={w} height={h} viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`} preserveAspectRatio="xMidYMid slice"><rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#fbfaf7" /><BoardArt doc={doc} L={L} o={{ cards, cardHref, uid: `th${j}`, wobble: false, bare: true }} /></svg>
                <span>{j + 1}. <RichHTML src={d.title} /></span>
              </button>
            );
          })}
        </div>
      ) : null}
      {/* a hint for the first few seconds, and while a tool is on; otherwise nothing but the slide */}
      {tool || hint ? <div className="play-foot">{tool === "pen" ? "Draw on the slide. Marks are saved but only show here in Play. D to stop." : tool === "eraser" ? "Click or drag over a stroke to erase it. E to stop." : `→ or Space for the next slide, ← to go back. Move the mouse for the controls. Esc leaves.${deck.length === 1 && !s.id ? " No frames yet, so this is the whole board." : ""}`}</div> : null}
    </div>
  );
}
