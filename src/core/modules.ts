import { Project, MeshData, KitDefinition, KitInstance, Vec3 } from "./project";
import { box } from "./mesh";
export interface ModuleTransform {
  origin: Vec3;
  yaw: number;
  definition: KitDefinition;
}
const rotate = (point: Vec3, yaw: number): Vec3 => {
  const angle = (yaw * Math.PI) / 180,
    c = Math.cos(angle),
    s = Math.sin(angle);
  return [point[0] * c - point[2] * s, point[1], point[0] * s + point[2] * c];
};
export function moduleDimensions(p: Project, i: KitInstance): KitDefinition {
  const def = p.kit.definitions.find((d) => d.id === i.definition);
  if (!def) throw new Error("Module definition missing.");
  const d = { ...def, ...i.overrides };
  if (
    ["door", "window"].includes(d.kind) &&
    (d.width < 2 || d.height < 2.6 || d.depth > 0.5)
  )
    throw new Error(`Module ${i.id}: opening no longer fits its wall bay.`);
  return d;
}
function socket(def: KitDefinition, name: string): Vec3 {
  return name === "left"
    ? [-def.width / 2, 0, 0]
    : name === "right"
      ? [def.width / 2, 0, 0]
      : name === "top"
        ? [0, def.height, 0]
        : [0, 0, 0];
}
export function moduleTransforms(p: Project): Map<string, ModuleTransform> {
  const resolved = new Map<string, ModuleTransform>(),
    visiting = new Set<string>();
  function resolve(id: string): ModuleTransform {
    const existing = resolved.get(id);
    if (existing) return existing;
    if (visiting.has(id)) throw new Error("Cyclic module attachment.");
    visiting.add(id);
    const instance = p.kit.instances.find((i) => i.id === id);
    if (!instance) throw new Error("Attached module missing.");
    const definition = moduleDimensions(p, instance);
    let origin = [...instance.origin] as Vec3,
      yaw = instance.yaw;
    if (instance.parent) {
      const parent = resolve(instance.parent);
      if (!(
        (instance.parentSocket === "left" && instance.socket === "right") ||
        (instance.parentSocket === "right" && instance.socket === "left") ||
        (instance.parentSocket === "top" && instance.socket === "bottom") ||
        (instance.parentSocket === "bottom" && instance.socket === "top")
      ))
        throw new Error("Attachment sockets must have opposing directions.");
      yaw = parent.yaw;
      const a = rotate(socket(parent.definition, instance.parentSocket!), yaw),
        b = rotate(socket(definition, instance.socket!), yaw);
      origin = parent.origin.map((v, i) => v + a[i] - b[i]) as Vec3;
    }
    const result = { origin, yaw, definition };
    visiting.delete(id);
    resolved.set(id, result);
    return result;
  }
  for (const i of p.kit.instances) resolve(i.id);
  return resolved;
}
export function buildModules(p: Project): MeshData[] {
  const transforms = moduleTransforms(p),
    parts: MeshData[] = [];
  for (const instance of p.kit.instances) {
    const { definition: d, origin, yaw } = transforms.get(instance.id)!,
      local: MeshData[] = [],
      prefix = `kit-${instance.id}`,
      add = (
        suffix: string,
        x: number,
        y: number,
        w: number,
        h: number,
        material: MeshData["material"] = "wall",
      ) => {
        const m = box(
          prefix + "-" + suffix,
          d.name + " " + suffix,
          [x, y, 0],
          [w, h, d.depth],
          material,
        );
        local.push(m);
        return m;
      };
    if (d.kind === "window" || d.kind === "door") {
      const opening =
          d.kind === "door"
            ? Math.min(p.doorWidth, d.width - 0.6)
            : Math.min(p.structure.windowWidth, d.width - 0.6),
        sill = d.kind === "door" ? 0 : p.structure.windowSill,
        head =
          d.kind === "door"
            ? 2.35
            : Math.min(d.height - 0.15, sill + p.structure.windowHeight),
        side = (d.width - opening) / 2;
      for (const sign of [-1, 1])
        add("side-" + sign, sign * (opening / 2 + side / 2), 0, side, d.height);
      if (sill) add("sill-wall", 0, 0, opening, sill);
      add("head-wall", 0, head, opening, d.height - head);
      for (const sign of [-1, 1])
        add(
          "frame-" + sign,
          sign * (opening / 2 - 0.035),
          sill,
          0.07,
          head - sill,
          "trim",
        );
      add("frame-head", 0, head - 0.07, opening, 0.07, "trim");
      if (d.kind === "window") {
        add("frame-sill", 0, sill, opening, 0.07, "trim");
        const glass = add(
          "glass",
          0,
          sill + 0.07,
          opening - 0.14,
          head - sill - 0.14,
          "glass",
        );
        for (let i = 2; i < glass.positions.length; i += 3)
          glass.positions[i] *= 0.1;
      }
    } else {
      const m = box(
        prefix + "-body",
        d.name,
        [0, 0, 0],
        [d.width, d.height, d.depth],
        d.kind === "slab" ? "floor" : d.kind === "wall" ? "wall" : "trim",
      );
      if (d.kind === "slab") m.walkable = true;
      local.push(m);
    }
    for (const m of local) {
      const offset = rotate(m.origin, yaw);
      for (let i = 0; i < m.positions.length; i += 3) {
        const v = rotate(m.positions.slice(i, i + 3) as Vec3, yaw);
        m.positions.splice(i, 3, ...v);
      }
      m.origin = origin.map((v, i) => v + offset[i]) as Vec3;
      parts.push(m);
    }
  }
  return parts;
}
