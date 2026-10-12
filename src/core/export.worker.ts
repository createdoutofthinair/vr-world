import { createPackage } from "./package";
import { validateProject } from "./project";
import { restoreStandardSnapshot } from "./standard-textures";
self.onmessage = async (event: MessageEvent) => {
  try {
    const { project, standards, images, mode, settings } = event.data;
    restoreStandardSnapshot(standards);
    const bundle = await createPackage(validateProject(project), {
      ...settings,
      images,
      previewMode: mode,
      progress: (stage, percent) => self.postMessage({ stage, percent }),
    });
    self.postMessage(
      { bundle },
      { transfer: [bundle.bytes.buffer as ArrayBuffer] },
    );
  } catch (error) {
    self.postMessage({ error: (error as Error).message });
  }
};
