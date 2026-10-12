import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PROJECT, validateProject } from "../src/core/project";
import { packProject, unpackProject } from "../src/core/persistence";
import { encodePNG, dataURL } from "../src/core/png";
const asset = (name: string, value = 255) => ({
  name,
  width: 1,
  height: 1,
  dataUrl: dataURL(
    encodePNG({
      width: 1,
      height: 1,
      pixels: new Uint8Array([value, 100, 80, 255]),
    }),
  ),
});
test("Content-addressed snapshots deduplicate surface/PBR/sign pixels while preserving editable asset metadata", async () => {
  const p = structuredClone(DEFAULT_PROJECT);
  p.textures.wall = asset("wall.png");
  p.materialMaps.wall = {
    normal: asset("normal.png"),
    normalConvention: "directx",
  };
  p.signs = [
    {
      id: "shop-one",
      kind: "fascia",
      width: 2,
      height: 0.4,
      text: "Shop",
      asset: asset("raster.png"),
      artwork: asset("original.png"),
    },
  ];
  const clean = validateProject(p),
    packed = await packProject(clean);
  assert.equal(packed.assets.size, 1);
  assert(!JSON.stringify(packed.document).includes("data:image"));
  const restored = await unpackProject(packed.document, async (id) =>
    packed.assets.get(id),
  );
  assert.deepEqual(restored, clean);
  await assert.rejects(
    unpackProject(packed.document, async () => undefined),
    /Missing stored texture/,
  );
  await assert.rejects(
    unpackProject(
      packed.document,
      async () => asset("changed.png", 60).dataUrl,
    ),
    /hash mismatch/,
  );
});
test("Portable project ZIP restores semantic edits and shared uploaded assets from emitted files", async () => {
  const { createPortableProject, readPortableProject } =
    await import("../src/core/portable-project");
  const p = structuredClone(DEFAULT_PROJECT);
  p.textures.wall = asset("wall.png");
  p.textures.floor = asset("floor.png");
  p.terrain.edits = [
    {
      id: "paint-one",
      x: 9,
      z: 5,
      radius: 2,
      strength: 1,
      kind: "paint",
      layer: "soil",
      locked: true,
    },
  ];
  const bytes = await createPortableProject(p);
  assert.deepEqual(await readPortableProject(bytes), validateProject(p));
  const { default: JSZip } = await import("jszip"),
    zip = await JSZip.loadAsync(bytes),
    files = Object.keys(zip.files).filter((path) => path.endsWith(".png"));
  assert.equal(files.length, 1);
  zip.remove(files[0]);
  await assert.rejects(
    readPortableProject(await zip.generateAsync({ type: "uint8array" })),
    /Missing stored texture/,
  );
});
