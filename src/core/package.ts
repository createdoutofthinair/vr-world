import JSZip from "jszip";
import {
  materialsFor,
  MaterialRole,
  MeshData,
  Project,
  validateProject,
} from "./project";
import { buildScene } from "./geometry";
import {
  dependencyRoles,
  evaluateCreationAction,
  EXPORT_PROFILE,
  geometryFingerprint,
  ParsedRWX,
  parseRWX,
  serializeRWX,
} from "./rwx";
import { pngBytes, sha256, textureImage } from "./textures";
interface Placement {
  id: string;
  label: string;
  category: MeshData["category"];
  model: string;
  positionMeters: MeshData["origin"];
  material: MaterialRole;
  solid: boolean;
  action: string;
}
interface Manifest {
  schemaVersion: 1;
  projectName: string;
  profile: typeof EXPORT_PROFILE;
  placements: Placement[];
  models: Record<string, string>;
  textures: Record<
    string,
    { path: string; hash: string; width: number; height: number }
  >;
}
export interface ExportBundle {
  bytes: Uint8Array;
  meshes: MeshData[];
  images: Record<MaterialRole, string>;
  specs: ReturnType<typeof materialsFor>;
  files: string[];
  modelCount: number;
  textureCount: number;
  triangles: number;
  manifest: Manifest;
}
const INSTRUCTIONS = `# c3 World Studio — provisional VP export

This archive contains raw RWX files, PNG textures, canonical placements, and the editable project. Every asset uses the c3- namespace.

The classic profile provisionally uses 10 meters per RWX unit and clockwise face winding. Native Virtual Paradise import, opacity, solidity, and PNG texture interpretation MUST be checked before production use. Browser reconstruction verifies our emitted subset, not native compatibility.

Host object-path/models and object-path/textures on your chosen object path after checking your client's hosting conventions. Texture references omit the PNG extension. c3-placements.json records world-space positions in meters and the intended solid on/off action. It is our canonical format, NOT an AWG or native VP import file. The AWG writer and editable group importer are pending; objects currently require manual placement or a separately implemented import adapter.

All rotations are identity in this foundation export. Doors are open geometry; no interactive door action is promised. Theme presets currently select material palettes. Cities, full procedural vegetation, mesh terrain, and motion effects are planned follow-on milestones.

Generated material patterns are original procedural assets. Uploaded textures retain their user's provenance. The editable project includes the normalized textures actually used.
`;
export async function createPackage(project: Project): Promise<ExportBundle> {
  const zip = new JSZip(),
    meshes = buildScene(project),
    specs = materialsFor(project),
    images = {} as Record<MaterialRole, string>;
  const manifest: Manifest = {
    schemaVersion: 1,
    projectName: project.name,
    profile: EXPORT_PROFILE,
    placements: [],
    models: {},
    textures: {},
  };
  const textureRefs = {} as Record<MaterialRole, string>;
  for (const role of dependencyRoles(meshes)) {
    const image = textureImage(specs[role], project);
    images[role] = image;
    const bytes = pngBytes(image),
      hash = await sha256(bytes),
      name = `c3-${role}-${hash.slice(0, 16)}`,
      path = `object-path/textures/${name}.png`;
    textureRefs[role] = name;
    manifest.textures[name] = {
      path,
      hash,
      width: project.textures[role]?.width ?? (role === "sign" ? 1024 : 256),
      height: project.textures[role]?.height ?? (role === "sign" ? 128 : 256),
    };
    zip.file(path, bytes);
  }
  for (const mesh of meshes) {
    const hash = await sha256(
        geometryFingerprint(mesh) +
          JSON.stringify(specs[mesh.material]) +
          textureRefs[mesh.material],
      ),
      model = `c3-model-${hash.slice(0, 20)}`;
    const path = `object-path/models/${model}.rwx`;
    if (!manifest.models[model]) {
      manifest.models[model] = path;
      zip.file(
        path,
        serializeRWX(mesh, specs[mesh.material], textureRefs[mesh.material]),
      );
    }
    manifest.placements.push({
      id: mesh.id,
      label: mesh.label,
      category: mesh.category,
      model,
      positionMeters: mesh.origin,
      material: mesh.material,
      solid: mesh.solid,
      action: `create solid ${mesh.solid ? "on" : "off"}`,
    });
  }
  zip.file("c3-manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("c3-placements.json", JSON.stringify(manifest.placements, null, 2));
  zip.file("c3-world.c3world.json", JSON.stringify(project, null, 2));
  zip.file("c3-installation.md", INSTRUCTIONS);
  zip.file(
    "c3-asset-sources.json",
    JSON.stringify(
      {
        procedural: "Original c3 generated texture patterns",
        uploads: Object.fromEntries(
          Object.entries(project.textures).map(([k, t]) => [
            k,
            {
              name: t.name,
              provenance: "User supplied; permissions retained by uploader",
            },
          ]),
        ),
      },
      null,
      2,
    ),
  );
  zip.file(
    "c3-validation.json",
    JSON.stringify(
      {
        status: "provisional",
        nativeVPVerified: false,
        scope: "emitted single-clump RWX subset",
        profile: EXPORT_PROFILE,
        models: Object.keys(manifest.models).length,
        placements: manifest.placements.length,
        triangles: meshes.reduce((n, m) => n + m.indices.length / 3, 0),
        missingDependencies: [],
        awg: "not implemented",
        motion: "not implemented",
      },
      null,
      2,
    ),
  );
  const bytes = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
  });
  // Reconstruct from the produced archive. Never pass authored meshes into export preview.
  const loaded = await readProducedPackage(bytes);
  return {
    ...loaded,
    bytes,
    files: Object.keys(zip.files).filter((k) => !zip.files[k].dir),
    manifest,
    modelCount: Object.keys(manifest.models).length,
    textureCount: Object.keys(manifest.textures).length,
    triangles: loaded.meshes.reduce((n, m) => n + m.indices.length / 3, 0),
  };
}
export async function readProducedPackage(
  bytes: Uint8Array,
): Promise<Pick<ExportBundle, "meshes" | "images" | "specs">> {
  const zip = await JSZip.loadAsync(bytes),
    manifestFile = zip.file("c3-manifest.json");
  if (!manifestFile) throw new Error("Missing package manifest.");
  const manifest = JSON.parse(await manifestFile.async("string")) as Manifest;
  const projectFile = zip.file("c3-world.c3world.json");
  if (!projectFile) throw new Error("Missing editable project.");
  const project = validateProject(
      JSON.parse(await projectFile.async("string")),
    ),
    specs = materialsFor(project),
    images = {} as Record<MaterialRole, string>,
    meshes: MeshData[] = [];
  for (const p of manifest.placements) {
    const model = zip.file(manifest.models[p.model]);
    if (!model) throw new Error(`Missing model: ${p.model}.`);
    const actionState = evaluateCreationAction(p.action);
    const parsed: ParsedRWX = parseRWX(await model.async("string"), {
      id: p.id,
      label: p.label,
      origin: p.positionMeters,
      solid: actionState.solid,
      category: p.category,
      material: p.material,
    });
    const texture = manifest.textures[parsed.texture];
    if (!texture) throw new Error("Missing texture manifest dependency.");
    const file = zip.file(texture.path);
    if (!file) throw new Error(`Missing texture: ${texture.path}.`);
    if (!images[p.material]) {
      const decoded = await file.async("uint8array");
      if ((await sha256(decoded)) !== texture.hash)
        throw new Error("Texture hash mismatch.");
      images[p.material] =
        "data:image/png;base64," + (await file.async("base64"));
    }
    specs[p.material] = {
      ...specs[p.material],
      color: parsed.color,
      opacity: parsed.opacity,
    };
    meshes.push(parsed.mesh);
  }
  return { meshes, images, specs };
}
export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
