import test from "node:test";
import assert from "node:assert/strict";
import { preset } from "../src/core/project";
import { buildScene, moveWalker, bounds } from "../src/core/geometry";
import {
  floorElevation,
  stairPlan,
  buildingTopology,
} from "../src/core/building";
import { generateRock } from "../src/core/geology";
test("L, U and courtyard villas have empty recesses, genuine entrances and connected wings", () => {
  for (const shape of ["l", "u", "courtyard"] as const) {
    const p = preset("villa");
    p.structure.footprint = shape;
    p.roof = "hip";
    p.furnished = false;
    p.landscape.density = 0;
    const scene = buildScene(p),
      cx = shape === "l" ? -p.width / 3 : 0,
      front = shape === "u" ? -p.depth / 6 : p.depth / 2;
    const at = moveWalker([cx, 1.66, front + 2], [0, -3], scene);
    assert(at[2] < front - 0.5, `${shape} entry blocked ${at}`);
    const slabs = scene.filter(
      (m) => m.id.includes("wing-0-") && m.id.endsWith("-slab"),
    );
    assert.equal(slabs.length, shape === "l" ? 5 : shape === "u" ? 7 : 8);
    if (shape !== "l")
      assert(
        !slabs.some((m) => {
          const b = bounds(m);
          return (
            b.min[0] < -0.1 &&
            b.max[0] > 0.1 &&
            b.min[2] < -0.1 &&
            b.max[2] > 0.1
          );
        }),
      );
    const graph = buildingTopology(p),
      reached = new Set(["outside"]);
    for (let i = 0; i < graph.rooms.length; i++)
      for (const c of graph.connections) {
        if (reached.has(c.from)) reached.add(c.to);
        if (reached.has(c.to)) reached.add(c.from);
      }
    assert.equal(reached.size, graph.rooms.length);
    for (const m of scene) {
      assert(m.positions.every(Number.isFinite));
      for (let i = 0; i < m.indices.length; i += 3) {
        const a = m.indices[i] * 3,
          b = m.indices[i + 1] * 3,
          c = m.indices[i + 2] * 3,
          u = [0, 1, 2].map((k) => m.positions[b + k] - m.positions[a + k]),
          v = [0, 1, 2].map((k) => m.positions[c + k] - m.positions[a + k]);
        assert(
          Math.hypot(
            u[1] * v[2] - u[2] * v[1],
            u[2] * v[0] - u[0] * v[2],
            u[0] * v[1] - u[1] * v[0],
          ) > 1e-9,
        );
      }
    }
  }
});
test("Connected two-storey wings retain matching voids and a complete stair route", () => {
  for (const shape of ["l", "u", "courtyard"] as const) {
    const p = preset("villa");
    p.structure.footprint = shape;
    p.structure.storeys = 2;
    p.roof = "hip";
    p.furnished = false;
    p.landscape.density = 0;
    const scene = buildScene(p),
      s = stairPlan(p);
    let at: [number, number, number] = [
      s.left,
      floorElevation(p, 0) + 1.68,
      s.frontZ + 0.55,
    ];
    at = moveWalker(at, [0, s.midZ - at[2]], scene);
    at = moveWalker(at, [s.right - at[0], 0], scene);
    at = moveWalker(at, [0, s.frontZ + 0.55 - at[2]], scene);
    assert(
      Math.abs(at[1] - floorElevation(p, 1) - 1.68) < 0.02,
      `${shape}: ${at}`,
    );
  }
});
test("Geological families have distinct finite bounded silhouettes", () => {
  const results = new Set<string>();
  for (const family of [
    "boulder",
    "fractured",
    "stratified",
    "columnar",
    "scree",
    "river",
  ] as const) {
    const rock = generateRock(family, 123, 1);
    assert(rock.positions.every(Number.isFinite));
    assert(rock.indices.length / 3 < 1000);
    results.add(JSON.stringify(rock.positions));
  }
  assert.equal(results.size, 6);
});
