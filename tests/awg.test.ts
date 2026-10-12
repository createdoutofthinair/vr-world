import test from "node:test";
import assert from "node:assert/strict";
import { parseAWG, serializeAWG } from "../src/core/awg";
import { preset, MATERIAL_ROLES } from "../src/core/project";
import { encodePNG, dataURL } from "../src/core/png";
import { createPackage, readProducedPackage } from "../src/core/package";
test("AWG3 reader slices an independently specified concatenated payload rather than whitespace splitting strings", () => {
  const literal =
    "1 123 1000 250 -500 0 0 0 0 14 4 15 0 c3-fixture.rwxDoorcreate solid on\n";
  const parsed = parseAWG(literal);
  assert.deepEqual(parsed, [
    {
      model: "c3-fixture.rwx",
      description: "Door",
      action: "create solid on",
      position: [10, 2.5, -5],
    },
  ]);
  assert.throws(
    () => parseAWG(literal.replace("14 4 15", "14 5 15")),
    /lengths/,
  );
  const unicode = serializeAWG([
    {
      model: "c3-fixture.rwx",
      description: "Café · entrée",
      action: "create solid on",
      position: [-1.234, 0, 4],
    },
  ]);
  assert.equal(parseAWG(unicode)[0].description, "Cafe ? entree");
});
test("Actual zipped AWG probe groups reconstruct their serialized placements with bounded centimeter quantization", async () => {
  const p = preset("house");
  p.landscape.density = 0;
  p.structure.storeys = 2;
  const png = dataURL(
    encodePNG({
      width: 1,
      height: 1,
      pixels: new Uint8Array([255, 255, 255, 255]),
    }),
  );
  for (const role of MATERIAL_ROLES)
    p.textures[role] = {
      name: "fixture.png",
      width: 1,
      height: 1,
      dataUrl: png,
    };
  const bundle = await createPackage(p),
    loaded = await readProducedPackage(bundle.bytes, "awg-probe");
  assert(bundle.files.some((f) => f.endsWith(".awg")));
  assert(
    bundle.files.some((f) => f.includes("/groups/") && f.endsWith(".zip")),
  );
  assert.equal(loaded.meshes.length, bundle.meshes.length);
  const original = new Map(bundle.meshes.map((m) => [m.id, m]));
  for (const m of loaded.meshes)
    for (let a = 0; a < 3; a++)
      assert(Math.abs(m.origin[a] - original.get(m.id)!.origin[a]) <= 0.00501);
});
