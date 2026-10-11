import {
  MaterialRole,
  MaterialSpec,
  Project,
  random,
  TextureAsset,
} from "./project";
const proceduralCache = new Map<string, string>();

export function textureImage(spec: MaterialSpec, project: Project): string {
  const custom = project.textures[spec.role];
  if (custom) return custom.dataUrl;
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
  if (spec.pattern === "wood") {
    for (let y = 0; y < 256; y += 32) {
      c.fillStyle = `rgba(55,40,20,${0.04 + r() * 0.06})`;
      c.fillRect(0, y, 256, 1);
      for (let i = 0; i < 9; i++) {
        const yy = y + r() * 30;
        c.strokeStyle = `rgba(60,40,20,${r() * 0.09})`;
        c.beginPath();
        c.moveTo(0, yy);
        c.bezierCurveTo(70, yy - 3, 150, yy + 4, 256, yy);
        c.stroke();
      }
    }
  } else if (spec.pattern === "tiles") {
    c.strokeStyle = "rgba(20,30,30,0.18)";
    for (let y = 0; y < 256; y += 32) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(256, y);
      c.stroke();
      for (let x = y % 64 ? 16 : 0; x < 256; x += 32)
        c.strokeRect(x, y, 32, 32);
    }
  }
  if (spec.pattern !== "solid")
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = `rgba(${spec.pattern === "stone" ? "45,60,40" : "45,40,30"},${r() * 0.08})`;
      const s = spec.pattern === "stone" ? 1 + r() * 3 : 1;
      c.fillRect(r() * 256, r() * 256, s, s);
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
