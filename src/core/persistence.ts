import { Project, TextureAsset, validateProject } from "./project";
import { pngBytes, sha256 } from "./textures";
const DATABASE = "c3-world-studio",
  VERSION = 2;
const hashCache = new Map<string, Promise<string>>();
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    let blocked = false;
    const request = indexedDB.open(DATABASE, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of ["projects", "versions", "assets"])
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Database could not open"));
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Close older editor tabs to upgrade project storage."));
    };
  });
}
function write(
  db: IDBDatabase,
  stores: string[],
  run: (tx: IDBTransaction) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error ?? new Error("Storage transaction failed"));
    tx.onabort = () =>
      reject(tx.error ?? new Error("Storage transaction aborted"));
    try {
      run(tx);
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
function read(
  db: IDBDatabase,
  store: string,
  key: IDBValidKey,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(store, "readonly")
      .objectStore(store)
      .get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Stored record could not be read"));
  });
}
export async function packProject(
  project: Project,
): Promise<{ document: unknown; assets: Map<string, string> }> {
  const references = new Map<string, string>(),
    assets = new Map<string, string>(),
    collection: TextureAsset[] = [
      ...Object.values(project.textures),
      ...Object.values(project.materialMaps).flatMap((m) =>
        m ? [m.normal, m.roughness, m.metalness, m.emissive] : [],
      ),
      ...project.signs.flatMap((s) => [s.asset, s.artwork]),
    ].filter(Boolean) as TextureAsset[];
  for (const asset of collection) {
    if (references.has(asset.dataUrl)) continue;
    let hash = hashCache.get(asset.dataUrl);
    if (!hash) {
      hash = sha256(pngBytes(asset.dataUrl));
      hashCache.set(asset.dataUrl, hash);
      if (hashCache.size > 32) hashCache.delete(hashCache.keys().next().value!);
    }
    const id = "c3-asset-" + (await hash);
    references.set(asset.dataUrl, id);
    assets.set(id, asset.dataUrl);
  }
  const document = JSON.parse(
    JSON.stringify(project, (_, value) =>
      value &&
      typeof value === "object" &&
      typeof value.dataUrl === "string" &&
      references.has(value.dataUrl)
        ? {
            $c3Asset: references.get(value.dataUrl),
            name: value.name,
            width: value.width,
            height: value.height,
          }
        : value,
    ),
  );
  return { document, assets };
}
export async function unpackProject(
  input: unknown,
  resolveAsset: (id: string) => Promise<unknown>,
): Promise<Project> {
  const cache = new Map<string, string>();
  async function expand(value: unknown): Promise<unknown> {
    if (Array.isArray(value)) return Promise.all(value.map(expand));
    if (value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      if (typeof v.$c3Asset === "string") {
        let data = cache.get(v.$c3Asset);
        if (!data) {
          if (!/^c3-asset-[a-f0-9]{64}$/.test(v.$c3Asset))
            throw new Error("Invalid stored asset reference.");
          const stored = await resolveAsset(v.$c3Asset);
          if (typeof stored !== "string")
            throw new Error(
              "Missing stored texture. Download a recovery copy before replacing it.",
            );
          if ("c3-asset-" + (await sha256(pngBytes(stored))) !== v.$c3Asset)
            throw new Error(
              "Stored asset hash mismatch. Restore a prior version or portable project.",
            );
          data = stored;
          cache.set(v.$c3Asset, data);
        }
        return {
          name: v.name,
          width: v.width,
          height: v.height,
          dataUrl: data,
        };
      }
      return Object.fromEntries(
        await Promise.all(
          Object.entries(v).map(async ([key, item]) => [
            key,
            await expand(item),
          ]),
        ),
      );
    }
    return value;
  }
  return validateProject(await expand(input));
}
async function unpack(db: IDBDatabase, input: unknown): Promise<Project> {
  return unpackProject(input, (id) => read(db, "assets", id));
}
export async function saveProject(project: Project): Promise<void> {
  const packed = await packProject(project),
    db = await open();
  try {
    await write(db, ["projects", "assets"], (tx) => {
      for (const [id, data] of packed.assets)
        tx.objectStore("assets").put(data, id);
      const store = tx.objectStore("projects"),
        previous = store.get("current");
      previous.onsuccess = () => {
        if (previous.result) store.put(previous.result, "previous");
        store.put(packed.document, "current");
        store.put(
          { schema: 3, time: new Date().toISOString(), name: project.name },
          "metadata",
        );
      };
    });
  } finally {
    db.close();
  }
}
export async function loadProject(previous = false): Promise<Project | null> {
  const db = await open();
  try {
    const stored = await read(
      db,
      "projects",
      previous ? "previous" : "current",
    );
    return stored ? await unpack(db, stored) : null;
  } finally {
    db.close();
  }
}
export async function saveVersion(project: Project): Promise<string> {
  const packed = await packProject(project),
    db = await open(),
    id = "c3-version-" + crypto.randomUUID();
  try {
    const existing = await versionMetadata(db);
    if (existing.length >= 20)
      throw new Error(
        "Twenty saved versions already exist. Remove one before creating another.",
      );
    await write(db, ["versions", "assets"], (tx) => {
      for (const [key, data] of packed.assets)
        tx.objectStore("assets").put(data, key);
      tx.objectStore("versions").put(
        {
          id,
          time: new Date().toISOString(),
          name: project.name,
          document: packed.document,
        },
        id,
      );
    });
    return id;
  } finally {
    db.close();
  }
}
export interface SavedVersion {
  id: string;
  time: string;
  name: string;
}
function versionMetadata(db: IDBDatabase): Promise<SavedVersion[]> {
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("versions", "readonly")
      .objectStore("versions")
      .getAll();
    request.onsuccess = () =>
      resolve(
        request.result
          .map((v) => ({ id: v.id, time: v.time, name: v.name }))
          .sort((a: SavedVersion, b: SavedVersion) =>
            b.time.localeCompare(a.time),
          ),
      );
    request.onerror = () =>
      reject(request.error ?? new Error("Version list failed"));
  });
}
export async function versions(): Promise<SavedVersion[]> {
  const db = await open();
  try {
    return await versionMetadata(db);
  } finally {
    db.close();
  }
}
export async function loadVersion(id: string): Promise<Project> {
  const db = await open();
  try {
    const value = (await read(db, "versions", id)) as
      { document?: unknown; project?: unknown } | undefined;
    if (!value) throw new Error("Saved version missing.");
    return await unpack(db, value.document ?? value.project);
  } finally {
    db.close();
  }
}
export async function removeVersion(id: string): Promise<void> {
  const db = await open();
  try {
    await write(db, ["versions"], (tx) =>
      tx.objectStore("versions").delete(id),
    );
  } finally {
    db.close();
  }
}
export async function collectUnusedAssets(): Promise<number> {
  const db = await open();
  let removed = 0;
  try {
    await write(db, ["projects", "versions", "assets"], (tx) => {
      const docs = tx.objectStore("projects").getAll(),
        revisions = tx.objectStore("versions").getAll(),
        keys = tx.objectStore("assets").getAllKeys();
      let ready = 0;
      const finish = () => {
        if (++ready !== 3) return;
        const used = new Set<string>();
        const inspect = (value: unknown) => {
          if (Array.isArray(value)) value.forEach(inspect);
          else if (value && typeof value === "object") {
            const v = value as Record<string, unknown>;
            if (typeof v.$c3Asset === "string") used.add(v.$c3Asset);
            else Object.values(v).forEach(inspect);
          }
        };
        docs.result.forEach(inspect);
        revisions.result.forEach(inspect);
        for (const key of keys.result)
          if (typeof key === "string" && !used.has(key)) {
            tx.objectStore("assets").delete(key);
            removed++;
          }
      };
      docs.onsuccess = finish;
      revisions.onsuccess = finish;
      keys.onsuccess = finish;
    });
    return removed;
  } finally {
    db.close();
  }
}
