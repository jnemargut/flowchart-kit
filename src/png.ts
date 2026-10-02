/**
 * Flowchart PNGs carry their source: an iTXt chunk ("flowchart-kit") holding the file name, the frame and the
 * whole flowchart JSON. Any image viewer shows the picture; Flowchart Kit can read it back.
 */
const KEY = "flowchart-kit";

let table: Uint32Array | undefined;
function crc32(buf: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
  }
  let c = 0xffffffff;
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export interface Embedded { file: string; frame?: string; source: unknown }

/** Add the source after the PNG header. */
export function embedSource(png: Buffer, meta: Embedded): Buffer {
  const text = Buffer.from(JSON.stringify(meta), "utf8");
  // iTXt: keyword \0 compression-flag compression-method language \0 translated \0 text
  const data = Buffer.concat([Buffer.from(KEY, "latin1"), Buffer.from([0, 0, 0, 0, 0]), text]);
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  return Buffer.concat([png.subarray(0, ihdrEnd), chunk("iTXt", data), png.subarray(ihdrEnd)]);
}

/** Read the source back out (undefined if the PNG wasn't made by Flowchart Kit). */
export function readSource(png: Buffer): Embedded | undefined {
  let i = 8;
  while (i + 8 <= png.length) {
    const len = png.readUInt32BE(i);
    const type = png.toString("latin1", i + 4, i + 8);
    if (type === "iTXt") {
      const data = png.subarray(i + 8, i + 8 + len);
      const z = data.indexOf(0);
      if (data.toString("latin1", 0, z) === KEY) {
        let p = z + 3; // flag, method
        p = data.indexOf(0, p) + 1; // language
        p = data.indexOf(0, p) + 1; // translated keyword
        try { return JSON.parse(data.subarray(p).toString("utf8")); } catch { return undefined; }
      }
    }
    if (type === "IEND") break;
    i += 12 + len;
  }
  return undefined;
}
