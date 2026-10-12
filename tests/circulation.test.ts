import test from "node:test";
import assert from "node:assert/strict";
import { preset, validateProject, MeshData } from "../src/core/project";
import { buildScene, moveWalker, canStand, box } from "../src/core/geometry";
import {
  floorElevation,
  stairPlan,
  buildingTopology,
} from "../src/core/building";

test("Two-storey house has a physical route upstairs, into a room and back downstairs", () => {
  for (const theme of [
    "temperate",
    "jungle",
    "desert",
    "fantasy",
    "scifi",
  ] as const) {
    const p = preset("house", theme);
    p.structure.storeys = 2;
    p.landscape.density = 0;
    const scene = buildScene(p),
      stair = stairPlan(p),
      ground = floorElevation(p, 0) + 1.68;
    let at: [number, number, number] = [
      stair.left,
      ground,
      stair.frontZ + 0.65,
    ];
    assert(
      canStand(...([at[0], at[2], at[1]] as [number, number, number]), scene),
    );
    at = moveWalker(at, [0, stair.midZ - at[2]], scene);
    assert(
      Math.abs(at[2] - stair.midZ) < 0.09,
      `${theme}: lower flight blocked ${at}`,
    );
    at = moveWalker(at, [stair.right - at[0], 0], scene);
    assert(
      Math.abs(at[0] - stair.right) < 0.09,
      `${theme}: turning landing blocked ${at}`,
    );
    at = moveWalker(at, [0, stair.frontZ + 0.65 - at[2]], scene);
    assert(
      Math.abs(at[1] - (floorElevation(p, 1) + 1.68)) < 0.01,
      `${theme}: upper landing not reached ${at}`,
    );
    at = moveWalker(at, [-at[0], 0], scene);
    at = moveWalker(at, [0, -p.depth * 0.3 - at[2]], scene);
    assert(at[2] < -p.depth * 0.2, `${theme}: upper room is unreachable ${at}`);
    at = moveWalker(at, [0, stair.frontZ + 0.65 - at[2]], scene);
    at = moveWalker(at, [stair.right - at[0], 0], scene);
    at = moveWalker(at, [0, stair.midZ - at[2]], scene);
    at = moveWalker(at, [stair.left - at[0], 0], scene);
    at = moveWalker(at, [0, stair.frontZ + 0.65 - at[2]], scene);
    assert(
      Math.abs(at[1] - ground) < 0.01,
      `${theme}: descent did not return to ground ${at}`,
    );
    assert.equal(new Set(scene.map((m) => m.id)).size, scene.length);
    const graph = buildingTopology(p);
    const reachable = new Set(["outside"]);
    for (let i = 0; i < graph.rooms.length; i++)
      for (const link of graph.connections)
        if (reachable.has(link.from)) reachable.add(link.to);
    assert.equal(reachable.size, graph.rooms.length);
  }
});
test("Walkable slabs still block the avatar's head; a closed entry door blocks the real aperture", () => {
  const p = preset("house");
  p.structure.doorAngle = 0;
  p.landscape.density = 0;
  const scene = buildScene(p);
  const blocked = moveWalker([0, 1.66, p.depth / 2 + 2], [0, -3], scene);
  assert(blocked[2] > p.depth / 2 - 0.3);
  p.structure.doorAngle = 90;
  const open = moveWalker([0, 1.66, p.depth / 2 + 2], [0, -3], buildScene(p));
  assert(open[2] < p.depth / 2 - 0.5);
  const slab = box("test-slab", "Ceiling", [0, 1.5, 0], [3, 0.2, 3], "floor");
  slab.walkable = true;
  assert(!canStand(0, 0, 1.84, [slab]));
});
test("Impossible stairs reject the recipe instead of producing blocked flights; v2 migration preserves settings", () => {
  const p = preset("house");
  p.structure.storeys = 2;
  p.structure.stair = "straight";
  assert.throws(() => buildScene(p), /do not fit/);
  const { structure, ...old } = preset("villa");
  const migrated = validateProject({
    ...old,
    schemaVersion: 2,
    generatorVersion: "0.2.0",
  });
  assert.equal(migrated.width, 12);
  assert.equal(migrated.structure.storeys, 1);
  assert.equal(migrated.migratedFrom, "0.2.0");
  assert.throws(() => validateProject({ ...p, width: 4 }), /7 × 8/);
});
test("Repeated apartment floors contain independent units and keep communal stairs and entrances reachable", () => {
  const p = preset("flats");
  p.landscape.density = 0;
  const scene = buildScene(p),
    stair = stairPlan(p);
  for (let level = 0; level < p.structure.storeys; level++) {
    const eye = floorElevation(p, level) + 1.68;
    for (const side of [-1, 1]) {
      const entry =
        side < 0 ? 1.4 : Math.max(stair.frontZ + 0.95, -p.depth * 0.1) + 1;
      const at = moveWalker([0, eye, entry], [side * 1.5, 0], scene);
      assert(
        Math.abs(at[0] - side * 1.5) < 0.08,
        `Unit doorway blocked: level ${level}, side ${side}, ${at}`,
      );
    }
  }
  let at: [number, number, number] = [
    stair.left,
    floorElevation(p, 0) + 1.68,
    stair.frontZ + 0.55,
  ];
  for (let level = 0; level < p.structure.storeys - 1; level++) {
    at = moveWalker(at, [0, stair.midZ - at[2]], scene);
    at = moveWalker(at, [stair.right - at[0], 0], scene);
    at = moveWalker(at, [0, stair.frontZ + 0.55 - at[2]], scene);
    assert(
      Math.abs(at[1] - floorElevation(p, level + 1) - 1.68) < 0.02,
      `Shared stair ${level} blocked: ${at}`,
    );
    at = moveWalker(at, [stair.left - at[0], 0], scene);
  }
  assert.equal(
    buildingTopology(p).rooms.filter((r) => r.type === "apartment").length,
    6,
  );
});
test("Walking rejects steep mesh ground while ordinary step risers remain supported", () => {
  const plane: MeshData = {
    id: "steep-ground",
    label: "Steep ground",
    category: "landscape",
    material: "grass",
    solid: true,
    walkable: true,
    surfaceMesh: true,
    origin: [0, 0, 0],
    positions: [0, 0, 0, 2, 4, 0, 2, 4, 2, 0, 0, 2],
    uvs: [0, 0, 1, 0, 1, 1, 0, 1],
    indices: [0, 2, 1, 0, 3, 2],
  };
  const position: [number, number, number] = [0.1, 1.88, 1];
  assert.deepEqual(moveWalker(position, [0.05, 0], [plane]), position);
  plane.positions = [0, 0, 0, 2, 0.8, 0, 2, 0.8, 2, 0, 0, 2];
  const gentle = moveWalker([0.1, 1.72, 1], [0.05, 0], [plane]);
  assert(gentle[0] > 0.1);
  assert(Math.abs(gentle[1] - 1.74) < 1e-6);
});
test("Changing structural templates preserves authored world edits, assets and pinned landmarks", async () => {
  const { DEFAULT_PROJECT, applyBuildingPreset } =
    await import("../src/core/project");
  const p = structuredClone(DEFAULT_PROJECT);
  p.world.enabled = true;
  p.terrain.edits = [
    {
      id: "sculpt-one",
      x: 15,
      z: 10,
      radius: 2,
      strength: 1,
      kind: "raise",
      layer: "soil",
      locked: true,
    },
  ];
  p.plantLandmarks = [
    {
      id: "landmark-one",
      family: "shrub",
      seed: 43,
      x: 14,
      z: 10,
      scale: 1,
      locked: false,
    },
  ];
  const apartment = applyBuildingPreset(p, "flats");
  assert.equal(apartment.archetype, "flats");
  assert.equal(apartment.structure.storeys, 3);
  assert.deepEqual(apartment.terrain, p.terrain);
  assert.deepEqual(apartment.world, p.world);
  assert.deepEqual(apartment.plantLandmarks, p.plantLandmarks);
  assert.deepEqual(apartment.textures, p.textures);
  assert.doesNotThrow(() => validateProject(apartment));
});
