import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Where the marker fonts live: next to the bundled script in an installed skill (scripts/../assets/fonts),
 * or in this folder during development.
 */
export const FONT_DIR = (() => {
  const bundled = fileURLToPath(new URL("../assets/fonts/", import.meta.url));
  return existsSync(join(bundled, "PatrickHand-Regular.ttf")) ? bundled : fileURLToPath(new URL("./fonts/", import.meta.url));
})();

/** The fonts drawings use, plus their licences (copied into each skill's assets/fonts). */
export const DRAWING_FONTS = ["PermanentMarker-Regular.ttf", "PatrickHand-Regular.ttf"];
export const FONT_LICENSES = ["LICENSE-Apache-PermanentMarker.txt", "OFL-PatrickHand.txt"];

let buffers: Uint8Array[] | undefined;
/** Font buffers for resvg. */
export const drawingFonts = () => (buffers ??= DRAWING_FONTS.map((f) => readFileSync(join(FONT_DIR, f))));

/** @font-face rules with the fonts inlined, for standalone SVG and HTML. */
export function fontFaceCss(): string {
  const face = (family: string, file: string) =>
    `@font-face{font-family:"${family}";src:url(data:font/ttf;base64,${readFileSync(join(FONT_DIR, file)).toString("base64")}) format("truetype");}`;
  return face("Permanent Marker", "PermanentMarker-Regular.ttf") + face("Patrick Hand", "PatrickHand-Regular.ttf");
}
