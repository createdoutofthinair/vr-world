import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROJECT,
  MATERIAL_ROLES,
  THEMES,
  Theme,
  preset,
  validateProject,
  materialsFor,
  applyTheme,
} from "../src/core/project";
import { buildScene, bounds, moveWalker } from "../src/core/geometry";
import { generatePlant, PlantFamily } from "../src/core/plants";
import { groundHeight } from "../src/core/landscape";
import { createPackage } from "../src/core/package";

const families: PlantFamily[] = [
  "broadleaf",
  "canopy",
  "acacia",
  "ancient",
  "conifer",
  "palm",
  "fern",
  "broadleaf-herb",
  "agave",
  "cactus",
  "alien",
  "grass",
  "fungi",
];
test("Every plant family has finite nondegenerate attached geometry within its budget", () => {
  const fingerprints = new Set<string>();
  for (const family of families) {
    const plant = generatePlant(family, 782);
    const tris = plant.meshes.reduce((n, m) => n + m.indices.length / 3, 0);
    assert(tris > 0 && tris < 18000, `${family}: ${tris} triangles`);
    fingerprints.add(JSON.stringify(plant.meshes.map((m) => m.positions)));
    for (const bone of plant.skeleton) {
      assert(bone.radius > 0);
      if (bone.parent !== null)
        assert(
          bone.parent >= 0 && bone.parent < plant.skeleton.length,
          `${family} invalid parent`,
        );
    }
    for (const mesh of plant.meshes) {
      assert(mesh.positions.every(Number.isFinite));
      assert.equal(mesh.positions.length / 3, mesh.uvs.length / 2);
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = mesh.indices
          .slice(i, i + 3)
          .map((j) => mesh.positions.slice(j * 3, j * 3 + 3));
        const u = b.map((n, j) => n - a[j]),
          v = c.map((n, j) => n - a[j]);
        const area = Math.hypot(
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        );
        assert(area > 1e-11, `${family} degenerate triangle ${i / 3}`);
      }
    }
    assert.deepEqual(generatePlant(family, 782), plant);
  }
  assert.equal(fingerprints.size, families.length);
});
test("Five world themes contain different architectural kits and biome-specific plants", () => {
  const landmarks: Record<Theme, string> = {
    temperate: "shop-awning",
    desert: "shade-crossbeam",
    jungle: "veranda-deck",
    fantasy: "gable-frame-1",
    scifi: "plant-room",
  };
  for (const theme of Object.keys(THEMES) as Theme[]) {
    const p = preset("shop", theme),
      meshes = buildScene(p);
    assert(
      meshes.some((m) => m.id === landmarks[theme]),
      theme,
    );
    assert(
      meshes.some((m) => m.category === "vegetation"),
      theme,
    );
    assert.equal(new Set(meshes.map((m) => m.id)).size, meshes.length);
    assert(
      meshes.reduce((n, m) => n + m.indices.length / 3, 0) < 150000,
      theme + " parcel budget",
    );
    if (theme === "jungle") {
      assert(meshes.some((m) => m.label.includes("palm")));
      assert(meshes.some((m) => m.label.includes("canopy")));
      assert(meshes.some((m) => m.label.includes("fern")));
      assert.notEqual(
        materialsFor(p).wall.color,
        materialsFor(p).foliage.color,
      );
    }
  }
});
test("Architecture and biome are independent, while full theme changes preserve uploads and dimensions", () => {
  const p = preset("villa", "scifi");
  const a = buildScene(p).filter(
    (m) => !["vegetation", "landscape", "site"].includes(m.category),
  );
  const b = buildScene({ ...p, biome: "tropical" }).filter(
    (m) => !["vegetation", "landscape", "site"].includes(m.category),
  );
  assert.deepEqual(a, b);
  const upload = {
    name: "wall.png",
    width: 1,
    height: 1,
    dataUrl: "data:image/png;base64,AAAA",
  };
  p.textures.wall = upload;
  p.width = 14;
  const combined = { ...p, ...applyTheme(p, "jungle") };
  assert.equal(combined.width, 14);
  assert.deepEqual(combined.textures.wall, upload);
  assert.equal(combined.biome, "tropical");
  assert.equal(materialsFor(combined).wall.color, "#ffffff");
});
test("Density changes preserve existing tree variants and positions, and clear the entrance corridor", () => {
  const p = preset("house", "jungle");
  p.landscape.density = 0.4;
  const low = buildScene(p).filter((m) => m.id.startsWith("plant-tree"));
  const high = buildScene({ ...p, landscape: { ...p.landscape, density: 1 } });
  for (const m of low)
    assert.deepEqual(
      m,
      high.find((n) => n.id === m.id),
    );
  for (const m of high.filter(
    (m) => m.category === "vegetation" && m.id.endsWith("trunk"),
  )) {
    const b = bounds(m);
    assert(
      !(b.min[0] < 1.4 && b.max[0] > -1.4 && b.max[2] > p.depth / 2),
      "trunk intrudes into entry corridor",
    );
  }
});
test("All themed entrance routes are walkable, including raised jungle steps", () => {
  for (const theme of Object.keys(THEMES) as Theme[])
    for (const type of ["shop", "house", "villa"] as const) {
      const p = { ...preset(type, theme), furnished: false };
      const end = moveWalker(
        [0, 1.66, p.depth / 2 + 5],
        [0, -7],
        buildScene(p),
      );
      assert(end[2] < p.depth / 2 - 0.5, `${theme} ${type}: stopped at ${end}`);
      assert(
        Math.abs(end[1] - (theme === "jungle" ? 2.44 : 1.84)) < 1e-6,
        `${theme}: wrong floor height ${end[1]}`,
      );
    }
});
test("Walking follows emitted sloped terrain without jumping to the parcel maximum height", () => {
  const p = preset("house", "temperate");
  p.landscape.density = 0;
  const mesh = buildScene(p).filter((m) => m.surfaceMesh);
  const x = p.width / 2 + 5,
    z = -p.depth / 2 - 4;
  const startY = groundHeight(p, x, z) + 1.68;
  const end = moveWalker([x, startY, z], [0.5, 0], mesh);
  assert(Math.abs(end[0] - (x + 0.5)) < 1e-6);
  assert(Math.abs(end[1] - (groundHeight(p, x + 0.5, z) + 1.68)) < 0.02);
});
test("Legacy projects migrate with original dimensions and textures; invalid scene controls are rejected", () => {
  const { biome, landscape, architectureDetails, ...old } = DEFAULT_PROJECT;
  const migrated = validateProject({
    ...old,
    schemaVersion: 1,
    generatorVersion: "0.1.0",
    theme: "jungle",
    width: 11,
  });
  assert.equal(migrated.migratedFrom, "0.1.0");
  assert.equal(migrated.width, 11);
  assert.equal(migrated.biome, "tropical");
  assert.throws(
    () =>
      validateProject({ ...migrated, landscape: { ...landscape, density: 2 } }),
    /density/,
  );
  assert.throws(
    () => validateProject({ ...migrated, biome: "invalid" }),
    /biome/,
  );
});
test("Export reconstruction retains all plants, lowercase dependencies, terrain and walkable steps", async () => {
  const p = preset("house", "jungle");
  p.landscape.density = 0.3;
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGP4DwQACfsD/fteaysAAAAASUVORK5CYII=";
  for (const role of MATERIAL_ROLES)
    p.textures[role] = {
      name: "fixture.png",
      width: 1,
      height: 1,
      dataUrl: png,
    };
  const bundle = await createPackage(p),
    original = buildScene(p);
  assert.equal(bundle.meshes.length, original.length);
  assert(
    bundle.files
      .filter((f) => f.endsWith(".png"))
      .every((f) => /\/c3-[a-z0-9-]+\.png$/.test(f)),
  );
  assert(bundle.meshes.some((m) => m.category === "vegetation"));
  assert(bundle.meshes.find((m) => m.id === "veranda-step-0")?.walkable);
  assert.deepEqual(
    moveWalker([0, 1.66, p.depth / 2 + 5], [0, -7], bundle.meshes),
    moveWalker([0, 1.66, p.depth / 2 + 5], [0, -7], original),
  );
});

test("Every declared CC0 surface ships locally with matching source hashes and provenance", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const { STANDARD_TEXTURES } = await import("../src/core/standard-textures");
  const root = new URL("../public/textures/", import.meta.url);
  const sources = JSON.parse(
    await readFile(new URL("c3-sources.json", root), "utf8"),
  ) as {
    id: string;
    filename: string;
    sha256: string;
    license: string;
    source: string;
  }[];
  for (const entry of Object.values(STANDARD_TEXTURES)) {
    const source = sources.find((s) => s.id === entry.id);
    assert(source);
    const bytes = await readFile(new URL(entry.filename, root));
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      source.sha256,
    );
    assert.equal(source.license, "CC0-1.0");
    assert.equal(source.source, entry.source);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
  }
});
