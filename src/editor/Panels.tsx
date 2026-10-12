import { createCalibrationKit } from "../core/calibration";
import { ChangeEvent, useState } from "react";
import {
  Box,
  ChevronDown,
  FileArchive,
  Folder,
  Layers3,
  Check,
  Upload,
  Download,
  AlertTriangle,
  Square,
  Home,
  Store,
  Trees,
  ArrowUpRight,
  RotateCcw,
} from "lucide-react";
import {
  createPortableProject,
  readPortableProject,
} from "../core/portable-project";
import { LandmarkStudio } from "./LandmarkStudio";
import { useStudio } from "./store";
import {
  THEMES,
  Theme,
  MaterialRole,
  preset,
  applyBuildingPreset,
  validateProject,
  BIOMES,
  Biome,
  Project,
  applyTheme,
} from "../core/project";
import { bounds } from "../core/geometry";
import { download, ExportScope } from "../core/package";
import { readTexture, textureImage } from "../core/textures";
import { materialsFor } from "../core/project";
export function Explorer() {
  const s = useStudio();
  return (
    <div className="panel-pad explorer">
      <div className="panel-eyebrow">PROJECT OUTLINE</div>
      <div className="tree-root">
        <ChevronDown size={13} />
        <Folder size={16} />
        {s.project.name}
      </div>
      {(
        [
          "structure",
          "windows",
          "roof",
          "interior",
          "site",
          "vegetation",
          "landscape",
        ] as const
      ).map((cat) => (
        <details open={cat === "structure" || cat === "interior"} key={cat}>
          <summary>
            <Layers3 size={14} />
            {cat}
            <span>{s.meshes.filter((m) => m.category === cat).length}</span>
          </summary>
          {s.meshes
            .filter((m) => m.category === cat)
            .map((m) => (
              <button
                className={`tree-item ${s.selected === m.id ? "selected" : ""}`}
                key={m.id}
                onClick={() => s.select(m.id)}
              >
                <Box size={12} />
                <span>{m.label}</span>
              </button>
            ))}
        </details>
      ))}
      <div className="panel-note">
        Select pieces here or directly in the 3D view. Drag pane tabs to
        rearrange the workspace.
      </div>
    </div>
  );
}
function Range({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
  unit = "m",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (n: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  return (
    <label className="range-field">
      <span>
        {label}
        <b>
          {(draft ?? value).toFixed(step < 1 ? 2 : 0)} {unit}
        </b>
      </span>
      <input
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={draft ?? value}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={() => {
          if (draft !== null) {
            onChange(draft);
            setDraft(null);
          }
        }}
        onKeyUp={() => {
          if (draft !== null) {
            onChange(draft);
            setDraft(null);
          }
        }}
        onBlur={() => {
          if (draft !== null) {
            onChange(draft);
            setDraft(null);
          }
        }}
      />
    </label>
  );
}
export function Properties() {
  const s = useStudio(),
    p = s.project,
    selected = s.meshes.find((m) => m.id === s.selected);
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">
        BUILDING RECIPE <span>v0.4</span>
      </div>
      <label className="field">
        Project name
        <input
          value={p.name}
          maxLength={80}
          onChange={(e) => s.update({ name: e.target.value })}
        />
      </label>
      <div className="form-section">Dimensions</div>
      <Range
        label="Width"
        value={p.width}
        min={4}
        max={18}
        onChange={(width) => s.update({ width })}
      />
      <Range
        label="Depth"
        value={p.depth}
        min={4}
        max={18}
        onChange={(depth) => s.update({ depth })}
      />
      <Range
        label="Ceiling height"
        value={p.height}
        min={2.6}
        max={5}
        onChange={(height) => s.update({ height })}
      />
      <Range
        label="Wall thickness"
        value={p.wallThickness}
        min={0.12}
        max={0.45}
        step={0.01}
        onChange={(wallThickness) => s.update({ wallThickness })}
      />
      <Range
        label="Door opening"
        value={p.doorWidth}
        min={0.9}
        max={2}
        onChange={(doorWidth) => s.update({ doorWidth })}
      />
      <div className="form-section">Structure & interior</div>
      <label className="field">
        Roof profile
        <select
          value={p.roof}
          onChange={(e) => s.update({ roof: e.target.value as typeof p.roof })}
        >
          <option value="flat">Flat roof</option>
          <option value="gable">Gable roof</option>
          <option value="shed">Shed roof</option>
          <option value="hip">Hip roof</option>
          <option value="none">Open sky</option>
        </select>
      </label>
      <label className="toggle-field">
        <input
          type="checkbox"
          checked={p.windows}
          onChange={(e) => s.update({ windows: e.target.checked })}
        />{" "}
        Real window openings
      </label>
      <label className="toggle-field">
        <input
          type="checkbox"
          checked={p.furnished}
          onChange={(e) => s.update({ furnished: e.target.checked })}
        />{" "}
        Basic interior furniture
      </label>
      {p.archetype === "shop" && (
        <label className="field">
          Shop sign
          <input
            value={p.sign}
            maxLength={40}
            onChange={(e) => s.update({ sign: e.target.value })}
          />
        </label>
      )}
      <div className="form-section">Generation</div>
      <label className="field">
        World seed
        <input
          type="number"
          value={p.seed}
          min={0}
          max={2147483647}
          onChange={(e) => {
            const seed = Number(e.target.value);
            if (Number.isInteger(seed) && seed >= 0 && seed <= 2147483647)
              s.update({ seed });
          }}
        />
      </label>
      <button
        className="small-button"
        onClick={() =>
          s.update({ seed: Math.floor(Math.random() * 2147483647) })
        }
      >
        <RotateCcw size={13} /> Generate another variation
      </button>
      {selected && (
        <>
          <div className="form-section">Selected piece</div>
          <div className="selection-card">
            <b>{selected.label}</b>
            <span>{selected.id}</span>
            <span>
              {selected.indices.length / 3} triangles · {selected.material}
            </span>
            <span>
              {selected.solid ? "Solid" : "Nonsolid"} · origin{" "}
              {selected.origin.map((n) => n.toFixed(2)).join(", ")} m
            </span>
          </div>
        </>
      )}
      <div className="panel-note">
        Architecture, biome, and plant controls live in the Themes and Plant
        Studio panes. Roof cutaway reveals the interior. Multi-storey editing
        remains on the roadmap.
      </div>
    </div>
  );
}
export function Presets() {
  const s = useStudio();
  return (
    <div className="panel-pad">
      <div className="panel-eyebrow">START SOMETHING GOOD</div>
      {(
        [
          {
            type: "shop",
            icon: Store,
            title: "Corner shop",
            text: "A storefront, sign slot, and working interior.",
          },
          {
            type: "house",
            icon: Home,
            title: "Garden house",
            text: "A home with a bedroom partition, furnished living space and a theme-specific exterior.",
          },
          {
            type: "villa",
            icon: Square,
            title: "Garden villa",
            text: "A larger home with a terrace, pergola and distinct living and sleeping spaces.",
          },
          {
            type: "flats",
            icon: Layers3,
            title: "Apartment building",
            text: "Three residential levels, common stairs and furnished units.",
          },
          {
            type: "mixed",
            icon: Store,
            title: "Retail + apartments",
            text: "Separate retail access and upper residential circulation.",
          },
        ] as const
      ).map(({ type, icon: Icon, title, text }) => (
        <button
          key={type}
          className={`preset-card ${s.project.archetype === type ? "selected" : ""}`}
          onClick={() => {
            s.replace(applyBuildingPreset(s.project, type));
            s.notify(
              `${title} structural recipe loaded. World edits and uploaded assets retained; Undo restores the previous building.`,
            );
          }}
        >
          <Icon size={23} />
          <div>
            <b>{title}</b>
            <p>{text}</p>
          </div>
          <ArrowUpRight size={16} />
        </button>
      ))}
      <p className="panel-note">
        Kennedy House is reference-pending. Its layout will be added when a
        specific plan, image or existing model is available.
      </p>
      <div className="form-section">World theme</div>
      <div className="theme-picker">
        {Object.entries(THEMES).map(([id, t]) => (
          <button
            key={id}
            onClick={() => s.update(applyTheme(s.project, id as Theme))}
            className={s.project.theme === id ? "selected" : ""}
          >
            <i style={{ background: t.palette.wall }} />
            <span>{t.label}</span>
            {s.project.theme === id && <Check size={14} />}
          </button>
        ))}
      </div>
      <div className="panel-note">
        <Trees size={15} /> Each theme applies an architectural kit and matching
        biome. Open Themes to mix architecture and environment independently.
      </div>
    </div>
  );
}
export function Materials() {
  const s = useStudio(),
    specs = materialsFor(s.project),
    [role, setRole] = useState<MaterialRole>("wall"),
    [uploading, setUploading] = useState(false);
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const asset = await readTexture(file);
      s.update((current) => ({
        textures: { ...current.textures, [role]: asset },
      }));
      s.notify(
        `${asset.name} assigned to ${role} and included in project/export.`,
      );
    } catch (err) {
      s.notify((err as Error).message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="panel-pad">
      <div className="panel-eyebrow">SURFACE LIBRARY</div>
      <label className="field">
        Material tint
        <input
          type="color"
          value={specs[role].color}
          onChange={(e) =>
            s.update({
              materialOptions: {
                ...s.project.materialOptions,
                [role]: {
                  color: e.target.value,
                  roughness: specs[role].roughness ?? 0.84,
                  metalness: specs[role].metalness ?? 0,
                  opacity: specs[role].opacity,
                  scale: specs[role].scale ?? 1,
                },
              },
            })
          }
        />
      </label>
      {(["roughness", "metalness", "opacity", "scale"] as const).map((key) => (
        <label className="field" key={key}>
          {key === "scale" ? "Texture tile size (m)" : key}
          <input
            type="number"
            min={key === "scale" ? 0.1 : key === "opacity" ? 0.03 : 0}
            max={key === "scale" ? 10 : 1}
            step={0.05}
            value={specs[role][key] ?? 1}
            onChange={(e) =>
              s.update({
                materialOptions: {
                  ...s.project.materialOptions,
                  [role]: {
                    color: specs[role].color,
                    roughness: specs[role].roughness ?? 0.84,
                    metalness: specs[role].metalness ?? 0,
                    opacity: specs[role].opacity,
                    scale: specs[role].scale ?? 1,
                    [key]: Number(e.target.value),
                  },
                },
              })
            }
          />
        </label>
      ))}
      <label className="field">
        Default surfaces
        <select
          value={s.project.surfaceSource}
          onChange={(e) =>
            s.update({
              surfaceSource: e.target.value as "standard" | "procedural",
            })
          }
        >
          <option value="standard">CC0 library + procedural detail</option>
          <option value="procedural">Fully procedural</option>
        </select>
      </label>
      <p className="muted small">
        {s.project.surfaceSource === "standard"
          ? s.assetStatus
          : "Deterministic patterns from your world seed"}
      </p>
      <div className="material-grid">
        {(Object.keys(specs) as MaterialRole[]).map((r) => (
          <button
            key={r}
            className={r === role ? "selected" : ""}
            onClick={() => setRole(r)}
          >
            <div
              style={{
                backgroundColor: specs[r].color,
                backgroundImage: `url(${textureImage(specs[r], s.project)})`,
                backgroundBlendMode: s.project.textures[r]
                  ? "normal"
                  : "multiply",
              }}
            />
            {r}
          </button>
        ))}
      </div>
      <div className="form-section">{role} material</div>
      <div
        className="material-preview"
        style={{
          backgroundColor: specs[role].color,
          backgroundImage: `url(${textureImage(specs[role], s.project)})`,
          backgroundBlendMode: s.project.textures[role] ? "normal" : "multiply",
        }}
      />
      <p className="muted small">
        {s.project.textures[role]
          ? s.project.textures[role]!.name
          : s.project.surfaceSource === "standard"
            ? "CC0 library / generated surface"
            : "Original seeded procedural pattern"}
      </p>
      <label className="small-button upload-button">
        <Upload size={14} />
        {uploading ? "Processing image…" : "Upload your own texture"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={upload}
        />
      </label>
      {s.project.textures[role] && (
        <button
          className="small-button"
          onClick={() => {
            const textures = { ...s.project.textures };
            delete textures[role];
            s.update({ textures });
          }}
        >
          Restore default material
        </button>
      )}
      <div className="panel-note">
        PNG, JPG, or WebP · up to 8 MB. Images are normalized to PNG, at most
        1024 px, and embedded in saved projects and RWX packages. Uploaded
        surfaces retain their own colours.
      </div>
      <div className="form-section">Enhanced material maps</div>
      {(["normal", "roughness", "metalness", "emissive"] as const).map(
        (kind) => (
          <label className="small-button full upload-button" key={kind}>
            {kind} map ·{" "}
            {s.project.materialMaps[role]?.[kind]?.name ?? "Upload"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  const asset = await readTexture(file);
                  s.update((current) => ({
                    materialMaps: {
                      ...current.materialMaps,
                      [role]: {
                        normalConvention: "opengl",
                        ...current.materialMaps[role],
                        [kind]: asset,
                      },
                    },
                  }));
                } catch (error) {
                  s.notify((error as Error).message);
                }
              }}
            />
          </label>
        ),
      )}
      <label className="field">
        Normal convention
        <select
          value={s.project.materialMaps[role]?.normalConvention ?? "opengl"}
          onChange={(e) =>
            s.update({
              materialMaps: {
                ...s.project.materialMaps,
                [role]: {
                  ...s.project.materialMaps[role],
                  normalConvention: e.target.value as "opengl" | "directx",
                },
              },
            })
          }
        >
          <option value="opengl">OpenGL +Y</option>
          <option value="directx">DirectX −Y</option>
        </select>
      </label>
      <p className="panel-note">
        Enhanced maps are saved in the editable project and package. The classic
        RWX preview uses diffuse colour and opacity; PBR shading is not
        certified for native VP.
      </p>
    </div>
  );
}
export function FloorPlan() {
  const s = useStudio(),
    [activeLevel, setActiveLevel] = useState(0),
    p = s.renderProject,
    levels = p.world.enabled
      ? Math.max(1, ...s.meshes.map((m) => (m.level ?? 0) + 1))
      : p.structure.storeys,
    padding = 2,
    w = p.world.enabled
      ? Math.max(
          ...s.meshes.map((m) =>
            Math.max(Math.abs(bounds(m).min[0]), Math.abs(bounds(m).max[0])),
          ),
        ) *
          2 +
        padding * 2
      : p.width + padding * 2,
    d = p.world.enabled
      ? Math.max(
          ...s.meshes.map((m) =>
            Math.max(Math.abs(bounds(m).min[2]), Math.abs(bounds(m).max[2])),
          ),
        ) *
          2 +
        padding * 2
      : p.depth + padding * 2;
  return (
    <div className="floorplan">
      <div className="panel-eyebrow">
        LEVEL {Math.min(activeLevel, levels - 1) + 1}{" "}
        <span>{(p.width * p.depth).toFixed(1)} m² footprint</span>
      </div>
      <select
        aria-label="Plan level"
        value={Math.min(activeLevel, levels - 1)}
        onChange={(e) => setActiveLevel(Number(e.target.value))}
      >
        {Array.from({ length: levels }, (_, i) => (
          <option key={i} value={i}>
            Level {i + 1}
          </option>
        ))}
      </select>
      <button
        className="small-button full"
        onClick={() => {
          s.setInspectionLevel(Math.min(activeLevel, levels - 1));
          s.setCutaway(true);
          s.setMode("orbit");
        }}
      >
        Inspect this floor in 3D
      </button>
      <svg
        viewBox={`${-w / 2} ${-d / 2} ${w} ${d}`}
        aria-label="Generated floor plan with true openings"
      >
        {s.meshes
          .filter(
            (m) =>
              m.category !== "roof" &&
              m.id !== "site-ground" &&
              m.id !== "shop-sign" &&
              m.category !== "vegetation" &&
              m.category !== "landscape",
          )
          .filter((m) => (m.level ?? 0) === Math.min(activeLevel, levels - 1))
          .map((m) => {
            const b = bounds(m),
              fill =
                m.id === "building-floor"
                  ? "#ebebe0"
                  : m.category === "interior"
                    ? "#c0d2be"
                    : m.material === "glass"
                      ? "#9cd7de"
                      : m.category === "windows"
                        ? "#527364"
                        : "#39483f";
            return (
              <rect
                key={m.id}
                x={b.min[0]}
                y={-b.max[2]}
                width={b.max[0] - b.min[0]}
                height={b.max[2] - b.min[2]}
                fill={s.selected === m.id ? "#9adf61" : fill}
                stroke={s.selected === m.id ? "#3a8028" : "none"}
                strokeWidth={0.04}
                onClick={() => s.select(m.id)}
              >
                <title>{m.label}</title>
              </rect>
            );
          })}
        {!p.world.enabled &&
          p.rooms
            .filter((room) => room.level === Math.min(activeLevel, levels - 1))
            .map((room) => (
              <g
                key={room.id}
                onClick={() => s.select(room.id)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={room.x - room.width / 2}
                  y={-room.z - room.depth / 2}
                  width={room.width}
                  height={room.depth}
                  fill={s.selected === room.id ? "#add89933" : "transparent"}
                  stroke={s.selected === room.id ? "#397c3a" : "none"}
                  strokeWidth={0.05}
                />
                <text
                  x={room.x}
                  y={-room.z}
                  textAnchor="middle"
                  fontSize={0.22}
                  fill="#365143"
                >
                  {room.name}
                </text>
              </g>
            ))}
        <text
          x={0}
          y={-p.depth / 2 - 0.6}
          textAnchor="middle"
          fontSize={0.3}
          fill="#66736b"
        >
          {p.width.toFixed(1)} m
        </text>
        <text
          x={p.width / 2 + 0.35}
          y={0}
          textAnchor="middle"
          fontSize={0.3}
          fill="#66736b"
          transform={`rotate(90 ${p.width / 2 + 0.35} 0)`}
        >
          {p.depth.toFixed(1)} m
        </text>
        <text
          x={0}
          y={p.depth / 2 + 1}
          textAnchor="middle"
          fontSize={0.24}
          fill="#66736b"
        >
          ENTRANCE ↓
        </text>
      </svg>
      <div className="panel-note">
        Plan and 3D share the same generated pieces. Click a footprint to
        inspect it.
      </div>
    </div>
  );
}
export function ExportPanel() {
  const [scope, setScope] = useState<ExportScope>("all"),
    [members, setMembers] = useState(128),
    [extent, setExtent] = useState(40),
    [triangles, setTriangles] = useState(30000),
    [strict, setStrict] = useState(false);
  const s = useStudio(),
    settings = {
      scope,
      selected: s.selected ? [s.selected] : [],
      groupBudget: { members, horizontalExtent: extent, triangles },
      rejectOversize: strict,
    },
    downloadZip = async () => {
      const b = await s.prepareExport("canonical", settings);
      if (b)
        download(
          "c3-world-package.zip",
          Uint8Array.from(b.bytes).buffer,
          "application/zip",
        );
    };
  return (
    <div className="panel-pad">
      <div className="export-heading">
        <FileArchive size={26} />
        <div>
          <h3>Take your creation with you.</h3>
          <p>Geometry, textures, placements, and project.</p>
        </div>
      </div>
      <div className="compatibility-note">
        <AlertTriangle size={16} />
        <span>
          <b>VP profile · provisional</b>
          <br />
          Browser round-trip supported. Native VP compatibility and AWG import
          are pending.
        </span>
      </div>
      <label className="field">
        Export scope
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as ExportScope)}
        >
          <option value="all">Entire generated scene</option>
          <option value="building">Building structures and interiors</option>
          <option value="environment">Site and environment</option>
          <option value="selected">Selected mesh or authored room</option>
        </select>
      </label>
      <details>
        <summary>Application group budgets</summary>
        <p className="muted small">
          These are your partitioning budgets, not verified native client
          limits. Bounds include geometry and motion.
        </p>
        <label className="field">
          Objects per group
          <input
            type="number"
            min={1}
            max={1024}
            value={members}
            onChange={(e) => setMembers(Number(e.target.value))}
          />
        </label>
        <label className="field">
          Horizontal extent (m)
          <input
            type="number"
            min={10}
            max={1000}
            value={extent}
            onChange={(e) => setExtent(Number(e.target.value))}
          />
        </label>
        <label className="field">
          Triangles per group
          <input
            type="number"
            min={100}
            max={1000000}
            step={100}
            value={triangles}
            onChange={(e) => setTriangles(Number(e.target.value))}
          />
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={strict}
            onChange={(e) => setStrict(e.target.checked)}
          />
          Reject individually oversized meshes
        </label>
      </details>
      <button
        className="btn accent full"
        disabled={s.busy}
        onClick={downloadZip}
      >
        <Download size={16} />
        {s.busy ? "Building package…" : "Download RWX package"}
      </button>
      {s.exportStatus && (
        <p className="muted small" role="status">
          {s.exportStatus}
        </p>
      )}
      {s.busy && (
        <button className="small-button full" onClick={s.cancelExport}>
          Cancel package build
        </button>
      )}
      <button
        className="small-button full"
        disabled={s.busy}
        onClick={async () => {
          const b = await s.prepareExport("canonical", settings);
          if (b) {
            s.setView("export");
            s.setMode("orbit");
          }
        }}
      >
        <Layers3 size={15} />
        Rebuild & inspect exported files
      </button>
      <button
        className="small-button full"
        disabled={s.busy || s.generating}
        onClick={async () => {
          const b = await s.prepareExport("awg-probe", settings);
          if (b) {
            s.setView("export");
            s.setMode("orbit");
            s.notify(
              "Preview reconstructed from experimental zipped AWG records. Native units and import remain unverified.",
            );
          }
        }}
      >
        Inspect experimental AWG group files
      </button>
      {s.bundle && (
        <>
          <div className="export-stats">
            <div>
              <b>{s.bundle.modelCount}</b>
              <span>unique models</span>
            </div>
            <div>
              <b>{s.bundle.textureCount}</b>
              <span>textures</span>
            </div>
            <div>
              <b>{Math.round(s.bundle.bytes.byteLength / 1024)}</b>
              <span>KB package</span>
            </div>
          </div>
          <details className="file-list">
            <summary>Package files · {s.bundle.files.length}</summary>
            {s.bundle.files.map((f) => (
              <div key={f}>{f}</div>
            ))}
          </details>
        </>
      )}
      <button
        className="small-button full"
        onClick={async () => {
          try {
            const bytes = await createCalibrationKit();
            download(
              "c3-native-calibration.zip",
              Uint8Array.from(bytes).buffer,
              "application/zip",
            );
            s.notify(
              "Native calibration kit saved. Its import profiles remain provisional until measured in the VP client.",
            );
          } catch (error) {
            s.notify((error as Error).message);
          }
        }}
      >
        Download native scale / winding / texture probes
      </button>
      <div className="form-section">Portable project</div>
      <button
        className="small-button full"
        onClick={() =>
          download(
            "c3-world.c3world.json",
            JSON.stringify(s.project, null, 2),
            "application/json",
          )
        }
      >
        <Download size={14} /> Save editable project
      </button>
      <button
        className="small-button full"
        onClick={async () => {
          try {
            const bytes = await createPortableProject(s.project);
            download(
              "c3-world.c3world.zip",
              Uint8Array.from(bytes).buffer,
              "application/zip",
            );
            s.notify(
              "Portable project saved with deduplicated textures, PBR maps and sign artwork.",
            );
          } catch (error) {
            s.notify((error as Error).message);
          }
        }}
      >
        Save asset-deduplicated project ZIP
      </button>
      <label className="small-button full upload-button">
        <Upload size={14} /> Open project
        <input
          type="file"
          accept=".json,.c3world,.zip"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (file.name.toLowerCase().endsWith(".zip")) {
                if (file.size > 100_000_000)
                  throw new Error("Project ZIP exceeds 100 MB.");
                s.replace(
                  await readPortableProject(
                    new Uint8Array(await file.arrayBuffer()),
                  ),
                );
              } else {
                if (file.size > 15_000_000)
                  throw new Error(
                    "JSON project exceeds 15 MB. Use the asset-deduplicated project ZIP for larger projects.",
                  );
                s.replace(validateProject(JSON.parse(await file.text())));
              }
              s.notify("Project opened. Embedded textures restored.");
            } catch (err) {
              s.notify(`Could not open project: ${(err as Error).message}`);
            }
          }}
        />
      </label>
      <div className="panel-note">
        The export view reparses the emitted RWX and packaged PNGs. Placement
        JSON is our canonical format, not a native AWG file.
      </div>
    </div>
  );
}
export function Diagnostics() {
  const s = useStudio();
  return (
    <div className="diagnostics">
      <div>
        <Check size={14} />
        <b>{s.meshes.length} generated pieces</b>
        <span> · true door/window apertures · finite geometry</span>
      </div>
      <div>
        <Check size={14} />
        <b>Portable materials</b>
        <span> · original procedural textures and embedded custom PNGs</span>
      </div>
      <div className="warning">
        <AlertTriangle size={14} />
        <b>Native target checks pending</b>
        <span> · VP scale, face winding, transparency, collision, and AWG</span>
      </div>
      <div>
        <span className="log-time">NOW</span>
        {s.notice}
      </div>
    </div>
  );
}

