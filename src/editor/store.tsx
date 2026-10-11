import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildScene } from "../core/geometry";
import {
  DEFAULT_PROJECT,
  MeshData,
  Project,
  validateProject,
} from "../core/project";
import { createPackage, ExportBundle } from "../core/package";
interface History {
  past: Project[];
  present: Project;
  future: Project[];
}
interface StudioStore {
  project: Project;
  meshes: MeshData[];
  selected: string | null;
  select: (id: string | null) => void;
  update: (patch: Partial<Project>) => void;
  replace: (p: Project) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  cutaway: boolean;
  setCutaway: (v: boolean) => void;
  mode: "orbit" | "walk";
  setMode: (m: "orbit" | "walk") => void;
  view: "authoring" | "export";
  setView: (v: "authoring" | "export") => void;
  bundle: ExportBundle | null;
  prepareExport: () => Promise<ExportBundle | null>;
  busy: boolean;
  notice: string;
  notify: (message: string) => void;
  saveState: string;
}
const Context = createContext<StudioStore | null>(null);
function initial(): Project {
  let p = structuredClone(DEFAULT_PROJECT);
  try {
    const s = localStorage.getItem("c3-project-v1");
    if (s) p = validateProject(JSON.parse(s));
  } catch {}
  const theme = new URLSearchParams(location.hash.split("?")[1] ?? "").get(
    "theme",
  );
  if (
    theme &&
    ["temperate", "desert", "jungle", "fantasy", "scifi"].includes(theme)
  )
    p.theme = theme as Project["theme"];
  return p;
}
export function StudioProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<History>(() => ({
      past: [],
      present: initial(),
      future: [],
    })),
    [selected, select] = useState<string | null>(null),
    [cutaway, setCutaway] = useState(true),
    [mode, setMode] = useState<"orbit" | "walk">("orbit"),
    [view, setView] = useState<"authoring" | "export">("authoring"),
    [bundle, setBundle] = useState<ExportBundle | null>(null),
    [busy, setBusy] = useState(false),
    [notice, notify] = useState(
      "Ready. Start with a preset or make it your own.",
    ),
    [saveState, setSaveState] = useState("Saved locally");
  const project = history.present,
    meshes = useMemo(() => buildScene(project), [project]);
  const latest = useRef(project);
  latest.current = project;
  useEffect(() => {
    try {
      localStorage.setItem("c3-project-v1", JSON.stringify(project));
      setSaveState("Saved locally");
    } catch {
      setSaveState("Autosave unavailable · download your project");
    }
  }, [project]);
  const replace = (p: Project) => {
    try {
      const clean = validateProject(p);
      setHistory((h) => ({
        past: [...h.past.slice(-49), h.present],
        present: clean,
        future: [],
      }));
      setView("authoring");
      setBundle(null);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const update = (patch: Partial<Project>) => replace({ ...project, ...patch });
  const undo = () => {
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past.at(-1)!,
            future: [h.present, ...h.future],
          }
        : h,
    );
    setView("authoring");
    setBundle(null);
  };
  const redo = () => {
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
    setView("authoring");
    setBundle(null);
  };
  const prepareExport = async () => {
    if (busy) return null;
    setBusy(true);
    try {
      const b = await createPackage(project);
      if (latest.current !== project) {
        notify(
          "Project changed while exporting. Rebuild to export the current revision.",
        );
        return null;
      }
      setBundle(b);
      notify(
        `Package rebuilt: ${b.modelCount} models, ${b.textureCount} textures. VP client verification is pending.`,
      );
      return b;
    } catch (e) {
      notify(`Export failed: ${(e as Error).message}`);
      return null;
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        project,
        meshes,
        selected,
        select,
        update,
        replace,
        undo,
        redo,
        canUndo: !!history.past.length,
        canRedo: !!history.future.length,
        cutaway,
        setCutaway,
        mode,
        setMode,
        view,
        setView,
        bundle,
        prepareExport,
        busy,
        notice,
        notify,
        saveState,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStudio() {
  const s = useContext(Context);
  if (!s) throw new Error("Studio context missing");
  return s;
}
