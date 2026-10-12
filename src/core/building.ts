import { MeshData, Project, Vec3 } from "./project";
import { box, beam } from "./mesh";
import { footprintCells } from "./footprints";

export interface Room {
  id: string;
  name: string;
  level: number;
  type: string;
  center: [number, number];
}
export interface Connection {
  from: string;
  to: string;
  kind: "door" | "stair" | "opening";
}
export interface StairPlan {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  left: number;
  right: number;
  midZ: number;
  frontZ: number;
  riser: number;
  tread: number;
  first: number;
  second: number;
  pitch: number;
}
export function stairPlan(p: Project): StairPlan {
  const pitch = p.height + 0.22,
    count = Math.ceil(pitch / 0.18),
    first = p.structure.stair === "straight" ? count : Math.ceil(count / 2),
    second = count - first,
    tread = 0.28,
    x1 =
      p.structure.footprint === "l"
        ? -p.width / 2 + p.wallThickness + 0.15 + (second ? 2.55 : 1.2)
        : p.width / 2 - p.wallThickness - 0.15,
    x0 = x1 - (second ? 2.55 : 1.2),
    z0 = -p.depth / 2 + p.wallThickness + 0.15,
    frontZ = z0 + 0.95 + first * tread;
  if (p.structure.storeys > 1 && frontZ + 1.1 > p.depth / 2 - p.wallThickness)
    throw new Error(
      "Stair flights and landings do not fit. Increase depth or choose U stairs.",
    );
  return {
    x0,
    x1,
    z0,
    z1: frontZ,
    left: x0 + 0.6,
    right: x1 - 0.6,
    midZ: z0 + 0.475,
    frontZ,
    riser: pitch / count,
    tread,
    first,
    second,
    pitch,
  };
}
export function floorElevation(p: Project, level: number): number {
  return (
    0.16 +
    (p.architectureDetails && p.theme === "jungle" ? 0.6 : 0) +
    level * (p.height + 0.22)
  );
}
function extents(m: MeshData) {
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3)
    for (let a = 0; a < 3; a++) {
      min[a] = Math.min(min[a], m.positions[i + a] + m.origin[a]);
      max[a] = Math.max(max[a], m.positions[i + a] + m.origin[a]);
    }
  return { min, max };
}
function door(
  id: string,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  angle: number,
): MeshData {
  const m = box(
    id,
    "Door leaf · E to interact",
    [x - width / 2, y, z],
    [width, height, 0.055],
    "trim",
    "interior",
  );
  const theta = (angle * Math.PI) / 180;
  for (let i = 0; i < m.positions.length; i += 3) {
    const px = m.positions[i] + width / 2,
      pz = m.positions[i + 2];
    m.positions[i] = px * Math.cos(theta) - pz * Math.sin(theta);
    m.positions[i + 2] = px * Math.sin(theta) + pz * Math.cos(theta);
  }
  m.doorId = id;
  return m;
}
function applyDoorPoses(p: Project, parts: MeshData[]): MeshData[] {
  for (const mesh of parts)
    if (mesh.doorId) {
      const angle =
        (p.structure.doorPoses[mesh.doorId] ?? p.structure.doorAngle) -
        p.structure.doorAngle;
      if (!angle) continue;
      const theta = (angle * Math.PI) / 180;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        const x = mesh.positions[i],
          z = mesh.positions[i + 2];
        mesh.positions[i] = x * Math.cos(theta) - z * Math.sin(theta);
        mesh.positions[i + 2] = x * Math.sin(theta) + z * Math.cos(theta);
      }
    }
  return parts;
}
export function buildingTopology(p: Project): {
  rooms: Room[];
  connections: Connection[];
} {
  if (p.structure.footprint !== "rectangle") {
    const cells = footprintCells(p),
      rooms: Room[] = [
        {
          id: "outside",
          name: "Outside",
          level: -1,
          type: "outside",
          center: [0, p.depth / 2 + 2],
        },
      ],
      connections: Connection[] = [],
      entryX = p.structure.footprint === "l" ? 0 : 1,
      entryZ = p.structure.footprint === "u" ? 0 : 2;
    for (let level = 0; level < p.structure.storeys; level++)
      for (const cell of cells) {
        const id = `wing-${level}-${cell.x}-${cell.z}`;
        rooms.push({
          id,
          name: `Wing ${cell.x + 1}.${cell.z + 1} · level ${level + 1}`,
          level,
          type: "open-plan zone",
          center: [
            -p.width / 2 + ((cell.x + 0.5) * p.width) / 3,
            -p.depth / 2 + ((cell.z + 0.5) * p.depth) / 3,
          ],
        });
        for (const [dx, dz] of [
          [1, 0],
          [0, 1],
        ])
          if (cells.some((c) => c.x === cell.x + dx && c.z === cell.z + dz))
            connections.push({
              from: id,
              to: `wing-${level}-${cell.x + dx}-${cell.z + dz}`,
              kind: "opening",
            });
        if (!level && cell.x === entryX && cell.z === entryZ)
          connections.push({ from: "outside", to: id, kind: "door" });
        if (level) {
          const stairs = stairPlan(p),
            sx = p.structure.footprint === "l" ? 0 : 2,
            sz = Math.max(
              0,
              Math.min(
                2,
                Math.floor(
                  (stairs.frontZ + 0.55 + p.depth / 2) / (p.depth / 3),
                ),
              ),
            );
          if (cell.x === sx && cell.z === sz)
            connections.push({
              from: `wing-${level - 1}-${sx}-${sz}`,
              to: id,
              kind: "stair",
            });
        }
      }
    return { rooms, connections };
  }
  const rooms: Room[] = [
      {
        id: "outside",
        name: "Outside",
        level: -1,
        type: "outside",
        center: [0, p.depth / 2 + 2],
      },
    ],
    connections: Connection[] = [];
  for (let level = 0; level < p.structure.storeys; level++) {
    const circulation = `level-${level}-hall`,
      room = `level-${level}-room`;
    rooms.push(
      {
        id: circulation,
        name: level ? `Upper landing ${level}` : "Entrance hall",
        level,
        type: "corridor",
        center: [0, p.depth * 0.2],
      },
      {
        id: room,
        name:
          p.archetype === "shop" || (p.archetype === "mixed" && level === 0)
            ? "Stockroom"
            : `Living / bedroom ${level + 1}`,
        level,
        type: "room",
        center: [-p.width * 0.2, -p.depth * 0.25],
      },
    );
    connections.push(
      {
        from: level ? `level-${level - 1}-hall` : "outside",
        to: circulation,
        kind: level ? "stair" : "door",
      },
      { from: circulation, to: room, kind: "door" },
    );
    if (p.archetype === "flats" || (p.archetype === "mixed" && level > 0)) {
      rooms.pop();
      connections.pop();
      for (const side of ["west", "east"]) {
        const unit = `level-${level}-unit-${side}`;
        rooms.push({
          id: unit,
          name: `Apartment ${level * 2 + (side === "west" ? 1 : 2)}`,
          level,
          type: "apartment",
          center: [(side === "west" ? -1 : 1) * p.width * 0.25, p.depth * 0.25],
        });
        connections.push({ from: circulation, to: unit, kind: "door" });
        for (const type of ["bedroom", "bathroom"]) {
          const id = `${unit}-${type}`;
          rooms.push({
            id,
            name: `Apartment ${level * 2 + (side === "west" ? 1 : 2)} ${type}`,
            level,
            type,
            center: [
              (side === "west" ? -1 : 1) * p.width * 0.25,
              (side === "west" ? -1 : 1) * p.depth * 0.25,
            ],
          });
          connections.push({
            from: type === "bathroom" ? `${unit}-bedroom` : unit,
            to: id,
            kind: "door",
          });
        }
      }
    }
  }
  return { rooms, connections };
}
export function buildBuilding(
  p: Project,
  single: (p: Project) => MeshData[],
): MeshData[] {
  const levels = p.structure.storeys;
  if (levels === 1 && p.archetype !== "flats" && p.archetype !== "mixed") {
    const result = single(p);
    result.push(
      door(
        "entry-door",
        0,
        floorElevation(p, 0),
        p.depth / 2 - p.wallThickness / 2,
        p.doorWidth - 0.14,
        Math.min(2.35, p.height - 0.25) - 0.08,
        p.structure.doorAngle,
      ),
    );
    if (p.archetype === "shop") {
      const y = floorElevation(p, 0),
        z = -p.depth * 0.15,
        span = (p.width - 2 * p.wallThickness - 1.2) / 2;
      for (const side of [-1, 1])
        result.push(
          box(
            `stockroom-wall-${side}`,
            "Stockroom partition",
            [side * (0.6 + span / 2), y, z],
            [span, p.height, 0.12],
            "wall",
          ),
        );
      result.push(
        box(
          "stockroom-head",
          "Stockroom doorway head",
          [0, y + 2.25, z],
          [1.2, p.height - 2.25, 0.12],
          "wall",
        ),
        door("stockroom-door", 0, y, z, 1.1, 2.2, p.structure.doorAngle),
      );
    }
    return applyDoorPoses(p, result);
  }
  const stair = stairPlan(p),
    parts: MeshData[] = [];
  for (let level = 0; level < levels; level++) {
    const top = level === levels - 1,
      recipe: Project = {
        ...p,
        roof: top ? p.roof : "none",
        architectureDetails: level === 0 && p.architectureDetails,
        furnished: p.furnished && p.structure.interior === "furnished",
        archetype:
          p.archetype === "mixed"
            ? level === 0
              ? "mixed"
              : "house"
            : p.archetype === "flats"
              ? "house"
              : p.archetype,
        landscape: { ...p.landscape, enabled: false },
      };
    const offset = floorElevation(p, level) - floorElevation(recipe, 0);
    for (const mesh of single(recipe)) {
      if (
        mesh.category === "site" ||
        mesh.category === "landscape" ||
        mesh.category === "vegetation"
      )
        continue;
      if (
        mesh.id.startsWith("room-") ||
        mesh.id === "building-floor" ||
        (level &&
          (mesh.id === "entry-step" ||
            mesh.id === "shop-sign" ||
            (!p.structure.balcony && mesh.id.includes("door-0"))))
      )
        continue;
      if (
        mesh.category === "interior" &&
        (p.archetype === "flats" || (p.archetype === "mixed" && level > 0))
      )
        continue;
      const b = extents(mesh);
      // Reserve the entire stairwell before furnishing. No automatic prop may intrude.
      if (
        mesh.category === "interior" &&
        b.max[0] > stair.x0 - 0.3 &&
        b.min[0] < stair.x1 + 0.3 &&
        b.max[2] > stair.z0 - 0.3 &&
        b.min[2] < stair.z1 + 1
      )
        continue;
      mesh.origin = [mesh.origin[0], mesh.origin[1] + offset, mesh.origin[2]];
      mesh.level = level;
      if (level) mesh.id = `level-${level}-${mesh.id}`;
      parts.push(mesh);
    }
    const elevation = floorElevation(p, level),
      slabBottom = elevation - 0.22;
    const slab = (
      id: string,
      x0: number,
      x1: number,
      z0: number,
      z1: number,
    ) => {
      if (x1 - x0 < 0.001 || z1 - z0 < 0.001) return;
      const m = box(
        id,
        `Level ${level + 1} slab`,
        [(x0 + x1) / 2, slabBottom, (z0 + z1) / 2],
        [x1 - x0, 0.22, z1 - z0],
        "floor",
      );
      m.walkable = true;
      m.level = level;
      parts.push(m);
    };
    if (!level)
      slab(
        "building-floor",
        -p.width / 2,
        p.width / 2,
        -p.depth / 2,
        p.depth / 2,
      );
    else {
      slab(
        `level-${level}-slab-left`,
        -p.width / 2,
        stair.x0,
        -p.depth / 2,
        p.depth / 2,
      );
      slab(
        `level-${level}-slab-right`,
        stair.x1,
        p.width / 2,
        -p.depth / 2,
        p.depth / 2,
      );
      slab(
        `level-${level}-slab-back`,
        stair.x0,
        stair.x1,
        -p.depth / 2,
        stair.z0,
      );
      slab(
        `level-${level}-slab-front`,
        stair.x0,
        stair.x1,
        stair.z1,
        p.depth / 2,
      );
      // Upper facade closes the old single-level door aperture without an outside door.
      if (!p.structure.balcony) {
        const front = box(
          `level-${level}-front-infill`,
          "Closed upper entrance bay",
          [0, elevation, p.depth / 2 - p.wallThickness / 2],
          [p.doorWidth, Math.min(2.35, p.height - 0.25), p.wallThickness],
          "wall",
        );
        front.level = level;
        parts.push(front);
      } else {
        const balconyDoor = door(
          `balcony-door-${level}`,
          0,
          elevation,
          p.depth / 2 - p.wallThickness / 2,
          p.doorWidth - 0.14,
          Math.min(2.35, p.height - 0.25) - 0.08,
          p.structure.doorAngle,
        );
        balconyDoor.level = level;
        parts.push(balconyDoor);
      }
    }
    if (p.archetype === "flats" || (p.archetype === "mixed" && level > 0)) {
      parts.push(...apartmentInteriors(p, level, stair));
    } else {
      // One authoritative partition with a doorway; it stops short of the shared stair core.
      const partitionEnd = stair.x0 - 0.2,
        partitionZ = -p.depth * 0.12,
        passage = Math.min(1.2, p.doorWidth),
        doorCenter =
          p.archetype === "mixed" && level === 0 ? -p.width * 0.22 : 0;
      const leftWidth =
        p.width / 2 - p.wallThickness + doorCenter - passage / 2;
      parts.push(
        box(
          `level-${level}-room-wall-left`,
          "Room partition",
          [
            (-p.width / 2 + p.wallThickness + doorCenter - passage / 2) / 2,
            elevation,
            partitionZ,
          ],
          [leftWidth, p.height, 0.12],
          "wall",
        ),
      );
      if (partitionEnd > doorCenter + passage / 2)
        parts.push(
          box(
            `level-${level}-room-wall-right`,
            "Room partition",
            [
              (partitionEnd + doorCenter + passage / 2) / 2,
              elevation,
              partitionZ,
            ],
            [partitionEnd - doorCenter - passage / 2, p.height, 0.12],
            "wall",
          ),
        );
      parts.push(
        box(
          `level-${level}-room-head`,
          "Room doorway head",
          [doorCenter, elevation + 2.25, partitionZ],
          [passage, p.height - 2.25, 0.12],
          "wall",
        ),
      );
      const leaf = door(
        `level-${level}-room-door`,
        doorCenter,
        elevation,
        partitionZ,
        passage - 0.1,
        2.2,
        p.structure.doorAngle,
      );
      leaf.level = level;
      parts.push(leaf);
    }
    if (!top) {
      const step = (
        id: string,
        x: number,
        z: number,
        topY: number,
        bottomY: number,
        depth: number,
      ) => {
        const m = box(
          id,
          "Stair tread",
          [x, Math.max(bottomY, topY - 0.14), z],
          [1.1, Math.min(topY - bottomY, 0.14), depth],
          "floor",
        );
        m.walkable = true;
        m.level = level;
        parts.push(m);
      };
      for (let i = 1; i <= stair.first; i++)
        step(
          `stairs-${level}-lower-${i}`,
          stair.left,
          stair.frontZ - (i - 0.5) * stair.tread,
          elevation + i * stair.riser,
          elevation,
          stair.tread,
        );
      if (stair.second) {
        const mid = elevation + stair.first * stair.riser;
        const landing = box(
          `stairs-${level}-landing`,
          "Supported turning landing",
          [(stair.x0 + stair.x1) / 2, mid - 0.18, stair.midZ],
          [stair.x1 - stair.x0, 0.18, 0.95],
          "floor",
        );
        landing.walkable = true;
        landing.level = level;
        parts.push(landing);
        for (const x of [stair.left, stair.right])
          parts.push(
            box(
              `stairs-${level}-support-${x}`,
              "Landing support",
              [x, elevation, stair.midZ],
              [0.12, mid - elevation - 0.18, 0.12],
              "trim",
            ),
          );
        for (let i = 1; i <= stair.second; i++)
          step(
            `stairs-${level}-upper-${i}`,
            stair.right,
            stair.z0 + 0.95 + (i - 0.5) * stair.tread,
            mid + i * stair.riser,
            mid - 0.18,
            stair.tread,
          );
        if (stair.second < stair.first)
          step(
            `stairs-${level}-top-extension`,
            stair.right,
            stair.frontZ - stair.tread / 2,
            elevation + stair.pitch,
            elevation + stair.pitch - 0.22,
            stair.tread,
          );
      }
      // Center divider rails follow both flights without closing their turns/landings.
      const railX = (stair.x0 + stair.x1) / 2;
      parts.push(
        beam(
          `stairs-${level}-rail-lower`,
          [railX, elevation + 0.9, stair.frontZ],
          [railX, elevation + stair.first * stair.riser + 0.9, stair.z0 + 0.95],
          0.05,
          "trim",
          "structure",
          false,
        ),
      );
      if (stair.second)
        parts.push(
          beam(
            `stairs-${level}-rail-upper`,
            [
              railX,
              elevation + stair.first * stair.riser + 0.9,
              stair.z0 + 0.95,
            ],
            [railX, elevation + stair.pitch + 0.9, stair.frontZ],
            0.05,
            "trim",
            "structure",
            false,
          ),
        );
      for (const side of [-0.48, 0.48]) {
        parts.push(
          beam(
            `stairs-${level}-stringer-lower-${side}`,
            [stair.left + side, elevation - 0.05, stair.frontZ],
            [
              stair.left + side,
              elevation + stair.first * stair.riser - 0.14,
              stair.z0 + 0.95,
            ],
            0.11,
            "trim",
            "structure",
            false,
          ),
        );
        if (stair.second)
          parts.push(
            beam(
              `stairs-${level}-stringer-upper-${side}`,
              [
                stair.right + side,
                elevation + stair.first * stair.riser - 0.14,
                stair.z0 + 0.95,
              ],
              [
                stair.right + side,
                elevation + stair.pitch - 0.14,
                stair.frontZ,
              ],
              0.11,
              "trim",
              "structure",
              false,
            ),
          );
      }
    }
    if (p.structure.balcony && level) {
      const deck = box(
        `balcony-${level}`,
        "Attached balcony",
        [0, elevation - 0.16, p.depth / 2 + 0.6],
        [p.width - 1, 0.16, 1.2],
        "floor",
      );
      deck.walkable = true;
      deck.level = level;
      parts.push(deck);
      parts.push(
        box(
          `balcony-${level}-guard`,
          "Balcony guard",
          [0, elevation, p.depth / 2 + 1.18],
          [p.width - 1, 1, 0.08],
          "trim",
        ),
      );
    }
  }
  parts.push(
    door(
      "entry-door",
      0,
      floorElevation(p, 0),
      p.depth / 2 - p.wallThickness / 2,
      p.doorWidth - 0.14,
      Math.min(2.35, p.height - 0.25) - 0.08,
      p.structure.doorAngle,
    ),
  );
  if (p.archetype === "mixed") {
    const center = parts.findIndex((m) => m.id === "entry-door");
    if (center >= 0) parts.splice(center, 1);
    for (const side of [-1, 1])
      parts.push(
        door(
          side < 0 ? "commercial-entry-door" : "residential-entry-door",
          side * p.width * 0.22,
          floorElevation(p, 0),
          p.depth / 2 - p.wallThickness / 2,
          p.doorWidth - 0.14,
          Math.min(2.35, p.height - 0.25) - 0.08,
          p.structure.doorAngle,
        ),
      );
    const separator = box(
      "mixed-use-separator",
      "Separate shop and residential entrance",
      [0, floorElevation(p, 0), p.depth * 0.2],
      [0.12, p.height, p.depth * 0.6],
      "wall",
    );
    separator.level = 0;
    parts.push(separator);
    const sign = parts.find((m) => m.id === "shop-sign");
    if (sign) {
      sign.origin[0] = -p.width * 0.22;
      for (let i = 0; i < sign.positions.length; i += 3)
        sign.positions[i] *= 0.65;
    }
  }
  return applyDoorPoses(p, parts);
}

