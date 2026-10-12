import { Project, MeshData, Vec3, seedFor } from "./project";
import { MeshBuilder, box, beam } from "./mesh";
import { channelX, waterHeight, terrainHeight, terrainDomain } from "./terrain";
import { generatePlant } from "./plants";
import { generateRock } from "./geology";
import { cityPlan } from "./city";
export interface WaterNode {
  id: string;
  position: Vec3;
  kind: "stream" | "fall-up" | "fall-down";
}
export interface WaterGraph {
  nodes: WaterNode[];
  edges: { from: string; to: string }[];
}
export function waterGraph(p: Project): WaterGraph {
  const [, depth] = terrainDomain(p),
    fall = -p.depth / 2 - 3,
    zs: number[] = [];
  for (let z = -depth / 2 + 0.5; z < depth / 2 - 0.5; z += 0.7) zs.push(z);
  zs.push(depth / 2 - 0.5);
  if (p.effects.waterfall) zs.push(fall);
  zs.sort((a, b) => a - b);
  const nodes: WaterNode[] = [];
  for (const z of zs) {
    const x = channelX(p, z),
      y = waterHeight(p, z);
    if (p.effects.waterfall && Math.abs(z - fall) < 0.0001) {
      nodes.push({
        id: `water-${nodes.length}`,
        position: [x, y + 1.8, z],
        kind: "fall-up",
      });
      nodes.push({
        id: `water-${nodes.length}`,
        position: [x, y, z],
        kind: "fall-down",
      });
    } else
      nodes.push({
        id: `water-${nodes.length}`,
        position: [x, y, z],
        kind: "stream",
      });
  }
  return {
    nodes,
    edges: nodes
      .slice(1)
      .map((node, i) => ({ from: nodes[i].id, to: node.id })),
  };
}
export function buildEffects(p: Project): MeshData[] {
  if (!p.effects.creek) return [];
  const graph = waterGraph(p),
    parts: MeshData[] = [];
  let water = new MeshBuilder(),
    trail = new MeshBuilder(),
    chunk = 0;
  const flush = () => {
    if (!water.indices.length) return;
    const creek = water.build(
      `creek-water-${chunk}`,
      "Continuous creek and waterfall curtain",
      "water",
      "landscape",
      false,
    );
    const rebase = (mesh: MeshData) => {
      let minX = Infinity,
        maxX = -Infinity,
        minZ = Infinity,
        maxZ = -Infinity;
      for (let i = 0; i < mesh.positions.length; i += 3) {
        minX = Math.min(minX, mesh.positions[i]);
        maxX = Math.max(maxX, mesh.positions[i]);
        minZ = Math.min(minZ, mesh.positions[i + 2]);
        maxZ = Math.max(maxZ, mesh.positions[i + 2]);
      }
      const x = (minX + maxX) / 2,
        z = (minZ + maxZ) / 2;
      mesh.origin = [x, 0, z];
      mesh.positions = mesh.positions.map(
        (n, i) => n - (i % 3 === 0 ? x : i % 3 === 2 ? z : 0),
      );
      return mesh;
    };
    parts.push(rebase(creek));
    if (trail.indices.length) {
      const mesh = trail.build(
        `creek-trail-${chunk}`,
        "Connected bank trail",
        "path",
        "landscape",
        true,
      );
      mesh.surfaceMesh = true;
      mesh.walkable = true;
      parts.push(rebase(mesh));
    }
    chunk++;
    water = new MeshBuilder();
    trail = new MeshBuilder();
  };
  for (let i = 1; i < graph.nodes.length; i++) {
    const a = graph.nodes[i - 1].position,
      b = graph.nodes[i].position;
    water.face(
      [
        [b[0] - 1.19, b[1], b[2]],
        [b[0] + 1.19, b[1], b[2]],
        [a[0] + 1.19, a[1], a[2]],
        [a[0] - 1.19, a[1], a[2]],
      ],
      undefined,
      true,
    );
    if (p.effects.trail && Math.abs(b[2] - a[2]) > 0.001) {
      const x0 = a[0] - 2.85,
        x1 = b[0] - 2.85;
      trail.face([
        [x1 - 0.65, terrainHeight(p, x1 - 0.65, b[2]) + 0.012, b[2]],
        [x1 + 0.65, terrainHeight(p, x1 + 0.65, b[2]) + 0.012, b[2]],
        [x0 + 0.65, terrainHeight(p, x0 + 0.65, a[2]) + 0.012, a[2]],
        [x0 - 0.65, terrainHeight(p, x0 - 0.65, a[2]) + 0.012, a[2]],
      ]);
    }
    if (i % 8 === 0) flush();
  }
  flush();
  for (let i = 4; i < graph.nodes.length - 4; i += 7)
    for (const side of [-1, 1]) {
      const node = graph.nodes[i].position,
        x = node[0] + side * 2.05,
        z = node[2],
        family =
          p.biome === "arid" ? "grass" : p.biome === "alien" ? "agave" : "fern",
        plant = generatePlant(
          family,
          seedFor(p.seed, `bank-${i}-${side}`),
          0.45,
          p.plants,
        );
      for (const m of plant.meshes)
        parts.push({
          ...m,
          id: `bank-${i}-${side}-${m.id}`,
          origin: [x, terrainHeight(p, x, z), z],
          solid: false,
        });
    }
  if (p.effects.waterfall) {
    const fall = -p.depth / 2 - 3,
      cx = channelX(p, fall),
      low = waterHeight(p, fall),
      high = low + 1.8;
    for (const side of [-1, 1]) {
      const rock = generateRock(
        "fractured",
        seedFor(p.seed, `fall-rock-${side}`),
        0.7,
      );
      parts.push({
        ...rock,
        id: `fall-rock-${side}`,
        origin: [
          cx + side * 1.7,
          terrainHeight(p, cx + side * 1.7, fall) - 0.1,
          fall,
        ],
      });
    }
    for (let i = 0; i < 7; i++) {
      const m = new MeshBuilder(),
        x = cx + (i - 3) * 0.27;
      m.face(
        [
          [x - 0.035, 0, fall + 0.028],
          [x + 0.035, 0, fall + 0.028],
          [x + 0.035, 0.5, fall + 0.028],
          [x - 0.035, 0.5, fall + 0.028],
        ],
        undefined,
        true,
      );
      const streak = m.build(
        `fall-streak-${i}`,
        "Moving waterfall strand",
        "foam",
        "landscape",
        false,
        [0, low + (i % 3) * 0.5, 0],
      );
      if (p.effects.motion)
        streak.action = "create solid off, move 0 -0.5 0 time=0.9 loop reset";
      parts.push(streak);
    }
    for (let i = 0; i < 8; i++) {
      const x = cx + ((i % 4) - 1.5) * 0.48,
        z = fall + 0.2 + Math.floor(i / 4) * 0.42,
        m = new MeshBuilder();
      m.leaf([x, low + 0.015, z], [x + 0.35, low + 0.018, z + 0.25], 0.22, 0);
      parts.push(
        m.build(
          `fall-foam-${i}`,
          "Low polygon plunge foam",
          "foam",
          "landscape",
          false,
        ),
      );
    }
  }
  if (p.effects.bridge) {
    if (p.world.enabled) {
      const plan = cityPlan(p);
      const rows = [...new Set(plan.nodes.map((n) => n.z))];
      for (const z of rows) {
        const cx = channelX(p, z),
          top = 0.015;
        parts.push(
          box(
            `road-bridge-beam-${z}`,
            "Road bridge support beam",
            [cx, top - 0.3, z],
            [6.8, 0.22, p.world.roadWidth],
            "rock",
            "site",
            true,
          ),
        );
        for (const side of [-1, 1]) {
          const x = cx + side * 2.8,
            ground = terrainHeight(p, x, z),
            height = top - 0.08 - ground;
          if (height > 0.03)
            parts.push(
              box(
                `road-bridge-pier-${z}-${side}`,
                "Grounded bridge pier",
                [x, ground, z],
                [0.3, height, p.world.roadWidth - 0.4],
                "rock",
                "site",
                true,
              ),
            );
          parts.push(
            box(
              `road-bridge-rail-${z}-${side}`,
              "Bridge pavement guard",
              [
                cx,
                0.14,
                z +
                  side * (p.world.roadWidth / 2 + p.world.sidewalkWidth - 0.08),
              ],
              [6.8, 0.95, 0.07],
              "trim",
              "site",
              true,
            ),
          );
        }
      }
    } else {
      const [, depth] = terrainDomain(p),
        z = Math.min(depth / 2 - 2, p.depth / 2 + 4.6),
        cx = channelX(p, z),
        half = 3.3,
        left = cx - half,
        right = cx + half,
        deck =
          Math.max(
            terrainHeight(p, left, z),
            terrainHeight(p, right, z),
            waterHeight(p, z) + 0.4,
          ) + 0.08;
      for (let i = 0; i < 17; i++) {
        const x = left + ((i + 0.5) * (right - left)) / 17,
          m = box(
            `footbridge-plank-${i}`,
            "Footbridge deck plank",
            [x, deck - 0.14, z],
            [(right - left) / 17 - 0.012, 0.14, 1.65],
            "floor",
            "landscape",
            true,
          );
        m.walkable = true;
        parts.push(m);
      }
      for (const side of [-1, 1]) {
        parts.push(
          beam(
            `footbridge-stringer-${side}`,
            [left, deck - 0.18, z + side * 0.6],
            [right, deck - 0.18, z + side * 0.6],
            0.14,
            "trim",
            "landscape",
            false,
          ),
        );
        parts.push(
          box(
            `footbridge-rail-${side}`,
            "Bridge handrail",
            [cx, deck + 0.9, z + side * 0.77],
            [half * 2, 0.06, 0.06],
            "trim",
            "landscape",
            true,
          ),
        );
        for (let k = 0; k < 7; k++) {
          const x = left + (k * (right - left)) / 6;
          parts.push(
            box(
              `footbridge-post-${side}-${k}`,
              "Bridge rail post",
              [x, deck, z + side * 0.77],
              [0.06, 0.96, 0.06],
              "trim",
              "landscape",
              true,
            ),
          );
        }
      }
      for (const side of [-1, 1]) {
        const end = side < 0 ? left : right,
          out = end + side * 1.8,
          ground = terrainHeight(p, out, z),
          ramp = new MeshBuilder();
        ramp.face(
          [
            [out, ground + 0.008, z + 0.8],
            [end, deck, z + 0.8],
            [end, deck, z - 0.8],
            [out, ground + 0.008, z - 0.8],
          ],
          undefined,
          true,
        );
        const m = ramp.build(
          `footbridge-ramp-${side}`,
          "Graded bridge approach",
          "path",
          "landscape",
          true,
        );
        m.walkable = true;
        m.surfaceMesh = true;
        parts.push(m);
        const support = terrainHeight(p, end, z);
        if (deck - 0.14 > support)
          parts.push(
            box(
              `footbridge-abutment-${side}`,
              "Supported bridge abutment",
              [end, support, z],
              [0.25, deck - 0.14 - support, 1.55],
              "rock",
              "landscape",
              true,
            ),
          );
      }
    }
  }
  return parts;
}
