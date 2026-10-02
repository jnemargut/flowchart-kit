/**
 * The board in marker style: frames, the designer's drawings, arrows, steps, stickies, cards and stamps.
 * The editor draws this live; the exports render the same thing to files.
 */
import { StickyPaper } from "../../vendor/sketch/sticky";
import { plainText, richLines } from "../../vendor/sketch/rich";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkupStrokes, ShapeMark, type SketchShape } from "../../vendor/sketch/shapes";
import { C, OFFSET } from "../../vendor/sketch/tokens";
import { WobbleFilter } from "../../vendor/sketch/wobble";
import { hostOf, layoutBoard, slides, TITLE_H, type Box, type BoardLayout, type Edge, type NodeBox } from "../layout";
import type { CardInfo, Cards, FlowchartFile, FNode } from "../types";
import { FILLS, LINE_COLORS, STICKY, WEIGHT_PX } from "../vocab";
import { Stamp } from "./stamps";

export interface ArtOpts {
  cards?: Cards;
  /** The picture for a card node (a URL or data URI). */
  cardHref?: (id: string, info: CardInfo) => string | undefined;
  /** Hand-drawn wobble on lines (off while dragging in the editor). */
  wobble?: boolean;
  /** Unique id prefix for SVG defs. */
  uid?: string;
  /** Show this frame's play-mode sharpie ("" = the whole board's). */
  markup?: string;
  /** Leave these node ids out (the editor draws them elsewhere while editing). */
  hide?: Set<string>;
  /** Highlight a link (the editor's selection). */
  highlightEdge?: number;
  /** Where the wobble filter may draw. Pin it to the canvas when rendering a crop: a filter region hanging off the canvas crashes resvg. */
  region?: Box;
}

const HAND = "Patrick Hand", TITLE = "Permanent Marker", MONO = "IBM Plex Mono";
const PRODUCT_FILL = "#e6f5f6";

/** A small, stable tilt for each sticky, so a wall of them looks stuck on by hand. */
const tilt = (id: string) => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0; return ((Math.abs(h) % 5) - 2) * 0.8; };

function Words({ b, src, color = C.ink, top }: { b: NodeBox; src?: string; color?: string; top?: number }) {
  const lh = b.size * 1.22;
  const y0 = top ?? b.y + b.h / 2 - (b.lines.length * lh) / 2 + b.size * 0.8;
  return (
    <text textAnchor="middle" fontFamily={HAND} fontSize={b.size} fill={color}>
      {richLines(src ?? "", b.lines, color, b.size).map((l, i) => <tspan key={i} x={b.x + b.w / 2} y={y0 + i * lh}>{l || " "}</tspan>)}
    </text>
  );
}

const CHAIN = "M10.5 13.5 L13.5 10.5 M9 11 L7.2 12.8 A3.2 3.2 0 0 0 11.2 16.8 L13 15 M15 13 L16.8 11.2 A3.2 3.2 0 0 0 12.8 7.2 L11 9";

/** A little round link badge: click it to open the url (a real link in exported SVG). */
export function LinkBadge({ url, x, y, r = 13 }: { url: string; x: number; y: number; r?: number }) {
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <g data-url={url} transform={`translate(${x - r} ${y - r}) scale(${r / 12})`}>
        <circle cx={12} cy={12} r={11} fill="#fff" stroke={C.ink} strokeWidth={1.8} />
        <path d={CHAIN} fill="none" stroke={C.ink} strokeWidth={2} strokeLinecap="round" />
        <title>{url}</title>
      </g>
    </a>
  );
}

