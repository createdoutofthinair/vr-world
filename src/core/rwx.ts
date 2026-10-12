import { MeshData, MaterialRole, MaterialSpec } from "./project";
export const EXPORT_PROFILE = {
  id: "vp-provisional-classic",
  metersPerUnit: 10,
  nativeVerified: false,
  winding: "clockwise" as const,
};
const numeric = (v: number) => {
  if (!Number.isFinite(v)) throw new Error("Nonfinite geometry.");
  return Number(v.toFixed(7)).toString();
};
const safeName = (s: string) => /^c3-[a-z0-9-]+$/.test(s);
export function serializeRWX(
  mesh: MeshData,
  material: MaterialSpec,
  texture: string,
): string {
  if (!safeName(texture))
    throw new Error("Texture names must use the c3- asset namespace.");
  const rgb = material.color
    .replace("#", "")
    .match(/../g)!
    .map((c) => parseInt(c, 16) / 255);
  const rows = [
    "# c3 World Studio | provisional VP classic profile",
    "# Source: " + mesh.id,
    "ModelBegin",
    "ClumpBegin",
    "Color " + rgb.map(numeric).join(" "),
    "Surface 0.3 0.7 0",
    "Opacity " + numeric(material.opacity),
    "TextureModes Lit Foreshorten",
    "Texture " + texture,
  ];
  for (let i = 0; i < mesh.positions.length / 3; i++)
    rows.push(
      `Vertex ${mesh.positions
        .slice(i * 3, i * 3 + 3)
        .map((v) => numeric(v / EXPORT_PROFILE.metersPerUnit))
        .join(" ")} UV ${mesh.uvs
        .slice(i * 2, i * 2 + 2)
        .map((v) => numeric(v / (material.scale ?? 1)))
        .join(" ")}`,
    );
  for (let i = 0; i < mesh.indices.length; i += 3)
    rows.push(
      `Triangle ${mesh.indices[i] + 1} ${mesh.indices[i + 2] + 1} ${mesh.indices[i + 1] + 1}`,
    );
  rows.push("ClumpEnd", "ModelEnd", "");
  return rows.join("\n");
}
export interface ParsedRWX {
  mesh: MeshData;
  color: string;
  opacity: number;
  texture: string;
}
export function parseRWX(
  text: string,
  identity: Pick<
    MeshData,
    "id" | "label" | "origin" | "solid" | "category" | "material"
  >,
): ParsedRWX {
  if (text.length > 5_000_000)
    throw new Error("RWX file exceeds the preview limit.");
  const mesh: MeshData = { ...identity, positions: [], uvs: [], indices: [] };
  let color = "#ffffff",
    opacity = 1,
    texture = "",
    stage = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const [command, ...args] = line.split(/\s+/);
    const cmd = command.toLowerCase();
    const nums = (list: string[]) => {
      const values = list.map(Number);
      if (!values.length || values.some((v) => !Number.isFinite(v)))
        throw new Error(`Invalid number in ${command}.`);
      return values;
    };
    if (cmd === "modelbegin") {
      if (stage !== 0 || args.length) throw new Error("Invalid ModelBegin.");
      stage = 1;
    } else if (cmd === "clumpbegin") {
      if (stage !== 1 || args.length) throw new Error("Invalid ClumpBegin.");
      stage = 2;
    } else if (cmd === "clumpend") {
      if (stage !== 2 || args.length) throw new Error("Invalid ClumpEnd.");
      stage = 3;
    } else if (cmd === "modelend") {
      if (stage !== 3 || args.length) throw new Error("Invalid ModelEnd.");
      stage = 4;
    } else {
      if (stage !== 2)
        throw new Error("RWX statement outside the emitted clump.");
      if (cmd === "vertex") {
        if (args.length !== 6 || args[3].toLowerCase() !== "uv")
          throw new Error("Invalid vertex/UV.");
        mesh.positions.push(
          ...nums(args.slice(0, 3)).map(
            (v) => v * EXPORT_PROFILE.metersPerUnit,
          ),
        );
        mesh.uvs.push(...nums(args.slice(4)));
      } else if (cmd === "triangle") {
        if (args.length !== 3) throw new Error("Invalid triangle.");
        const a = nums(args);
        if (
          a.some(
            (n) =>
              !Number.isInteger(n) || n < 1 || n > mesh.positions.length / 3,
          )
        )
          throw new Error("Triangle references a missing vertex.");
        mesh.indices.push(a[0] - 1, a[2] - 1, a[1] - 1);
      } else if (cmd === "color") {
        const c = nums(args);
        if (c.length !== 3 || c.some((v) => v < 0 || v > 1))
          throw new Error("Invalid color.");
        color =
          "#" +
          c
            .map((v) =>
              Math.round(v * 255)
                .toString(16)
                .padStart(2, "0"),
            )
            .join("");
      } else if (cmd === "opacity") {
        const n = nums(args);
        if (n.length !== 1 || n[0] < 0 || n[0] > 1)
          throw new Error("Invalid opacity.");
        opacity = n[0];
      } else if (cmd === "texture") {
        if (args.length !== 1 || !safeName(args[0]))
          throw new Error("Invalid texture dependency.");
        texture = args[0];
      } else if (cmd === "surface") {
        const n = nums(args);
        if (n.length !== 3) throw new Error("Invalid surface.");
      } else if (cmd === "texturemodes") {
        if (args.join(" ").toLowerCase() !== "lit foreshorten")
          throw new Error("Unsupported texture mode.");
      } else throw new Error(`Unsupported RWX statement: ${command}.`);
    }
  }
  if (stage !== 4 || !mesh.positions.length || !mesh.indices.length || !texture)
    throw new Error("Incomplete RWX model.");
  return { mesh, color, opacity, texture };
}
export function geometryFingerprint(mesh: MeshData): string {
  return JSON.stringify({
    positions: mesh.positions,
    uvs: mesh.uvs,
    indices: mesh.indices,
    material: mesh.material,
    solid: mesh.solid,
  });
}
export function dependencyRoles(meshes: MeshData[]): MaterialRole[] {
  return [...new Set(meshes.map((m) => m.material))];
}
export function evaluateCreationAction(action: string): { solid: boolean } {
  const match = /^create\s+solid\s+(on|off)$/i.exec(action.trim());
  if (!match) throw new Error(`Unsupported creation action: ${action}`);
  return { solid: match[1].toLowerCase() === "on" };
}
