import { plainText } from "../vendor/sketch/rich";
import { HAND_AVG, HAND_WIDTHS, TITLE_AVG, TITLE_WIDTHS } from "./metrics";

export type Face = "hand" | "title";

/** Width of a single line of text in px. Same answer in Node, the browser and resvg. **Markers** take no room. */
export function textWidth(src: string, face: Face, size: number): number {
  const s = plainText(src);
  const table = face === "title" ? TITLE_WIDTHS : HAND_WIDTHS;
  const avg = face === "title" ? TITLE_AVG : HAND_AVG;
  let w = 0;
  for (const ch of s) w += table[ch] ?? avg;
  return w * size;
}

/** Greedy word wrap of the plain words (style them again with richLines). Words longer than the line are broken. */
export function wrap(src: string, face: Face, size: number, maxW: number): string[] {
  const s = plainText(src);
  if (!s) return [];
  const out: string[] = [];
  for (const para of String(s).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (textWidth(next, face, size) <= maxW || !line) {
        if (!line && textWidth(word, face, size) > maxW) {
          // break a very long word
          let chunk = "";
          for (const ch of word) {
            if (textWidth(chunk + ch, face, size) > maxW && chunk) { out.push(chunk); chunk = ""; }
            chunk += ch;
          }
          line = chunk;
        } else line = next;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/** Trim a line to fit with an ellipsis. */
export function fit(src: string, face: Face, size: number, maxW: number): string {
  const s = plainText(src);
  if (textWidth(s, face, size) <= maxW) return s;
  let out = s;
  while (out.length > 1 && textWidth(out + "…", face, size) > maxW) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}
