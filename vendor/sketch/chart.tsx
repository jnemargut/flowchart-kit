/**
 * Sketchy charts: bars, rows, a line, a funnel, a pie or a donut, drawn in marker style from a few labeled numbers.
 * Directional on purpose: every number is written on the chart and there's no fussy axis, so it reads as
 * "roughly this shape" in a crit, not as a dashboard. Grays by default; one accent color for what matters.
 */
import { C, FONT, OFFSET, markerHex } from "./tokens";

export const CHART_KINDS = ["bar", "hbar", "line", "funnel", "pie", "donut"] as const;
export type ChartKind = (typeof CHART_KINDS)[number];
export const CHART_KIND_LABEL: Record<ChartKind, string> = { bar: "Bars", hbar: "Rows", line: "Line", funnel: "Funnel", pie: "Pie", donut: "Donut" };
/** One labeled number. */
export type ChartRow = [string, number];

export interface ChartSpec {
  /** bar (default) · hbar (sideways bars, good for long labels) · line · funnel · pie · donut */
  kind?: string;
  /** [["Browse", 1200], ["Cart", 640]] or { "Browse": 1200, "Cart": 640 } */
  data?: unknown;
  /** Label(s) to call out in the accent color; the rest stay gray. */
  highlight?: string | string[];
  /** Put on every number: "%", "$", "people", "min"… Currency goes in front, anything else after. */
  unit?: string;
  /** The accent: a marker color or any hex. Default dark gray. */
  color?: string;
  /** false hides the numbers. */
  values?: boolean;
}

/** The rows of a chart's data, whichever way it was written. Anything that isn't a finite number is skipped. */
export function chartRows(data: unknown): ChartRow[] {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" ? parseNumber(v) : undefined);
  if (Array.isArray(data)) {
    return data.flatMap((r): ChartRow[] => {
      if (Array.isArray(r) && r.length >= 2) { const v = num(r[1]); return v === undefined ? [] : [[String(r[0] ?? ""), v]]; }
      if (r && typeof r === "object" && "value" in r) { const o = r as { label?: unknown; value?: unknown }; const v = num(o.value); return v === undefined ? [] : [[String(o.label ?? ""), v]]; }
      return [];
    });
  }
  if (data && typeof data === "object") return Object.entries(data).flatMap(([k, v]): ChartRow[] => { const n = num(v); return n === undefined ? [] : [[k, n]]; });
  return [];
}

/** "1,200" · "$4.50" · "45%" · "-3" → a number (or undefined if it isn't one). */
export function parseNumber(s: string): number | undefined {
  const t = s.trim().replace(/^[$€£¥]/, "").replace(/%$/, "").replace(/,/g, "").trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
}

/**
 * Rows typed or pasted as text: one per line, "label, value" (or a tab, or a colon, between them). Cells copied
 * from a spreadsheet paste as tabs. A first line without a number is taken as the title. Spots "%" and "$".
 */
