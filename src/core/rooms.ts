import { AuthoredRoom, MeshData, Project, Vec3, seedFor } from "./project";
import { bounds, canStand } from "./geometry";
import { box } from "./mesh";
import {
  buildingDoor,
  floorElevation,
  stairPlan,
  Room,
  Connection,
} from "./building";
import { footprintCells } from "./footprints";
type Edge = {
  axis: "x" | "z";
  coord: number;
  lo: number;
  hi: number;
  room: AuthoredRoom;
  door?: { lo: number; hi: number };
};
const rectangle = (room: AuthoredRoom) => ({
  x0: room.x - room.width / 2,
  x1: room.x + room.width / 2,
  z0: room.z - room.depth / 2,
  z1: room.z + room.depth / 2,
});
function edges(room: AuthoredRoom): Edge[] {
  const r = rectangle(room);
  return (
    [
      ["x", r.z1, r.x0, r.x1, "front"],
      ["x", r.z0, r.x0, r.x1, "back"],
      ["z", r.x0, r.z0, r.z1, "left"],
      ["z", r.x1, r.z0, r.z1, "right"],
    ] as const
  ).map(([axis, coord, lo, hi, side]) => ({
    axis,
    coord,
    lo,
    hi,
    room,
    door:
      side === room.doorSide
        ? {
            lo: (lo + hi) / 2 + room.doorOffset - room.doorWidth / 2,
            hi: (lo + hi) / 2 + room.doorOffset + room.doorWidth / 2,
          }
        : undefined,
  }));
}
export function validateRoomLayout(p: Project): void {
  const rooms = p.rooms;
  if (!rooms.length) return;
  if (!p.kit.buildingEnabled)
    throw new Error("Authored rooms require a supporting building.");
  const stair = p.structure.storeys > 1 ? stairPlan(p) : null,
    inside = (x: number, z: number) =>
      Math.abs(x) <= p.width / 2 - p.wallThickness - 0.1 &&
      Math.abs(z) <= p.depth / 2 - p.wallThickness - 0.1 &&
      footprintCells(p).some(
        (c) =>
          x >= -p.width / 2 + (c.x * p.width) / 3 &&
          x <= -p.width / 2 + ((c.x + 1) * p.width) / 3 &&
          z >= -p.depth / 2 + (c.z * p.depth) / 3 &&
          z <= -p.depth / 2 + ((c.z + 1) * p.depth) / 3,
      );
  for (const room of rooms) {
    if (room.level >= p.structure.storeys)
      throw new Error(
        `${room.name} is on a missing storey. Move or remove the room.`,
      );
    const r = rectangle(room);
    const nx = Math.ceil(room.width / 0.5),
      nz = Math.ceil(room.depth / 0.5);
    for (let ix = 0; ix <= nx; ix++)
      for (let iz = 0; iz <= nz; iz++)
        if (
          !inside(r.x0 + (room.width * ix) / nx, r.z0 + (room.depth * iz) / nz)
        )
          throw new Error(
            `${room.name} crosses the facade or a courtyard void. Resize or relocate it.`,
          );
    if (
      stair &&
      r.x1 > stair.x0 - 0.3 &&
      r.x0 < stair.x1 + 0.3 &&
      r.z1 > stair.z0 - 0.3 &&
      r.z0 < stair.z1 + 0.9
    )
      throw new Error(
        `${room.name} occupies the reserved stair core or landing. Relocate the room.`,
      );
    for (const edge of edges(room))
      if (
        edge.door &&
        (edge.door.lo < edge.lo + 0.12 || edge.door.hi > edge.hi - 0.12)
      )
        throw new Error(`${room.name} doorway does not fit its wall.`);
    for (const other of rooms) {
      if (room.id >= other.id || room.level !== other.level) continue;
      const o = rectangle(other);
      if (
        r.x0 < o.x1 - 1e-6 &&
        r.x1 > o.x0 + 1e-6 &&
        r.z0 < o.z1 - 1e-6 &&
        r.z1 > o.z0 + 1e-6
      )
        throw new Error(
          `${room.name} overlaps ${other.name}. Shared boundaries may touch, room areas may not overlap.`,
        );
    }
  }
}
export function authoredRoomTopology(p: Project): {
  rooms: Room[];
  connections: Connection[];
} {
  const rooms: Room[] = Array.from(
    { length: p.structure.storeys },
    (_, level) => ({
      id: `common-${level}`,
      name: `Common circulation ${level + 1}`,
      level,
      type: "circulation",
      center: [0, 0],
    }),
  );
  rooms.unshift({
    id: "outside",
    name: "Outside",
    level: -1,
    type: "outside",
    center: [0, p.depth / 2 + 1],
  });
  rooms.push(
    ...p.rooms.map((room) => ({
      id: room.id,
      name: room.name,
      level: room.level,
      type: room.type,
      center: [room.x, room.z] as [number, number],
    })),
  );
  const connections: Connection[] = p.rooms.map((room) => {
    const edge = edges(room).find((e) => e.door)!,
      center = (edge.door!.lo + edge.door!.hi) / 2,
      point =
        edge.axis === "x"
          ? [center, edge.coord + (room.doorSide === "front" ? 0.3 : -0.3)]
          : [edge.coord + (room.doorSide === "right" ? 0.3 : -0.3), center];
    const neighbor = p.rooms.find((other) => {
      if (other.id === room.id || other.level !== room.level) return false;
      const r = rectangle(other);
      return (
        point[0] > r.x0 && point[0] < r.x1 && point[1] > r.z0 && point[1] < r.z1
      );
    });
    return {
      from: room.id,
      to: neighbor?.id ?? `common-${room.level}`,
      kind: "door",
    };
  });
  connections.unshift({ from: "outside", to: "common-0", kind: "opening" });
  for (let level = 1; level < p.structure.storeys; level++)
    connections.push({
      from: `common-${level - 1}`,
      to: `common-${level}`,
      kind: "stair",
    });
  return { rooms, connections };
}
export function buildRooms(p: Project): MeshData[] {
  validateRoomLayout(p);
  const parts: MeshData[] = [],
    lines = new Map<string, Edge[]>();
  for (const room of [...p.rooms].sort((a, b) => a.id.localeCompare(b.id)))
    for (const edge of edges(room)) {
      const key = `${room.level}:${edge.axis}:${edge.coord.toFixed(4)}`,
        list = lines.get(key) ?? [];
      list.push(edge);
      lines.set(key, list);
    }
  for (const [key, list] of [...lines].sort(([a], [b]) => a.localeCompare(b))) {
    const { axis, coord, room } = list[0],
      level = room.level,
      y = floorElevation(p, level),
      cuts = [
        ...new Set(
          list.flatMap((e) => [
            e.lo,
            e.hi,
            ...(e.door ? [e.door.lo, e.door.hi] : []),
          ]),
        ),
      ].sort((a, b) => a - b);
    for (let i = 1; i < cuts.length; i++) {
      const lo = cuts[i - 1],
        hi = cuts[i],
        mid = (lo + hi) / 2,
        owner = list.find((e) => mid > e.lo - 1e-6 && mid < e.hi + 1e-6);
      if (!owner || hi - lo < 1e-6) continue;
      const aperture = list.some(
          (e) => e.door && mid > e.door.lo - 1e-6 && mid < e.door.hi + 1e-6,
        ),
        bottom = aperture ? 2.3 : 0,
        height = p.height - bottom;
      if (height <= 0)
        throw new Error("Room door head exceeds the storey height.");
      const wall = box(
        `room-wall-${seedFor(0, key + "-" + lo + "-" + hi)}`,
        `Shared room wall · ${owner.room.name}`,
        axis === "x" ? [mid, y + bottom, coord] : [coord, y + bottom, mid],
        axis === "x" ? [hi - lo, height, 0.12] : [0.12, height, hi - lo],
        owner.room.finish,
        "structure",
        true,
      );
      wall.level = level;
      wall.roomIds = [
        ...new Set(
          list
            .filter((edge) => mid > edge.lo - 1e-6 && mid < edge.hi + 1e-6)
            .map((edge) => edge.room.id),
        ),
      ];
      parts.push(wall);
    }
    const apertures = list.filter((edge) => edge.door);
    for (let a = 0; a < apertures.length; a++)
      for (let b = a + 1; b < apertures.length; b++) {
        const first = apertures[a].door!,
          second = apertures[b].door!;
        if (
          first.lo < second.hi &&
          first.hi > second.lo &&
          (Math.abs(first.lo - second.lo) > 1e-6 ||
            Math.abs(first.hi - second.hi) > 1e-6)
        )
          throw new Error(
            "Shared doorway cuts overlap with different widths or offsets. Align or separate the doorways.",
          );
      }
    const portals = new Map<string, Edge>();
    for (const edge of list)
      if (edge.door) portals.set(`${edge.door.lo}:${edge.door.hi}`, edge);
    for (const [portal, edge] of portals) {
      const center = (edge.door!.lo + edge.door!.hi) / 2,
        id = `room-door-${seedFor(0, key + "-" + portal)}`,
        leaf = buildingDoor(
          id,
          0,
          y,
          0,
          edge.room.doorWidth - 0.1,
          2.24,
          p.structure.doorPoses[id] ?? p.structure.doorAngle,
        ),
        yaw = axis === "x" ? 0 : Math.PI / 2,
        origin: Vec3 = axis === "x" ? [center, y, coord] : [coord, y, center];
      for (let i = 0; i < leaf.positions.length; i += 3) {
        const x = leaf.positions[i] + leaf.origin[0],
          z = leaf.positions[i + 2] + leaf.origin[2];
        leaf.positions[i] = x * Math.cos(yaw) - z * Math.sin(yaw);
        leaf.positions[i + 2] = x * Math.sin(yaw) + z * Math.cos(yaw);
      }
      leaf.origin = origin;
      leaf.label = `Door · ${edge.room.name}`;
      leaf.level = level;
      const roomIds = [
        ...new Set(
          list
            .filter(
              (edge) => center > edge.lo - 1e-6 && center < edge.hi + 1e-6,
            )
            .map((edge) => edge.room.id),
        ),
      ];
      leaf.roomIds = roomIds;
      for (const side of [-1, 1]) {
        const offset = side * (edge.room.doorWidth / 2 + 0.02),
          jamb = box(
            `${id}-jamb-${side}`,
            `Door jamb · ${edge.room.name}`,
            axis === "x"
              ? [center + offset, y, coord]
              : [coord, y, center + offset],
            axis === "x" ? [0.04, 2.3, 0.16] : [0.16, 2.3, 0.04],
            "trim",
            "interior",
            true,
          );
        jamb.level = level;
        jamb.roomIds = roomIds;
        parts.push(jamb);
      }
      const lintel = box(
        `${id}-frame-head`,
        `Door frame head · ${edge.room.name}`,
        axis === "x" ? [center, y + 2.3, coord] : [coord, y + 2.3, center],
        axis === "x"
          ? [edge.room.doorWidth + 0.08, 0.05, 0.16]
          : [0.16, 0.05, edge.room.doorWidth + 0.08],
        "trim",
        "interior",
        false,
      );
      lintel.level = level;
      lintel.roomIds = roomIds;
      parts.push(lintel);
      parts.push(leaf);
    }
  }
  for (const room of p.rooms)
    if (room.furnished && p.furnished && p.structure.interior === "furnished")
      parts.push(...furnishRoom(p, room));
  return parts;
}
function furnishRoom(p: Project, room: AuthoredRoom): MeshData[] {
  const parts: MeshData[] = [],
    yaw =
      room.doorSide === "front"
        ? 0
        : room.doorSide === "back"
          ? Math.PI
          : room.doorSide === "left"
            ? Math.PI / 2
            : -Math.PI / 2,
    vertical = ["left", "right"].includes(room.doorSide),
    w = vertical ? room.depth : room.width,
    d = vertical ? room.width : room.depth,
    y = floorElevation(p, room.level);
  const add = (
    id: string,
    position: Vec3,
    size: Vec3,
    material: MeshData["material"],
  ) => {
    const mesh = box(
      `${room.id}-${id}`,
      `${room.name} · ${id}`,
      position,
      size,
      material,
      "interior",
      true,
    );
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i],
        z = mesh.positions[i + 2];
      mesh.positions[i] = x * Math.cos(yaw) - z * Math.sin(yaw);
      mesh.positions[i + 2] = x * Math.sin(yaw) + z * Math.cos(yaw);
    }
    mesh.origin = [
      room.x + position[0] * Math.cos(yaw) - position[2] * Math.sin(yaw),
      y + position[1],
      room.z + position[0] * Math.sin(yaw) + position[2] * Math.cos(yaw),
    ];
    mesh.level = room.level;
    mesh.roomIds = [room.id];
    parts.push(mesh);
  };
  if (room.type === "bedroom") {
    if (w < 2.8 || d < 3.1)
      throw new Error(
        `${room.name} needs 2.8 × 3.1 m in its door orientation to fit a bed and access lane. Resize or disable furnishing.`,
      );
    add(
      "bed-base",
      [-w / 2 + 0.85, 0, -d / 2 + 1.15],
      [1.4, 0.38, 2.1],
      "trim",
    );
    add(
      "mattress",
      [-w / 2 + 0.85, 0.38, -d / 2 + 1.15],
      [1.4, 0.15, 2.1],
      "fabric",
    );
    add(
      "pillow",
      [-w / 2 + 0.85, 0.53, -d / 2 + 0.4],
      [1, 0.12, 0.35],
      "fabric",
    );
    add("wardrobe", [w / 2 - 0.38, 0, -d / 2 + 0.55], [0.65, 1.9, 1], "floor");
  } else if (room.type === "bathroom") {
    add("toilet", [-w / 2 + 0.48, 0, -d / 2 + 0.6], [0.55, 0.45, 0.8], "wall");
    add(
      "cistern",
      [-w / 2 + 0.48, 0.45, -d / 2 + 0.3],
      [0.55, 0.45, 0.25],
      "wall",
    );
    add("shower", [w / 2 - 0.55, 0, -d / 2 + 0.55], [0.85, 0.08, 0.85], "wall");
    add(
      "shower-panel",
      [w / 2 - 0.18, 0.08, -d / 2 + 0.55],
      [0.04, 1.8, 0.85],
      "glass",
    );
  } else if (room.type === "kitchen") {
    add("counter", [0, 0, -d / 2 + 0.4], [w - 0.35, 0.9, 0.65], "floor");
    add("countertop", [0, 0.9, -d / 2 + 0.4], [w - 0.3, 0.06, 0.7], "trim");
    add("sink", [-w * 0.2, 0.96, -d / 2 + 0.4], [0.65, 0.08, 0.45], "wall");
  } else if (room.type === "storage" || room.type === "shop") {
    for (let row = 0; row < 3; row++)
      add(
        "shelf-" + row,
        [0, 0.35 + row * 0.6, -d / 2 + 0.35],
        [w - 0.3, 0.07, 0.45],
        "floor",
      );
    for (const side of [-1, 1])
      add(
        "shelf-support-" + side,
        [side * (w / 2 - 0.25), 0, -d / 2 + 0.35],
        [0.07, 1.7, 0.45],
        "trim",
      );
  } else if (room.type === "living") {
    add(
      "sofa-base",
      [0, 0, -d / 2 + 0.55],
      [Math.min(2, w - 0.4), 0.42, 0.85],
      "trim",
    );
    add(
      "sofa-seat",
      [0, 0.42, -d / 2 + 0.55],
      [Math.min(2, w - 0.4), 0.12, 0.8],
      "fabric",
    );
    add(
      "sofa-back",
      [0, 0.54, -d / 2 + 0.15],
      [Math.min(2, w - 0.4), 0.38, 0.12],
      "fabric",
    );
  }
  return parts;
}
export function regenerateRooms(p: Project): AuthoredRoom[] {
  const kept = p.rooms.filter((room) => room.locked),
    defaults: AuthoredRoom[] = [];
  for (let level = 0; level < p.structure.storeys; level++)
    for (const [type, z] of [
      ["bedroom", -p.depth * 0.25],
      ["bathroom", p.depth * 0.23],
    ] as const) {
      const id = `room-generated-${level}-${type}`;
      if (kept.some((room) => room.id === id)) continue;
      defaults.push({
        id,
        name: `${type} ${level + 1}`,
        type,
        level,
        x: -p.width * 0.25,
        z,
        width: Math.min(3.4, p.width / 2 - p.wallThickness * 2 - 0.3),
        depth: type === "bedroom" ? Math.min(3.6, p.depth / 2 - 0.8) : 2.2,
        doorSide: "right",
        doorOffset: 0,
        doorWidth: 1.05,
        locked: false,
        furnished: true,
        finish: "wall",
      });
    }
  return [...kept, ...defaults];
}

