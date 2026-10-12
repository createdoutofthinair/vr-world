import { MeshData, Project, Vec3 } from "./project";
import { box, MeshBuilder } from "./mesh";
import { channelX, terrainHeight } from "./terrain";
export interface ViaductPlan {
  x0: number;
  x1: number;
  z: number;
  spacing: number;
  supports: number[];
  heightAt: (x: number) => number;
}
/** Pure layout: support grading and generated geometry share these exact sites. */
export function viaductPlan(p: Project): ViaductPlan | null {
  if (!p.effects.viaduct) return null;
  if (!p.world.enabled || p.world.blocks !== 3)
    throw new Error("Viaduct needs a three-block neighborhood.");
  if (
    p.world.roadOffsets &&
    Object.values(p.world.roadOffsets).some((axis) =>
      Object.values(axis).some((v) => v !== 0),
    )
  )
    throw new Error(
      "The fixed viaduct preset does not support shifted streets. Reset street offsets first.",
    );
  const spacing =
      p.world.blockSize + p.world.roadWidth + 2 * p.world.sidewalkWidth,
    x0 = -1.5 * spacing,
    x1 = 1.5 * spacing,
    z = -0.5 * spacing;
  if (p.world.viaductHeight / spacing > 0.12)
    throw new Error(
      "Viaduct approach exceeds the application grade budget of 12%.",
    );
  const heightAt = (x: number) =>
    0.015 +
    p.world.viaductHeight *
      Math.max(0, Math.min(1, (x - x0) / spacing, (x1 - x) / spacing));
  const supports: number[] = [];
  for (let x = x0 + 8; x < x1 - 4; x += 8) {
    if (
      [-1.5, -0.5, 0.5, 1.5].some(
        (n) =>
          Math.abs(x - n * spacing) <
          p.world.roadWidth / 2 + p.world.sidewalkWidth + 1,
      )
    )
      continue;
    if (
      heightAt(x) < 0.8 ||
      (p.effects.creek && Math.abs(x - channelX(p, z)) < 3.1)
    )
      continue;
    // Entrances lie at quarter-block offsets; keep piers out of their routes.
    const entrance = [-spacing, 0, spacing].some((c) =>
      [-1, 1].some((s) => Math.abs(x - c - s * p.world.blockSize * 0.25) < 1.8),
    );
    if (!entrance) supports.push(x);
  }
  return { x0, x1, z, spacing, supports, heightAt };
}
export function buildViaduct(p: Project): MeshData[] {
  const plan = viaductPlan(p);
  if (!plan) return [];
  const parts: MeshData[] = [],
    road = p.world.roadWidth / 2,
    walk = p.world.sidewalkWidth;
  const ribbon = (
    id: string,
    a: number,
    b: number,
    z0: number,
    z1: number,
    rise: number,
    thickness: number,
    material: MeshData["material"],
    solid = true,
    surface = solid,
  ) => {
    const origin: Vec3 = [(a + b) / 2, 0, plan.z],
      m = new MeshBuilder(),
      y0 = plan.heightAt(a) + rise,
      y1 = plan.heightAt(b) + rise,
      aa = a - origin[0],
      bb = b - origin[0];
    m.face([
      [aa, y0, z1],
      [bb, y1, z1],
      [bb, y1, z0],
      [aa, y0, z0],
    ]);
    if (thickness > 0) {
      m.face([
        [aa, y0 - thickness, z0],
        [bb, y1 - thickness, z0],
        [bb, y1 - thickness, z1],
        [aa, y0 - thickness, z1],
      ]);
      m.face([
        [aa, y0 - thickness, z1],
        [bb, y1 - thickness, z1],
        [bb, y1, z1],
        [aa, y0, z1],
      ]);
      m.face([
        [bb, y1 - thickness, z0],
        [aa, y0 - thickness, z0],
        [aa, y0, z0],
        [bb, y1, z0],
      ]);
      m.face([
        [aa, y0 - thickness, z0],
        [aa, y0 - thickness, z1],
        [aa, y0, z1],
        [aa, y0, z0],
      ]);
      m.face([
        [bb, y1 - thickness, z1],
        [bb, y1 - thickness, z0],
        [bb, y1, z0],
        [bb, y1, z1],
      ]);
    }
    const mesh = m.build(
      id,
      id.replaceAll("-", " "),
      material,
      "site",
      solid,
      origin,
    );
    if (surface) {
      mesh.surfaceMesh = true;
      mesh.walkable = true;
    }
    parts.push(mesh);
  };
  const breaks = [plan.x0, -0.5 * plan.spacing, 0.5 * plan.spacing, plan.x1];
  let n = 0;
  for (let section = 0; section < 3; section++)
    for (let a = breaks[section]; a < breaks[section + 1] - 0.001; a += 4) {
      const b = Math.min(a + 4, breaks[section + 1]),
        id = `viaduct-${n++}`;
      ribbon(`${id}-road`, a, b, -road, road, 0, 0.06, "road");
      for (const side of [-1, 1]) {
        const z0 = side < 0 ? -road - walk : road,
          z1 = z0 + walk;
        ribbon(`${id}-walk-${side}`, a, b, z0, z1, 0.125, 0.12, "path");
        const edge = side * (road + walk - 0.1);
        ribbon(
          `${id}-guard-${side}`,
          a,
          b,
          edge - 0.04,
          edge + 0.04,
          1.125,
          0.09,
          "metal",
          true,
          false,
        );
        for (const x of [a, (a + b) / 2])
          parts.push(
            box(
              `${id}-post-${side}-${x}`,
              "Viaduct guard post",
              [x, plan.heightAt(x) + 0.125, plan.z + edge],
              [0.08, 1, 0.08],
              "metal",
              "site",
            ),
          );
      }
      ribbon(
        `${id}-marking`,
        a + 0.2,
        Math.min(b, a + 1.8),
        -0.035,
        0.035,
        0.002,
        0,
        "marking",
        false,
      );
    }
  for (const [i, x] of plan.supports.entries()) {
    const y = terrainHeight(p, x, plan.z),
      top = plan.heightAt(x) - 0.06;
    if (top - y < 0.5)
      throw new Error("Viaduct support has insufficient terrain clearance.");
    parts.push(
      box(
        `viaduct-footing-${i}`,
        "Grounded viaduct footing",
        [x, y - 0.1, plan.z],
        [1.8, 0.3, 1.8],
        "rock",
        "site",
      ),
    );
    parts.push(
      box(
        `viaduct-pier-${i}`,
        "Viaduct pier",
        [x, y + 0.2, plan.z],
        [0.8, top - y - 0.35, 0.8],
        "rock",
        "site",
      ),
    );
    parts.push(
      box(
        `viaduct-cap-${i}`,
        "Viaduct cross cap",
        [x, top - 0.15, plan.z],
        [1.2, 0.15, 2 * (road + walk)],
        "metal",
        "site",
      ),
    );
  }
  return parts;
}
