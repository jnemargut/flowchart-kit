/** Crops as fractions of a picture: [left, top, right, bottom], each 0 to 1. No Node built-ins, so editors can use it. */
export type Crop = [number, number, number, number];

export const isCrop = (c: unknown): c is Crop => Array.isArray(c) && c.length === 4 && c.every((v) => typeof v === "number" && v >= 0 && v <= 1) && c[2] > c[0] && c[3] > c[1];
export const fullCrop = (c?: Crop) => !c || (c[0] <= 0 && c[1] <= 0 && c[2] >= 1 && c[3] >= 1);

/** A picture path with its crop riding along ("photo.jpg|crop=0,0.1,1,0.6"), for kits whose resolvers only take a path. */
export const withCrop = (p: string, crop?: unknown) => (isCrop(crop) && !fullCrop(crop) ? `${p}|crop=${crop.join(",")}` : p);

export function splitCrop(p: string): { path: string; crop?: Crop } {
  const { path, crop } = splitFix(p);
  return { path, crop };
}

/** Mirror and turn: flip a picture left to right, and turn it clockwise in quarter turns. Applied after the crop. */
export interface Orient { mirror?: boolean; turn?: number }
export const TURNS = [0, 90, 180, 270] as const;
/** 0, 90, 180 or 270 (anything else rounds to the nearest quarter turn). */
export const normTurn = (t: unknown): number => (typeof t === "number" && isFinite(t) ? (((Math.round(t / 90) * 90) % 360) + 360) % 360 : 0);
export const isPlain = (o?: Orient) => !o || (!o.mirror && !normTurn(o.turn));
/** A picture path with its mirror/turn riding along, after any crop ("photo.jpg|crop=…|mirror|turn=90"). */
export const withOrient = (p: string, o?: Orient) => (isPlain(o) ? p : `${p}${o!.mirror ? "|mirror" : ""}${normTurn(o!.turn) ? `|turn=${normTurn(o!.turn)}` : ""}`);
/** Split a path with a crop and/or mirror/turn riding along. */
export function splitFix(p: string): { path: string; crop?: Crop; orient?: Orient } {
  const parts = p.split("|");
  let crop: Crop | undefined;
  const orient: Orient = {};
  for (const x of parts.slice(1)) {
    if (x.startsWith("crop=")) { const c = x.slice(5).split(",").map(Number); if (isCrop(c)) crop = c; }
    else if (x === "mirror") orient.mirror = true;
    else if (x.startsWith("turn=")) orient.turn = normTurn(Number(x.slice(5)));
  }
  return { path: parts[0], crop, orient: isPlain(orient) ? undefined : orient };
}
