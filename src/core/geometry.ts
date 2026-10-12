import { MeshData, Project, Vec3 } from "./project";
import { buildLandscape } from "./landscape";
import { decorateBuilding } from "./architecture";
import { buildBuilding } from "./building";
import { buildCity } from "./city";
import { bakeTerrain } from "./terrain";
import { buildMassing } from "./massing";
import { buildEffects } from "./effects";
import { buildModules } from "./modules";
import { buildSigns } from "./signs";
export interface Bounds {
  min: Vec3;
  max: Vec3;
}
import { box, MeshBuilder } from "./mesh";
export { box } from "./mesh";
interface Opening {
  left: number;
  right: number;
  bottom: number;
  top: number;
  kind: "door" | "window";
}
export function buildScene(p: Project, bake = true): MeshData[] {
  const source = buildRawScene(p);
  const parts = [
    ...(p.world.enabled
      ? source
      : p.kit.buildingEnabled
        ? buildMassing(p, source)
        : buildLandscape(p)),
    ...buildModules(p),
    ...(p.world.enabled ? [] : buildSigns(p)),
    ...buildEffects(p),
  ];
  return bake ? bakeTerrain(p, parts) : parts;
}
function buildRawScene(p: Project): MeshData[] {
  if (p.world.enabled)
    return buildCity(p, (recipe) =>
      buildMassing(recipe, buildBuilding(recipe, buildSingleLevel)),
    );
  if (p.structure.storeys === 1) return buildBuilding(p, buildSingleLevel);
  return [...buildLandscape(p), ...buildBuilding(p, buildSingleLevel)];
}
function buildSingleLevel(p: Project): MeshData[] {
  const parts: MeshData[] = [],
    floor = 0.16,
    t = p.wallThickness,
    w = p.width,
    d = p.depth,
    h = p.height;
  const add = (
    id: string,
    label: string,
    origin: Vec3,
    size: Vec3,
    mat: MeshData["material"],
    cat?: MeshData["category"],
    solid?: boolean,
  ) => parts.push(box(id, label, origin, size, mat, cat, solid));
  if (!p.landscape.enabled)
    add(
      "site-ground",
      "Parcel ground",
      [0, -0.14, 0],
      [w + 10, 0.12, d + 10],
      "ground",
      "site",
    );
  add(
    "building-floor",
    "Interior floor",
    [0, -0.04, 0],
    [w, floor + 0.04, d],
    "floor",
  );
  add(
    "entry-step",
    "Entrance apron",
    [0, -0.04, d / 2 + 0.6],
    [p.doorWidth + 0.5, floor + 0.04, 1.2],
    "floor",
  );
  const availableWindowSpan = w / 2 - t - p.doorWidth / 2 - 0.2,
    windowWidth = Math.min(
      p.structure.windowWidth,
      w * 0.18,
      availableWindowSpan - 0.08,
    ),
    doorHeight = Math.min(2.35, h - 0.25);
  const front: Opening[] = [
    {
      left: -p.doorWidth / 2,
      right: p.doorWidth / 2,
      bottom: 0,
      top: doorHeight,
      kind: "door",
    },
  ];
  if (p.archetype === "mixed") {
    front.length = 0;
    for (const side of [-1, 1])
      front.push({
        left: side * w * 0.22 - p.doorWidth / 2,
        right: side * w * 0.22 + p.doorWidth / 2,
        bottom: 0,
        top: doorHeight,
        kind: "door",
      });
  }
  if (p.archetype === "mixed" && p.windows)
    front.push({
      left: -windowWidth / 2,
      right: windowWidth / 2,
      bottom: p.structure.windowSill,
      top: Math.min(
        h - 0.15,
        p.structure.windowSill + p.structure.windowHeight,
      ),
      kind: "window",
    });
  else if (p.windows && availableWindowSpan >= 0.35)
    for (const direction of [-1, 1]) {
      const center =
        direction * (p.doorWidth / 2 + 0.1 + availableWindowSpan / 2);
      front.push({
        left: center - windowWidth / 2,
        right: center + windowWidth / 2,
        bottom: p.structure.windowSill,
        top: Math.min(
          h - 0.15,
          p.structure.windowSill + p.structure.windowHeight,
        ),
        kind: "window",
      });
    }
  const sideWindow: Opening[] = p.windows
    ? [
        {
          left: -p.structure.windowWidth / 2,
          right: p.structure.windowWidth / 2,
          bottom: p.structure.windowSill,
          top: Math.min(
            h - 0.15,
            p.structure.windowSill + p.structure.windowHeight,
          ),
          kind: "window",
        },
      ]
    : [];
  const wall = (
    name: string,
    length: number,
    axis: "x" | "z",
    fixed: number,
    openings: Opening[],
  ) => {
    const xs = [
      ...new Set([
        -length / 2,
        length / 2,
        ...openings.flatMap((o) => [o.left, o.right]),
      ]),
    ].sort((a, b) => a - b);
    const ys = [
      ...new Set([0, h, ...openings.flatMap((o) => [o.bottom, o.top])]),
    ].sort((a, b) => a - b);
    let n = 0;
    for (let xi = 0; xi < xs.length - 1; xi++)
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const a = xs[xi],
          b = xs[xi + 1],
          c = ys[yi],
          e = ys[yi + 1],
          midx = (a + b) / 2,
          midy = (c + e) / 2;
        if (
          openings.some(
            (o) =>
              midx > o.left &&
              midx < o.right &&
              midy > o.bottom &&
              midy < o.top,
          )
        )
          continue;
        add(
          `${name}-${n++}`,
          `${name.replaceAll("-", " ")} · panel ${n}`,
          axis === "x" ? [midx, floor + c, fixed] : [fixed, floor + c, midx],
          axis === "x" ? [b - a, e - c, t] : [t, e - c, b - a],
          "wall",
        );
      }
    openings.forEach((o, i) => {
      const c = (o.left + o.right) / 2,
        ow = o.right - o.left,
        oh = o.top - o.bottom,
        b = 0.065;
      const put = (
        suffix: string,
        along: number,
        y: number,
        width: number,
        height: number,
        mat: MeshData["material"],
        solid = true,
      ) =>
        add(
          `${name}-${o.kind}-${i}-${suffix}`,
          `${o.kind} ${suffix}`,
          axis === "x" ? [along, floor + y, fixed] : [fixed, floor + y, along],
          axis === "x" ? [width, height, t + 0.07] : [t + 0.07, height, width],
          mat,
          "windows",
          solid,
        );
      put("left-frame", o.left + b / 2, o.bottom, b, oh, "trim");
      put("right-frame", o.right - b / 2, o.bottom, b, oh, "trim");
      put("head", c, o.top - b, ow, b, "trim");
      if (o.kind === "window") {
        put("sill", c, o.bottom, ow, b, "trim");
        put("mullion", c, o.bottom, b, oh, "trim");
        add(
          `${name}-glass-${i}`,
          "Window glass",
          axis === "x"
            ? [c, floor + o.bottom + b, fixed]
            : [fixed, floor + o.bottom + b, c],
          axis === "x"
            ? [ow - 2 * b, oh - 2 * b, 0.025]
            : [0.025, oh - 2 * b, ow - 2 * b],
          "glass",
          "windows",
          true,
        );
      }
    });
  };
  wall("wall-front", w, "x", d / 2 - t / 2, front);
  wall("wall-back", w, "x", -d / 2 + t / 2, []);
  wall("wall-left", d - 2 * t, "z", -w / 2 + t / 2, sideWindow);
  wall("wall-right", d - 2 * t, "z", w / 2 - t / 2, sideWindow);
  if (p.roof !== "none") {
    add("ceiling", "Ceiling", [0, floor + h, 0], [w, 0.12, d], "wall", "roof");
    if (p.roof === "flat")
      add(
        "roof",
        "Flat roof",
        [0, floor + h + 0.12, 0],
        [w + 0.4, 0.18, d + 0.4],
        "roof",
        "roof",
      );
    else if (p.roof === "shed" || p.roof === "hip") {
      const x = w / 2 + 0.3,
        z = d / 2 + 0.3,
        rise = Math.min(2, w * 0.22),
        r = new MeshBuilder();
      const a: Vec3 = [-x, 0, z],
        b: Vec3 = [x, 0, z],
        c: Vec3 = [x, 0, -z],
        e: Vec3 = [-x, 0, -z];
      if (p.roof === "shed") {
        const aa: Vec3 = [-x, rise, z],
          ee: Vec3 = [-x, rise, -z];
        r.face([aa, b, c, ee]);
        r.face([a, b, aa]);
        r.face([c, e, ee]);
        r.face([e, a, aa, ee]);
      } else {
        const ridge = Math.max(0, z - x),
          n: Vec3 = [0, rise, ridge],
          s: Vec3 = [0, rise, -ridge];
        r.face([a, b, n]);
        r.face([c, e, s]);
        if (ridge > 0.001) {
          r.face([b, c, s, n]);
          r.face([e, a, n, s]);
        } else {
          r.face([b, c, n]);
          r.face([e, a, n]);
        }
      }
      r.face([e, c, b, a]);
      const roof = r.build("roof", `${p.roof} roof`, "roof", "roof", true);
      roof.origin = [0, floor + h + 0.12, 0];
      parts.push(roof);
    } else {
      const overhang =
          p.theme === "jungle" ? 0.75 : p.theme === "fantasy" ? 0.4 : 0.25,
        x = w / 2 + overhang,
        z = d / 2 + overhang,
        rise =
          p.theme === "fantasy"
            ? Math.min(3.2, w * 0.35)
            : Math.min(2, w * 0.22),
        positions = [
          -x,
          0,
          z,
          x,
          0,
          z,
          0,
          rise,
          z,
          x,
          0,
          -z,
          -x,
          0,
          -z,
          0,
          rise,
          -z,
          -x,
          0,
          -z,
          -x,
          0,
          z,
          0,
          rise,
          z,
          0,
          rise,
          -z,
          x,
          0,
          z,
          x,
          0,
          -z,
          0,
          rise,
          -z,
          0,
          rise,
          z,
          -x,
          0,
          -z,
          x,
          0,
          -z,
          x,
          0,
          z,
          -x,
          0,
          z,
        ];
      parts.push({
        id: "roof",
        label: "Gable roof",
        origin: [0, floor + h + 0.12, 0],
        positions,
        uvs: [
          0,
          0,
          w,
          0,
          w / 2,
          rise,
          0,
          0,
          w,
          0,
          w / 2,
          rise,
          0,
          0,
          d,
          0,
          d,
          rise,
          0,
          rise,
          0,
          0,
          d,
          0,
          d,
          rise,
          0,
          rise,
          0,
          0,
          w,
          0,
          w,
          d,
          0,
          d,
        ],
        indices: [
          0, 1, 2, 3, 4, 5, 6, 7, 8, 6, 8, 9, 10, 11, 12, 10, 12, 13, 14, 15,
          16, 14, 16, 17,
        ],
        material: "roof",
        category: "roof",
        solid: true,
      });
    }
  }
  if ((p.archetype === "shop" || p.archetype === "mixed") && p.sign)
    add(
      "shop-sign",
      "Billboard / shop sign",
      [0, floor + doorHeight + 0.12, d / 2 + 0.055],
      [Math.min(w - 0.7, 5.5), 0.48, 0.09],
      "sign",
      "structure",
      false,
    );
  if (p.furnished) {
    if (p.archetype === "shop" || p.archetype === "mixed") {
      add(
        "counter",
        "Shop counter",
        [w / 2 - 1.25, floor, -0.7],
        [1.3, 0.94, d * 0.42],
        "trim",
        "interior",
      );
      for (let i = 0; i < 3; i++)
        add(
          `shelf-${i}`,
          `Display shelf ${i + 1}`,
          [-w / 2 + t + 0.4, floor + 0.4 + i * 0.6, -0.7],
          [0.75, 0.08, d * 0.42],
          "floor",
          "interior",
        );
      const tx = Math.max(-0.8, -w / 2 + t + 1.0),
        tz = -d / 2 + 1.2;
      add(
        "display-table",
        "Display tabletop",
        [tx, floor + 0.74, tz],
        [1.8, 0.08, 0.8],
        "floor",
        "interior",
      );
      for (const x of [-0.78, 0.78])
        for (const z of [-0.28, 0.28])
          add(
            `table-leg-${x}-${z}`,
            "Table leg",
            [tx + x, floor, tz + z],
            [0.08, 0.74, 0.08],
            "trim",
            "interior",
          );
    } else {
      add(
        "table",
        "Dining table",
        [0, floor, -d / 2 + 1.7],
        [2, 0.78, 1.1],
        "floor",
        "interior",
      );
      add(
        "sofa",
        "Sofa",
        [w / 2 - 1.1, floor, 0],
        [1.2, 0.78, 2.3],
        "trim",
        "interior",
      );
      add(
        "bed",
        "Bed",
        [-w / 2 + 1.7, floor, -d / 2 + 1.6],
        [2, 0.5, 2.4],
        "floor",
        "interior",
      );
    }
  }
  return [...buildLandscape(p), ...decorateBuilding(p, parts)];
}
const boundsCache = new WeakMap<MeshData, Bounds>();
const collisionIndex = new WeakMap<MeshData[], Map<string, MeshData[]>>();
function nearby(meshes: MeshData[], x: number, z: number): MeshData[] {
  let grid = collisionIndex.get(meshes);
  if (!grid) {
    grid = new Map();
    for (const mesh of meshes) {
      if (!mesh.solid) continue;
      const b = bounds(mesh);
      for (
        let cx = Math.floor(b.min[0] / 5);
        cx <= Math.floor(b.max[0] / 5);
        cx++
      )
        for (
          let cz = Math.floor(b.min[2] / 5);
          cz <= Math.floor(b.max[2] / 5);
          cz++
        ) {
          const key = `${cx},${cz}`,
            list = grid.get(key) ?? [];
          list.push(mesh);
          grid.set(key, list);
        }
    }
    collisionIndex.set(meshes, grid);
  }
  const result = new Set<MeshData>();
  for (
    let cx = Math.floor((x - 0.25) / 5);
    cx <= Math.floor((x + 0.25) / 5);
    cx++
  )
    for (
      let cz = Math.floor((z - 0.25) / 5);
      cz <= Math.floor((z + 0.25) / 5);
      cz++
    )
      for (const m of grid.get(`${cx},${cz}`) ?? []) result.add(m);
  return [...result];
}
const groundIndex = new WeakMap<MeshData, Map<string, number[]>>();
function triangleHeight(mesh: MeshData, x: number, z: number): number {
  let grid = groundIndex.get(mesh);
  if (!grid) {
    grid = new Map();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const ids = mesh.indices.slice(i, i + 3).map((n) => n * 3);
      const xs = ids.map((n) => mesh.positions[n]),
        zs = ids.map((n) => mesh.positions[n + 2]);
      if (
        Math.abs(
          (xs[1] - xs[0]) * (zs[2] - zs[0]) - (xs[2] - xs[0]) * (zs[1] - zs[0]),
        ) < 1e-10
      )
        continue;
      for (
        let cx = Math.floor(Math.min(...xs));
        cx <= Math.floor(Math.max(...xs));
        cx++
      )
        for (
          let cz = Math.floor(Math.min(...zs));
          cz <= Math.floor(Math.max(...zs));
          cz++
        ) {
          const key = `${cx},${cz}`,
            list = grid.get(key) ?? [];
          list.push(i);
          grid.set(key, list);
        }
    }
    groundIndex.set(mesh, grid);
  }
  const xx = x - mesh.origin[0],
    zz = z - mesh.origin[2];
  let top = -Infinity;
  for (const i of grid.get(`${Math.floor(xx)},${Math.floor(zz)}`) ?? []) {
    const ids = mesh.indices.slice(i, i + 3).map((n) => n * 3),
      xs = ids.map((n) => mesh.positions[n]),
      zs = ids.map((n) => mesh.positions[n + 2]);
    const denominator =
      (zs[1] - zs[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (zs[0] - zs[2]);
    const a =
      ((zs[1] - zs[2]) * (xx - xs[2]) + (xs[2] - xs[1]) * (zz - zs[2])) /
      denominator;
    const b =
      ((zs[2] - zs[0]) * (xx - xs[2]) + (xs[0] - xs[2]) * (zz - zs[2])) /
      denominator;
    if (a >= -1e-8 && b >= -1e-8 && a + b <= 1 + 1e-8)
      top = Math.max(
        top,
        a * mesh.positions[ids[0] + 1] +
          b * mesh.positions[ids[1] + 1] +
          (1 - a - b) * mesh.positions[ids[2] + 1] +
          mesh.origin[1],
      );
  }
  return top;
}
export function bounds(mesh: MeshData): Bounds {
  const cached = boundsCache.get(mesh);
  if (cached) return cached;
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const n = mesh.positions[i + j] + mesh.origin[j];
      min[j] = Math.min(min[j], n);
      max[j] = Math.max(max[j], n);
    }
  const result = { min, max };
  boundsCache.set(mesh, result);
  return result;
}
export function canStand(
  x: number,
  z: number,
  eyeY: number,
  meshes: MeshData[],
  radius = 0.24,
  eyeHeight = 1.68,
): boolean {
  const feet = eyeY - eyeHeight + 0.04,
    top = eyeY + 0.12;
  return !nearby(meshes, x, z).some((m) => {
    if (!m.solid || m.id === "site-ground" || m.surfaceMesh) return false;
    const b = bounds(m);
    if (b.max[1] <= feet || b.min[1] >= top) return false;
    const nx = Math.max(b.min[0], Math.min(x, b.max[0])),
      nz = Math.max(b.min[2], Math.min(z, b.max[2]));
    return (x - nx) ** 2 + (z - nz) ** 2 < radius ** 2;
  });
}
export function moveWalker(
  position: Vec3,
  delta: [number, number],
  meshes: MeshData[],
): Vec3 {
  let [x, y, z] = position;
  const steps = Math.max(1, Math.ceil(Math.hypot(...delta) / 0.08));
  const surface = (xx: number, zz: number) => {
    let top = -Infinity;
    for (const m of nearby(meshes, xx, zz)) {
      if (
        !m.solid ||
        (!m.walkable &&
          m.id !== "site-ground" &&
          m.id !== "building-floor" &&
          m.id !== "entry-step")
      )
        continue;
      const b = bounds(m);
      if (m.id === "site-ground" || m.surfaceMesh) {
        if (xx < b.min[0] || xx > b.max[0] || zz < b.min[2] || zz > b.max[2])
          continue;
        const height = triangleHeight(m, xx, zz);
        if (height <= y - 1.68 + 0.25) top = Math.max(top, height);
      } else {
        const closestX = Math.max(b.min[0], Math.min(xx, b.max[0])),
          closestZ = Math.max(b.min[2], Math.min(zz, b.max[2]));
        if (
          (xx - closestX) ** 2 + (zz - closestZ) ** 2 < 0.24 ** 2 &&
          b.max[1] <= y - 1.68 + 0.25
        )
          top = Math.max(top, b.max[1]);
      }
    }
    return top + 1.68;
  };
  for (let i = 0; i < steps; i++) {
    const nx = x + delta[0] / steps,
      nz = z + delta[1] / steps,
      xy = surface(nx, z);
    if (
      Number.isFinite(xy) &&
      Math.abs(xy - y) <= 0.25 &&
      canStand(nx, z, xy, meshes)
    ) {
      x = nx;
      y = xy;
    }
    const zy = surface(x, nz);
    if (
      Number.isFinite(zy) &&
      Math.abs(zy - y) <= 0.25 &&
      canStand(x, nz, zy, meshes)
    ) {
      z = nz;
      y = zy;
    }
  }
  return [x, y, z];
}

