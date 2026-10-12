import { decodePNG } from "./png";
export type Theme = "temperate" | "desert" | "jungle" | "fantasy" | "scifi";
export type Archetype = "shop" | "house" | "villa" | "flats" | "mixed";
export interface StructureSettings {
  storeys: number;
  stair: "u" | "straight";
  doorAngle: number;
  doorPoses: Record<string, number>;
  footprint: "rectangle" | "l" | "u" | "courtyard";
  windowWidth: number;
  windowHeight: number;
  windowSill: number;
  balcony: boolean;
  interior: "shell" | "furnished";
}
export type DistrictZone = "residential" | "commercial" | "mixed" | "park";
export interface DistrictRecipe {
  zone: DistrictZone;
  theme: Theme;
  maxStoreys: number;
}
export interface WorldSettings {
  enabled: boolean;
  blocks: number;
  blockSize: number;
  roadWidth: number;
  sidewalkWidth: number;
  parkRatio: number;
  viaductHeight: number;
  districts?: Record<string, DistrictRecipe>;
  locks: Record<
    string,
    {
      seed: number;
      archetype: Archetype;
      theme: Theme;
      storeys: number;
      park?: boolean;
    }
  >;
}
export const DEFAULT_WORLD: WorldSettings = {
  enabled: false,
  blocks: 2,
  blockSize: 36,
  roadWidth: 6,
  sidewalkWidth: 1.8,
  parkRatio: 0.2,
  viaductHeight: 3,
  locks: {},
};
export type GroundLayer = "grass" | "soil" | "rock" | "sand";
export interface GroundOperation {
  id: string;
  x: number;
  z: number;
  radius: number;
  strength: number;
  kind: "raise" | "lower" | "flatten" | "smooth" | "paint" | "erase";
  layer: GroundLayer;
  locked: boolean;
}
export interface TerrainSettings {
  form: "plain" | "hills" | "ridge" | "basin" | "terraces";
  amplitude: number;
  wavelength: number;
  direction: number;
  erosion: number;
  geology: "boulder" | "fractured" | "stratified" | "columnar";
  splats: boolean;
  texelsPerMeter: number;
  edits: GroundOperation[];
}
export interface EffectSettings {
  viaduct: boolean;
  creek: boolean;
  waterfall: boolean;
  trail: boolean;
  bridge: boolean;
  motion: boolean;
  rotationCandidate: boolean;
}
export interface KitDefinition {
  id: string;
  name: string;
  kind: "wall" | "window" | "door" | "slab" | "column" | "beam";
  width: number;
  height: number;
  depth: number;
}
export interface KitInstance {
  id: string;
  definition: string;
  origin: Vec3;
  yaw: number;
  parent?: string;
  parentSocket?: "left" | "right" | "top" | "bottom";
  socket?: "left" | "right" | "top" | "bottom";
  overrides: Partial<Pick<KitDefinition, "width" | "height" | "depth">>;
  locked: boolean;
}
export interface KitSettings {
  buildingEnabled: boolean;
  definitions: KitDefinition[];
  instances: KitInstance[];
}
export const DEFAULT_KIT: KitSettings = {
  buildingEnabled: true,
  definitions: [
    {
      id: "window-bay",
      name: "Window wall bay",
      kind: "window",
      width: 4,
      height: 3.2,
      depth: 0.22,
    },
    {
      id: "plain-wall",
      name: "Plain wall bay",
      kind: "wall",
      width: 4,
      height: 3.2,
      depth: 0.22,
    },
    {
      id: "door-bay",
      name: "Door wall bay",
      kind: "door",
      width: 4,
      height: 3.2,
      depth: 0.22,
    },
    {
      id: "floor-bay",
      name: "Floor slab",
      kind: "slab",
      width: 4,
      height: 0.2,
      depth: 4,
    },
    {
      id: "column",
      name: "Support column",
      kind: "column",
      width: 0.2,
      height: 3.2,
      depth: 0.2,
    },
    {
      id: "beam",
      name: "Support beam",
      kind: "beam",
      width: 4,
      height: 0.2,
      depth: 0.22,
    },
  ],
  instances: [],
};
export const PLANT_FAMILIES = [
  "broadleaf",
  "canopy",
  "acacia",
  "ancient",
  "conifer",
  "palm",
  "fern",
  "broadleaf-herb",
  "agave",
  "cactus",
  "alien",
  "grass",
  "fungi",
  "shrub",
  "hedge",
  "pad-cactus",
  "drooping",
  "spiral",
  "log",
  "stump",
] as const;
export type PlantFamilyName = (typeof PLANT_FAMILIES)[number];
export interface AuthoredRoom {
  id: string;
  name: string;
  type:
    | "bedroom"
    | "bathroom"
    | "kitchen"
    | "living"
    | "shop"
    | "storage"
    | "corridor";
  level: number;
  x: number;
  z: number;
  width: number;
  depth: number;
  doorSide: "front" | "back" | "left" | "right";
  doorOffset: number;
  doorWidth: number;
  locked: boolean;
  furnished: boolean;
  finish: MaterialRole;
}
export interface PlantLandmark {
  id: string;
  family: PlantFamilyName;
  seed: number;
  x: number;
  z: number;
  scale: number;
  locked: boolean;
  recipe?: PlantSettings;
}
export interface PlantSettings {
  algorithm: "rules" | "attraction";
  quality: "full" | "economy";
  age: "sapling" | "mature" | "old";
  height: number;
  crown: number;
  trunk: number;
  lean: number;
  leafDensity: number;
  pruned: number[];
}
export function validatePlantSettings(input: unknown): PlantSettings {
  const plants = input as PlantSettings;
  if (
    !plants ||
    !["rules", "attraction"].includes(plants.algorithm) ||
    !["full", "economy"].includes(plants.quality) ||
    !["sapling", "mature", "old"].includes(plants.age) ||
    ![
      plants.height,
      plants.crown,
      plants.trunk,
      plants.lean,
      plants.leafDensity,
    ].every(Number.isFinite) ||
    plants.height < 0.5 ||
    plants.height > 1.8 ||
    plants.crown < 0.5 ||
    plants.crown > 1.8 ||
    plants.trunk < 0.5 ||
    plants.trunk > 1.8 ||
    Math.abs(plants.lean) > 0.25 ||
    plants.leafDensity < 0.2 ||
    plants.leafDensity > 1 ||
    !Array.isArray(plants.pruned) ||
    plants.pruned.length > 24 ||
    plants.pruned.some((n) => !Number.isInteger(n) || n < 0 || n > 23)
  )
    throw new Error("Invalid plant recipe.");
  return {
    algorithm: plants.algorithm,
    quality: plants.quality,
    age: plants.age,
    height: plants.height,
    crown: plants.crown,
    trunk: plants.trunk,
    lean: plants.lean,
    leafDensity: plants.leafDensity,
    pruned: [...new Set(plants.pruned)],
  };
}
export const DEFAULT_PLANTS: PlantSettings = {
  algorithm: "rules",
  quality: "full",
  age: "mature",
  height: 1,
  crown: 1,
  trunk: 1,
  lean: 0,
  leafDensity: 1,
  pruned: [],
};
export const DEFAULT_TERRAIN: TerrainSettings = {
  form: "hills",
  amplitude: 1,
  wavelength: 24,
  direction: 20,
  erosion: 4,
  geology: "boulder",
  splats: false,
  texelsPerMeter: 16,
  edits: [],
};
export const DEFAULT_EFFECTS: EffectSettings = {
  viaduct: false,
  creek: false,
  waterfall: false,
  trail: false,
  bridge: false,
  motion: false,
  rotationCandidate: false,
};
export const DEFAULT_STRUCTURE: StructureSettings = {
  storeys: 1,
  stair: "u",
  doorAngle: 90,
  doorPoses: {},
  footprint: "rectangle",
  windowWidth: 1.8,
  windowHeight: 1.25,
  windowSill: 1,
  balcony: false,
  interior: "furnished",
};
export type BuildingMaterialRole =
  "wall" | "floor" | "roof" | "trim" | "glass" | "ground" | "sign";