export function parseChartText(text: string): { rows: ChartRow[]; unit?: string; title?: string } {
  const rows: ChartRow[] = [];
  let title: string | undefined, pct = 0, cur = 0;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const [i, line] of lines.entries()) {
    // the label is everything up to the last separator whose remainder is a number ("Hello, world, 12" → "Hello, world")
    const m = /^(.*?)\s*[\t,:;|]\s*([-+]?[$€£¥]?\s*[\d.,]+\s*%?)\s*$/.exec(line) ?? /^(.*?)\s+([-+]?[$€£¥]?[\d.,]+%?)$/.exec(line);
    const v = m ? parseNumber(m[2].replace(/\s/g, "")) : undefined;
    if (!m || v === undefined) { if (i === 0 && !rows.length) title = line.split(/\t/).filter(Boolean)[0]; continue; }
    if (m[2].includes("%")) pct++;
    if (/[$€£¥]/.test(m[2])) cur++;
    rows.push([m[1].replace(/^["']|["']$/g, "").trim(), v]);
  }
  const unit = pct && pct >= rows.length / 2 ? "%" : cur && cur >= rows.length / 2 ? (/[€£¥]/.exec(text)?.[0] ?? "$") : undefined;
  return { rows, unit, title };
}

/** Rows back as text, one "label, value" per line: what the editor's data box shows. */
export const chartText = (rows: ChartRow[]) => rows.map(([l, v]) => `${l}, ${v}`).join("\n");

/** 1200 → "1,200" · 12400 → "12.4K" · 0.456 → "0.46", with the unit: "$1,200", "45%", "12 people". */
export function formatValue(v: number, unit?: string): string {
  const a = Math.abs(v);
  const n = a >= 1e9 ? `${trim(v / 1e9)}B` : a >= 1e6 ? `${trim(v / 1e6)}M` : a >= 1e4 ? `${trim(v / 1e3)}K` : v.toLocaleString("en-US", { maximumFractionDigits: a < 1 && a > 0 ? 2 : 1 });
  if (!unit) return n;
  if (/^[$€£¥]$/.test(unit)) return v < 0 ? `-${unit}${n.slice(1)}` : `${unit}${n}`;
  return /^[%°]/.test(unit) ? `${n}${unit}` : `${n} ${unit}`;
}
const trim = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : v.toFixed(1).replace(/\.0$/, ""));

const highlights = (h: ChartSpec["highlight"]) => new Set((Array.isArray(h) ? h : h ? [h] : []).map((x) => String(x).trim().toLowerCase()));
/** A label cut to fit a width (hand lettering is about half as wide as it is tall). */
const fit = (s: string, width: number, size: number) => { const max = Math.max(1, Math.floor(width / (size * 0.47))); return s.length <= max ? s : max <= 2 ? s.slice(0, max) : `${s.slice(0, max - 1)}…`; };
/** Grays for pie slices, light to dark and back, so neighbors differ. */
const SLICES = ["#ffffff", C.g2, C.g4, C.g1, C.g5, "#eef0f2"];

/**
 * A chart in the box (x, y, w, h). `filter` is the kit's wobble filter (applied to the lines, not the words);
 * `scale` sizes the words and lines for bigger canvases.
 */
export function SketchChart({ spec, x, y, w, h, filter, scale = 1 }: { spec: ChartSpec; x: number; y: number; w: number; h: number; filter?: string; scale?: number }) {
  const rows = chartRows(spec.data);
  const kind: ChartKind = (CHART_KINDS as readonly string[]).includes(spec.kind ?? "") ? (spec.kind as ChartKind) : "bar";
  const hl = highlights(spec.highlight);
  const isHl = (l: string) => hl.has(l.trim().toLowerCase());
  const accent = spec.color ? markerHex(spec.color, C.g7) : C.g7;
  // an accent color with nothing called out tints everything; called-out rows get it solid
  const fillOf = (l: string) => (isHl(l) ? accent : hl.size ? C.g2 : spec.color ? accent : C.g2);
  const opacityOf = (l: string) => (isHl(l) || !hl.size ? (spec.color && !isHl(l) ? 0.35 : 1) : 1);
  const show = spec.values !== false;
  const fs = 13 * scale, sw = 1.8 * scale, ink = C.ink, muted = C.g7;
  // `halo` outlines the words in paper, so a number sitting on a line stays readable
  const word = (tx: number, ty: number, s: string, o: { anchor?: "start" | "middle" | "end"; color?: string; size?: number; bold?: boolean; halo?: boolean } = {}) => (
    <text x={tx} y={ty} textAnchor={o.anchor ?? "middle"} fontFamily={FONT.hand} fontSize={o.size ?? fs} fontWeight={o.bold ? 700 : undefined} fill={o.color ?? ink}
      {...(o.halo ? { stroke: C.paper, strokeWidth: 4 * scale, strokeLinejoin: "round" as const, paintOrder: "stroke" } : {})}>{s}</text>
  );
  const val = (v: number) => formatValue(v, spec.unit);
  // under narrow bars and on a line, a word unit ("orders") goes on one number, not all of them;
  // symbols ("%", "$") stay on every number
  const wordUnit = !!spec.unit && !/^[$€£¥%°]/.test(spec.unit);
  const unitRow = (() => { if (!wordUnit) return -1; const h = rows.findIndex(([l]) => isHl(l)); return h >= 0 ? h : rows.reduce((m, r, i) => (r[1] > rows[m][1] ? i : m), 0); })();
  const short = (v: number, i: number) => (wordUnit && i !== unitRow ? formatValue(v) : val(v));
  // a filled box in marker style: the fill sits a little off the ink line
  const box = (bx: number, by: number, bw: number, bh: number, label: string) => (
    <g key={`${label}-${bx}-${by}`}>
      <rect x={bx + OFFSET.x * scale * 0.7} y={by + OFFSET.y * scale * 0.7} width={Math.max(0, bw)} height={Math.max(0, bh)} rx={2 * scale} fill={fillOf(label)} fillOpacity={opacityOf(label)} />
      <rect x={bx} y={by} width={Math.max(0, bw)} height={Math.max(0, bh)} rx={2 * scale} fill="none" stroke={ink} strokeWidth={sw} strokeLinejoin="round" />
    </g>
  );

  if (!rows.length) {
    return (
      <g>
        <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={6} fill="none" stroke={C.g4} strokeWidth={sw} strokeDasharray={`${6 * scale} ${5 * scale}`} />
        {word(x + w / 2, y + h / 2 + fs * 0.35, "Add some numbers", { color: muted })}
      </g>
    );
  }

  if (kind === "bar") {
    const lo = Math.min(0, ...rows.map((r) => r[1])), hi = Math.max(0, ...rows.map((r) => r[1]));
    // numbers under negative bars need their own room above the labels
    const top = y + (show ? fs + 8 : 6), bottom = y + h - fs - 10 - (lo < 0 && show ? fs + 6 : 0), span = hi - lo || 1;
    const Y = (v: number) => bottom - ((v - lo) / span) * (bottom - top);
    const slot = (w - 8) / rows.length, bw = Math.min(slot * 0.68, 90 * scale);
    const every = Math.ceil((fs * 2.6) / slot);
    return (
      <g>
        <g filter={filter}>
          {rows.map(([l, v], i) => { const cx = x + 4 + slot * (i + 0.5); return box(cx - bw / 2, Math.min(Y(v), Y(0)), bw, Math.abs(Y(v) - Y(0)), l); })}
          <path d={`M${x + 2} ${Y(0)} L${x + w - 2} ${Y(0)}`} stroke={ink} strokeWidth={sw} strokeLinecap="round" fill="none" />
        </g>
        {rows.map(([l, v], i) => {
          const cx = x + 4 + slot * (i + 0.5);
          return (
            <g key={i}>
              {show && (rows.length <= 14 || isHl(l)) ? word(cx, v >= 0 ? Y(v) - 6 : Y(v) + fs + 4, short(v, i), { bold: isHl(l), size: fs * (slot < fs * 3 ? 0.85 : 1) }) : null}
              {i % every === 0 || isHl(l) ? word(cx, y + h - 4, fit(l, slot * every - 4, fs), { color: isHl(l) ? ink : muted, bold: isHl(l) }) : null}
            </g>
          );
        })}
      </g>
    );
  }

  if (kind === "hbar" || kind === "funnel") {
    const n = rows.length, rowH = Math.min((h - 4) / n, 44 * scale), gap = Math.min(rowH * 0.28, 10 * scale);
    const first = rows[0][1] || 1;
    const valueText = (v: number) => (kind === "funnel" && first > 0 ? `${val(v)} · ${Math.round((v / first) * 100)}%` : val(v));
    const labelW = Math.min(w * 0.36, Math.max(...rows.map(([l]) => l.length)) * fs * 0.5 + 10);
    const valueW = show ? Math.min(w * 0.3, Math.max(...rows.map(([, v]) => valueText(v).length)) * fs * 0.5 + 10) : 4;
    const ax = x + labelW, aw = Math.max(10, w - labelW - valueW);
    const lo = Math.min(0, ...rows.map((r) => r[1])), hi = Math.max(0, ...rows.map((r) => r[1])), span = hi - lo || 1;
    const top = y + (h - n * rowH) / 2;
    return (
      <g>
        <g filter={filter}>
          {rows.map(([l, v], i) => {
            const by = top + i * rowH + gap / 2, bh = rowH - gap;
            if (kind === "funnel") { const bw = Math.max(2, (Math.max(0, v) / (hi || 1)) * aw); return box(ax + (aw - bw) / 2, by, bw, bh, l); }
            const x0 = ax + ((0 - lo) / span) * aw, x1 = ax + ((v - lo) / span) * aw;
            return box(Math.min(x0, x1), by, Math.abs(x1 - x0), bh, l);
          })}
          {kind === "hbar" ? <path d={`M${ax + ((0 - lo) / span) * aw} ${top} L${ax + ((0 - lo) / span) * aw} ${top + n * rowH}`} stroke={ink} strokeWidth={sw} strokeLinecap="round" fill="none" /> : null}
        </g>
        {rows.map(([l, v], i) => {
          const cy = top + i * rowH + rowH / 2 + fs * 0.35;
          return (
            <g key={i}>
              {word(ax - 8, cy, fit(l, labelW - 10, fs), { anchor: "end", color: isHl(l) ? ink : C.g8, bold: isHl(l) })}
              {show ? word(x + w - 2, cy, valueText(v), { anchor: "end", bold: isHl(l), color: isHl(l) ? ink : C.g8 }) : null}
            </g>
          );
        })}
      </g>
    );
  }

  if (kind === "line") {
    const lo = Math.min(0, ...rows.map((r) => r[1])), hi = Math.max(...rows.map((r) => r[1]), lo + 1);
    const left = x + 10, right = x + w - 14, top = y + (show ? fs + 10 : 8), bottom = y + h - fs - 12;
    const X = (i: number) => (rows.length === 1 ? (left + right) / 2 : left + (i * (right - left)) / (rows.length - 1));
    const Y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    const pts = rows.map(([, v], i) => `${X(i)} ${Y(v)}`);
    const slot = (right - left) / Math.max(1, rows.length - 1);
    const widest = Math.max(...rows.map(([l]) => l.length)) * fs * 0.47 + 8;
    const every = Math.max(1, Math.ceil(Math.min(widest, fs * 5) / Math.max(1, slot)));
    // evenly spaced labels, plus the called-out ones (which push their near neighbors aside)
    const hlAt = rows.map(([l], i) => (isHl(l) ? i : -1)).filter((i) => i >= 0);
    const labelAt = (i: number) => hlAt.includes(i) || ((i % every === 0 || (i === rows.length - 1 && (rows.length - 1) % every >= every / 2)) && !hlAt.some((j) => Math.abs(j - i) < every));
    const lineColor = spec.color ? accent : ink;
    const widestValue = Math.max(...rows.map(([, v], i) => short(v, i).length)) * fs * 0.5;
    const roomy = rows.length <= 8 && widestValue < slot - 6;
    const valueAt = (i: number) => roomy || i === 0 || i === rows.length - 1 || isHl(rows[i][0]);
    return (
      <g>
        <g filter={filter}>
          <path d={`M${left - 6} ${Y(0)} L${right + 8} ${Y(0)}`} stroke={C.g5} strokeWidth={sw * 0.8} strokeLinecap="round" fill="none" />
          <path d={`M${pts.join(" L")}`} fill="none" stroke={lineColor} strokeWidth={sw * 1.5} strokeLinecap="round" strokeLinejoin="round" />
          {rows.map(([l, v], i) => <circle key={i} cx={X(i)} cy={Y(v)} r={(isHl(l) ? 6 : 4) * scale} fill={isHl(l) ? accent : C.paper} stroke={isHl(l) ? ink : lineColor} strokeWidth={sw} />)}
        </g>
        {rows.map(([l, v], i) => (
          <g key={i}>
            {show && valueAt(i) ? word(X(i) + (rows.length > 1 && i === 0 ? -4 : 0), Y(v) - 10 * scale, wordUnit && !roomy && (i === 0 || i === rows.length - 1 || isHl(l)) ? val(v) : short(v, i), { bold: isHl(l), halo: true, anchor: rows.length > 1 && i === rows.length - 1 ? "end" : rows.length > 1 && i === 0 ? "start" : "middle" }) : null}
            {labelAt(i) ? word(X(i), y + h - 4, fit(l, slot * every - 4, fs), { color: isHl(l) ? ink : muted, bold: isHl(l) }) : null}
          </g>
        ))}
      </g>
    );
  }

  // pie and donut: the circle on the left (or on top when it's narrow), a legend with the shares beside it
  const pos = rows.filter(([, v]) => v > 0);
  const total = pos.reduce((t, [, v]) => t + v, 0) || 1;
  const side = w >= h * 1.25;
  const legendRows = Math.max(1, Math.floor((side ? h - 8 : h * 0.4) / (fs * 1.5)));
  const shown = pos.length > legendRows ? pos.slice(0, legendRows - 1) : pos;
  const rest = pos.length - shown.length;
  const r = side ? Math.min(h / 2 - 6, w * 0.42 / 2) : Math.min(w / 2 - 6, (h * 0.58) / 2);
  const cx = side ? x + 6 + r : x + w / 2, cy = side ? y + h / 2 : y + 6 + r;
  let a0 = -Math.PI / 2;
  const slices = pos.map(([l, v], i) => {
    const a1 = a0 + (v / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (a: number) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
    const d = pos.length === 1 ? `M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z` : `M${cx} ${cy} L${p(a0)} A${r} ${r} 0 ${large} 1 ${p(a1)} Z`;
    a0 = a1;
    const fill = isHl(l) ? accent : spec.color && !hl.size ? accent : SLICES[i % SLICES.length];
    const op = isHl(l) ? 1 : spec.color && !hl.size ? Math.max(0.2, 1 - i * 0.18) : 1;
    return { l, v, d, fill, op };
  });
  const lx = side ? cx + r + 18 * scale : x + 10, ly = side ? y + (h - Math.min(pos.length, legendRows) * fs * 1.5) / 2 + fs : cy + r + 14 + fs;
  // a compact legend: the shares stay next to their labels on a wide card
  const lw = Math.min(side ? x + w - lx : w - 20, Math.max(...pos.map(([l]) => l.length), 6) * fs * 0.5 + fs * 5);
  const share = (v: number) => `${Math.round((v / total) * 100)}%`;
  return (
    <g>
      <g filter={filter}>
        {slices.map((s, i) => <path key={i} d={s.d} fill={s.fill} fillOpacity={s.op} stroke={ink} strokeWidth={sw} strokeLinejoin="round" />)}
        {kind === "donut" ? <circle cx={cx} cy={cy} r={r * 0.52} fill={C.paper} stroke={ink} strokeWidth={sw} /> : null}
      </g>
      {kind === "donut" && show ? word(cx, cy + fs * 0.45, val(total), { size: fs * 1.25, bold: true }) : null}
      {shown.map(([l, v], i) => {
        const s = slices[i];
        const ry = ly + i * fs * 1.5;
        const tail = show ? `${share(v)}` : "";
        return (
          <g key={i}>
            <rect x={lx} y={ry - fs * 0.8} width={fs * 0.9} height={fs * 0.9} rx={2} fill={s.fill} fillOpacity={s.op} stroke={ink} strokeWidth={sw * 0.7} />
            {word(lx + fs * 1.3, ry, fit(l, lw - fs * 1.3 - (tail.length + 1) * fs * 0.5, fs), { anchor: "start", bold: isHl(l), color: isHl(l) ? ink : C.g8 })}
            {tail ? word(lx + lw - 2, ry, tail, { anchor: "end", bold: isHl(l), color: isHl(l) ? ink : C.g8 }) : null}
          </g>
        );
      })}
      {rest > 0 ? word(lx + fs * 1.3, ly + shown.length * fs * 1.5, `+${rest} more`, { anchor: "start", color: muted }) : null}
    </g>
  );
}