/** Check physical floor reachability with openable door leaves excluded, not just the room adjacency graph. */
export function validateRoomAccess(p: Project, source: MeshData[]): void {
  if (!p.rooms.length || p.world.enabled) return;
  const scene = source.filter((mesh) => !mesh.doorId),
    nx = Math.ceil(p.width / 0.22),
    nz = Math.ceil(p.depth / 0.22),
    dx = p.width / nx,
    dz = p.depth / nz;
  const point = (index: number): [number, number] => [
    -p.width / 2 + ((index % nx) + 0.5) * dx,
    -p.depth / 2 + (Math.floor(index / nx) + 0.5) * dz,
  ];
  for (let level = 0; level < p.structure.storeys; level++) {
    const required = p.rooms.filter((room) => room.level === level);
    if (!required.length) continue;
    const elevation = floorElevation(p, level),
      floors = scene
        .filter(
          (mesh) =>
            mesh.solid &&
            mesh.walkable &&
            !mesh.surfaceMesh &&
            Math.abs(bounds(mesh).max[1] - elevation) < 0.04,
        )
        .map(bounds),
      passable = new Int8Array(nx * nz).fill(-1);
    const valid = (index: number) => {
      if (passable[index] >= 0) return passable[index] === 1;
      const [x, z] = point(index);
      const supported = floors.some(
        (b) => x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2],
      );
      passable[index] =
        supported && canStand(x, z, elevation + 1.68, scene) ? 1 : 0;
      return passable[index] === 1;
    };
    const nearest = (x: number, z: number) => {
      if (
        !canStand(x, z, elevation + 1.68, scene) ||
        !floors.some(
          (b) =>
            x >= b.min[0] && x <= b.max[0] && z >= b.min[2] && z <= b.max[2],
        )
      )
        return -1;
      const ix = Math.max(
          0,
          Math.min(nx - 1, Math.floor((x + p.width / 2) / dx)),
        ),
        iz = Math.max(0, Math.min(nz - 1, Math.floor((z + p.depth / 2) / dz)));
      let best = -1,
        distance = Infinity;
      for (let xx = Math.max(0, ix - 1); xx <= Math.min(nx - 1, ix + 1); xx++)
        for (
          let zz = Math.max(0, iz - 1);
          zz <= Math.min(nz - 1, iz + 1);
          zz++
        ) {
          const index = zz * nx + xx,
            at = point(index),
            d = Math.hypot(at[0] - x, at[1] - z);
          if (d < distance && d < 0.31 && valid(index)) {
            best = index;
            distance = d;
          }
        }
      return best;
    };
    const stair = level ? stairPlan(p) : null,
      entryX = p.structure.footprint === "l" ? -p.width / 3 : 0,
      entryZ = p.structure.footprint === "u" ? -p.depth / 6 : p.depth / 2;
    const seeds: [number, number][] = stair
      ? [[stair.second ? stair.right : stair.left, stair.frontZ + 0.65]]
      : p.archetype === "mixed"
        ? [
            [-p.width * 0.22, entryZ - 0.7],
            [p.width * 0.22, entryZ - 0.7],
          ]
        : [[entryX, entryZ - 0.7]];
    const seen = new Uint8Array(nx * nz),
      queue: number[] = [];
    for (const [x, z] of seeds) {
      const start = nearest(x, z);
      if (start >= 0 && !seen[start]) {
        seen[start] = 1;
        queue.push(start);
      }
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor],
        x = current % nx,
        z = Math.floor(current / nx);
      for (const [xx, zz] of [
        [x - 1, z],
        [x + 1, z],
        [x, z - 1],
        [x, z + 1],
      ]) {
        if (xx < 0 || xx >= nx || zz < 0 || zz >= nz) continue;
        const next = zz * nx + xx;
        if (!seen[next] && valid(next)) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    for (const room of required) {
      const edge = edges(room).find((edge) => edge.door)!,
        center = (edge.door!.lo + edge.door!.hi) / 2,
        x =
          edge.axis === "x"
            ? center
            : edge.coord + (room.doorSide === "left" ? 0.6 : -0.6),
        z =
          edge.axis === "z"
            ? center
            : edge.coord + (room.doorSide === "back" ? 0.6 : -0.6),
        target = nearest(x, z);
      if (target < 0 || !seen[target])
        throw new Error(
          `${room.name} has no usable floor route from the entrance or stair landing. Move its door/boundaries or reduce furnishing.`,
        );
    }
  }
}
