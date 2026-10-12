import test from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { checkZipBudget } from "../src/core/zip-budget";
test("Archive directory preflight rejects excessive declared expansion, colliding paths and truncation", async () => {
  const zip = new JSZip();
  zip.file("c3-test.txt", "a".repeat(2000));
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  checkZipBudget(bytes);
  assert.throws(
    () =>
      checkZipBudget(bytes, {
        compressed: 10000,
        expanded: 1000,
        file: 3000,
        entries: 10,
      }),
    /Expanded archive/,
  );
  assert.throws(() => checkZipBudget(bytes.slice(0, -1)), /central directory/);
  zip.file("C3-TEST.TXT", "different");
  const collision = await zip.generateAsync({ type: "uint8array" });
  assert.throws(() => checkZipBudget(collision), /colliding/);
});
