/**
 * A small JSON note inside a PNG (an iTXt chunk), so a picture copied out of one kit can be recognized when it's
 * pasted into another: "this is panel in-line of late-latte.storyboard.json". Image viewers ignore it.
 */
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

const isPNG = (b: Buffer) => b.length > 33 && b.readUInt32BE(0) === 0x89504e47;

/** Add `meta` under `key`, right after the PNG header. */
export function embedMeta(png: Buffer, key: string, meta: unknown): Buffer {
  if (!isPNG(png)) return png;
  const data = Buffer.concat([Buffer.from(key, "latin1"), Buffer.from([0, 0, 0, 0, 0]), Buffer.from(JSON.stringify(meta), "utf8")]);
  const ihdrEnd = 8 + 4 + 4 + 13 + 4;
  return Buffer.concat([png.subarray(0, ihdrEnd), chunk("iTXt", data), png.subarray(ihdrEnd)]);
}

/** Read the note stored under `key` (undefined if there isn't one). */
export function readMeta<T = unknown>(png: Buffer, key: string): T | undefined {
  if (!isPNG(png)) return undefined;
  let i = 8;
  while (i + 8 <= png.length) {
    const len = png.readUInt32BE(i);
    const type = png.toString("latin1", i + 4, i + 8);
    if (type === "iTXt") {
      const data = png.subarray(i + 8, i + 8 + len);
      const z = data.indexOf(0);
      if (data.toString("latin1", 0, z) === key) {
        let p = z + 3;
        p = data.indexOf(0, p) + 1;
        p = data.indexOf(0, p) + 1;
        try { return JSON.parse(data.subarray(p).toString("utf8")) as T; } catch { return undefined; }
      }
    }
    if (type === "IEND") break;
    i += 12 + len;
  }
  return undefined;
}
