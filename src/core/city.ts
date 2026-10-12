import {
  Project,
  MeshData,
  Vec3,
  Theme,
  Archetype,
  random,
  seedFor,
  preset,
  materialsFor,
} from "./project";
import { box } from "./mesh";
import { generatePlant } from "./plants";
import { terrainMeshes, channelX } from "./terrain";
export interface Plot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  park: boolean;
  seed: number;
  archetype: Archetype;
  theme: Theme;
  storeys: number;
}
export interface RoadNode {
  id: string;
  x: number;
  z: number;
}
export interface RoadEdge {
  id: string;
  from: string;
  to: string;
}
export interface CityPlan {
  plots: Plot[];
  nodes: RoadNode[];
  edges: RoadEdge[];
  extent: number;
  spacing: number;
}
export function cityPlan(p: Project): CityPlan {
  const n = p.world.blocks,
    spacing = p.world.blockSize + p.world.roadWidth + 2 * p.world.sidewalkWidth,
    start = (-n * spacing) / 2,
    nodes: RoadNode[] = [],
    edges: RoadEdge[] = [],
    plots: Plot[] = [];
  for (let z = 0; z <= n; z++)
    for (let x = 0; x <= n; x++) {
      const id = `junction-${x}-${z}`;
      nodes.push({ id, x: start + x * spacing, z: start + z * spacing });
      if (x < n)
        edges.push({
          id: `street-x-${x}-${z}`,
          from: id,
          to: `junction-${x + 1}-${z}`,
        });
      if (z < n)
        edges.push({
          id: `street-z-${x}-${z}`,
          from: id,
          to: `junction-${x}-${z + 1}`,
        });
    }
  for (let z = 0; z < n; z++)
    for (let x = 0; x < n; x++)
      for (let k = 0; k < 4; k++) {
        const id = `block-${x}-${z}-plot-${k}`,
          rng = random(seedFor(p.seed, id)),
          lock = p.world.locks[id],
          archetype: Archetype = (
            ["shop", "house", "flats", "villa", "mixed"] as const
          )[Math.floor(rng() * 5)],
          seed = Math.floor(rng() * 2147483647),
          storeys =
            archetype === "flats" || archetype === "mixed"
              ? 2 + Math.floor(rng() * 2)
              : archetype === "house"
                ? rng() > 0.5
                  ? 2
                  : 1
                : 1;
        const px =
            start +
            (x + 0.5) * spacing +
            (k % 2 ? 1 : -1) * p.world.blockSize * 0.25,
          pz =
            start +
            (z + 0.5) * spacing +
            (k < 2 ? -1 : 1) * p.world.blockSize * 0.25,
          river = p.effects.creek && Math.abs(px - channelX(p, pz)) < 8.5;
        if (river && lock && !lock.park)
          throw new Error(
            `Locked building ${id} conflicts with the creek corridor. Unlock it before generating the creek.`,
          );
        plots.push({
          id,
          x:
            start +
            (x + 0.5) * spacing +
            (k % 2 ? 1 : -1) * p.world.blockSize * 0.25,
          z:
            start +
            (z + 0.5) * spacing +
            (k < 2 ? -1 : 1) * p.world.blockSize * 0.25,
          yaw: k < 2 ? Math.PI : 0,
          park: river || lock?.park || (!lock && rng() < p.world.parkRatio),
          seed: lock?.seed ?? seed,
          archetype: lock?.archetype ?? archetype,
          theme: lock?.theme ?? p.theme,
          storeys: lock?.storeys ?? storeys,
        });
      }
  return {
    plots,
    nodes,
    edges,
    spacing,
    extent:
      (n * spacing) / 2 + p.world.roadWidth / 2 + p.world.sidewalkWidth + 4,
  };
}
function place(mesh: MeshData, plot: Plot): MeshData {
  const c = Math.cos(plot.yaw),
    s = Math.sin(plot.yaw),
    positions = mesh.positions.map((v, i) =>
      i % 3 === 0
        ? v * c - mesh.positions[i + 2] * s
        : i % 3 === 2
          ? mesh.positions[i - 2] * s + v * c
          : v,
    );
  const x = mesh.origin[0],
    z = mesh.origin[2];
  return {
    ...mesh,
    id: `${plot.id}-${mesh.id}`,
    doorId: mesh.doorId ? `${plot.id}-${mesh.doorId}` : undefined,
    origin: [plot.x + x * c - z * s, mesh.origin[1], plot.z + x * s + z * c],
    positions,
  };
}
export function buildCity(
  p: Project,
  single: (p: Project) => MeshData[],
): MeshData[] {
  const plan = cityPlan(p),
    parts: MeshData[] = [],
    road = p.world.roadWidth / 2,
    walk = p.world.sidewalkWidth;
  const add = (
    id: string,
    label: string,
    origin: Vec3,
    size: Vec3,
    material: MeshData["material"],
    solid = true,
    walkable = false,
  ) => {
    const m = box(id, label, origin, size, material, "site", solid);
    if (walkable) m.walkable = true;
    parts.push(m);
    return m;
  };
  parts.push(...terrainMeshes(p));
  const node = new Map(plan.nodes.map((n) => [n.id, n]));
  // Junctions own their square plate. Edge modules stop exactly at its boundary.
  for (const n of plan.nodes) {
    add(
      n.id,
      "Road intersection",
      [n.x, -0.02, n.z],
      [road * 2, 0.035, road * 2],
      "road",
      true,
      true,
    );
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        add(
          `${n.id}-pavement-${sx}-${sz}`,
          "Pavement corner",
          [n.x + sx * (road + walk / 2), -0.02, n.z + sz * (road + walk / 2)],
          [walk, 0.16, walk],
          "path",
          true,
          true,
        );
  }
  for (const e of plan.edges) {
    const a = node.get(e.from)!,
      b = node.get(e.to)!,
      alongX = a.z === b.z,
      length = plan.spacing - 2 * road,
      cx = (a.x + b.x) / 2,
      cz = (a.z + b.z) / 2;
    add(
      e.id,
      "Modular asphalt road",
      [cx, -0.02, cz],
      alongX ? [length, 0.035, road * 2] : [road * 2, 0.035, length],
      "road",
      true,
      true,
    );
    for (const side of [-1, 1]) {
      const position: Vec3 = alongX
        ? [cx, -0.02, cz + side * (road + walk / 2)]
        : [cx + side * (road + walk / 2), -0.02, cz];
      add(
        `${e.id}-pavement-${side}`,
        "Sidewalk strip",
        position,
        alongX
          ? [length - 2 * walk, 0.16, walk]
          : [walk, 0.16, length - 2 * walk],
        "path",
        true,
        true,
      );
      const kerb: Vec3 = alongX
        ? [cx, -0.02, cz + side * (road + 0.07)]
        : [cx + side * (road + 0.07), -0.02, cz];
      add(
        `${e.id}-kerb-${side}`,
        "Flush kerb",
        kerb,
        alongX ? [length, 0.16, 0.14] : [0.14, 0.16, length],
        "rock",
        true,
        true,
      );
      for (let i = 0; i < Math.floor(length / 3); i++) {
        const t = (i + 0.5) * 3 - length / 2;
        add(
          `${e.id}-dash-${side}-${i}`,
          "Lane marking",
          alongX
            ? [cx + t, 0.016, cz + side * 0.03]
            : [cx + side * 0.03, 0.016, cz + t],
          alongX ? [1.4, 0.002, 0.055] : [0.055, 0.002, 1.4],
          "marking",
          false,
        );
      }
      // Recessed crossing ramps at each approach, with a level transition of 12.5 cm.
      if (side === 1)
        for (const end of [-1, 1])
          for (let k = 0; k < 5; k++) {
            const t = end * (length / 2 - 1.4),
              cross = (k - 2) * road * 0.32;
            add(
              `${e.id}-crossing-${side}-${end}-${k}`,
              "Zebra crossing",
              alongX
                ? [cx + t, 0.016, cz + cross]
                : [cx + cross, 0.016, cz + t],
              alongX ? [0.38, 0.002, road * 0.24] : [road * 0.24, 0.002, 0.38],
              "marking",
              false,
            );
          }
    }
    add(
      `${e.id}-lamp-pole`,
      "Street lamp",
      alongX
        ? [cx, 0.14, cz + road + walk - 0.25]
        : [cx + road + walk - 0.25, 0.14, cz],
      [0.08, 3.8, 0.08],
      "trim",
    );
    add(
      `${e.id}-lamp-head`,
      "Street lamp head",
      alongX
        ? [cx, 3.94, cz + road + walk - 0.25]
        : [cx + road + walk - 0.25, 3.94, cz],
      [0.45, 0.1, 0.3],
      "accent",
      false,
    );
  }
  for (const plot of plan.plots) {
    if (plot.park) {
      add(
        `${plot.id}-park`,
        "Pocket park",
        [plot.x, -0.02, plot.z],
        [p.world.blockSize * 0.42, 0.05, p.world.blockSize * 0.42],
        "grass",
        true,
        true,
      );
      const rng = random(plot.seed);
      for (let k = 0; k < 4; k++) {
        const plant = generatePlant(
          p.biome === "tropical"
            ? "palm"
            : p.biome === "arid"
              ? "acacia"
              : p.biome === "alien"
                ? "alien"
                : "broadleaf",
          seedFor(plot.seed, `park-${k}`),
          0.8,
          p.plants,
        );
        const x = plot.x + (rng() - 0.5) * 8,
          z = plot.z + (rng() - 0.5) * 8;
        if (
          p.plantLandmarks.some(
            (pin) => Math.hypot(pin.x - x, pin.z - z) < 3 * pin.scale,
          )
        )
          continue;
        for (const m of plant.meshes)
          parts.push({
            ...m,
            id: `${plot.id}-plant-${k}-${m.id}`,
            origin: [x, 0.03, z],
          });
      }
      continue;
    }
    const recipe = preset(plot.archetype, plot.theme);
    if (plot.archetype === "villa") {
      recipe.structure.footprint = (
        ["rectangle", "l", "u", "courtyard"] as const
      )[plot.seed % 4];
      if (recipe.structure.footprint !== "rectangle") recipe.roof = "hip";
    }
    recipe.seed = plot.seed;
    recipe.textures = p.textures;
    recipe.materialOptions = p.materialOptions;
    recipe.surfaceSource = p.surfaceSource;
    recipe.structure = {
      ...recipe.structure,
      storeys: plot.storeys,
      doorAngle: p.structure.doorAngle,
      interior: p.structure.interior,
      windowWidth: p.structure.windowWidth,
      windowHeight: p.structure.windowHeight,
      windowSill: p.structure.windowSill,
      doorPoses: Object.fromEntries(
        Object.entries(p.structure.doorPoses)
          .filter(
            ([id]) => id.startsWith(plot.id + "-") || !id.startsWith("block-"),
          )
          .map(([id, angle]) => [
            id.startsWith(plot.id + "-") ? id.slice(plot.id.length + 1) : id,
            angle,
          ]),
      ),
    };
    recipe.landscape = { ...recipe.landscape, enabled: false, density: 0 };
    recipe.biome = p.biome;
    for (const m of single(recipe))
      if (
        m.category !== "site" &&
        m.category !== "landscape" &&
        m.category !== "vegetation"
      )
        parts.push(
          place(
            { ...m, materialColor: materialsFor(recipe)[m.material].color },
            plot,
          ),
        );
    const direction = plot.yaw ? -1 : 1,
      entranceX = recipe.structure.footprint === "l" ? -recipe.width / 3 : 0,
      front =
        plot.z +
        direction *
          (recipe.structure.footprint === "u"
            ? -recipe.depth / 6
            : recipe.depth / 2),
      streetZ =
        plot.z +
        direction * (plan.spacing / 2 - p.world.blockSize * 0.25 - road - walk);
    const length = Math.abs(streetZ - front);
    add(
      `${plot.id}-entrance-path`,
      "Pavement to entrance",
      [plot.x + direction * entranceX, -0.02, (front + streetZ) / 2],
      [2, 0.16, length],
      "path",
      true,
      true,
    );
  }
  return parts;
}
