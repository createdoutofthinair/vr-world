import { test } from "node:test";
import assert from "node:assert/strict";
import { generatePlant } from "../src/core/plants";
import { DEFAULT_PLANTS, DEFAULT_PROJECT } from "../src/core/project";
import {
  buildScene,
  canStand,
  findWalkSpawn,
  bounds,
} from "../src/core/geometry";
const triangles = (plant: ReturnType<typeof generatePlant>) =>
  plant.meshes.reduce((n, m) => n + m.indices.length / 3, 0);
test("Economy foliage preserves the branching skeleton and reduces exported mesh budget", () => {
  const full = generatePlant("broadleaf", 912, 1, DEFAULT_PLANTS),
    economy = generatePlant("broadleaf", 912, 1, {
      ...DEFAULT_PLANTS,
      quality: "economy",
    });
  assert.deepEqual(economy.skeleton, full.skeleton);
  assert(triangles(economy) < triangles(full) * 0.8);
  const sparse = generatePlant("broadleaf", 912, 1, {
    ...DEFAULT_PLANTS,
    leafDensity: 0.2,
  });
  assert.deepEqual(sparse.skeleton, full.skeleton);
  assert(triangles(sparse) < triangles(full));
});
test("Attraction crowns are deterministic bounded connected graphs and pruning removes descendants", () => {
  const settings = { ...DEFAULT_PLANTS, algorithm: "attraction" as const };
  const tree = generatePlant("canopy", 913, 1, settings);
  assert.deepEqual(tree, generatePlant("canopy", 913, 1, settings));
  assert(tree.skeleton.length > 20 && tree.skeleton.length < 300);
  assert(triangles(tree) < 18000);
  for (const [i, bone] of tree.skeleton.entries())
    if (bone.parent !== null) assert(bone.parent < i);
  const pruned = generatePlant("canopy", 913, 1, {
    ...settings,
    pruned: [4, 5, 6, 7],
  });
  assert(pruned.skeleton.length < tree.skeleton.length);
  const sapling = generatePlant("broadleaf", 913, 1, {
      ...DEFAULT_PLANTS,
      age: "sapling",
    }),
    old = generatePlant("broadleaf", 913, 1, { ...DEFAULT_PLANTS, age: "old" });
  assert(
    Math.max(...sapling.meshes.map((m) => bounds(m).max[1])) <
      Math.max(...old.meshes.map((m) => bounds(m).max[1])),
  );
});
test("Walk spawn derives support and clearance from scene geometry including raised floors", () => {
  const p = structuredClone(DEFAULT_PROJECT);
  p.theme = "jungle";
  p.biome = "tropical";
  const meshes = buildScene(p, false),
    spawn = findWalkSpawn(meshes, [0, 1.68, 0]);
  assert(spawn);
  assert(canStand(spawn[0], spawn[2], spawn[1], meshes));
  assert(spawn[1] >= 1.68);
  assert.equal(findWalkSpawn([], [0, 1.68, 0]), null);
});
