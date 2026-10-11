import { MaterialSpec, Project } from "./project";
export const STANDARD_TEXTURES: Record<
  string,
  { id: string; filename: string; source: string; license: string }
> = {
  bark: {
    id: "Bark012",
    filename: "c3-bark012.jpg",
    source: "https://ambientcg.com/a/Bark012",
    license: "CC0-1.0",
  },
  soil: {
    id: "Ground037",
    filename: "c3-ground037.jpg",
    source: "https://ambientcg.com/a/Ground037",
    license: "CC0-1.0",
  },
  stone: {
    id: "Rock035",
    filename: "c3-rock035.jpg",
    source: "https://ambientcg.com/a/Rock035",
    license: "CC0-1.0",
  },
  wood: {
    id: "WoodSiding006",
    filename: "c3-woodsiding006.jpg",
    source: "https://ambientcg.com/a/WoodSiding006",
    license: "CC0-1.0",
  },
  brick: {
    id: "Bricks060",
    filename: "c3-bricks060.jpg",
    source: "https://ambientcg.com/a/Bricks060",
    license: "CC0-1.0",
  },
};
const images = new Map<string, string>(),
  pending = new Map<string, Promise<void>>();
export function standardImage(
  spec: MaterialSpec,
  p: Project,
): string | undefined {
  return p.surfaceSource === "standard" ? images.get(spec.pattern) : undefined;
}
export function standardSource(spec: MaterialSpec, p: Project) {
  return p.surfaceSource === "standard" && !p.textures[spec.role]
    ? STANDARD_TEXTURES[spec.pattern]
    : undefined;
}
export async function loadStandardTextures(
  patterns = Object.keys(STANDARD_TEXTURES),
): Promise<void> {
  await Promise.all(
    [...new Set(patterns)]
      .filter((k) => STANDARD_TEXTURES[k])
      .map(async (key) => {
        if (images.has(key)) return;
        let task = pending.get(key);
        if (!task) {
          task = (async () => {
            const image = new Image();
            image.src = `${import.meta.env.BASE_URL}textures/${STANDARD_TEXTURES[key].filename}`;
            await image.decode();
            const canvas = document.createElement("canvas");
            canvas.width = 512;
            canvas.height = 512;
            const c = canvas.getContext("2d")!;
            c.drawImage(image, 0, 0, 512, 512);
            const pixels = c.getImageData(0, 0, 512, 512);
            // Preserve scanned surface detail while the semantic material supplies its climate-specific colour.
            for (let i = 0; i < pixels.data.length; i += 4) {
              const luminance =
                0.2126 * pixels.data[i] +
                0.7152 * pixels.data[i + 1] +
                0.0722 * pixels.data[i + 2];
              const value = Math.min(255, 95 + luminance * 0.72);
              pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
            }
            c.putImageData(pixels, 0, 0);
            images.set(key, canvas.toDataURL("image/png"));
          })().catch((error) => {
            pending.delete(key);
            throw error;
          });
          pending.set(key, task);
        }
        await task;
      }),
  );
}
