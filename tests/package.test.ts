import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { createPackage, readProducedPackage } from "../src/core/package";
import { buildScene, bounds } from "../src/core/geometry";
import {
  DEFAULT_PROJECT,
  Project,
  MaterialRole,
  MATERIAL_ROLES,
} from "../src/core/project";
const pixel =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=";
function fixture(): Project {
  const p = structuredClone(DEFAULT_PROJECT);
  for (const role of MATERIAL_ROLES)
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
test("Reconstruction executes serialized actions and rejects unsupported animation syntax", async () => {
  const b = await createPackage(fixture()),
    zip = await JSZip.loadAsync(b.bytes);
  b.manifest.placements[0].action = "create animate c3-unknown";
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
test("Selected scope preserves exactly the requested placement and complete texture closure", async () => {
  const p = fixture(),
    scene = buildScene(p),
    id = scene.find((m) => m.category === "windows")!.id;
  const b = await createPackage(p, {
    scope: "selected",
    selected: [id],
    groupBudget: { members: 1, horizontalExtent: 40, triangles: 30000 },
    rejectOversize: true,
  });
  assert.deepEqual(
    b.meshes.map((m) => m.id),
    [id],
  );
  assert.deepEqual(b.manifest.scope, { mode: "selected", ids: [id] });
  assert.equal(b.textureCount, 1);
  const zip = await JSZip.loadAsync(b.bytes),
    groups = JSON.parse(await zip.file("c3-groups.json")!.async("string"));
  assert.equal(groups.budget.members, 1);
  assert.equal(groups.budgetIsNativeLimit, false);
  assert.equal(groups.groups.length, 1);
  await assert.rejects(
    createPackage(p, { scope: "selected", selected: ["missing-object"] }),
    /contains no|stale/,
  );
});
test("Strict group budget rejects an oversized mesh rather than silently omitting geometry", async () => {
  const p = fixture(),
    id = buildScene(p).find((m) => m.id === "site-ground" || m.surfaceMesh)!.id;
  await assert.rejects(
    createPackage(p, {
      scope: "selected",
      selected: [id],
      groupBudget: { members: 1, horizontalExtent: 10, triangles: 100 },
      rejectOversize: true,
    }),
    /individual mesh assets exceed/,
  );
});
test("Package reconstruction rejects changed model bytes and unsafe or duplicate manifest placements", async () => {
  const p = fixture(),
    id = buildScene(p).find((m) => m.category === "windows")!.id,
    b = await createPackage(p, { scope: "selected", selected: [id] });
  const zip = await JSZip.loadAsync(b.bytes),
    path = Object.values(b.manifest.models)[0];
  zip.file(
    path,
    (await zip.file(path)!.async("string")).replace("Vertex ", "Vertex 1 "),
  );
  await assert.rejects(
    readProducedPackage(await zip.generateAsync({ type: "uint8array" })),
    /Model hash mismatch/,
  );
  const unsafe = await JSZip.loadAsync(b.bytes);
  b.manifest.models[b.manifest.placements[0].model] = "../external.rwx";
  unsafe.file("c3-manifest.json", JSON.stringify(b.manifest));
  await assert.rejects(
    readProducedPackage(await unsafe.generateAsync({ type: "uint8array" })),
    /Unsafe model path/,
  );
  const duplicate = await JSZip.loadAsync(b.bytes),
    manifest = JSON.parse(
      await duplicate.file("c3-manifest.json")!.async("string"),
    );
  manifest.placements.push(manifest.placements[0]);
  duplicate.file("c3-manifest.json", JSON.stringify(manifest));
  await assert.rejects(
    readProducedPackage(await duplicate.generateAsync({ type: "uint8array" })),
    /duplicate placement/,
  );
});
test("Selected authored room exports shared walls, its props and the existing supporting slab", async () => {
  const p = fixture();
  p.width = 10;
  p.depth = 10;
  p.landscape.density = 0;
  const { regenerateRooms } = await import("../src/core/rooms");
  p.rooms = regenerateRooms(p);
  const selected = p.rooms.find((r) => r.type === "bedroom")!;
  const b = await createPackage(p, {
    scope: "selected",
    selected: [selected.id],
  });
  assert(b.meshes.some((m) => m.id.includes("mattress")));
  assert(b.meshes.some((m) => m.walkable));
  assert(b.meshes.every((m) => m.walkable || m.roomIds?.includes(selected.id)));
  assert(
    !b.meshes.some((m) =>
      m.roomIds?.includes(p.rooms.find((r) => r.type === "bathroom")!.id),
    ),
  );
});
