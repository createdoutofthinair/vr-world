import { Project, preset } from "./project";
export const REFERENCE_EXAMPLES = [
  {
    id: "city-temperate",
    title: "A complete neighborhood",
    caption: "Seeded building plots, parks, pavements, roads and crossings.",
  },
  {
    id: "villa-desert",
    title: "Connected courtyard living",
    caption: "Two-storey U wings, true courtyards and interior circulation.",
  },
  {
    id: "waterfall-jungle",
    title: "From canopy to creek",
    caption:
      "Owned terrain, layered plants, a bank trail, bridge and waterfall.",
  },
] as const;
export function referenceExample(id: string | null): Project | null {
  if (id === "city-temperate") {
    const p = preset("mixed");
    p.name = "Neighborhood reference";
    p.world.enabled = true;
    p.world.blocks = 1;
    p.landscape.density = 0.3;
    return p;
  }
  if (id === "waterfall-jungle") {
    const p = preset("house", "jungle");
    p.name = "Jungle creek reference";
    p.landscape.extent = 12;
    p.effects = {
      ...p.effects,
      creek: true,
      waterfall: true,
      trail: true,
      bridge: true,
      motion: true,
    };
    return p;
  }
  if (id === "villa-desert") {
    const p = preset("villa", "desert");
    p.name = "Courtyard villa reference";
    p.width = 12;
    p.depth = 10;
    p.structure.footprint = "u";
    p.structure.storeys = 2;
    p.roof = "hip";
    return p;
  }
  return null;
}
