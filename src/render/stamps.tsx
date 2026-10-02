/**
 * Stamps: little marker icons you drop on anything. Drawn on a 48×48 grid in the kits' style (ink outlines,
 * a fill sitting slightly off the line). The cursor is orange, like every gesture in the kits.
 */
import type { ReactNode } from "react";
import { C, MARKER } from "../../vendor/sketch/tokens";

const Y = "#ffd43b", R = MARKER.red, G = MARKER.green;
const ink = { stroke: C.ink, strokeWidth: 2.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** A filled shape, the fill nudged off the outline like a marker. */
const Two = ({ d, fill }: { d: string; fill: string }) => <g><path d={d} fill={fill} transform="translate(1.8 1.6)" /><path d={d} fill="none" {...ink} /></g>;
const face = (mouth: string, fill: string) => (
  <g>
    <circle cx={25.8} cy={25.6} r={19} fill={fill} />
    <circle cx={24} cy={24} r={19} fill="none" {...ink} />
    <circle cx={17.5} cy={20} r={2.4} fill={C.ink} /><circle cx={30.5} cy={20} r={2.4} fill={C.ink} />
    <path d={mouth} fill="none" {...ink} />
  </g>
);

export const STAMP_ART: Record<string, ReactNode> = {
  cursor: <g><Two d="M13 6 L13 38 L21 30.5 L27 43 L33 40 L27 27.5 L38 27.5 Z" fill={C.action} /></g>,
  star: <Two d="M24 5 L29.6 17.6 L43 18.9 L32.8 27.9 L35.8 41.2 L24 34.2 L12.2 41.2 L15.2 27.9 L5 18.9 L18.4 17.6 Z" fill={Y} />,
  smiley: face("M15.5 28 Q24 37 32.5 28", Y),
  meh: face("M16 31 L32 31", "#ffe8a3"),
  frown: face("M15.5 34 Q24 26 32.5 34", "#ffc9c9"),
  heart: <Two d="M24 41 C10 31 5 23 7.5 15.5 C10 8.5 19.5 8 24 15 C28.5 8 38 8.5 40.5 15.5 C43 23 38 31 24 41 Z" fill={R} />,
  "thumbs-up": <g><Two d="M8 22 L15 22 L15 41 L8 41 Z" fill={C.g4} /><Two d="M15 23 L22 10 C25 8 28 10 27 14 L25.5 20 L37 20 C41 20 42 24 40.5 26.5 C42 29 41 31.5 39 32.5 C40 35 38.5 37.5 36 38 C36.5 40.5 34.5 41.5 32 41.5 L15 41.5" fill={Y} /></g>,
  "thumbs-down": <g transform="rotate(180 24 24)"><Two d="M8 22 L15 22 L15 41 L8 41 Z" fill={C.g4} /><Two d="M15 23 L22 10 C25 8 28 10 27 14 L25.5 20 L37 20 C41 20 42 24 40.5 26.5 C42 29 41 31.5 39 32.5 C40 35 38.5 37.5 36 38 C36.5 40.5 34.5 41.5 32 41.5 L15 41.5" fill="#ffc9c9" /></g>,
  question: <g><circle cx={25.8} cy={25.6} r={19} fill="#d0ebff" /><circle cx={24} cy={24} r={19} fill="none" {...ink} /><path d="M18 18.5 C18 11 30 11 30 18.5 C30 23.5 24 23.5 24 29" fill="none" {...ink} strokeWidth={3.2} /><circle cx={24} cy={35.5} r={2.4} fill={C.ink} /></g>,
  alert: <g><Two d="M24 5 L44 40 L4 40 Z" fill={Y} /><path d="M24 17 L24 28" {...ink} strokeWidth={3.4} /><circle cx={24} cy={34} r={2.4} fill={C.ink} /></g>,
  check: <g><circle cx={25.8} cy={25.6} r={19} fill="#b2f2bb" /><circle cx={24} cy={24} r={19} fill="none" {...ink} /><path d="M14 24.5 L21.5 32 L34.5 16.5" fill="none" {...ink} stroke={G} strokeWidth={4} /></g>,
  cross: <g><circle cx={25.8} cy={25.6} r={19} fill="#ffc9c9" /><circle cx={24} cy={24} r={19} fill="none" {...ink} /><path d="M16 16 L32 32 M32 16 L16 32" {...ink} stroke={R} strokeWidth={4} /></g>,
  idea: <g><Two d="M24 5 C14 5 9 12.5 9 19 C9 25.5 15 28.5 16.5 33.5 L31.5 33.5 C33 28.5 39 25.5 39 19 C39 12.5 34 5 24 5 Z" fill={Y} /><path d="M17.5 38 L30.5 38 M19.5 42.5 L28.5 42.5 M24 33 L24 22 M20 19 L24 23 L28 19" fill="none" {...ink} strokeWidth={2.2} /></g>,
  flag: <g><path d="M11 5 L11 44" {...ink} strokeWidth={3} /><Two d="M11 7 C18 3 24 11 31 7 C34 5.5 37 6 39 7 L39 25 C32 21.5 26 29 19 25.5 C15.5 24 13 24.5 11 25.5" fill={R} /></g>,
  clock: <g><circle cx={25.8} cy={25.6} r={19} fill={C.g1} /><circle cx={24} cy={24} r={19} fill="none" {...ink} /><path d="M24 12 L24 24 L32 29" fill="none" {...ink} strokeWidth={3} /></g>,
  eye: <g><Two d="M3 24 C12 10 36 10 45 24 C36 38 12 38 3 24 Z" fill="#fff" /><circle cx={24} cy={24} r={7.5} fill={C.g7} stroke={C.ink} strokeWidth={2.4} /><circle cx={24} cy={24} r={3} fill={C.ink} /></g>,
  fire: <Two d="M24 44 C13 44 8 36.5 9.5 28 C11 20 18 17 17.5 7 C24 10 28 16 27.5 22.5 C30 20.5 31.5 17.5 31.5 14 C37 19 40 25 39 31 C38 38.5 32 44 24 44 Z" fill="#ff922b" />,
  dollar: <g><circle cx={25.8} cy={25.6} r={19} fill="#b2f2bb" /><circle cx={24} cy={24} r={19} fill="none" {...ink} /><path d="M30 16.5 C28 13.5 18 13 18 19 C18 25 30 22.5 30 29 C30 35 20 34.5 17.5 31.5 M24 10.5 L24 37.5" fill="none" {...ink} strokeWidth={2.8} /></g>,
};

/** A stamp at (x, y), s px square. Unknown names draw a question mark. */
export function Stamp({ icon, x, y, s }: { icon?: string; x: number; y: number; s: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s / 48})`}>{STAMP_ART[icon ?? ""] ?? STAMP_ART.question}</g>;
}
