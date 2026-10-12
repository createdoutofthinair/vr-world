import JSZip from "jszip";
import { serializeGLB } from "./glb";
import { checkZipBudget } from "./zip-budget";
import {
  materialsFor,
  MATERIAL_ROLES,
  MaterialRole,
  MeshData,
  Project,
  validateProject,
} from "./project";
import { floorElevation } from "./building";
import { buildScene, bounds } from "./geometry";
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
import {
  partitionGroups,
  serializeVPPTSV,
  parseVPPTSV,
  GroupBudget,
  DEFAULT_GROUP_BUDGET,
} from "./groups";
import { parseAction, creationState, ActionRuntime } from "./actions";
import { planSVG, inventoryCSV } from "./plan-output";
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
  roomIds?: string[];
  surfaceMesh?: boolean;
  action: string;
}
interface Manifest {
  scope?: { mode: string; ids: string[] };
  schemaVersion: 1;
  projectName: string;
  profile: typeof EXPORT_PROFILE;
  placements: Placement[];
  models: Record<string, string>;
  modelHashes?: Record<string, string>;
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
export type ExportScope = "all" | "building" | "environment" | "selected";
export interface ExportSettings {
  scope?: ExportScope;
  selected?: string[];
  groupBudget?: GroupBudget;
  rejectOversize?: boolean;
  includeGLB?: boolean;
}
export interface PackageOptions extends ExportSettings {
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
  const scene = buildScene(project),
    scope = options.scope ?? "all",
    selected = new Set(options.selected ?? []);
  if (!["all", "building", "environment", "selected"].includes(scope))
    throw new Error("Unknown export scope.");
  const selectedRooms = project.world.enabled
    ? []
    : project.rooms.filter((room) => selected.has(room.id));
  const belongsToSelection = (mesh: MeshData) =>
    selected.has(mesh.id) ||
    selectedRooms.some((room) => {
      if (mesh.roomIds?.includes(room.id)) return true;
      if (
        !mesh.walkable ||
        mesh.surfaceMesh ||
        (mesh.level ?? 0) !== room.level ||
        mesh.category !== "structure"
      )
        return false;
      const b = bounds(mesh);
      return (
        Math.abs(b.max[1] - floorElevation(project, room.level)) < 0.04 &&
        b.max[0] > room.x - room.width / 2 &&
        b.min[0] < room.x + room.width / 2 &&
        b.max[2] > room.z - room.depth / 2 &&
        b.min[2] < room.z + room.depth / 2
      );
    });
  const buildingCategories = new Set([
    "structure",
    "windows",
    "roof",
    "interior",
  ]);
  const meshes = scene.filter(
    (mesh) =>
      scope === "all" ||
      (scope === "selected"
        ? belongsToSelection(mesh)
        : scope === "building"
          ? buildingCategories.has(mesh.category)
          : !buildingCategories.has(mesh.category)),
  );
  if (!meshes.length)
    throw new Error(
      "Export scope contains no generated objects. Select an object or change scope.",
    );
  if (
    scope === "selected" &&
    [...selected].some(
      (id) =>
        !scene.some((m) => m.id === id) &&
        !(
          !project.world.enabled && project.rooms.some((room) => room.id === id)
        ),
    )
  )
    throw new Error(
      "Selected export contains stale object IDs. Select from the current scene.",
    );
  const groupBudget = options.groupBudget ?? DEFAULT_GROUP_BUDGET;
  const groups = partitionGroups(meshes, groupBudget);
  const oversize = groups.filter((group) => group.oversize);
  if (options.rejectOversize && oversize.length)
    throw new Error(
      `${oversize.length} individual mesh assets exceed the chosen group budget. Increase it or reduce the mesh dimensions; the exporter will not silently omit geometry.`,
    );
  const manifest: Manifest = {
    scope: { mode: scope, ids: meshes.map((m) => m.id) },
    schemaVersion: 1,
    projectName: project.name,
    profile: EXPORT_PROFILE,
    placements: [],
    models: {},
    modelHashes: {},
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
      const serialized = serializeRWX(mesh, materialSpec, textureRef);
      manifest.modelHashes![model] = await sha256(serialized);
      zip.file(path, serialized);
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
      roomIds: mesh.roomIds,
      surfaceMesh: mesh.surfaceMesh,
      action: mesh.action ?? `create solid ${mesh.solid ? "on" : "off"}`,
    });
  }
  if (options.includeGLB) {
    options.progress?.("Embedding secondary GLB materials", 60);
    const diffuse: Record<string, string> = {};
    for (const part of meshes)
      diffuse[part.id] = part.bakedTexture?.dataUrl ?? images[part.material];
    zip.file("c3-world.glb", serializeGLB(project, meshes, diffuse));
  }
  const levels = [
    ...new Set(
      meshes
        .filter((m) =>
          ["structure", "windows", "interior"].includes(m.category),
        )
        .map((m) => m.level ?? 0),
    ),
  ].sort((a, b) => a - b);
  for (const level of levels)
    zip.file(
      `c3-plan-level-${level + 1}.svg`,
      planSVG(meshes, project.name, level),
    );
  zip.file(
    "c3-object-inventory.csv",
    inventoryCSV(
      manifest.placements.map((placement, i) => ({
        id: placement.id,
        model: placement.model,
        material: placement.material,
        triangles: meshes[i].indices.length / 3,
        position: placement.positionMeters,
        action: placement.action,
      })),
    ),
  );
  zip.file("c3-manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("c3-placements.json", JSON.stringify(manifest.placements, null, 2));
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
        budget: groupBudget,
        budgetIsNativeLimit: false,
        oversizeGroups: oversize.map((group) => group.id),
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
        geometryProfile: "emitted single-clump RWX subset",
        profile: EXPORT_PROFILE,
        models: Object.keys(manifest.models).length,
        placements: manifest.placements.length,
        triangles: meshes.reduce((n, m) => n + m.indices.length / 3, 0),
        missingDependencies: [],
        scope,
        groupBudget,
        oversizeGroups: oversize.map((group) => group.id),
        expandedObjectCount: meshes.length,
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
  checkZipBudget(bytes);
  const zip = await JSZip.loadAsync(bytes),
    manifestFile = zip.file("c3-manifest.json");
  if (!manifestFile) throw new Error("Missing package manifest.");
  const manifest = JSON.parse(await manifestFile.async("string")) as Manifest;
  validateManifest(manifest);
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
      checkZipBudget(bytes, {
        compressed: 8_000_000,
        expanded: 8_000_000,
        file: 8_000_000,
        entries: 2,
      });
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
  const parsedModels = new Map<string, ParsedRWX>();
  for (const p of placements) {
    const model = zip.file(manifest.models[p.model]);
    if (!model) throw new Error(`Missing model: ${p.model}.`);
    const program = parseAction(p.action),
      actionState = creationState(program, p.solid);
    let template = parsedModels.get(p.model);
    if (!template) {
      const serialized = await model.async("string");
      if (
        manifest.modelHashes &&
        (await sha256(serialized)) !== manifest.modelHashes[p.model]
      )
        throw new Error("Model hash mismatch.");
      template = parseRWX(serialized, {
        id: p.model,
        label: p.model,
        origin: [0, 0, 0],
        solid: true,
        category: p.category,
        material: p.material,
      });
      parsedModels.set(p.model, template);
    }
    const parsed: ParsedRWX = {
      ...template,
      mesh: {
        ...template.mesh,
        id: p.id,
        label: p.label,
        origin: p.positionMeters,
        solid: actionState.solid,
        category: p.category,
        material: p.material,
      },
    };
    const textureName = actionState.texture ?? parsed.texture,
      texture = manifest.textures[textureName];
    if (!texture) throw new Error("Missing texture manifest dependency.");
    const file = zip.file(texture.path);
    if (!file) throw new Error(`Missing texture: ${texture.path}.`);
    if (!textureImages[textureName]) {
      const decoded = await file.async("uint8array");
      if ((await sha256(decoded)) !== texture.hash)
        throw new Error("Texture hash mismatch.");
      const dimensions = pngDimensions(decoded);
      if (
        dimensions.width !== texture.width ||
        dimensions.height !== texture.height
      )
        throw new Error("Texture dimensions differ from the manifest.");
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
    parsed.mesh.roomIds = p.roomIds;
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
function validateManifest(m: Manifest) {
  const dictionary = (v: unknown) =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const name = (v: unknown) =>
    typeof v === "string" && /^c3-[a-z0-9-]+$/.test(v);
  const vector = (v: unknown) =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every(
      (n) => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e6,
    );
  const hash = (v: unknown) =>
    typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
  if (
    !m ||
    m.schemaVersion !== 1 ||
    !m.profile ||
    m.profile.id !== EXPORT_PROFILE.id ||
    m.profile.metersPerUnit !== EXPORT_PROFILE.metersPerUnit ||
    m.profile.winding !== EXPORT_PROFILE.winding ||
    m.profile.nativeVerified !== false ||
    !Array.isArray(m.placements) ||
    m.placements.length > 25000 ||
    !dictionary(m.models) ||
    !dictionary(m.textures)
  )
    throw new Error("Invalid or unsupported package manifest/profile.");
  if (
    Object.keys(m.models).length > 25000 ||
    Object.keys(m.textures).length > 5000
  )
    throw new Error("Package asset count exceeds application budget.");
  for (const [key, path] of Object.entries(m.models))
    if (!name(key) || path !== `object-path/models/${key}.rwx`)
      throw new Error("Unsafe model path or namespace.");
  if (m.modelHashes !== undefined) {
    if (!dictionary(m.modelHashes)) throw new Error("Invalid model hashes.");
    for (const key of Object.keys(m.models))
      if (!hash(m.modelHashes[key])) throw new Error("Missing model hash.");
  }
  for (const [key, t] of Object.entries(m.textures))
    if (
      !name(key) ||
      !t ||
      t.path !== `object-path/textures/${key}.png` ||
      !hash(t.hash) ||
      !Number.isInteger(t.width) ||
      !Number.isInteger(t.height) ||
      t.width < 1 ||
      t.height < 1 ||
      t.width > 1024 ||
      t.height > 1024
    )
      throw new Error("Invalid texture metadata or namespace.");
  const ids = new Set<string>();
  for (const p of m.placements) {
    if (
      !p ||
      typeof p.id !== "string" ||
      p.id.length > 256 ||
      ids.has(p.id) ||
      typeof p.label !== "string" ||
      p.label.length > 1000 ||
      !name(p.model) ||
      !Object.hasOwn(m.models, p.model) ||
      !vector(p.positionMeters) ||
      !MATERIAL_ROLES.includes(p.material) ||
      ![
        "structure",
        "windows",
        "roof",
        "interior",
        "site",
        "vegetation",
        "landscape",
      ].includes(p.category) ||
      typeof p.solid !== "boolean" ||
      typeof p.action !== "string" ||
      p.action.length > 4096 ||
      (p.walkable !== undefined && typeof p.walkable !== "boolean") ||
      (p.surfaceMesh !== undefined && typeof p.surfaceMesh !== "boolean") ||
      (p.roomIds !== undefined &&
        (!Array.isArray(p.roomIds) ||
          p.roomIds.length > 60 ||
          p.roomIds.some(
            (id) => typeof id !== "string" || !/^room-[a-z0-9-]+$/.test(id),
          ))) ||
      (p.level !== undefined &&
        (!Number.isInteger(p.level) || p.level < 0 || p.level > 5))
    )
      throw new Error("Invalid or duplicate placement metadata.");
    ids.add(p.id);
  }
  if (m.experimentalGroups !== undefined) {
    if (
      !Array.isArray(m.experimentalGroups) ||
      m.experimentalGroups.length > 25000
    )
      throw new Error("Invalid group metadata.");
    for (const g of m.experimentalGroups)
      if (
        !g ||
        !name(g.id) ||
        g.path !== `object-path/groups/${g.id}.zip` ||
        !vector(g.pivot) ||
        !hash(g.hash) ||
        !Array.isArray(g.ids) ||
        g.ids.length > 1024 ||
        g.ids.some((id) => !ids.has(id))
      )
        throw new Error("Invalid group metadata or namespace.");
  }
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