const THEME_DETAILS: Record<Theme, string> = {
  temperate: "Brick shopfronts, fabric awnings, broadleaf trees and conifers.",
  desert:
    "Light plaster, parapets, shaded terraces and sparse arid vegetation.",
  jungle:
    "Raised timber verandas, deep rain canopies, palms, buttress trees and ferns.",
  fantasy:
    "Exposed timber, steep gables, stone chimneys, old woodland and fungi.",
  scifi:
    "Habitat frames, service modules, entry canopies and alien fan plants.",
};
export function ThemesPanel() {
  const s = useStudio(),
    p = s.project;
  return (
    <div className="panel-pad themes-panel">
      <div className="panel-eyebrow">WORLD THEMES</div>
      <p className="muted small">
        Architecture, plants and ground designed together. Select a scene, then
        mix its components below.
      </p>
      {(Object.entries(THEMES) as [Theme, (typeof THEMES)[Theme]][]).map(
        ([id, t]) => (
          <button
            key={id}
            className={`world-theme-card ${p.theme === id ? "selected" : ""}`}
            onClick={() => {
              s.update(applyTheme(p, id));
              s.notify(
                `${t.label} architecture and biome applied. Uploaded textures are preserved.`,
              );
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}scenes/c3-${id}.webp`}
              alt={`${t.label} generated building and vegetation`}
              loading="lazy"
            />
            <span>
              <b>{t.label}</b>
              <small>{THEME_DETAILS[id]}</small>
            </span>
          </button>
        ),
      )}
      <div className="form-section">Mix architecture & environment</div>
      <label className="field">
        Architecture
        <select
          value={p.theme}
          onChange={(e) => s.update({ theme: e.target.value as Theme })}
        >
          {Object.entries(THEMES).map(([id, t]) => (
            <option key={id} value={id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Biome
        <select
          value={p.biome}
          onChange={(e) => s.update({ biome: e.target.value as Biome })}
        >
          {Object.entries(BIOMES).map(([id, b]) => (
            <option key={id} value={id}>
              {b.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small">{BIOMES[p.biome].description}</p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={p.architectureDetails}
          onChange={(e) => s.update({ architectureDetails: e.target.checked })}
        />{" "}
        Architectural details
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={p.landscape.enabled}
          onChange={(e) =>
            s.update({
              landscape: { ...p.landscape, enabled: e.target.checked },
            })
          }
        />{" "}
        Surrounding landscape
      </label>
      <Range
        label="Parcel margin"
        value={p.landscape.extent}
        min={6}
        max={18}
        step={1}
        onChange={(extent) =>
          s.update({ landscape: { ...p.landscape, extent } })
        }
      />
      <Range
        label="Ground relief"
        value={p.landscape.relief}
        min={0}
        max={2}
        step={0.1}
        onChange={(relief) =>
          s.update({ landscape: { ...p.landscape, relief } })
        }
      />
      {p.biome === "arid" && (
        <label className="field">
          Desert ecology
          <select
            value={p.landscape.aridRecipe}
            onChange={(e) =>
              s.update({
                landscape: {
                  ...p.landscape,
                  aridRecipe: e.target
                    .value as Project["landscape"]["aridRecipe"],
                },
              })
            }
          >
            <option value="scrub">Dry scrub & acacia</option>
            <option value="succulent">Succulent desert</option>
            <option value="oasis">Oasis vegetation</option>
          </select>
        </label>
      )}
      <div className="panel-note">
        Your building dimensions, interior settings and uploaded surfaces
        survive theme changes. The same generated geometry is included in the
        RWX package.
      </div>
    </div>
  );
}
export function PlantStudio() {
  const s = useStudio(),
    p = s.project,
    plants = s.meshes.filter((m) => m.category === "vegetation");
  const families = new Map<string, number>();
  for (const m of plants) {
    const family = m.label.split(" · ")[0];
    families.set(family, (families.get(family) ?? 0) + m.indices.length / 3);
  }
  return (
    <div className="panel-pad">
      <div className="panel-eyebrow">PLANT STUDIO</div>
      <h3>{BIOMES[p.biome].label}</h3>
      <p className="muted small">
        {BIOMES[p.biome].description} Real mesh leaves and branches, generated
        from your world seed.
      </p>
      <Range
        label="Vegetation density"
        value={p.landscape.density * 100}
        min={0}
        max={100}
        step={5}
        unit="%"
        onChange={(density) =>
          s.update({ landscape: { ...p.landscape, density: density / 100 } })
        }
      />
      <Range
        label="Plant growth scale"
        value={p.landscape.plantScale}
        min={0.6}
        max={1.5}
        step={0.05}
        unit="×"
        onChange={(plantScale) =>
          s.update({ landscape: { ...p.landscape, plantScale } })
        }
      />
      <label className="check-field">
        <input
          type="checkbox"
          checked={p.landscape.foliage}
          onChange={(e) =>
            s.update({
              landscape: { ...p.landscape, foliage: e.target.checked },
            })
          }
        />{" "}
        Show leaves and fronds
      </label>
      <p className="muted small">
        Hide foliage to inspect root, trunk and branch connections. This setting
        also affects the exported package.
      </p>
      <div className="form-section">Growth recipe</div>
      <label className="field">
        Branch generator
        <select
          value={p.plants.algorithm}
          onChange={(e) =>
            s.update({
              plants: {
                ...p.plants,
                algorithm: e.target.value as typeof p.plants.algorithm,
              },
            })
          }
        >
          <option value="rules">Species branching rules</option>
          <option value="attraction">Space attraction crown</option>
        </select>
      </label>
      <label className="field">
        Growth stage
        <select
          value={p.plants.age}
          onChange={(e) =>
            s.update({
              plants: {
                ...p.plants,
                age: e.target.value as typeof p.plants.age,
              },
            })
          }
        >
          <option value="sapling">Sapling</option>
          <option value="mature">Mature</option>
          <option value="old">Old</option>
        </select>
      </label>
      <label className="field">
        Mesh quality
        <select
          value={p.plants.quality}
          onChange={(e) =>
            s.update({
              plants: {
                ...p.plants,
                quality: e.target.value as typeof p.plants.quality,
              },
            })
          }
        >
          <option value="full">Full leaves and branch rings</option>
          <option value="economy">Economy mesh</option>
        </select>
      </label>
      {(
        [
          ["height", "Height"],
          ["crown", "Crown spread"],
          ["trunk", "Trunk thickness"],
          ["lean", "Trunk lean"],
          ["leafDensity", "Leaf density"],
        ] as const
      ).map(([key, label]) => (
        <Range
          key={key}
          label={label}
          value={p.plants[key]}
          min={key === "lean" ? -0.25 : key === "leafDensity" ? 0.2 : 0.5}
          max={key === "lean" ? 0.25 : key === "leafDensity" ? 1 : 1.8}
          step={0.05}
          unit="×"
          onChange={(value) =>
            s.update({ plants: { ...p.plants, [key]: value } })
          }
        />
      ))}
      <div className="form-section">Prune branch families</div>
      <p className="muted small">
        Toggle stable branch IDs. Rules prune a main limb; attraction prunes its
        descendants. These controls affect woody broadleaf families.
      </p>
      <div className="button-row">
        {Array.from({ length: 24 }, (_, id) => (
          <button
            key={id}
            aria-pressed={p.plants.pruned.includes(id)}
            onClick={() =>
              s.update({
                plants: {
                  ...p.plants,
                  pruned: p.plants.pruned.includes(id)
                    ? p.plants.pruned.filter((n) => n !== id)
                    : [...p.plants.pruned, id],
                },
              })
            }
          >
            {p.plants.pruned.includes(id) ? "× " : ""}
            {id}
          </button>
        ))}
      </div>
      <LandmarkStudio />
      <div className="form-section">Generated families</div>
      {[...families].map(([family, triangles]) => (
        <div className="plant-family-row" key={family}>
          <Trees size={16} />
          <span>{family.replaceAll("-", " ")}</span>
          <b>{triangles.toLocaleString()} tris</b>
        </div>
      ))}
      <div className="panel-note">
        {plants.reduce((n, m) => n + m.indices.length / 3, 0).toLocaleString()}{" "}
        plant triangles · {plants.length} mesh pieces. Foliage is nonsolid; main
        trunks retain collision. Entrances and approach paths have placement
        exclusions.
      </div>
      <div className="panel-note">
        Growth, pruning and economy mesh settings are saved and exported.
        Landmark pins retain individual growth snapshots. Custom species recipe
        authoring remains pending.
      </div>
    </div>
  );
}
