/**
 * The marker wobble: fractal noise nudging every line a little, so straight SVG reads as hand drawn.
 * Pin the region in user space (x/y/width/height) when art can reach past its box: a filter region
 * hanging off the canvas crashes resvg. Leave it out for a region relative to the shape.
 */
export function WobbleFilter({ id, region, scale = 1.6, frequency = 0.035 }: { id: string; region?: { x: number; y: number; width: number; height: number } | "page"; scale?: number; frequency?: number }) {
  const area = region === "page" ? { x: "-2%", y: "-10%", width: "104%", height: "120%" }
    : region ? { filterUnits: "userSpaceOnUse" as const, ...region }
    : { x: "-5%", y: "-5%", width: "110%", height: "110%" };
  return (
    <filter id={id} {...area}>
      <feTurbulence type="fractalNoise" baseFrequency={String(frequency)} numOctaves={2} seed={7} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    </filter>
  );
}
