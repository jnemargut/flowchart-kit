import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { fullCrop, isCrop, isPlain, normTurn, type Crop, type Orient } from "./crop";
import { renderPNG } from "./resvg";

export { isCrop, isPlain, normTurn, splitCrop, splitFix, withCrop, withOrient, type Crop, type Orient } from "./crop";

export const MIME: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

/** Width/height of a PNG or JPEG without decoding it. */
export function imageSize(buf: Buffer): { w: number; h: number } | undefined {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      i += 2 + len;
    }
  }
  return undefined;
}

/**
 * "Sketchify": grayscale → 4 tones → faint ink edges → slight wobble.
 * Teal for the product's screens; grays (ink → paper) for any other image, matching the marker style.
 */
export type BakeMode = "teal" | "grey" | "wire";
const TONES: Record<BakeMode, [string, string, string]> = {
  teal: ["0.11 0.05 0.56 0.98", "0.11 0.60 0.84 0.98", "0.12 0.65 0.86 0.97"],
  grey: ["0.11 0.45 0.76 0.98", "0.11 0.48 0.78 0.98", "0.12 0.51 0.80 0.97"],
  /** Low-fi wireframes are mostly paper, light grays and ink: a smooth ramp (paper → light teal, grays → teal tints, ink → deep teal) keeps every gray distinct. */
  wire: [
    "0.043 0.044 0.046 0.047 0.048 0.050 0.051 0.052 0.054 0.055 0.139 0.224 0.308 0.392 0.477 0.561 0.607 0.654 0.700 0.801 0.902",
    "0.310 0.343 0.375 0.408 0.441 0.473 0.506 0.539 0.571 0.604 0.643 0.682 0.721 0.761 0.800 0.839 0.856 0.873 0.890 0.925 0.961",
    "0.337 0.372 0.408 0.443 0.478 0.514 0.549 0.584 0.620 0.655 0.690 0.724 0.759 0.794 0.828 0.863 0.877 0.891 0.905 0.935 0.965",
  ],
};

export function duotoneSVG(dataUri: string, w: number, h: number, roughness = 1, mode: BakeMode = "teal"): string {
  const k = w / 180;
  const [tr, tg, tb] = TONES[mode];
  const fn = mode === "wire" ? "table" : "discrete";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<filter id="d" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
<feColorMatrix type="saturate" values="0" result="g"/>
<feComponentTransfer in="g" result="post"><feFuncR type="${fn}" tableValues="${tr}"/><feFuncG type="${fn}" tableValues="${tg}"/><feFuncB type="${fn}" tableValues="${tb}"/></feComponentTransfer>
<feConvolveMatrix in="g" order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" result="e"/>
<feColorMatrix in="e" type="matrix" values="0 0 0 0 0.11  0 0 0 0 0.11  0 0 0 0 0.12  0.3 0.3 0.3 0 0" result="lines"/>
<feMerge result="m"><feMergeNode in="post"/><feMergeNode in="lines"/></feMerge>
<feTurbulence type="fractalNoise" baseFrequency="${(0.04 / k).toFixed(4)}" numOctaves="2" seed="7" result="n"/>
<feDisplacementMap in="m" in2="n" scale="${(1.1 * k * roughness).toFixed(2)}"/>
</filter>
${mode !== "grey" ? `<rect width="100%" height="100%" fill="#fbfaf7"/>` : ""}
<image href="${dataUri}" width="${w}" height="${h}" filter="url(#d)"/>
</svg>`;
}

const MAX_BAKE_W = 720;



/** Cut a crop out of a picture's bytes. Returns PNG bytes (or the original when there's nothing to cut). */
export function cropBytes(buf: Buffer, mime: string, crop?: Crop): { buf: Buffer; mime: string } {
  if (fullCrop(crop) || !isCrop(crop)) return { buf, mime };
  const size = imageSize(buf);
  if (!size) return { buf, mime };
  const x = crop[0] * size.w, y = crop[1] * size.h, w = Math.max(1, Math.round((crop[2] - crop[0]) * size.w)), h = Math.max(1, Math.round((crop[3] - crop[1]) * size.h));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><image href="data:${mime};base64,${buf.toString("base64")}" x="${-x}" y="${-y}" width="${size.w}" height="${size.h}"/></svg>`;
  return { buf: renderPNG(svg), mime: "image/png" };
}

