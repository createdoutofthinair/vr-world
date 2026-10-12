import { useStudio } from "./store";
import { cityPlan } from "../core/city";
import { WorldSettings } from "../core/project";
export function WorldStudio() {
  const s = useStudio(),
    p = s.project,
    plan = cityPlan(p),
    change = (patch: Partial<WorldSettings>) =>
      s.update({ world: { ...p.world, ...patch } });
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">SEEDED CITY</div>
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
            x={plot.x - 5}
            y={-plot.z - 5}
            width={10}
            height={10}
            fill={
              plot.park
                ? "#7b9c64"
                : p.world.locks[plot.id]
                  ? "#c19956"
                  : "#b1bbaa"
            }
          >
            <title>
              {plot.id}: {plot.park ? "park" : plot.archetype}
            </title>
          </rect>
        ))}
      </svg>
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
