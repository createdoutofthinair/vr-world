import { useState } from "react";
import { buildLandmarks } from "../core/landmarks";
import { terrainDomain } from "../core/terrain";
import { useStudio } from "./store";
import {
  PLANT_FAMILIES,
  PlantFamilyName,
  PlantLandmark,
} from "../core/project";
export function LandmarkStudio() {
  const s = useStudio(),
    p = s.project,
    [family, setFamily] = useState<PlantFamilyName>("shrub"),
    [x, setX] = useState(p.width / 2 + Math.min(3, p.landscape.extent * 0.5)),
    [z, setZ] = useState(-p.depth / 2 - Math.min(3, p.landscape.extent * 0.5)),
    [scale, setScale] = useState(1),
    [seed, setSeed] = useState(42);
  const change = (id: string, patch: Partial<PlantLandmark>) =>
    s.update((current) => ({
      plantLandmarks: current.plantLandmarks.map((pin) =>
        pin.id === id ? { ...pin, ...patch } : pin,
      ),
    }));
  return (
    <div>
      <div className="form-section">Individual landmark plants</div>
      <p className="muted small">
        Pins preserve position and variant when the world seed changes. Lock a
        pin to retain its growth recipe. Bounds, buildings and paths produce a
        conflict instead of silently clipping it.
      </p>
      <label className="field">
        Species
        <select
          value={family}
          onChange={(e) => setFamily(e.target.value as PlantFamilyName)}
        >
          {PLANT_FAMILIES.map((key) => (
            <option key={key} value={key}>
              {key.replaceAll("-", " ")}
            </option>
          ))}
        </select>
      </label>
      {(
        [
          ["World X (m)", x, setX],
          ["World Z (m)", z, setZ],
          ["Scale", scale, setScale],
        ] as const
      ).map(([label, value, set]) => (
        <label className="field" key={label}>
          {label}
          <input
            type="number"
            value={value}
            min={label === "Scale" ? 0.2 : -200}
            max={label === "Scale" ? 3 : 200}
            step={0.1}
            onChange={(e) => set(Number(e.target.value))}
          />
        </label>
      ))}
      <label className="field">
        New plant variant seed
        <input
          type="number"
          min={0}
          max={2147483647}
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value))}
        />
      </label>
      <button
        className="small-button"
        onClick={() => setSeed((seed + 104729) % 2147483647)}
      >
        Next variant
      </button>
      <button
        className="small-button full"
        disabled={s.generating}
        onClick={() => {
          const [width, depth] = terrainDomain(p),
            sites: [number, number][] = [];
          for (let xx = -width / 2 + 1; xx < width / 2; xx += 2)
            for (let zz = -depth / 2 + 1; zz < depth / 2; zz += 2)
              sites.push([xx, zz]);
          sites.sort(
            (a, b) =>
              Math.hypot(a[0] - x, a[1] - z) - Math.hypot(b[0] - x, b[1] - z),
          );
          for (const [xx, zz] of sites) {
            try {
              buildLandmarks(
                {
                  ...p,
                  plantLandmarks: [
                    {
                      id: "landmark-probe",
                      family,
                      seed,
                      x: xx,
                      z: zz,
                      scale,
                      locked: true,
                      recipe: p.plants,
                    },
                  ],
                },
                s.meshes,
              );
              setX(xx);
              setZ(zz);
              s.notify(
                "Found clear ground for this exact family, variant and growth recipe.",
              );
              return;
            } catch {}
          }
          s.notify(
            "No clear site found. Reduce scale, expand the parcel or choose another family.",
          );
        }}
      >
        Find clear ground
      </button>
      <button
        className="small-button full"
        disabled={p.plantLandmarks.length >= 100}
        onClick={() =>
          s.update((current) => ({
            plantLandmarks: [
              ...current.plantLandmarks,
              {
                id: "landmark-" + crypto.randomUUID(),
                family,
                seed,
                x,
                z,
                scale,
                locked: true,
                recipe: structuredClone(current.plants),
              },
            ],
          }))
        }
      >
        Pin a procedural plant
      </button>
      {p.plantLandmarks.map((pin) => (
        <details key={pin.id}>
          <summary>
            {pin.family} · {pin.x.toFixed(1)}, {pin.z.toFixed(1)} ·{" "}
            {pin.locked ? "locked" : "global growth"}
          </summary>
          <label className="field">
            X (m)
            <input
              type="number"
              min={-200}
              max={200}
              step={0.1}
              value={pin.x}
              onChange={(e) => change(pin.id, { x: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Z (m)
            <input
              type="number"
              min={-200}
              max={200}
              step={0.1}
              value={pin.z}
              onChange={(e) => change(pin.id, { z: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            Scale
            <input
              type="number"
              min={0.2}
              max={3}
              step={0.1}
              value={pin.scale}
              onChange={(e) =>
                change(pin.id, { scale: Number(e.target.value) })
              }
            />
          </label>
          <label className="field">
            Variant seed
            <input
              type="number"
              min={0}
              max={2147483647}
              value={pin.seed}
              onChange={(e) => change(pin.id, { seed: Number(e.target.value) })}
            />
          </label>
          <button
            className="small-button"
            onClick={() =>
              change(pin.id, {
                locked: !pin.locked,
                recipe: pin.locked ? pin.recipe : structuredClone(p.plants),
              })
            }
          >
            {pin.locked ? "Use global growth" : "Lock current recipe"}
          </button>
          <button
            className="small-button"
            onClick={() =>
              change(pin.id, {
                locked: true,
                recipe: structuredClone(p.plants),
              })
            }
          >
            Apply current growth recipe
          </button>
          <button
            className="small-button"
            onClick={() =>
              s.update((current) => ({
                plantLandmarks: current.plantLandmarks.filter(
                  (v) => v.id !== pin.id,
                ),
              }))
            }
          >
            Remove pin
          </button>
        </details>
      ))}
    </div>
  );
}
