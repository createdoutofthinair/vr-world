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
import { useStudio } from "./store";
import {
  THEMES,
  Theme,
  MaterialRole,
  preset,
  validateProject,
  BIOMES,
  Biome,
  Project,
  applyTheme,
} from "../core/project";
import { bounds } from "../core/geometry";
import { download } from "../core/package";
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
        BUILDING RECIPE <span>v0.2</span>
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
        ] as const
      ).map(({ type, icon: Icon, title, text }) => (
        <button
          key={type}
          className={`preset-card ${s.project.archetype === type ? "selected" : ""}`}
          onClick={() => {
            s.replace(preset(type, s.project.theme));
            s.notify(
              `${title} recipe loaded. Undo restores the previous project.`,
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
      s.update({ textures: { ...s.project.textures, [role]: asset } });
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
    </div>
  );
}
export function FloorPlan() {
  const s = useStudio(),
    p = s.project,
    padding = 2,
    w = p.width + padding * 2,
    d = p.depth + padding * 2;
  return (
    <div className="floorplan">
      <div className="panel-eyebrow">
        GROUND FLOOR <span>{(p.width * p.depth).toFixed(1)} m² footprint</span>
      </div>
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
  const s = useStudio(),
    downloadZip = async () => {
      const b = await s.prepareExport();
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
      <button
        className="btn accent full"
        disabled={s.busy}
        onClick={downloadZip}
      >
        <Download size={16} />
        {s.busy ? "Building package…" : "Download RWX package"}
      </button>
      <button
        className="small-button full"
        disabled={s.busy}
        onClick={async () => {
          const b = await s.prepareExport();
          if (b) {
            s.setView("export");
            s.setMode("orbit");
          }
        }}
      >
        <Layers3 size={15} />
        Rebuild & inspect exported files
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
      <label className="small-button full upload-button">
        <Upload size={14} /> Open project
        <input
          type="file"
          accept=".json,.c3world"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (file.size > 15_000_000)
                throw new Error("Project file exceeds 15 MB.");
              s.replace(validateProject(JSON.parse(await file.text())));
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
              src={`${import.meta.env.BASE_URL}scenes/c3-${id}.png`}
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
        Pruning, editable branch graphs and custom species recipes are later
        Plant Studio steps.
      </div>
    </div>
  );
}