export const MATERIAL_ROLES = [
  "wall",
  "floor",
  "roof",
  "trim",
  "glass",
  "ground",
  "sign",
  "bark",
  "foliage",
  "foliageLight",
  "grass",
  "rock",
  "path",
  "accent",
  "fabric",
  "road",
  "marking",
  "water",
  "foam",
  "metal",
] as const;
export type MaterialRole = (typeof MATERIAL_ROLES)[number];
export type Biome = "temperate" | "arid" | "tropical" | "woodland" | "alien";
export interface LandscapeSettings {
  enabled: boolean;
  extent: number;
  density: number;
  relief: number;
  plantScale: number;
  foliage: boolean;
  aridRecipe: "scrub" | "succulent" | "oasis";
}
export const DEFAULT_BIOME: Record<Theme, Biome> = {
  temperate: "temperate",
  desert: "arid",
  jungle: "tropical",
  fantasy: "woodland",
  scifi: "alien",
};
export const DEFAULT_LANDSCAPE: LandscapeSettings = {
  enabled: true,
  extent: 10,
  density: 0.65,
  relief: 0.65,
  plantScale: 1,
  foliage: true,
  aridRecipe: "scrub",
};
export const BIOMES: Record<
  Biome,
  {
    label: string;
    description: string;
    sky: string;
    fog: string;
    sun: string;
    colors: Record<
      | "ground"
      | "bark"
      | "foliage"
      | "foliageLight"
      | "grass"
      | "rock"
      | "path",
      string
    >;
  }
> = {
  temperate: {
    label: "Temperate parkland",
    description: "Branching broadleaf trees, layered shrubs and grasses.",
    sky: "#b3cddd",
    fog: "#d7e0df",
    sun: "#fff0d7",
    colors: {
      ground: "#666846",
      bark: "#635044",
      foliage: "#375539",
      foliageLight: "#6b8141",
      grass: "#72804b",
      rock: "#8a8980",
      path: "#b9b2a0",
    },
  },
  arid: {
    label: "Arid landscape",
    description: "Open acacia crowns, stone outcrops and dry soil pockets.",
    sky: "#c9d4d9",
    fog: "#e7d6bc",
    sun: "#ffe8c3",
    colors: {
      ground: "#c4aa7d",
      bark: "#796450",
      foliage: "#6a7654",
      foliageLight: "#949866",
      grass: "#b7a678",
      rock: "#b39a7b",
      path: "#cdbb97",
    },
  },
  tropical: {
    label: "Tropical jungle",
    description:
      "Buttress trees, attached palm fronds, broad leaves and ferns.",
    sky: "#a5bebf",
    fog: "#b9c9bc",
    sun: "#fff2d8",
    colors: {
      ground: "#514e37",
      bark: "#635342",
      foliage: "#23492c",
      foliageLight: "#537542",
      grass: "#4e6939",
      rock: "#737b6c",
      path: "#8e7960",
    },
  },
  woodland: {
    label: "Old woodland",
    description: "Gnarled limbs, exposed roots, woodland ferns and fungi.",
    sky: "#b9c8d1",
    fog: "#c9d2c6",
    sun: "#ffe4c0",
    colors: {
      ground: "#625c45",
      bark: "#58483b",
      foliage: "#3c5038",
      foliageLight: "#849056",
      grass: "#687448",
      rock: "#81857d",
      path: "#a69579",
    },
  },
  alien: {
    label: "Alien scrubland",
    description: "Forked stems, radial fans, segmented growth and basalt.",
    sky: "#a9bbc9",
    fog: "#c4c5d0",
    sun: "#e9f1ff",
    colors: {
      ground: "#646875",
      bark: "#6f666c",
      foliage: "#436e70",
      foliageLight: "#b38eaf",
      grass: "#8f8ca1",
      rock: "#74717b",
      path: "#a5abb3",
    },
  },
};
export type Vec3 = [number, number, number];
export interface TextureAsset {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}
export interface MaterialOptions {
  color: string;
  roughness: number;
  metalness: number;
  opacity: number;
  scale: number;
}
export interface MaterialMaps {
  normal?: TextureAsset;
  roughness?: TextureAsset;
  metalness?: TextureAsset;
  emissive?: TextureAsset;
  normalConvention: "opengl" | "directx";
}
export interface SignSlot {
  id: string;
  kind: "fascia" | "blade" | "wall" | "pavement" | "roof";
  width: number;
  height: number;
  text: string;
  asset: TextureAsset;
  artwork?: TextureAsset;
  settings?: {
    background: string;
    color: string;
    font: "sans-serif" | "serif" | "monospace";
    fit: "contain" | "cover";
    padding: number;
    border: boolean;
  };
}
export interface Project {
  schemaVersion: 5;
  generatorVersion: "0.5.0";
  migratedFrom?: "0.1.0" | "0.2.0" | "0.3.0" | "0.4.0";
  structure: StructureSettings;
  world: WorldSettings;
  terrain: TerrainSettings;
  effects: EffectSettings;
  kit: KitSettings;
  materialOptions: Partial<Record<MaterialRole, MaterialOptions>>;
  materialMaps: Partial<Record<MaterialRole, MaterialMaps>>;
  signs: SignSlot[];
  plants: PlantSettings;
  plantLandmarks: PlantLandmark[];
  rooms: AuthoredRoom[];
  biome: Biome;
  landscape: LandscapeSettings;
  architectureDetails: boolean;
  surfaceSource: "standard" | "procedural";
  name: string;
  seed: number;
  archetype: Archetype;
  theme: Theme;
  width: number;
  depth: number;
  height: number;
  wallThickness: number;
  doorWidth: number;
  windows: boolean;
  roof: "flat" | "gable" | "shed" | "hip" | "none";
  furnished: boolean;
  sign: string;
  textures: Partial<Record<MaterialRole, TextureAsset>>;
}
export interface MaterialSpec {
  role: MaterialRole;
  color: string;
  pattern:
    | "plaster"
    | "wood"
    | "tiles"
    | "stone"
    | "solid"
    | "brick"
    | "bark"
    | "leaf"
    | "soil"
    | "sand"
    | "panels"
    | "fabric";
  opacity: number;
  roughness?: number;
  metalness?: number;
  scale?: number;
}
export interface MeshData {
  id: string;
  label: string;
  category:
    | "structure"
    | "windows"
    | "roof"
    | "interior"
    | "site"
    | "vegetation"
    | "landscape";
  walkable?: boolean;
  level?: number;
  doorId?: string;
  roomIds?: string[];
  materialColor?: string;
  action?: string;
  textureRef?: string;
  surfaceMesh?: boolean;
  surfacePatch?: { x: number; z: number; width: number; depth: number };
  bakedTexture?: TextureAsset;
  origin: Vec3;
  positions: number[];
  uvs: number[];
  indices: number[];
  material: MaterialRole;
  solid: boolean;
}
export const DEFAULT_PROJECT: Project = {
  schemaVersion: 5,
  generatorVersion: "0.5.0",
  structure: { ...DEFAULT_STRUCTURE },
  world: { ...DEFAULT_WORLD, locks: {} },
  terrain: { ...DEFAULT_TERRAIN, edits: [] },
  effects: { ...DEFAULT_EFFECTS },
  kit: structuredClone(DEFAULT_KIT),
  materialOptions: {},
  materialMaps: {},
  signs: [],
  plants: { ...DEFAULT_PLANTS, pruned: [] },
  plantLandmarks: [],
  rooms: [],
  biome: "temperate",
  landscape: { ...DEFAULT_LANDSCAPE },
  architectureDetails: true,
  surfaceSource: "standard",
  name: "Corner workshop",
  seed: 4218,
  archetype: "shop",
  theme: "temperate",
  width: 8,
  depth: 7,
  height: 3.2,
  wallThickness: 0.22,
  doorWidth: 1.5,
  windows: true,
  roof: "flat",
  furnished: true,
  sign: "YOUR LITTLE WORLD",
  textures: {},
};
export const THEMES: Record<
  Theme,
  {
    label: string;
    caption: string;
    palette: Record<BuildingMaterialRole, string>;
  }
