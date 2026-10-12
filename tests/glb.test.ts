import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { serializeGLB } from "../src/core/glb";
import { box } from "../src/core/mesh";
import { preset, MATERIAL_ROLES, materialsFor } from "../src/core/project";
import { dataURL, encodePNG, decodePNG } from "../src/core/png";
import { createPackage } from "../src/core/package";

const pixel = (rgba: number[]) =>
  dataURL(encodePNG({ width: 1, height: 1, pixels: new Uint8Array(rgba) }));
function read(bytes: Uint8Array) {
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(header.getUint32(0, true), 0x46546c67);
  assert.equal(header.getUint32(4, true), 2);
  assert.equal(header.getUint32(8, true), bytes.length);
  const length = header.getUint32(12, true);
  assert.equal(length % 4, 0);
  assert.equal(header.getUint32(16, true), 0x4e4f534a);
  assert.equal(header.getUint32(24 + length, true), 0x004e4942);
  const json = JSON.parse(
    new TextDecoder().decode(bytes.subarray(20, 20 + length)),
  );
  const binary = bytes.subarray(28 + length);
  assert.equal(binary.length, json.buffers[0].byteLength);
  for (const view of json.bufferViews) {
    assert.equal(view.byteOffset % 4, 0);
    assert(view.byteOffset + view.byteLength <= binary.length);
  }
  const image = (id: number) => {
    const view =
      json.bufferViews[json.images[json.textures[id].source].bufferView];
    return decodePNG(
      binary.subarray(view.byteOffset, view.byteOffset + view.byteLength),
    );
  };
  return { json, binary, image };
}
test("GLB preserves metre placements, instancing, winding and physical UVs in its actual binary chunks", () => {
  const p = preset("shop"),
    a = box("first", "First", [-12, 3, 7], [2, 3, 4], "wall"),
    b = { ...a, id: "second", origin: [10, 5, -9] as [number, number, number] },
    url = pixel([200, 100, 40, 255]);
  const { json, binary, image } = read(
    serializeGLB(p, [a, b], { first: url, second: url }),
  );
  assert.equal(json.meshes.length, 1);
  assert.deepEqual(
    json.nodes.map((n: any) => n.translation),
    [a.origin, b.origin],
  );
  const primitive = json.meshes[0].primitives[0];
  const values = (id: number) => {
    const accessor = json.accessors[id],
      view = json.bufferViews[accessor.bufferView];
    const data = binary.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    );
    return accessor.componentType === 5125
      ? Array.from(new Uint32Array(data.buffer))
      : Array.from(new Float32Array(data.buffer));
  };
  assert.deepEqual(values(primitive.indices), a.indices);
  assert.deepEqual(values(primitive.attributes.POSITION), a.positions);
  assert(values(primitive.attributes.NORMAL).every(Number.isFinite));
  const scale = materialsFor(p).wall.scale ?? 1;
  values(primitive.attributes.TEXCOORD_0).forEach((v, i) =>
    assert(
      Math.abs(v - (i % 2 ? 1 - a.uvs[i] / scale : a.uvs[i] / scale)) < 1e-6,
    ),
  );
  assert.equal(json.materials[0].alphaMode, "OPAQUE");
  assert.deepEqual(Array.from(image(0).pixels), [200, 100, 40, 255]);
});
test("GLB embeds PBR channel maps, converts DirectX normals and preserves alpha classification", () => {
  const p = preset("shop"),
    a = box("cutout", "Cutout", [0, 0, 0], [1, 1, 1], "wall"),
    b = { ...a, id: "blend" };
  const map = (rgba: number[]) => ({
    name: "map.png",
    dataUrl: pixel(rgba),
    width: 1,
    height: 1,
  });
  p.materialMaps.wall = {
    roughness: map([5, 60, 7, 255]),
    metalness: map([8, 9, 180, 255]),
    normal: map([128, 30, 255, 255]),
    normalConvention: "directx",
  };
  const { json, image } = read(
    serializeGLB(p, [a, b], {
      cutout: pixel([255, 255, 255, 0]),
      blend: pixel([255, 255, 255, 128]),
    }),
  );
  assert.equal(json.materials[0].alphaMode, "MASK");
  assert.equal(json.materials[0].alphaCutoff, 0.5);
  assert.equal(json.materials[1].alphaMode, "BLEND");
  const mat = json.materials[0];
  assert.deepEqual(
    Array.from(
      image(mat.pbrMetallicRoughness.metallicRoughnessTexture.index).pixels,
    ),
    [255, 60, 180, 255],
  );
  assert.deepEqual(
    Array.from(image(mat.normalTexture.index).pixels),
    [128, 225, 255, 255],
  );
});
test("Optional packaged GLB matches selected export scope and includes its own image dependencies", async () => {
  const p = preset("shop"),
    url = pixel([255, 255, 255, 255]);
  for (const role of MATERIAL_ROLES)
    p.textures[role] = { name: "white.png", dataUrl: url, width: 1, height: 1 };
  const { buildScene } = await import("../src/core/geometry");
  const chosen = buildScene(p)[0];
  const bundle = await createPackage(p, {
    scope: "selected",
    selected: [chosen.id],
    includeGLB: true,
  });
  const zip = await JSZip.loadAsync(bundle.bytes);
  const { json } = read(await zip.file("c3-world.glb")!.async("uint8array"));
  assert.equal(json.nodes.length, 1);
  assert.equal(json.nodes[0].extras.sourceId, chosen.id);
  assert(
    json.images.every((img: any) => img.bufferView !== undefined && !img.uri),
  );
  assert.equal(json.animations, undefined);
});
