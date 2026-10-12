import test from "node:test";
import assert from "node:assert/strict";
import { preset, validateProject } from "../src/core/project";
import { buildViaduct, viaductPlan } from "../src/core/viaduct";
import { buildScene, moveWalker, canStand, bounds } from "../src/core/geometry";
import { partitionGroups } from "../src/core/groups";
import { terrainHeight } from "../src/core/terrain";
test("Elevated road has traversable approaches, clear crossing and grounded bounded modules", () => {
  const p = preset("shop");
  p.world.enabled = true;
  p.world.blocks = 3;
  p.effects.viaduct = true;
  p.landscape.density = 0;
  p.terrain.amplitude = 0;
  const plan = viaductPlan(p)!,
    parts = buildViaduct(p),
    scene = buildScene(p, false),
    z = plan.z + p.world.roadWidth / 2 + p.world.sidewalkWidth / 2;
  let at: [number, number, number] = [
    plan.x0 + 0.1,
    plan.heightAt(plan.x0 + 0.1) + 0.125 + 1.68,
    z,
  ];
  at = moveWalker(at, [plan.x1 - plan.x0 - 0.2, 0], scene);
  assert(Math.abs(at[0] - (plan.x1 - 0.1)) < 0.1, `Blocked approach ${at}`);
  assert(Math.abs(at[1] - (plan.heightAt(at[0]) + 0.125 + 1.68)) < 0.1);
  const underX = plan.spacing * 0.5;
  assert(
    canStand(underX, plan.z, 1.695, parts),
    "Central crossing has head clearance",
  );
  assert(
    !canStand(plan.x0 + plan.spacing * 0.3, plan.z, 1.695, parts),
    "Low ramp blocks a ground-level head",
  );
  for (const [i, x] of plan.supports.entries()) {
    const foot = parts.find((m) => m.id === `viaduct-footing-${i}`)!;
    assert(
      Math.abs(bounds(foot).min[1] - (terrainHeight(p, x, plan.z) - 0.1)) <
        1e-6,
    );
    assert(
      ![-0.5, 0.5].some(
        (n) =>
          Math.abs(x - n * plan.spacing) <
          p.world.roadWidth / 2 + p.world.sidewalkWidth + 1,
      ),
    );
  }
  assert(partitionGroups(parts).every((g) => !g.oversize));
  assert.equal(new Set(parts.map((m) => m.id)).size, parts.length);
});
test("Migration retains v4 world settings and rejects infeasible viaduct recipes", () => {
  const p = preset("house");
  const { viaductHeight, ...world } = p.world,
    { viaduct, ...effects } = p.effects;
  const migrated = validateProject({
    ...p,
    schemaVersion: 4,
    generatorVersion: "0.4.0",
    world,
    effects,
  });
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.world.viaductHeight, 3);
  assert.equal(migrated.effects.viaduct, false);
  assert.deepEqual(migrated.plants, p.plants);
  p.effects.viaduct = true;
  assert.throws(() => validateProject(p), /three-block/);
  p.world.enabled = true;
  p.world.blocks = 3;
  p.world.blockSize = 32;
  p.world.roadWidth = 4;
  p.world.sidewalkWidth = 1.2;
  p.world.viaductHeight = 5;
  assert.throws(() => validateProject(p), /grade budget/);
});
