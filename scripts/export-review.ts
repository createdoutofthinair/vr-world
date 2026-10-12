// Reproducible neutral-geometry inspection inputs; no browser rendering is implied.
import { writeFileSync, mkdirSync } from "node:fs";
import { preset, materialsFor, Theme, THEMES } from "../src/core/project";
import { REFERENCE_EXAMPLES, referenceExample } from "../src/core/examples";
import { buildScene } from "../src/core/geometry";
const dir = process.argv[2] ?? "/tmp/c3-scene-review";
mkdirSync(dir, { recursive: true });
const only = process.argv[3];
for (const theme of Object.keys(THEMES) as Theme[]) {
  if (only && theme !== only) continue;
  const project = preset(
    theme === "temperate" ? "shop" : theme === "desert" ? "villa" : "house",
    theme,
  );
  const meshes = buildScene(project),
    materials = materialsFor(project);
  writeFileSync(
    `${dir}/${theme}.json`,
    JSON.stringify({ project, materials, meshes }),
  );
  console.log(
    `${theme}: ${meshes.length} pieces, ${meshes.reduce((n, m) => n + m.indices.length / 3, 0)} triangles`,
  );
}

for (const example of REFERENCE_EXAMPLES) {
  if (only && example.id !== only) continue;
  const project = referenceExample(example.id)!,
    meshes = buildScene(project),
    materials = materialsFor(project);
  writeFileSync(
    `${dir}/${example.id}.json`,
    JSON.stringify({
      project,
      materials,
      meshes,
      ...(example.id === "viaduct-city"
        ? { camera: { eye: [-115, 22, 10], target: [0, 2, -22.8] } }
        : {}),
    }),
  );
  console.log(
    `${example.id}: ${meshes.length} pieces, ${meshes.reduce((n, m) => n + m.indices.length / 3, 0)} triangles`,
  );
}
