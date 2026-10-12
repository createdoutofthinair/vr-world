import { useEffect, useState } from "react";
import { useStudio } from "./store";
import {
  versions,
  saveVersion,
  loadVersion,
  removeVersion,
  loadProject,
  SavedVersion,
  collectUnusedAssets,
} from "../core/persistence";
export function HistoryStudio() {
  const s = useStudio(),
    [items, setItems] = useState<SavedVersion[]>([]),
    [busy, setBusy] = useState(false),
    refresh = () =>
      versions()
        .then(setItems)
        .catch((error) => s.notify((error as Error).message));
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">SAVED VERSIONS & RECOVERY</div>
      <p className="panel-note">
        {s.saveState}. Large images are stored by content hash in IndexedDB. Old
        local-storage documents remain under their original keys.
      </p>
      <button
        className="small-button full"
        onClick={async () => {
          try {
            s.notify(
              `${await collectUnusedAssets()} unreferenced stored textures removed. Current, previous and checkpoint assets retained.`,
            );
          } catch (error) {
            s.notify((error as Error).message);
          }
        }}
      >
        Clean unused stored textures
      </button>
      <button
        className="small-button full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await saveVersion(s.project);
            await refresh();
            s.notify("Editable version saved with referenced texture assets.");
          } catch (error) {
            s.notify((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Save named checkpoint
      </button>
      <button
        className="small-button full"
        onClick={async () => {
          try {
            const previous = await loadProject(true);
            if (previous) s.replace(previous);
            else s.notify("No previous database revision exists.");
          } catch (error) {
            s.notify((error as Error).message);
          }
        }}
      >
        Recover previous autosave
      </button>
      {items.map((item) => (
        <div className="plant-row" key={item.id}>
          <span>
            <b>{item.name}</b>
            <small>{new Date(item.time).toLocaleString()}</small>
          </span>
          <button
            className="small-button"
            onClick={async () => {
              try {
                s.replace(await loadVersion(item.id));
              } catch (error) {
                s.notify((error as Error).message);
              }
            }}
          >
            Restore
          </button>
          <button
            className="small-button"
            onClick={async () => {
              await removeVersion(item.id);
              await refresh();
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <p className="panel-note">
        Up to 20 explicit checkpoints; removal is manual. Restoring a version is
        undoable. Database quota or availability failures leave project download
        available.
      </p>
    </div>
  );
}
