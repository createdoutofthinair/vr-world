import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildScene, canStand } from "../core/geometry";
import {
  DEFAULT_PROJECT,
  MeshData,
  Project,
  validateProject,
  applyTheme,
  materialsFor,
  MATERIAL_ROLES,
} from "../core/project";
import { ExportBundle, ExportSettings } from "../core/package";
import {
  loadStandardTextures,
  standardSnapshot,
} from "../core/standard-textures";
import { referenceExample } from "../core/examples";
import { textureImage } from "../core/textures";
import { loadProject, saveProject } from "../core/persistence";
interface History {
  past: Project[];
  present: Project;
  future: Project[];
}
export interface CameraSnapshot {
  position: [number, number, number];
  target: [number, number, number];
  quaternion: [number, number, number, number];
  mode: "orbit" | "walk" | "fly";
}
interface StudioStore {
  cameraState: { current: CameraSnapshot | null };
  simulation: SimulationClock;
  setSimulation: (patch: Partial<SimulationClock>) => void;
  project: Project;
  meshes: MeshData[];
  selected: string | null;
  select: (id: string | null) => void;
  update: (
    patch: Partial<Project> | ((current: Project) => Partial<Project>),
  ) => void;
  replace: (p: Project) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  inspectionLevel: number | null;
  setInspectionLevel: (level: number | null) => void;
  cutaway: boolean;
  setCutaway: (v: boolean) => void;
  mode: "orbit" | "walk" | "fly";
  setMode: (m: "orbit" | "walk" | "fly") => void;
  view: "authoring" | "export";
  setView: (v: "authoring" | "export") => void;
  bundle: ExportBundle | null;
  prepareExport: (
    mode?: "canonical" | "awg-probe",
    settings?: ExportSettings,
  ) => Promise<ExportBundle | null>;
  busy: boolean;
  cancelExport: () => void;
  exportStatus: string;
  notice: string;
  notify: (message: string) => void;
  saveState: string;
  assetRevision: number;
  assetStatus: string;
  interactDoor: (position: [number, number, number]) => void;
  renderProject: Project;
  generating: boolean;
  generationStatus: string;
}
export interface SimulationClock {
  time: number;
  anchor: number;
  paused: boolean;
  speed: number;
  rotation: "disabled" | "candidate-rpm";
}
export function clockSeconds(
  clock: SimulationClock,
  now = performance.now(),
): number {
  return (
    clock.time +
    (clock.paused ? 0 : ((now - clock.anchor) / 1000) * clock.speed)
  );
}
const Context = createContext<StudioStore | null>(null);
function initial(): Project {
  let p = structuredClone(DEFAULT_PROJECT);
  try {
    const s =
      localStorage.getItem("c3-project-v4") ??
      localStorage.getItem("c3-project-v3") ??
      localStorage.getItem("c3-project-v2") ??
      localStorage.getItem("c3-project-v1");
    if (s) p = validateProject(JSON.parse(s));
  } catch {}
  return launchProject(
    p,
    new URLSearchParams(location.hash.split("?")[1] ?? ""),
  );
}
function launchProject(saved: Project, params: URLSearchParams): Project {
  let p = referenceExample(params.get("example")) ?? saved;
  const theme = params.get("theme");
  if (
    theme &&
    ["temperate", "desert", "jungle", "fantasy", "scifi"].includes(theme)
  )
    p = { ...p, ...applyTheme(p, theme as Project["theme"]) };
  return p;
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<History>(() => ({
      past: [],
      present: initial(),
      future: [],
    })),
    [selected, select] = useState<string | null>(null),
    [cutaway, setCutaway] = useState(false),
    [inspectionLevel, setInspectionLevel] = useState<number | null>(null),
    [mode, setMode] = useState<"orbit" | "walk" | "fly">("orbit"),
    [view, setView] = useState<"authoring" | "export">("authoring"),
    [bundle, setBundle] = useState<ExportBundle | null>(null),
    [busy, setBusy] = useState(false),
    [notice, notify] = useState(
      "Ready. Start with a preset or make it your own.",
    ),
    [saveState, setSaveState] = useState("Saved locally"),
    [hydrated, setHydrated] = useState(false),
    [assetRevision, setAssetRevision] = useState(0),
    [doorOverrides, setDoorOverrides] = useState<Record<string, number>>({}),
    [generating, setGenerating] = useState(false),
    [generationStatus, setGenerationStatus] = useState("Scene ready"),
    [simulation, setSimulationState] = useState<SimulationClock>(() => ({
      time: 0,
      anchor: performance.now(),
      paused: false,
      speed: 1,
      rotation: "disabled",
    })),
    [assetStatus, setAssetStatus] = useState("Loading standard textures…");
  useEffect(() => {
    let active = true;
    loadStandardTextures()
      .then(() => {
        if (active) {
          setAssetRevision((v) => v + 1);
          setAssetStatus("CC0 standard textures ready");
        }
      })
      .catch(() => {
        if (active)
          setAssetStatus(
            "Standard textures unavailable. Reload or choose procedural surfaces.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const project = history.present,
    requestedProject = useMemo(
      () =>
        mode === "walk" && view === "authoring"
          ? {
              ...project,
              structure: {
                ...project.structure,
                doorPoses: {
                  ...project.structure.doorPoses,
                  ...doorOverrides,
                },
              },
            }
          : project,
      [project, mode, view, doorOverrides, assetRevision],
    );
  const [committed, setCommitted] = useState(() => ({
      project,
      meshes: buildScene(project),
      duration: 0,
    })),
    job = useRef(0),
    meshes = committed.meshes;
  const setSimulation = (patch: Partial<SimulationClock>) =>
    setSimulationState((clock) => ({
      ...clock,
      time: clockSeconds(clock),
      anchor: performance.now(),
      ...patch,
    }));
  useEffect(() => {
    const id = ++job.current;
    setGenerating(true);
    setGenerationStatus("Generating scene in worker…");
    if (typeof Worker === "undefined") {
      try {
        const start = performance.now();
        setCommitted({
          project: requestedProject,
          meshes: buildScene(requestedProject),
          duration: performance.now() - start,
        });
        setGenerationStatus("Scene ready · main-thread fallback");
      } catch (error) {
        setGenerationStatus(`Generation failed: ${(error as Error).message}`);
      }
      setGenerating(false);
      return;
    }
    const worker = new Worker(
      new URL("../core/generation.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.id !== job.current) return;
      setGenerating(false);
      if (event.data.error) {
        setGenerationStatus(`Generation failed: ${event.data.error}`);
        notify(event.data.error);
      } else {
        setCommitted({
          project: requestedProject,
          meshes: event.data.meshes,
          duration: event.data.duration,
        });
        setGenerationStatus(
          `Scene ready · ${Math.round(event.data.duration)} ms generation`,
        );
        setSimulationState((clock) => ({
          ...clock,
          time: 0,
          anchor: performance.now(),
        }));
      }
      worker.terminate();
    };
    worker.onerror = () => {
      if (id === job.current) {
        setGenerating(false);
        setGenerationStatus(
          "Generation worker failed. Previous scene retained.",
        );
      }
      worker.terminate();
    };
    worker.postMessage({
      id,
      project: { ...requestedProject, materialMaps: {} },
      standards: standardSnapshot(),
    });
    return () => worker.terminate();
  }, [requestedProject, assetRevision]);
  useEffect(() => {
    setDoorOverrides({});
  }, [mode, project]);
  const interactDoor = (position: [number, number, number]) => {
    if (view === "export") {
      notify(
        "Exported doors retain the selected static pose. Native door animation is not verified.",
      );
      return;
    }
    const doors = meshes
      .filter((m) => m.doorId)
      .map((m) => ({
        m,
        d: Math.hypot(
          m.origin[0] - position[0],
          m.origin[1] + 1 - position[1],
          m.origin[2] - position[2],
        ),
      }))
      .filter((v) => v.d < 2.4)
      .sort((a, b) => a.d - b.d);
    const id = doors[0]?.m.doorId;
    if (!id) {
      notify("Move closer to a door, then press E.");
      return;
    }
    const angle =
        doorOverrides[id] ??
        project.structure.doorPoses[id] ??
        project.structure.doorAngle,
      next = angle > 45 ? 0 : 90,
      poses = { ...doorOverrides, [id]: next },
      candidate = buildScene(
        {
          ...project,
          structure: {
            ...project.structure,
            doorPoses: { ...project.structure.doorPoses, ...poses },
          },
        },
        false,
      );
    if (!canStand(position[0], position[2], position[1], candidate)) {
      notify("Step clear of the door before closing it.");
      return;
    }
    setDoorOverrides(poses);
    notify(
      next ? "Door opened · simulation pose" : "Door closed · simulation pose",
    );
  };
  const cameraState = useRef<CameraSnapshot | null>(null);
  const latest = useRef(project);
  const edited = useRef(false),
    saveQueue = useRef(Promise.resolve());
  latest.current = project;
  useEffect(() => {
    let active = true;
    loadProject()
      .then((saved) => {
        if (active && saved && !edited.current) {
          const params = new URLSearchParams(location.hash.split("?")[1] ?? ""),
            restored = launchProject(saved, params);
          setHistory({
            past: params.has("example") ? [saved] : [],
            present: restored,
            future: [],
          });
          notify("Recovered project and embedded assets from browser storage.");
        }
      })
      .catch((error) => {
        if (active)
          notify(
            `Storage recovery: ${(error as Error).message}. Legacy copies are retained.`,
          );
      })
      .finally(() => {
        if (active) {
          const params = new URLSearchParams(location.hash.split("?")[1] ?? "");
          if (params.has("example") || params.has("theme"))
            window.history.replaceState(null, "", "#editor");
          setHydrated(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    setSaveState("Saving…");
    let active = true;
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveProject(project))
        .then(() => {
          if (active && latest.current === project)
            setSaveState("Saved in browser database");
        })
        .catch(() => {
          if (active)
            setSaveState("Autosave unavailable · download your project");
        });
    }, 500);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [project, hydrated]);
  const replace = (p: Project) => {
    try {
      const clean = validateProject(p);
      edited.current = true;
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
  const update = (
    patch: Partial<Project> | ((current: Project) => Partial<Project>),
  ) =>
    replace({
      ...latest.current,
      ...(typeof patch === "function" ? patch(latest.current) : patch),
    });
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
  const exportToken = useRef(0);
  const exportJob = useRef<{
    worker: Worker;
    resolve: (bundle: ExportBundle | null) => void;
  } | null>(null);
  const [exportStatus, setExportStatus] = useState("");
  const cancelExport = () => {
    exportToken.current++;
    exportJob.current?.worker.terminate();
    exportJob.current?.resolve(null);
    exportJob.current = null;
    setBusy(false);
    setExportStatus("Export cancelled; previous package retained.");
  };
  useEffect(
    () => () => {
      exportJob.current?.worker.terminate();
      exportJob.current?.resolve(null);
    },
    [],
  );
  const prepareExport = async (
    mode: "canonical" | "awg-probe" = "canonical",
    settings: ExportSettings = {},
  ) => {
    if (
      busy ||
      generating ||
      generationStatus.startsWith("Generation failed") ||
      generationStatus.includes("worker failed")
    ) {
      notify("Wait for a valid generated scene before exporting.");
      return null;
    }
    const token = ++exportToken.current;
    setBusy(true);
    try {
      setExportStatus("Preparing material dependencies…");
      await loadStandardTextures();
      if (token !== exportToken.current) return null;
      const specs = materialsFor(project),
        images = Object.fromEntries(
          MATERIAL_ROLES.map((role) => [
            role,
            textureImage(specs[role], project),
          ]),
        );
      const b = await new Promise<ExportBundle | null>((resolve, reject) => {
        const worker = new Worker(
          new URL("../core/export.worker.ts", import.meta.url),
          { type: "module" },
        );
        exportJob.current = { worker, resolve };
        worker.onmessage = (event) => {
          if (event.data.stage)
            setExportStatus(
              `${event.data.stage} · ${Math.round(event.data.percent)}%`,
            );
          else {
            worker.terminate();
            exportJob.current = null;
            if (event.data.error) reject(new Error(event.data.error));
            else resolve(event.data.bundle);
          }
        };
        worker.onerror = () => {
          worker.terminate();
          exportJob.current = null;
          reject(new Error("Export worker failed; previous package retained."));
        };
        worker.postMessage({
          settings,
          mode,
          project,
          standards: standardSnapshot(),
          images,
        });
      });
      if (!b) return null;
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
      if (token === exportToken.current) setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        project,
        meshes,
        cameraState,
        selected,
        select,
        update,
        replace,
        undo,
        redo,
        canUndo: !!history.past.length,
        canRedo: !!history.future.length,
        inspectionLevel,
        setInspectionLevel,
        cutaway,
        setCutaway,
        mode,
        setMode,
        view,
        setView,
        bundle,
        prepareExport,
        cancelExport,
        exportStatus,
        busy,
        notice,
        notify,
        saveState,
        assetRevision,
        assetStatus,
        interactDoor,
        renderProject: committed.project,
        generating,
        generationStatus,
        simulation,
        setSimulation,
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
