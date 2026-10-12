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
import { pngBytes, sha256, textureImage, pngDimensions } from "./textures";
import { loadStandardTextures, standardSource } from "./standard-textures";
import { partitionGroups, serializeVPPTSV, parseVPPTSV } from "./groups";
import { parseAction, creationState, ActionRuntime } from "./actions";
import { serializeAWG, parseAWG } from "./awg";
interface Placement {
  id: string;
  label: string;
  category: MeshData["category"];
  model: string;
  positionMeters: MeshData["origin"];
  material: MaterialRole;
  solid: boolean;
  walkable?: boolean;
  level?: number;
  doorId?: string;
  surfaceMesh?: boolean;
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
  experimentalGroups?: {
    id: string;
    pivot: MeshData["origin"];
    ids: string[];
    path: string;
    hash: string;
  }[];
}
export interface ExportBundle {
  bytes: Uint8Array;
  meshes: MeshData[];
  images: Record<MaterialRole, string>;
  textureImages: Record<string, string>;
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

Host object-path/models and object-path/textures on your chosen object path after checking your client's hosting conventions. Texture references omit the PNG extension. c3-placements.json records world-space positions in meters and the intended solid on/off action. It is our canonical format, NOT an AWG or native VP import file. Experimental AWG3 group ZIPs and VPPTSV placements are included as compatibility probes. Their native units and client import behavior are unverified. Use the included coordinate fixtures before production import.

Object rotations are baked into geometry. Doors export their saved static pose; browser E-key interactions are temporary inspection overrides. World themes now select architectural details and a default biome. Owned mesh terrain, entrance paths, and procedural plant geometry are included. Architecture and biome can be combined independently. Seeded neighborhoods, roads, editable terrain, creeks, bridges and waterfall motion are included. Full district authoring and native effects verification remain pending. Walkable placement metadata directs the browser controller to the actual exported ground and step meshes; native solidity still comes from create solid.

Generated material patterns are original procedural assets. Uploaded textures retain their user's provenance. The editable project includes the normalized textures actually used.
`;
export interface PackageOptions {
  previewMode?: "canonical" | "awg-probe";
  images?: Partial<Record<MaterialRole, string>>;
  progress?: (stage: string, percent: number) => void;
}
export async function createPackage(
  project: Project,
  options: PackageOptions = {},
): Promise<ExportBundle> {
  options.progress?.("Generating neutral geometry", 0);
  const zip = new JSZip(),
    specs = materialsFor(project),
    images = {} as Record<MaterialRole, string>;
  const standardPatterns = (Object.keys(specs) as MaterialRole[])
    .filter((role) => standardSource(specs[role], project))
    .map((role) => specs[role].pattern);
  if (standardPatterns.length) await loadStandardTextures(standardPatterns);
  const meshes = buildScene(project);
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
    const image = options.images?.[role] ?? textureImage(specs[role], project);
    images[role] = image;
    const bytes = pngBytes(image),
      hash = await sha256(bytes),
      name = `c3-${role.toLowerCase()}-${hash.slice(0, 16)}`,
      path = `object-path/textures/${name}.png`;
    textureRefs[role] = name;
    manifest.textures[name] = {
      path,
      hash,
      ...pngDimensions(bytes),
    };
    zip.file(path, bytes);
  }
  let emitted = 0;
  for (const mesh of meshes) {
    if (emitted++ % 20 === 0)
      options.progress?.(
        "Serializing RWX and textures",
        10 + (50 * emitted) / meshes.length,
      );
    let textureRef = textureRefs[mesh.material];
    if (mesh.bakedTexture) {
      const bytes = pngBytes(mesh.bakedTexture.dataUrl),
        hash = await sha256(bytes),
        name = `c3-${mesh.material === "sign" ? "sign" : "terrain"}-${hash.slice(0, 16)}`,
        path = `object-path/textures/${name}.png`;
      textureRef = name;
      manifest.textures[name] = { path, hash, ...pngDimensions(bytes) };
      zip.file(path, bytes);
    }
    const materialSpec = {
      ...specs[mesh.material],
      color: mesh.materialColor ?? specs[mesh.material].color,
      scale: mesh.bakedTexture ? 1 : specs[mesh.material].scale,
    };
    const hash = await sha256(
        geometryFingerprint(mesh) + JSON.stringify(materialSpec) + textureRef,
      ),
      model = `c3-model-${hash.slice(0, 20)}`;
    const path = `object-path/models/${model}.rwx`;
    if (!manifest.models[model]) {
      manifest.models[model] = path;
      zip.file(path, serializeRWX(mesh, materialSpec, textureRef));
    }
    manifest.placements.push({
      id: mesh.id,
      label: mesh.label,
      category: mesh.category,
      model,
      positionMeters: mesh.origin,
      material: mesh.material,
      solid: mesh.solid,
      walkable: mesh.walkable,
      level: mesh.level,
      doorId: mesh.doorId,
      surfaceMesh: mesh.surfaceMesh,
      action: mesh.action ?? `create solid ${mesh.solid ? "on" : "off"}`,
    });
  }
  zip.file("c3-manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("c3-placements.json", JSON.stringify(manifest.placements, null, 2));
  const groups = partitionGroups(meshes);
  manifest.experimentalGroups = [];
  for (const group of groups) {
    const entries = group.members.map((member) => {
        const placement = manifest.placements.find((p) => p.id === member.id)!;
        return {
          model: placement.model + ".rwx",
          description: placement.label,
          action: placement.action,
          position: member.position,
        };
      }),
      awg = serializeAWG(entries);
    if (parseAWG(awg).length !== entries.length)
      throw new Error("AWG writer lost placements.");
    zip.file(`c3-compatibility/${group.id}.awg`, awg);
    const groupZip = new JSZip();
    groupZip.file(group.id + ".awg", awg);
    const bytes = await groupZip.generateAsync({
        type: "uint8array",
        compression: "DEFLATE",
      }),
      path = `object-path/groups/${group.id}.zip`;
    zip.file(path, bytes);
    manifest.experimentalGroups.push({
      id: group.id,
      pivot: group.pivot,
      ids: group.members.map((m) => m.id),
      path,
      hash: await sha256(bytes),
    });
  }
  zip.file("c3-manifest.json", JSON.stringify(manifest, null, 2));
  zip.file(
    "c3-groups.json",
    JSON.stringify(
      {
        format: "c3 canonical groups",
        nativeAWG: false,
        budget: { members: 128, horizontalExtent: 40, triangles: 30000 },
        groups,
      },
      null,
      2,
    ),
  );
  const tsv = serializeVPPTSV(manifest.placements);
  const parsedPlacements = parseVPPTSV(tsv);
  if (parsedPlacements.length !== manifest.placements.length)
    throw new Error("Native placement serialization lost objects.");
  zip.file("c3-world.vp.tsv", tsv);
  zip.file(
    "c3-coordinate-fixture.md",
    "VPPTSV1 uses the published VP columns. The current adapter provisionally converts meters to decameters. Native client import/scale is unverified. Compare a 1 m, 10 m and asymmetric XYZ fixture before importing a production parcel. Canonical JSON always stores meters. Experimental AWG files use documented record syntax with provisional coordinate units; native fixtures remain required.\n",
  );
  zip.file("c3-world.c3world.json", JSON.stringify(project, null, 2));
  const pbrManifest: Record<string, unknown> = {};
  for (const [role, maps] of Object.entries(project.materialMaps))
    if (maps) {
      const record: Record<string, unknown> = {
        normalConvention: maps.normalConvention,
        classicRWX:
          "Map files retained for editing; enhanced shading is not applied by the provisional classic profile.",
      };
      for (const kind of [
        "normal",
        "roughness",
        "metalness",
        "emissive",
      ] as const) {
        const asset = maps[kind];
        if (asset) {
          const bytes = pngBytes(asset.dataUrl),
            hash = await sha256(bytes),
            path = `object-path/textures/c3-${role.toLowerCase()}-${kind}-${hash.slice(0, 16)}.png`;
          zip.file(path, bytes);
          record[kind] = {
            path,
            hash,
            width: asset.width,
            height: asset.height,
          };
        }
      }
      pbrManifest[role] = record;
    }
  zip.file("c3-pbr-maps.json", JSON.stringify(pbrManifest, null, 2));
  zip.file("c3-installation.md", INSTRUCTIONS);
  zip.file(
    "c3-asset-sources.json",
    JSON.stringify(
      {
        procedural: "Original c3 generated texture patterns",
        standard: dependencyRoles(meshes)
          .map((role) => ({
            role,
            source: standardSource(specs[role], project),
          }))
          .filter((item) => item.source)
          .map((item) => ({
            ...item,
            derived:
              "512 px neutral-luminance PNG; semantic colour is stored in RWX",
            author: "ambientCG / Lennart Demes",
          })),
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
        awg: "experimental syntax adapter; native import unverified",
        motion: "VP move subset; candidate rotate adapter disabled by default",
      },
      null,
      2,
    ),
  );
  options.progress?.("Compressing package", 65);
  const bytes = await zip.generateAsync(
    {
      type: "uint8array",
      compression: "DEFLATE",
    },
    (metadata) =>
      options.progress?.("Compressing package", 65 + metadata.percent * 0.2),
  );
  options.progress?.("Reconstructing emitted files", 85);
  // Reconstruct from the produced archive. Never pass authored meshes into export preview.
  const loaded = await readProducedPackage(bytes, options.previewMode);
  options.progress?.("Package verified", 100);
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
  mode: "canonical" | "awg-probe" = "canonical",
): Promise<
  Pick<ExportBundle, "meshes" | "images" | "specs" | "textureImages">
> {
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
    meshes: MeshData[] = [],
    textureImages: Record<string, string> = {};
  let placements = manifest.placements;
  if (mode === "awg-probe") {
    if (!manifest.experimentalGroups)
      throw new Error("No AWG probe groups are available.");
    const metadata = new Map(manifest.placements.map((p) => [p.id, p])),
      resolved: Placement[] = [];
    for (const group of manifest.experimentalGroups) {
      const file = zip.file(group.path);
      if (!file) throw new Error("Missing group archive.");
      const bytes = await file.async("uint8array");
      if ((await sha256(bytes)) !== group.hash)
        throw new Error("Group archive hash mismatch.");
      const archive = await JSZip.loadAsync(bytes),
        awg = archive.file(group.id + ".awg");
      if (!awg) throw new Error("Missing AWG payload.");
      const records = parseAWG(await awg.async("string"));
      if (records.length !== group.ids.length)
        throw new Error("Group member count differs from its metadata.");
      records.forEach((record, index) => {
        const identity = metadata.get(group.ids[index]);
        if (!identity) throw new Error("Missing group identity.");
        resolved.push({
          ...identity,
          label: record.description,
          action: record.action,
          model: record.model.slice(0, -4),
          positionMeters: record.position.map(
            (v, a) => v + group.pivot[a],
          ) as MeshData["origin"],
        });
      });
    }
    if (new Set(resolved.map((p) => p.id)).size !== manifest.placements.length)
      throw new Error("Group coverage is not exactly once.");
    placements = resolved;
  }
  for (const p of placements) {
    const model = zip.file(manifest.models[p.model]);
    if (!model) throw new Error(`Missing model: ${p.model}.`);
    const program = parseAction(p.action),
      actionState = creationState(program, p.solid);
    const parsed: ParsedRWX = parseRWX(await model.async("string"), {
      id: p.id,
      label: p.label,
      origin: p.positionMeters,
      solid: actionState.solid,
      category: p.category,
      material: p.material,
    });
    const textureName = actionState.texture ?? parsed.texture,
      texture = manifest.textures[textureName];
    if (!texture) throw new Error("Missing texture manifest dependency.");
    const file = zip.file(texture.path);
    if (!file) throw new Error(`Missing texture: ${texture.path}.`);
    if (!textureImages[textureName]) {
      const decoded = await file.async("uint8array");
      if ((await sha256(decoded)) !== texture.hash)
        throw new Error("Texture hash mismatch.");
      textureImages[textureName] =
        "data:image/png;base64," + (await file.async("base64"));
    }
    images[p.material] ??= textureImages[textureName];
    specs[p.material] = {
      ...specs[p.material],
      color: parsed.color,
      opacity: parsed.opacity,
      scale: 1,
    };
    parsed.mesh.walkable = p.walkable;
    parsed.mesh.level = p.level;
    parsed.mesh.doorId = p.doorId;
    parsed.mesh.surfaceMesh = p.surfaceMesh;
    parsed.mesh.materialColor = parsed.color;
    parsed.mesh.textureRef = textureName;
    parsed.mesh.action = p.action;
    meshes.push(parsed.mesh);
  }
  const runtime = new ActionRuntime(meshes);
  for (const mesh of meshes) {
    const state = runtime.snapshot(
      mesh.id,
      0,
      project.effects.rotationCandidate ? "candidate-rpm" : "disabled",
    );
    mesh.solid = state.solid;
    if (state.texture) {
      if (!manifest.textures[state.texture])
        throw new Error("Missing action texture.");
      mesh.textureRef = state.texture;
    }
  }
  return { meshes, images, specs, textureImages };
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
