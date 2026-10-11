import {
  MaterialRole,
  MaterialSpec,
  Project,
  random,
  TextureAsset,
} from "./project";
import { standardImage } from "./standard-textures";
const proceduralCache = new Map<string, string>();

export function textureImage(spec: MaterialSpec, project: Project): string {
  const custom = project.textures[spec.role];
  if (custom) return custom.dataUrl;
  const standard = standardImage(spec, project);
  if (standard) return standard;
  const cacheKey = JSON.stringify([
    project.seed,
    spec.role,
    spec.pattern,
    spec.role === "sign" ? project.sign : "",
  ]);
  const cached = proceduralCache.get(cacheKey);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = spec.role === "sign" ? 1024 : 256;
  canvas.height = spec.role === "sign" ? 128 : 256;
  const c = canvas.getContext("2d")!;
  c.fillStyle = spec.role === "sign" ? "#173126" : "#ffffff";
  c.fillRect(0, 0, canvas.width, canvas.height);
  const r = random(project.seed + spec.role.length * 123);
  if (spec.pattern !== "solid" && spec.role !== "sign") {
    const size = 256,
      img = c.createImageData(size, size);
    const grids = [4, 8, 16, 32].map((n) => ({
      n,
      values: Array.from({ length: n * n }, r),
    }));
    const noise = (x: number, y: number, g: (typeof grids)[number]) => {
      const xx = (x / size) * g.n,
        yy = (y / size) * g.n,
        ix = Math.floor(xx),
        iy = Math.floor(yy),
        fx = xx - ix,
        fy = yy - iy;
      const u = fx * fx * (3 - 2 * fx),
        v = fy * fy * (3 - 2 * fy),
        at = (a: number, b: number) =>
          g.values[(((b % g.n) + g.n) % g.n) * g.n + (((a % g.n) + g.n) % g.n)];
      return (
        (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) +
        (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v
      );
    };
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const n = grids.reduce(
          (v, g, i) => v + noise(x, y, g) * 0.5 ** (i + 1),
          0,
        );
        const amplitude =
          spec.pattern === "soil"
            ? 90
            : spec.pattern === "stone"
              ? 65
              : spec.pattern === "bark"
                ? 80
                : spec.pattern === "sand"
                  ? 42
                  : 28;
        let value = 239 - amplitude * (1 - n) + (r() - 0.5) * 16;
        if (spec.pattern === "bark")
          value -=
            Math.pow(
              Math.max(
                0,
                Math.sin(x * 0.24 + Math.sin(y * 0.055) * 1.4 + n * 3),
              ),
              8,
            ) * 48;
        if (spec.pattern === "wood")
          value -=
            Math.pow(
              Math.max(0, Math.sin(y * 0.31 + Math.sin(x * 0.025) * 2 + n)),
              12,
            ) * 25;
        if (spec.pattern === "sand")
          value -= Math.sin(y * 0.17 + Math.sin(x * 0.022) * 3) * 6;
        const i = (y * size + x) * 4;
        img.data[i] = value;
        img.data[i + 1] = value;
        img.data[i + 2] = value;
        img.data[i + 3] = 255;
      }
    c.putImageData(img, 0, 0);
  }
  if (spec.pattern === "wood") {
    for (let y = 0; y < 256; y += 42) {
      c.fillStyle = "rgba(30,25,20,.32)";
      c.fillRect(0, y, 256, 2);
      c.fillStyle = "rgba(255,255,255,.18)";
      c.fillRect(0, y + 2, 256, 1);
    }
  }
  if (
    spec.pattern === "brick" ||
    spec.pattern === "tiles" ||
    spec.pattern === "panels"
  ) {
    const brick = spec.pattern === "brick",
      tile = spec.pattern === "tiles",
      hh = brick ? 32 : tile ? 32 : 128,
      ww = brick ? 80 : tile ? 48 : 128;
    c.fillStyle = brick ? "rgba(235,231,214,.88)" : "rgba(32,36,37,.38)";
    for (let y = 0; y < 256; y += hh) {
      c.fillRect(0, y, 256, brick ? 3 : 2);
      for (let x = (y / hh) % 2 && brick ? -ww / 2 : 0; x < 256; x += ww) {
        c.fillRect(x, y, brick ? 3 : 2, hh);
        if (spec.pattern === "panels") {
          c.fillStyle = "rgba(30,35,40,.22)";
          c.fillRect(x + 8, y + 8, 3, 3);
          c.fillRect(x + ww - 11, y + hh - 11, 3, 3);
        }
      }
    }
  }
  if (spec.pattern === "leaf") {
    const g = c.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "#b5b9a5");
    g.addColorStop(0.48, "#eff0cf");
    g.addColorStop(0.52, "#d7ddbd");
    g.addColorStop(1, "#b1b89d");
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = "rgba(255,255,218,.32)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(128, 0);
    c.lineTo(128, 256);
    c.stroke();
    c.lineWidth = 1;
    for (let y = 24; y < 256; y += 25)
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(128, y);
        c.quadraticCurveTo(128 + side * 48, y + 4, 128 + side * 116, y + 49);
        c.stroke();
      }
  }
  if (spec.pattern === "fabric") {
    c.strokeStyle = "rgba(70,60,45,.13)";
    c.lineWidth = 1;
    for (let i = 0; i < 256; i += 4) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i, 256);
      c.moveTo(0, i);
      c.lineTo(256, i);
      c.stroke();
    }
  }
  if (spec.role === "sign") {
    c.strokeStyle = "#b6ed84";
    c.lineWidth = 2;
    c.strokeRect(9, 9, 1006, 110);
    c.fillStyle = "#e8f3e1";
    c.font = "bold 54px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(project.sign, 512, 64, 940);
  }
  const result = canvas.toDataURL("image/png");
  proceduralCache.set(cacheKey, result);
  if (proceduralCache.size > 64)
    proceduralCache.delete(proceduralCache.keys().next().value!);
  return result;
}
export async function readTexture(file: File): Promise<TextureAsset> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Use a PNG, JPG, or WebP image.");
  if (file.size > 8_000_000)
    throw new Error("Texture uploads must be smaller than 8 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (
      image.width > 8192 ||
      image.height > 8192 ||
      image.width < 1 ||
      image.height < 1
    )
      throw new Error("Image dimensions must be 1–8192 pixels.");
    const scale = Math.min(1, 1024 / Math.max(image.width, image.height)),
      width = Math.max(1, Math.round(image.width * scale)),
      height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length > 2_000_000)
      throw new Error("Normalized texture is too large. Try a smaller image.");
    return { name: file.name.slice(0, 150), dataUrl, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function pngBytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.split(",")[1]);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
export async function sha256(data: string | Uint8Array): Promise<string> {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    Uint8Array.from(bytes).buffer,
  );
  return Array.from(new Uint8Array(hash), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}

export function pngDimensions(bytes: Uint8Array): {
  width: number;
  height: number;
} {
  if (
    bytes.length < 24 ||
    bytes[0] !== 137 ||
    String.fromCharCode(...bytes.slice(1, 4)) !== "PNG" ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  )
    throw new Error("Invalid PNG texture header.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    width = view.getUint32(16),
    height = view.getUint32(20);
  if (width < 1 || height < 1 || width > 1024 || height > 1024)
    throw new Error("PNG texture dimensions exceed the export profile.");
  return { width, height };
}
