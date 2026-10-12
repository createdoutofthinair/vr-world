import test from "node:test";
import assert from "node:assert/strict";
import { preset, validateProject } from "../src/core/project";
import { buildModules, moduleTransforms } from "../src/core/modules";
import { bounds, moveWalker, buildScene } from "../src/core/geometry";
test("Linked window modules update while locked overrides survive and socket joins follow parent dimensions", () => {
  const p = preset("house");
  p.kit.instances = [
    {
      id: "a",
      definition: "window-bay",
      origin: [0, 0.16, 0],
      yaw: 0,
      overrides: {},
      locked: false,
    },
    {
      id: "b",
      definition: "window-bay",
      origin: [0, 0, 0],
      yaw: 0,
      parent: "a",
      parentSocket: "right",
      socket: "left",
      overrides: { width: 3 },
      locked: true,
    },
  ];
  const before = buildModules(p);
  p.kit.definitions.find((d) => d.id === "window-bay")!.width = 5;
  const transforms = moduleTransforms(p),
    after = buildModules(p);
  assert.equal(transforms.get("a")!.definition.width, 5);
  assert.equal(transforms.get("b")!.definition.width, 3);
  assert.equal(transforms.get("b")!.origin[0], 4);
  const a = after.filter((m) => m.id.startsWith("kit-a-")).map(bounds),
    b = after.filter((m) => m.id.startsWith("kit-b-")).map(bounds);
  assert.equal(
    Math.max(...a.map((v) => v.max[0])),
    Math.min(...b.map((v) => v.min[0])),
  );
  assert.notDeepEqual(
    after.find((m) => m.id === "kit-a-side--1")?.positions,
    before.find((m) => m.id === "kit-a-side--1")?.positions,
  );
  const hole = after.filter(
    (m) => m.material === "wall" && m.id.startsWith("kit-a-"),
  );
  assert(
    !hole.some((m) => {
      const v = bounds(m);
      return v.min[0] < 0 && v.max[0] > 0 && v.min[1] < 1.5 && v.max[1] > 1.5;
    }),
  );
  p.seed++;
  assert.deepEqual(buildModules(p), after);
  p.kit.instances[0].parent = "b";
  p.kit.instances[0].parentSocket = "right";
  p.kit.instances[0].socket = "left";
  assert.throws(() => moduleTransforms(p), /Cyclic/);
});
test("A custom module floor and door bay produce a walkable actual aperture", () => {
  const p = preset("house");
  p.kit.buildingEnabled = false;
  p.landscape.density = 0;
  p.kit.instances = [
    {
      id: "floor",
      definition: "floor-bay",
      origin: [0, -0.04, 0],
      yaw: 0,
      overrides: {},
      locked: false,
    },
    {
      id: "door",
      definition: "door-bay",
      origin: [0, 0.16, 1.5],
      yaw: 0,
      overrides: {},
      locked: false,
    },
  ];
  const scene = buildScene(validateProject(p)),
    end = moveWalker([0, 1.66, 3], [0, -3], scene);
  assert(end[2] < 0.1, `Module doorway blocked ${end}`);
  assert(Math.abs(end[1] - 1.84) < 0.01);
});
