import type { Result } from "../../vendor/sketch/suggest";
import type { Cards, FlowchartFile } from "../types";

export interface Loaded { doc: FlowchartFile; version: number; file?: string; result: Result; cards: Cards }
export interface Nearby { items: { ref: string; kind: "storyboard" | "wireframe"; title: string; parts: { id: string; title: string }[] }[]; kits: { storyboard: boolean; wireframe: boolean } }

const H = { "content-type": "application/json", "x-flowchart": "1" };

async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json() as Promise<T>;
}

export const api = {
  load: () => fetch("/api/file").then((r) => ok<Loaded>(r)),
  put: (doc: FlowchartFile) => fetch("/api/file", { method: "PUT", headers: H, body: JSON.stringify(doc) }).then((r) => ok<Loaded>(r)),
  find: (file: string) => fetch(`/api/find?file=${encodeURIComponent(file)}`).then((r) => ok<{ ref: string | null }>(r)),
  nearby: () => fetch("/api/nearby").then((r) => ok<Nearby>(r)),
  openCard: (ref: string) => fetch(`/api/open-card?ref=${encodeURIComponent(ref)}`, { method: "POST", headers: H }).then((r) => ok<{ ok?: boolean; error?: string }>(r)),
  upload: (file: File) =>
    fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "x-flowchart": "1" }, body: file }).then((r) => ok<{ path?: string; ref?: string }>(r)),
};

/** A card's picture, served (and kept fresh) by the dev server. */
export const cardUrl = (bust: number) => (id: string) => `/card/${encodeURIComponent(id)}?v=${bust}`;