> = {
  temperate: {
    label: "Temperate",
    caption: "Warm brick. Green streets.",
    palette: {
      wall: "#ded8c9",
      floor: "#b59974",
      roof: "#394a4b",
      trim: "#496b58",
      glass: "#8bb6b5",
      ground: "#71885a",
      sign: "#203b30",
    },
  },
  desert: {
    label: "Desert",
    caption: "Sun-washed stone. Open skies.",
    palette: {
      wall: "#dab087",
      floor: "#c99a64",
      roof: "#ae704e",
      trim: "#665648",
      glass: "#8baaa9",
      ground: "#d1b482",
      sign: "#6c4937",
    },
  },
  jungle: {
    label: "Jungle",
    caption: "Timber verandas. Layered jungle.",
    palette: {
      wall: "#c1a885",
      floor: "#9f7a55",
      roof: "#585650",
      trim: "#665039",
      glass: "#9bc7b6",
      ground: "#466d4e",
      sign: "#194d3b",
    },
  },
  fantasy: {
    label: "Fantasy",
    caption: "Quiet villages. Wilder stories.",
    palette: {
      wall: "#dfd0b3",
      floor: "#9d7d58",
      roof: "#697289",
      trim: "#675440",
      glass: "#a5c7ce",
      ground: "#738762",
      sign: "#564574",
    },
  },
  scifi: {
    label: "Sci-fi",
    caption: "Clean panels. New frontiers.",
    palette: {
      wall: "#c3cdd4",
      floor: "#7e919d",
      roof: "#394b63",
      trim: "#397e86",
      glass: "#81d1de",
      ground: "#777d83",
      sign: "#273d55",
    },
  },
};
export function materialsFor(
  project: Project,
): Record<MaterialRole, MaterialSpec> {
  const colors = {
    ...THEMES[project.theme].palette,
    ...BIOMES[project.biome].colors,
    accent: project.theme === "scifi" ? "#74c7ca" : "#b29660",
    fabric: "#c7b48c",
    road: "#35383b",
    marking: "#eee7d5",
    water: "#39777d",
    foam: "#dae6dd",
    metal: "#69767c",
  };
  const patterns: Partial<Record<MaterialRole, MaterialSpec["pattern"]>> = {
    wall:
      project.theme === "temperate" && project.archetype === "shop"
        ? "brick"
        : project.theme === "jungle"
          ? "wood"
          : project.theme === "scifi"
            ? "panels"
            : "plaster",
    floor: project.theme === "scifi" ? "panels" : "wood",
    roof:
      project.theme === "scifi" || project.theme === "jungle"
        ? "panels"
        : "tiles",
    trim:
      project.theme === "jungle" || project.theme === "fantasy"
        ? "wood"
        : "solid",
    ground: project.biome === "arid" ? "sand" : "soil",
    bark: "bark",
    foliage: "leaf",
    foliageLight: "leaf",
    grass: "leaf",
    rock: "stone",
    path: project.theme === "scifi" ? "panels" : "stone",
    fabric: "fabric",
    road: "soil",
    marking: "solid",
    water: "solid",
    foam: "solid",
    metal: "panels",
  };
  return Object.fromEntries(
    MATERIAL_ROLES.map((role) => [
      role,
      {
        role,
        color:
          project.textures[role] || role === "sign" ? "#ffffff" : colors[role],
        pattern: patterns[role] ?? "solid",
        opacity: role === "glass" ? 0.3 : role === "water" ? 0.8 : 1,
        roughness: role === "glass" ? 0.15 : role === "metal" ? 0.55 : 0.84,
        metalness: role === "metal" ? 0.6 : role === "trim" ? 0.1 : 0,
        scale: 1,
        ...project.materialOptions[role],
      },
    ]),
  ) as Record<MaterialRole, MaterialSpec>;
}

const validatedImages = new WeakMap<
  TextureAsset,
  { dataUrl: string; width: number; height: number }
