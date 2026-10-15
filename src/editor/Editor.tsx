import { useEffect, useRef, useState } from "react";
import {
  DockviewApi,
  DockviewReact,
  DockviewReadyEvent,
  themeDark,
} from "dockview-react";
import "dockview-react/dist/styles/dockview.css";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  PanelLeft,
  Redo2,
  Undo2,
  Settings2,
  Box,
  Paintbrush,
  Trees,
  Footprints,
  Map,
  Layers3,
  Home,
  FolderOpen,
  Command,
  X,
} from "lucide-react";
import logo from "../assets/logo.svg";
import { StudioProvider, useStudio } from "./store";
import {
  Explorer,
  Properties,
  Presets,
  Materials,
  FloorPlan,
  ExportPanel,
  Diagnostics,
  ThemesPanel,
  PlantStudio,
} from "./Panels";
import { Viewport } from "./Viewport";
import { BuildingStudio } from "./BuildingStudio";
import { WorldStudio } from "./WorldStudio";
import { TerrainStudio } from "./TerrainStudio";
import { EffectStudio } from "./EffectStudio";
import { KitStudio } from "./KitStudio";
import { SignStudio } from "./SignStudio";
import { PerformanceStudio } from "./PerformanceStudio";
import { RoomStudio } from "./RoomStudio";
import { HistoryStudio } from "./HistoryStudio";
import { cityPlan } from "../core/city";
import { download } from "../core/package";
const components = {
  explorer: Explorer,
  properties: Properties,
  presets: Presets,
  materials: Materials,
  plan: FloorPlan,
  export: ExportPanel,
  diagnostics: Diagnostics,
  viewport: Viewport,
  themes: ThemesPanel,
  plants: PlantStudio,
  building: BuildingStudio,
  world: WorldStudio,
  terrain: TerrainStudio,
  effects: EffectStudio,
  kit: KitStudio,
  signs: SignStudio,
  performance: PerformanceStudio,
  history: HistoryStudio,
  rooms: RoomStudio,
};
const panelNames: Record<string, string> = {
  explorer: "Explorer",
  properties: "Properties",
  presets: "Building presets",
  materials: "Materials",
  plan: "Floor plan",
  export: "Export package",
  diagnostics: "Problems & activity",
  viewport: "3D workspace",
  themes: "Themes & landscape",
  plants: "Plant Studio",
  building: "Building & circulation",
  world: "World map & roads",
  terrain: "Terrain & surfaces",
  effects: "Waterways & effects",
  kit: "Modules & sockets",
  signs: "Signs & artwork",
  performance: "Performance & proof gates",
  history: "Versions & recovery",
  rooms: "Rooms & boundaries",
};
function defaultLayout(api: DockviewApi) {
  api.clear();
  api.addPanel({
    id: "viewport",
    component: "viewport",
    title: "3D workspace",
  });
  if (window.innerWidth < 760) {
    for (const [id, title] of Object.entries(panelNames)) {
      if (id !== "viewport")
        api.addPanel({
          id,
          component: id,
          title,
          position: { referencePanel: "viewport", direction: "within" },
        });
    }
    api.getPanel("viewport")?.api.setActive();
    return;
  }
  api.addPanel({
    id: "explorer",
    component: "explorer",
    title: "Explorer",
    position: { referencePanel: "viewport", direction: "left" },
    initialWidth: 235,
  });
  api.addPanel({
    id: "presets",
    component: "presets",
    title: "Building presets",
    position: { referencePanel: "explorer", direction: "within" },
  });
  api.addPanel({
    id: "properties",
    component: "properties",
    title: "Properties",
    position: { referencePanel: "viewport", direction: "right" },
    initialWidth: 285,
  });
  api.addPanel({
    id: "materials",
    component: "materials",
    title: "Materials",
    position: { referencePanel: "properties", direction: "within" },
  });
  api.addPanel({
    id: "export",
    component: "export",
    title: "Export",
    position: { referencePanel: "properties", direction: "within" },
  });
  api.addPanel({
    id: "plan",
    component: "plan",
    title: "Floor plan",
    position: { referencePanel: "explorer", direction: "below" },
    initialHeight: 255,
  });
  api.addPanel({
    id: "diagnostics",
    component: "diagnostics",
    title: "Problems & activity",
    position: { referencePanel: "viewport", direction: "below" },
    initialHeight: 138,
  });
  for (const id of [
    "themes",
    "plants",
    "building",
    "world",
    "terrain",
    "effects",
    "kit",
    "signs",
    "performance",
    "history",
    "rooms",
  ])
    api.addPanel({
      id,
      component: id,
      title: panelNames[id],
      position: { referencePanel: "explorer", direction: "within" },
    });
  api.getPanel("explorer")?.api.setActive();
  api.getPanel("properties")?.api.setActive();
  api.getPanel("viewport")?.api.setActive();
}
function EditorInner() {
  const s = useStudio(),
    workspace = useRef<HTMLDivElement | null>(null),
    radialElement = useRef<HTMLDivElement | null>(null),
    api = useRef<DockviewApi | null>(null),
    layoutSub = useRef<{ dispose: () => void } | null>(null),
    [focused, setFocused] = useState(false),
    [card, setCard] = useState<string | null>(null),
    [radial, setRadial] = useState<{
      x: number;
      y: number;
      id: string | null;
    } | null>(null),
    [menus, setMenus] = useState(false),
    [palette, setPalette] = useState(false),
    [query, setQuery] = useState("");
  useEffect(() => {
    if (radial)
      radialElement.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus();
  }, [radial]);
  const ready = ({ api: a }: DockviewReadyEvent) => {
    api.current = a;
    const key =
      window.innerWidth < 760
        ? "c3-layout-v4-dark-narrow"
        : "c3-layout-v4-dark";
    let restored = false;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        a.fromJSON(JSON.parse(saved));
        restored = !!a.getPanel("viewport");
      }
    } catch {}
    if (!restored) defaultLayout(a);
    layoutSub.current = a.onDidLayoutChange(() => {
      try {
        localStorage.setItem(key, JSON.stringify(a.toJSON()));
      } catch {}
    });
  };
  const open = (id: string) => {
    if (focused) {
      setCard(id === "viewport" ? null : id);
      setRadial(null);
      setMenus(false);
      return;
    }
    const a = api.current;
    if (!a) return;
    const existing = a.getPanel(id);
    if (existing) existing.api.setActive();
    else
      a.addPanel({
        id,
        component: id,
        title: panelNames[id],
        position: { direction: "right" },
      });
    setMenus(false);
  };
  useEffect(() => () => layoutSub.current?.dispose(), []);
  useEffect(() => {
    const context = (e: Event) => {
      if (!focused || s.view !== "authoring") return;
      setCard(null);
      setRadial((e as CustomEvent).detail);
    };
    window.addEventListener("c3-context", context);
    return () => window.removeEventListener("c3-context", context);
  }, [focused, s.view]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const input = (e.target as HTMLElement).matches("input,textarea,select");
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.key === "Escape") {
        setPalette(false);
        setMenus(false);
        setRadial(null);
        setCard(null);
      }
      if (input) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? s.redo() : s.undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        download(
          "c3-world.c3world.json",
          JSON.stringify(s.project, null, 2),
          "application/json",
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [s]);
  const target = s.meshes.find((m) => m.id === radial?.id);
  const radialActions = !target
    ? ["presets", "world", "terrain", "themes", "history", "export"]
    : target.category === "vegetation"
      ? ["plants", "materials", "themes", "terrain", "effects", "performance"]
      : target.category === "site" || target.category === "landscape"
        ? ["world", "terrain", "materials", "themes", "effects", "plan"]
        : ["properties", "building", "materials", "rooms", "signs", "plan"];
  const commands = [
    {
      label: "Reset workspace layout",
      run: () => api.current && defaultLayout(api.current),
    },
    { label: "Switch to orbit inspection", run: () => s.setMode("orbit") },
    { label: "Walk through the building", run: () => s.setMode("walk") },
    { label: "Toggle roof cutaway", run: () => s.setCutaway(!s.cutaway) },
    ...Object.entries(panelNames).map(([id, label]) => ({
      label: `Show ${label}`,
      run: () => open(id),
    })),
  ];
  return (
    <div className="editor-page editor-dark">
      <header className="editor-header">
        <a href="#home" className="editor-brand">
          <img src={logo} alt="c3 logo" />
          <span>
            c3 <b>World Studio</b>
          </span>
        </a>
        <span className="editor-divider" />
        <div className="project-title">
          <FolderOpen size={14} />
          {s.project.name}
          <span className="early-tag">WORLD KITS</span>
        </div>
        <div className="editor-header-right">
          <button
            className="icon-button"
            onClick={() => setPalette(true)}
            title="Command palette (Ctrl+K)"
          >
            <Command size={17} />
          </button>
          <a href="#home" className="back-link">
            <ArrowLeft size={14} /> Website
          </a>
          <button
            className="editor-export"
            disabled={s.busy}
            onClick={() => open("export")}
          >
            <Download size={14} /> Export
          </button>
        </div>
      </header>
      <div className="editor-menubar">
        <div className="editor-actions">
          <button disabled={!s.canUndo} onClick={s.undo} title="Undo (Ctrl+Z)">
            <Undo2 size={15} />
          </button>
          <button
            disabled={!s.canRedo}
            onClick={s.redo}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 size={15} />
          </button>
          <span />
          {!focused && (
            <button onClick={() => setFocused(true)}>World view</button>
          )}
          <div className="panel-menu">
            <button onClick={() => setMenus(!menus)}>
              <PanelLeft size={14} /> Panels <ChevronDown size={12} />
            </button>
            {menus && (
              <div className="dropdown">
                {Object.entries(panelNames).map(([id, label]) => (
                  <button key={id} onClick={() => open(id)}>
                    {label}
                  </button>
                ))}
                <hr />
                <button
                  onClick={() => {
                    if (api.current) defaultLayout(api.current);
                    setMenus(false);
                  }}
                >
                  Reset layout
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              open("presets");
            }}
          >
            <Box size={14} /> Presets
          </button>
          <button onClick={() => open("themes")}>
            <Box size={14} /> Worlds
          </button>
          <button onClick={() => open("properties")}>
            <Settings2 size={14} /> Configure
          </button>
        </div>
        <div className="view-tabs">
          <button
            className={s.view === "authoring" ? "active" : ""}
            onClick={() => s.setView("authoring")}
          >
            Authoring
          </button>
          <button
            disabled={s.busy}
            className={s.view === "export" ? "active" : ""}
            onClick={async () => {
              if (!s.bundle) {
                const b = await s.prepareExport();
                if (!b) return;
              }
              s.setView("export");
            }}
          >
            Export preview <span>VP</span>
          </button>
        </div>
      </div>
      <div ref={workspace} className="dock-container world-first">
        {focused ? (
          <>
            <Viewport />
            <div className="world-tools" aria-label="World editing tools">
              {["presets", "world", "terrain", "materials", "rooms"].map(
                (id) => (
                  <button
                    key={id}
                    title={panelNames[id]}
                    onClick={() => open(id)}
                  >
                    {id === "presets"
                      ? "Build"
                      : id === "world"
                        ? "City"
                        : panelNames[id].split(" ")[0]}
                  </button>
                ),
              )}
              <button
                onClick={() => s.setMode(s.mode === "walk" ? "orbit" : "walk")}
              >
                {s.mode === "walk" ? "Edit" : "Walk"}
              </button>
              <button
                onClick={() =>
                  setRadial({
                    x: window.innerWidth / 2,
                    y: window.innerHeight / 2,
                    id: s.selected,
                  })
                }
              >
                Actions
              </button>
              <button
                onClick={() => {
                  setFocused(false);
                  setCard(null);
                  setRadial(null);
                }}
              >
                Advanced
              </button>
            </div>
            {!card && !radial && s.mode === "orbit" && (
              <div className="world-hint">
                Click to select · Right-click / long-press to edit · Esc to
                close
              </div>
            )}
            {s.project.world.enabled && (
              <div className="world-minimap" aria-label="Neighborhood overview">
                <b>Neighborhood</b>
                {(() => {
                  const plan = cityPlan(s.project);
                  return (
                    <svg
                      viewBox={`${-plan.extent} ${-plan.extent} ${plan.extent * 2} ${plan.extent * 2}`}
                      aria-label="Select a parcel from the map"
                    >
                      {plan.edges.map((edge) => {
                        const a = plan.nodes.find((n) => n.id === edge.from)!,
                          b = plan.nodes.find((n) => n.id === edge.to)!;
                        return (
                          <line
                            key={edge.id}
                            x1={a.x}
                            y1={-a.z}
                            x2={b.x}
                            y2={-b.z}
                            stroke="#819b9e"
                            strokeWidth={s.project.world.roadWidth}
                          />
                        );
                      })}
                      {plan.plots.map((plot) => (
                        <rect
                          key={plot.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`Select ${plot.id}`}
                          x={plot.x - plot.parcelWidth / 2}
                          y={-plot.z - plot.parcelDepth / 2}
                          width={plot.parcelWidth}
                          height={plot.parcelDepth}
                          fill={
                            s.selected?.startsWith(plot.id)
                              ? "#5eeee0"
                              : plot.park
                                ? "#729b56"
                                : "#d3d7c0"
                          }
                          onClick={() =>
                            s.select(
                              s.meshes.find((m) => m.id.startsWith(plot.id))
                                ?.id ?? null,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              s.select(
                                s.meshes.find((m) => m.id.startsWith(plot.id))
                                  ?.id ?? null,
                              );
                            }
                          }}
                        />
                      ))}
                    </svg>
                  );
                })()}
              </div>
            )}
            {card &&
              (() => {
                const Card = components[card as keyof typeof components];
                return (
                  <section className="world-card" aria-label={panelNames[card]}>
                    <header>
                      <b>{panelNames[card]}</b>
                      <button
                        aria-label="Close editing card"
                        onClick={() => setCard(null)}
                      >
                        <X size={18} />
                      </button>
                    </header>
                    <div>
                      <Card />
                    </div>
                  </section>
                );
              })()}
            {radial && (
              <>
                <button
                  className="world-dismiss"
                  aria-label="Close radial menu"
                  onClick={() => setRadial(null)}
                />
                <div
                  ref={radialElement}
                  className="world-radial"
                  onKeyDown={(e) => {
                    const buttons = Array.from(
                      e.currentTarget.querySelectorAll<HTMLButtonElement>(
                        "button",
                      ),
                    );
                    const index = buttons.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    if (
                      [
                        "ArrowRight",
                        "ArrowDown",
                        "ArrowLeft",
                        "ArrowUp",
                        "Tab",
                      ].includes(e.key)
                    ) {
                      e.preventDefault();
                      const backwards =
                        e.shiftKey ||
                        e.key === "ArrowLeft" ||
                        e.key === "ArrowUp";
                      buttons[
                        (index + (backwards ? -1 : 1) + buttons.length) %
                          buttons.length
                      ]?.focus();
                    }
                  }}
                  role="dialog"
                  aria-label="Object actions"
                  style={{
                    left: Math.max(
                      140,
                      Math.min(
                        radial.x -
                          (workspace.current?.getBoundingClientRect().left ??
                            0),
                        (workspace.current?.clientWidth ?? window.innerWidth) -
                          140,
                      ),
                    ),
                    top: Math.max(
                      0,
                      Math.min(
                        radial.y -
                          (workspace.current?.getBoundingClientRect().top ??
                            0) -
                          140,
                        (workspace.current?.clientHeight ??
                          window.innerHeight) - 280,
                      ),
                    ),
                  }}
                >
                  <div className="world-radial-orbit" aria-hidden="true" />
                  <div className="world-radial-center">
                    <Box size={25} />
                    <span>
                      {s.meshes.find((m) => m.id === radial.id)?.label ??
                        "World"}
                    </span>
                  </div>
                  {radialActions.map((id, i) => (
                    <button
                      key={id}
                      style={{
                        transform: `translate(${Math.cos(((i * 60 - 90) * Math.PI) / 180) * 103}px, ${Math.sin(((i * 60 - 90) * Math.PI) / 180) * 103}px)`,
                      }}
                      onClick={() => open(id)}
                    >
                      {(() => {
                        const Icon =
                          id === "materials"
                            ? Paintbrush
                            : id === "plants" || id === "themes"
                              ? Trees
                              : id === "world" || id === "terrain"
                                ? Map
                                : id === "rooms"
                                  ? Footprints
                                  : id === "building"
                                    ? Home
                                    : id === "properties"
                                      ? Settings2
                                      : Layers3;
                        return <Icon size={23} />;
                      })()}
                      <span>
                        {id === "properties"
                          ? "Configure"
                          : id === "world"
                            ? "Roads"
                            : id === "rooms"
                              ? "Interior"
                              : panelNames[id].split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <DockviewReact
            components={components}
            onReady={ready}
            theme={themeDark}
            disableFloatingGroups={false}
          />
        )}
      </div>
      <footer className="editor-status">
        <span>
          <i className="status-dot" /> {s.saveState}
        </span>
        <span>
          {s.project.width.toFixed(1)} × {s.project.depth.toFixed(1)} m
        </span>
        <span role="status" aria-live="polite">
          {s.generationStatus}
        </span>
        <span className="status-right">
          <Check size={12} /> WebGL workspace{" "}
          <span>VP profile: provisional</span>
        </span>
      </footer>
      {palette && (
        <div className="modal-backdrop" onClick={() => setPalette(false)}>
          <div
            className="command-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <Command size={18} />
              <input
                autoFocus
                placeholder="Search commands…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                onClick={() => setPalette(false)}
                aria-label="Close command palette"
              >
                <X size={16} />
              </button>
            </div>
            {commands
              .filter((c) =>
                c.label.toLowerCase().includes(query.toLowerCase()),
              )
              .map((c) => (
                <button
                  key={c.label}
                  onClick={() => {
                    c.run();
                    setPalette(false);
                    setQuery("");
                  }}
                >
                  {c.label}
                  <span>↵</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
export function Editor() {
  return (
    <StudioProvider>
      <EditorInner />
    </StudioProvider>
  );
}
