import test from "node:test";
import assert from "node:assert/strict";
import { preset } from "../src/core/project";
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
