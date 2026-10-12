import { MeshData, Vec3, random } from "./project";
import { MeshBuilder, box } from "./mesh";
export type RockFamily =
  "boulder" | "fractured" | "stratified" | "columnar" | "scree" | "river";
export function generateRock(
  family: RockFamily,
  seed: number,
  size = 1,
): MeshData {
  const r = random(seed),
    mesh = new MeshBuilder(),
    phase = r() * 6;
  if (family === "boulder" || family === "river")
    mesh.lathe(
      [
        [0, -0.2],
        [size * 0.75, -0.15],
        [size, 0.18],
        [size * 0.82, size * (family === "river" ? 0.32 : 0.65)],
        [size * 0.35, size * (family === "river" ? 0.42 : 0.88)],
        [0, size * (family === "river" ? 0.45 : 1)],
      ],
      family === "river" ? 12 : 9,
      (a, y) => 1 + 0.13 * Math.sin(a * 3 + phase) + 0.09 * Math.cos(a * 5 + y),
    );
  else if (family === "fractured" || family === "scree") {
    const height = size * (family === "scree" ? 0.45 : 1.3),
      corners: Vec3[] = [];
    for (const y of [-0.15, height])
      for (const z of [-1, 1])
        for (const x of [-1, 1])
          corners.push([
            x * size * (0.7 + r() * 0.25) + (y > 0 ? 0.12 * size : 0),
            y + (r() - 0.5) * 0.16 * size,
            z * size * (0.55 + r() * 0.3),
          ]);
    for (const ids of [
      [0, 1, 3, 2],
      [4, 6, 7, 5],
      [0, 4, 5, 1],
      [2, 3, 7, 6],
      [0, 2, 6, 4],
      [1, 5, 7, 3],
    ])
      mesh.face(ids.map((i) => corners[i]));
  } else if (family === "stratified") {
    const levels = 7;
    for (let i = 0; i < levels; i++) {
      const scale = 0.8 + 0.15 * Math.sin(i * 0.7 + phase),
        height = 0.16 * size,
        layer = box(
          `layer-${i}`,
          "Geological bedding",
          [0.07 * size * Math.sin(i * 0.4), -0.16 + i * height, 0],
          [size * 2 * scale, height, size * 1.55 * scale],
          "rock",
          "landscape",
        );
      mesh.merge(layer);
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const x = ((i % 3) - 1) * size * 0.65,
        z = (Math.floor(i / 3) - 1) * size * 0.57,
        h = size * (1.2 + r() * 0.8),
        column = new MeshBuilder();
      column.lathe(
        [
          [0, -0.12],
          [size * 0.38, -0.12],
          [size * 0.35, h - 0.05],
          [0, h],
        ],
        6,
      );
      mesh.merge(
        column.build("column", "Columnar joint", "rock", "landscape", true, [
          x,
          0,
          z,
        ]),
      );
    }
  }
  return mesh.build(
    `rock-${family}`,
    "Procedural " + family + " rock",
    "rock",
    "landscape",
    true,
  );
}
