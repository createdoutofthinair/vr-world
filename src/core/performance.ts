export interface PerformanceSample {
  time: number;
  frameMS: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  width: number;
  height: number;
  pixelRatio: number;
  renderer: string;
}
let latest: PerformanceSample | null = null;
const listeners = new Set<() => void>(),
  history: PerformanceSample[] = [];
export function publishPerformance(sample: PerformanceSample) {
  latest = sample;
  history.push(sample);
  if (history.length > 240) history.shift();
  for (const listener of listeners) listener();
}
export function performanceSnapshot() {
  return latest;
}
export function subscribePerformance(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function performanceReport() {
  const frames = history.map((s) => s.frameMS).sort((a, b) => a - b);
  return {
    status:
      "Measured in this browser; native VP and visual review are separate",
    samples: history,
    latest,
    medianFrameMS: frames[Math.floor(frames.length * 0.5)] ?? null,
    p95FrameMS: frames[Math.floor(frames.length * 0.95)] ?? null,
    browser:
      typeof navigator !== "undefined" ? navigator.userAgent : "unavailable",
    timestamp: new Date().toISOString(),
  };
}
