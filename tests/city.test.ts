import test from "node:test";
import assert from "node:assert/strict";
import { preset, validateProject } from "../src/core/project";
import { cityPlan } from "../src/core/city";
import { buildScene, moveWalker, bounds } from "../src/core/geometry";
test("Seeded neighborhood has a connected road graph and stable locked buildings", () => {
  const p = preset("house");
  p.world.enabled = true;
  p.world.blocks = 1;
  p.world.parkRatio = 0;
  const a = cityPlan(p);
  assert.equal(a.nodes.length, 4);
  assert.equal(a.edges.length, 4);
  assert.equal(a.plots.length, 4);
  assert.deepEqual(cityPlan(p), a);
  const plot = a.plots[0];
  p.world.locks[plot.id] = {
    seed: plot.seed,
    archetype: plot.archetype,
    theme: plot.theme,
    storeys: plot.storeys,
  };
  p.seed += 123;
  const b = cityPlan(p);
  assert.deepEqual(b.plots[0], plot);
  assert.notDeepEqual(b.plots[1], a.plots[1]);
  const scene = buildScene(p);
  assert.equal(new Set(scene.map((m) => m.id)).size, scene.length);
  for (const m of scene) {
    assert(m.positions.every(Number.isFinite));
    assert(m.indices.every((i) => i >= 0 && i < m.positions.length / 3));
  }
});
test("Pavement junctions meet their strips without overlapping plates; street route enters a generated shop", () => {
  const p = preset("shop");
  p.world = {
    ...p.world,
    enabled: true,
    blocks: 1,
    parkRatio: 0,
    locks: {
      "block-0-0-plot-0": {
        seed: 123,
        archetype: "shop",
        theme: "temperate",
        storeys: 1,
      },
    },
  };
  const plan = cityPlan(p),
    scene = buildScene(p),
    half = plan.spacing / 2,
    offset = p.world.roadWidth / 2 + p.world.sidewalkWidth / 2;
  let at: [number, number, number] = [-half - offset, 1.82, -half - offset];
  at = moveWalker(at, [0, plan.spacing], scene);
  assert(
    Math.abs(at[2] - (half - offset)) < 0.08,
    `West pavement blocked ${at}`,
  );
  at = moveWalker(at, [plan.spacing + offset * 2, 0], scene);
  assert(at[0] > half, `North corner blocked ${at}`);
  const plot = plan.plots[0],
    front = plot.z - 3.5,
    street = -half + p.world.roadWidth / 2 + 0.4;
  at = [plot.x, 1.695, street];
  at = moveWalker(at, [0, front - street + 2], scene);
  assert(at[2] > front + 0.8, `Shop entrance blocked ${at}`);
  const corner = scene.find((m) => m.id === "junction-0-0-pavement-1-1")!,
    strip = scene.find((m) => m.id === "street-x-0-0-pavement-1")!;
  assert(Math.abs(bounds(corner).max[0] - bounds(strip).min[0]) < 1e-8);
  const crossings = scene.filter((m) => m.id.includes("-crossing-"));
  assert.equal(crossings.length, 40);
});
test("Parks respect density and foliage; creek parks preserve the carved channel", () => {
  const p = preset("house", "jungle");
  p.world.enabled = true;
  p.world.blocks = 1;
  p.world.parkRatio = 0.6;
  for (const plot of cityPlan(p).plots)
    p.world.locks[plot.id] = { ...plot, park: true };
  p.landscape.density = 0;
  assert(!buildScene(p, false).some((m) => m.id.includes("-plant-")));
  p.landscape.density = 0.5;
  p.landscape.foliage = false;
  const scene = buildScene(p, false);
  assert(scene.some((m) => m.id.includes("-plant-")));
  assert(
    !scene.some(
      (m) => m.id.includes("-plant-") && /leaves|leaf-tips/.test(m.id),
    ),
  );
  p.effects.creek = true;
  p.world.blocks = 3;
  p.world.locks = {};
  const river = cityPlan(p).plots.filter(
      (plot) => plot.park && Math.abs(plot.x) < 8.5,
    ),
    wet = buildScene(p, false);
  for (const plot of river)
    assert(!wet.some((m) => m.id === `${plot.id}-park`));
});

