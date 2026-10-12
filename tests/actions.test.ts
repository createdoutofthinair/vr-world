import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAction,
  creationState,
  evaluateMotion,
  ActionRuntime,
} from "../src/core/actions";
test("VP documented move cycles honor waits, returns, resets and deterministic seeking", () => {
  const command = parseAction("create move 0 10 0 time=5 wait=3 loop").triggers
    .create![0];
  assert(command.op === "move");
  for (const [time, y] of [
    [0, 0],
    [2.5, 5],
    [5, 10],
    [7, 10],
    [8, 10],
    [10.5, 5],
    [13, 0],
    [15, 0],
    [18.5, 5],
  ])
    assert(Math.abs(evaluateMotion(command, time)[1] - y) < 1e-9);
  const reset = parseAction("create move 0 -2 0 time=1 wait=.5 loop reset")
    .triggers.create![0];
  assert(reset.op === "move");
  assert.deepEqual(evaluateMotion(reset, 1.25), [0, -2, 0]);
  assert.deepEqual(evaluateMotion(reset, 1.5), [0, 0, 0]);
  assert.deepEqual(evaluateMotion(reset, 2), [0, -1, 0]);
  assert.deepEqual(evaluateMotion(command, 2.5), evaluateMotion(command, 2.5));
});
test("Named instances and activation replace motion without accumulating frame drift", () => {
  const runtime = new ActionRuntime([
    {
      id: "a",
      origin: [10, 3, 0],
      solid: false,
      action:
        "create name c3_a, solid off; activate move 2 0 0 time=2 wait=1 reset",
    },
    {
      id: "b",
      origin: [0, 0, 0],
      solid: false,
      action: "create name c3_b, solid off",
    },
  ]);
  runtime.activate("a", 10);
  assert.deepEqual(runtime.snapshot("a", 11).position, [11, 3, 0]);
  assert.deepEqual(runtime.snapshot("b", 11).position, [0, 0, 0]);
  runtime.activate("a", 20);
  assert.deepEqual(runtime.snapshot("a", 21).position, [11, 3, 0]);
  assert.deepEqual(runtime.snapshot("a", 24).position, [10, 3, 0]);
  assert(runtime.events.some((e) => e.time === 20));
  assert.throws(() => parseAction("create move 0 2 0 time=0"), /number/);
  assert.throws(
    () => parseAction("create move 0 2 0 loop noloop"),
    /Conflicting/,
  );
});
test("Local-axis, synchronized and candidate rotation adapters remain explicit", () => {
  const local = parseAction("create move 2 0 0 ltm time=2").triggers.create![0];
  assert(local.op === "move");
  const delta = evaluateMotion(local, 1, 1, Math.PI / 2);
  assert(Math.abs(delta[0]) < 1e-9);
  assert.equal(delta[2], 1);
  const rotate = parseAction("create rotate 10").triggers.create![0];
  assert(rotate.op === "rotate");
  assert.throws(() => evaluateMotion(rotate, 1), /unverified/);
  assert(
    Math.abs(
      evaluateMotion(rotate, 1, 1, 0, "candidate-rpm")[1] - Math.PI / 3,
    ) < 1e-9,
  );
});

test("Named solid and visible actions affect their target without changing the source defaults", () => {
  const program = parseAction("create solid off name=lamp, visible off lamp");
  assert.deepEqual(creationState(program, true), {
    solid: true,
    visible: true,
  });
  const runtime = new ActionRuntime([
    { id: "source", origin: [0, 0, 0], solid: true, action: program.source },
    { id: "lamp", origin: [1, 0, 0], solid: true, action: "create name lamp" },
  ]);
  assert.equal(runtime.snapshot("source", 0).solid, true);
  assert.equal(runtime.snapshot("source", 0).visible, true);
  assert.equal(runtime.snapshot("lamp", 0).solid, false);
  assert.equal(runtime.snapshot("lamp", 0).visible, false);
});