function apartmentInteriors(
  p: Project,
  level: number,
  stair: StairPlan,
): MeshData[] {
  const parts: MeshData[] = [],
    y = floorElevation(p, level),
    t = 0.12;
  const put = (
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    h = p.height,
    mat: MeshData["material"] = "wall",
    bottom = y,
  ) => {
    if (w < 0.001 || d < 0.001 || h < 0.001) return;
    const m = box(
      `level-${level}-${id}`,
      id.replaceAll("-", " "),
      [x, bottom, z],
      [w, h, d],
      mat,
      mat === "wall" ? "structure" : "interior",
    );
    m.level = level;
    parts.push(m);
  };
  const sideWall = (
    side: string,
    x: number,
    z0: number,
    z1: number,
    opening: number,
  ) => {
    const gap = 0.6;
    put(
      `unit-${side}-partition-a`,
      x,
      (z0 + opening - gap) / 2,
      t,
      opening - gap - z0,
    );
    put(
      `unit-${side}-partition-b`,
      x,
      (opening + gap + z1) / 2,
      t,
      z1 - opening - gap,
    );
    put(
      `unit-${side}-door-head`,
      x,
      opening,
      t,
      1.2,
      p.height - 2.25,
      "wall",
      y + 2.25,
    );
    const leaf = door(
      `level-${level}-unit-${side}-door`,
      0,
      y,
      0,
      1.1,
      2.2,
      p.structure.doorAngle,
    );
    for (let i = 0; i < leaf.positions.length; i += 3) {
      const px = leaf.positions[i],
        pz = leaf.positions[i + 2];
      leaf.positions[i] = -pz * (side === "east" ? -1 : 1);
      leaf.positions[i + 2] = px * (side === "east" ? -1 : 1);
    }
    leaf.origin = [x, y, opening + (side === "east" ? 0.55 : -0.55)];
    leaf.level = level;
    parts.push(leaf);
  };
  const front = p.depth / 2 - p.wallThickness,
    back = -p.depth / 2 + p.wallThickness,
    eastBack = Math.max(stair.frontZ + 0.95, -p.depth * 0.1);
  sideWall("west", -0.8, back, front, Math.min(front - 1.2, 1.4));
  sideWall("east", 0.8, eastBack, front, eastBack + 1);
  // The right unit is in front of the stair core; the common cross passage stays outside it.
  put(
    "unit-east-rear",
    (0.8 + p.width / 2 - p.wallThickness) / 2,
    eastBack,
    p.width / 2 - p.wallThickness - 0.8,
    t,
  );
  const bedroom = (side: string, x: number, z: number, span: number) => {
    const gap = 1.1;
    for (const direction of [-1, 1])
      put(
        `unit-${side}-bedroom-${direction}`,
        x + direction * (gap / 2 + (span - gap) / 4),
        z,
        (span - gap) / 2,
        t,
      );
    put(
      `unit-${side}-bedroom-head`,
      x,
      z,
      gap,
      t,
      p.height - 2.25,
      "wall",
      y + 2.25,
    );
    const leaf = door(
      `level-${level}-unit-${side}-bedroom-door`,
      x,
      y,
      z,
      1,
      2.2,
      p.structure.doorAngle,
    );
    leaf.level = level;
    parts.push(leaf);
  };
  const unitWidth = p.width / 2 - p.wallThickness - 0.8;
  bedroom("west", -(0.8 + unitWidth / 2), -p.depth * 0.12, unitWidth);
  bedroom("east", 0.8 + unitWidth / 2, front - 2.6, unitWidth);
  for (const side of [-1, 1]) {
    const id = side < 0 ? "west" : "east",
      bx = side * 1.5,
      boundary = side < 0 ? back + 1.9 : front - 1.9,
      center = side < 0 ? back + 0.95 : front - 0.95;
    put(`unit-${id}-bathroom-side`, side * 2.2, center, 0.12, 1.9);
    for (const edge of [-1, 1])
      put(
        `unit-${id}-bathroom-front-${edge}`,
        bx + edge * 0.56,
        boundary,
        0.28,
        0.12,
      );
    put(
      `unit-${id}-bathroom-head`,
      bx,
      boundary,
      0.84,
      0.12,
      p.height - 2.15,
      "wall",
      y + 2.15,
    );
    const leaf = door(
      `level-${level}-unit-${id}-bathroom-door`,
      bx,
      y,
      boundary,
      0.78,
      2.1,
      p.structure.doorAngle,
    );
    leaf.level = level;
    parts.push(leaf);
  }
  if (p.furnished && p.structure.interior === "furnished") {
    // Complete self-contained starter units with kitchen, bathroom and sleeping furniture.
    for (const side of [-1, 1]) {
      const id = side < 0 ? "west" : "east",
        x = side * (p.width / 2 - p.wallThickness - 1.1),
        bz = side < 0 ? back + 1.35 : front - 1.35,
        kitchenZ = side < 0 ? front - 1.1 : eastBack + 1.1;
      put(`unit-${id}-bed`, x, bz, 1.8, 2.1, 0.35, "trim");
      put(`unit-${id}-mattress`, x, bz, 1.7, 2, 0.18, "fabric", y + 0.35);
      put(`unit-${id}-kitchen`, x, kitchenZ, 1.8, 0.6, 0.9, "trim");
      put(
        `unit-${id}-sink`,
        x + 0.4 * side,
        kitchenZ,
        0.45,
        0.45,
        0.055,
        "glass",
        y + 0.91,
      );
      put(
        `unit-${id}-wardrobe`,
        side * (p.width / 2 - p.wallThickness - 0.35),
        (kitchenZ + bz) / 2,
        0.6,
        0.9,
        1.8,
        "trim",
      );
      put(
        `unit-${id}-table`,
        side * 3,
        kitchenZ,
        1,
        0.65,
        0.08,
        "floor",
        y + 0.75,
      );
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          put(
            `unit-${id}-table-leg-${sx}-${sz}`,
            side * 3 + sx * 0.4,
            kitchenZ + sz * 0.22,
            0.06,
            0.06,
            0.75,
            "trim",
          );
      const bathroomX = side * 1.45,
        bathroomZ = side < 0 ? back + 0.85 : front - 0.85;
      put(
        `unit-${id}-toilet-base`,
        bathroomX,
        bathroomZ,
        0.38,
        0.52,
        0.38,
        "wall",
      );
      put(
        `unit-${id}-toilet-cistern`,
        bathroomX,
        bathroomZ - 0.24,
        0.42,
        0.18,
        0.72,
        "wall",
      );
      put(
        `unit-${id}-shower`,
        bathroomX,
        bathroomZ + (side < 0 ? 0.55 : -0.55),
        0.7,
        0.7,
        0.09,
        "path",
      );
    }
  }
  return parts;
}
