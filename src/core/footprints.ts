import { Project } from "./project";
export interface FootprintCell {
  x: number;
  z: number;
}
export function footprintCells(p: Project): FootprintCell[] {
  const cells: FootprintCell[] = [];
  for (let z = 0; z < 3; z++)
    for (let x = 0; x < 3; x++)
      if (
        p.structure.footprint === "l"
          ? x === 0 || z === 0
          : p.structure.footprint === "u"
            ? x === 0 || x === 2 || z === 0
            : p.structure.footprint === "courtyard"
              ? x !== 1 || z !== 1
              : true
      )
        cells.push({ x, z });
  return cells;
}
