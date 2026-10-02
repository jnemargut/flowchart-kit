import { useEffect, useMemo, useState } from "react";
import { layoutBoard } from "../layout";
import { BoardArt } from "../render/board";
import { Stamp } from "../render/stamps";
import type { FNode, StickyColor } from "../types";
import { STAMPS, STICKY, STICKY_COLORS } from "../vocab";
import { api, type Nearby } from "./api";

/** What a palette item adds: a node, or a new frame. */
export type Payload = { node: FNode } | { frame: true };
export const DRAG_TYPE = "application/x-flowchart";

const FLOW: { label: string; node: FNode }[] = [
  { label: "Start / end", node: { type: "pill", text: "Start" } },
  { label: "Step", node: { text: "A step" } },
  { label: "Decision", node: { type: "diamond", text: "Yes or no?" } },
  { label: "Text", node: { type: "text", text: "Words" } },
];

/** A real, tiny drawing of a node, filling its tile. */
function Preview({ node, w = 92, h = 50 }: { node: FNode; w?: number; h?: number }) {
  const { L, doc } = useMemo(() => {
    const d = { title: "", nodes: { n: node } };
    return { doc: d, L: layoutBoard(d) };
  }, [node]);
  const b = L.nodes.n;
  const pad = 6;
  return (
    <svg className="preview" viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} width={w} height={h} preserveAspectRatio="xMidYMid meet">
      <BoardArt doc={doc} L={L} o={{ wobble: false, uid: `pv-${node.type}-${node.color ?? ""}` }} />
    </svg>
  );
}

function Tile({ payload, label, onAdd, children, className = "tile" }: { payload: Payload; label: string; onAdd: (p: Payload) => void; children: React.ReactNode; className?: string }) {
  return (
    <button className={className} title={`${label}: click to add, or drag onto the canvas`} draggable
      onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload)); e.dataTransfer.effectAllowed = "copy"; }}
      onClick={() => onAdd(payload)}>
      {children}
      <span className="name">{label}</span>
    </button>
  );
}

export function Palette({ onAdd, bust, onUpload }: { onAdd: (p: Payload) => void; bust: number; onUpload: (f: File) => void }) {
  const [near, setNear] = useState<Nearby | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => { api.nearby().then(setNear).catch(() => setNear({ items: [], kits: { storyboard: false, wireframe: false } })); }, [bust]);

  return (
    <aside className="palette" onPointerDown={(e) => e.stopPropagation()}>
      <h4>Flow</h4>
      <div className="tiles">
        {FLOW.map((f) => <Tile key={f.label} payload={{ node: f.node }} label={f.label} onAdd={onAdd}><Preview node={f.node} /></Tile>)}
        <Tile payload={{ frame: true }} label="Frame" onAdd={onAdd}>
          <svg className="preview" viewBox="0 0 92 50" width={92} height={50}><rect x={6} y={6} width={80} height={38} rx={6} fill="#fbfaf7" stroke="#959ba2" strokeWidth={2} strokeDasharray="6 4" /><text x={13} y={21} fontFamily="Permanent Marker" fontSize={10} fill="#4d535a">Frame</text></svg>
        </Tile>
        <Tile payload={{ node: { type: "link", text: "A web page", url: "https://" } }} label="Link" onAdd={onAdd}><Preview node={{ type: "link", text: "A web page", url: "https://example.com" }} /></Tile>
        <label className="tile upload" title="Add a photo, a screenshot or a sketch. It's sketchified in grays to match (switch that off in the inspector). You can also drop or paste images onto the canvas.">
          <svg className="preview" viewBox="0 0 92 50" width={92} height={50}><rect x={18} y={7} width={56} height={36} fill="#fbfaf7" stroke="#1c1c1e" strokeWidth={2} /><path d="M22 39 L36 24 L46 33 L54 26 L70 39" fill="#d7dade" stroke="#1c1c1e" strokeWidth={1.6} strokeLinejoin="round" /><circle cx={58} cy={16} r={4} fill="#b9bec4" stroke="#1c1c1e" strokeWidth={1.4} /></svg>
          <span className="name">Image</span>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        </label>
      </div>
      <h4>Stickies</h4>
      <div className="tiles five">
        {STICKY_COLORS.map((c: StickyColor) => (
          <Tile key={c} payload={{ node: { type: "sticky", text: "", color: c } }} label={c} onAdd={onAdd} className="tile sticky-tile">
            <span className="sticky-chip" style={{ background: STICKY[c].fill }} title={STICKY[c].doc} />
          </Tile>
        ))}
      </div>
      <h4>Stamps</h4>
      <div className="stamp-grid">
        {Object.entries(STAMPS).map(([icon, doc]) => (
          <button key={icon} className="stamp-tile" title={`${icon}: ${doc}. Drop it on anything.`} draggable
            onDragStart={(e) => { e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ node: { type: "stamp", icon } })); e.dataTransfer.effectAllowed = "copy"; }}
            onClick={() => onAdd({ node: { type: "stamp", icon } })}>
            <svg viewBox="0 0 48 48" width={30} height={30}><Stamp icon={icon} x={0} y={0} s={46} /></svg>
          </button>
        ))}
      </div>
      <h4>Cards nearby</h4>
      {!near ? <p className="palette-hint">Looking…</p> : !near.items.length ? (
        <p className="palette-hint">No storyboards or wireframes in this folder yet. Make one with Storyboard Kit or Wireframe Kit and it shows up here.</p>
      ) : near.items.map((f) => (
        <div key={f.ref} className="near-file">
          <div className="near-row">
            <button className="near-open" onClick={() => setOpen({ ...open, [f.ref]: !open[f.ref] })} aria-expanded={!!open[f.ref]} title={open[f.ref] ? "Hide its parts" : `Show its ${f.kind === "storyboard" ? "panels" : "screens"}`}>{open[f.ref] ? "▾" : "▸"}</button>
            <Tile payload={{ node: { type: "card", ref: f.ref } }} label={f.title} onAdd={onAdd} className={`near-item ${f.kind}`}><i className={`kind ${f.kind}`} /></Tile>
          </div>
          {open[f.ref] ? (
            <div className="near-parts">
              {f.parts.map((pt) => <Tile key={pt.id} payload={{ node: { type: "card", ref: `${f.ref}#${pt.id}` } }} label={pt.title} onAdd={onAdd} className="near-item part"><span className="pid">#{pt.id}</span></Tile>)}
            </div>
          ) : null}
        </div>
      ))}
      {near && (!near.kits.storyboard || !near.kits.wireframe) && near.items.length ? <p className="palette-hint">{!near.kits.storyboard && near.items.some((i) => i.kind === "storyboard") ? "Storyboard Kit isn't installed, so storyboard cards show their last picture. " : ""}{!near.kits.wireframe && near.items.some((i) => i.kind === "wireframe") ? "Wireframe Kit isn't installed, so wireframe cards show their last picture." : ""}</p> : null}
      <p className="palette-hint keys">Tab: next step · Enter: a sibling · S: sticky · drag a dot to connect · double-click empty space for a step · paste a link or an image</p>
    </aside>
  );
}
