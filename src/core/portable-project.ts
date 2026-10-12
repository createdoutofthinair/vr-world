import JSZip from "jszip";
import { checkZipBudget } from "./zip-budget";
import { Project } from "./project";
import { packProject, unpackProject } from "./persistence";
import { pngBytes } from "./textures";
export async function createPortableProject(
  project: Project,
): Promise<Uint8Array> {
  const packed = await packProject(project),
    zip = new JSZip();
  zip.file(
    "c3-project.json",
    JSON.stringify(
      { format: "c3-project-assets-1", document: packed.document },
      null,
      2,
    ),
  );
  for (const [id, data] of packed.assets)
    zip.file(`c3-assets/${id}.png`, pngBytes(data));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
export async function readPortableProject(bytes: Uint8Array): Promise<Project> {
  if (bytes.length > 100_000_000)
    throw new Error("Portable project exceeds 100 MB compressed.");
  checkZipBudget(bytes, {
    compressed: 100_000_000,
    expanded: 200_000_000,
    file: 5_000_000,
    entries: 260,
  });
  const zip = await JSZip.loadAsync(bytes),
    paths = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
  if (
    paths.length > 256 ||
    paths.some(
      (path) =>
        path !== "c3-project.json" &&
        !/^c3-assets\/c3-asset-[a-f0-9]{64}\.png$/.test(path),
    )
  )
    throw new Error("Invalid portable project dependencies.");
  const file = zip.file("c3-project.json");
  if (!file) throw new Error("Missing portable project document.");
  const serialized = await file.async("string");
  if (serialized.length > 5_000_000)
    throw new Error("Portable project document exceeds 5 MB.");
  const input = JSON.parse(serialized);
  if (input.format !== "c3-project-assets-1")
    throw new Error("Unsupported portable project format.");
  return unpackProject(input.document, async (id) => {
    const asset = zip.file(`c3-assets/${id}.png`);
    if (!asset) return undefined;
    const bytes = await asset.async("uint8array");
    if (bytes.length > 2_000_000)
      throw new Error("Portable texture exceeds application budget.");
    return "data:image/png;base64," + (await asset.async("base64"));
  });
}
