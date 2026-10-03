import { isHex, normHex } from "../vendor/sketch/tokens";
import { mkdirSync, readFileSync } from "node:fs";
import { plainText } from "../vendor/sketch/rich";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { PDFDocument } from "pdf-lib";
import { bakeImage, croppedImage } from "../vendor/sketch/bake";
import { drawingFonts, fontFaceCss } from "../vendor/sketch/fonts";
import { initRenderer, renderPNG } from "../vendor/sketch/resvg";
import { resolveCards } from "./cards";
import { homeFrame, layoutBoard, slides, type BoardLayout } from "./layout";
import { embedSource } from "./png";
import { boardSVG } from "./render/board";
import { typeOf, type CardInfo, type Cards, type FlowchartFile } from "./types";

export { initRenderer };

export const cacheDirFor = (file: string) => join(dirname(resolve(file)), ".flowchart-cache");
export const stemOf = (file: string) => basename(file).replace(/\.flowchart\.json$|\.json$/, "");
export function ensureDir(p: string) { mkdirSync(p, { recursive: true }); return p; }

/** Card pictures as data URIs: kit renders as they are, other images sketchified in grays to match (unless `"sketch": false`). */
export function cardHrefs(file: string, doc?: FlowchartFile) {
  const memo = new Map<string, string | undefined>();
  return (id: string, info: CardInfo) => {
    if (!info.png) return undefined;
    const raw = info.kind !== "image" || doc?.nodes[id]?.sketch === false;
    const crop = doc?.nodes[id]?.crop;
    const k = `${info.png}:${raw}:${crop?.join(",") ?? ""}`;
    if (memo.has(k)) return memo.get(k);
    let uri: string | undefined;
    try {
      const pic = raw ? croppedImage(info.png, cacheDirFor(file), crop) : { buf: bakeImage(info.png, cacheDirFor(file), 1, "grey", crop), mime: "image/png" };
      uri = `data:${pic.mime};base64,${pic.buf.toString("base64")}`;
    } catch { uri = undefined; }
    memo.set(k, uri);
    return uri;
  };
}

/** Everything an export needs, worked out once. */
export function prepare(doc: FlowchartFile, file: string, cards?: Cards) {
  const c = cards ?? resolveCards(doc, file);
  return { cards: c, L: layoutBoard(doc, c), cardHref: cardHrefs(file, doc) };
}

const png = (svg: string, scale: number) => renderPNG(svg, { scale, fonts: drawingFonts() });

/** The whole board (or one frame) as a PNG, with the board's source tucked inside. */
export function boardPNG(doc: FlowchartFile, file: string, o: { scale?: number; frame?: string; prep?: ReturnType<typeof prepare> } = {}): Buffer {
  const p = o.prep ?? prepare(doc, file);
  const out = png(boardSVG(doc, { ...p, frame: o.frame }), o.scale ?? 1.5);
  return embedSource(out, { file: basename(file), frame: o.frame, source: doc });
}

/** Just a region of the board (what's selected in the editor), for copying as a picture. */
export function regionPNG(doc: FlowchartFile, file: string, box: { x: number; y: number; w: number; h: number }, scale = 2): Buffer {
  const p = prepare(doc, file);
  return png(boardSVG(doc, { ...p, box }), scale);
}

export const boardSVGFile = (doc: FlowchartFile, file: string, frame?: string) => boardSVG(doc, { ...prepare(doc, file), frame, fontCss: fontFaceCss() });

/** A PDF: the whole board first, then one page per slide. */
export async function toPDF(doc: FlowchartFile, file: string): Promise<Uint8Array> {
  const p = prepare(doc, file);
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  const add = async (img: Buffer) => {
    const w = img.readUInt32BE(16) / 2, h = img.readUInt32BE(20) / 2;
    const e = await pdf.embedPng(img);
    const page = pdf.addPage([w * 0.75, h * 0.75]);
    page.drawImage(e, { x: 0, y: 0, width: w * 0.75, height: h * 0.75 });
  };
  await add(png(boardSVG(doc, p), 2));
  if (Object.keys(doc.frames ?? {}).length) for (const s of slides(doc, p.L)) await add(png(boardSVG(doc, { ...p, frame: s.id }), 2));
  return pdf.save();
}

