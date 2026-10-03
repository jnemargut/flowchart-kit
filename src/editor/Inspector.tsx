import { AnyColor } from "../../vendor/sketch/color";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { plainText, RichHTML } from "../../vendor/sketch/rich";
import { COLORS } from "../../vendor/sketch/tools";
import type { Result } from "../../vendor/sketch/suggest";
import { MARKER } from "../../vendor/sketch/tokens";
import { hostOf, slides, type BoardLayout } from "../layout";
import { parseRef } from "../refs";
import { Stamp } from "../render/stamps";
import { typeOf, type Cards, type FlowchartFile, type FNode, type Side } from "../types";
import { CONNECTORS, FILL_NAMES, FILLS, HEADS, LINE_COLOR_NAMES, LINE_COLORS, LINK_STYLES, NODE_TYPES, SIDES, STAMPS, STICKY, STICKY_COLORS, TEXT_SIZE_LABEL, TEXT_SIZES, WEIGHTS } from "../vocab";
import type { Key, Path } from "./model";

export interface InspectorActions {
  set: (path: Path, value: unknown, coalesce?: string) => void;
  select: (keys: Key[]) => void;
  remove: () => void;
  duplicate: () => void;
  copyPointer: () => void;
  resetNudge: (id: string) => void;
  renameNode: (from: string, to: string) => void;
  renameFrame: (from: string, to: string) => void;
  wrapInFrame: () => void;
  openCard: (ref: string) => void;
  focus: (key: Key) => void;
  play: (frame?: string) => void;
  setPresent: (order: string[]) => void;
  reverseLink: (i: number) => void;
  chooseImage: (id: string) => void;
  /** Open the crop dialog for a card. */
  crop: (id: string) => void;
  /** What's drawn on top of what. */
  arrange: (to: "back" | "backward" | "forward" | "front") => void;
  /** Let the automatic layout arrange a frame (or with no frame, the whole board) again. */
  tidy: (frame?: string) => void;
}

