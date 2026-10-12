import {
  Project,
  GroundLayer,
  MeshData,
  Vec3,
  BIOMES,
  materialsFor,
  MaterialRole,
} from "./project";
import { MeshBuilder } from "./mesh";
import { viaductPlan, ViaductPlan } from "./viaduct";
import { cityPlan, CityPlan } from "./city";
import { decodePNG, encodePNG, dataURL, PixelImage } from "./png";
import { standardImage } from "./standard-textures";
export interface TerrainField {
  width: number;
  depth: number;
  nx: number;
  nz: number;
  heights: Float64Array;
  flow: Float64Array;
  deposition: Float64Array;
}
const fields = new Map<string, TerrainField>();
export const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
export function terrainDomain(p: Project): [number, number] {
  if (p.world.enabled) {
    const extent =
      (p.world.blocks *
        (p.world.blockSize + p.world.roadWidth + 2 * p.world.sidewalkWidth)) /
        2 +
      p.world.roadWidth / 2 +
      p.world.sidewalkWidth +
      4;
    return [extent * 2, extent * 2];
  }
  return [p.width + 2 * p.landscape.extent, p.depth + 2 * p.landscape.extent];
}
export function channelX(p: Project, z: number): number {
  const [width] = terrainDomain(p),
    base = p.world.enabled
      ? (p.world.blockSize + p.world.roadWidth + 2 * p.world.sidewalkWidth) *
        0.27
      : p.width / 2 + Math.min(5, p.landscape.extent - 4);
  return (
    Math.min(width / 2 - 3.5, base) +
    0.45 * Math.sin(z * 0.13 + (p.seed % 100) * 0.03)
  );
}
export function waterHeight(p: Project, z: number): number {
  const [, depth] = terrainDomain(p),
    fall = -p.depth / 2 - 3;
  return (
    -0.35 -
    0.004 * (z + depth / 2) +
    (p.effects.waterfall && z < fall ? 1.8 : 0)
  );
}
function baseHeight(p: Project, x: number, z: number): number {
  const t = p.terrain,
    phase = (p.seed % 1000) / 73,
    w = t.wavelength,
    a =
      (x * Math.cos((t.direction * Math.PI) / 180) +
        z * Math.sin((t.direction * Math.PI) / 180)) /
      w;
  let value =
    t.form === "plain"
      ? 0
      : t.form === "ridge"
        ? Math.exp(-Math.pow(Math.sin(a * Math.PI + phase * 0.2), 2) * 4)
        : t.form === "basin"
          ? 1 - Math.exp(-(x * x + z * z) / (w * w * 0.25))
          : t.form === "terraces"
            ? Math.floor((0.5 + 0.5 * Math.sin(a * 5 + phase)) * 5) / 5
            : 0.62 +
              0.28 * Math.sin((x * 6) / w + phase) * Math.cos((z * 4.5) / w) +
              0.12 * Math.sin((x * 14) / w + (z * 8) / w);
  value *= p.landscape.relief * t.amplitude;
  for (const edit of t.edits)
    if (edit.kind !== "paint") {
      const distance = Math.hypot(x - edit.x, z - edit.z),
        weight = 1 - smooth(distance / edit.radius);
      if (edit.kind === "raise") value += edit.strength * weight;
      else if (edit.kind === "lower") value -= edit.strength * weight;
      else value = value * (1 - weight) + edit.strength * weight;
    }
  return -0.02 + value;
}
function infrastructureMask(
  p: Project,
  x: number,
  z: number,
  city?: CityPlan,
  viaduct?: ViaductPlan | null,
): number {
  if (p.world.enabled) {
    const plan = city ?? cityPlan(p),
      spacing = plan.spacing,
      start = (-p.world.blocks * spacing) / 2,
      roadX = Math.abs(
        ((((x - start + spacing / 2) % spacing) + spacing) % spacing) -
          spacing / 2,
      ),
      roadZ = Math.abs(
        ((((z - start + spacing / 2) % spacing) + spacing) % spacing) -
          spacing / 2,
      ),
      distance =
        Math.min(roadX, roadZ) - p.world.roadWidth / 2 - p.world.sidewalkWidth;
    let mask = smooth(distance / 3);
    for (const plot of plan.plots) {
      if (
        plot.park &&
        p.effects.creek &&
        Math.abs(plot.x - channelX(p, plot.z)) < 8.5
      )
        continue;
      const edge = Math.max(Math.abs(x - plot.x) - 8, Math.abs(z - plot.z) - 9);
      mask = Math.min(mask, smooth(edge / 2));
    }
    if (viaduct)
      for (const sx of viaduct.supports)
        mask = Math.min(
          mask,
          smooth((Math.hypot(x - sx, z - viaduct.z) - 1) / 2),
        );
    return mask;
  }
  const edge = Math.max(
      Math.abs(x) - p.width / 2 - 1.7,
      Math.abs(z) - p.depth / 2 - 2.4,
    ),
    pad = smooth(edge / 4),
    corridor = z > 0 ? smooth((Math.abs(x) - 1.65) / 2) : 1;
  return pad * corridor;
}
export function terrainField(p: Project): TerrainField {
  const [width, depth] = terrainDomain(p),
    key = JSON.stringify([
      p.seed,
      p.width,
      p.depth,
      p.landscape.relief,
      width,
      depth,
      {
        ...p.terrain,
        splats: undefined,
        texelsPerMeter: undefined,
        edits: p.terrain.edits.filter((e) => e.kind !== "paint"),
      },
      p.world,
      p.effects,
    ]);
  const cached = fields.get(key);
  if (cached) return cached;
  const city = p.world.enabled ? cityPlan(p) : undefined,
    viaduct = viaductPlan(p);
  const nx = Math.ceil(width),
    nz = Math.ceil(depth),
    heights = new Float64Array((nx + 1) * (nz + 1)),
    flow = new Float64Array(heights.length),
    deposition = new Float64Array(heights.length),
    at = (x: number, z: number) => z * (nx + 1) + x;
  for (let z = 0; z <= nz; z++)
    for (let x = 0; x <= nx; x++)
      heights[at(x, z)] = baseHeight(
        p,
        -width / 2 + (x * width) / nx,
        -depth / 2 + (z * depth) / nz,
      );
  const iterations = Math.round(p.terrain.erosion);
  for (let pass = 0; pass < iterations; pass++) {
    const delta = new Float64Array(heights.length);
    for (let z = 1; z < nz; z++)
      for (let x = 1; x < nx; x++) {
        const i = at(x, z),
          neighbors = [i - 1, i + 1, i - nx - 1, i + nx + 1],
          low = neighbors.reduce((a, b) => (heights[a] < heights[b] ? a : b)),
          drop = heights[i] - heights[low];
        if (drop > 0.65) {
          const move = (drop - 0.65) * 0.12;
          delta[i] -= move;
          delta[low] += move;
          deposition[low] += move;
        }
      }
    for (let i = 0; i < heights.length; i++) heights[i] += delta[i];
  }
  flow.fill(1);
  const order = Array.from(heights.keys()).sort(
    (a, b) => heights[b] - heights[a] || a - b,
  );
  for (const i of order) {
    const x = i % (nx + 1),
      z = Math.floor(i / (nx + 1));
    if (x === 0 || z === 0 || x === nx || z === nz) continue;
    const low = [i - 1, i + 1, i - nx - 1, i + nx + 1].reduce((a, b) =>
      heights[a] < heights[b] ? a : b,
    );
    if (heights[low] < heights[i]) flow[low] += flow[i];
  }
  // Bounded erosion/deposition is resolved regionally before infrastructure and chunking.
  const erosion = new Float64Array(heights.length);
  for (let z = 1; z < nz; z++)
    for (let x = 1; x < nx; x++) {
      const i = at(x, z),
        low = [i - 1, i + 1, i - nx - 1, i + nx + 1].reduce((a, b) =>
          heights[a] < heights[b] ? a : b,
        ),
        amount =
          Math.min(0.12, (heights[i] - heights[low]) * 0.1) *
          Math.log1p(flow[i]) *
          iterations *
          0.012;
      if (amount > 0) {
        erosion[i] -= amount;
        erosion[low] += amount * 0.55;
        deposition[low] += amount * 0.55;
      }
    }
  for (let z = 0; z <= nz; z++)
    for (let x = 0; x <= nx; x++) {
      const i = at(x, z),
        xx = -width / 2 + (x * width) / nx,
        zz = -depth / 2 + (z * depth) / nz;
      heights[i] =
        -0.02 +
        (heights[i] + erosion[i] + 0.02) *
          infrastructureMask(p, xx, zz, city, viaduct);
      if (p.effects.creek) {
        const distance = Math.abs(xx - channelX(p, zz));
        if (distance < 3.3) {
          const target =
              waterHeight(p, zz) -
              0.55 +
              smooth((distance - 0.8) / 0.65) * 0.85,
            weight = 1 - smooth((distance - 1.45) / 1.85);
          heights[i] = heights[i] * (1 - weight) + target * weight;
        }
      }
      heights[i] = Math.round(heights[i] * 1e6) / 1e6;
    }
  const result = { width, depth, nx, nz, heights, flow, deposition };
  // Drainage/suitability fields describe the final graded/carved surface.
  flow.fill(1);
  const finalOrder = Array.from(heights.keys()).sort(
    (a, b) => heights[b] - heights[a] || a - b,
  );
  for (const i of finalOrder) {
    const x = i % (nx + 1),
      z = Math.floor(i / (nx + 1));
    if (x === 0 || z === 0 || x === nx || z === nz) continue;
    const low = [i - 1, i + 1, i - nx - 1, i + nx + 1].reduce((a, b) =>
      heights[a] < heights[b] ? a : b,
    );
    if (heights[low] < heights[i]) flow[low] += flow[i];
  }
  fields.set(key, result);
  if (fields.size > 8) fields.delete(fields.keys().next().value!);
  return result;
}
function sample(
  field: TerrainField,
  values: Float64Array,
  x: number,
  z: number,
): number {
  const xx = Math.max(
      0,
      Math.min(field.nx, ((x + field.width / 2) / field.width) * field.nx),
    ),
    zz = Math.max(
      0,
      Math.min(field.nz, ((z + field.depth / 2) / field.depth) * field.nz),
    ),
    ix = Math.min(field.nx - 1, Math.floor(xx)),
    iz = Math.min(field.nz - 1, Math.floor(zz)),
    u = xx - ix,
    v = zz - iz,
    at = (a: number, b: number) => values[b * (field.nx + 1) + a];
  return (
    (at(ix, iz) * (1 - u) + at(ix + 1, iz) * u) * (1 - v) +
    (at(ix, iz + 1) * (1 - u) + at(ix + 1, iz + 1) * u) * v
  );
}
export function terrainHeight(p: Project, x: number, z: number): number {
  const field = terrainField(p);
  return sample(field, field.heights, x, z);
}
export function terrainWeights(
  p: Project,
  x: number,
  z: number,
  field = terrainField(p),
): Record<GroundLayer, number> {
  const slope =
      Math.hypot(
        sample(field, field.heights, x + 0.4, z) -
          sample(field, field.heights, x - 0.4, z),
        sample(field, field.heights, x, z + 0.4) -
          sample(field, field.heights, x, z - 0.4),
      ) / 0.8,
    wet = Math.min(1, Math.log1p(sample(field, field.flow, x, z)) / 8),
    rock = smooth((slope - 0.2) / 0.8),
    sand = p.biome === "arid" ? 0.7 : 0,
    weights: Record<GroundLayer, number> = {
      grass: p.biome === "arid" ? 0.08 : (1 - rock) * (1 - wet * 0.4) * 0.72,
      soil: 0.22 + wet * 0.35,
      rock: 0.08 + rock * 0.8,
      sand,
    };
  for (const edit of p.terrain.edits)
    if (edit.kind === "paint") {
      const amount =
        (1 - smooth(Math.hypot(x - edit.x, z - edit.z) / edit.radius)) *
        Math.min(1, edit.strength);
      for (const layer of Object.keys(weights) as GroundLayer[])
        weights[layer] *= 1 - amount;
      weights[edit.layer] += amount;
    }
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  for (const layer of Object.keys(weights) as GroundLayer[])
    weights[layer] = Math.max(0, weights[layer] / sum);
  return weights;
}
export function terrainMeshes(p: Project): MeshData[] {
  const field = terrainField(p),
    parts: MeshData[] = [],
    chunk = 10;
  let datum = Infinity;
  for (const height of field.heights) datum = Math.min(datum, height - 1);
  for (let z0 = 0; z0 < field.nz; z0 += chunk)
    for (let x0 = 0; x0 < field.nx; x0 += chunk) {
      const x1 = Math.min(field.nx, x0 + chunk),
        z1 = Math.min(field.nz, z0 + chunk),
        a = -field.width / 2 + (x0 * field.width) / field.nx,
        b = -field.width / 2 + (x1 * field.width) / field.nx,
        c = -field.depth / 2 + (z0 * field.depth) / field.nz,
        d = -field.depth / 2 + (z1 * field.depth) / field.nz,
        mesh = new MeshBuilder();
      for (let z = z0; z < z1; z++)
        for (let x = x0; x < x1; x++) {
          const ax = -field.width / 2 + (x * field.width) / field.nx,
            bx = -field.width / 2 + ((x + 1) * field.width) / field.nx,
            az = -field.depth / 2 + (z * field.depth) / field.nz,
            bz = -field.depth / 2 + ((z + 1) * field.depth) / field.nz;
          mesh.face(
            [
              [ax, terrainHeight(p, ax, bz), bz],
              [bx, terrainHeight(p, bx, bz), bz],
              [bx, terrainHeight(p, bx, az), az],
              [ax, terrainHeight(p, ax, az), az],
            ],
            p.terrain.splats
              ? [
                  (ax - a) / (b - a),
                  (bz - c) / (d - c),
                  (bx - a) / (b - a),
                  (bz - c) / (d - c),
                  (bx - a) / (b - a),
                  (az - c) / (d - c),
                  (ax - a) / (b - a),
                  (az - c) / (d - c),
                ]
              : undefined,
          );
        }
      // Outer sides are their own repeat-textured meshes, avoiding stretched top-down bakes.
      const id = x0 === 0 && z0 === 0 ? "site-ground" : `terrain-${x0}-${z0}`,
        m = mesh.build(id, "Owned terrain patch", "ground", "site", true);
      const centerX = (a + b) / 2,
        centerZ = (c + d) / 2;
      m.origin = [centerX, 0, centerZ];
      for (let i = 0; i < m.positions.length; i += 3) {
        m.positions[i] -= centerX;
        m.positions[i + 2] -= centerZ;
      }
      m.walkable = true;
      m.surfaceMesh = true;
      if (p.terrain.splats)
        m.surfacePatch = { x: a, z: c, width: b - a, depth: d - c };
      parts.push(m);
      const sides = new MeshBuilder();
      for (const [start, end] of (x0 === 0
        ? [
            [
              [a, c],
              [a, d],
            ],
          ]
        : []
      )
        .concat(
          x1 === field.nx
            ? [
                [
                  [b, d],
                  [b, c],
                ],
              ]
            : [],
        )
        .concat(
          z0 === 0
            ? [
                [
                  [b, c],
                  [a, c],
                ],
              ]
            : [],
        )
        .concat(
          z1 === field.nz
            ? [
                [
                  [a, d],
                  [b, d],
                ],
              ]
            : [],
        ) as [number[], number[]][]) {
        const segments = Math.round(
          Math.hypot(end[0] - start[0], end[1] - start[1]),
        );
        for (let k = 0; k < segments; k++) {
          const ax = start[0] + ((end[0] - start[0]) * k) / segments,
            az = start[1] + ((end[1] - start[1]) * k) / segments,
            bx = start[0] + ((end[0] - start[0]) * (k + 1)) / segments,
            bz = start[1] + ((end[1] - start[1]) * (k + 1)) / segments;
          sides.face([
            [ax, datum, az],
            [bx, datum, bz],
            [bx, terrainHeight(p, bx, bz), bz],
            [ax, terrainHeight(p, ax, az), az],
          ]);
        }
      }
      if (sides.indices.length)
        parts.push(
          sides.build(
            id + "-edge",
            "Parcel edge skirt",
            "rock",
            "landscape",
            false,
          ),
        );
      const underside = new MeshBuilder();
      underside.face([
        [a, datum, c],
        [b, datum, c],
        [b, datum, d],
        [a, datum, d],
      ]);
      parts.push(
        underside.build(
          id + "-underside",
          "Terrain underside",
          "rock",
          "landscape",
          true,
        ),
      );
    }
  return parts;
}
export function bakeTerrain(p: Project, meshes: MeshData[]): MeshData[] {
  if (!p.terrain.splats) return meshes;
  const field = terrainField(p),
    specs = materialsFor(p),
    inputs = new Map<GroundLayer, PixelImage>(),
    roleFor: Record<GroundLayer, MaterialRole> = {
      grass: "grass",
      soil: "ground",
      rock: "rock",
      sand: "ground",
    },
    colors: Record<GroundLayer, string> = {
      grass: specs.grass.color,
      soil: specs.ground.color,
      rock: specs.rock.color,
      sand:
        p.materialOptions.ground || p.textures.ground
          ? specs.ground.color
          : "#c9b18b",
    };
  for (const layer of Object.keys(roleFor) as GroundLayer[]) {
    const role = roleFor[layer],
      asset = p.textures[role]?.dataUrl ?? standardImage(specs[role], p);
    if (asset)
      inputs.set(
        layer,
        decodePNG(
          Uint8Array.from(atob(asset.split(",")[1]), (c) => c.charCodeAt(0)),
        ),
      );
  }
  for (const mesh of meshes) {
    const patch = mesh.surfacePatch;
    if (!patch) continue;
    const width = Math.min(
        512,
        Math.max(32, Math.ceil(patch.width * p.terrain.texelsPerMeter)),
      ),
      height = Math.min(
        512,
        Math.max(32, Math.ceil(patch.depth * p.terrain.texelsPerMeter)),
      ),
      pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const xx = patch.x + (x / (width - 1)) * patch.width,
          zz = patch.z + (1 - y / (height - 1)) * patch.depth,
          weights = terrainWeights(p, xx, zz, field),
          linear = [0, 0, 0];
        for (const layer of Object.keys(weights) as GroundLayer[]) {
          const image = inputs.get(layer),
            tint = colors[layer]
              .slice(1)
              .match(/../g)!
              .map((v) => parseInt(v, 16)),
            grain =
              0.88 +
              0.05 * Math.sin(xx * 11 + zz * 7) +
              0.045 * Math.sin(xx * 43 - zz * 31),
            ix = image
              ? Math.floor(((((xx % 2) + 2) % 2) / 2) * image.width)
              : 0,
            iy = image
              ? Math.floor(((((zz % 2) + 2) % 2) / 2) * image.height)
              : 0;
          for (let c = 0; c < 3; c++) {
            const base = image
                ? image.pixels[(iy * image.width + ix) * 4 + c] / 255
                : grain,
              color = (base * tint[c]) / 255;
            linear[c] += Math.pow(Math.max(0, color), 2.2) * weights[layer];
          }
        }
        const at = (y * width + x) * 4;
        for (let c = 0; c < 3; c++)
          pixels[at + c] = Math.round(
            Math.min(1, Math.pow(linear[c], 1 / 2.2)) * 255,
          );
        pixels[at + 3] = 255;
      }
    mesh.bakedTexture = {
      name: "c3-terrain-bake.png",
      dataUrl: dataURL(encodePNG({ width, height, pixels })),
      width,
      height,
    };
    mesh.materialColor = "#ffffff";
  }
  return meshes;
}
