import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { createPackage, readProducedPackage } from "../src/core/package";
import { buildScene, bounds } from "../src/core/geometry";
import { DEFAULT_PROJECT, Project, MaterialRole } from "../src/core/project";
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6zqkAAAAASUVORK5CYII=";
function fixture(): Project {
  const p = structuredClone(DEFAULT_PROJECT);
  for (const role of [
    "wall",
    "floor",
    "roof",
    "trim",
    "glass",
    "ground",
    "sign",
  ] as MaterialRole[])
    p.textures[role] = {
      name: "fixture.png",
      dataUrl: pixel,
      width: 1,
      height: 1,
    };
  return p;
}
test("A complete archive reconstructs actual RWX and textures, with all asset names prefixed", async () => {
  const p = fixture(),
    original = buildScene(p),
    bundle = await createPackage(p);
  assert.equal(bundle.meshes.length, original.length);
  assert(bundle.bytes.length > 1000);
  assert(bundle.files.every((f) => f.split("/").at(-1)!.startsWith("c3-")));
  assert.equal(bundle.manifest.profile.nativeVerified, false);
  for (let i = 0; i < original.length; i++) {
    const a = bounds(original[i]),
      b = bounds(bundle.meshes[i]);
    a.min.forEach((v, j) => assert(Math.abs(v - b.min[j]) < 1e-6));
    a.max.forEach((v, j) => assert(Math.abs(v - b.max[j]) < 1e-6));
    assert.equal(original[i].solid, bundle.meshes[i].solid);
  }
});
test("Reconstruction fails on a missing emitted texture rather than borrowing the authoring cache", async () => {
  const bundle = await createPackage(fixture()),
    zip = await JSZip.loadAsync(bundle.bytes),
    path = Object.values(bundle.manifest.textures)[0].path;
  zip.remove(path);
  await assert.rejects(
    readProducedPackage(await zip.generateAsync({ type: "uint8array" })),
    /Missing texture/,
  );
});
test("Reconstruction executes serialized actions and rejects unimplemented motion", async () => {
  const b = await createPackage(fixture()),
    zip = await JSZip.loadAsync(b.bytes);
  b.manifest.placements[0].action = "create move 0 1 0";
  zip.file("c3-manifest.json", JSON.stringify(b.manifest));
  await assert.rejects(
    readProducedPackage(await zip.generateAsync({ type: "uint8array" })),
    /Unsupported creation action/,
  );
});
test("Changed texture bytes are detected by their package hash", async () => {
  const b = await createPackage(fixture()),
    zip = await JSZip.loadAsync(b.bytes),
    path = Object.values(b.manifest.textures)[0].path;
  zip.file(path, new Uint8Array([1, 2, 3]));
  await assert.rejects(
    readProducedPackage(await zip.generateAsync({ type: "uint8array" })),
    /hash mismatch/,
  );
});
