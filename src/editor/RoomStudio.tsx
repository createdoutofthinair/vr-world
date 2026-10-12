import { useState, useEffect } from "react";
import { useStudio } from "./store";
import { AuthoredRoom, MATERIAL_ROLES } from "../core/project";
import { regenerateRooms } from "../core/rooms";
export function RoomStudio() {
  const s = useStudio(),
    p = s.project,
    [selected, setSelected] = useState(""),
    room = p.rooms.find((r) => r.id === selected),
    change = (patch: Partial<AuthoredRoom>) =>
      s.update((current) => ({
        rooms: current.rooms.map((r) =>
          r.id === selected ? { ...r, ...patch } : r,
        ),
      }));
  useEffect(() => {
    if (p.rooms.some((room) => room.id === s.selected))
      setSelected(s.selected!);
    else {
      const id = s.meshes.find((mesh) => mesh.id === s.selected)?.roomIds?.[0];
      if (id) setSelected(id);
    }
  }, [s.selected, p.rooms]);
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">ROOM BOUNDARIES</div>
      <p className="muted small">
        Authored rooms replace template partitions and furnishing in parcel
        mode. Walls and door connections derive from these boundaries; a shared
        wall is emitted once. Stair and courtyard conflicts retain the last
        valid scene.
      </p>
      {p.world.enabled && (
        <p className="panel-note">
          Room authoring applies to the individual building. Turn off
          neighborhood mode to edit it; per-plot detached interiors remain
          pending.
        </p>
      )}
      <button
        className="small-button full"
        disabled={p.world.enabled || p.structure.footprint !== "rectangle"}
        onClick={() => {
          const candidate = {
            ...p,
            width: Math.max(10, p.width),
            depth: Math.max(10, p.depth),
          };
          s.update({
            width: candidate.width,
            depth: candidate.depth,
            rooms: regenerateRooms(candidate),
          });
        }}
      >
        Generate unlocked room layout (rectangle; minimum 10 × 10 m)
      </button>
      <button
        className="small-button full"
        disabled={p.world.enabled || p.rooms.length >= 60}
        onClick={() => {
          const id = "room-" + crypto.randomUUID();
          s.update({
            rooms: [
              ...p.rooms,
              {
                id,
                name: "New room",
                type: "living",
                level: 0,
                x: -p.width * 0.25,
                z: 0,
                width: 2.4,
                depth: 2.4,
                doorSide: "right",
                doorOffset: 0,
                doorWidth: 1.05,
                locked: false,
                furnished: false,
                finish: "wall",
              },
            ],
          });
          setSelected(id);
        }}
      >
        Add room boundary
      </button>
      <label className="field">
        Room
        <select
          value={room?.id ?? ""}
          onChange={(e) => {
            setSelected(e.target.value);
            s.select(e.target.value || null);
          }}
        >
          <option value="">Select a room</option>
          {p.rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name} · level {r.level + 1}
              {r.locked ? " · locked" : ""}
            </option>
          ))}
        </select>
      </label>
      {room && (
        <>
          <label className="field">
            Name
            <input
              value={room.name}
              maxLength={80}
              onChange={(e) => change({ name: e.target.value })}
            />
          </label>
          <label className="field">
            Type
            <select
              value={room.type}
              onChange={(e) =>
                change({ type: e.target.value as AuthoredRoom["type"] })
              }
            >
              {[
                "bedroom",
                "bathroom",
                "kitchen",
                "living",
                "shop",
                "storage",
                "corridor",
              ].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["x", "Center X", -20, 20, 0.1],
              ["z", "Center Z", -20, 20, 0.1],
              ["width", "Width", 2, 20, 0.1],
              ["depth", "Depth", 2, 20, 0.1],
              ["level", "Floor index", 0, p.structure.storeys - 1, 1],
              ["doorOffset", "Door offset", -10, 10, 0.1],
              ["doorWidth", "Door width", 0.9, 2, 0.05],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <label className="field" key={key}>
              {label}
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={room[key]}
                disabled={room.locked}
                onChange={(e) => change({ [key]: Number(e.target.value) })}
              />
            </label>
          ))}
          <label className="field">
            Door boundary
            <select
              value={room.doorSide}
              disabled={room.locked}
              onChange={(e) =>
                change({ doorSide: e.target.value as AuthoredRoom["doorSide"] })
              }
            >
              {["front", "back", "left", "right"].map((side) => (
                <option key={side} value={side}>
                  {side}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Wall finish
            <select
              value={room.finish}
              onChange={(e) =>
                change({ finish: e.target.value as AuthoredRoom["finish"] })
              }
            >
              {MATERIAL_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={room.furnished}
              onChange={(e) => change({ furnished: e.target.checked })}
            />
            Room-specific furnishings
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={room.locked}
              onChange={(e) => change({ locked: e.target.checked })}
            />
            Lock boundaries during layout regeneration
          </label>
          <button
            className="small-button full"
            disabled={room.locked}
            onClick={() =>
              s.update({ rooms: p.rooms.filter((r) => r.id !== room.id) })
            }
          >
            Remove room
          </button>
        </>
      )}
      <button
        className="small-button full"
        disabled={p.rooms.some((r) => r.locked) || p.world.enabled}
        onClick={() => s.update({ rooms: [] })}
      >
        Return to template interior
      </button>
    </div>
  );
}
