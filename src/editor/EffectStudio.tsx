import { useEffect, useState } from "react";
import { useStudio, clockSeconds } from "./store";
import { EffectSettings } from "../core/project";
import { parseAction, evaluateMotion } from "../core/actions";
export function EffectStudio() {
  const s = useStudio(),
    p = s.project,
    [now, setNow] = useState(performance.now());
  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(id);
  }, []);
  const set = (key: keyof EffectSettings, value: boolean) =>
      s.update({
        ...(key === "viaduct" && value
          ? { world: { ...p.world, enabled: true, blocks: 3 } }
          : {}),
        effects: {
          ...p.effects,
          [key]: value,
          ...(key === "viaduct" && value ? { waterfall: false } : {}),
          ...(key === "creek" && !value
            ? { waterfall: false, bridge: false, trail: false, motion: false }
            : {}),
        },
        landscape: {
          ...p.landscape,
          enabled: true,
          extent: Math.max(12, p.landscape.extent),
        },
      }),
    mesh = (s.view === "export" && s.bundle ? s.bundle.meshes : s.meshes).find(
      (m) => m.id === s.selected,
    ),
    time = clockSeconds(s.simulation, now);
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">CREEKS, PATHS & EFFECTS</div>
      {(
        [
          ["viaduct", "Elevated road · three-block neighborhood"],
          ["creek", "Directed creek and carved banks"],
          ["trail", "Walkable bank trail"],
          ["bridge", "Supported crossing"],
          ["waterfall", "Waterfall and plunge foam"],
          ["motion", "Exported move commands"],
        ] as const
      ).map(([key, label]) => (
        <label className="check-field" key={key}>
          <input
            type="checkbox"
            checked={p.effects[key]}
            disabled={
              (key !== "creek" && key !== "viaduct" && !p.effects.creek) ||
              (key === "waterfall" && p.world.enabled)
            }
            onChange={(e) => set(key, e.target.checked)}
          />
          {label}
        </label>
      ))}
      <p className="panel-note">
        Water uses ordinary mesh strips, geometry foam and deliverable move
        actions. The browser preview reads those same actions. Waterfall presets
        currently require parcel mode.
      </p>
      <div className="form-section">Deterministic inspection clock</div>
      <div className="button-row">
        <button
          className="small-button"
          onClick={() => s.setSimulation({ paused: !s.simulation.paused })}
        >
          {s.simulation.paused ? "Play" : "Pause"}
        </button>
        <button
          className="small-button"
          onClick={() => s.setSimulation({ time: 0 })}
        >
          Restart scene
        </button>
      </div>
      <label className="field">
        Seek (seconds)
        <input
          type="number"
          min={0}
          max={3600}
          step={0.1}
          value={Math.round(time * 10) / 10}
          onChange={(e) =>
            s.setSimulation({ time: Number(e.target.value), paused: true })
          }
        />
      </label>
      <label className="field">
        Speed
        <select
          value={s.simulation.speed}
          onChange={(e) => s.setSimulation({ speed: Number(e.target.value) })}
        >
          {[0.25, 0.5, 1, 2, 4].map((v) => (
            <option key={v} value={v}>
              {v}×
            </option>
          ))}
        </select>
      </label>
      <p className="panel-note">
        VP move displacement, waits and return/reset cycles follow its published
        grammar. Smoothstep and universe-clock phase are marked approximations.
        Native comparison is pending.
      </p>
      <label className="field">
        Rotation investigation
        <select
          value={s.simulation.rotation}
          onChange={(e) =>
            s.setSimulation({
              rotation: e.target.value as "disabled" | "candidate-rpm",
            })
          }
        >
          <option value="disabled">Disabled · native units unverified</option>
          <option value="candidate-rpm">
            Candidate RPM adapter · fixture only
          </option>
        </select>
      </label>
      {mesh?.action && (
        <>
          <div className="form-section">Selected emitted action</div>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>
            {mesh.action}
          </pre>
          {parseAction(mesh.action).assumptions.map((v) => (
            <p className="panel-note" key={v}>
              {v}
            </p>
          ))}
        </>
      )}
      <p className="panel-note">{s.generationStatus}</p>
    </div>
  );
}