function NodeArt({ b, n, o, wob }: { b: NodeBox; n: FNode; o: ArtOpts; wob?: string }) {
  const ink = n.stroke ? LINE_COLORS[n.stroke] ?? C.ink : n.product ? C.tealDark : C.ink;
  const line = { stroke: ink, strokeWidth: WEIGHT_PX[n.weight ?? "normal"] ?? 2.4, strokeLinejoin: "round" as const };
  const chosen = n.fill ? FILLS[n.fill]?.fill : undefined;
  const face = chosen ?? (n.product ? PRODUCT_FILL : "#fff");
  // the marker's offset shadow: not for solid white (it's for covering things), see-through, or no-border boxes
  const shadow = n.fill !== "white" && n.fill !== "none" && n.stroke !== "none";
  const words = n.fill === "dark" ? C.paper : C.ink;
  const off = `translate(${OFFSET.x} ${OFFSET.y})`;
  if (b.type === "text") {
    const bg = chosen && chosen !== "none" ? <rect x={b.x - 6} y={b.y - 4} width={b.w + 12} height={b.h + 8} rx={4} fill={chosen} stroke={n.stroke && n.stroke !== "none" ? ink : "none"} strokeWidth={line.strokeWidth} /> : null;
    return <g data-node={b.id}><rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" />{bg}<Words b={b} src={n.text} color={n.fill === "dark" ? C.paper : n.stroke && n.stroke !== "none" && !bg ? ink : C.g8} /></g>;
  }
  if (b.type === "link") {
    const url = n.url ?? "";
    const lh = b.size * 1.22;
    return (
      <g data-node={b.id}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill={C.g2} transform={off} />
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill="#fff" stroke={C.ink} strokeWidth={2.2} filter={wob} />
        <text fontFamily={HAND} fontSize={b.size} fill={C.ink}>{richLines(n.text ?? "", b.lines, C.ink, b.size).map((l, i) => <tspan key={i} x={b.x + 16} y={b.y + 26 + i * lh}>{l}</tspan>)}</text>
        <text x={b.x + 16} y={b.y + b.h - 14} fontFamily={MONO} fontSize={12} fill={C.g7}>{hostOf(url).slice(0, Math.floor((b.w - 60) / 7.3))}</text>
        <LinkBadge url={url} x={b.x + b.w - 20} y={b.y + 20} r={12} />
      </g>
    );
  }
  if (b.type === "stamp") return <g data-node={b.id}><rect x={b.x} y={b.y} width={b.w} height={b.h} fill="transparent" /><Stamp icon={n.icon} x={b.x} y={b.y} s={b.w} /></g>;
  if (b.type === "sticky") {
    const fill = STICKY[n.color ?? "yellow"]?.fill ?? STICKY.yellow.fill;
    const [cx, cy] = [b.x + b.w / 2, b.y + b.h / 2];
    return (
      <g data-node={b.id} transform={`rotate(${tilt(b.id)} ${cx} ${cy})`}>
        <StickyPaper x={b.x} y={b.y} w={b.w} h={b.h} fill={fill} />
        <Words b={b} src={n.text} top={b.y + 24 + b.size * 0.8} />
      </g>
    );
  }
  if (b.type === "card") {
    const info = o.cards?.[b.id];
    const href = info ? o.cardHref?.(b.id, info) : undefined;
    const imgH = b.h - 30;
    const label = b.lines[0] ?? "";
    const tag = info?.state === "stale" ? "out of date" : undefined;
    const showImg = href && (info?.state === "ok" || info?.state === "stale");
    return (
      <g data-node={b.id}>
        <rect x={b.x + OFFSET.x + 1} y={b.y + OFFSET.y + 1} width={b.w} height={imgH} fill={C.g4} />
        {showImg
          ? <image href={href} x={b.x} y={b.y} width={b.w} height={imgH} preserveAspectRatio="xMidYMid meet" />
          : <rect x={b.x} y={b.y} width={b.w} height={imgH} fill={C.paper} />}
        <rect x={b.x} y={b.y} width={b.w} height={imgH} fill="none" stroke={ink} strokeWidth={2.2} strokeDasharray={showImg ? undefined : "7 6"} />
        {!showImg ? (
          <text textAnchor="middle" fontFamily={HAND} fontSize={16} fill={C.g7}>
            <tspan x={b.x + b.w / 2} y={b.y + imgH / 2 - 4}>{!n.ref ? "Drop an image here" : info?.state === "missing" ? "Can't find this file" : info?.state === "unknown" ? "Can't find that part" : info?.state === "nokit" ? `Needs ${info.kind === "storyboard" ? "Storyboard Kit" : "Wireframe Kit"} to draw` : "Not drawn yet"}</tspan>
            <tspan x={b.x + b.w / 2} y={b.y + imgH / 2 + 18} fontSize={13}>{!n.ref ? "or double-click to choose one" : info?.problem ?? ""}</tspan>
          </text>
        ) : null}
        <text x={b.x} y={b.y + imgH + 20} fontFamily={MONO} fontSize={12} fill={C.g7}>{label}</text>
        {tag ? <g><rect x={b.x + b.w - 92} y={b.y + 8} width={84} height={22} rx={11} fill={C.caption} stroke={C.ink} strokeWidth={1.4} /><text x={b.x + b.w - 50} y={b.y + 23.5} textAnchor="middle" fontFamily={HAND} fontSize={14} fill={C.ink}>{tag}</text></g> : null}
      </g>
    );
  }
  if (b.type === "diamond") {
    const d = `M${b.x + b.w / 2} ${b.y} L${b.x + b.w} ${b.y + b.h / 2} L${b.x + b.w / 2} ${b.y + b.h} L${b.x} ${b.y + b.h / 2} Z`;
    return <g data-node={b.id}>{shadow ? <path d={d} fill={n.product ? C.tealTint : C.g2} transform={off} /> : null}<path d={d} fill={face === "none" ? "transparent" : face} {...line} stroke={n.stroke === "none" ? "none" : ink} filter={wob} /><Words b={b} src={n.text} color={words} /></g>;
  }
  const rx = b.type === "pill" ? b.h / 2 : 9;
  return (
    <g data-node={b.id}>
      {shadow ? <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={rx} fill={n.product ? C.tealTint : C.g2} transform={off} /> : null}
      <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={rx} fill={(b.type === "pill" && !chosen ? (n.product ? PRODUCT_FILL : C.g1) : face) === "none" ? "transparent" : b.type === "pill" && !chosen ? (n.product ? PRODUCT_FILL : C.g1) : face} {...line} stroke={n.stroke === "none" ? "none" : ink} filter={wob} />
      <Words b={b} src={n.text} color={words} />
    </g>
  );
}