test("District recipes zone complete blocks while keeping connected streets and locked plots", () => {
  const p = preset("house");
  p.world.enabled = true;
  p.world.blocks = 3;
  p.world.parkRatio = 0;
  p.world.districts = {
    "block-0-0": { zone: "residential", theme: "temperate", maxStoreys: 2 },
    "block-1-0": { zone: "commercial", theme: "desert", maxStoreys: 1 },
    "block-2-0": { zone: "park", theme: "jungle", maxStoreys: 1 },
  };
  const original = cityPlan(p);
  assert.equal(original.plots.length, 36);
  const visited = new Set([original.nodes[0].id]);
  for (let i = 0; i < original.nodes.length; i++)
    for (const edge of original.edges)
      if (visited.has(edge.from) || visited.has(edge.to)) {
        visited.add(edge.from);
        visited.add(edge.to);
      }
  assert.equal(visited.size, original.nodes.length);
  for (const plot of original.plots) {
    if (plot.id.startsWith("block-0-0-")) {
      assert(["house", "villa", "flats"].includes(plot.archetype));
      assert(plot.storeys <= 2);
    }
    if (plot.id.startsWith("block-1-0-")) {
      assert(["shop", "mixed"].includes(plot.archetype));
      assert.equal(plot.theme, "desert");
      assert.equal(plot.storeys, 1);
    }
    if (plot.id.startsWith("block-2-0-")) assert(plot.park);
  }
  p.world.locks["block-2-0-plot-0"] = {
    seed: 123,
    archetype: "villa",
    theme: "fantasy",
    storeys: 3,
    park: false,
  };
  p.seed++;
  const locked = cityPlan(p).plots.find((v) => v.id === "block-2-0-plot-0")!;
  assert.equal(locked.park, false);
  assert.equal(locked.archetype, "villa");
  assert.equal(locked.theme, "fantasy");
  assert.equal(locked.storeys, 3);
  assert.deepEqual(cityPlan(p).edges, original.edges);
});

test("District recipes persist across validation and retain dormant blocks without changing legacy plans", async () => {
  const { validateProject } = await import("../src/core/project");
  const p = preset("house"),
    before = cityPlan(p);
  const old = JSON.parse(JSON.stringify(p));
  delete old.world.districts;
  assert.deepEqual(cityPlan(validateProject(old)), before);
  p.world.districts = {
    "block-2-2": { zone: "park", theme: "jungle", maxStoreys: 1 },
  };
  p.world.blocks = 1;
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(restored.world.districts, p.world.districts);
  restored.world.blocks = 3;
  assert(
    cityPlan(restored)
      .plots.filter((v) => v.id.startsWith("block-2-2-"))
      .every((v) => v.park),
  );
  for (const recipe of [
    { zone: "unknown", theme: "jungle", maxStoreys: 1 },
    { zone: "park", theme: "unknown", maxStoreys: 1 },
    { zone: "park", theme: "jungle", maxStoreys: 99 },
  ]) {
    const invalid = JSON.parse(JSON.stringify(p));
    invalid.world.districts["block-2-2"] = recipe;
    assert.throws(() => validateProject(invalid), /district/);
  }
});

