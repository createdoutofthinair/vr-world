import test from "node:test";
import assert from "node:assert/strict";
import { preset, MATERIAL_ROLES, DEFAULT_PROJECT } from "../src/core/project";
import { waterGraph, buildEffects } from "../src/core/effects";
import { terrainHeight, terrainDomain, channelX } from "../src/core/terrain";
import { buildScene, moveWalker, bounds } from "../src/core/geometry";
import { ActionRuntime } from "../src/core/actions";
import { encodePNG, dataURL } from "../src/core/png";
import { createPackage } from "../src/core/package";
import {
  partitionGroups,
  serializeVPPTSV,
  parseVPPTSV,
} from "../src/core/groups";
test("Creek graph is continuous and downhill; supported footbridge has a traversable approach", () => {
  const p = preset("house");
  p.landscape.extent = 12;
  p.landscape.density = 0;
  p.effects = { ...p.effects, creek: true, bridge: true, trail: true };
  const graph = waterGraph(p),
    scene = buildScene(p);
  assert.equal(graph.edges.length, graph.nodes.length - 1);
  for (let i = 1; i < graph.nodes.length; i++)
    assert(
      graph.nodes[i].position[1] <= graph.nodes[i - 1].position[1] + 1e-10,
    );
  const [, depth] = terrainDomain(p),
    z = Math.min(depth / 2 - 2, p.depth / 2 + 4.6),
    cx = channelX(p, z),
    start = cx - 3.3 - 1.8;
  let at: [number, number, number] = [
    start,
    terrainHeight(p, start, z) + 1.68,
    z,
  ];
  at = moveWalker(at, [10.2, 0], scene);
  assert(Math.abs(at[0] - start - 10.2) < 0.1, `Bridge route blocked ${at}`);
  const groups = partitionGroups(scene);
  assert.equal(groups.flatMap((g) => g.members).length, scene.length);
});
test("Waterfall movement is parsed from emitted actions and reproduces after actual package reconstruction", async () => {
  const p = preset("house", "jungle");
  p.landscape.extent = 12;
  p.landscape.density = 0;
  p.effects = { ...p.effects, creek: true, waterfall: true, motion: true };
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
  const scene = buildScene(p),
    runtime = new ActionRuntime(scene),
    bundle = await createPackage(p),
    reloaded = new ActionRuntime(bundle.meshes);
  assert(waterGraph(p).nodes.some((n) => n.kind === "fall-up"));
  const id = "fall-streak-0";
  for (const time of [0, 0.3, 0.9, 1.2, 17.5])
    assert.deepEqual(
      reloaded.snapshot(id, time).position,
      runtime.snapshot(id, time).position,
    );
  assert.equal(reloaded.snapshot(id, 0.3).solid, false);
  assert(
    runtime.snapshot(id, 0.3).position[1] < runtime.snapshot(id, 0).position[1],
  );
});
test("Group pivots reassemble negative coordinates exactly and VP placement columns preserve fields", () => {
  const p = preset("house");
  p.landscape.density = 0;
  const scene = buildScene(p),
    groups = partitionGroups(scene, {
      members: 16,
      horizontalExtent: 20,
      triangles: 10000,
    }),
    lookup = new Map(scene.map((m) => [m.id, m]));
  for (const group of groups)
    for (const member of group.members)
      member.position.forEach((v, i) =>
        assert(
          Math.abs(v + group.pivot[i] - lookup.get(member.id)!.origin[i]) <
            1e-8,
        ),
      );
  const source = [
      {
        id: "a",
        model: "c3-fixture",
        positionMeters: [-10, 3, 20] as [number, number, number],
        label: "One\tTwo\nThree",
        action: "create solid on",
      },
    ],
    tsv = serializeVPPTSV(source),
    loaded = parseVPPTSV(tsv);
  assert.deepEqual(loaded[0].positionMeters, source[0].positionMeters);
  assert.equal(loaded[0].label, source[0].label);
});
test("City waterways partition into bounded local meshes without changing the directed route", () => {
  const p = structuredClone(DEFAULT_PROJECT);
  p.world.enabled = true;
  p.world.blocks = 3;
  p.effects.creek = true;
  p.effects.trail = true;
  const meshes = buildEffects(p).filter((m) => m.id.startsWith("creek-"));
  assert(meshes.length > 8);
  for (const mesh of meshes) {
    const b = bounds(mesh);
    assert(b.max[2] - b.min[2] <= 16.01);
    assert(Math.max(...mesh.positions.map(Math.abs)) < 100);
  }
  const groups = partitionGroups(meshes);
  assert(groups.every((g) => !g.oversize));
});
