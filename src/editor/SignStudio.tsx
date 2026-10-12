import { useState } from "react";
import { useStudio } from "./store";
import { SignSlot, TextureAsset } from "../core/project";
import { rasterizeSign, SignArtwork } from "../core/signs";
import { readTexture } from "../core/textures";
const defaults: SignArtwork = {
  text: "YOUR LITTLE WORLD",
  background: "#193c31",
  color: "#e9f0df",
  font: "sans-serif",
  fit: "contain",
  padding: 0.05,
  border: true,
};
export function SignStudio() {
  const s = useStudio(),
    p = s.project,
    [selected, setSelected] = useState(""),
    [kind, setKind] = useState<SignSlot["kind"]>("fascia"),
    [width, setWidth] = useState(4),
    [height, setHeight] = useState(0.5),
    [settings, setSettings] = useState(defaults),
    [artwork, setArtwork] = useState<TextureAsset>(),
    [busy, setBusy] = useState(false);
  const load = (id: string) => {
    setSelected(id);
    const slot = p.signs.find((v) => v.id === id);
    if (slot) {
      setKind(slot.kind);
      setWidth(slot.width);
      setHeight(slot.height);
      setArtwork(slot.artwork);
      setSettings({ ...defaults, ...slot.settings, text: slot.text });
    }
  };
  const apply = async () => {
    setBusy(true);
    try {
      const asset = await rasterizeSign(settings, width, height, artwork),
        id = selected || "slot-" + crypto.randomUUID(),
        slot: SignSlot = {
          id,
          kind,
          width,
          height,
          text: settings.text,
          asset,
          artwork,
          settings: { ...settings },
        };
      s.update((current) => ({
        signs: [...current.signs.filter((v) => v.id !== id), slot],
      }));
      setSelected(id);
      s.notify(
        "Sign artwork frozen to PNG; attached geometry and export use these same bytes.",
      );
    } catch (error) {
      s.notify((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">SIGN SLOTS & ARTWORK</div>
      <label className="field">
        Slot
        <select value={selected} onChange={(e) => load(e.target.value)}>
          <option value="">New sign slot</option>
          {p.signs.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.kind} · {slot.text}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Mount
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as SignSlot["kind"])}
        >
          {["fascia", "blade", "wall", "pavement", "roof"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Width (m)
        <input
          type="number"
          min={0.5}
          max={8}
          step={0.1}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
        />
      </label>
      <label className="field">
        Height (m)
        <input
          type="number"
          min={0.3}
          max={3}
          step={0.1}
          value={height}
          onChange={(e) => setHeight(Number(e.target.value))}
        />
      </label>
      <label className="field">
        Text
        <input
          maxLength={120}
          value={settings.text}
          onChange={(e) => setSettings({ ...settings, text: e.target.value })}
        />
      </label>
      <label className="field">
        Font
        <select
          value={settings.font}
          onChange={(e) =>
            setSettings({
              ...settings,
              font: e.target.value as SignArtwork["font"],
            })
          }
        >
          {["sans-serif", "serif", "monospace"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </label>
      {(["background", "color"] as const).map((key) => (
        <label className="field" key={key}>
          {key}
          <input
            type="color"
            value={settings[key]}
            onChange={(e) =>
              setSettings({ ...settings, [key]: e.target.value })
            }
          />
        </label>
      ))}
      <label className="small-button full upload-button">
        Upload sign artwork
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file)
              try {
                setArtwork(await readTexture(file));
              } catch (error) {
                s.notify((error as Error).message);
              }
          }}
        />
      </label>
      <label className="field">
        Artwork fit
        <select
          value={settings.fit}
          onChange={(e) =>
            setSettings({
              ...settings,
              fit: e.target.value as "contain" | "cover",
            })
          }
        >
          <option value="contain">Fit without cropping</option>
          <option value="cover">Fill and crop centrally</option>
        </select>
      </label>
      <label className="check-field">
        <input
          type="checkbox"
          checked={settings.border}
          onChange={(e) =>
            setSettings({ ...settings, border: e.target.checked })
          }
        />
        Content border
      </label>
      <button
        className="btn accent full"
        disabled={busy || p.world.enabled}
        onClick={apply}
      >
        {busy ? "Rasterizing artwork…" : "Apply sign slot"}
      </button>
      {selected && (
        <>
          <img
            src={p.signs.find((v) => v.id === selected)?.asset.dataUrl}
            alt="Committed sign artwork"
            style={{ width: "100%", marginTop: 12 }}
          />
          <button
            className="small-button full"
            onClick={() => {
              const slot = p.signs.find((v) => v.id === selected);
              if (slot) {
                const id = "slot-" + crypto.randomUUID();
                s.update({ signs: [...p.signs, { ...slot, id }] });
                setSelected(id);
              }
            }}
          >
            Duplicate with shared artwork
          </button>
          <button
            className="small-button full"
            onClick={() => {
              s.update({ signs: p.signs.filter((v) => v.id !== selected) });
              setSelected("");
            }}
          >
            Remove sign
          </button>
        </>
      )}
      <p className="panel-note">
        Original artwork and raster settings remain editable in the project. The
        receiver uses the frozen PNG and needs no font files. Mounts follow
        building dimensions; conflicting sizes are rejected. Custom sign slots
        currently target the parcel building.
      </p>
    </div>
  );
}