const Field = ({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) => <label className={`field${wide ? " wide" : ""}`}><span>{label}</span>{children}</label>;

/** A text box that saves as you type (coalesced into one undo step). */
function Text({ value, onChange, area, placeholder, focusKey, mono }: { value: string; onChange: (v: string) => void; area?: boolean; placeholder?: string; focusKey?: number; mono?: boolean }) {
  const r = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  useEffect(() => { if (focusKey && r.current) { r.current.focus(); r.current.select(); } }, [focusKey]);
  return area
    ? <textarea ref={r} rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    : <input ref={r} type="text" className={mono ? "mono-in" : undefined} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

function Rename({ id, onRename, label }: { id: string; onRename: (to: string) => void; label: string }) {
  const [v, setV] = useState(id);
  useEffect(() => setV(id), [id]);
  return <Field label={label}><input type="text" className="mono-in" value={v} onChange={(e) => setV(e.target.value.replace(/[#\s]/g, "-"))} onBlur={() => v !== id && onRename(v)} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} /></Field>;
}

/** The row of actions under every selection: anything specific first, then duplicate, the agent pointer and delete. */
function Actions({ a, children, dup = true, pointer = true, del = "Delete", delTitle }: { a: InspectorActions; children?: ReactNode; dup?: boolean; pointer?: boolean; del?: string; delTitle?: string }) {
  return (
    <div className="actions">
      {children}
      {dup ? <button className="btn" onClick={a.duplicate}>Duplicate</button> : null}
      {pointer ? <button className="btn" onClick={a.copyPointer} title="Copies a pointer to this, to paste to your agent with what to change">Copy for agent</button> : null}
      <button className="btn danger" onClick={a.remove} title={delTitle}>{del}</button>
    </div>
  );
}

const KIT = { storyboard: "Storyboard Kit", wireframe: "Wireframe Kit", image: "your image viewer" } as const;

/** Layer order: what's drawn on top of what. */
function Layer({ a }: { a: InspectorActions }) {
  return (
    <Field label="Layer" wide>
      <span className="seg full">
        <button title="To back (⇧⌘[)" onClick={() => a.arrange("back")}>To back</button>
        <button title="Backward (⌘[)" onClick={() => a.arrange("backward")}>Backward</button>
        <button title="Forward (⌘])" onClick={() => a.arrange("forward")}>Forward</button>
        <button title="To front (⇧⌘])" onClick={() => a.arrange("front")}>To front</button>
      </span>
    </Field>
  );
}

/** A row of choices that fills the panel's width. */
function Seg<T extends string>({ value, options, labels, onChange, title }: { value: T; options: readonly T[]; labels?: Partial<Record<T, string>>; onChange: (v: T) => void; title?: string }) {
  return <span className="seg full" role="group" aria-label={title}>{options.map((o) => <button key={o} className={value === o ? "on" : ""} aria-pressed={value === o} onClick={() => onChange(o)}>{labels?.[o] ?? o}</button>)}</span>;
}
const WEIGHT_LABEL = { thin: "Thin", normal: "Normal", thick: "Thick" } as const;

/** Text size, fill, border color and weight for boxes, pills, decisions and text. */
function NodeLook({ n, P, a, t }: { n: FNode; P: (prop: string) => Path; a: InspectorActions; t: string }) {
  const boxy = t !== "text";
  return (
    <>
      <h4>Look</h4>
      <Field label="Text size" wide><Seg value={n.size ?? "m"} options={TEXT_SIZES} labels={TEXT_SIZE_LABEL} onChange={(v) => a.set(P("size"), v === "m" ? undefined : v)} /></Field>
      <Field label={boxy ? "Fill" : "Background"} wide>
        <span className="swatches wrap">
          <button className={!n.fill ? "on" : ""} title="Default" aria-label="Default fill" onClick={() => a.set(P("fill"), undefined)}><span className="dot square default" /></button>
          {FILL_NAMES.map((f) => <button key={f} className={n.fill === f ? "on" : ""} title={`${f}: ${FILLS[f].doc}`} aria-label={f} onClick={() => a.set(P("fill"), f)}><span className={`dot square${f === "none" ? " none" : ""}`} style={f === "none" ? undefined : { background: FILLS[f].fill }} /></button>)}
          <AnyColor square value={n.fill} onPick={(h) => a.set(P("fill"), h)} title="Any fill color" />
        </span>
      </Field>
      <Field label={boxy ? "Border" : "Text color"} wide>
        <span className="swatches wrap">
          <button className={!n.stroke ? "on" : ""} title="Default" aria-label="Default color" onClick={() => a.set(P("stroke"), undefined)}><span className="dot default" /></button>
          {LINE_COLOR_NAMES.filter((c) => boxy || c !== "none").map((c) => <button key={c} className={n.stroke === c ? "on" : ""} title={c === "none" ? "no border" : c} aria-label={c} onClick={() => a.set(P("stroke"), c)}><span className={`dot${c === "none" ? " none" : ""}`} style={c === "none" ? undefined : { background: LINE_COLORS[c] }} /></button>)}
          <AnyColor value={n.stroke} onPick={(h) => a.set(P("stroke"), h)} title="Any border color" />
        </span>
      </Field>
      {boxy ? <Field label="Border weight" wide><Seg value={n.weight ?? "normal"} options={WEIGHTS} labels={WEIGHT_LABEL} onChange={(v) => a.set(P("weight"), v === "normal" ? undefined : v)} /></Field> : null}
      {boxy ? <p className="hint">White with no border covers things up, like part of a picture.</p> : null}
    </>
  );
}

export function Inspector({ doc, L, cards, sel, result, a, focusText }: { doc: FlowchartFile; L: BoardLayout; cards: Cards; sel: Key[]; result?: Result; a: InspectorActions; focusText: number }) {
  if (sel.length > 1) {
    const nodes = sel.filter((s) => s.startsWith("node:"));
    return (
      <aside className="inspector">
        <h3>{sel.length} selected</h3>
        <p className="doc">Drag any of them to move them all. Shift+click adds or removes one.</p>
        <Actions a={a} pointer={false}>{nodes.length ? <button className="btn" onClick={a.wrapInFrame}>Put in a new frame</button> : null}</Actions>
      </aside>
    );
  }
  const key = sel[0];
  const [kind, id, extra] = key ? key.split(":") : [];
  const frameIds = Object.keys(doc.frames ?? {});

  if (kind === "node" && doc.nodes[id]) {
    const n = doc.nodes[id];
    const t = typeOf(n);
    const P = (prop: string): Path => ["nodes", id, prop];
    const card = cards[id];
    const outs = (doc.links ?? []).map((l, i) => ({ l, i })).filter(({ l }) => l.from === id);
    const ins = (doc.links ?? []).map((l, i) => ({ l, i })).filter(({ l }) => l.to === id);
    const isFlow = t === "box" || t === "pill" || t === "diamond";
    const nudged = !!(doc.layout?.[id]?.dx || doc.layout?.[id]?.dy || doc.layout?.[id]?.w || doc.layout?.[id]?.h);
    const cardKind = n.ref ? parseRef(n.ref).kind : undefined;
    return (
      <aside className="inspector">
        <h3>{NODE_TYPES[t].label}<small>{id}</small></h3>
        {t !== "stamp" && t !== "card" ? <Field label={t === "link" ? "Title" : "Words"} wide><Text area={t !== "link"} value={n.text ?? ""} focusKey={focusText} onChange={(v) => a.set(P("text"), v || undefined, `text:${id}`)} /></Field> : null}
        {isFlow ? (
          <Field label="Shape" wide>
            <Seg value={t as "pill" | "box" | "diamond"} options={["pill", "box", "diamond"] as const} labels={{ pill: "Start / end", box: "Step", diamond: "Decision" }} onChange={(s) => a.set(P("type"), s === "box" ? undefined : s)} />
          </Field>
        ) : null}
        {isFlow ? <label className="field inline"><span>The product shows up here (teal)</span><input type="checkbox" checked={!!n.product} onChange={(e) => a.set(P("product"), e.target.checked || undefined)} /></label> : null}
        {t === "sticky" ? (
          <Field label="Color">
            <span className="swatches">{STICKY_COLORS.map((c) => <button key={c} className={(n.color ?? "yellow") === c ? "on" : ""} title={`${c}: ${STICKY[c].doc}`} aria-label={c} onClick={() => a.set(P("color"), c === "yellow" ? undefined : c)}><span className="dot square" style={{ background: STICKY[c].fill }} /></button>)}<AnyColor square value={n.color} onPick={(h) => a.set(P("color"), h)} title="Any paper color" /></span>
          </Field>
        ) : null}
        {t === "stamp" ? (
          <div className="stamp-pick">{Object.keys(STAMPS).map((s) => <button key={s} className={n.icon === s ? "on" : ""} title={`${s}: ${STAMPS[s]}`} aria-label={s} onClick={() => a.set(P("icon"), s)}><svg viewBox="0 0 48 48" width={26} height={26}><Stamp icon={s} x={0} y={0} s={46} /></svg></button>)}</div>
        ) : null}
        {t === "card" ? (
          <>
            <Field label="Shows" wide><Text mono value={n.ref ?? ""} onChange={(v) => a.set(P("ref"), v, `ref:${id}`)} placeholder="./x.storyboard.json#panel" /></Field>
            {cardKind === "image" ? <label className="field inline"><span>Sketchify it (grays, to match)</span><input type="checkbox" checked={n.sketch !== false} onChange={(e) => a.set(P("sketch"), e.target.checked ? undefined : false)} /></label> : null}
            <p className={`card-state ${card?.state ?? ""}`}>{!card ? "" : card.state === "ok" ? "Up to date." : card.state === "stale" ? `Out of date: the file changed and ${KIT[card.kind]} isn't installed to redraw it.` : card.state === "missing" ? `Can't find ${card.problem ?? "it"}.` : card.state === "nokit" ? `Not drawn yet. Install ${KIT[card.kind]} to draw it.` : card.problem ?? "Unknown."}</p>
          </>
        ) : null}
        <Field label={t === "link" ? "Address" : "Web link"} wide><Text mono value={n.url ?? ""} onChange={(v) => a.set(P("url"), v || undefined, `url:${id}`)} placeholder={t === "link" ? "https://…" : "https://… (a ticket, a doc, a prototype)"} /></Field>
        {n.near && doc.nodes[n.near] ? (
          <p className="hint">{t === "stamp" ? "Stuck on" : "Beside"} <button className="linkish" onClick={() => a.select([`node:${n.near}`])}>{plainText(doc.nodes[n.near].text ?? doc.nodes[n.near].ref ?? n.near)}</button>. It moves with it. <button className="linkish" onClick={() => { a.set(P("near"), undefined); a.set(P("at"), undefined); }}>Unstick</button></p>
        ) : (
          <Field label="Frame">
            <select value={doc.frames?.[n.frame ?? ""] ? n.frame : ""} onChange={(e) => a.set(P("frame"), e.target.value || undefined)}>
              <option value="">(no frame)</option>
              {frameIds.map((f) => <option key={f} value={f}>{doc.frames![f].title ?? f}</option>)}
            </select>
          </Field>
        )}
        {isFlow || t === "text" ? <NodeLook n={n} P={P} a={a} t={t} /> : null}
        {outs.length || ins.length ? <h4>Arrows</h4> : null}
        {outs.map(({ l, i }) => (
          <div key={i} className="item-row">
            <span className="to">→ {plainText(doc.nodes[l.to]?.text ?? l.to)}</span>
            <input type="text" placeholder="label" value={l.label ?? ""} onChange={(e) => a.set(["links", i, "label"], e.target.value || undefined, `label:${i}`)} />
            <button className="x" title="Remove this arrow" aria-label="Remove this arrow" onClick={() => a.set(["links", i], undefined)}>×</button>
          </div>
        ))}
        {ins.map(({ l, i }) => <div key={`in${i}`} className="item-row"><span className="to muted">← {plainText(doc.nodes[l.from]?.text ?? l.from)}{l.label ? ` (${l.label})` : ""}</span><button className="x" title="Remove this arrow" aria-label="Remove this arrow" onClick={() => a.set(["links", i], undefined)}>×</button></div>)}
        {isFlow ? <p className="hint">Tab adds the next step, Enter a sibling. Drag a dot on the edge to connect.</p> : null}
        <Layer a={a} />
        <Rename id={id} label="Id" onRename={(to) => a.renameNode(id, to)} />
        <Actions a={a}>
          {t === "card" && !n.ref ? <button className="btn dark" onClick={() => a.chooseImage(id)}>Choose image…</button> : null}
          {t === "card" && card?.png ? <button className="btn" onClick={() => a.crop(id)} title="Show only part of the picture">{n.crop ? "Change crop…" : "Crop…"}</button> : null}
          {cardKind ? <button className="btn dark" onClick={() => a.openCard(n.ref!)}>{cardKind === "image" ? "Open the picture" : `Edit in ${KIT[cardKind]}`}</button> : null}
          {n.url && /^https?:\/\//.test(n.url) ? <a className="btn" href={n.url} target="_blank" rel="noreferrer">Open {hostOf(n.url)}</a> : null}
          {nudged ? <button className="btn" onClick={() => a.resetNudge(id)}>Back to auto layout</button> : null}
        </Actions>
      </aside>
    );
  }

  if (kind === "frame" && doc.frames?.[id]) {
    const f = doc.frames[id];
    const P = (prop: string): Path => ["frames", id, prop];
    const order = slides(doc, L).map((s) => s.id);
    const inDeck = order.includes(id);
    return (
      <aside className="inspector">
        <h3>Frame<small>{id}</small></h3>
        <Field label="Title" wide><Text value={f.title ?? ""} focusKey={focusText} onChange={(v) => a.set(P("title"), v || undefined, `ftitle:${id}`)} /></Field>
        <Field label="Speaker notes" wide><Text area value={f.notes ?? ""} placeholder="What to point out when this is on screen" onChange={(v) => a.set(P("notes"), v || undefined, `notes:${id}`)} /></Field>
        <Field label="Web link" wide><Text mono value={f.url ?? ""} placeholder="https://… (the spec, the epic, the prototype)" onChange={(v) => a.set(P("url"), v || undefined, `furl:${id}`)} /></Field>
        <Field label="Flow runs">
          <span className="seg">{(["right", "down"] as const).map((d) => <button key={d} className={(f.dir ?? "right") === d ? "on" : ""} onClick={() => a.set(P("dir"), d === "right" ? undefined : d)}>{d === "right" ? "Across" : "Down"}</button>)}</span>
        </Field>
        <Field label="Sits">
          <span className="near-pick">
            <select value={f.near?.[0] ?? ""} onChange={(e) => a.set(P("near"), e.target.value ? [e.target.value as Side, f.near?.[1] ?? frameIds.find((x) => x !== id) ?? ""] : undefined)}>
              <option value="">anywhere</option>
              {SIDES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {f.near ? <select value={f.near[1]} onChange={(e) => a.set(P("near"), [f.near![0], e.target.value])}>{frameIds.filter((x) => x !== id).map((x) => <option key={x} value={x}>{doc.frames![x].title ?? x}</option>)}</select> : null}
          </span>
        </Field>
        {doc.canvas?.[id] ? <p className="hint">You placed this frame yourself. <button className="linkish" onClick={() => a.set(["canvas", id], undefined)}>Let it find its own spot</button></p> : null}
        <label className="field inline"><span>A slide in Play</span><input type="checkbox" checked={inDeck} onChange={(e) => a.setPresent(e.target.checked ? [...order, id] : order.filter((x) => x !== id))} /></label>
        <Rename id={id} label="Id" onRename={(to) => a.renameFrame(id, to)} />
        <Actions a={a} dup={false} del="Delete frame" delTitle="Deletes the frame and everything in it">
          <button className="btn dark" onClick={() => a.play(id)}>Present from here</button>
          <button className="btn" onClick={() => a.tidy(id)} title="Lay this frame's flow out automatically again (undo brings your arrangement back)">Tidy up</button>
        </Actions>
      </aside>
    );
  }

  if (kind === "edge" && doc.links?.[Number(id)]) {
    const i = Number(id), l = doc.links[i];
    return (
      <aside className="inspector">
        <h3>Arrow</h3>
        <p className="doc"><button className="linkish" onClick={() => a.select([`node:${l.from}`])}>{plainText(doc.nodes[l.from]?.text ?? l.from)}</button> → <button className="linkish" onClick={() => a.select([`node:${l.to}`])}>{plainText(doc.nodes[l.to]?.text ?? l.to)}</button></p>
        <Field label="Label" wide><Text value={l.label ?? ""} focusKey={focusText} placeholder="yes, no, after 10 min…" onChange={(v) => a.set(["links", i, "label"], v || undefined, `label:${i}`)} /></Field>
        <Field label="Shape" wide><Seg value={l.shape ?? doc.connectors ?? "curved"} options={CONNECTORS} labels={{ curved: "Curved", angled: "Angled", straight: "Straight" }} onChange={(v) => a.set(["links", i, "shape"], v === (doc.connectors ?? "curved") ? undefined : v)} /></Field>
        <Field label="Line" wide><Seg value={l.style ?? "solid"} options={LINK_STYLES} labels={{ solid: "Solid", dashed: "Dashed", dotted: "Dotted" }} onChange={(v) => a.set(["links", i, "style"], v === "solid" ? undefined : v)} /></Field>
        <Field label="Ends" wide><Seg value={l.head ?? "end"} options={HEADS} labels={{ end: "→", start: "←", both: "↔", none: "None" }} onChange={(v) => a.set(["links", i, "head"], v === "end" ? undefined : v)} /></Field>
        <Field label="Color" wide>
          <span className="swatches wrap">
            <button className={!l.color ? "on" : ""} title="Default" aria-label="Default color" onClick={() => a.set(["links", i, "color"], undefined)}><span className="dot default" /></button>
            {LINE_COLOR_NAMES.filter((c) => c !== "none").map((c) => <button key={c} className={l.color === c ? "on" : ""} title={c} aria-label={c} onClick={() => a.set(["links", i, "color"], c)}><span className="dot" style={{ background: LINE_COLORS[c] }} /></button>)}
            <AnyColor value={l.color} onPick={(h) => a.set(["links", i, "color"], h)} title="Any line color" />
          </span>
        </Field>
        <Field label="Weight" wide><Seg value={l.weight ?? "normal"} options={WEIGHTS} labels={WEIGHT_LABEL} onChange={(v) => a.set(["links", i, "weight"], v === "normal" ? undefined : v)} /></Field>
        {l.fromSide || l.toSide ? <p className="hint">Pinned to the {l.fromSide ?? "auto"} side of one box and the {l.toSide ?? "auto"} side of the other. <button className="linkish" onClick={() => { a.set(["links", i], { ...l, fromSide: undefined, toSide: undefined }); }}>Let it pick</button></p> : <p className="hint">To pin which sides it uses, drag from a box's dot onto one of the other box's dots.</p>}
        <Actions a={a} dup={false}><button className="btn" onClick={() => a.reverseLink(i)}>Flip direction</button></Actions>
      </aside>
    );
  }

  if (kind === "shape") {
    const path: Path = id ? ["frames", id, "shapes", Number(extra)] : ["shapes", Number(extra)];
    const s = id ? doc.frames?.[id]?.shapes?.[Number(extra)] : doc.shapes?.[Number(extra)];
    if (s) return (
      <aside className="inspector">
        <h3>Drawing<small>{s.type}</small></h3>
        {s.type === "text" ? <Field label="Words" wide><Text area value={s.text ?? ""} focusKey={focusText} onChange={(v) => a.set([...path, "text"], v, `stext:${key}`)} /></Field> : null}
        <Field label="Color"><span className="swatches">{COLORS.map((c) => <button key={c} title={c} aria-label={c} className={(s.color ?? "ink") === c ? "on" : ""} onClick={() => a.set([...path, "color"], c === "ink" ? undefined : c)}><span className="dot" style={{ background: MARKER[c] }} /></button>)}<AnyColor value={s.color} onPick={(h) => a.set([...path, "color"], h)} /></span></Field>
        {s.type === "rect" || s.type === "ellipse" || s.type === "path" ? (
          <Field label="Fill"><span className="seg">{(["none", "light", "mid", "dark"] as const).map((f) => <button key={f} className={(s.fill ?? "none") === f ? "on" : ""} onClick={() => a.set([...path, "fill"], f === "none" ? undefined : f)}>{f}</button>)}</span></Field>
        ) : null}
        <Layer a={a} />
        <p className="hint">{id ? `Drawn in "${doc.frames?.[id]?.title ?? id}", so it moves with the frame.` : "Drawn on the board, outside any frame."} {(s as { front?: boolean }).front ? "It's in front of the boxes and cards." : "It's behind the boxes and cards; To front puts it on top."}</p>
        <Actions a={a} />
      </aside>
    );
  }

  // nothing selected: the board, its slides, its checks
  const order = slides(doc, L);
  const errs = result?.errors ?? [], warns = result?.warnings ?? [];
  const left = frameIds.filter((f) => !order.some((s) => s.id === f));
  return (
    <aside className="inspector">
      <h3>Board</h3>
      <Field label="Title" wide><Text value={doc.title ?? ""} onChange={(v) => a.set(["title"], v, "title")} /></Field>
      <Field label="Connectors" wide><Seg value={doc.connectors ?? "curved"} options={CONNECTORS} labels={{ curved: "Curved", angled: "Angled", straight: "Straight" }} onChange={(v) => a.set(["connectors"], v === "curved" ? undefined : v)} /></Field>
      <h4>Slides</h4>
      {frameIds.length ? (
        <>
          <ol className="slide-list">
            {order.map((s, i) => (
              <li key={s.id}>
                <span className="n">{i + 1}.</span>
                <button className="linkish" onClick={() => a.focus(`frame:${s.id}`)}><RichHTML src={s.title} /></button>
                <span className="slide-moves">
                  <button disabled={!i} title="Earlier" aria-label="Earlier" onClick={() => { const o = order.map((x) => x.id); [o[i - 1], o[i]] = [o[i], o[i - 1]]; a.setPresent(o); }}>↑</button>
                  <button disabled={i === order.length - 1} title="Later" aria-label="Later" onClick={() => { const o = order.map((x) => x.id); [o[i + 1], o[i]] = [o[i], o[i + 1]]; a.setPresent(o); }}>↓</button>
                </span>
              </li>
            ))}
          </ol>
          {left.length ? <p className="hint">Not in the deck: {left.map((f) => doc.frames![f].title ?? f).join(", ")}</p> : null}
          <Field label="Between slides">
            <span className="seg">{(["fade", "cut"] as const).map((t) => <button key={t} className={(doc.transition ?? "fade") === t ? "on" : ""} onClick={() => a.set(["transition"], t === "fade" ? undefined : t)}>{t === "fade" ? "Fade" : "Cut"}</button>)}</span>
          </Field>
        </>
      ) : <p className="hint">No frames yet, so Play shows the whole board. Frames become slides: add one from the palette, or select a few things and put them in a frame.</p>}
      <h4>Checks</h4>
      {!errs.length && !warns.length ? <p className="ok-note">Looks good.</p> : (
        <ul className="issues">
          {errs.map((e, i) => <li key={`e${i}`} className="err">{e.message}{e.hint ? <div className="fix">{e.hint}</div> : null}<code>{e.path}</code></li>)}
          {warns.map((w, i) => <li key={`w${i}`} className="warn">{w.message}{w.hint ? <div className="fix">{w.hint}</div> : null}<code>{w.path}</code></li>)}
        </ul>
      )}
      <p className="hint">Things stay where you put them. <button className="linkish" onClick={() => a.tidy()}>Tidy up the whole board</button> to lay it all out automatically again.</p>
      <p className="hint">Double-click anything to change its words. Drag from the palette, or drop an image or paste a link anywhere. Press P to present.</p>
    </aside>
  );
}