>();
export function validateTextureAsset(input: unknown): TextureAsset {
  const asset = input as TextureAsset;
  if (
    !asset ||
    typeof asset.name !== "string" ||
    asset.name.length > 150 ||
    typeof asset.dataUrl !== "string" ||
    asset.dataUrl.length > 2000000 ||
    !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(asset.dataUrl) ||
    !Number.isInteger(asset.width) ||
    !Number.isInteger(asset.height) ||
    asset.width < 1 ||
    asset.height < 1 ||
    asset.width > 1024 ||
    asset.height > 1024
  )
    throw new Error("Invalid normalized PNG asset.");
  let valid = validatedImages.get(asset);
  if (!valid || valid.dataUrl !== asset.dataUrl) {
    const image = decodePNG(
      Uint8Array.from(atob(asset.dataUrl.split(",")[1]), (c) =>
        c.charCodeAt(0),
      ),
    );
    valid = {
      dataUrl: asset.dataUrl,
      width: image.width,
      height: image.height,
    };
    validatedImages.set(asset, valid);
  }
  if (asset.width !== valid.width || asset.height !== valid.height)
    throw new Error("Asset dimensions do not match its PNG.");
  const clean = {
    name: asset.name,
    dataUrl: asset.dataUrl,
    width: asset.width,
    height: asset.height,
  };
  validatedImages.set(clean, valid);
  return clean;
}
export function validateProject(input: unknown): Project {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Project must be an object.");
  let p = input as Record<string, unknown>;
  if (p.schemaVersion === 1 && p.generatorVersion === "0.1.0") {
    p = {
      ...p,
      schemaVersion: 5,
      generatorVersion: "0.5.0",
      structure: { ...DEFAULT_STRUCTURE },
      world: { ...DEFAULT_WORLD, locks: {} },
      terrain: { ...DEFAULT_TERRAIN, edits: [] },
      effects: { ...DEFAULT_EFFECTS },
      kit: structuredClone(DEFAULT_KIT),
      materialOptions: {},
      materialMaps: {},
      signs: [],
      plants: { ...DEFAULT_PLANTS, pruned: [] },
      plantLandmarks: [],
      rooms: [],
      migratedFrom: "0.1.0",
      biome: DEFAULT_BIOME[p.theme as Theme],
      landscape: { ...DEFAULT_LANDSCAPE },
      architectureDetails: true,
      surfaceSource: "standard",
    };
  }
  if (p.schemaVersion === 2 && p.generatorVersion === "0.2.0")
    p = {
      ...p,
      schemaVersion: 5,
      generatorVersion: "0.5.0",
      migratedFrom: "0.2.0",
      structure: { ...DEFAULT_STRUCTURE },
      world: { ...DEFAULT_WORLD, locks: {} },
      terrain: { ...DEFAULT_TERRAIN, edits: [] },
      effects: { ...DEFAULT_EFFECTS },
      kit: structuredClone(DEFAULT_KIT),
      materialOptions: {},
      materialMaps: {},
      signs: [],
      plants: { ...DEFAULT_PLANTS, pruned: [] },
      plantLandmarks: [],
      rooms: [],
    };
  if (p.schemaVersion === 3 && p.generatorVersion === "0.3.0")
    p = {
      ...p,
      schemaVersion: 5,
      generatorVersion: "0.5.0",
      migratedFrom: "0.3.0",
      world: { ...DEFAULT_WORLD, ...(p.world as object) },
      effects: { ...DEFAULT_EFFECTS, ...(p.effects as object) },
      rooms: p.rooms ?? [],
      plantLandmarks: p.plantLandmarks ?? [],
    };
  if (p.schemaVersion === 4 && p.generatorVersion === "0.4.0")
    p = {
      ...p,
      schemaVersion: 5,
      generatorVersion: "0.5.0",
      migratedFrom: "0.4.0",
      world: { ...DEFAULT_WORLD, ...(p.world as object) },
      effects: { ...DEFAULT_EFFECTS, ...(p.effects as object) },
    };
  if (p.schemaVersion !== 5 || p.generatorVersion !== "0.5.0")
    throw new Error("Unsupported project/generator version.");
  const number = (key: string, lo: number, hi: number) => {
    const n = p[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < lo || n > hi)
      throw new Error(`${key} must be between ${lo} and ${hi}.`);
    return n;
  };
  const enumeration = <T extends string>(
    key: string,
    options: readonly T[],
  ): T => {
    if (!options.includes(p[key] as T)) throw new Error(`Invalid ${key}.`);
    return p[key] as T;
  };
  const text = (key: string, length: number) => {
    if (typeof p[key] !== "string" || (p[key] as string).length > length)
      throw new Error(`Invalid ${key}.`);
    return p[key] as string;
  };
  const bool = (key: string) => {
    if (typeof p[key] !== "boolean") throw new Error(`Invalid ${key}.`);
    return p[key] as boolean;
  };
  const width = number("width", 4, 18),
    depth = number("depth", 4, 18),
    height = number("height", 2.6, 5);
  const textures: Project["textures"] = {};
  if (
    !p.textures ||
    typeof p.textures !== "object" ||
    Array.isArray(p.textures)
  )
    throw new Error("Invalid texture collection.");
  for (const [role, value] of Object.entries(p.textures)) {
    if (!MATERIAL_ROLES.includes(role as MaterialRole))
      throw new Error("Unknown material role.");
    const t = value as TextureAsset;
    if (
      !t ||
      typeof t.name !== "string" ||
      t.name.length > 150 ||
      typeof t.dataUrl !== "string" ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(t.dataUrl) ||
      t.dataUrl.length > 2_000_000 ||
      !Number.isInteger(t.width) ||
      !Number.isInteger(t.height) ||
      t.width < 1 ||
      t.height < 1 ||
      t.width > 1024 ||
      t.height > 1024
    )
      throw new Error("Invalid normalized PNG texture.");
    let valid = validatedImages.get(t);
    if (!valid || valid.dataUrl !== t.dataUrl) {
      const image = decodePNG(
        Uint8Array.from(atob(t.dataUrl.split(",")[1]), (c) => c.charCodeAt(0)),
      );
      valid = { dataUrl: t.dataUrl, width: image.width, height: image.height };
      validatedImages.set(t, valid);
    }
    if (valid.width !== t.width || valid.height !== t.height)
      throw new Error("Texture dimensions do not match PNG bytes.");
    textures[role as MaterialRole] = {
      name: t.name,
      dataUrl: t.dataUrl,
      width: t.width,
      height: t.height,
    };
    validatedImages.set(textures[role as MaterialRole]!, valid);
  }
  const seed = number("seed", 0, 2_147_483_647);
  if (!Array.isArray(p.signs) || p.signs.length > 20)
    throw new Error("Invalid sign slots.");
  const signs: SignSlot[] = (p.signs as SignSlot[]).map((slot) => {
    if (
      !slot ||
      !/^[a-z0-9-]+$/.test(slot.id) ||
      !["fascia", "blade", "wall", "pavement", "roof"].includes(slot.kind) ||
      typeof slot.text !== "string" ||
      slot.text.length > 120 ||
      !Number.isFinite(slot.width) ||
      slot.width < 0.5 ||
      slot.width > 8 ||
      !Number.isFinite(slot.height) ||
      slot.height < 0.3 ||
      slot.height > 3
    )
      throw new Error("Invalid sign slot.");
    const asset = slot.asset;
    if (
      !asset ||
      typeof asset.name !== "string" ||
      typeof asset.dataUrl !== "string" ||
      asset.dataUrl.length > 2000000 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(asset.dataUrl)
    )
      throw new Error("Invalid sign artwork.");
    let valid = validatedImages.get(asset);
    if (!valid || valid.dataUrl !== asset.dataUrl) {
      const image = decodePNG(
        Uint8Array.from(atob(asset.dataUrl.split(",")[1]), (c) =>
          c.charCodeAt(0),
        ),
      );
      valid = {
        dataUrl: asset.dataUrl,
        width: image.width,
        height: image.height,
      };
      validatedImages.set(asset, valid);
    }
    if (asset.width !== valid.width || asset.height !== valid.height)
      throw new Error("Invalid sign artwork dimensions.");
    if (slot.kind === "roof" && p.roof === "none")
      throw new Error("Roof signs need a supporting roof.");
    const settings = slot.settings;
    if (
      settings &&
      (!/^#[a-f0-9]{6}$/i.test(settings.background) ||
        !/^#[a-f0-9]{6}$/i.test(settings.color) ||
        !["sans-serif", "serif", "monospace"].includes(settings.font) ||
        !["contain", "cover"].includes(settings.fit) ||
        !Number.isFinite(settings.padding) ||
        settings.padding < 0 ||
        settings.padding > 0.2 ||
        typeof settings.border !== "boolean")
    )
      throw new Error("Invalid sign raster settings.");
    return {
      ...slot,
      asset: validateTextureAsset(asset),
      artwork: slot.artwork ? validateTextureAsset(slot.artwork) : undefined,
      settings: settings ? { ...settings } : undefined,
    };
  });
  if (new Set(signs.map((s) => s.id)).size !== signs.length)
    throw new Error("Duplicate sign slot.");
  const materialOptions: Project["materialOptions"] = {},
    materialMaps: Project["materialMaps"] = {};
  if (
    !p.materialOptions ||
    typeof p.materialOptions !== "object" ||
    Array.isArray(p.materialOptions) ||
    !p.materialMaps ||
    typeof p.materialMaps !== "object" ||
    Array.isArray(p.materialMaps)
  )
    throw new Error("Invalid material settings.");
  for (const [role, option] of Object.entries(p.materialOptions)) {
    const m = option as MaterialOptions;
    if (
      !MATERIAL_ROLES.includes(role as MaterialRole) ||
      !m ||
      !/^#[a-f0-9]{6}$/i.test(m.color) ||
      ![m.roughness, m.metalness, m.opacity, m.scale].every(Number.isFinite) ||
      m.roughness < 0 ||
      m.roughness > 1 ||
      m.metalness < 0 ||
      m.metalness > 1 ||
      m.opacity < 0.03 ||
      m.opacity > 1 ||
      m.scale < 0.1 ||
      m.scale > 10
    )
      throw new Error("Invalid material options.");
    materialOptions[role as MaterialRole] = { ...m };
  }
  for (const [role, value] of Object.entries(p.materialMaps)) {
    const maps = value as MaterialMaps;
    if (
      !MATERIAL_ROLES.includes(role as MaterialRole) ||
      !maps ||
      !["opengl", "directx"].includes(maps.normalConvention)
    )
      throw new Error("Invalid PBR map set.");
    const clean: MaterialMaps = { normalConvention: maps.normalConvention };
    for (const kind of [
      "normal",
      "roughness",
      "metalness",
      "emissive",
    ] as const) {
      const asset = maps[kind];
      if (asset) {
        if (
          typeof asset.name !== "string" ||
          asset.name.length > 150 ||
          typeof asset.dataUrl !== "string" ||
          asset.dataUrl.length > 2000000 ||
          !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(asset.dataUrl)
        )
          throw new Error("Invalid PBR asset.");
        let valid = validatedImages.get(asset);
        if (!valid || valid.dataUrl !== asset.dataUrl) {
          const decoded = decodePNG(
            Uint8Array.from(atob(asset.dataUrl.split(",")[1]), (c) =>
              c.charCodeAt(0),
            ),
          );
          valid = {
            dataUrl: asset.dataUrl,
            width: decoded.width,
            height: decoded.height,
          };
          validatedImages.set(asset, valid);
        }
        if (valid.width !== asset.width || valid.height !== asset.height)
          throw new Error("Invalid PBR dimensions.");
        clean[kind] = {
          name: asset.name,
          dataUrl: asset.dataUrl,
          width: asset.width,
          height: asset.height,
        };
        validatedImages.set(clean[kind]!, valid);
      }
    }
    materialMaps[role as MaterialRole] = clean;
  }
  if (!Number.isInteger(seed)) throw new Error("Seed must be an integer.");
  const l = p.landscape as Record<string, unknown>;
  if (!l || typeof l !== "object" || Array.isArray(l))
    throw new Error("Invalid landscape settings.");
  const bounded = (key: string, lo: number, hi: number) => {
    const n = l[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < lo || n > hi)
      throw new Error(`Invalid landscape ${key}.`);
    return n;
  };
  if (
    typeof l.enabled !== "boolean" ||
    typeof l.foliage !== "boolean" ||
    !["scrub", "succulent", "oasis"].includes(l.aridRecipe as string)
  )
    throw new Error("Invalid landscape recipe.");
  const structure = p.structure as StructureSettings;
  const plants = validatePlantSettings(p.plants);
  const rawLandmarks = p.plantLandmarks ?? [];
  if (!Array.isArray(rawLandmarks) || rawLandmarks.length > 100)
    throw new Error("Invalid plant landmarks.");
  const landmarkIds = new Set<string>();
  const plantLandmarks: PlantLandmark[] = rawLandmarks.map(
    (record: PlantLandmark) => {
      if (
        !record ||
        typeof record.id !== "string" ||
        !/^landmark-[a-z0-9-]+$/.test(record.id) ||
        landmarkIds.has(record.id) ||
        !PLANT_FAMILIES.includes(record.family) ||
        !Number.isInteger(record.seed) ||
        record.seed < 0 ||
        record.seed > 2147483647 ||
        ![record.x, record.z, record.scale].every(Number.isFinite) ||
        Math.abs(record.x) > 200 ||
        Math.abs(record.z) > 200 ||
        record.scale < 0.2 ||
        record.scale > 3 ||
        typeof record.locked !== "boolean" ||
        (record.locked && !record.recipe)
      )
        throw new Error("Invalid or duplicate plant landmark.");
      landmarkIds.add(record.id);
      return {
        id: record.id,
        family: record.family,
        seed: record.seed,
        x: record.x,
        z: record.z,
        scale: record.scale,
        locked: record.locked,
        recipe: record.recipe
          ? validatePlantSettings(record.recipe)
          : undefined,
      };
    },
  );
  const rawRooms = p.rooms ?? [];
  if (!Array.isArray(rawRooms) || rawRooms.length > 60)
    throw new Error("Too many authored rooms.");
  const roomIds = new Set<string>();
  const rooms: AuthoredRoom[] = rawRooms.map((room: AuthoredRoom) => {
    if (
      !room ||
      typeof room.id !== "string" ||
      !/^room-[a-z0-9-]+$/.test(room.id) ||
      roomIds.has(room.id) ||
      typeof room.name !== "string" ||
      room.name.length > 80 ||
      ![
        "bedroom",
        "bathroom",
        "kitchen",
        "living",
        "shop",
        "storage",
        "corridor",
      ].includes(room.type) ||
      !Number.isInteger(room.level) ||
      room.level < 0 ||
      room.level > 5 ||
      ![
        room.x,
        room.z,
        room.width,
        room.depth,
        room.doorOffset,
        room.doorWidth,
      ].every(Number.isFinite) ||
      Math.abs(room.x) > 20 ||
      Math.abs(room.z) > 20 ||
      room.width < 2 ||
      room.depth < 2 ||
      room.width > 20 ||
      room.depth > 20 ||
      room.doorWidth < 0.9 ||
      room.doorWidth > 2 ||
      !["front", "back", "left", "right"].includes(room.doorSide) ||
      typeof room.locked !== "boolean" ||
      typeof room.furnished !== "boolean" ||
      !MATERIAL_ROLES.includes(room.finish)
    )
      throw new Error("Invalid or duplicate authored room.");
    roomIds.add(room.id);
    return { ...room };
  });
  const kit = p.kit as KitSettings;
  if (
    !kit ||
    typeof kit.buildingEnabled !== "boolean" ||
    !Array.isArray(kit.definitions) ||
    !Array.isArray(kit.instances) ||
    kit.definitions.length > 50 ||
    kit.instances.length > 250
  )
    throw new Error("Invalid modular kit.");
  const definitions: KitDefinition[] = kit.definitions.map((d) => {
    if (
      !d ||
      !/^[a-z0-9-]+$/.test(d.id) ||
      typeof d.name !== "string" ||
      d.name.length > 80 ||
      !["wall", "window", "door", "slab", "column", "beam"].includes(d.kind) ||
      ![d.width, d.height, d.depth].every(
        (n) => Number.isFinite(n) && n >= 0.06 && n <= 12,
      ) ||
      (["window", "door"].includes(d.kind) &&
        (d.width < 2 || d.height < 2.6 || d.depth > 0.5))
    )
      throw new Error("Invalid kit definition dimensions.");
    return { ...d };
  });
  if (new Set(definitions.map((d) => d.id)).size !== definitions.length)
    throw new Error("Duplicate module definition.");
  const instances: KitInstance[] = kit.instances.map((i) => {
    if (
      !i ||
      !/^[a-z0-9-]+$/.test(i.id) ||
      !definitions.some((d) => d.id === i.definition) ||
      !Array.isArray(i.origin) ||
      i.origin.length !== 3 ||
      !i.origin.every((n) => Number.isFinite(n) && Math.abs(n) <= 500) ||
      !Number.isFinite(i.yaw) ||
      Math.abs(i.yaw) > 360 ||
      i.yaw % 90 !== 0 ||
      typeof i.locked !== "boolean" ||
      !i.overrides ||
      typeof i.overrides !== "object"
    )
      throw new Error("Invalid kit instance.");
    for (const [key, n] of Object.entries(i.overrides))
      if (
        !["width", "height", "depth"].includes(key) ||
        typeof n !== "number" ||
        !Number.isFinite(n) ||
        n < 0.06 ||
        n > 12
      )
        throw new Error("Invalid module override.");
    return {
      ...i,
      origin: [...i.origin] as Vec3,
      overrides: { ...i.overrides },
    };
  });
  if (new Set(instances.map((i) => i.id)).size !== instances.length)
    throw new Error("Duplicate module instance.");
  for (const i of instances)
    if (
      i.parent &&
      (!instances.some((v) => v.id === i.parent) ||
        !["left", "right", "top", "bottom"].includes(i.parentSocket ?? "") ||
        !["left", "right", "top", "bottom"].includes(i.socket ?? ""))
    )
      throw new Error("Invalid module attachment.");
  const world = p.world as WorldSettings;
  const terrain = p.terrain as TerrainSettings,
    effects = p.effects as EffectSettings;
  if (
    !terrain ||
    !effects ||
    typeof terrain !== "object" ||
    typeof effects !== "object"
  )
    throw new Error("Missing terrain/effect settings.");
  const terrainNumber = (
    key: keyof TerrainSettings,
    lo: number,
    hi: number,
  ) => {
    const n = terrain[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < lo || n > hi)
      throw new Error(`Invalid terrain ${key}.`);
    return n;
  };
  if (
    !["plain", "hills", "ridge", "basin", "terraces"].includes(terrain.form) ||
    !["boulder", "fractured", "stratified", "columnar"].includes(
      terrain.geology,
    ) ||
    typeof terrain.splats !== "boolean" ||
    !Array.isArray(terrain.edits) ||
    terrain.edits.length > 500
  )
    throw new Error("Invalid terrain recipe.");
  const edits: GroundOperation[] = terrain.edits.map((edit) => {
    if (
      !edit ||
      !/^[a-z0-9-]+$/.test(edit.id) ||
      !["raise", "lower", "flatten", "smooth", "paint", "erase"].includes(
        edit.kind,
      ) ||
      !["grass", "soil", "rock", "sand"].includes(edit.layer) ||
      typeof edit.locked !== "boolean" ||
      ![edit.x, edit.z, edit.radius, edit.strength].every(Number.isFinite) ||
      Math.abs(edit.x) > 500 ||
      Math.abs(edit.z) > 500 ||
      edit.radius < 0.5 ||
      edit.radius > 20 ||
      edit.strength < 0 ||
      edit.strength > 5
    )
      throw new Error("Invalid terrain edit.");
    return { ...edit };
  });
  if (new Set(edits.map((e) => e.id)).size !== edits.length)
    throw new Error("Duplicate terrain operation identity.");
  for (const key of Object.keys(DEFAULT_EFFECTS))
    if (typeof effects[key as keyof EffectSettings] !== "boolean")
      throw new Error("Invalid effect setting.");
  if (effects.waterfall && (!effects.creek || world.enabled))
    throw new Error("Waterfall presets need a creek in parcel mode.");
  if (effects.creek && !world.enabled && !l.enabled)
    throw new Error("Creeks require the owned landscape mesh.");
  if (effects.creek && !world.enabled && (l.extent as number) < 8)
    throw new Error("Creek banks need at least 8 m of landscape extent.");
  if (
    !world ||
    typeof world !== "object" ||
    typeof world.enabled !== "boolean" ||
    !world.locks ||
    typeof world.locks !== "object" ||
    Array.isArray(world.locks)
  )
    throw new Error("Invalid world settings.");
  const worldNumber = (key: keyof WorldSettings, lo: number, hi: number) => {
    const n = world[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < lo || n > hi)
      throw new Error(`Invalid world ${key}.`);
    return n;
  };
  const blocks = worldNumber("blocks", 1, 3);
  if (!Number.isInteger(blocks))
    throw new Error("World blocks must be an integer.");
  if (effects.viaduct && (!world.enabled || blocks !== 3))
    throw new Error("Viaduct needs a three-block neighborhood.");
  if (
    effects.viaduct &&
    world.viaductHeight /
      (world.blockSize + world.roadWidth + 2 * world.sidewalkWidth) >
      0.12
  )
    throw new Error(
      "Viaduct approach exceeds the application grade budget of 12%.",
    );
  const districts: Record<string, DistrictRecipe> = {};
  const districtInput = world.districts === undefined ? {} : world.districts;
  if (
    !districtInput ||
    typeof districtInput !== "object" ||
    Array.isArray(districtInput) ||
    Object.keys(districtInput).length > 9
  )
    throw new Error("Invalid city districts.");
  for (const [id, recipe] of Object.entries(districtInput)) {
    if (
      !/^block-[0-2]-[0-2]$/.test(id) ||
      !recipe ||
      !["residential", "commercial", "mixed", "park"].includes(recipe.zone) ||
      !["temperate", "desert", "jungle", "fantasy", "scifi"].includes(
        recipe.theme,
      ) ||
      !Number.isInteger(recipe.maxStoreys) ||
      recipe.maxStoreys < 1 ||
      recipe.maxStoreys > 4
    )
      throw new Error("Invalid city district recipe.");
    districts[id] = {
      zone: recipe.zone,
      theme: recipe.theme,
      maxStoreys: recipe.maxStoreys,
    };
  }
  const locks: WorldSettings["locks"] = {};
  if (Object.keys(world.locks).length > 100)
    throw new Error("Too many building locks.");
  for (const [id, record] of Object.entries(world.locks)) {
    if (
      !/^block-\d+-\d+-plot-\d+$/.test(id) ||
      !record ||
      !Number.isInteger(record.seed) ||
      record.seed < 0 ||
      record.seed > 2147483647 ||
      !["house", "shop", "villa", "flats", "mixed"].includes(
        record.archetype,
      ) ||
      !["temperate", "desert", "jungle", "fantasy", "scifi"].includes(
        record.theme,
      ) ||
      !Number.isInteger(record.storeys) ||
      record.storeys < 1 ||
      record.storeys > 4 ||
      (record.park !== undefined && typeof record.park !== "boolean")
    )
      throw new Error("Invalid locked building.");
    locks[id] = { ...record };
  }
  if (!structure || typeof structure !== "object")
    throw new Error("Missing structure settings.");
  const structural = (key: keyof StructureSettings, lo: number, hi: number) => {
    const n = structure[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < lo || n > hi)
      throw new Error(`Invalid structure ${key}.`);
    return n;
  };
  const storeys = structural("storeys", 1, 6);
  if (!Number.isInteger(storeys))
    throw new Error("Storeys must be an integer.");
  if (storeys > 1 && (width < 7 || depth < 8))
    throw new Error(
      "Multi-storey circulation needs at least a 7 × 8 m footprint.",
    );
  const stairSteps = Math.ceil((height + 0.22) / 0.18);
  if (structure.footprint !== "rectangle") {
    if (
      !["house", "villa"].includes(p.archetype as string) ||
      width < 10 ||
      depth < 9
    )
      throw new Error(
        "Connected wings are supported for houses/villas with at least a 10 × 9 m footprint.",
      );
    if (!["flat", "hip", "none"].includes(p.roof as string))
      throw new Error(
        "Connected wings currently support flat or joined hip roofs.",
      );
    if (
      storeys > 1 &&
      width / 3 < 2.55 + number("wallThickness", 0.12, 0.45) * 2 + 0.3
    )
      throw new Error(
        "The wing is too narrow for its stair core. Increase width.",
      );
  }
  if (
    (p.archetype === "flats" || p.archetype === "mixed") &&
    (width < 10 ||
      depth -
        number("wallThickness", 0.12, 0.45) * 2 -
        0.15 -
        0.95 -
        Math.ceil(stairSteps / 2) * 0.28 -
        0.95 <
        3.8)
  )
    throw new Error(
      "Apartment templates need a wider/deeper footprint for complete units and communal circulation.",
    );
  if (
    storeys > 1 &&
    (structure.stair === "straight" ? stairSteps : Math.ceil(stairSteps / 2)) *
      0.28 +
      2.2 +
      number("wallThickness", 0.12, 0.45) * 2 >
      depth
  )
    throw new Error(
      "Stair flights and landings do not fit. Increase depth or choose U stairs.",
    );
  if (
    !["u", "straight"].includes(structure.stair) ||
    !["rectangle", "l", "u", "courtyard"].includes(structure.footprint) ||
    !["shell", "furnished"].includes(structure.interior) ||
    typeof structure.balcony !== "boolean"
  )
    throw new Error("Invalid structure recipe.");
  const doorPoses: Record<string, number> = {};
  if (
    !structure.doorPoses ||
    typeof structure.doorPoses !== "object" ||
    Array.isArray(structure.doorPoses) ||
    Object.keys(structure.doorPoses).length > 1000
  )
    throw new Error("Invalid door poses.");
  for (const [id, angle] of Object.entries(structure.doorPoses)) {
    if (
      !/^[a-z0-9-]+$/.test(id) ||
      typeof angle !== "number" ||
      !Number.isFinite(angle) ||
      angle < 0 ||
      angle > 100
    )
      throw new Error("Invalid door pose.");
    doorPoses[id] = angle;
  }
  return {
    schemaVersion: 5,
    generatorVersion: "0.5.0",
    kit: { buildingEnabled: kit.buildingEnabled, definitions, instances },
    materialOptions,
    materialMaps,
    signs,
    plants: { ...plants, pruned: [...new Set(plants.pruned)] },
    plantLandmarks,
    rooms,
    terrain: {
      form: terrain.form,
      geology: terrain.geology,
      splats: terrain.splats,
      edits,
      amplitude: terrainNumber("amplitude", 0, 12),
      wavelength: terrainNumber("wavelength", 10, 80),
      direction: terrainNumber("direction", 0, 180),
      erosion: terrainNumber("erosion", 0, 20),
      texelsPerMeter: terrainNumber("texelsPerMeter", 8, 32),
    },
    effects: Object.fromEntries(
      Object.keys(DEFAULT_EFFECTS).map((key) => [
        key,
        effects[key as keyof EffectSettings],
      ]),
    ) as unknown as EffectSettings,
    world: {
      enabled: world.enabled,
      blocks,
      blockSize: worldNumber("blockSize", 32, 48),
      roadWidth: worldNumber("roadWidth", 4, 10),
      sidewalkWidth: worldNumber("sidewalkWidth", 1.2, 3),
      parkRatio: worldNumber("parkRatio", 0, 0.6),
      viaductHeight: worldNumber("viaductHeight", 2.5, 5),
      ...(Object.keys(districts).length ? { districts } : {}),
      locks,
    },
    ...(["0.1.0", "0.2.0", "0.3.0", "0.4.0"].includes(p.migratedFrom as string)
      ? { migratedFrom: p.migratedFrom as Project["migratedFrom"] }
      : {}),
    structure: {
      storeys,
      stair: structure.stair,
      footprint: structure.footprint,
      interior: structure.interior,
      balcony: structure.balcony,
      doorAngle: structural("doorAngle", 0, 100),
      doorPoses,
      windowWidth: structural("windowWidth", 0.4, 3),
      windowHeight: structural("windowHeight", 0.4, 2),
      windowSill: structural("windowSill", 0.4, 1.5),
    },
    biome: enumeration("biome", [
      "temperate",
      "arid",
      "tropical",
      "woodland",
      "alien",
    ]),
    architectureDetails: bool("architectureDetails"),
    surfaceSource: enumeration("surfaceSource", ["standard", "procedural"]),
    landscape: {
      enabled: l.enabled,
      foliage: l.foliage,
      aridRecipe: l.aridRecipe as LandscapeSettings["aridRecipe"],
      extent: bounded("extent", 6, 18),
      density: bounded("density", 0, 1),
      relief: bounded("relief", 0, 2),
      plantScale: bounded("plantScale", 0.6, 1.5),
    },
    name: text("name", 80),
    seed,
    archetype: enumeration("archetype", [
      "shop",
      "house",
      "villa",
      "flats",
      "mixed",
    ]),
    theme: enumeration("theme", [
      "temperate",
      "desert",
      "jungle",
      "fantasy",
      "scifi",
    ]),
    width,
    depth,
    height,
    wallThickness: number("wallThickness", 0.12, 0.45),
    doorWidth: number("doorWidth", 0.9, 2),
    windows: bool("windows"),
    roof: enumeration("roof", ["flat", "gable", "shed", "hip", "none"]),
    furnished: bool("furnished"),
    sign: text("sign", 40),
    textures,
  };
}
export function preset(
  archetype: Archetype,
  theme: Theme = "temperate",
): Project {
  return {
    ...DEFAULT_PROJECT,
    kit: structuredClone(DEFAULT_KIT),
    materialOptions: {},
    materialMaps: {},
    signs: [],
    plants: { ...DEFAULT_PLANTS, pruned: [] },
    plantLandmarks: [],
    rooms: [],
    terrain: { ...DEFAULT_TERRAIN, edits: [] },
    effects: { ...DEFAULT_EFFECTS },
    world: { ...DEFAULT_WORLD, locks: {} },
    archetype,
    structure: {
      ...DEFAULT_STRUCTURE,
      doorPoses: {},
      storeys: archetype === "flats" || archetype === "mixed" ? 3 : 1,
      balcony: archetype === "flats",
    },
    theme,
    biome: DEFAULT_BIOME[theme],
    landscape: {
      ...DEFAULT_LANDSCAPE,
      density: theme === "jungle" ? 0.8 : theme === "desert" ? 0.4 : 0.65,
    },
    name:
      archetype === "flats"
        ? "Garden apartments"
        : archetype === "mixed"
          ? "Shop and residences"
          : archetype === "shop"
            ? "Corner workshop"
            : archetype === "house"
              ? "Little garden house"
              : "Courtyard villa",
    width:
      archetype === "villa" || archetype === "flats" || archetype === "mixed"
        ? 12
        : archetype === "house"
          ? 7
          : 8,
    depth:
      archetype === "villa" || archetype === "flats" || archetype === "mixed"
        ? 10
        : archetype === "house"
          ? 8
          : 7,
    roof:
      theme === "jungle" || theme === "fantasy"
        ? "gable"
        : theme === "scifi" || theme === "desert" || archetype === "shop"
          ? "flat"
          : "gable",
    sign:
      archetype === "shop" || archetype === "mixed" ? "YOUR LITTLE WORLD" : "",
    textures: {},
  };
}
export function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFor(seed: number, stream: string): number {
  let h = seed >>> 0;
  for (let i = 0; i < stream.length; i++)
    h = Math.imul(h ^ stream.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function applyTheme(project: Project, theme: Theme): Partial<Project> {
  return {
    theme,
    biome: DEFAULT_BIOME[theme],
    roof: theme === "jungle" || theme === "fantasy" ? "gable" : "flat",
    architectureDetails: true,
    landscape: {
      ...project.landscape,
      enabled: true,
      density: theme === "jungle" ? 0.8 : theme === "desert" ? 0.4 : 0.65,
    },
  };
}

/** Replace structural template settings while retaining the user's world, assets and authored edits. */
export function applyBuildingPreset(
  project: Project,
  archetype: Archetype,
): Project {
  const recipe = preset(archetype, project.theme);
  return {
    ...project,
    archetype,
    width: recipe.width,
    depth: recipe.depth,
    height: recipe.height,
    wallThickness: recipe.wallThickness,
    doorWidth: recipe.doorWidth,
    windows: recipe.windows,
    roof: recipe.roof,
    furnished: recipe.furnished,
    structure: { ...recipe.structure, interior: project.structure.interior },
  };
}
