import { Vec3, random } from "./project";
export interface GrowthNode {
  position: Vec3;
  parent: number | null;
}
export function colonize(
  seed: number,
  height: number,
  crown: number,
  guide?: Vec3[],
): GrowthNode[] {
  const rng = random(seed),
    nodes: GrowthNode[] = Array.from({ length: 4 }, (_, i) => ({
      position: guide?.[i] ?? [0, height * (0.38 + i * 0.12), 0],
      parent: i ? i - 1 : null,
    })),
    targets: Vec3[] = [];
  for (let i = 0; i < 160; i++) {
    const azimuth = rng() * Math.PI * 2,
      vertical = rng() * 2 - 1,
      radius = Math.sqrt(1 - vertical * vertical) * Math.pow(rng(), 1 / 3);
    targets.push([
      Math.cos(azimuth) * crown * radius,
      height * 0.72 + vertical * height * 0.27,
      Math.sin(azimuth) * crown * radius,
    ]);
  }
  let remaining = targets;
  for (
    let iteration = 0;
    iteration < 70 && nodes.length < 240 && remaining.length;
    iteration++
  ) {
    const influence = new Map<number, Vec3[]>(),
      next: Vec3[] = [];
    for (const target of remaining) {
      let closest = -1,
        distance = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i].position,
          d = Math.hypot(target[0] - n[0], target[1] - n[1], target[2] - n[2]);
        if (d < distance) {
          closest = i;
          distance = d;
        }
      }
      if (distance < 0.36) continue;
      next.push(target);
      if (distance < 3.5 && closest >= 0) {
        const vectors = influence.get(closest) ?? [],
          n = nodes[closest].position;
        vectors.push([
          (target[0] - n[0]) / distance,
          (target[1] - n[1]) / distance,
          (target[2] - n[2]) / distance,
        ]);
        influence.set(closest, vectors);
      }
    }
    remaining = next;
    let grown = 0;
    for (const [parent, directions] of influence) {
      if (nodes.length >= 240) break;
      const sum: Vec3 = [0, 0.035, 0];
      for (const direction of directions)
        for (let a = 0; a < 3; a++) sum[a] += direction[a];
      const length = Math.hypot(...sum);
      if (length < 1e-8) continue;
      const origin = nodes[parent].position,
        position = origin.map(
          (v, a) => Math.round((v + (sum[a] / length) * 0.32) * 1e6) / 1e6,
        ) as Vec3;
      if (
        nodes.some(
          (n) =>
            Math.hypot(
              n.position[0] - position[0],
              n.position[1] - position[1],
              n.position[2] - position[2],
            ) < 0.12,
        )
      )
        continue;
      nodes.push({ parent, position });
      grown++;
    }
    if (!grown) break;
  }
  return nodes;
}
