import { MeshData, Project, Vec3, random, seedFor } from "./project";
import { MeshBuilder } from "./mesh";
import { generatePlant, PlantFamily, PlantResult } from "./plants";
import { terrainHeight, terrainMeshes, channelX } from "./terrain";
import { generateRock } from "./geology";

const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
export function groundHeight(p: Project, x: number, z: number): number {
  return terrainHeight(p, x, z);
}
export function parcelSize(p: Project): [number, number] {
  return [p.width + 2 * p.landscape.extent, p.depth + 2 * p.landscape.extent];
}
const plantCache = new Map<string, PlantResult>();
export function plantVariant(
  family: PlantFamily,
  seed: number,
  scale: number,
  options: Project["plants"],
): PlantResult {
  const key = `${family}:${seed}:${scale}:${JSON.stringify(options)}`;
  if (!plantCache.has(key)) {
    plantCache.set(key, generatePlant(family, seed, scale, options));
    if (plantCache.size > 80)
      plantCache.delete(plantCache.keys().next().value!);
  }
  return plantCache.get(key)!;
}
export function buildLandscape(p: Project): MeshData[] {
  if (!p.landscape.enabled) return [];
  const parts: MeshData[] = terrainMeshes(p),
    [width, depth] = parcelSize(p);
  const path = new MeshBuilder(),
    start = p.depth / 2 + 1.2;
  for (let z = start; z < depth / 2 - 0.1; z += 0.6) {
    const end = Math.min(z + 0.6, depth / 2 - 0.1),
      half = 1.35;
    path.face(
      [
        [-half, -0.011, end],
        [half, -0.011, end],
        [half, -0.011, z],
        [-half, -0.011, z],
      ],
      undefined,
      true,
    );
  }
  parts.push(path.build("site-path", "Entrance path", "path", "landscape"));
  const occupied: { x: number; z: number; radius: number }[] =
    p.plantLandmarks.map((plant) => ({
      x: plant.x,
      z: plant.z,
      radius: 2.4 * plant.scale,
    }));
  const place = (
    family: PlantFamily,
    x: number,
    z: number,
    variant: number,
    scale: number,
    id: string,
  ) => {
    const base = plantVariant(
        family,
        seedFor(p.seed, `${family}-${variant % 3}`),
        scale,
        p.plants,
      ),
      y = groundHeight(p, x, z);
    for (const source of base.meshes) {
      if (
        !p.landscape.foliage &&
        (source.id === "leaves" || source.id === "leaf-tips")
      )
        continue;
      // Adapt exposed roots to the sampled ground; foliage/trunk variants remain reusable.
      const positions =
        source.id === "branches"
          ? source.positions.map((v, i) => {
              if (i % 3 !== 1 || v > 0.35) return v;
              const lx = source.positions[i - 1],
                lz = source.positions[i + 1];
              return (
                v +
                (groundHeight(p, x + lx, z + lz) - y) * (1 - smooth(v / 0.35))
              );
            })
          : source.positions;
      parts.push({
        ...source,
        id: `${id}-${source.id}`,
        origin: [x, y, z],
        positions,
      });
    }
  };
  const trees: PlantFamily[] =
    p.biome === "tropical"
      ? ["canopy", "palm", "canopy", "palm"]
      : p.biome === "arid"
        ? p.landscape.aridRecipe === "oasis"
          ? ["palm", "acacia"]
          : p.landscape.aridRecipe === "succulent"
            ? ["cactus", "acacia", "cactus"]
            : ["acacia"]
        : p.biome === "woodland"
          ? ["ancient", "drooping", "broadleaf"]
          : p.biome === "alien"
            ? ["alien", "spiral"]
            : ["broadleaf", "conifer", "broadleaf"];
  const scatter = random(seedFor(p.seed, "tree-sites"));
  const count = Math.round(
    p.landscape.density *
      (p.biome === "tropical" ? 11 : p.biome === "arid" ? 5 : 8),
  );
  let tree = 0;
  for (let attempt = 0; attempt < 180 && tree < count; attempt++) {
    const x = (scatter() - 0.5) * (width - 5),
      z = (scatter() - 0.5) * (depth - 5);
    const radius = 2.4 * p.landscape.plantScale;
    if (p.effects.creek && Math.abs(x - channelX(p, z)) < 3.6) continue;
    if (
      Math.abs(x) < p.width / 2 + radius + 1.8 &&
      Math.abs(z) < p.depth / 2 + radius + 2.8
    )
      continue;
    // Preserve the main route, view of the facade, and connected root/canopy space.
    if (z > p.depth / 2 && Math.abs(x) < 4.5) continue;
    if (
      occupied.some(
        (o) => Math.hypot(x - o.x, z - o.z) < radius + o.radius - 0.8,
      )
    )
      continue;
    const family = trees[tree % trees.length],
      scale = p.landscape.plantScale * (0.9 + (tree % 3) * 0.12);
    place(family, x, z, tree, scale, `plant-tree-${tree}-${family}`);
    occupied.push({ x, z, radius });
    tree++;
  }
  const understory: PlantFamily[] =
    p.biome === "tropical"
      ? ["fern", "broadleaf-herb", "fern"]
      : p.biome === "arid"
        ? p.landscape.aridRecipe === "succulent"
          ? ["agave", "pad-cactus", "cactus", "grass"]
          : ["grass", "shrub", "agave", "grass"]
        : p.biome === "woodland"
          ? ["fern", "fungi", "log", "stump"]
          : p.biome === "alien"
            ? ["agave", "fungi"]
            : ["grass", "fern", "shrub"];
  const low = random(seedFor(p.seed, "understory-sites"));
  let placed = 0;
  const lowCount = Math.round(
    p.landscape.density * (p.biome === "tropical" ? 26 : 18),
  );
  for (let attempt = 0; attempt < 240 && placed < lowCount; attempt++) {
    const x = (low() - 0.5) * (width - 2),
      z = (low() - 0.5) * (depth - 2);
    if (Math.abs(x) < p.width / 2 + 1.5 && Math.abs(z) < p.depth / 2 + 3.8)
      continue;
    if (z > 0 && Math.abs(x) < 2.05) continue;
    if (p.effects.creek && Math.abs(x - channelX(p, z)) < 3.4) continue;
    if (occupied.some((o) => Math.hypot(x - o.x, z - o.z) < 0.7)) continue;
    const family = understory[placed % understory.length];
    place(
      family,
      x,
      z,
      placed,
      p.landscape.plantScale * (0.65 + (placed % 3) * 0.16),
      `plant-low-${placed}-${family}`,
    );
    placed++;
  }
  // Rock clusters follow the same seeded placement rules and are partly buried.
  const rocks = random(seedFor(p.seed, "rock-sites"));
  for (let i = 0; i < 9; i++) {
    const x = (rocks() - 0.5) * (width - 3),
      z = (rocks() - 0.5) * (depth - 3);
    if (Math.abs(x) < p.width / 2 + 1.8 && Math.abs(z) < p.depth / 2 + 4)
      continue;
    if (z > 0 && Math.abs(x) < 2.2) continue;
    if (p.effects.creek && Math.abs(x - channelX(p, z)) < 3.5) continue;
    if (occupied.some((o) => Math.hypot(x - o.x, z - o.z) < 1.2)) continue;
    const size = 0.35 + rocks() * 0.85,
      source = generateRock(
        p.terrain.geology,
        seedFor(p.seed, `rock-variant-${i % 4}`),
        size,
      ),
      contact = Math.min(
        groundHeight(p, x, z),
        groundHeight(p, x + size * 0.5, z),
        groundHeight(p, x - size * 0.5, z),
        groundHeight(p, x, z + size * 0.5),
        groundHeight(p, x, z - size * 0.5),
      );
    parts.push({ ...source, id: `rock-${i}`, origin: [x, contact, z] });
    if (p.terrain.geology === "fractured" || p.terrain.geology === "stratified")
      for (let fragment = 0; fragment < 3; fragment++) {
        const xx = x + (rocks() - 0.5) * size * 3,
          zz = z + (rocks() - 0.5) * size * 3;
        const debris = generateRock(
          "scree",
          seedFor(p.seed, `debris-${i}-${fragment}`),
          size * 0.18,
        );
        parts.push({
          ...debris,
          id: `rock-${i}-debris-${fragment}`,
          origin: [xx, groundHeight(p, xx, zz), zz],
          solid: false,
        });
      }
  }
  return parts;
}
