/** Crops as fractions of a picture: [left, top, right, bottom], each 0 to 1. No Node built-ins, so editors can use it. */
export type Crop = [number, number, number, number];

export const isCrop = (c: unknown): c is Crop => Array.isArray(c) && c.length === 4 && c.every((v) => typeof v === "number" && v >= 0 && v <= 1) && c[2] > c[0] && c[3] > c[1];
export const fullCrop = (c?: Crop) => !c || (c[0] <= 0 && c[1] <= 0 && c[2] >= 1 && c[3] >= 1);

/** A picture path with its crop riding along ("photo.jpg|crop=0,0.1,1,0.6"), for kits whose resolvers only take a path. */
export const withCrop = (p: string, crop?: unknown) => (isCrop(crop) && !fullCrop(crop) ? `${p}|crop=${crop.join(",")}` : p);

export function splitCrop(p: string): { path: string; crop?: Crop } {
  const i = p.indexOf("|crop=");
  if (i < 0) return { path: p };
  const c = p.slice(i + 6).split(",").map(Number);
  return { path: p.slice(0, i), crop: isCrop(c) ? c : undefined };
}
