import test from "node:test";
import assert from "node:assert/strict";
import { preset, AuthoredRoom, validateProject } from "../src/core/project";
import {
  buildRooms,
  regenerateRooms,
  authoredRoomTopology,
} from "../src/core/rooms";
import { buildScene, bounds, moveWalker } from "../src/core/geometry";
import { floorElevation } from "../src/core/building";
const room = (
  id: string,
  x: number,
  side: AuthoredRoom["doorSide"],
): AuthoredRoom => ({
  id,
  name: id,
  type: "living",
  level: 0,
  x,
  z: -2,
  width: 3,
  depth: 3,
  doorSide: side,
  doorOffset: 0,
  doorWidth: 1.1,
  locked: false,
  furnished: false,
  finish: "wall",
});
test("Adjacent authored rooms own one shared wall and a real shared doorway route", () => {
  const p = preset("house");
  p.width = 12;
  p.depth = 10;
  p.landscape.density = 0;
  p.rooms = [room("room-west", -1.5, "front"), room("room-east", 1.5, "left")];
  const parts = buildRooms(p),
    shared = parts.filter(
      (m) => m.id.startsWith("room-wall") && Math.abs(m.origin[0]) < 1e-8,
    );
  assert.equal(shared.length, 3);
  assert.equal(parts.filter((m) => m.doorId).length, 2);
  const scene = buildScene(p, false);
  let at: [number, number, number] = [-1.5, floorElevation(p, 0) + 1.68, 1];
  at = moveWalker(at, [0, -3], scene);
  assert(Math.abs(at[2] + 2) < 0.1);
  at = moveWalker(at, [3, 0], scene);
  assert(Math.abs(at[0] - 1.5) < 0.1);
  const graph = authoredRoomTopology(p);
  assert(
    graph.connections.some(
      (edge) => edge.from === "room-east" && edge.to === "room-west",
    ),
  );
});
test("Generated authored layouts reserve stairs and reach furnished rooms on each level", () => {
  for (const theme of [
    "temperate",
    "jungle",
    "desert",
    "fantasy",
    "scifi",
  ] as const) {
    const p = preset("house", theme);
    p.width = 10;
    p.depth = 10;
    p.structure.storeys = 2;
    p.landscape.density = 0;
    p.rooms = regenerateRooms(p);
    assert.equal(p.rooms.length, 4);
    assert.doesNotThrow(() => buildScene(validateProject(p), false), theme);
    assert(buildRooms(p).some((m) => m.id.includes("mattress")));
  }
});
test("Authored locks survive layout regeneration; invalid overlap and inaccessible layouts fail explicitly", () => {
  const p = preset("house");
  p.width = 12;
  p.depth = 10;
  p.landscape.density = 0;
  p.rooms = [{ ...room("room-pinned", -3, "front"), locked: true }];
  const next = regenerateRooms(p);
  assert.deepEqual(
    next.find((r) => r.id === "room-pinned"),
    p.rooms[0],
  );
  p.rooms = [room("room-a", 0, "front"), room("room-b", 1, "front")];
  assert.throws(() => buildScene(p, false), /overlaps/);
  p.rooms = [
    {
      ...room("room-sealed", 0, "front"),
      z: 0,
      width: 11,
      depth: 9,
      doorSide: "back",
    },
  ];
  assert.throws(() => buildScene(p, false), /no usable floor route/);
});
test("Schema 3 migration preserves authored settings while pinning the new room generator version", () => {
  const p = preset("house");
  p.width = 10;
  p.depth = 10;
  p.rooms = regenerateRooms(p);
  const legacy = { ...p, schemaVersion: 3, generatorVersion: "0.3.0" };
  const migrated = validateProject(legacy);
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.generatorVersion, "0.4.0");
  assert.equal(migrated.migratedFrom, "0.3.0");
  assert.deepEqual(migrated.rooms, p.rooms);
  assert.deepEqual(migrated.plants, p.plants);
});
