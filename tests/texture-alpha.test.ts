import test from "node:test";
import assert from "node:assert/strict";
import { dataURL, encodePNG } from "../src/core/png";
import { textureAlpha } from "../src/core/texture-alpha";
test("Actual uploaded PNG pixels distinguish opaque, cutout and fractional transparency", () => {
  for (const [alpha, expected] of [
    [255, "opaque"],
    [0, "mask"],
    [128, "blend"],
  ] as const) {
    const url = dataURL(
      encodePNG({
        width: 2,
        height: 1,
        pixels: new Uint8Array([30, 40, 50, 255, 100, 120, 140, alpha]),
      }),
    );
    assert.equal(textureAlpha(url), expected);
    assert.equal(textureAlpha(url), expected);
  }
  assert.throws(
    () => textureAlpha("data:image/jpeg;base64,AA=="),
    /normalized PNG/,
  );
});
