import { Vec3 } from "./project";
export type Trigger = "create" | "activate";
export interface Motion {
  op: "move" | "rotate";
  vector: Vec3;
  time: number | null;
  wait: number;
  loop: boolean;
  reset: boolean;
  sync: boolean;
  offset: number;
  smooth: boolean;
  local: boolean;
  target?: string;
}
export type Operation =
  | Motion
  | { op: "solid" | "visible"; value: boolean; target?: string }
  | { op: "name" | "texture"; value: string; target?: string };
export interface ActionProgram {
  source: string;
  triggers: Partial<Record<Trigger, Operation[]>>;
  assumptions: string[];
}
const number = (text: string, lo: number, hi: number) => {
  const n = Number(text);
  if (!text || !Number.isFinite(n) || n < lo || n > hi)
    throw new Error(`Invalid action number: ${text}`);
  return n;
};
export function parseAction(source: string): ActionProgram {
  if (source.length > 4096) throw new Error("Action exceeds preview limit.");
  const triggers: ActionProgram["triggers"] = {},
    assumptions: string[] = [];
  for (const segment of source.split(";").filter((s) => s.trim())) {
    const match = /^\s*(create|activate)\s+(.+)$/i.exec(segment);
    if (!match) throw new Error("Unsupported creation action or trigger.");
    const trigger = match[1].toLowerCase() as Trigger;
    if (triggers[trigger]) throw new Error("Duplicate action trigger.");
    const operations: Operation[] = [];
    for (const command of match[2].split(",")) {
      const [verb, ...args] = command.trim().split(/\s+/),
        op = verb.toLowerCase();
      if (op === "solid" || op === "visible") {
        if (
          args.length < 1 ||
          args.length > 2 ||
          !["on", "off", "yes", "no", "true", "false"].includes(
            args[0].toLowerCase(),
          )
        )
          throw new Error(`Invalid ${op} state.`);
        const target = args[1]?.replace(/^name=/i, "");
        if (target && !/^[a-z0-9_]+$/i.test(target))
          throw new Error("Invalid action target.");
        operations.push({
          op,
          value: ["on", "yes", "true"].includes(args[0].toLowerCase()),
          target,
        });
      } else if (op === "texture" || op === "name") {
        if (
          args.length !== 1 ||
          !(op === "name" ? /^[a-z0-9_]+$/i : /^c3-[a-z0-9-]+$/).test(args[0])
        )
          throw new Error(`Invalid ${op} identifier.`);
        operations.push({ op, value: args[0] });
      } else if (op === "move" || op === "rotate") {
        const operands: string[] = [];
        while (
          args.length &&
          /^[+\-\d.]/.test(args[0]) &&
          !args[0].includes("=")
        )
          operands.push(args.shift()!);
        if (operands.length < 1 || operands.length > 3)
          throw new Error(`Invalid ${op} axes.`);
        const values = operands.map((n) => number(n, -1000, 1000)),
          vector: Vec3 =
            op === "rotate" && values.length === 1
              ? [0, values[0], 0]
              : [values[0], values[1] ?? 0, values[2] ?? 0];
        const m: Motion = {
          op,
          vector,
          time: op === "move" ? 1 : null,
          wait: 0,
          loop: op === "rotate",
          reset: false,
          sync: false,
          offset: 0,
          smooth: false,
          local: false,
        };
        const seen = new Set<string>();
        for (const arg of args) {
          const [raw, value] = arg.toLowerCase().split("="),
            key = ["loop", "noloop"].includes(raw)
              ? "loop"
              : ["sync", "nosync"].includes(raw)
                ? "sync"
                : ["reset", "noreset"].includes(raw)
                  ? "reset"
                  : raw;
          if (seen.has(key))
            throw new Error(`Conflicting action option: ${key}`);
          seen.add(key);
          if (["time", "wait", "offset"].includes(key)) {
            if (value === undefined) throw new Error("Missing timing value.");
            m[key as "time" | "wait" | "offset"] = number(
              value,
              key === "time" ? Number.MIN_VALUE : 0,
              key === "offset" ? 86400 : 3600,
            );
          } else if (key === "name") {
            if (!value || !/^[a-z0-9_]+$/i.test(value))
              throw new Error("Invalid target name.");
            m.target = arg.slice(arg.indexOf("=") + 1);
          } else if (value !== undefined)
            throw new Error(`Unsupported action option: ${arg}`);
          else if (key === "loop") m.loop = raw === "loop";
          else if (key === "sync") m.sync = raw === "sync";
          else if (key === "reset") m.reset = raw === "reset";
          else if (key === "smooth") m.smooth = true;
          else if (key === "ltm") m.local = true;
          else if (key === "global")
            assumptions.push(
              "Global trigger is previewed locally; no network propagation.",
            );
          else throw new Error(`Unsupported action option: ${arg}`);
        }
        if (op === "rotate")
          assumptions.push(
            "Rotation requires an explicit candidate adapter. RPM units/defaults/pivot/composition are not VP-verified.",
          );
        if (m.smooth)
          assumptions.push(
            "Smoothing uses a smoothstep approximation; the exact VP curve is unverified.",
          );
        if (m.sync)
          assumptions.push(
            "Universe clock is emulated for inspection, not connected to VP.",
          );
        operations.push(m);
      } else throw new Error(`Unsupported creation action command: ${op}`);
    }
    triggers[trigger] = operations;
  }
  return { source, triggers, assumptions: [...new Set(assumptions)] };
}
export function motionPhase(m: Motion, elapsed: number): number {
  if (!Number.isFinite(elapsed) || elapsed < 0)
    throw new Error("Invalid motion clock.");
  if (m.time === null) return elapsed;
  const half = m.time + m.wait,
    period = m.reset ? half : 2 * half;
  if (!m.loop && elapsed >= period) return 0;
  const t = m.loop ? elapsed % period : elapsed;
  let fraction =
    t <= m.time
      ? t / m.time
      : t <= half
        ? 1
        : m.reset
          ? 0
          : t <= half + m.time
            ? 1 - (t - half) / m.time
            : 0;
  if (m.smooth) fraction = fraction * fraction * (3 - 2 * fraction);
  return fraction;
}
export function evaluateMotion(
  m: Motion,
  localSeconds: number,
  universeSeconds = localSeconds,
  baseYaw = 0,
  rotationAdapter: "disabled" | "candidate-rpm" = "disabled",
): Vec3 {
  const clock = Math.max(0, m.sync ? universeSeconds + m.offset : localSeconds),
    phase = motionPhase(m, clock);
  if (m.op === "rotate") {
    if (rotationAdapter === "disabled")
      throw new Error(
        "VP rotation units are unverified. Select a candidate adapter only for fixture investigation.",
      );
    const scale = ((m.time === null ? phase : phase * m.time) * Math.PI) / 30;
    return m.vector.map((v) => v * scale) as Vec3;
  }
  const delta = m.vector.map((v) => v * phase || 0) as Vec3;
  if (m.local) {
    const c = Math.cos(baseYaw),
      s = Math.sin(baseYaw),
      x = delta[0],
      z = delta[2];
    delta[0] = x * c - z * s;
    delta[2] = x * s + z * c;
  }
  return delta;
}
export function creationState(
  program: ActionProgram,
  defaultSolid = true,
): { solid: boolean; visible: boolean; name?: string; texture?: string } {
  const state: {
    solid: boolean;
    visible: boolean;
    name?: string;
    texture?: string;
  } = { solid: defaultSolid, visible: true };
  for (const op of program.triggers.create ?? []) {
    if (op.op === "solid" || op.op === "visible") state[op.op] = op.value;
    else if (op.op === "name" || op.op === "texture") state[op.op] = op.value;
  }
  return state;
}
export function motionBounds(
  base: { min: Vec3; max: Vec3 },
  program: ActionProgram,
): { min: Vec3; max: Vec3 } {
  const min = [...base.min] as Vec3,
    max = [...base.max] as Vec3;
  for (const trigger of Object.values(program.triggers))
    for (const op of trigger ?? [])
      if (op.op === "move")
        for (let i = 0; i < 3; i++) {
          min[i] += Math.min(0, op.vector[i]);
          max[i] += Math.max(0, op.vector[i]);
        }
  return { min, max };
}
export interface ActionObject {
  id: string;
  origin: Vec3;
  action?: string;
  solid: boolean;
}
export interface RuntimeState {
  position: Vec3;
  rotation: Vec3;
  solid: boolean;
  visible: boolean;
  texture?: string;
}
export class ActionRuntime {
  readonly programs = new Map<string, ActionProgram>();
  readonly events: {
    time: number;
    source: string;
    target: string;
    command: string;
  }[] = [];
  private names = new Map<string, string[]>();
  private states = new Map<
    string,
    {
      base: ActionObject;
      solid: boolean;
      visible: boolean;
      texture?: string;
      move?: { motion: Motion; start: number };
      rotate?: { motion: Motion; start: number };
    }
  >();
  constructor(objects: ActionObject[]) {
    for (const object of objects) {
      if (this.states.has(object.id))
        throw new Error("Duplicate runtime instance.");
      const program = parseAction(
        object.action ?? `create solid ${object.solid ? "on" : "off"}`,
      );
      this.programs.set(object.id, program);
      this.states.set(object.id, {
        base: object,
        solid: object.solid,
        visible: true,
      });
      for (const op of program.triggers.create ?? [])
        if (op.op === "name") {
          const ids = this.names.get(op.value) ?? [];
          ids.push(object.id);
          this.names.set(op.value, ids);
        }
    }
    for (const id of this.states.keys()) this.trigger(id, "create", 0);
  }
  private trigger(id: string, trigger: Trigger, time: number) {
    for (const op of this.programs.get(id)?.triggers[trigger] ?? []) {
      const targets = op.target ? this.names.get(op.target) : [id];
      if (!targets?.length)
        throw new Error(`Action target not found: ${op.target}`);
      for (const target of targets) {
        const state = this.states.get(target)!;
        if (op.op === "move") state.move = { motion: op, start: time };
        else if (op.op === "rotate") state.rotate = { motion: op, start: time };
        else if (op.op === "solid" || op.op === "visible")
          state[op.op] = op.value;
        else if (op.op === "texture") state.texture = op.value;
        this.events.push({ time, source: id, target, command: op.op });
        if (this.events.length > 1000) this.events.shift();
      }
    }
  }
  activate(id: string, time: number) {
    if (!Number.isFinite(time) || time < 0)
      throw new Error("Invalid activation clock.");
    this.trigger(id, "activate", time);
  }
  snapshot(
    id: string,
    time: number,
    rotationAdapter: "disabled" | "candidate-rpm" = "disabled",
    universeTime = time,
  ): RuntimeState {
    const state = this.states.get(id);
    if (!state) throw new Error("Unknown runtime object.");
    const move = state.move
        ? evaluateMotion(
            state.move.motion,
            Math.max(0, time - state.move.start),
            universeTime,
          )
        : [0, 0, 0],
      rotation = state.rotate
        ? evaluateMotion(
            state.rotate.motion,
            Math.max(0, time - state.rotate.start),
            universeTime,
            0,
            rotationAdapter,
          )
        : [0, 0, 0];
    return {
      position: state.base.origin.map((v, i) => v + move[i]) as Vec3,
      rotation: rotation as Vec3,
      solid: state.solid,
      visible: state.visible,
      texture: state.texture,
    };
  }
}