/** Mirror a picture left to right and/or turn it clockwise. Returns PNG bytes (or the original when it's plain). */
export function orientBytes(buf: Buffer, mime: string, o?: Orient): { buf: Buffer; mime: string } {
  if (isPlain(o)) return { buf, mime };
  const size = imageSize(buf);
  if (!size) return { buf, mime };
  const t = normTurn(o!.turn), side = t === 90 || t === 270;
  const W = side ? size.h : size.w, H = side ? size.w : size.h;
  // center the picture, turn it, mirror it (so "mirror" always means left-right as you see it)
  const tf = `translate(${W / 2} ${H / 2}) ${o!.mirror ? "scale(-1 1) " : ""}rotate(${o!.mirror ? -t : t}) translate(${-size.w / 2} ${-size.h / 2})`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g transform="${tf}"><image href="data:${mime};base64,${buf.toString("base64")}" width="${size.w}" height="${size.h}"/></g></svg>`;
  return { buf: renderPNG(svg), mime: "image/png" };
}

/** An image file, cropped and then mirrored or turned (cached next to the other baked pictures). */
export function croppedImage(absPath: string, cacheDir: string, crop?: Crop, orient?: Orient): { buf: Buffer; mime: string } {
  const mime = MIME[extname(absPath).toLowerCase()] ?? "image/png";
  const noCrop = fullCrop(crop) || !isCrop(crop);
  if (noCrop && isPlain(orient)) return { buf: readFileSync(absPath), mime };
  const st = statSync(absPath);
  const key = createHash("sha1").update(`${absPath}:${st.mtimeMs}:${st.size}:crop:${noCrop ? "" : crop!.join(",")}${orientKey(orient)}`).digest("hex").slice(0, 12);
  const out = join(cacheDir, `${basename(absPath, extname(absPath))}-crop-${key}.png`);
  if (existsSync(out)) return { buf: readFileSync(out), mime: "image/png" };
  const c = cropBytes(readFileSync(absPath), mime, crop);
  const r = orientBytes(c.buf, c.mime, orient);
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(out, r.buf);
  return r;
}

const orientKey = (o?: Orient) => (isPlain(o) ? "" : `:m${o!.mirror ? 1 : 0}:t${normTurn(o!.turn)}`);

/** Bake (or fetch from cache) the sketchified version of an image file, optionally cropped. Returns PNG bytes. Call initRenderer() first. */
export function bakeImage(absPath: string, cacheDir: string, roughness = 1, mode: BakeMode = "teal", crop?: Crop, orient?: Orient): Buffer {
  const st = statSync(absPath);
  const cropKey = (fullCrop(crop) || !isCrop(crop) ? "" : `:crop:${crop.join(",")}`) + orientKey(orient);
  const key = createHash("sha1").update(`${absPath}:${st.mtimeMs}:${st.size}:${roughness}:${mode === "teal" ? "v1" : `${mode}-v2`}${cropKey}`).digest("hex").slice(0, 12);
  const out = join(cacheDir, `${basename(absPath, extname(absPath))}-${key}.png`);
  if (existsSync(out)) return readFileSync(out);
  const src = croppedImage(absPath, cacheDir, crop, orient);
  const buf = src.buf;
  const size = imageSize(buf) ?? { w: 390, h: 844 };
  const scale = Math.min(1, MAX_BAKE_W / size.w);
  const w = Math.round(size.w * scale), h = Math.round(size.h * scale);
  const mime = src.mime;
  const png = renderPNG(duotoneSVG(`data:${mime};base64,${buf.toString("base64")}`, w, h, roughness, mode));
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(out, png);
  return png;
}
