import { test } from "node:test";
import assert from "node:assert/strict";
import { bounds, buildScene, canStand, moveWalker } from "../src/core/geometry";
import {
  DEFAULT_PROJECT,
  materialsFor,
  preset,
  random,
  validateProject,
} from "../src/core/project";
import {
  evaluateCreationAction,
  parseRWX,
  serializeRWX,
} from "../src/core/rwx";

test("Every preset and boundary configuration produces finite, nondegenerate indexed geometry", () => {
  for (const type of ["shop", "house", "villa"] as const)
    for (const width of [4, 8, 18])
      for (const depth of [4, 18])
        for (const wallThickness of [0.12, 0.45])
          for (const doorWidth of [0.9, 2]) {
            const p = validateProject({
                ...preset(type),
                width,
                depth,
                wallThickness,
                doorWidth,
              }),
              scene = buildScene(p);
            assert.equal(new Set(scene.map((m) => m.id)).size, scene.length);
            for (const m of scene) {
              assert(m.positions.every(Number.isFinite));
              assert.equal(m.positions.length / 3, m.uvs.length / 2);
              assert(m.uvs.every(Number.isFinite));
              const b = bounds(m);
              assert(b.max.every((v, i) => v > b.min[i]));
              for (const index of m.indices)
                assert(index >= 0 && index < m.positions.length / 3);
            }
          }
});