/** A chevron arrowhead at point p, pointing along `angle`. */
const chevron = (p: [number, number], angle: number, k: number) =>
  `M${p[0] - k * Math.cos(angle - 0.45)} ${p[1] - k * Math.sin(angle - 0.45)} L${p[0]} ${p[1]} L${p[0] - k * Math.cos(angle + 0.45)} ${p[1] - k * Math.sin(angle + 0.45)}`;

export function EdgeArt({ e, highlight, wob }: { e: Edge; highlight?: boolean; wob?: string }) {
  const base = e.color ? LINE_COLORS[e.color] ?? C.g8 : C.g8;
  const color = highlight ? C.action : base;
  const w0 = WEIGHT_PX[e.weight ?? "normal"] ?? 2.4;
  const w = highlight ? w0 + 0.8 : w0;
  const k = 10 + w0 * 1.2;
  const dash = e.style === "dashed" ? `${w0 * 4} ${w0 * 3.2}` : e.style === "dotted" ? `0.1 ${w0 * 2.8}` : undefined;
  const heads = [e.head === "end" || e.head === "both" ? chevron(e.end, e.angle, k) : "", e.head === "start" || e.head === "both" ? chevron(e.start, e.startAngle, k) : ""].filter(Boolean).join(" ");
  return (
    <g data-edge={e.i}>
      <path d={e.d} fill="none" stroke="transparent" strokeWidth={14} />
      <g filter={wob}>
        <path d={e.d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} />
        {heads ? <path d={heads} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" /> : null}
      </g>
    </g>
  );
}

/** Arrow labels go on after every arrow, so no line runs over a word. */
export const EdgeLabel = ({ e, highlight }: { e: Edge; highlight?: boolean }) => e.label
  ? <text data-edge={e.i} x={e.lx} y={e.ly + 5} textAnchor="middle" fontFamily={HAND} fontSize={16} fill={highlight ? C.action : C.g8} stroke={C.paper} strokeWidth={6} strokeLinejoin="round" paintOrder="stroke">{richLines(e.label, [plainText(e.label)], highlight ? C.action : C.g8, 16)[0]}</text>
  : null;

function FrameArt({ f, wob }: { f: BoardLayout["frames"][string]; wob?: string }) {
  return (
    <g data-frame={f.id}>
      <rect x={f.x} y={f.y} width={f.w} height={f.h} rx={14} fill={C.paper} fillOpacity={0.7} stroke={C.g5} strokeWidth={2.2} strokeDasharray="10 7" filter={wob} />
      <text data-frame-title={f.id} x={f.x + 26} y={f.y + 38} fontFamily={TITLE} fontSize={24} fill={C.g8}>{richLines(f.title, [plainText(f.title)], C.g8, 24)[0]}</text>
    </g>
  );
}

/** Drawings in the back layer (default) or, with `front`, in front of the boxes and cards. */
const Shapes = ({ shapes, dx = 0, dy = 0, prefix, front = false }: { shapes?: SketchShape[]; dx?: number; dy?: number; prefix: string; front?: boolean }) =>
  shapes?.length ? <g transform={dx || dy ? `translate(${dx} ${dy})` : undefined}>{shapes.map((s, i) => s?.points?.length && !!(s as { front?: boolean }).front === front ? <g key={i} data-shape={`${prefix}:${i}`}><ShapeMark s={s} /></g> : null)}</g> : null;

/** Everything on the board, in canvas coordinates. */
export function BoardArt({ doc, L, o = {} }: { doc: FlowchartFile; L: BoardLayout; o?: ArtOpts }) {
  const uid = o.uid ?? "fc";
  const b = o.region ?? { x: L.bounds.x - 400, y: L.bounds.y - 400, w: L.bounds.w + 800, h: L.bounds.h + 800 };
  const wob = o.wobble === false ? undefined : `url(#${uid}-wob)`;
  // nodes draw in the order the file lists them (that's what Forward / To back change)
  const order = new Map(Object.keys(doc.nodes).map((k, i) => [k, i]));
  const nodes = Object.values(L.nodes).filter((n) => !o.hide?.has(n.id)).sort((p, q) => (order.get(p.id) ?? 0) - (order.get(q.id) ?? 0));
  // hand-drawn nodes share one wobble pass; a card (a picture, which shouldn't wobble) splits them into runs
  const runs: { cards: boolean; list: typeof nodes }[] = [];
  for (const n of nodes.filter((x) => x.type !== "stamp")) {
    const isCard = n.type === "card";
    const last = runs[runs.length - 1];
    if (last && last.cards === isCard) last.list.push(n); else runs.push({ cards: isCard, list: [n] });
  }
  const frames = Object.values(L.frames).filter((f) => !f.loose);
  const mk = o.markup !== undefined ? doc.markup?.[o.markup] : undefined;
  const mkOrigin = o.markup ? L.frames[o.markup] : undefined;
  return (
    <g>
      <defs><WobbleFilter id={`${uid}-wob`} region={{ x: b.x, y: b.y, width: b.w, height: b.h }} scale={1.8} frequency={0.03} /></defs>
      {/* one wobble for everything hand drawn: a filter is a pass over its whole region, so once is much faster than per shape */}
      <g filter={wob}>
        {frames.map((f) => <FrameArt key={f.id} f={f} />)}
        <Shapes shapes={doc.shapes} prefix="" />
        {frames.map((f) => <Shapes key={f.id} shapes={doc.frames?.[f.id]?.shapes} dx={f.ox} dy={f.oy} prefix={f.id} />)}
        {L.edges.map((e) => <EdgeArt key={e.i} e={e} highlight={o.highlightEdge === e.i} />)}
        {L.edges.map((e) => <EdgeLabel key={e.i} e={e} highlight={o.highlightEdge === e.i} />)}
        {runs[0] && !runs[0].cards ? runs[0].list.map((n) => <NodeArt key={n.id} b={n} n={doc.nodes[n.id]} o={o} />) : null}
      </g>
      {runs.map((r, k) => (k === 0 && !r.cards ? null : r.cards
        ? <g key={k}>{r.list.map((n) => <NodeArt key={n.id} b={n} n={doc.nodes[n.id]} o={o} />)}</g>
        : <g key={k} filter={wob}>{r.list.map((n) => <NodeArt key={n.id} b={n} n={doc.nodes[n.id]} o={o} />)}</g>))}
      {frames.map((f) => doc.frames?.[f.id]?.url ? <LinkBadge key={f.id} url={doc.frames[f.id].url!} x={f.x + f.w - 26} y={f.y + 28} /> : null)}
      <Shapes shapes={doc.shapes} prefix="" front />
      {frames.map((f) => <Shapes key={`f${f.id}`} shapes={doc.frames?.[f.id]?.shapes} dx={f.ox} dy={f.oy} prefix={f.id} front />)}
      {nodes.filter((n) => n.type !== "link" && doc.nodes[n.id]?.url).map((n) => <LinkBadge key={n.id} url={doc.nodes[n.id].url!} x={n.x + n.w - 4} y={n.y + 4} />)}
      {nodes.filter((n) => n.type === "stamp").map((n) => <NodeArt key={n.id} b={n} n={doc.nodes[n.id]} o={o} />)}
      {mk?.length ? <g transform={mkOrigin ? `translate(${mkOrigin.ox} ${mkOrigin.oy})` : undefined}><MarkupStrokes strokes={mk} /></g> : null}
    </g>
  );
}

/** The board (or one frame, as a slide) as a standalone SVG. */
export function boardSVG(doc: FlowchartFile, o: ArtOpts & { fontCss?: string; frame?: string; L?: BoardLayout; box?: Box } = {}): string {
  const L = o.L ?? layoutBoard(doc, o.cards);
  let box: Box, head = 0;
  const m = o.box ? 24 : 40;
  if (o.box) box = o.box;
  else if (o.frame !== undefined) {
    const s = slides(doc, L).find((x) => x.id === o.frame) ?? { box: L.bounds };
    box = s.box;
  } else { box = L.bounds; head = 78; }
  const W = Math.ceil(box.w + m * 2), H = Math.ceil(box.h + m * 2 + head);
  const vx = box.x - m, vy = box.y - m - head;
  const art: ReactNode = (
    <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`${vx} ${vy} ${W} ${H}`}>
      {o.fontCss ? <style>{o.fontCss}</style> : null}
      <rect x={vx} y={vy} width={W} height={H} fill={C.paper} />
      {head ? <text x={box.x} y={box.y - head + 30} fontFamily={TITLE} fontSize={36} fill={C.ink}>{richLines(doc.title, [plainText(doc.title)], C.ink, 36)[0]}</text> : null}
      <BoardArt doc={doc} L={L} o={{ ...o, markup: o.frame, region: { x: vx, y: vy, w: W, h: H } }} />
    </svg>
  );
  return renderToStaticMarkup(art);
}

export { TITLE_H };
