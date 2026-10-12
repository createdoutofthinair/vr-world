import { MeshData, Project, Vec3 } from "./project";
import { box, MeshBuilder } from "./mesh";
import { floorElevation } from "./building";
import { terrainHeight } from "./terrain";
import { footprintCells } from "./footprints";
export { footprintCells } from "./footprints";
export function buildMassing(p: Project, reference: MeshData[]): MeshData[] {
  if (p.structure.footprint === "rectangle") return reference;
  if (p.width < 10 || p.depth < 9)
    throw new Error(
      "Connected villa wings need at least a 10 × 9 m footprint.",
    );
  if (!["flat", "hip", "none"].includes(p.roof))
    throw new Error(
      "Connected wings currently support flat or joined hip roofs.",
    );
  const cells = footprintCells(p),
    occupied = new Set(cells.map((c) => `${c.x},${c.z}`)),
    parts = reference.filter(
      (m) =>
        (m.category === "site" ||
          m.category === "landscape" ||
          m.category === "vegetation" ||
          m.id.startsWith("stairs-")) &&
        m.id !== "site-path",
    ),
    cw = p.width / 3,
    cd = p.depth / 3,
    t = p.wallThickness,
    entranceX = p.structure.footprint === "l" ? -cw : 0,
    entranceZ = p.structure.footprint === "u" ? -cd / 2 : p.depth / 2;
  const add = (
    id: string,
    label: string,
    origin: Vec3,
    size: Vec3,
    material: MeshData["material"] = "wall",
    walkable = false,
    category: MeshData["category"] = "structure",
  ) => {
    const m = box(id, label, origin, size, material, category);
    m.walkable = walkable;
    parts.push(m);
    return m;
  };
  const wall = (
    id: string,
    axis: "x" | "z",
    center: number,
    fixed: number,
    length: number,
    y: number,
    entry: boolean,
    window: boolean,
    level: number,
  ) => {
    const opening = entry
        ? p.doorWidth
        : Math.min(p.structure.windowWidth, length - 0.6),
      bottom = entry ? 0 : p.structure.windowSill,
      top = entry
        ? Math.min(2.35, p.height - 0.25)
        : Math.min(p.height - 0.15, bottom + p.structure.windowHeight),
      cut = entry || window;
    const put = (
      suffix: string,
      along: number,
      base: number,
      w: number,
      h: number,
      mat: MeshData["material"] = "wall",
      cat: MeshData["category"] = "structure",
    ) => {
      if (w < 0.001 || h < 0.001) return;
      const m = add(
        id + "-" + suffix,
        `Wing facade ${suffix}`,
        axis === "x" ? [along, y + base, fixed] : [fixed, y + base, along],
        axis === "x" ? [w, h, t] : [t, h, w],
        mat,
        false,
        cat,
      );
      m.level = level;
      return m;
    };
    if (!cut) {
      put("panel", center, 0, length, p.height);
      return;
    }
    const span = (length - opening) / 2;
    for (const side of [-1, 1])
      put(
        `side-${side}`,
        center + side * (opening / 2 + span / 2),
        0,
        span,
        p.height,
      );
    if (bottom) put("sill-panel", center, 0, opening, bottom);
    put("head-panel", center, top, opening, p.height - top);
    for (const side of [-1, 1])
      put(
        `frame-${side}`,
        center + side * (opening / 2 - 0.035),
        bottom,
        0.07,
        top - bottom,
        "trim",
        "windows",
      );
    put("head-frame", center, top - 0.07, opening, 0.07, "trim", "windows");
    if (window) {
      put("sill-frame", center, bottom, opening, 0.07, "trim", "windows");
      const glass = put(
        "glass",
        center,
        bottom + 0.07,
        opening - 0.14,
        top - bottom - 0.14,
        "glass",
        "windows",
      );
      if (glass)
        for (let i = 0; i < glass.positions.length; i += 3)
          glass.positions[i + (axis === "x" ? 2 : 0)] *= 0.12;
    }
  };
  for (let level = 0; level < p.structure.storeys; level++) {
    const y = floorElevation(p, level);
    for (const cell of cells) {
      const x = -p.width / 2 + (cell.x + 0.5) * cw,
        z = -p.depth / 2 + (cell.z + 0.5) * cd,
        id = `wing-${level}-${cell.x}-${cell.z}`;
      if (level === 0) {
        const slab = add(
          id + "-slab",
          "Connected wing floor",
          [x, y - 0.22, z],
          [cw, 0.22, cd],
          "floor",
          true,
        );
        slab.level = level;
      } else
        for (const m of reference.filter(
          (m) => m.level === level && m.id.includes("-slab-"),
        )) {
          let xmin = Infinity,
            xmax = -Infinity,
            zmin = Infinity,
            zmax = -Infinity;
          for (let i = 0; i < m.positions.length; i += 3) {
            xmin = Math.min(xmin, m.origin[0] + m.positions[i]);
            xmax = Math.max(xmax, m.origin[0] + m.positions[i]);
            zmin = Math.min(zmin, m.origin[2] + m.positions[i + 2]);
            zmax = Math.max(zmax, m.origin[2] + m.positions[i + 2]);
          }
          const ax = Math.max(x - cw / 2, xmin),
            bx = Math.min(x + cw / 2, xmax),
            az = Math.max(z - cd / 2, zmin),
            bz = Math.min(z + cd / 2, zmax);
          if (bx - ax > 0.001 && bz - az > 0.001) {
            const slab = add(
              id + "-" + m.id,
              "Wing slab with stair void",
              [(ax + bx) / 2, y - 0.22, (az + bz) / 2],
              [bx - ax, 0.22, bz - az],
              "floor",
              true,
            );
            slab.level = level;
          }
        }
      for (const side of [-1, 1]) {
        if (!occupied.has(`${cell.x + side},${cell.z}`))
          wall(
            id + `-wall-x-${side}`,
            "z",
            z,
            x + side * (cw / 2 - t / 2),
            cd - 2 * t,
            y,
            false,
            p.windows,
            level,
          );
        if (!occupied.has(`${cell.x},${cell.z + side}`)) {
          const fixed = z + side * (cd / 2 - t / 2),
            isEntry =
              !level &&
              side === 1 &&
              Math.abs(x - entranceX) < 0.01 &&
              Math.abs(fixed - (entranceZ - t / 2)) < 0.01;
          wall(
            id + `-wall-z-${side}`,
            "x",
            x,
            fixed,
            cw,
            y,
            isEntry,
            p.windows && !isEntry,
            level,
          );
        }
      }
      if (level === p.structure.storeys - 1 && p.roof !== "none") {
        add(
          id + "-ceiling",
          "Wing ceiling",
          [x, y + p.height, z],
          [cw, 0.12, cd],
          "wall",
          false,
          "roof",
        );
        if (p.roof === "flat")
          add(
            id + "-roof",
            "Joined flat roof",
            [x, y + p.height + 0.12, z],
            [cw, 0.18, cd],
            "roof",
            false,
            "roof",
          );
        else {
          const r = new MeshBuilder(),
            a: Vec3 = [x - cw / 2, y + p.height + 0.12, z + cd / 2],
            b: Vec3 = [x + cw / 2, y + p.height + 0.12, z + cd / 2],
            c: Vec3 = [x + cw / 2, y + p.height + 0.12, z - cd / 2],
            d: Vec3 = [x - cw / 2, y + p.height + 0.12, z - cd / 2],
            peak: Vec3 = [x, y + p.height + 0.12 + Math.min(cw, cd) * 0.3, z];
          r.face([a, b, peak]);
          r.face([b, c, peak]);
          r.face([c, d, peak]);
          r.face([d, a, peak]);
          r.face([d, c, b, a]);
          parts.push(
            r.build(
              id + "-roof",
              "Joined hipped roof section",
              "roof",
              "roof",
              true,
            ),
          );
        }
      }
    }
    const vertices = new Set<string>();
    for (const c of cells)
      for (const dx of [0, 1])
        for (const dz of [0, 1]) vertices.add(`${c.x + dx},${c.z + dz}`);
    for (const key of vertices) {
      const [vx, vz] = key.split(",").map(Number);
      if (vx === 0 || vx === 3 || vz === 0 || vz === 3) continue;
      add(
        `wing-${level}-column-${key.replace(",", "-")}`,
        "Roof junction column",
        [-p.width / 2 + vx * cw, y, -p.depth / 2 + vz * cd],
        [0.16, p.height, 0.16],
        "trim",
      );
    }
  }
  add(
    "wing-entry-apron",
    "Wing entrance apron",
    [entranceX, floorElevation(p, 0) - 0.22, entranceZ + 0.7],
    [p.doorWidth + 0.5, 0.22, 1.4],
    "floor",
    true,
  );
  const lift = floorElevation(p, 0) - 0.16;
  if (lift)
    for (let i = 0; i < 4; i++) {
      const top = (4 - i) * 0.19;
      add(
        `wing-entry-step-${i}`,
        "Supported wing entry tread",
        [entranceX, -0.02, entranceZ + 1.35 + i * 0.43],
        [p.doorWidth + 0.6, top + 0.02, 0.45],
        "floor",
        true,
      );
    }
  const path = new MeshBuilder(),
    end = p.depth / 2 + p.landscape.extent;
  for (let z = entranceZ + 1.2; z < end; z += 0.5) {
    const to = Math.min(end, z + 0.5),
      left = entranceX - 1,
      right = entranceX + 1;
    path.face([
      [left, terrainHeight(p, left, to) + 0.009, to],
      [right, terrainHeight(p, right, to) + 0.009, to],
      [right, terrainHeight(p, right, z) + 0.009, z],
      [left, terrainHeight(p, left, z) + 0.009, z],
    ]);
  }
  const route = path.build(
    "site-path",
    "Connected entrance path",
    "path",
    "landscape",
    true,
  );
  route.walkable = true;
  route.surfaceMesh = true;
  parts.push(route);
  const width = p.doorWidth - 0.14,
    leaf = box(
      "wing-entry-door",
      "Wing entrance door",
      [entranceX - width / 2, floorElevation(p, 0), entranceZ - t / 2],
      [width, 2.2, 0.055],
      "trim",
      "interior",
    );
  leaf.doorId = leaf.id;
  const theta =
    ((p.structure.doorPoses[leaf.id] ?? p.structure.doorAngle) * Math.PI) / 180;
  for (let i = 0; i < leaf.positions.length; i += 3) {
    const x = leaf.positions[i] + width / 2,
      z = leaf.positions[i + 2];
    leaf.positions[i] = x * Math.cos(theta) - z * Math.sin(theta);
    leaf.positions[i + 2] = x * Math.sin(theta) + z * Math.cos(theta);
  }
  parts.push(leaf);
  if (p.furnished && p.structure.interior === "furnished")
    for (const [i, c] of cells.entries()) {
      if (c.x === 2 && p.structure.storeys > 1) continue;
      if (c.x === 0 && p.structure.footprint === "l" && p.structure.storeys > 1)
        continue;
      const x = -p.width / 2 + (c.x + 0.5) * cw,
        z = -p.depth / 2 + (c.z + 0.5) * cd;
      if (
        Math.abs(x - entranceX) < 0.01 &&
        Math.abs(z + cd / 2 - entranceZ) < 0.01
      )
        continue;
      add(
        `wing-bed-${i}`,
        "Wing furniture",
        [x, floorElevation(p, 0), z],
        [Math.min(1.6, cw - 1), 0.5, Math.min(2, cd - 1)],
        i % 2 ? "fabric" : "trim",
        false,
        "interior",
      );
    }
  return parts;
}