test("Shifted street rows rebuild parcels, exact street spans, grading and physical entrance routes", async () => {
  const { validateProject } = await import("../src/core/project");
  const { terrainHeight } = await import("../src/core/terrain");
  const p = preset("shop");
  p.world.enabled = true;
  p.world.blocks = 2;
  p.world.parkRatio = 0;
  p.landscape.density = 0;
  p.terrain.form = "hills";
  p.terrain.amplitude = 4;
  p.world.roadOffsets = { x: { "1": 3 }, z: { "1": -2 } };
  p.world.locks["block-0-0-plot-0"] = {
    seed: 123,
    archetype: "shop",
    theme: "temperate",
    storeys: 1,
  };
  const restored = validateProject(JSON.parse(JSON.stringify(p))),
    plan = cityPlan(restored),
    scene = buildScene(restored);
  assert.deepEqual(restored.world.roadOffsets, p.world.roadOffsets);
  assert.equal(plan.nodes.find((n) => n.id === "junction-1-1")!.x, 3);
  assert.equal(plan.nodes.find((n) => n.id === "junction-1-1")!.z, -2);
  for (const edge of plan.edges) {
    const a = plan.nodes.find((n) => n.id === edge.from)!,
      b = plan.nodes.find((n) => n.id === edge.to)!;
    const road = scene.find((m) => m.id === edge.id)!,
      box = bounds(road);
    const alongX = a.z === b.z,
      axis = alongX ? 0 : 2;
    assert(
      Math.abs(
        box.min[axis] -
          Math.min(alongX ? a.x : a.z, alongX ? b.x : b.z) -
          p.world.roadWidth / 2,
      ) < 1e-6,
    );
    assert(
      Math.abs(
        box.max[axis] -
          Math.max(alongX ? a.x : a.z, alongX ? b.x : b.z) +
          p.world.roadWidth / 2,
      ) < 1e-6,
    );
    assert.equal(
      terrainHeight(restored, (a.x + b.x) / 2, (a.z + b.z) / 2),
      -0.02,
    );
  }
  const plot = plan.plots[0],
    street = -plan.spacing + p.world.roadWidth / 2 + 0.4;
  let at: [number, number, number] = [plot.x, 1.695, street];
  for (let i = 0; i < 300 && at[2] < plot.z - 3.5; i++)
    at = moveWalker(at, [0, 0.1], scene);
  assert(at[2] >= plot.z - 3.6, `Shifted entrance blocked ${at}`);
  assert.equal(new Set(scene.map((m) => m.id)).size, scene.length);
});

test("Street edit validation rejects narrow parcels and unsupported shifted viaducts while retaining dormant offsets", async () => {
  const { validateProject } = await import("../src/core/project");
  const p = preset("house");
  p.world.enabled = true;
  p.world.blocks = 3;
  p.world.roadOffsets = { x: { "1": 8 }, z: {} };
  assert.throws(() => validateProject(p), /frontage/);
  p.world.roadOffsets = { x: { "1": 2 }, z: { "2": -1 } };
  p.effects.viaduct = true;
  assert.throws(() => validateProject(p), /shifted streets/);
  assert.throws(() => buildScene(p), /shifted streets/);
  p.effects.viaduct = false;
  p.world.blocks = 1;
  const restored = validateProject(p);
  assert.deepEqual(restored.world.roadOffsets, p.world.roadOffsets);
  restored.world.blocks = 3;
  assert(
    Math.abs(
      cityPlan(restored).nodes.find((n) => n.id === "junction-1-2")!.x -
        (-cityPlan(restored).spacing / 2 + 2),
    ) < 1e-10,
  );
});

test("Selected parcel overrides change emitted building geometry and persist without moving parcels", () => {
  const p = preset("shop", "temperate");
  p.world.enabled = true;
  p.world.blocks = 1;
  p.world.parkRatio = 0;
  const plan = cityPlan(p),
    plot = plan.plots[0];
  p.world.locks[plot.id] = {
    seed: plot.seed,
    archetype: "shop",
    theme: "temperate",
    storeys: 1,
    building: { width: 8, height: 3, windows: false },
  };
  const a = buildScene(validateProject(p));
  p.world.locks[plot.id].building = { width: 12, height: 4, windows: true };
  const restored = validateProject(JSON.parse(JSON.stringify(p)));
  const b = buildScene(restored);
  assert.equal(restored.world.locks[plot.id].building!.width, 12);
  assert.deepEqual(cityPlan(restored).nodes, plan.nodes);
  assert.equal(cityPlan(restored).plots[0].parcelWidth, p.world.blockSize / 2);
  assert.notDeepEqual(
    a.filter((m) => m.id.startsWith(plot.id)).map((m) => m.positions),
    b.filter((m) => m.id.startsWith(plot.id)).map((m) => m.positions),
  );
  p.world.locks[plot.id].building = { width: 18 };
  assert.throws(() => buildScene(validateProject(p)), /fixed.*parcel/);
});
