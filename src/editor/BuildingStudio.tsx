import { useState } from "react";
import { useStudio } from "./store";
import { buildingTopology, floorElevation, stairPlan } from "../core/building";
import { Project, applyBuildingPreset } from "../core/project";
export function BuildingStudio() {
  const s = useStudio(),
    p = s.project,
    [level, setLevel] = useState(0);
  const change = (patch: Partial<Project["structure"]>) =>
    s.update({ structure: { ...p.structure, ...patch } });
  const graph = buildingTopology(p);
  let stairs;
  try {
    stairs = stairPlan(p);
  } catch {}
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">BUILDING & CIRCULATION</div>
      {["house", "villa"].includes(p.archetype) && (
        <label className="field">
          Footprint
          <select
            value={p.structure.footprint}
            onChange={(e) =>
              s.update({
                width: Math.max(12, p.width),
                depth: Math.max(10, p.depth),
                roof: e.target.value === "rectangle" ? p.roof : "hip",
                structure: {
                  ...p.structure,
                  footprint: e.target
                    .value as Project["structure"]["footprint"],
                },
              })
            }
          >
            <option value="rectangle">Rectangle</option>
            <option value="l">Connected L wings</option>
            <option value="u">U-shaped courtyard</option>
            <option value="courtyard">Enclosed courtyard</option>
          </select>
        </label>
      )}
      <label className="field">
        Building template
        <select
          value={p.archetype}
          onChange={(e) =>
            s.replace(
              applyBuildingPreset(p, e.target.value as Project["archetype"]),
            )
          }
        >
          <option value="shop">Shop</option>
          <option value="house">House</option>
          <option value="villa">Villa</option>
          <option value="flats">Apartment building</option>
          <option value="mixed">Shop + apartments</option>
        </select>
      </label>
      <label className="field">
        Storeys
        <input
          type="number"
          min={1}
          max={6}
          value={p.structure.storeys}
          onChange={(e) =>
            s.update({
              width: Math.max(7, p.width),
              depth: Math.max(8, p.depth),
              structure: { ...p.structure, storeys: Number(e.target.value) },
            })
          }
        />
      </label>
      <label className="field">
        Stair arrangement
        <select
          value={p.structure.stair}
          onChange={(e) =>
            change({ stair: e.target.value as "u" | "straight" })
          }
        >
          <option value="u">U-shaped, turning landing</option>
          <option value="straight">Straight flight</option>
        </select>
      </label>
      {stairs && p.structure.storeys > 1 && (
        <p className="panel-note">
          {stairs.first + stairs.second} risers ·{" "}
          {(stairs.riser * 100).toFixed(1)} cm rise ·{" "}
          {(stairs.tread * 100).toFixed(0)} cm tread. Required void:{" "}
          {(stairs.x1 - stairs.x0).toFixed(2)} ×{" "}
          {(stairs.z1 - stairs.z0).toFixed(2)} m.
        </p>
      )}
      <label className="field">
        Saved door angle
        <input
          type="range"
          min={0}
          max={100}
          value={p.structure.doorAngle}
          onChange={(e) =>
            change({ doorAngle: Number(e.target.value), doorPoses: {} })
          }
        />
        <span>{p.structure.doorAngle}° · exported static pose</span>
      </label>
      <p className="panel-note">
        In Walk mode, press E near a door. Simulation poses reset when leaving
        Walk mode. A door cannot close through the player.
      </p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={p.structure.balcony}
          onChange={(e) => change({ balcony: e.target.checked })}
        />
        Upper balconies
      </label>
      <label className="field">
        Interior
        <select
          value={p.structure.interior}
          onChange={(e) =>
            change({ interior: e.target.value as "shell" | "furnished" })
          }
        >
          <option value="shell">Walkable shell</option>
          <option value="furnished">Furnished</option>
        </select>
      </label>
      <div className="form-section">Linked window family</div>
      {(
        [
          ["windowWidth", "Width", 0.4, 3],
          ["windowHeight", "Height", 0.4, 2],
          ["windowSill", "Sill", 0.4, 1.5],
        ] as const
      ).map(([key, label, min, max]) => (
        <label className="field" key={key}>
          {label}
          <input
            type="number"
            step={0.1}
            min={min}
            max={max}
            value={p.structure[key]}
            onChange={(e) => change({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <div className="form-section">Room connectivity</div>
      <label className="field">
        Level
        <select
          value={Math.min(level, p.structure.storeys - 1)}
          onChange={(e) => setLevel(Number(e.target.value))}
        >
          {Array.from({ length: p.structure.storeys }, (_, i) => (
            <option key={i} value={i}>
              Level {i + 1} · {floorElevation(p, i).toFixed(2)} m
            </option>
          ))}
        </select>
      </label>
      {graph.rooms
        .filter((r) => r.level === Math.min(level, p.structure.storeys - 1))
        .map((r) => (
          <div className="plant-row" key={r.id}>
            <b>{r.name}</b>
            <small>
              {
                graph.connections.filter(
                  (c) => c.from === r.id || c.to === r.id,
                ).length
              }{" "}
              connections
            </small>
          </div>
        ))}
    </div>
  );
}
