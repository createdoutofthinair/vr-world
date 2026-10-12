import test from "node:test";
import assert from "node:assert/strict";
import { preset, MATERIAL_ROLES, validateProject } from "../src/core/project";
import {
  terrainField,
  terrainHeight,
  terrainWeights,
} from "../src/core/terrain";
import { buildScene, bounds, moveWalker } from "../src/core/geometry";
import { encodePNG, decodePNG, dataURL } from "../src/core/png";
import { createPackage } from "../src/core/package";
test("Regional terrain chunks share canonical edge samples and painted weights survive regeneration", () => {
  const p = preset("house");
  p.landscape.density = 0;
  p.terrain.form = "ridge";
  p.terrain.amplitude = 4;
  p.terrain.edits = [
    {
      id: "paint-1",
      x: 8,
      z: -7,
      radius: 3,
      strength: 1,
      kind: "paint",
      layer: "rock",
      locked: true,
    },
  ];
  const a = terrainField(p);
  assert(a.heights.every(Number.isFinite));
  assert(a.flow.some((f) => f > 1));
  const weights = terrainWeights(p, 8, -7);
  assert.equal(weights.rock, 1);
  assert(
    Math.abs(Object.values(weights).reduce((a, b) => a + b, 0) - 1) < 1e-10,
  );
  p.seed++;
  assert.equal(terrainWeights(p, 8, -7).rock, 1);
  assert.notDeepEqual(terrainField(p).heights, a.heights);
  const meshes = buildScene(p).filter((m) => m.surfaceMesh),
    samples = new Map<string, number>();
  let shared = 0;
  for (const m of meshes)
    for (let i = 0; i < m.positions.length; i += 3) {
      const x = m.positions[i] + m.origin[0],
        z = m.positions[i + 2] + m.origin[2],
        y = m.positions[i + 1] + m.origin[1],
        key = x.toFixed(6) + "," + z.toFixed(6);
      if (samples.has(key)) {
        assert(Math.abs(samples.get(key)! - y) < 1e-6);
        shared++;
      } else samples.set(key, y);
    }
  assert(shared > 100);
  const x = 8,
    z = -7,
    start: [number, number, number] = [x, terrainHeight(p, x, z) + 1.68, z],
    end = moveWalker(start, [0.2, 0], meshes);
  assert(Math.abs(end[0] - x - 0.2) < 0.02);
  assert(Math.abs(end[1] - terrainHeight(p, end[0], end[2]) - 1.68) < 0.05);
});
test("Terrain bakes preserve uploaded pixels, encode real PNG data, and reconstruct from archive bytes", async () => {
  const p = preset("house");
  p.surfaceSource = "procedural";
  p.landscape.density = 0;
  p.terrain.splats = true;
  p.terrain.texelsPerMeter = 8;
  const encoded = encodePNG({
    width: 1,
    height: 1,
    pixels: new Uint8Array([32, 64, 128, 255]),
  });
  assert.deepEqual(
    decodePNG(encoded).pixels,
    new Uint8Array([32, 64, 128, 255]),
  );
  for (const role of MATERIAL_ROLES)
    p.textures[role] = {
      name: "fixture.png",
      width: 1,
      height: 1,
      dataUrl: dataURL(encoded),
    };
  p.terrain.edits = [
    {
      id: "paint-soil",
      x: 0,
      z: 0,
      radius: 20,
      strength: 1,
      kind: "paint",
      layer: "soil",
      locked: true,
    },
  ];
  const original = buildScene(p),
    baked = original.filter((m) => m.bakedTexture);
  assert(baked.length > 1);
  for (const m of baked) {
    const image = decodePNG(
      Uint8Array.from(atob(m.bakedTexture!.dataUrl.split(",")[1]), (c) =>
        c.charCodeAt(0),
      ),
    );
    assert(image.width <= 512);
    assert(Math.abs(image.pixels[0] - 32) <= 1);
    assert(Math.abs(image.pixels[1] - 64) <= 1);
    assert(Math.abs(image.pixels[2] - 128) <= 1);
  }
  const bundle = await createPackage(p);
  assert(bundle.files.some((f) => /c3-terrain-.*\.png$/.test(f)));
  assert(bundle.meshes.some((m) => m.textureRef?.startsWith("c3-terrain-")));
  for (let i = 0; i < original.length; i++) {
    const a = bounds(original[i]),
      b = bounds(bundle.meshes[i]);
    a.min.forEach((v, j) => assert(Math.abs(v - b.min[j]) < 1e-5));
  }
});
test("Corrupt or mismatched PNG assets are rejected before a project is accepted", () => {
  const p = preset("house"),
    bytes = encodePNG({
      width: 1,
      height: 1,
      pixels: new Uint8Array([255, 0, 0, 255]),
    });
  p.textures.wall = {
    name: "bad.png",
    dataUrl: dataURL(bytes),
    width: 2,
    height: 1,
  };
  assert.throws(() => validateProject(p), /dimensions/);
  bytes[45] ^= 1;
  p.textures.wall = {
    name: "bad.png",
    dataUrl: dataURL(bytes),
    width: 1,
    height: 1,
  };
  assert.throws(() => validateProject(p), /checksum|compression/);
});
