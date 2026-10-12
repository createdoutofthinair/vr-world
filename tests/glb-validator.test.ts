import test from "node:test";
import assert from "node:assert/strict";
import { validateBytes } from "gltf-validator";
import JSZip from "jszip";
import { serializeGLB } from "../src/core/glb";
import { preset, MATERIAL_ROLES } from "../src/core/project";
import { box } from "../src/core/mesh";
import { dataURL, encodePNG, decodePNG } from "../src/core/png";
import { createPackage } from "../src/core/package";
function open(bytes: Uint8Array) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(v.getUint32(0, true), 0x46546c67);
  assert.equal(v.getUint32(4, true), 2);
  assert.equal(v.getUint32(8, true), bytes.length);
  const size = v.getUint32(12, true);
  assert.equal(size % 4, 0);
  assert.equal(v.getUint32(16, true), 0x4e4f534a);
  return {
    json: JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + size))),
    bin: bytes.subarray(28 + size),
  };
}
const pixel = (rgba: number[]) =>
  dataURL(encodePNG({ width: 1, height: 1, pixels: new Uint8Array(rgba) }));
test("GLB passes independent Khronos validation with embedded PBR maps and shared translated meshes", async () => {
  const p = preset("house");
  p.materialOptions.wall = {
    color: "#ffffff",
    opacity: 1,
    roughness: 0.7,
    metalness: 0.6,
    scale: 2,
  };
  const base = pixel([220, 180, 120, 128]),
    normal = pixel([128, 40, 255, 255]),
    rough = pixel([10, 90, 20, 255]),
    metal = pixel([30, 40, 160, 255]);
  p.materialMaps.wall = {
    normal: { name: "normal.png", dataUrl: normal, width: 1, height: 1 },
    normalConvention: "directx",
    roughness: { name: "roughness.png", dataUrl: rough, width: 1, height: 1 },
    metalness: { name: "metalness.png", dataUrl: metal, width: 1, height: 1 },
    emissive: { name: "light.png", dataUrl: base, width: 1, height: 1 },
  };
  const a = box("a", "Asymmetric cube", [-7, 2, 11], [2, 3, 4], "wall"),
    b = { ...a, id: "b", origin: [10, 0, -8] as [number, number, number] },
    bytes = serializeGLB(p, [a, b], { a: base, b: base }),
    report = await validateBytes(bytes, { uri: "c3-fixture.glb" });
  assert.equal(
    report.issues.numErrors,
    0,
    JSON.stringify(report.issues.messages),
  );
  const { json, bin } = open(bytes);
  assert.equal(json.nodes.length, 2);
  assert.equal(json.meshes.length, 1);
  assert.deepEqual(json.nodes[0].translation, [-7, 2, 11]);
  assert.equal(json.materials[0].alphaMode, "BLEND");
  assert.equal(json.materials[0].pbrMetallicRoughness.roughnessFactor, 0.7);
  const image = (texture: number) => {
    const entry = json.images[json.textures[texture].source],
      v = json.bufferViews[entry.bufferView];
    return decodePNG(bin.subarray(v.byteOffset, v.byteOffset + v.byteLength));
  };
  assert.deepEqual(
    Array.from(image(json.materials[0].normalTexture.index).pixels),
    [128, 215, 255, 255],
  );
  assert.deepEqual(
    Array.from(
      image(
        json.materials[0].pbrMetallicRoughness.metallicRoughnessTexture.index,
      ).pixels,
    ),
    [255, 90, 160, 255],
  );
  const primitive = json.meshes[0].primitives[0],
    access = json.accessors[primitive.attributes.POSITION];
  assert.deepEqual(access.min, [-1, 0, -2]);
  assert.deepEqual(access.max, [1, 3, 2]);
  const uv = json.accessors[primitive.attributes.TEXCOORD_0],
    view = json.bufferViews[uv.bufferView],
    floats = new DataView(
      bin.buffer,
      bin.byteOffset + view.byteOffset,
      view.byteLength,
    );
  assert.equal(floats.getFloat32(0, true), 0);
  assert.equal(floats.getFloat32(4, true), 0);
  assert.equal(floats.getFloat32(8, true), 1);
});
test("Secondary GLB is opt-in, uses the selected scope and keeps embedded dependencies", async () => {
  const p = preset("shop");
  p.landscape.density = 0;
  const url = pixel([160, 130, 90, 255]);
  for (const role of MATERIAL_ROLES)
    p.textures[role] = { name: "color.png", dataUrl: url, width: 1, height: 1 };
  const result = await createPackage(p, {
      scope: "selected",
      selected: ["building-floor"],
      includeGLB: true,
    }),
    zip = await JSZip.loadAsync(result.bytes),
    file = zip.file("c3-world.glb");
  assert(file);
  const bytes = await file.async("uint8array"),
    report = await validateBytes(bytes, { uri: "c3-world.glb" });
  assert.equal(
    report.issues.numErrors,
    0,
    JSON.stringify(report.issues.messages),
  );
  const { json } = open(bytes);
  assert.equal(json.nodes.length, 1);
  assert.equal(json.nodes[0].extras.sourceId, "building-floor");
});
test("GLB keeps UV tangent handedness and bakes browser image orientation into embedded PNG rows", async () => {
  const p = preset("house"),
    url = dataURL(
      encodePNG({
        width: 1,
        height: 2,
        pixels: new Uint8Array([255, 0, 0, 0, 0, 0, 255, 255]),
      }),
    ),
    part = box("cutout", "Asymmetric cutout", [0, 0, 0], [1, 1, 1], "wall"),
    bytes = serializeGLB(p, [part], { cutout: url }),
    { json, bin } = open(bytes);
  assert.equal(json.materials[0].alphaMode, "MASK");
  assert.equal(json.materials[0].alphaCutoff, 0.5);
  const entry = json.images[0],
    view = json.bufferViews[entry.bufferView],
    png = decodePNG(
      bin.subarray(view.byteOffset, view.byteOffset + view.byteLength),
    );
  assert.deepEqual(Array.from(png.pixels), [0, 0, 255, 255, 255, 0, 0, 0]);
  assert.equal(
    (await validateBytes(bytes, { uri: "c3-cutout.glb" })).issues.numErrors,
    0,
  );
});
