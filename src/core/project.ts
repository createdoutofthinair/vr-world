export type Theme = "temperate" | "desert" | "jungle" | "fantasy" | "scifi";
export type Archetype = "shop" | "house" | "villa";
export type MaterialRole =
  "wall" | "floor" | "roof" | "trim" | "glass" | "ground" | "sign";
export type Vec3 = [number, number, number];
export interface TextureAsset {
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}
export interface Project {
  schemaVersion: 1;
  generatorVersion: "0.1.0";
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
  pattern: "plaster" | "wood" | "tiles" | "stone" | "solid";
  opacity: number;
}
export interface MeshData {
  id: string;
  label: string;
  category: "structure" | "windows" | "roof" | "interior" | "site";
  origin: Vec3;
  positions: number[];
  uvs: number[];
  indices: number[];
  material: MaterialRole;
  solid: boolean;
}
export const DEFAULT_PROJECT: Project = {
  schemaVersion: 1,
  generatorVersion: "0.1.0",
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
  { label: string; caption: string; palette: Record<MaterialRole, string> }
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
    caption: "Rain-soaked timber. Deep green.",
    palette: {
      wall: "#c1ccb0",
      floor: "#9f7a55",
      roof: "#466950",
      trim: "#386c5c",
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
  const colors = THEMES[project.theme].palette;
  return Object.fromEntries(
    (Object.keys(colors) as MaterialRole[]).map((role) => [
      role,
      {
        role,
        color:
          project.textures[role] || role === "sign" ? "#ffffff" : colors[role],
        pattern:
          role === "floor"
            ? "wood"
            : role === "roof"
              ? "tiles"
              : role === "ground"
                ? "stone"
                : role === "wall"
                  ? "plaster"
                  : "solid",
        opacity: role === "glass" ? 0.36 : 1,
      },
    ]),
  ) as Record<MaterialRole, MaterialSpec>;
}
export function validateProject(input: unknown): Project {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Project must be an object.");
  const p = input as Record<string, unknown>;
  if (p.schemaVersion !== 1 || p.generatorVersion !== "0.1.0")
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
    if (
      !["wall", "floor", "roof", "trim", "glass", "ground", "sign"].includes(
        role,
      )
    )
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
  return {
    schemaVersion: 1,
    generatorVersion: "0.1.0",
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
    name:
      archetype === "shop"
        ? "Corner workshop"
        : archetype === "house"
          ? "Little garden house"
          : "Courtyard villa",
    width: archetype === "villa" ? 12 : archetype === "house" ? 7 : 8,
    depth: archetype === "villa" ? 10 : archetype === "house" ? 8 : 7,
    roof: archetype === "shop" ? "flat" : "gable",
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
