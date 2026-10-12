import { Project, MeshData, TextureAsset, SignSlot } from "./project";
import { box, beam } from "./mesh";
import { floorElevation } from "./building";
import { terrainHeight } from "./terrain";
export function buildSigns(p: Project): MeshData[] {
  const parts: MeshData[] = [];
  for (const slot of p.signs) {
    const top = floorElevation(p, p.structure.storeys - 1) + p.height,
      roofRise =
        p.roof === "flat"
          ? 0
          : p.roof === "hip" || p.roof === "gable"
            ? p.theme === "fantasy"
              ? Math.min(3.2, p.width * 0.35)
              : Math.min(2, p.width * 0.22)
            : 2;
    const entranceX = p.structure.footprint === "l" ? -p.width / 3 : 0,
      entranceZ = p.structure.footprint === "u" ? -p.depth / 6 : p.depth / 2;
    let x = entranceX,
      y = 2.48 + floorElevation(p, 0) - 0.16,
      z = entranceZ + 0.13,
      yaw = 0;
    if (slot.kind === "blade") {
      x =
        p.structure.footprint === "rectangle"
          ? p.width / 2 - 0.35
          : entranceX + p.width / 6 - 0.35;
      z = entranceZ + slot.width / 2 + 0.15;
      yaw = Math.PI / 2;
    }
    if (slot.kind === "wall") {
      x = entranceX - p.width * 0.1;
      y =
        Math.max(2.45, p.height - slot.height - 0.15) +
        floorElevation(p, 0) -
        0.16;
    }
    if (slot.kind === "roof") {
      if (p.structure.footprint !== "rectangle")
        throw new Error(
          "Roof signs require a selected supporting wing. Use a wall or pavement mount for connected footprints.",
        );
      y = top + roofRise + 0.4;
      z = 0;
    }
    if (slot.kind === "pavement") {
      x = p.width / 2 + 1.35;
      z = p.depth / 2 + 1.5;
      y = terrainHeight(p, x, z) + 0.24;
    }
    if (slot.kind === "fascia") {
      if (p.theme === "jungle") {
        const front = floorElevation(p, 0) + Math.max(2.4, p.height - 0.8);
        y = front - slot.height - 0.08;
        z = entranceZ + 2.29;
        if (y < floorElevation(p, 0) + 1.8)
          throw new Error(
            "The sign would intrude on veranda headroom. Reduce its height.",
          );
      } else if (p.theme === "desert") {
        y = 2.2;
        z = entranceZ + (p.archetype === "villa" ? 3 : 1.9) + 0.06;
      } else if (p.theme === "scifi") {
        y = 2.2;
        z = entranceZ + 1.45;
      }
    }
    if (
      ["fascia", "wall", "blade"].includes(slot.kind) &&
      y + slot.height > floorElevation(p, 0) + p.height + 0.05
    )
      throw new Error(
        `Sign ${slot.id} overlaps its roof edge. Reduce height or choose a roof/pavement mount.`,
      );
    const mesh = box(
      `sign-${slot.id}`,
      "Sign slot: " + slot.text,
      [x, y, z],
      [slot.width, slot.height, 0.06],
      "sign",
      "interior",
      false,
    );
    mesh.bakedTexture = slot.asset;
    mesh.materialColor = "#ffffff";
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const a = mesh.positions[i],
        b = mesh.positions[i + 2];
      mesh.positions[i] = a * Math.cos(yaw) - b * Math.sin(yaw);
      mesh.positions[i + 2] = a * Math.sin(yaw) + b * Math.cos(yaw);
    }
    parts.push(mesh);
    for (const side of [-1, 1])
      if (slot.kind === "roof" || slot.kind === "pavement") {
        const px = x + side * (slot.width / 2 - 0.08),
          bottom = slot.kind === "roof" ? top + 0.12 : terrainHeight(p, px, z),
          height = y + slot.height * 0.7 - bottom;
        if (height > 0)
          parts.push(
            box(
              `sign-${slot.id}-mount-${side}`,
              "Supported sign post",
              [px, bottom, z],
              [0.07, height, 0.07],
              "trim",
              "interior",
              true,
            ),
          );
      } else if (slot.kind === "blade")
        parts.push(
          beam(
            `sign-${slot.id}-bracket-${side}`,
            [x, y + (side < 0 ? 0.1 : slot.height - 0.1), p.depth / 2],
            [x, y + (side < 0 ? 0.1 : slot.height - 0.1), z],
            0.035,
            "trim",
            "interior",
            false,
          ),
        );
  }
  return parts;
}
export interface SignArtwork {
  text: string;
  background: string;
  color: string;
  font: "sans-serif" | "serif" | "monospace";
  fit: "contain" | "cover";
  padding: number;
  border: boolean;
}
export async function rasterizeSign(
  settings: SignArtwork,
  widthMeters: number,
  heightMeters: number,
  artwork?: TextureAsset,
): Promise<TextureAsset> {
  const dimension = Math.max(widthMeters, heightMeters),
    width = Math.max(64, Math.round((1024 * widthMeters) / dimension)),
    height = Math.max(64, Math.round((1024 * heightMeters) / dimension)),
    canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d")!;
  c.fillStyle = settings.background;
  c.fillRect(0, 0, width, height);
  const padding = Math.max(8, Math.min(width, height) * settings.padding),
    rect = {
      x: padding,
      y: padding,
      w: width - padding * 2,
      h: height - padding * 2,
    };
  if (artwork) {
    const image = new Image();
    image.src = artwork.dataUrl;
    await image.decode();
    const scale =
        settings.fit === "contain"
          ? Math.min(rect.w / image.width, rect.h / image.height)
          : Math.max(rect.w / image.width, rect.h / image.height),
      w = image.width * scale,
      h = image.height * scale;
    c.save();
    c.beginPath();
    c.rect(rect.x, rect.y, rect.w, rect.h);
    c.clip();
    c.drawImage(
      image,
      rect.x + (rect.w - w) / 2,
      rect.y + (rect.h - h) / 2,
      w,
      h,
    );
    c.restore();
  }
  if (settings.text) {
    let size = Math.min(110, rect.h * 0.7);
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = settings.color;
    c.font = `600 ${size}px ${settings.font}`;
    while (size > 12 && c.measureText(settings.text).width > rect.w) {
      size -= 2;
      c.font = `600 ${size}px ${settings.font}`;
    }
    c.fillText(settings.text, width / 2, height / 2, rect.w);
  }
  if (settings.border) {
    c.strokeStyle = settings.color;
    c.lineWidth = 3;
    c.strokeRect(5, 5, width - 10, height - 10);
  }
  return {
    name: "c3-sign-artwork.png",
    dataUrl: canvas.toDataURL("image/png"),
    width,
    height,
  };
}
