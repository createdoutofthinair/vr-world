import { useSyncExternalStore } from "react";
import { useStudio } from "./store";
import {
  subscribePerformance,
  performanceSnapshot,
  performanceReport,
} from "../core/performance";
import { download } from "../core/package";
export function PerformanceStudio() {
  const s = useStudio(),
    sample = useSyncExternalStore(
      subscribePerformance,
      performanceSnapshot,
      performanceSnapshot,
    ),
    triangles = s.meshes.reduce((n, m) => n + m.indices.length / 3, 0);
  return (
    <div className="panel-pad properties">
      <div className="panel-eyebrow">LIVE RENDER MEASUREMENTS</div>
      <p className="panel-note">
        Measurements come from this viewport and hardware. Expanded RWX geometry
        remains separate from batched rendering statistics.
      </p>
      <div className="export-stats">
        <div>
          <b>{sample ? sample.frameMS.toFixed(1) : "—"}</b>
          <span>frame ms</span>
        </div>
        <div>
          <b>{sample?.drawCalls ?? "—"}</b>
          <span>draw calls</span>
        </div>
        <div>
          <b>{sample?.textures ?? "—"}</b>
          <span>GPU textures</span>
        </div>
      </div>
      <p className="panel-note">
        {sample?.renderer ?? "Open the 3D viewport to measure."}
        <br />
        {sample?.width ?? 0} × {sample?.height ?? 0} · pixel ratio{" "}
        {sample?.pixelRatio ?? 0}
        <br />
        {sample?.geometries ?? 0} resident geometries ·{" "}
        {(triangles / 1000).toFixed(1)}K expanded triangles · {s.meshes.length}{" "}
        placements
      </p>
      <p className="panel-note">
        {s.generationStatus}. Generation jobs are replaced on new edits; a
        failed job retains the previous committed scene.
      </p>
      <button
        className="small-button full"
        onClick={() =>
          download(
            "c3-browser-performance.json",
            JSON.stringify(performanceReport(), null, 2),
            "application/json",
          )
        }
      >
        Download measured performance report
      </button>
      <div className="form-section">Release proof gates</div>
      <p className="panel-note">
        Browser visual, docking, accessibility and long-session inspection still
        require recorded observations. Native VP scale, groups, rotation and
        collision comparison require client fixtures. This panel does not mark
        those gates passed.
      </p>
    </div>
  );
}
