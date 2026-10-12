import JSZip from "jszip";
import { box, MeshBuilder } from "./mesh";
import { MeshData, MaterialSpec } from "./project";
import { EXPORT_PROFILE, serializeRWX, parseRWX } from "./rwx";
import { serializeAWG } from "./awg";
import { serializeVPPTSV } from "./groups";
import { encodePNG } from "./png";
import { sha256 } from "./textures";
/** Small independent probes; deliberately separate from the user's editable scene. Native verification is not implied. */
export async function createCalibrationKit(): Promise<Uint8Array> {
  const zip = new JSZip(),
    texture = "c3-calibration-checker",
    pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const color =
          y < 32
            ? x < 32
              ? [255, 45, 45]
              : [45, 255, 45]
            : x < 32
              ? [45, 45, 255]
              : [255, 220, 45],
        at = (y * 64 + x) * 4;
      pixels.set([...color, 255], at);
    }
  const png = encodePNG({ width: 64, height: 64, pixels });
  zip.file(`object-path/textures/${texture}.png`, png);
  const material: MaterialSpec = {
    role: "wall",
    color: "#ffffff",
    pattern: "solid",
    opacity: 1,
  };
  const fixtures: MeshData[] = [
    box(
      "c3-meter-origin",
      "1 metre cube at origin",
      [0, 0, 0],
      [1, 1, 1],
      "wall",
    ),
    box(
      "c3-meter-plus-1",
      "Same cube, 1 metre X displacement",
      [1, 0, 0],
      [1, 1, 1],
      "wall",
    ),
    box(
      "c3-meter-plus-10",
      "Same cube, 10 metre X displacement",
      [10, 0, 0],
      [1, 1, 1],
      "wall",
    ),
    box("c3-ten-metre-beam", "10 metre beam", [5, 0, -4], [10, 0.1, 1], "wall"),
    box("c3-axis-x", "X axis 3 metres", [1.5, 0, 5], [3, 0.15, 0.15], "wall"),
    box("c3-axis-y", "Y axis 2 metres", [0, 0, 5], [0.15, 2, 0.15], "wall"),
    box("c3-axis-z", "Z axis 1 metre", [0, 0, 5.5], [0.15, 0.15, 1], "wall"),
  ];
  const plane = new MeshBuilder();
  plane.face(
    [
      [-1, 0, 0],
      [1, 0, 0],
      [1, 2, 0],
      [-1, 2, 0],
    ],
    [0, 0, 1, 0, 1, 1, 0, 1],
  );
  fixtures.push(
    plane.build(
      "c3-front-plane",
      "Single sided plane: view from positive Z",
      "wall",
      "structure",
      false,
      [6, 0, 5],
    ),
  );
  const glass = box(
    "c3-opacity-probe",
    "35 percent opacity",
    [12, 0, 5],
    [1, 2, 0.1],
    "wall",
    "structure",
    false,
  );
  fixtures.push(glass);
  const hidden = box(
    "c3-invisible-solid",
    "Invisible solid cube",
    [16, 0, 5],
    [1, 2, 1],
    "wall",
  );
  hidden.action = "create visible off, solid on";
  fixtures.push(hidden);
  const nonsolid = box(
    "c3-visible-nonsolid",
    "Visible nonsolid cube",
    [20, 0, 5],
    [1, 2, 1],
    "wall",
    "structure",
    false,
  );
  fixtures.push(nonsolid);
  const placements = [];
  const models: Record<string, { path: string; hash: string }> = {};
  for (const fixture of fixtures) {
    const model = fixture.id.startsWith("c3-meter-")
        ? "c3-calibration-metre"
        : fixture.id + "-model",
      path = `object-path/models/${model}.rwx`,
      spec = {
        ...material,
        opacity: fixture.id === "c3-opacity-probe" ? 0.35 : 1,
        color:
          fixture.id === "c3-axis-x"
            ? "#ff4444"
            : fixture.id === "c3-axis-y"
              ? "#44ff44"
              : fixture.id === "c3-axis-z"
                ? "#4444ff"
                : "#ffffff",
      };
    if (!models[model]) {
      const text = serializeRWX(fixture, spec, texture);
      parseRWX(text, {
        id: fixture.id,
        label: fixture.label,
        origin: fixture.origin,
        solid: fixture.solid,
        category: fixture.category,
        material: fixture.material,
      });
      zip.file(path, text);
      models[model] = { path, hash: await sha256(text) };
    }
    placements.push({
      id: fixture.id,
      label: fixture.label,
      model,
      positionMeters: fixture.origin,
      solid: fixture.solid,
      action: fixture.action ?? `create solid ${fixture.solid ? "on" : "off"}`,
    });
  }
  zip.file(
    "c3-calibration-placements.json",
    JSON.stringify(placements, null, 2),
  );
  zip.file("c3-calibration.vp.tsv", serializeVPPTSV(placements));
  const awg = serializeAWG(
      placements.map((p) => ({
        model: p.model + ".rwx",
        description: p.label,
        position: p.positionMeters,
        action: p.action,
      })),
    ),
    group = new JSZip();
  group.file("c3-calibration.awg", awg);
  zip.file(
    "object-path/groups/c3-calibration.zip",
    await group.generateAsync({ type: "uint8array", compression: "DEFLATE" }),
  );
  zip.file("c3-calibration.awg", awg);
  zip.file(
    "c3-calibration-manifest.json",
    JSON.stringify(
      {
        purpose: "native coordinate, winding, UV, opacity and solidity probes",
        nativeVerified: false,
        profile: EXPORT_PROFILE,
        placementAdapters: {
          AWG: "candidate 100 units per metre",
          VPPTSV: "candidate 0.1 unit per metre",
        },
        groupPivotMeters: [0, 0, 0],
        models,
        texture: {
          path: `object-path/textures/${texture}.png`,
          hash: await sha256(png),
        },
      },
      null,
      2,
    ),
  );
  zip.file(
    "c3-calibration-instructions.md",
    `# Virtual Paradise native calibration kit\n\nThese are provisional probes, not a verified import profile. Use a disposable test parcel. Host models/textures on an object path, then place the models manually from the metre-coordinate table before trying either group/TSV adapter. Do not use both adapters on the same probe set.\n\nCheck the cube is 1 m and beam 10 m; separately check cube origins are displaced by 1 m and 10 m. The XYZ landmark has a 3 m red X bar, 2 m green Y bar and 1 m blue Z bar. Measure geometry scale separately from placement scale.\n\nThe single sided plane should be visible looking from positive Z and culled from negative Z. Its texture is red/green across the top image row, blue/yellow across the bottom. Record actual UV orientation. Check 35% opacity and walk into each visible/nonsolid and invisible/solid probe. The group has zero pivot. AWG and VPPTSV placement conversions are candidates until this import passes.\n\nRecord VP client/build, renderer, world/object-path settings, measured geometry and placement distances, winding/UV screenshots, opacity and collision observations, group selection/save/reimport behavior, and any errors. Save a native group and property dump without changing the objects so a reference fixture can be compared to these candidate bytes.\n`,
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
