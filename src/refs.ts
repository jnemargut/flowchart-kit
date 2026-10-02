/** Card references ("./x.storyboard.json#panel"): which file, which part, which kit. No Node built-ins, so the editor can use it too. */
import type { CardInfo } from "./types";

export type Kind = CardInfo["kind"];
const IMAGE = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

export function parseRef(ref: string): { file: string; part?: string; kind: Kind | undefined } {
  const i = ref.indexOf("#");
  const file = i < 0 ? ref : ref.slice(0, i);
  const part = i < 0 ? undefined : ref.slice(i + 1) || undefined;
  const ext = (/\.[^./]+$/.exec(file)?.[0] ?? "").toLowerCase();
  const kind: Kind | undefined = /\.storyboard\.json$/.test(file) ? "storyboard" : /\.wireframe\.json$/.test(file) ? "wireframe" : IMAGE.includes(ext) ? "image" : undefined;
  return { file, part, kind };
}
