import { useStudio } from "./store";
import { cityPlan } from "../core/city";
import {
  WorldSettings,
  DistrictRecipe,
  DistrictZone,
  THEMES,
} from "../core/project";
export function WorldStudio() {
  const s = useStudio(),
    p = s.project,
    plan = cityPlan(p),
    change = (patch: Partial<WorldSettings>) =>
      s.update({ world: { ...p.world, ...patch } });
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">FIXED PARCEL NEIGHBORHOOD</div>
      <p className="panel-note">
        Every parcel is {p.world.blockSize / 2} × {p.world.blockSize / 2} m.
        Building edits never resize parcels. Add a ring to extend the grid with
        4 parcels per new block.
      </p>
      <button
        className="small-button"
        disabled={p.world.blocks >= 3 || p.effects.viaduct}
        onClick={() => change({ enabled: true, blocks: p.world.blocks + 1 })}
      >
        ＋ Add parcel ring
      </button>
      {p.world.blocks >= 3 && (
        <p className="panel-note">
          Current tested limit: 3 × 3 blocks / 36 parcels.
        </p>
      )}
      <label className="check-field">
        <input
          type="checkbox"
          checked={p.world.enabled}
          onChange={(e) => change({ enabled: e.target.checked })}
        />
        Generate neighborhood
      </label>
      {(
        [
          ["blocks", "Blocks per axis", 1, 3, 1],
          ["blockSize", "Block frontage", 32, 48, 1],
          ["roadWidth", "Road width", 4, 10, 0.5],
          ["sidewalkWidth", "Sidewalk width", 1.2, 3, 0.1],
          ["parkRatio", "Pocket park ratio", 0, 0.6, 0.05],
          ["viaductHeight", "Viaduct deck height", 2.5, 5, 0.1],
        ] as const
      ).map(([key, label, min, max, step]) => (
        <label className="field" key={key}>
          {label}
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={p.world[key]}
            onChange={(e) => change({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <div className="form-section">Street grid editing</div>
      <p className="panel-note">
        Move an internal street row or column in metres. Parcels, entrance paths
        and ground grading follow the street. Building locks preserve recipes,
        not fixed world positions. Each block retains at least 32 m frontage.
        Curves and arbitrary road drawing are planned.
      </p>
      {(["x", "z"] as const).flatMap((axis) =>
        Array.from({ length: Math.max(0, p.world.blocks - 1) }, (_, index) => {
          const id = String(index + 1);
          return (
            <label className="field" key={`${axis}-${id}`}>
              {axis === "x" ? "North–south street" : "East–west street"} {id}{" "}
              offset (m)
              <input
                type="number"
                min={-8}
                max={8}
                step={0.5}
                disabled={p.effects.viaduct}
                value={p.world.roadOffsets?.[axis]?.[id] ?? 0}
                onChange={(e) =>
                  change({
                    roadOffsets: {
                      x: { ...p.world.roadOffsets?.x },
                      z: { ...p.world.roadOffsets?.z },
                      [axis]: {
                        ...p.world.roadOffsets?.[axis],
                        [id]: Number(e.target.value),
                      },
                    },
                  })
                }
              />
            </label>
          );
        }),
      )}
      <button
        className="small-button full"
        onClick={() => change({ roadOffsets: { x: {}, z: {} } })}
      >
        Reset street offsets
      </button>
      {p.effects.viaduct && (
        <p className="panel-note">
          Street offsets are disabled for the fixed viaduct preset.
        </p>
      )}
      <button
        className="small-button full"
        onClick={() => s.update({ seed: (p.seed + 104729) % 2147483647 })}
      >
        Regenerate unlocked plots
      </button>
      <p className="panel-note">
        {plan.plots.length} plots · {plan.edges.length} street modules ·{" "}
        {plan.nodes.length} intersections. Locks preserve building recipes when
        the seed changes.
      </p>
      <svg
        viewBox={`${-plan.extent} ${-plan.extent} ${plan.extent * 2} ${plan.extent * 2}`}
        style={{ width: "100%", background: "#e5e9df" }}
        aria-label="City map"
      >
        {plan.edges.map((e) => {
          const a = plan.nodes.find((n) => n.id === e.from)!,
            b = plan.nodes.find((n) => n.id === e.to)!;
          return (
            <line
              key={e.id}
              x1={a.x}
              y1={-a.z}
              x2={b.x}
              y2={-b.z}
              stroke="#667078"
              strokeWidth={p.world.roadWidth}
            />
          );
        })}
        {plan.plots.map((plot) => (
          <rect
            key={plot.id}
            x={plot.x - plot.parcelWidth / 2}
            y={-plot.z - plot.parcelDepth / 2}
            width={plot.parcelWidth}
            height={plot.parcelDepth}
            fill={
              plot.park
                ? "#7b9c64"
                : p.world.locks[plot.id]
                  ? "#c19956"
                  : "#b1bbaa"
            }
          >
            <title>
              {plot.id}: {plot.park ? "park" : plot.archetype} ·{" "}
              {p.world.districts?.[plot.id.replace(/-plot-\d+$/, "")]?.zone ??
                "automatic"}
            </title>
          </rect>
        ))}
      </svg>
      <div className="form-section">District zoning</div>
      <p className="panel-note">
        Each block shares a land-use recipe and architecture. Individual locked
        plots take precedence. Shrinking the neighborhood retains hidden
        district recipes for later expansion.
      </p>
      {Array.from({ length: p.world.blocks ** 2 }, (_, i) => {
        const x = i % p.world.blocks,
          z = Math.floor(i / p.world.blocks),
          id = `block-${x}-${z}`,
          saved = p.world.districts?.[id],
          recipe: DistrictRecipe = saved ?? {
            zone: "mixed",
            theme: p.theme,
            maxStoreys: 4,
          },
          update = (patch: Partial<DistrictRecipe>) =>
            change({
              districts: {
                ...p.world.districts,
                [id]: { ...recipe, ...patch },
              },
            });
        return (
          <div className="form-section" key={id}>
            <b>{id}</b>
            <label className="field">
              Land use
              <select
                value={saved?.zone ?? "automatic"}
                onChange={(e) => {
                  if (e.target.value === "automatic") {
                    const districts = { ...p.world.districts };
                    delete districts[id];
                    change({ districts });
                  } else update({ zone: e.target.value as DistrictZone });
                }}
              >
                {[
                  "automatic",
                  "residential",
                  "commercial",
                  "mixed",
                  "park",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            {saved && (
              <>
                <label className="field">
                  Architecture
                  <select
                    value={recipe.theme}
                    onChange={(e) =>
                      update({
                        theme: e.target.value as DistrictRecipe["theme"],
                      })
                    }
                  >
                    {Object.entries(THEMES).map(([key, theme]) => (
                      <option key={key} value={key}>
                        {theme.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Maximum storeys
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={recipe.maxStoreys}
                    onChange={(e) =>
                      update({ maxStoreys: Number(e.target.value) })
                    }
                  />
                </label>
              </>
            )}
          </div>
        );
      })}
      {plan.plots.map((plot) => (
        <div className="plant-row" key={plot.id}>
          <span>
            <b>{plot.id}</b>
            <small>
              {plot.park
                ? "Park"
                : `${plot.archetype} · ${plot.storeys} levels`}
            </small>
          </span>
          <label className="field">
            Use
            <select
              value={plot.park ? "park" : plot.archetype}
              onChange={(e) => {
                const kind = e.target.value;
                change({
                  locks: {
                    ...p.world.locks,
                    [plot.id]: {
                      ...p.world.locks[plot.id],
                      seed: plot.seed,
                      archetype:
                        kind === "park"
                          ? plot.archetype
                          : (kind as typeof plot.archetype),
                      theme: plot.theme,
                      storeys: plot.storeys,
                      park: kind === "park",
                    },
                  },
                });
              }}
            >
              {["park", "shop", "house", "villa", "flats", "mixed"].map(
                (kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ),
              )}
            </select>
          </label>
          {!plot.park && (
            <>
              <label className="field">
                Architecture
                <select
                  value={plot.theme}
                  onChange={(e) =>
                    change({
                      locks: {
                        ...p.world.locks,
                        [plot.id]: {
                          ...p.world.locks[plot.id],
                          seed: plot.seed,
                          archetype: plot.archetype,
                          theme: e.target.value as typeof plot.theme,
                          storeys: plot.storeys,
                          park: false,
                        },
                      },
                    })
                  }
                >
                  {Object.entries(THEMES).map(([key, theme]) => (
                    <option key={key} value={key}>
                      {theme.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Storeys
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={plot.storeys}
                  onChange={(e) =>
                    change({
                      locks: {
                        ...p.world.locks,
                        [plot.id]: {
                          ...p.world.locks[plot.id],
                          seed: plot.seed,
                          archetype: plot.archetype,
                          theme: plot.theme,
                          storeys: Number(e.target.value),
                          park: false,
                        },
                      },
                    })
                  }
                />
              </label>
            </>
          )}
          <button
            className="small-button"
            onClick={() => {
              const locks = { ...p.world.locks };
              if (locks[plot.id]) delete locks[plot.id];
              else
                locks[plot.id] = {
                  seed: plot.seed,
                  archetype: plot.archetype,
                  theme: plot.theme,
                  storeys: plot.storeys,
                  park: plot.park,
                };
              change({ locks });
            }}
          >
            {p.world.locks[plot.id] ? "Unlock" : "Lock"}
          </button>
        </div>
      ))}
    </div>
  );
}
