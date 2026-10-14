import test from "node:test";
import assert from "node:assert/strict";
import { preset } from "../src/core/project";
import { terrainDomain } from "../src/core/terrain";
import { parcelSize } from "../src/core/landscape";
test("Standalone parcel boundaries do not change when the building grows", () => {
  const p = preset("house", "temperate");
  const before = parcelSize(p);
  p.width = 18;
  p.depth = 18;
  assert.deepEqual(parcelSize(p), before);
  assert.deepEqual(terrainDomain(p), before);
});
