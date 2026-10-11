import { MeshData, Vec3, MaterialRole } from "./project";
export function box(
  id: string,
  label: string,
  origin: Vec3,
  size: Vec3,
  material: MeshData["material"],
  category: MeshData["category"] = "structure",
  solid = true,
): MeshData {
  const [w, h, d] = size,
    x = w / 2,
    z = d / 2;
  // Independent vertices per face preserve hard normals and physical-scale UVs.
  const faces = [
    {
      v: [
        [-x, 0, z],
        [x, 0, z],
        [x, h, z],
        [-x, h, z],
      ],
      scale: [w, h],
    },
    {
      v: [
        [x, 0, -z],
        [-x, 0, -z],
        [-x, h, -z],
        [x, h, -z],
      ],
      scale: [w, h],
    },
    {
      v: [
        [x, 0, z],
        [x, 0, -z],
        [x, h, -z],
        [x, h, z],
      ],
      scale: [d, h],
    },
    {
      v: [
        [-x, 0, -z],
        [-x, 0, z],
        [-x, h, z],
        [-x, h, -z],
      ],
      scale: [d, h],
    },
    {
      v: [
        [-x, h, z],
        [x, h, z],
        [x, h, -z],
        [-x, h, -z],
      ],
      scale: [w, d],
    },
    {
      v: [
        [-x, 0, -z],
        [x, 0, -z],
        [x, 0, z],
        [-x, 0, z],
      ],
      scale: [w, d],
    },
  ];
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  faces.forEach((f, i) => {
    positions.push(...f.v.flat());
    const [u, v] = f.scale;
    uvs.push(0, 0, u, 0, u, v, 0, v);
    const o = i * 4;
    indices.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  if (material === "sign")
    for (let i = 0; i < uvs.length; i += 8)
      uvs.splice(i, 8, 0, 0, 1, 0, 1, 1, 0, 1);
  return {
    id,
    label,
    origin,
    positions,
    uvs,
    indices,
    material,
    category,
    solid,
  };
}

export const addV = (a: Vec3, b: Vec3): Vec3 => [
  a[0] + b[0],
  a[1] + b[1],
  a[2] + b[2],
];
export const subV = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const mulV = (a: Vec3, s: number): Vec3 => [
  a[0] * s,
  a[1] * s,
  a[2] * s,
];
export const crossV = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const normalizeV = (a: Vec3): Vec3 =>
  mulV(a, 1 / (Math.hypot(...a) || 1));
export const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 =>
  addV(a, mulV(subV(b, a), t));

/** Small renderer-independent mesh writer. Reverse faces have separate normals. */
export class MeshBuilder {
  positions: number[] = [];
  uvs: number[] = [];
  indices: number[] = [];
  face(points: Vec3[], uv?: number[], double = false) {
    const offset = this.positions.length / 3;
    this.positions.push(...points.flat());
    this.uvs.push(...(uv ?? points.flatMap((p) => [p[0], p[2]])));
    for (let i = 1; i < points.length - 1; i++)
      this.indices.push(offset, offset + i, offset + i + 1);
    if (double) {
      const tex = uv
        ? Array.from({ length: points.length }, (_, i) =>
            uv.slice(i * 2, i * 2 + 2),
          )
            .reverse()
            .flat()
        : undefined;
      this.face([...points].reverse(), tex);
    }
  }
  merge(m: MeshData) {
    const offset = this.positions.length / 3;
    for (let i = 0; i < m.positions.length; i += 3)
      this.positions.push(
        m.positions[i] + m.origin[0],
        m.positions[i + 1] + m.origin[1],
        m.positions[i + 2] + m.origin[2],
      );
    this.uvs.push(...m.uvs);
    this.indices.push(...m.indices.map((i) => i + offset));
  }
  tube(points: Vec3[], radii: number[], sides = 6) {
    let length = 0;
    const rings: Vec3[][] = [];
    const distances: number[] = [];
    // Project the previous ring axis into the new tangent plane (parallel transport).
    let previous: Vec3 | null = null;
    for (let i = 0; i < points.length; i++) {
      const tangent = normalizeV(
        subV(
          points[Math.min(i + 1, points.length - 1)],
          points[Math.max(0, i - 1)],
        ),
      );
      let u: Vec3;
      if (previous) {
        const dot = previous.reduce((n, v, j) => n + v * tangent[j], 0);
        u = normalizeV(subV(previous, mulV(tangent, dot)));
      } else
        u = normalizeV(
          crossV(tangent, Math.abs(tangent[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0]),
        );
      const v = normalizeV(crossV(tangent, u));
      previous = u;
      if (i) length += Math.hypot(...subV(points[i], points[i - 1]));
      distances.push(length);
      rings.push(
        Array.from({ length: sides }, (_, j) =>
          addV(
            points[i],
            addV(
              mulV(u, Math.cos((j / sides) * Math.PI * 2) * radii[i]),
              mulV(v, Math.sin((j / sides) * Math.PI * 2) * radii[i]),
            ),
          ),
        ),
      );
    }
    for (let i = 0; i < rings.length - 1; i++)
      for (let j = 0; j < sides; j++) {
        const k = (j + 1) % sides;
        this.face(
          [rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]],
          [
            j / sides,
            distances[i],
            (j + 1) / sides,
            distances[i],
            (j + 1) / sides,
            distances[i + 1],
            j / sides,
            distances[i + 1],
          ],
        );
      }
    for (let j = 0; j < sides; j++) {
      this.face([points[0], rings[0][(j + 1) % sides], rings[0][j]]);
      const n = rings.length - 1;
      this.face([points[n], rings[n][j], rings[n][(j + 1) % sides]]);
    }
  }
  leaf(base: Vec3, tip: Vec3, width: number, curl = 0.12) {
    const dir = normalizeV(subV(tip, base));
    const side = normalizeV(
      crossV(dir, Math.abs(dir[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0]),
    );
    const normal = normalizeV(crossV(side, dir));
    const ts = [0, 0.3, 0.72, 1],
      centers: Vec3[] = [],
      left: Vec3[] = [],
      right: Vec3[] = [];
    for (const t of ts) {
      const c = addV(
        lerpV(base, tip, t),
        mulV(normal, Math.sin(t * Math.PI) * curl),
      );
      const spread = (width * Math.pow(Math.sin(t * Math.PI), 0.8)) / 2;
      centers.push(c);
      left.push(
        addV(addV(c, mulV(side, spread)), mulV(normal, -spread * 0.23)),
      );
      right.push(
        addV(addV(c, mulV(side, -spread)), mulV(normal, -spread * 0.23)),
      );
    }
    this.face(
      [centers[0], left[1], centers[1]],
      [0.5, 0, 0, 0.3, 0.5, 0.3],
      true,
    );
    this.face(
      [centers[0], centers[1], right[1]],
      [0.5, 0, 0.5, 0.3, 1, 0.3],
      true,
    );
    this.face(
      [centers[1], left[1], left[2], centers[2]],
      [0.5, 0.3, 0, 0.3, 0, 0.72, 0.5, 0.72],
      true,
    );
    this.face(
      [centers[1], centers[2], right[2], right[1]],
      [0.5, 0.3, 0.5, 0.72, 1, 0.72, 1, 0.3],
      true,
    );
    this.face(
      [centers[2], left[2], centers[3]],
      [0.5, 0.72, 0, 0.72, 0.5, 1],
      true,
    );
    this.face(
      [centers[2], centers[3], right[2]],
      [0.5, 0.72, 0.5, 1, 1, 0.72],
      true,
    );
  }
  lathe(
    profile: [number, number][],
    sides = 10,
    radial?: (angle: number, y: number) => number,
  ) {
    for (let i = 0; i < profile.length - 1; i++)
      for (let j = 0; j < sides; j++) {
        const point = (row: number, k: number): Vec3 => {
          const [r, y] = profile[row],
            a = (k / sides) * Math.PI * 2;
          const rr = r * (radial?.(a, y) ?? 1);
          return [rr * Math.cos(a), y, -rr * Math.sin(a)];
        };
        const a = point(i, j),
          b = point(i, j + 1),
          c = point(i + 1, j + 1),
          d = point(i + 1, j);
        if (profile[i][0] === 0) this.face([a, c, d]);
        else if (profile[i + 1][0] === 0) this.face([a, b, c]);
        else
          this.face(
            [a, b, c, d],
            [
              j / sides,
              profile[i][1],
              (j + 1) / sides,
              profile[i][1],
              (j + 1) / sides,
              profile[i + 1][1],
              j / sides,
              profile[i + 1][1],
            ],
          );
      }
  }
  build(
    id: string,
    label: string,
    material: MaterialRole,
    category: MeshData["category"],
    solid = false,
    origin: Vec3 = [0, 0, 0],
  ): MeshData {
    return {
      id,
      label,
      material,
      category,
      solid,
      origin,
      positions: this.positions,
      uvs: this.uvs,
      indices: this.indices,
    };
  }
}
export function beam(
  id: string,
  a: Vec3,
  b: Vec3,
  width: number,
  material: MaterialRole,
  category: MeshData["category"] = "structure",
  solid = true,
): MeshData {
  const m = new MeshBuilder();
  m.tube([a, b], [width, width], 4);
  return m.build(id, id.replaceAll("-", " "), material, category, solid);
}
