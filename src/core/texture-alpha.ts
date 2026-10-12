import { decodePNG } from "./png";
export type TextureAlpha = "opaque" | "mask" | "blend";
const cache = new Map<string, TextureAlpha>();
/** Inspect normalized PNG bytes, rather than guessing transparency from the role. */
export function textureAlpha(dataUrl: string): TextureAlpha {
  const cached = cache.get(dataUrl);
  if (cached) return cached;
  if (!dataUrl.startsWith("data:image/png;base64,"))
    throw new Error("Expected normalized PNG texture.");
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) =>
      c.charCodeAt(0),
    ),
    { pixels } = decodePNG(bytes);
  let result: TextureAlpha = "opaque";
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] !== 0 && pixels[i] !== 255) {
      result = "blend";
      break;
    }
    if (pixels[i] === 0) result = "mask";
  }
  cache.set(dataUrl, result);
  if (cache.size > 32) cache.delete(cache.keys().next().value!);
  return result;
}
