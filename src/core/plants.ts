import {
  MeshData,
  Vec3,
  random,
  seedFor,
  PlantSettings,
  DEFAULT_PLANTS,
} from "./project";
import { colonize } from "./colonization";
import { MeshBuilder, addV, lerpV, mulV } from "./mesh";
export type PlantFamily =
  | "broadleaf"
  | "canopy"
  | "acacia"
  | "ancient"
  | "conifer"
  | "palm"
  | "fern"
  | "broadleaf-herb"
  | "agave"
  | "cactus"
  | "alien"
  | "grass"
  | "fungi";
export interface PlantSkeleton {
  start: Vec3;
  end: Vec3;
  radius: number;
  parent: number | null;
}
export interface PlantResult {
  meshes: MeshData[];
  skeleton: PlantSkeleton[];
  family: PlantFamily;
}
export function generatePlant(
  family: PlantFamily,
  seed: number,
  scale = 1,
  options: PlantSettings = DEFAULT_PLANTS,
): PlantResult {
  const r = random(seedFor(seed, "skeleton")),
    f = random(seedFor(seed, "foliage"));
  const trunk = new MeshBuilder(),
    wood = new MeshBuilder(),
    leaves = new MeshBuilder(),
    light = new MeshBuilder();
  const skeleton: PlantSkeleton[] = [];
  const woody = ["broadleaf", "canopy", "acacia", "ancient"].includes(family),
    crownScale =
      options.crown *
      (woody && options.age === "sapling"
        ? 0.6
        : woody && options.age === "old"
          ? 1.08
          : 1),
    heightScale =
      options.height *
      (woody && options.age === "sapling"
        ? 0.65
        : woody && options.age === "old"
          ? 1.08
          : 1),
    trunkScale =
      options.trunk *
      (woody && options.age === "sapling"
        ? 0.7
        : woody && options.age === "old"
          ? 1.3
          : 1),
    presence = random(seedFor(seed, "leaf-presence"));
  let leafIndex = 0;
  const branch = (
    points: Vec3[],
    radii: number[],
    parent: number | null = null,
    target = wood,
    sides = 5,
  ) => {
    const index = skeleton.length;
    for (let i = 1; i < points.length; i++) {
      skeleton.push({
        start: points[i - 1],
        end: points[i],
        radius: radii[i - 1],
        parent: i === 1 ? parent : skeleton.length - 1,
      });
    }
    target.tube(
      points,
      radii.map((radius) => (radius * trunkScale) / crownScale),
      options.quality === "economy"
        ? Math.max(3, Math.floor(sides * 0.65))
        : sides,
    );
    return index + points.length - 2;
  };
  const leaf = (a: Vec3, b: Vec3, w: number, curl = 0.08, choose = f) => {
    const tone = choose(),
      present = presence(),
      index = leafIndex++;
    if (
      present > options.leafDensity ||
      (options.quality === "economy" && index % 2)
    )
      return;
    (tone < 0.24 ? light : leaves).leaf(a, b, w, curl);
  };
  if (["broadleaf", "canopy", "acacia", "ancient"].includes(family)) {
    const h =
      family === "canopy"
        ? 8.3
        : family === "ancient"
          ? 5.8
          : family === "acacia"
            ? 4.6
            : 5.7;
    const bend = family === "ancient" ? 0.65 : 0.2;
    const axis: Vec3[] = Array.from({ length: 7 }, (_, i) => [
      Math.sin(i * 0.65) * bend * (i / 6),
      (i * h) / 6,
      Math.sin(i * 0.9 + 0.5) * bend * (i / 6),
    ]);
    axis[0][1] = -0.05;
    const main = branch(
      axis,
      [0.35, 0.29, 0.23, 0.19, 0.15, 0.09, 0.025].map(
        (v) => v * (family === "canopy" ? 1.3 : 1),
      ),
      null,
      trunk,
      8,
    );
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * Math.PI * 2 + 0.2 * r(),
        radius = family === "ancient" ? 1.55 : 1.1;
      const root: Vec3[] = [
        [0, 0.17, 0],
        [Math.cos(a) * radius * 0.48, 0.07, Math.sin(a) * radius * 0.48],
        [Math.cos(a) * radius, -0.055, Math.sin(a) * radius],
      ];
      branch(root, [0.17, 0.1, 0.02], 0);
      if (family === "canopy")
        wood.face(
          [
            [0, 1.2, 0],
            [Math.cos(a) * radius, -0.04, Math.sin(a) * radius],
            [Math.cos(a + 0.17) * radius, -0.04, Math.sin(a + 0.17) * radius],
          ],
          undefined,
          true,
        );
    }
    const limbCount =
      options.age === "sapling" ? 7 : options.age === "old" ? 18 : 13;
    if (options.algorithm === "attraction") {
      const guide = Array.from({ length: 4 }, (_, i) => {
          const t = 0.38 + i * 0.12;
          return lerpV(
            axis[Math.floor(t * 6)],
            axis[Math.floor(t * 6) + 1],
            (t * 6) % 1,
          );
        }),
        nodes = colonize(
          seedFor(seed, "attraction"),
          h,
          family === "canopy" ? 3.2 : 2.6,
          guide,
        ),
        counts = nodes.map(() => 1),
        parents = new Map<number, number>(),
        pruned = new Set(options.pruned);
      for (let i = nodes.length - 1; i >= 0; i--)
        if (nodes[i].parent !== null) counts[nodes[i].parent!] += counts[i];
      for (let i = 0; i < 4; i++)
        parents.set(i, Math.floor((0.38 + i * 0.12) * 6));
      for (let i = 4; i < nodes.length; i++) {
        const node = nodes[i],
          parent = node.parent!;
        if (pruned.has(parent)) pruned.add(i);
        if (pruned.has(i)) continue;
        const start = nodes[parent].position,
          radius = Math.max(0.012, Math.sqrt(counts[i]) * 0.018),
          index = branch(
            [start, node.position],
            [radius, radius * 0.7],
            parents.get(parent) ?? main,
            wood,
            4,
          );
        parents.set(i, index);
        if (counts[i] === 1)
          for (let j = 0; j < 4; j++) {
            const angle = j * Math.PI * 0.5 + f(),
              end = addV(node.position, [
                Math.cos(angle) * 0.65,
                0.12 + (f() - 0.5) * 0.2,
                Math.sin(angle) * 0.65,
              ]);
            leaf(node.position, end, 0.32);
          }
      }
    } else
      for (let j = 0; j < limbCount; j++) {
        const r = random(seedFor(seed, `limb-${j}`)),
          f = random(seedFor(seed, `limb-foliage-${j}`));
        if (options.pruned.includes(j)) continue;
        const a = j * 2.39996 + r() * 0.35;
        const level =
          family === "acacia" ? 0.61 : 0.47 + (j / limbCount) * 0.36;
        const anchor = lerpV(
          axis[Math.floor(level * 6)],
          axis[Math.floor(level * 6) + 1],
          (level * 6) % 1,
        );
        const reach =
          (family === "canopy" ? 2.5 : family === "ancient" ? 2.8 : 2.35) *
          (1 - j / 24) *
          (0.8 + r() * 0.4);
        const end: Vec3 = [
          anchor[0] + Math.cos(a) * reach,
          h * (family === "acacia" ? 0.87 : level + 0.19) + r() * 0.2,
          anchor[2] + Math.sin(a) * reach,
        ];
        const middle = lerpV(anchor, end, 0.56);
        middle[1] -= 0.28;
        const parent = branch(
          [anchor, middle, end],
          [0.13 * (1 - j / 20), 0.075, 0.025],
          Math.min(main, Math.floor(level * 6)),
        );
        for (let k = 0; k < 4; k++) {
          const ba = a + (k - 1.5) * 0.62;
          const start = lerpV(middle, end, 0.3 + k * 0.2);
          const finish: Vec3 = [
            start[0] + Math.cos(ba) * (0.6 + r() * 0.5),
            start[1] + (family === "acacia" ? 0.14 : 0.25 + r() * 0.4),
            start[2] + Math.sin(ba) * (0.6 + r() * 0.5),
          ];
          branch([start, finish], [0.024, 0.007], parent, wood, 4);
          for (let q = 0; q < (family === "acacia" ? 5 : 8); q++) {
            const at = lerpV(
                start,
                finish,
                0.1 + q * (family === "acacia" ? 0.21 : 0.125),
              ),
              angle = ba + (q % 2 ? 1 : -1) * (1.0 + f() * 0.5);
            const size =
              (family === "canopy" ? 0.86 : family === "acacia" ? 0.4 : 0.7) *
              (0.8 + f() * 0.4);
            leaf(
              at,
              [
                at[0] + Math.cos(angle) * size,
                at[1] + 0.08 + (f() - 0.5) * 0.32,
                at[2] + Math.sin(angle) * size,
              ],
              size * (family === "acacia" ? 0.4 : 0.58),
              0.08,
              f,
            );
          }
        }
      }
    if (family === "canopy") {
      const vine: Vec3[] = Array.from({ length: 24 }, (_, i) => {
        const y = (i / 23) * 0.6,
          a = y * 14;
        const center = lerpV(
          axis[Math.floor(y * 6)],
          axis[Math.floor(y * 6) + 1],
          (y * 6) % 1,
        );
        return addV(center, [Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32]);
      });
      branch(
        vine,
        vine.map(() => 0.021),
        0,
        wood,
        4,
      );
      for (let i = 2; i < vine.length; i += 3)
        leaf(vine[i], addV(vine[i], [0.23, 0.08, 0.2]), 0.18);
    }
  } else if (family === "palm") {
    const h = 5.4 + r() * 0.8;
    const axis: Vec3[] = Array.from({ length: 9 }, (_, i) => [
      Math.sin((i / 8) * 1.4) * 0.6,
      (i * h) / 8,
      Math.sin((i / 8) * 2) * 0.15,
    ]);
    const main = branch(
      axis,
      axis.map((_, i) => 0.2 - i * 0.012),
      null,
      trunk,
      8,
    );
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * Math.PI * 2,
        radius = 2.1 + r() * 0.5,
        top = axis.at(-1)!;
      const rib: Vec3[] = Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        return addV(top, [
          Math.cos(a) * radius * t,
          Math.sin(t * Math.PI) * 0.7 - t * 0.65,
          Math.sin(a) * radius * t,
        ]);
      });
      const parent = branch(
        rib,
        rib.map((_, i) => 0.052 - i * 0.006),
        main,
        wood,
        4,
      );
      void parent;
      for (let i = 1; i < 9; i++) {
        const t = i / 10,
          idx = Math.floor(t * 6),
          at = lerpV(rib[idx], rib[idx + 1], (t * 6) % 1);
        for (const side of [-1, 1]) {
          const dir = a + side * 1.08,
            len = (1 - t) * 0.9 + 0.18;
          leaf(
            at,
            addV(at, [
              Math.cos(dir) * len,
              -0.15 - len * 0.15,
              Math.sin(dir) * len,
            ]),
            0.11 + len * 0.07,
            0.05,
          );
        }
      }
    }
  } else if (family === "conifer") {
    const h = 6.5;
    const main = branch(
      [
        [0, -0.04, 0],
        [0.04, h * 0.55, 0],
        [0.1, h, 0],
      ],
      [0.22, 0.12, 0.018],
      null,
      trunk,
      7,
    );
    for (let row = 0; row < 8; row++)
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 + row * 0.65,
          y = 0.9 + row * 0.66,
          length = (h - y) * 0.35;
        const start: Vec3 = [0.04, y, 0],
          end: Vec3 = [Math.cos(a) * length, y + 0.18, Math.sin(a) * length];
        branch(
          [start, lerpV(start, end, 0.6), end],
          [0.056, 0.03, 0.006],
          main,
          wood,
          4,
        );
        for (let k = 1; k < 6; k++) {
          const at = lerpV(start, end, k / 6);
          for (const sign of [-1, 1])
            leaf(
              at,
              addV(at, [
                Math.cos(a + sign * 0.6) * 0.52,
                0.1,
                Math.sin(a + sign * 0.6) * 0.52,
              ]),
              0.28,
              0.02,
            );
        }
      }
  } else if (family === "fern") {
    for (let j = 0; j < 7; j++) {
      const a = j * 2.399,
        length = 0.85 + r() * 0.45;
      const rib: Vec3[] = Array.from({ length: 6 }, (_, i) => {
        const t = i / 5;
        return [
          Math.cos(a) * length * t,
          Math.sin(t * Math.PI * 0.8) * 0.7,
          Math.sin(a) * length * t,
        ];
      });
      branch(
        rib,
        rib.map(() => 0.01),
        null,
        wood,
        3,
      );
      for (let i = 1; i < 6; i++) {
        const t = i / 7,
          idx = Math.floor(t * 5),
          at = lerpV(rib[idx], rib[idx + 1], (t * 5) % 1);
        for (const side of [-1, 1])
          leaf(
            at,
            addV(at, [
              Math.cos(a + side * 1.05) * (1 - t) * 0.45,
              0.04,
              Math.sin(a + side * 1.05) * (1 - t) * 0.45,
            ]),
            0.095,
            0.03,
          );
      }
    }
  } else if (family === "broadleaf-herb" || family === "agave") {
    const agave = family === "agave";
    for (let j = 0; j < (agave ? 16 : 8); j++) {
      const a = j * 2.39996,
        length = agave ? 0.65 + r() * 0.5 : 1.0 + r() * 0.8;
      const base: Vec3 = [0, 0, 0],
        anchor: Vec3 = [
          Math.cos(a) * 0.15,
          agave ? 0.03 : 0.4 + r() * 0.45,
          Math.sin(a) * 0.15,
        ];
      branch([base, anchor], [0.025, 0.015], null, wood, 4);
      leaf(
        anchor,
        [
          Math.cos(a) * length,
          agave ? 0.25 + r() * 0.45 : 0.65 + r() * 0.65,
          Math.sin(a) * length,
        ],
        agave ? 0.2 : 0.55,
        agave ? 0.16 : 0.22,
      );
    }
  } else if (family === "cactus") {
    const h = 2.4 + r() * 0.8;
    trunk.lathe(
      [
        [0, -0.03],
        [0.23, 0],
        [0.27, 0.25],
        [0.22, h - 0.2],
        [0.14, h],
        [0, h + 0.05],
      ],
      24,
      (a) => 1 + 0.09 * Math.cos(a * 12),
    );
    for (const side of [-1, 1]) {
      branch(
        [
          [0, 0.75, 0],
          [side * 0.45, 0.75, 0],
          [side * 0.58, 1.08, 0],
          [side * 0.58, 1.8 + (side + 1) * 0.3, 0],
        ],
        [0.16, 0.16, 0.14, 0.07],
        0,
        trunk,
        10,
      );
    }
  } else if (family === "alien") {
    const main = branch(
      [
        [0, -0.03, 0],
        [0.12, 1.5, 0],
        [0.3, 2.8, 0.15],
      ],
      [0.27, 0.19, 0.11],
      null,
      trunk,
      8,
    );
    for (let j = 0; j < 5; j++) {
      const a = j * 2.39996;
      const start: Vec3 = [0.1, 1.15 + j * 0.28, 0],
        end: Vec3 = [Math.cos(a) * 1.5, 3.2 + (j % 2) * 0.5, Math.sin(a) * 1.5];
      const parent = branch(
        [start, addV(lerpV(start, end, 0.5), [0, -0.3, 0]), end],
        [0.14, 0.09, 0.028],
        main,
        wood,
        6,
      );
      for (let k = 0; k < 7; k++) {
        const angle = a + (k - 3) * 0.23;
        leaf(
          end,
          addV(end, [
            Math.cos(angle) * 1.35,
            0.2 + Math.sin((k / 6) * Math.PI) * 0.8,
            Math.sin(angle) * 1.35,
          ]),
          0.22,
          0.02,
        );
      }
      void parent;
    }
  } else if (family === "fungi") {
    for (let j = 0; j < 5; j++) {
      const x = (r() - 0.5) * 1.2,
        z = (r() - 0.5) * 1.2,
        h = 0.16 + r() * 0.55,
        rad = h * 0.7;
      branch(
        [
          [x, -0.02, z],
          [x + 0.04, h, z],
        ],
        [0.045, 0.03],
        null,
        wood,
        6,
      );
      const cap = new MeshBuilder();
      cap.lathe(
        [
          [0, -0.06],
          [rad * 0.75, -0.04],
          [rad, 0.02],
          [rad * 0.85, rad * 0.35],
          [rad * 0.45, rad * 0.65],
          [0, rad * 0.7],
        ],
        10,
      );
      const mesh = cap.build("cap", "Cap", "accent", "vegetation", false, [
        x + 0.04,
        h,
        z,
      ]);
      light.merge(mesh);
    }
  } else {
    for (let j = 0; j < 12; j++) {
      const a = r() * Math.PI * 2,
        len = 0.25 + r() * 0.4,
        at: Vec3 = [(r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2];
      const side: Vec3 = [Math.cos(a) * 0.022, 0, Math.sin(a) * 0.022];
      const tip = addV(at, [
        Math.cos(a) * len * 0.45,
        len,
        Math.sin(a) * len * 0.45,
      ]);
      leaves.face(
        [addV(at, side), addV(at, mulV(side, -1)), tip],
        [0, 0, 1, 0, 0.5, 1],
        true,
      );
    }
  }
  const meshes = [
    trunk.build(
      "trunk",
      `${family} · trunk`,
      family === "cactus" ? "foliage" : "bark",
      "vegetation",
      true,
    ),
    wood.build(
      "branches",
      `${family} · roots and branches`,
      family === "fungi" ? "fabric" : "bark",
      "vegetation",
    ),
    leaves.build(
      "leaves",
      `${family} · leaves`,
      family === "grass" ? "grass" : "foliage",
      "vegetation",
    ),
    light.build(
      "leaf-tips",
      `${family} · crown variation`,
      family === "fungi" ? "accent" : "foliageLight",
      "vegetation",
    ),
  ].filter((m) => m.positions.length);
  const transform = (point: Vec3): Vec3 => [
    (point[0] * crownScale + point[1] * options.lean) * scale,
    point[1] * heightScale * scale,
    point[2] * crownScale * scale,
  ];
  for (const mesh of meshes)
    for (let i = 0; i < mesh.positions.length; i += 3)
      mesh.positions.splice(
        i,
        3,
        ...transform(mesh.positions.slice(i, i + 3) as Vec3),
      );
  return {
    family,
    meshes,
    skeleton: skeleton.map((s) => ({
      ...s,
      start: transform(s.start),
      end: transform(s.end),
      radius: s.radius * scale * trunkScale,
    })),
  };
}
