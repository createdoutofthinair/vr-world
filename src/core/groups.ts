import { MeshData, Vec3 } from "./project";
import { bounds } from "./geometry";
import { parseAction, motionBounds } from "./actions";
export interface GroupBudget {
  members: number;
  horizontalExtent: number;
  triangles: number;
}
export interface SceneGroup {
  id: string;
  pivot: Vec3;
  min: Vec3;
  max: Vec3;
  radius: number;
  triangles: number;
  members: { id: string; position: Vec3 }[];
  oversize: boolean;
}
export const DEFAULT_GROUP_BUDGET: GroupBudget = {
  members: 128,
  horizontalExtent: 40,
  triangles: 30000,
};
export function partitionGroups(
  meshes: MeshData[],
  budget: GroupBudget = DEFAULT_GROUP_BUDGET,
): SceneGroup[] {
  if (
    !Number.isInteger(budget.members) ||
    budget.members < 1 ||
    budget.members > 1024 ||
    !Number.isFinite(budget.horizontalExtent) ||
    budget.horizontalExtent < 10 ||
    !Number.isFinite(budget.triangles) ||
    budget.triangles < 100
  )
    throw new Error("Invalid application group budget.");
  if (new Set(meshes.map((m) => m.id)).size !== meshes.length)
    throw new Error("Duplicate placement identity.");
  const result: SceneGroup[] = [];
  function split(items: MeshData[]) {
    const min: Vec3 = [Infinity, Infinity, Infinity],
      max: Vec3 = [-Infinity, -Infinity, -Infinity];
    let triangles = 0;
    for (const m of items) {
      const b = m.action
        ? motionBounds(bounds(m), parseAction(m.action))
        : bounds(m);
      triangles += m.indices.length / 3;
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], b.min[a]);
        max[a] = Math.max(max[a], b.max[a]);
      }
    }
    const oversize =
      items.length > budget.members ||
      max[0] - min[0] > budget.horizontalExtent ||
      max[2] - min[2] > budget.horizontalExtent ||
      triangles > budget.triangles;
    if (oversize && items.length > 1) {
      const axis = max[0] - min[0] >= max[2] - min[2] ? 0 : 2;
      const ordered = [...items].sort((a, b) => {
          const aa = bounds(a),
            bb = bounds(b);
          return (
            aa.min[axis] + aa.max[axis] - (bb.min[axis] + bb.max[axis]) ||
            a.id.localeCompare(b.id)
          );
        }),
        mid = Math.floor(items.length / 2);
      split(ordered.slice(0, mid));
      split(ordered.slice(mid));
      return;
    }
    const pivot: Vec3 = min.map((v, a) => (v + max[a]) / 2) as Vec3;
    const radius = Math.hypot(
      Math.max(pivot[0] - min[0], max[0] - pivot[0]),
      Math.max(pivot[2] - min[2], max[2] - pivot[2]),
    );
    result.push({
      id: `c3-group-${String(result.length).padStart(4, "0")}`,
      pivot,
      min,
      max,
      radius,
      triangles,
      oversize,
      members: items.map((m) => ({
        id: m.id,
        position: m.origin.map((v, a) => v - pivot[a]) as Vec3,
      })),
    });
  }
  if (meshes.length) split(meshes);
  const ids = result.flatMap((g) => g.members.map((m) => m.id));
  if (new Set(ids).size !== meshes.length)
    throw new Error("Group coverage must be exactly once.");
  return result;
}
export interface NativePlacement {
  id: string;
  model: string;
  positionMeters: Vec3;
  label: string;
  action: string;
}
const escape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\t/g, "\\t").replace(/\r?\n/g, "\\n");
const unescape = (s: string) =>
  s.replace(/\\([\\nt])/g, (_, v: string) =>
    v === "n" ? "\n" : v === "t" ? "\t" : "\\",
  );
// Documented VPPTSV1 columns. Units are an explicit provisional adapter setting.
export function serializeVPPTSV(
  placements: NativePlacement[],
  metersPerUnit = 10,
): string {
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0)
    throw new Error("Invalid placement unit scale.");
  return [
    "vp propdump tsv1 en-GB",
    `# c3 provisional profile: ${metersPerUnit} meters per position unit; native scale must be tested`,
    "#Owner\tDateTime\tPositionX\tPositionY\tPositionZ\tRotationX\tRotationY\tRotationZ\tRotationAngle\tObjectType\tModel\tDescription\tAction\tObjectData",
    ...placements.map((p) => {
      if (
        !/^c3-[a-z0-9-]+$/.test(p.model) ||
        p.positionMeters.some((v) => !Number.isFinite(v))
      )
        throw new Error("Unsafe native placement.");
      return [
        0,
        "01/01/2000 00:00:00",
        ...p.positionMeters.map((v) => (v / metersPerUnit).toFixed(6)),
        0,
        1,
        0,
        0,
        0,
        p.model + ".rwx",
        escape(p.label),
        escape(p.action),
        "",
      ].join("\t");
    }),
    "",
  ].join("\n");
}
export function parseVPPTSV(
  text: string,
  metersPerUnit = 10,
): Omit<NativePlacement, "id">[] {
  if (!text.startsWith("vp propdump tsv1 en-GB\n"))
    throw new Error("Unsupported VPPTSV header.");
  return text
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l && !l.startsWith("#"))
    .map((line) => {
      const c = line.split("\t");
      if (c.length !== 14) throw new Error("Invalid VPPTSV columns.");
      const values = c.slice(2, 10).map(Number);
      if (
        values.some((v) => !Number.isFinite(v)) ||
        values.slice(3).join(",") !== "0,1,0,0,0"
      )
        throw new Error("Unsupported VPPTSV rotation/type.");
      if (!/^c3-[a-z0-9-]+\.rwx$/.test(c[10]))
        throw new Error("Unsafe VPPTSV model.");
      return {
        model: c[10].slice(0, -4),
        positionMeters: values
          .slice(0, 3)
          .map((v) => v * metersPerUnit) as Vec3,
        label: unescape(c[11]),
        action: unescape(c[12]),
      };
    });
}
