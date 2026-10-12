import { useState } from "react";
import { useStudio } from "./store";
import { TerrainSettings, GroundOperation, GroundLayer } from "../core/project";
import { terrainDomain, terrainHeight, terrainField } from "../core/terrain";
export function TerrainStudio() {
  const s = useStudio(),
    p = s.project,
    [kind, setKind] = useState<GroundOperation["kind"]>("paint"),
    [layer, setLayer] = useState<GroundLayer>("grass"),
    [radius, setRadius] = useState(3),
    [strength, setStrength] = useState(0.7),
    [width, depth] = terrainDomain(p),
    change = (patch: Partial<TerrainSettings>) =>
      s.update({ terrain: { ...p.terrain, ...patch } }),
    field = terrainField(p);
  let min = Infinity,
    max = -Infinity;
  for (const y of field.heights) {
    min = Math.min(min, y);
    max = Math.max(max, y);
  }
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">OWNED TERRAIN</div>
      <label className="field">
        Landform
        <select
          value={p.terrain.form}
          onChange={(e) =>
            change({ form: e.target.value as TerrainSettings["form"] })
          }
        >
          {["plain", "hills", "ridge", "basin", "terraces"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {(
        [
          ["amplitude", "Elevation amplitude", 0, 12, 0.1],
          ["wavelength", "Feature wavelength", 10, 80, 1],
          ["direction", "Ridge direction", 0, 180, 5],
          ["erosion", "Erosion / talus passes", 0, 20, 1],
          ["texelsPerMeter", "Bake pixels per meter", 8, 32, 4],
        ] as const
      ).map(([key, label, min, max, step]) => (
        <label className="field" key={key}>
          {label}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={p.terrain[key]}
            onChange={(e) => change({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <label className="field">
        Rock geology
        <select
          value={p.terrain.geology}
          onChange={(e) =>
            change({ geology: e.target.value as TerrainSettings["geology"] })
          }
        >
          {["boulder", "fractured", "stratified", "columnar"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={p.terrain.splats}
          onChange={(e) => change({ splats: e.target.checked })}
        />
        Blend and bake ground layers
      </label>
      <p className="panel-note">
        {width.toFixed(1)} × {depth.toFixed(1)} m · elevation {min.toFixed(2)}–
        {max.toFixed(2)} m. Building pads and streets are graded after regional
        erosion. Surface paint is saved separately from landforms.
      </p>
      <div className="form-section">Sculpt & paint map</div>
      <label className="field">
        Brush
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as GroundOperation["kind"])}
        >
          {["paint", "raise", "lower", "flatten"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Layer
        <select
          value={layer}
          onChange={(e) => setLayer(e.target.value as GroundLayer)}
        >
          {["grass", "soil", "rock", "sand"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Radius (m)
        <input
          type="number"
          min={0.5}
          max={20}
          step={0.5}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
        />
      </label>
      <label className="field">
        Strength / flatten elevation
        <input
          type="number"
          min={0}
          max={5}
          step={0.1}
          value={strength}
          onChange={(e) => setStrength(Number(e.target.value))}
        />
      </label>
      <svg
        viewBox={`${-width / 2} ${-depth / 2} ${width} ${depth}`}
        style={{ width: "100%", cursor: "crosshair" }}
        aria-label="Terrain brush map"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect(),
            x = ((e.clientX - rect.left) / rect.width) * width - width / 2,
            z = depth / 2 - ((e.clientY - rect.top) / rect.height) * depth;
          s.update({
            terrain: {
              ...p.terrain,
              splats: kind === "paint" || p.terrain.splats,
              edits: [
                ...p.terrain.edits,
                {
                  id: `edit-${Date.now()}`,
                  x,
                  z,
                  radius,
                  strength,
                  kind,
                  layer,
                  locked: true,
                },
              ],
            },
          });
        }}
      >
        {Array.from({ length: 24 * 24 }, (_, i) => {
          const x = i % 24,
            z = Math.floor(i / 24),
            xx = -width / 2 + (x * width) / 24,
            zz = -depth / 2 + (z * depth) / 24,
            y = terrainHeight(p, xx, zz),
            light =
              40 +
              Math.max(
                0,
                Math.min(40, ((y - min) / Math.max(0.1, max - min)) * 40),
              );
          return (
            <rect
              key={i}
              x={xx}
              y={-zz - depth / 24}
              width={width / 24 + 0.02}
              height={depth / 24 + 0.02}
              fill={`hsl(90 16% ${light}%)`}
            />
          );
        })}
        {p.terrain.edits.map((edit) => (
          <circle
            key={edit.id}
            cx={edit.x}
            cy={-edit.z}
            r={edit.radius}
            fill="none"
            stroke={edit.kind === "paint" ? "#ceef80" : "#edb469"}
            strokeWidth={0.1}
          />
        ))}
      </svg>
      <p className="panel-note">
        Click the map to commit one brush operation. Undo restores edits; seed
        changes retain committed paint and sculpt operations. Painting uses
        ordinary baked PNGs in RWX.
      </p>
      {p.terrain.edits.map((edit) => (
        <div className="plant-row" key={edit.id}>
          <span>
            {edit.kind} · {edit.layer}
          </span>
          <button
            className="small-button"
            onClick={() =>
              change({ edits: p.terrain.edits.filter((v) => v.id !== edit.id) })
            }
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
