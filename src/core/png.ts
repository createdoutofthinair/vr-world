import pako from "pako";
const { deflate } = pako;
export interface PixelImage {
  width: number;
  height: number;
  pixels: Uint8Array;
}
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name: string, data: Uint8Array) {
  const out = new Uint8Array(data.length + 12),
    view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(name), 4);
  out.set(data, 8);
  view.setUint32(data.length + 8, crc(out.subarray(4, data.length + 8)));
  return out;
}
export function encodePNG(image: PixelImage): Uint8Array {
  const { width, height, pixels } = image;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1024 ||
    height > 1024 ||
    pixels.length !== width * height * 4
  )
    throw new Error("Invalid RGBA image.");
  const ihdr = new Uint8Array(13),
    view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const scan = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    scan.set(
      pixels.subarray(y * width * 4, (y + 1) * width * 4),
      y * (width * 4 + 1) + 1,
    );
  const chunks = [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflate(scan)),
      chunk("IEND", new Uint8Array()),
    ],
    out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}
export function dataURL(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192)
    s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return "data:image/png;base64," + btoa(s);
}
export function decodePNG(bytes: Uint8Array): PixelImage {
  if (
    bytes.length < 33 ||
    bytes[0] !== 137 ||
    String.fromCharCode(...bytes.subarray(1, 4)) !== "PNG"
  )
    throw new Error("Invalid PNG signature.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    width = view.getUint32(16),
    height = view.getUint32(20),
    depth = bytes[24],
    type = bytes[25];
  if (
    width < 1 ||
    height < 1 ||
    width > 1024 ||
    height > 1024 ||
    depth !== 8 ||
    ![0, 2, 4, 6].includes(type) ||
    bytes[28] !== 0
  )
    throw new Error(
      "Unsupported normalized PNG. Use non-interlaced 8-bit RGB/RGBA.",
    );
  const parts: Uint8Array[] = [];
  for (let at = 8; at + 12 <= bytes.length;) {
    const n = view.getUint32(at),
      name = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (at + 12 + n > bytes.length) throw new Error("Truncated PNG chunk.");
    if (crc(bytes.subarray(at + 4, at + 8 + n)) !== view.getUint32(at + 8 + n))
      throw new Error("PNG chunk checksum mismatch.");
    if (name === "IDAT") parts.push(bytes.subarray(at + 8, at + 8 + n));
    at += 12 + n;
  }
  const packed = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    packed.set(p, at);
    at += p.length;
  }
  const channels = type === 6 ? 4 : type === 2 ? 3 : type === 4 ? 2 : 1,
    stride = width * channels,
    limit = (stride + 1) * height,
    inflater = new pako.Inflate(),
    decoded: Uint8Array[] = [];
  let total = 0;
  inflater.onData = (chunk) => {
    total += chunk.length;
    if (total > limit)
      throw new Error("PNG expands beyond its declared dimensions.");
    decoded.push(chunk);
  };
  inflater.push(packed, true);
  if (inflater.err) throw new Error(`Invalid PNG compression: ${inflater.msg}`);
  const raw = new Uint8Array(total);
  let offset = 0;
  for (const chunk of decoded) {
    raw.set(chunk, offset);
    offset += chunk.length;
  }
  if (raw.length !== (stride + 1) * height)
    throw new Error("Invalid PNG scan length.");
  const rows = new Uint8Array(stride * height),
    pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    if (filter > 4) throw new Error("Invalid PNG filter.");
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? rows[y * stride + x - channels] : 0,
        up = y ? rows[(y - 1) * stride + x] : 0,
        diagonal =
          y && x >= channels ? rows[(y - 1) * stride + x - channels] : 0;
      const p = left + up - diagonal,
        pa = Math.abs(p - left),
        pb = Math.abs(p - up),
        pc = Math.abs(p - diagonal),
        predict = pa <= pb && pa <= pc ? left : pb <= pc ? up : diagonal;
      rows[y * stride + x] =
        (raw[y * (stride + 1) + 1 + x] +
          (filter === 0
            ? 0
            : filter === 1
              ? left
              : filter === 2
                ? up
                : filter === 3
                  ? Math.floor((left + up) / 2)
                  : predict)) &
        255;
    }
  }
  for (let i = 0; i < width * height; i++) {
    const s = i * channels,
      t = i * 4;
    pixels[t] = rows[s];
    pixels[t + 1] = type === 0 || type === 4 ? rows[s] : rows[s + 1];
    pixels[t + 2] = type === 0 || type === 4 ? rows[s] : rows[s + 2];
    pixels[t + 3] = type === 6 ? rows[s + 3] : type === 4 ? rows[s + 1] : 255;
  }
  return { width, height, pixels };
}
