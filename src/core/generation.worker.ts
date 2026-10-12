import { buildScene } from "./geometry";
import { validateProject } from "./project";
import { restoreStandardSnapshot } from "./standard-textures";
self.onmessage = (event: MessageEvent) => {
  const { id, project, standards } = event.data;
  try {
    restoreStandardSnapshot(standards);
    const clean = validateProject(project),
      start = performance.now(),
      meshes = buildScene(clean);
    self.postMessage({ id, meshes, duration: performance.now() - start });
  } catch (error) {
    self.postMessage({ id, error: (error as Error).message });
  }
};
