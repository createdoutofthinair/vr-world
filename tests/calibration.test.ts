import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { createCalibrationKit } from "../src/core/calibration";
import { parseRWX } from "../src/core/rwx";
import { bounds } from "../src/core/geometry";
import { parseAWG } from "../src/core/awg";
import { parseVPPTSV } from "../src/core/groups";
import { decodePNG } from "../src/core/png";
test("Native probe kit includes measured geometry, independent placement distances and actual dependency files", async () => {
  const zip = await JSZip.loadAsync(await createCalibrationKit());
  assert(
    Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir)
      .every((name) => name.split("/").at(-1)!.startsWith("c3-")),
  );
  const manifest = JSON.parse(
    await zip.file("c3-calibration-manifest.json")!.async("string"),
  );
  assert.equal(manifest.nativeVerified, false);
  const placements = JSON.parse(
    await zip.file("c3-calibration-placements.json")!.async("string"),
  );
  const cube = parseRWX(
      await zip
        .file(manifest.models["c3-calibration-metre"].path)!
        .async("string"),
      {
        id: "meter",
        label: "meter",
        origin: [0, 0, 0],
        solid: true,
        category: "structure",
        material: "wall",
      },
    ),
    b = bounds(cube.mesh);
  assert.equal(b.max[0] - b.min[0], 1);
  assert.equal(b.max[1] - b.min[1], 1);
  assert.equal(
    placements.find((p: { id: string }) => p.id === "c3-meter-plus-1")
      .positionMeters[0],
    1,
  );
  assert.equal(
    placements.find((p: { id: string }) => p.id === "c3-meter-plus-10")
      .positionMeters[0],
    10,
  );
  const image = decodePNG(
    await zip.file(manifest.texture.path)!.async("uint8array"),
  );
  assert.deepEqual(Array.from(image.pixels.slice(0, 4)), [255, 45, 45, 255]);
  const awg = parseAWG(await zip.file("c3-calibration.awg")!.async("string")),
    vp = parseVPPTSV(await zip.file("c3-calibration.vp.tsv")!.async("string"));
  assert.equal(awg.length, placements.length);
  assert.equal(vp.length, placements.length);
  for (const record of awg)
    assert(zip.file("object-path/models/" + record.model));
});