test("Nonsolid floors do not support the walking controller", () => {
  const meshes = buildScene({ ...DEFAULT_PROJECT, furnished: false }).map(
    (mesh) => (mesh.id === "building-floor" ? { ...mesh, solid: false } : mesh),
  );
  const moved = moveWalker([0, 1.84, 0], [0.4, 0], meshes);
  assert.ok(Math.abs(moved[1] - 1.66) < 1e-8);
});
test("The front doorway is a real passable aperture and neighboring wall stops movement", () => {
  const p = { ...DEFAULT_PROJECT, furnished: false },
    scene = buildScene(p);
  const through = moveWalker([0, 1.66, p.depth / 2 + 3], [0, -6], scene);
  assert(through[2] < p.depth / 2 - 1);
  assert(Math.abs(through[1] - 1.84) < 1e-6);
  const blocked = moveWalker(
    [p.width / 2 - 0.6, 1.66, p.depth / 2 + 3],
    [0, -6],
    scene,
  );
  assert(
    blocked[2] >= p.depth / 2 + 0.2,
    "a long step must not tunnel through the front wall",
  );
});
test("Wide doors remain passable at minimum footprint and maximum wall thickness", () => {
  const p = {
    ...DEFAULT_PROJECT,
    width: 4,
    depth: 4,
    wallThickness: 0.45,
    doorWidth: 2,
    furnished: false,
  };
  const scene = buildScene(p);
  assert(canStand(0, 2, 1.84, scene));
  const through = moveWalker([0, 1.66, 4], [0, -3], scene);
  assert(through[2] < 1.2);
});
test("Solid glass closes window apertures for walking while roof cutaway never changes collision source", () => {
  const p = { ...DEFAULT_PROJECT, furnished: false };
  const meshes = buildScene(p),
    glass = meshes.find((m) => m.id === "wall-left-glass-0")!;
  assert(glass.solid);
  assert(!canStand(-p.width / 2 + 0.1, 0, 1.84, meshes));
  assert(meshes.some((m) => m.category === "roof"));
  assert(canStand(0, 0, 1.84, meshes));
});
test("Geometry generation and seed streams are deterministic", () => {
  const p = preset("villa", "desert");
  assert.deepEqual(buildScene(p), buildScene(structuredClone(p)));
  const a = random(81),
    b = random(81),
    c = random(82);
  const av = Array.from({ length: 20 }, a);
  assert.deepEqual(av, Array.from({ length: 20 }, b));
  assert.notDeepEqual(av, Array.from({ length: 20 }, c));
});
test("Serialized RWX round trip preserves local vertices, UVs, placement, winding, and material values", () => {
  const p = preset("house", "fantasy"),
    specs = materialsFor(p);
  for (const m of buildScene(p)) {
    const out = serializeRWX(m, specs[m.material], `c3-${m.material}-fixture`),
      parsed = parseRWX(out, m);
    assert.deepEqual(parsed.mesh.indices, m.indices);
    assert.deepEqual(parsed.mesh.origin, m.origin);
    parsed.mesh.positions.forEach((v, i) =>
      assert(Math.abs(v - m.positions[i]) <= 0.000001),
    );
    parsed.mesh.uvs.forEach((v, i) =>
      assert(Math.abs(v - m.uvs[i]) <= 0.000001),
    );
    assert.equal(parsed.color, specs[m.material].color);
    assert.equal(parsed.opacity, specs[m.material].opacity);
  }
});
test("Independent asymmetric fixture identifies ten-meter scale and clockwise triangle conversion", () => {
  const fixture =
    "ModelBegin\nClumpBegin\nColor 1 0 0\nTexture c3-fixture\nVertex 0 0 0 UV 0 0\nVertex 0.2 0 0 UV 1 0\nVertex 0 0.3 0 UV 0 1\nTriangle 1 3 2\nClumpEnd\nModelEnd";
  const m = parseRWX(fixture, {
    id: "fixture",
    label: "fixture",
    origin: [7, 2, -3],
    solid: true,
    category: "structure",
    material: "wall",
  });
  assert.deepEqual(m.mesh.positions, [0, 0, 0, 2, 0, 0, 0, 3, 0]);
  assert.deepEqual(m.mesh.indices, [0, 1, 2]);
  assert.deepEqual(bounds(m.mesh), { min: [7, 2, -3], max: [9, 5, -3] });
  assert.equal(m.color, "#ff0000");
});
test("Unsupported statements, nonfinite values, missing indices, and invalid clumps are rejected", () => {
  const m = buildScene(DEFAULT_PROJECT)[0],
    good = serializeRWX(
      m,
      materialsFor(DEFAULT_PROJECT).ground,
      "c3-ground-fixture",
    );
  assert.throws(
    () => parseRWX(good.replace("ClumpBegin", "ClumpBegin\nScale 2 2 2"), m),
    /Unsupported/,
  );
  assert.throws(
    () => parseRWX(good.replace(/Vertex [^\n]+/, "Vertex NaN 0 0 UV 0 0"), m),
    /Invalid number/,
  );
  assert.throws(
    () => parseRWX(good.replace(/Triangle [^\n]+/, "Triangle 1 2 999999"), m),
    /missing vertex/,
  );
  assert.throws(() => parseRWX(good.replace("ModelEnd", ""), m), /Incomplete/);
  assert.throws(
    () => serializeRWX(m, materialsFor(DEFAULT_PROJECT).ground, "bad-texture"),
    /c3-/,
  );
});
test("Creation actions are actually interpreted; broader scripts are explicit errors", () => {
  assert.deepEqual(evaluateCreationAction("create solid off"), {
    solid: false,
  });
  assert.deepEqual(evaluateCreationAction("CREATE SOLID ON"), { solid: true });
  assert.throws(
    () => evaluateCreationAction("create move 0 2 0"),
    /Unsupported/,
  );
});
test("Imported project validation rejects unknown versions, script-capable images, and unsafe numeric data", () => {
  assert.throws(
    () => validateProject({ ...DEFAULT_PROJECT, schemaVersion: 99 }),
    /version/,
  );
  assert.throws(
    () => validateProject({ ...DEFAULT_PROJECT, width: NaN }),
    /width/,
  );
  assert.throws(
    () => validateProject({ ...DEFAULT_PROJECT, width: -2 }),
    /width/,
  );
  assert.throws(
    () =>
      validateProject({
        ...DEFAULT_PROJECT,
        textures: {
          wall: {
            name: "x",
            dataUrl: "data:image/svg+xml,<svg/>",
            width: 10,
            height: 10,
          },
        },
      }),
    /texture/,
  );
  assert.throws(
    () => validateProject({ ...DEFAULT_PROJECT, theme: "unknown" }),
    /theme/,
  );
  assert.throws(
    () => validateProject({ ...DEFAULT_PROJECT, seed: 1.5 }),
    /integer/,
  );
});