/** A deck: one slide per frame in presenting order, with each frame's notes as speaker notes. */
export async function toPPTX(doc: FlowchartFile, file: string): Promise<Buffer> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const p = prepare(doc, file);
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = doc.title;
  const W = 13.333, H = 7.5, m = 0.35, head = 0.85;
  for (const s of slides(doc, p.L)) {
    const img = png(boardSVG(doc, { ...p, frame: s.id || undefined }), 2);
    const iw = img.readUInt32BE(16), ih = img.readUInt32BE(20);
    const k = Math.min((W - m * 2) / iw, (H - head - m) / ih);
    const slide = pptx.addSlide();
    slide.background = { color: "FBFAF7" };
    slide.addText(plainText(s.title || doc.title), { x: m, y: 0.2, w: W - m * 2, h: 0.55, fontFace: "Permanent Marker", fontSize: 26, color: "1C1C1E" });
    slide.addImage({ data: `data:image/png;base64,${img.toString("base64")}`, x: (W - iw * k) / 2, y: head + (H - head - m - ih * k) / 2, w: iw * k, h: ih * k });
    const notes = s.id ? doc.frames?.[s.id]?.notes : undefined;
    if (notes) slide.addNotes(plainText(notes));
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

const CANVAS_COLOR: Record<string, string> = { yellow: "3", pink: "1", blue: "5", green: "4" };

/** JSON Canvas (jsoncanvas.org), so the board opens in Obsidian and other canvas apps. Cards become file nodes. */
export function toJSONCanvas(doc: FlowchartFile, file: string, outDir: string, L?: BoardLayout): string {
  const cards = resolveCards(doc, file, { refresh: false });
  const lay = L ?? layoutBoard(doc, cards);
  const r = Math.round;
  const nodes: Record<string, unknown>[] = [];
  for (const f of Object.values(lay.frames)) if (!f.loose) nodes.push({ id: `frame-${f.id}`, type: "group", x: r(f.x), y: r(f.y), width: r(f.w), height: r(f.h), label: f.title });
  for (const b of Object.values(lay.nodes)) {
    const n = doc.nodes[b.id];
    const base = { id: b.id, x: r(b.x), y: r(b.y), width: r(b.w), height: r(b.h) };
    const t = typeOf(n);
    if (t === "card" && cards[b.id]?.png) nodes.push({ ...base, type: "file", file: relative(outDir, cards[b.id].png!).split(sep).join("/") });
    else if (t === "link" && n.url) nodes.push({ ...base, type: "link", url: n.url });
    else if (t === "stamp") nodes.push({ ...base, type: "text", text: `(${n.icon ?? "stamp"})` });
    else nodes.push({ ...base, type: "text", text: t === "diamond" ? `${n.text ?? ""}?`.replace(/\?\?$/, "?") : t === "card" ? n.ref ?? "" : n.text ?? "", ...(t === "sticky" && isHex(n.color) ? { color: normHex(n.color!) } : t !== "sticky" && isHex(n.fill) ? { color: normHex(n.fill!) } : t === "sticky" && CANVAS_COLOR[n.color ?? "yellow"] ? { color: CANVAS_COLOR[n.color ?? "yellow"] } : n.product ? { color: "5" } : {}) });
  }
  const edges = (doc.links ?? []).filter((l) => lay.nodes[l.from] && lay.nodes[l.to]).map((l, i) => ({ id: `link-${i}`, fromNode: l.from, toNode: l.to, toEnd: "arrow", ...(l.label ? { label: l.label } : {}) }));
  return JSON.stringify({ nodes, edges }, null, 2) + "\n";
}

/** Which frame each node is in, for pointers ("In x.flowchart.json, frame "late", step "…""). */
export const frameOfNode = homeFrame;
