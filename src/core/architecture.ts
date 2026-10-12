import { MeshData, Project, Vec3 } from "./project";
import { box, beam, MeshBuilder } from "./mesh";
export function decorateBuilding(p: Project, source: MeshData[]): MeshData[] {
  const parts = source;
  const lift = p.architectureDetails && p.theme === "jungle" ? 0.6 : 0;
  if (lift)
    for (const m of parts)
      if (m.category !== "site")
        m.origin = [m.origin[0], m.origin[1] + lift, m.origin[2]];
  for (const m of parts)
    if (m.id === "building-floor" || m.id === "entry-step") m.walkable = true;
  const w = p.width,
    d = p.depth,
    h = p.height,
    y = 0.16 + lift;
  const add = (
    id: string,
    label: string,
    origin: Vec3,
    size: Vec3,
    material: MeshData["material"],
    category: MeshData["category"] = "structure",
    solid = true,
    walkable = false,
  ) => {
    const m = box(id, label, origin, size, material, category, solid);
    if (walkable) m.walkable = true;
    parts.push(m);
    return m;
  };
  if (!p.architectureDetails) return parts;
  // Plinth and cornice preserve every existing door/window aperture.
  for (const side of [-1, 1]) {
    add(
      `plinth-side-${side}`,
      "Stone foundation course",
      [side * (w / 2 + 0.04), lift, 0],
      [0.14, 0.44, d],
      "rock",
    );
    add(
      `fascia-side-${side}`,
      "Eave fascia",
      [side * (w / 2 + 0.08), y + h - 0.16, 0],
      [0.18, 0.2, d + 0.25],
      "trim",
      "roof",
      false,
    );
    const span = (w - p.doorWidth) / 2;
    add(
      `plinth-front-${side}`,
      "Split entry plinth",
      [side * (p.doorWidth / 2 + span / 2), lift, d / 2 + 0.04],
      [span - 0.04, 0.34, 0.14],
      "rock",
    );
  }
  add(
    "fascia-front",
    "Front roof fascia",
    [0, y + h - 0.16, d / 2 + 0.08],
    [w + 0.3, 0.2, 0.18],
    "trim",
    "roof",
    false,
  );
  add(
    "plinth-back",
    "Rear stone foundation",
    [0, lift, -d / 2 - 0.035],
    [w, 0.35, 0.14],
    "rock",
  );
  if (p.theme === "jungle") {
    const z0 = d / 2 - 0.1,
      z1 = d / 2 + 2.2,
      frontY = y + Math.max(2.4, h - 0.8),
      backY = y + Math.max(2.5, h - 0.35);
    add(
      "veranda-deck",
      "Raised timber veranda",
      [0, lift - 0.04, d / 2 + 0.9],
      [w + 1, 0.2, 2.25],
      "floor",
      "structure",
      true,
      true,
    );
    // Four supported risers, with a clear route aligned to the actual front door.
    for (let i = 0; i < 4; i++) {
      const top = (4 - i) * 0.19;
      add(
        `veranda-step-${i}`,
        "Veranda stair tread",
        [0, -0.02, d / 2 + 2.2 + i * 0.43],
        [p.doorWidth + 0.6, top + 0.02, 0.45],
        "floor",
        "structure",
        true,
        true,
      );
    }
    for (const x of [-w / 2 - 0.3, w / 2 + 0.3]) {
      for (const z of [d / 2 + 1.75, -d / 2]) {
        const top =
          z > 0
            ? frontY + ((backY - frontY) * (z1 - z)) / (z1 - z0) - 0.15
            : y + h + 0.12;
        add(
          `pier-${x}-${z}`,
          "Supported veranda pier",
          [x, -0.03, z],
          [0.22, top + 0.03, 0.22],
          "trim",
        );
      }
      add(
        `veranda-rail-${x}`,
        "Veranda side rail",
        [x, y + 0.82, d / 2 + 0.75],
        [0.12, 0.12, 1.9],
        "trim",
        "structure",
        false,
      );
    }
    for (let x = -w / 2; x <= w / 2; x += 1.2)
      add(
        `stilts-${x}`,
        "Deck support footing",
        [x, -0.08, d / 2 + 1.4],
        [0.2, lift + 0.1, 0.2],
        "rock",
      );
    const canopy = new MeshBuilder();
    canopy.face(
      [
        [-w / 2 - 0.65, backY, z0],
        [w / 2 + 0.65, backY, z0],
        [w / 2 + 0.65, frontY, z1],
        [-w / 2 - 0.65, frontY, z1],
      ],
      undefined,
      true,
    );
    parts.push(
      canopy.build("veranda-canopy", "Deep rain canopy", "roof", "roof"),
    );
    for (const x of [-w / 2 - 0.3, w / 2 + 0.3])
      parts.push(
        beam(
          `veranda-rafter-${x}`,
          [x, backY - 0.1, z0],
          [x, frontY - 0.1, z1],
          0.1,
          "trim",
          "roof",
          false,
        ),
      );
    add(
      "veranda-fascia",
      "Canopy fascia beam",
      [0, frontY - 0.15, z1],
      [w + 1.3, 0.15, 0.12],
      "trim",
      "roof",
      false,
    );
    const sign = parts.find((m) => m.id === "shop-sign");
    if (sign) sign.origin = [0, frontY - 0.55, z1 + 0.09];
    // Facade posts and window shutters use natural timber, independent of jungle foliage.
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1])
      add(
        `timber-corner-${x}`,
        "Timber corner post",
        [x, y, d / 2 + 0.08],
        [0.15, h, 0.14],
        "trim",
      );
    if (p.windows)
      for (const side of [-1, 1])
        for (let i = 0; i < 5; i++)
          add(
            `window-shade-${side}-${i}`,
            "Side window sun shade",
            [side * (w / 2 + 0.09), y + 1.08 + i * 0.23, 0],
            [0.16, 0.065, 2.15],
            "trim",
            "windows",
            false,
          );
  } else if (p.theme === "desert") {
    if (p.roof !== "none")
      for (const side of [-1, 1]) {
        add(
          `parapet-x-${side}`,
          "Plaster parapet",
          [side * (w / 2 - 0.1), y + h + 0.25, 0],
          [0.2, 0.42, d],
          "wall",
          "roof",
        );
        add(
          `parapet-z-${side}`,
          "Plaster parapet",
          [0, y + h + 0.25, side * (d / 2 - 0.1)],
          [w, 0.42, 0.2],
          "wall",
          "roof",
        );
      }
    const patioDepth = p.archetype === "villa" ? 3 : 1.9;
    const sign = parts.find((m) => m.id === "shop-sign");
    if (sign) {
      sign.origin = [0, 2.2, d / 2 + patioDepth + 0.06];
      for (const x of [-Math.min(w * 0.3, 1.5), Math.min(w * 0.3, 1.5)])
        parts.push(
          beam(
            `sign-hanger-${x}`,
            [x, 2.66, sign.origin[2]],
            [x, 2.86, d / 2 + patioDepth - 0.15],
            0.025,
            "trim",
            "structure",
            false,
          ),
        );
    }
    add(
      "courtyard-paving",
      "Stone courtyard terrace",
      [0, -0.01, d / 2 + patioDepth / 2],
      [w + 0.8, 0.13, patioDepth],
      "path",
      "structure",
      true,
      true,
    );
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) {
      add(
        `shade-pier-${x}`,
        "Courtyard shade pier",
        [x, 0.12, d / 2 + patioDepth - 0.15],
        [0.28, 2.7, 0.28],
        "wall",
      );
      parts.push(
        beam(
          `shade-side-${x}`,
          [x, 2.84, d / 2 - 0.1],
          [x, 2.84, d / 2 + patioDepth + 0.2],
          0.1,
          "trim",
          "roof",
          false,
        ),
      );
    }
    parts.push(
      beam(
        "shade-crossbeam",
        [-w / 2, 2.82, d / 2 + patioDepth - 0.15],
        [w / 2, 2.82, d / 2 + patioDepth - 0.15],
        0.11,
        "trim",
        "roof",
        false,
      ),
    );
    for (let x = -w / 2; x < w / 2; x += 0.42)
      add(
        `shade-slat-${x}`,
        "Pergola shade slat",
        [x, 2.95, d / 2 + patioDepth / 2],
        [0.09, 0.08, patioDepth + 0.6],
        "trim",
        "roof",
        false,
      );
    // Two narrow ventilating masonry screens stand beside, never across, the entry.
    for (const side of [-1, 1])
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 3; col++)
          add(
            `screen-${side}-${row}-${col}`,
            "Courtyard screen brick",
            [side * (w / 2 + 0.35), 0.2 + row * 0.3, d / 2 + 0.3 + col * 0.4],
            [0.2, 0.15, 0.3],
            "wall",
            "structure",
            false,
          );
  } else if (p.theme === "fantasy") {
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1])
      add(
        `frame-upright-${x}`,
        "Exposed timber frame",
        [x, y, d / 2 + 0.065],
        [0.17, h, 0.17],
        "trim",
      );
    for (const z of [-d / 2 + 0.15, d / 2 - 0.15])
      for (const side of [-1, 1]) {
        add(
          `frame-side-${side}-${z}`,
          "Side wall timber upright",
          [side * (w / 2 + 0.04), y, z],
          [0.14, h, 0.16],
          "trim",
        );
        parts.push(
          beam(
            `frame-brace-${side}-${z}`,
            [side * (w / 2 + 0.065), y + 0.45, z],
            [side * (w / 2 + 0.065), y + 1.9, z + (z < 0 ? 1.25 : -1.25)],
            0.07,
            "trim",
            "structure",
            false,
          ),
        );
      }
    if (p.roof !== "none") {
      const rise = Math.min(3.2, w * 0.35);
      for (const side of [-1, 1])
        parts.push(
          beam(
            `gable-frame-${side}`,
            [side * (w / 2 + 0.35), y + h + 0.1, d / 2 + 0.37],
            [0, y + h + 0.12 + rise, d / 2 + 0.37],
            0.1,
            "trim",
            "roof",
            false,
          ),
        );
      add(
        "chimney",
        "Stone chimney",
        [w / 2 - 1, y + h, -d / 2 + 1.1],
        [0.8, rise + 0.65, 0.85],
        "rock",
        "roof",
      );
      add(
        "chimney-cap",
        "Chimney cap",
        [w / 2 - 1, y + h + rise + 0.65, -d / 2 + 1.1],
        [1, 0.15, 1.05],
        "trim",
        "roof",
      );
    }
  } else if (p.theme === "scifi") {
    const sign = parts.find((m) => m.id === "shop-sign");
    if (sign) {
      sign.origin = [0, 2.2, d / 2 + 1.45];
      for (const x of [-1, 1])
        parts.push(
          beam(
            `sign-hanger-${x}`,
            [x, 2.66, sign.origin[2]],
            [x, y + 2.7, d / 2 + 1.35],
            0.025,
            "trim",
            "structure",
            false,
          ),
        );
    }
    for (const side of [-1, 1])
      for (const z of [-d / 2 + 0.3, d / 2 - 0.3]) {
        parts.push(
          beam(
            `habitat-frame-${side}-${z}`,
            [side * (w / 2 + 0.48), 0.05, z],
            [side * (w / 2 + 0.12), y + h + 0.12, z],
            0.16,
            "trim",
            "structure",
            true,
          ),
        );
        add(
          `habitat-inlay-${side}-${z}`,
          "Service frame inlay",
          [side * (w / 2 + 0.32), 0.55, z + 0.18],
          [0.07, h * 0.6, 0.04],
          "accent",
          "structure",
          false,
        );
      }
    if (p.roof !== "none") {
      add(
        "plant-room",
        "Roof service module",
        [-w * 0.22, y + h + 0.35, -d * 0.2],
        [w * 0.28, 0.6, d * 0.32],
        "trim",
        "roof",
      );
      for (let i = 0; i < 6; i++)
        add(
          `service-fin-${i}`,
          "Service module cooling fin",
          [-w * 0.22 + (i - 2.5) * 0.15, y + h + 0.97, -d * 0.2],
          [0.045, 0.15, d * 0.27],
          "accent",
          "roof",
          false,
        );
      add(
        "solar-array",
        "Roof panel array",
        [w * 0.21, y + h + 0.34, -d * 0.12],
        [w * 0.25, 0.13, d * 0.6],
        "roof",
        "roof",
      );
    }
    add(
      "entry-canopy",
      "Cantilever entry canopy",
      [0, y + 2.7, d / 2 + 0.6],
      [Math.min(w - 1, 4.5), 0.18, 1.6],
      "trim",
      "roof",
      false,
    );
    add(
      "canopy-light",
      "Entry light strip",
      [0, y + 2.68, d / 2 + 1.35],
      [Math.min(w - 1, 4.3), 0.025, 0.05],
      "accent",
      "roof",
      false,
    );
  }
  if (
    p.theme === "temperate" &&
    (p.archetype === "shop" || p.archetype === "mixed")
  ) {
    add(
      "shop-awning",
      "Shopfront awning",
      [0, 2.5, d / 2 + 0.7],
      [w - 0.35, 0.11, 1.65],
      "fabric",
      "roof",
      false,
    );
    add(
      "awning-valance",
      "Awning valance",
      [0, 2.27, d / 2 + 1.47],
      [w - 0.35, 0.25, 0.06],
      "trim",
      "roof",
      false,
    );
    for (const x of [-w / 2 + 0.4, w / 2 - 0.4])
      parts.push(
        beam(
          `awning-bracket-${x}`,
          [x, 2.1, d / 2 + 0.1],
          [x, 2.5, d / 2 + 1.4],
          0.035,
          "trim",
          "roof",
          false,
        ),
      );
  }
  if (p.archetype === "villa" && p.theme !== "jungle" && p.theme !== "desert") {
    add(
      "villa-terrace",
      "Broad villa terrace",
      [0, -0.01, d / 2 + 1.4],
      [w + 2, 0.16, 3.1],
      "path",
      "structure",
      true,
      true,
    );
    for (const side of [-1, 1]) {
      add(
        `villa-terrace-post-${side}`,
        "Terrace pergola column",
        [side * (w / 2 + 0.7), 0.15, d / 2 + 2.65],
        [0.24, 2.7, 0.24],
        "trim",
      );
      parts.push(
        beam(
          `villa-pergola-beam-${side}`,
          [side * (w / 2 + 0.7), 2.85, d / 2 - 0.2],
          [side * (w / 2 + 0.7), 2.85, d / 2 + 2.85],
          0.12,
          "trim",
          "roof",
          false,
        ),
      );
    }
    parts.push(
      beam(
        "villa-pergola-front",
        [-w / 2 - 0.7, 2.86, d / 2 + 2.65],
        [w / 2 + 0.7, 2.86, d / 2 + 2.65],
        0.12,
        "trim",
        "roof",
        false,
      ),
    );
    for (let x = -w / 2 - 0.65; x <= w / 2 + 0.65; x += 0.6)
      add(
        `villa-pergola-slat-${x}`,
        "Terrace pergola slat",
        [x, 2.98, d / 2 + 1.4],
        [0.08, 0.1, 3.1],
        "trim",
        "roof",
        false,
      );
  }
  // Real partition with an open 1.2 m passage; furnishing is split into living/sleeping zones.
  if (p.archetype !== "shop" && p.archetype !== "mixed" && w >= 7 && d >= 7) {
    const span = (w - 2 * p.wallThickness - 1.2) / 2,
      z = -d * 0.12;
    for (const side of [-1, 1])
      add(
        `room-partition-${side}`,
        "Bedroom partition",
        [side * (0.6 + span / 2), y, z],
        [span, h, 0.12],
        "wall",
      );
    add(
      "room-partition-lintel",
      "Bedroom doorway lintel",
      [0, y + 2.25, z],
      [1.2, h - 2.25, 0.12],
      "wall",
    );
    for (const side of [-1, 1])
      add(
        `room-door-frame-${side}`,
        "Bedroom door jamb",
        [side * 0.63, y, z],
        [0.06, 2.25, 0.17],
        "trim",
      );
  }
  if (p.furnished) {
    // Replace block furniture with supported tops, cushions, backs, and individual legs.
    for (let i = parts.length - 1; i >= 0; i--)
      if (parts[i].category === "interior") parts.splice(i, 1);
    const furniture = (
      id: string,
      origin: Vec3,
      size: Vec3,
      mat: MeshData["material"] = "floor",
    ) => add(id, id.replaceAll("-", " "), origin, size, mat, "interior");
    const table = (
      id: string,
      x: number,
      z: number,
      tw: number,
      td: number,
      th = 0.76,
    ) => {
      furniture(id + "-top", [x, y + th, z], [tw, 0.07, td]);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          furniture(
            `${id}-leg-${sx}-${sz}`,
            [x + sx * (tw / 2 - 0.1), y, z + sz * (td / 2 - 0.1)],
            [0.065, th, 0.065],
            "trim",
          );
    };
    if (p.archetype === "shop" || p.archetype === "mixed") {
      furniture(
        "counter-base",
        [w / 2 - 1.05, y, -0.55],
        [1, 0.9, Math.min(3, d * 0.4)],
        "trim",
      );
      furniture(
        "counter-top",
        [w / 2 - 1.05, y + 0.9, -0.55],
        [1.1, 0.075, Math.min(3, d * 0.4) + 0.12],
        "path",
      );
      for (let row = 0; row < 4; row++) {
        furniture(
          `display-shelf-${row}`,
          [-w / 2 + p.wallThickness + 0.35, y + 0.35 + row * 0.48, -0.45],
          [0.65, 0.07, Math.min(3, d * 0.45)],
        );
        for (let item = 0; item < 5; item++)
          furniture(
            `display-product-${row}-${item}`,
            [
              -w / 2 + p.wallThickness + 0.35,
              y + 0.42 + row * 0.48,
              -1.4 + item * 0.46,
            ],
            [0.25, 0.17 + (item % 3) * 0.08, 0.22],
            item % 2 ? "fabric" : "accent",
          );
      }
      table("display-table", 0, -d / 2 + 1.05, Math.min(1.8, w * 0.35), 0.7);
    } else {
      const bx = -w / 2 + 1.35,
        bz = -d / 2 + 1.5;
      furniture("bed-frame", [bx, y, bz], [1.8, 0.28, 2.25], "trim");
      furniture(
        "bed-mattress",
        [bx, y + 0.28, bz],
        [1.72, 0.2, 2.15],
        "fabric",
      );
      furniture("bed-headboard", [bx, y, bz - 1.12], [1.9, 1, 0.08], "trim");
      for (const side of [-1, 1])
        furniture(
          `bed-pillow-${side}`,
          [bx + side * 0.42, y + 0.48, bz - 0.72],
          [0.64, 0.12, 0.42],
          "fabric",
        );
      furniture(
        "sofa-base",
        [w / 2 - 0.85, y, d * 0.18],
        [1.1, 0.28, 2.1],
        "trim",
      );
      furniture(
        "sofa-back",
        [w / 2 - 0.36, y + 0.28, d * 0.18],
        [0.17, 0.58, 2.1],
        "fabric",
      );
      for (let i = 0; i < 3; i++)
        furniture(
          `sofa-cushion-${i}`,
          [w / 2 - 0.88, y + 0.28, d * 0.18 + (i - 1) * 0.66],
          [0.85, 0.18, 0.62],
          "fabric",
        );
      if (w >= 7) {
        table("dining-table", -w / 2 + 1.4, d / 2 - 1.65, 1.35, 0.82);
        for (const side of [-1, 1]) {
          const x = -w / 2 + 1.4,
            z = d / 2 - 1.65 + side * 0.82;
          furniture(
            `chair-seat-${side}`,
            [x, y + 0.45, z],
            [0.43, 0.06, 0.43],
            "trim",
          );
          furniture(
            `chair-back-${side}`,
            [x, y + 0.45, z + side * 0.2],
            [0.43, 0.4, 0.055],
            "trim",
          );
          for (const a of [-1, 1])
            for (const b of [-1, 1])
              furniture(
                `chair-leg-${side}-${a}-${b}`,
                [x + a * 0.17, y, z + b * 0.17],
                [0.04, 0.45, 0.04],
                "trim",
              );
        }
      }
    }
  }
  return parts;
}
