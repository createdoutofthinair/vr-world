export type Theme = "temperate" | "desert" | "jungle" | "fantasy" | "scifi";
export type Archetype = "shop" | "house" | "villa";
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
export interface Project {
  schemaVersion: 2;
  generatorVersion: "0.2.0";
  migratedFrom?: "0.1.0";
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
  roof: "flat" | "gable" | "none";
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
  origin: Vec3;
  positions: number[];
  uvs: number[];
  indices: number[];
  material: MaterialRole;
  solid: boolean;
}
export const DEFAULT_PROJECT: Project = {
  schemaVersion: 2,
  generatorVersion: "0.2.0",
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
  };
  return Object.fromEntries(
    MATERIAL_ROLES.map((role) => [
      role,
      {
        role,
        color:
          project.textures[role] || role === "sign" ? "#ffffff" : colors[role],
        pattern: patterns[role] ?? "solid",
        opacity: role === "glass" ? 0.3 : 1,
      },
    ]),
  ) as Record<MaterialRole, MaterialSpec>;
}

export function validateProject(input: unknown): Project {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Project must be an object.");
  let p = input as Record<string, unknown>;
  if (p.schemaVersion === 1 && p.generatorVersion === "0.1.0") {
    p = {
      ...p,
      schemaVersion: 2,
      generatorVersion: "0.2.0",
      migratedFrom: "0.1.0",
      biome: DEFAULT_BIOME[p.theme as Theme],
      landscape: { ...DEFAULT_LANDSCAPE },
      architectureDetails: true,
      surfaceSource: "standard",
    };
  }
  if (p.schemaVersion !== 2 || p.generatorVersion !== "0.2.0")
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
    textures[role as MaterialRole] = {
      name: t.name,
      dataUrl: t.dataUrl,
      width: t.width,
      height: t.height,
    };
  }
  const seed = number("seed", 0, 2_147_483_647);
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
  return {
    schemaVersion: 2,
    generatorVersion: "0.2.0",
    ...(p.migratedFrom === "0.1.0" ? { migratedFrom: "0.1.0" as const } : {}),
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
    archetype: enumeration("archetype", ["shop", "house", "villa"]),
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
    roof: enumeration("roof", ["flat", "gable", "none"]),
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
    archetype,
    theme,
    biome: DEFAULT_BIOME[theme],
    landscape: {
      ...DEFAULT_LANDSCAPE,
      density: theme === "jungle" ? 0.8 : theme === "desert" ? 0.4 : 0.65,
    },
    name:
      archetype === "shop"
        ? "Corner workshop"
        : archetype === "house"
          ? "Little garden house"
          : "Courtyard villa",
    width: archetype === "villa" ? 12 : archetype === "house" ? 7 : 8,
    depth: archetype === "villa" ? 10 : archetype === "house" ? 8 : 7,
    roof:
      theme === "jungle" || theme === "fantasy"
        ? "gable"
        : theme === "scifi" || theme === "desert" || archetype === "shop"
          ? "flat"
          : "gable",
    sign: archetype === "shop" ? "YOUR LITTLE WORLD" : "",
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