/** Find a supported, unobstructed inspection spawn from actual generated geometry. */
export function findWalkSpawn(
  meshes: MeshData[],
  preferred: Vec3,
): Vec3 | null {
  const candidates: Vec3[] = [];
  for (const mesh of meshes) {
    if (!mesh.solid || !mesh.walkable) continue;
    const b = bounds(mesh);
    const points: [number, number][] = [
      [
        Math.max(b.min[0], Math.min(preferred[0], b.max[0])),
        Math.max(b.min[2], Math.min(preferred[2], b.max[2])),
      ],
      [(b.min[0] + b.max[0]) / 2, (b.min[2] + b.max[2]) / 2],
    ];
    if (mesh.surfaceMesh)
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const ids = mesh.indices.slice(i, i + 3);
        points.push([
          ids.reduce((n, id) => n + mesh.positions[id * 3], 0) / 3 +
            mesh.origin[0],
          ids.reduce((n, id) => n + mesh.positions[id * 3 + 2], 0) / 3 +
            mesh.origin[2],
        ]);
      }
    for (const [x, z] of points) {
      const height = mesh.surfaceMesh ? triangleHeight(mesh, x, z) : b.max[1];
      if (Number.isFinite(height) && canStand(x, z, height + 1.68, meshes))
        candidates.push([x, height + 1.68, z]);
    }
  }
  candidates.sort(
    (a, b) =>
      Math.hypot(a[0] - preferred[0], a[2] - preferred[2]) +
      Math.abs(a[1] - preferred[1]) * 0.5 -
      (Math.hypot(b[0] - preferred[0], b[2] - preferred[2]) +
        Math.abs(b[1] - preferred[1]) * 0.5),
  );
  return candidates[0] ?? null;
}
