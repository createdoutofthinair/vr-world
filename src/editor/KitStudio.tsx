import { useState } from "react";
import { useStudio } from "./store";
import { KitDefinition, KitInstance } from "../core/project";
import { moduleDimensions, moduleTransforms } from "../core/modules";
import { terrainHeight } from "../core/terrain";
export function KitStudio() {
  const s = useStudio(),
    p = s.project,
    [definition, setDefinition] = useState("window-bay"),
    [selected, setSelected] = useState<string | null>(null),
    def =
      p.kit.definitions.find((d) => d.id === definition) ??
      p.kit.definitions[0],
    instance = p.kit.instances.find((i) => i.id === selected);
  const editDefinition = (patch: Partial<KitDefinition>) =>
      s.update({
        kit: {
          ...p.kit,
          definitions: p.kit.definitions.map((d) =>
            d.id === def.id ? { ...d, ...patch } : d,
          ),
        },
      }),
    editInstance = (patch: Partial<KitInstance>) =>
      instance &&
      s.update({
        kit: {
          ...p.kit,
          instances: p.kit.instances.map((i) =>
            i.id === instance.id ? { ...i, ...patch } : i,
          ),
        },
      });
  const add = (attach = false) => {
    const id = `module-${Date.now()}`,
      x = p.width / 2 + 3,
      rootY = terrainHeight(p, x, 0),
      next: KitInstance = {
        id,
        definition: def.id,
        origin: [x, def.kind === "slab" ? rootY - 0.02 : rootY + 0.18, 0],
        yaw: 0,
        overrides: {},
        locked: false,
        ...(attach && instance
          ? {
              parent: instance.id,
              parentSocket: "right" as const,
              socket: "left" as const,
            }
          : {}),
      };
    s.update({ kit: { ...p.kit, instances: [...p.kit.instances, next] } });
    setSelected(id);
  };
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">LINKED MODULE KIT</div>
      <label className="check-field">
        <input
          type="checkbox"
          checked={p.kit.buildingEnabled}
          onChange={(e) =>
            s.update({ kit: { ...p.kit, buildingEnabled: e.target.checked } })
          }
        />
        Include generated building
      </label>
      <label className="field">
        Shared module definition
        <select value={def.id} onChange={(e) => setDefinition(e.target.value)}>
          {p.kit.definitions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      {(["width", "height", "depth"] as const).map((key) => (
        <label className="field" key={key}>
          {key} (m)
          <input
            type="number"
            min={0.06}
            max={12}
            step={0.02}
            value={def[key]}
            onChange={(e) => editDefinition({ [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <div className="button-row">
        <button className="small-button" onClick={() => add()}>
          Place module
        </button>
        <button
          className="small-button"
          disabled={!instance}
          onClick={() => add(true)}
        >
          Attach right socket
        </button>
      </div>
      <p className="panel-note">
        Wall bays contain genuine openings and glazing. Definition edits
        propagate to linked instances. Attached modules follow their parent
        sockets; unique dimension overrides remain independent.
      </p>
      <label className="field">
        Instance
        <select
          value={selected ?? ""}
          onChange={(e) => {
            setSelected(e.target.value);
            s.select("kit-" + e.target.value + "-body");
          }}
        >
          <option value="">Select a module</option>
          {p.kit.instances.map((i) => (
            <option key={i.id} value={i.id}>
              {i.id} · {i.definition}
            </option>
          ))}
        </select>
      </label>
      {instance && (
        <>
          <div className="form-section">Instance placement</div>
          {([0, 1, 2] as const).map((axis) => (
            <label className="field" key={axis}>
              {["X", "Y", "Z"][axis]} (m)
              <input
                type="number"
                step={0.1}
                value={instance.origin[axis]}
                disabled={!!instance.parent}
                onChange={(e) => {
                  const origin = [...instance.origin] as [
                    number,
                    number,
                    number,
                  ];
                  origin[axis] = Number(e.target.value);
                  editInstance({ origin });
                }}
              />
            </label>
          ))}
          <label className="field">
            Yaw
            <select
              value={instance.yaw}
              disabled={!!instance.parent}
              onChange={(e) => editInstance({ yaw: Number(e.target.value) })}
            >
              {[0, 90, 180, 270].map((v) => (
                <option key={v} value={v}>
                  {v}°
                </option>
              ))}
            </select>
          </label>
          <button
            className="small-button full"
            onClick={() => {
              if (instance.locked)
                editInstance({ locked: false, overrides: {} });
              else {
                const d = moduleDimensions(p, instance);
                editInstance({
                  locked: true,
                  overrides: {
                    width: d.width,
                    height: d.height,
                    depth: d.depth,
                  },
                });
              }
            }}
          >
            {instance.locked
              ? "Restore linked dimensions"
              : "Lock dimension snapshot"}
          </button>
          {instance.parent && (
            <button
              className="small-button full"
              onClick={() => {
                const resolved = moduleTransforms(p).get(instance.id)!;
                editInstance({
                  parent: undefined,
                  parentSocket: undefined,
                  socket: undefined,
                  origin: resolved.origin,
                  yaw: resolved.yaw,
                });
              }}
            >
              Detach at current world position
            </button>
          )}
          <button
            className="small-button full"
            onClick={() => {
              if (p.kit.instances.some((i) => i.parent === instance.id)) {
                s.notify("Detach child modules before deleting their parent.");
                return;
              }
              s.update({
                kit: {
                  ...p.kit,
                  instances: p.kit.instances.filter(
                    (i) => i.id !== instance.id,
                  ),
                },
              });
              setSelected(null);
            }}
          >
            Remove module
          </button>
        </>
      )}
    </div>
  );
}
