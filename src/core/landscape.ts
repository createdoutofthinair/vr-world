import { MeshData, Project, Vec3, random, seedFor } from "./project";
import { MeshBuilder } from "./mesh";
import { generatePlant, PlantFamily, PlantResult } from "./plants";

const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
export function groundHeight(p: Project, x: number, z: number): number {
  const edge = Math.max(
    Math.abs(x) - p.width / 2 - 1.7,
    Math.abs(z) - p.depth / 2 - 2.4,
  );
  const pad = smooth(edge / 4),
    corridor = z > 0 ? smooth((Math.abs(x) - 1.65) / 2) : 1;
  const phase = (p.seed % 1000) / 73;
  return (
    -0.02 +
    p.landscape.relief *
      pad *
      corridor *
      (0.62 +
        0.28 * Math.sin(x * 0.28 + phase) * Math.cos(z * 0.21) +
        0.12 * Math.sin(x * 0.6 + z * 0.32))
  );
}
export function parcelSize(p: Project): [number, number] {
  return [p.width + 2 * p.landscape.extent, p.depth + 2 * p.landscape.extent];
}
const plantCache = new Map<string, PlantResult>();
function plantVariant(
  family: PlantFamily,
  seed: number,
  scale: number,
): PlantResult {
  const key = `${family}:${seed}:${scale}`;
  if (!plantCache.has(key)) {
    plantCache.set(key, generatePlant(family, seed, scale));
    if (plantCache.size > 80)
      plantCache.delete(plantCache.keys().next().value!);
  }
  return plantCache.get(key)!;
}
export function buildLandscape(p: Project): MeshData[] {
  if (!p.landscape.enabled) return [];
  const parts: MeshData[] = [],
    [width, depth] = parcelSize(p),
    mesh = new MeshBuilder();
  const nx = Math.ceil(width),
    nz = Math.ceil(depth);
  for (let z = 0; z < nz; z++)
    for (let x = 0; x < nx; x++) {
      const ax = -width / 2 + (x * width) / nx,
        bx = -width / 2 + ((x + 1) * width) / nx,
        az = -depth / 2 + (z * depth) / nz,
        bz = -depth / 2 + ((z + 1) * depth) / nz;
      mesh.face([
        [ax, groundHeight(p, ax, bz), bz],
        [bx, groundHeight(p, bx, bz), bz],
        [bx, groundHeight(p, bx, az), az],
        [ax, groundHeight(p, ax, az), az],
      ]);
    }
  // Low skirt closes the parcel edge; no dependence on native AW terrain.
  for (const side of [-1, 1])
    for (let i = 0; i < nx; i++) {
      const a = -width / 2 + (i * width) / nx,
        b = -width / 2 + ((i + 1) * width) / nx,
        z = (side * depth) / 2;
      const points: Vec3[] = [
        [a, -0.7, z],
        [b, -0.7, z],
        [b, groundHeight(p, b, z), z],
        [a, groundHeight(p, a, z), z],
      ];
      mesh.face(side === 1 ? points : points.reverse());
    }
  for (const side of [-1, 1])
    for (let i = 0; i < nz; i++) {
      const a = -depth / 2 + (i * depth) / nz,
        b = -depth / 2 + ((i + 1) * depth) / nz,
        x = (side * width) / 2;
      const points: Vec3[] = [
        [x, -0.7, b],
        [x, -0.7, a],
        [x, groundHeight(p, x, a), a],
        [x, groundHeight(p, x, b), b],
      ];
      mesh.face(side === 1 ? points : points.reverse());
    }
  parts.push({
    ...mesh.build("site-ground", "Owned mesh terrain", "ground", "site", true),
    walkable: true,
  });
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
  const occupied: { x: number; z: number; radius: number }[] = [];
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
          ? ["ancient", "broadleaf"]
          : p.biome === "alien"
            ? ["alien"]
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
          ? ["agave", "cactus", "grass"]
          : ["grass", "agave", "grass"]
        : p.biome === "woodland"
          ? ["fern", "fungi", "fern"]
          : p.biome === "alien"
            ? ["agave", "fungi"]
            : ["grass", "fern"];
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
    if (occupied.some((o) => Math.hypot(x - o.x, z - o.z) < 1.2)) continue;
    const b = new MeshBuilder(),
      size = 0.35 + rocks() * 0.85,
      phase = rocks() * 6;
    b.lathe(
      [
        [0, -0.22],
        [size * 0.8, -0.15],
        [size, 0.18],
        [size * 0.8, size * 0.68],
        [size * 0.35, size * 0.9],
        [0, size],
      ],
      9,
      (a, y) => 1 + 0.13 * Math.sin(a * 3 + phase) + 0.09 * Math.cos(a * 5 + y),
    );
    parts.push(
      b.build(
        `rock-${i}`,
        "Weathered rock outcrop",
        "rock",
        "landscape",
        true,
        [x, groundHeight(p, x, z), z],
      ),
    );
  }
  return parts;
}
