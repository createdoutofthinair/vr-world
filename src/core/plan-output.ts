import { MeshData } from "./project";
import { bounds } from "./geometry";
const xml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
const number = (n: number) => Number(n.toFixed(4));
/** Orthographic projections of emitted geometry: openings/voids are not filled from room metadata. */
export function planSVG(
  meshes: MeshData[],
  title: string,
  level: number,
): string {
  const pieces = meshes.filter(
    (m) =>
      (m.level ?? 0) === level &&
      ["structure", "windows", "interior"].includes(m.category),
  );
  if (!pieces.length)
    throw new Error("No building geometry exists on this level.");
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (const mesh of pieces) {
    const b = bounds(mesh);
    x0 = Math.min(x0, b.min[0]);
    x1 = Math.max(x1, b.max[0]);
    z0 = Math.min(z0, b.min[2]);
    z1 = Math.max(z1, b.max[2]);
  }
  const span = Math.max(x1 - x0, z1 - z0),
    margin = Math.max(1, span * 0.04),
    font = Math.max(0.25, span * 0.012);
  const body = pieces
    .map((mesh) => {
      const unique = new Set<string>(),
        paths: string[] = [];
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const points = mesh.indices
          .slice(i, i + 3)
          .map((index) => [
            number(mesh.positions[index * 3] + mesh.origin[0]),
            number(-mesh.positions[index * 3 + 2] - mesh.origin[2]),
          ]);
        const [a, b, c] = points;
        if (
          Math.abs(
            (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
          ) < 1e-8
        )
          continue;
        const key = points
          .map((p) => p.join(","))
          .sort()
          .join(";");
        if (unique.has(key)) continue;
        unique.add(key);
        paths.push(`M${a.join(" ")}L${b.join(" ")}L${c.join(" ")}Z`);
      }
      const fill =
        mesh.material === "glass"
          ? "#91c5d3"
          : mesh.category === "interior"
            ? "#a6b7a0"
            : mesh.id.includes("floor")
              ? "#f1efe5"
              : "#46564d";
      return `<path d="${paths.join("")}" fill="${fill}" fill-rule="nonzero"><title>${xml(mesh.label)}</title></path>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${number(x0 - margin)} ${number(-z1 - margin * 2)} ${number(x1 - x0 + margin * 2)} ${number(z1 - z0 + margin * 4)}" role="img" aria-label="${xml(title)}"><rect x="${number(x0 - margin)}" y="${number(-z1 - margin * 2)}" width="${number(x1 - x0 + margin * 2)}" height="${number(z1 - z0 + margin * 4)}" fill="#fff"/><text x="${number(x0)}" y="${number(-z1 - margin * 0.65)}" font-family="sans-serif" font-size="${font}">${xml(title)} · level ${level + 1} · metres</text>${body}<path d="M${number(x0)} ${number(-z0 + margin * 0.65)}h1" stroke="#263c30" stroke-width="${font * 0.15}"/><text x="${number(x0)}" y="${number(-z0 + margin * 1.3)}" font-family="sans-serif" font-size="${font * 0.75}">1 m · orthographic geometry projection; not construction drawings</text></svg>`;
}
export function inventoryCSV(
  rows: {
    id: string;
    model: string;
    material: string;
    triangles: number;
    position: number[];
    action: string;
  }[],
): string {
  const cell = (value: string | number) => {
    const text = String(value);
    return (
      '"' +
      (typeof value === "string" && /^[=+@-]/.test(text)
        ? "'" + text
        : text
      ).replaceAll('"', '""') +
      '"'
    );
  };
  return (
    [
      "id,model,material,triangles,x_m,y_m,z_m,action",
      ...rows.map((row) =>
        [
          row.id,
          row.model,
          row.material,
          row.triangles,
          ...row.position,
          row.action,
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\r\n") + "\r\n"
  );
}
