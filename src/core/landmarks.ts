import { MeshData, Project } from "./project";
import { generatePlant } from "./plants";
import { bounds } from "./geometry";
import { terrainDomain, terrainHeight, channelX } from "./terrain";
export function buildLandmarks(p: Project, scene: MeshData[]): MeshData[] {
  const result: MeshData[] = [],
    [width, depth] = terrainDomain(p);
  for (const pin of p.plantLandmarks) {
    if (p.effects.creek && Math.abs(pin.x - channelX(p, pin.z)) < 1.6)
      throw new Error(
        `${pin.id} rooting patch overlaps the creek. Move it to a bank.`,
      );
    const tree = generatePlant(
        pin.family,
        pin.seed,
        pin.scale,
        pin.locked ? pin.recipe! : p.plants,
      ),
      y =
        p.landscape.enabled || p.world.enabled
          ? terrainHeight(p, pin.x, pin.z)
          : 0;
    const parts = tree.meshes
      .filter(
        (m) => p.landscape.foliage || !["leaves", "leaf-tips"].includes(m.id),
      )
      .map((mesh) => ({
        ...mesh,
        id: `${pin.id}-${mesh.id}`,
        label: `${pin.id} · ${mesh.label}`,
        origin: [pin.x, y, pin.z] as [number, number, number],
      }));
    for (const part of parts) {
      const b = bounds(part);
      if (
        b.min[0] < -width / 2 ||
        b.max[0] > width / 2 ||
        b.min[2] < -depth / 2 ||
        b.max[2] > depth / 2
      )
        throw new Error(
          `${pin.id} exceeds the owned parcel bounds. Relocate or reduce its scale.`,
        );
      for (const obstacle of scene) {
        if (
          !obstacle.solid ||
          !["structure", "windows", "roof", "interior", "site"].includes(
            obstacle.category,
          ) ||
          obstacle.surfaceMesh ||
          (obstacle.category === "site" && obstacle.walkable) ||
          obstacle.id === "site-ground"
        )
          continue;
        const c = bounds(obstacle);
        if (
          b.min[0] < c.max[0] &&
          b.max[0] > c.min[0] &&
          b.min[2] < c.max[2] &&
          b.max[2] > c.min[2] &&
          b.min[1] < c.max[1] &&
          b.max[1] > c.min[1]
        )
          throw new Error(
            `${pin.id} conflicts with ${obstacle.label}. Relocate, prune or reduce the landmark.`,
          );
      }
    }
    if (
      scene.some((mesh) => {
        if (mesh.material !== "path" && mesh.material !== "road") return false;
        const b = bounds(mesh);
        return (
          pin.x + 0.4 * pin.scale > b.min[0] &&
          pin.x - 0.4 * pin.scale < b.max[0] &&
          pin.z + 0.4 * pin.scale > b.min[2] &&
          pin.z - 0.4 * pin.scale < b.max[2]
        );
      })
    )
      throw new Error(
        `${pin.id} rooting patch overlaps a road or path. Relocate the landmark.`,
      );
    for (const mesh of parts) {
      if (
        mesh.id.endsWith("-branches") &&
        (p.landscape.enabled || p.world.enabled)
      )
        mesh.positions = mesh.positions.map((v, i) =>
          i % 3 === 1 && v < 0.35
            ? v +
              (terrainHeight(
                p,
                pin.x + mesh.positions[i - 1],
                pin.z + mesh.positions[i + 1],
              ) -
                y) *
                Math.max(0, 1 - v / 0.35)
            : v,
        );
    }
    result.push(...parts);
  }
  return result;
}
