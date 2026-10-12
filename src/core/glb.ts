import { MeshData, Project, materialsFor } from "./project";
import { decodePNG, encodePNG } from "./png";
import { pngBytes } from "./textures";
import { textureAlpha } from "./texture-alpha";
/** glTF 2.0 / GLB, right-handed metres. Static authored snapshot; actions remain metadata. */
export function serializeGLB(
  project: Project,
  meshes: MeshData[],
  diffuse: Record<string, string>,
): Uint8Array {
  const specs = materialsFor(project),
    chunks: Uint8Array[] = [],
    views: Record<string, unknown>[] = [],
    accessors: Record<string, unknown>[] = [],
    images: Record<string, unknown>[] = [],
    textures: Record<string, unknown>[] = [],
    materials: Record<string, unknown>[] = [],
    geometries: Record<string, unknown>[] = [],
    nodes: Record<string, unknown>[] = [],
    textureCache = new Map<string, number>(),
    materialCache = new Map<string, number>(),
    meshCache = new Map<string, number>();
  let offset = 0;
  const append = (bytes: Uint8Array, target?: number) => {
    const padded = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
    padded.set(bytes);
    const id = views.length;
    views.push({
      buffer: 0,
      byteOffset: offset,
      byteLength: bytes.length,
      ...(target ? { target } : {}),
    });
    chunks.push(padded);
    offset += padded.length;
    return id;
  };
  const texture = (url: string, clamp = false) => {
    const key = url + clamp,
      cached = textureCache.get(key);
    if (cached !== undefined) return cached;
    // Browser uploads use flipY; bake that row reversal instead of reversing
    // UV handedness, which would also reverse the tangent normal basis.
    const img = decodePNG(pngBytes(url)),
      flipped = new Uint8Array(img.pixels.length);
    for (let y = 0; y < img.height; y++)
      flipped.set(
        img.pixels.subarray(y * img.width * 4, (y + 1) * img.width * 4),
        (img.height - 1 - y) * img.width * 4,
      );
    const view = append(encodePNG({ ...img, pixels: flipped }));
    images.push({ bufferView: view, mimeType: "image/png" });
    const id = textures.length;
    textures.push({ source: images.length - 1, sampler: clamp ? 1 : 0 });
    textureCache.set(key, id);
    return id;
  };
  const imageData = (bytes: Uint8Array) =>
    "data:image/png;base64," +
    btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""));
  const color = (hex: string) =>
    [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  const attribute = (
    values: number[],
    size: number,
    type: string,
    indices = false,
    bounds = false,
  ) => {
    const data = indices ? new Uint32Array(values) : new Float32Array(values),
      view = append(new Uint8Array(data.buffer), indices ? 34963 : 34962),
      accessor: Record<string, unknown> = {
        bufferView: view,
        componentType: indices ? 5125 : 5126,
        count: values.length / size,
        type,
      };
    if (bounds) {
      const min = Array(size).fill(Infinity),
        max = Array(size).fill(-Infinity);
      for (let i = 0; i < data.length; i++) {
        const k = i % size;
        min[k] = Math.min(min[k], data[i]);
        max[k] = Math.max(max[k], data[i]);
      }
      accessor.min = min;
      accessor.max = max;
    }
    accessors.push(accessor);
    return accessors.length - 1;
  };
  const combinedMaps = (
    rough: string | undefined,
    metal: string | undefined,
  ) => {
    const r = rough ? decodePNG(pngBytes(rough)) : null,
      m = metal ? decodePNG(pngBytes(metal)) : null,
      width = Math.max(r?.width ?? 1, m?.width ?? 1),
      height = Math.max(r?.height ?? 1, m?.height ?? 1),
      pixels = new Uint8Array(width * height * 4);
    const sample = (
      img: NonNullable<typeof r> | null,
      x: number,
      y: number,
      channel: number,
    ) =>
      img
        ? img.pixels[
            (Math.floor((y * img.height) / height) * img.width +
              Math.floor((x * img.width) / width)) *
              4 +
              channel
          ]
        : 255;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        pixels.set(
          [255, sample(r, x, y, 1), sample(m, x, y, 2), 255],
          (y * width + x) * 4,
        );
    return imageData(encodePNG({ width, height, pixels }));
  };
  for (const part of meshes) {
    if (!part.positions.length || !part.indices.length) continue;
    const spec = specs[part.material],
      url = diffuse[part.id];
    if (!url) throw new Error(`Missing GLB diffuse texture for ${part.id}.`);
    const maps = project.materialMaps[part.material],
      clamp = !!part.bakedTexture,
      materialKey = JSON.stringify([
        part.material,
        part.materialColor,
        url,
        clamp,
      ]);
    let material = materialCache.get(materialKey);
    if (material === undefined) {
      const alpha = textureAlpha(url),
        mat: Record<string, unknown> = {
          name: `c3-${part.material}`,
          pbrMetallicRoughness: {
            baseColorFactor: [
              ...color(part.materialColor ?? spec.color),
              spec.opacity,
            ],
            baseColorTexture: { index: texture(url, clamp) },
            roughnessFactor: spec.roughness ?? 0.84,
            metallicFactor: spec.metalness ?? 0,
          },
          alphaMode:
            spec.opacity < 1 || alpha === "blend"
              ? "BLEND"
              : alpha === "mask"
                ? "MASK"
                : "OPAQUE",
          ...(alpha === "mask" && spec.opacity >= 1
            ? { alphaCutoff: 0.5 }
            : {}),
        };
      const pbr = mat.pbrMetallicRoughness as Record<string, unknown>;
      if (maps?.roughness || maps?.metalness)
        pbr.metallicRoughnessTexture = {
          index: texture(
            combinedMaps(maps.roughness?.dataUrl, maps.metalness?.dataUrl),
          ),
        };
      if (maps?.normal) {
        let normal = maps.normal.dataUrl;
        if (maps.normalConvention === "directx") {
          const img = decodePNG(pngBytes(normal));
          for (let i = 1; i < img.pixels.length; i += 4)
            img.pixels[i] = 255 - img.pixels[i];
          normal = imageData(encodePNG(img));
        }
        mat.normalTexture = { index: texture(normal) };
      }
      if (maps?.emissive) {
        mat.emissiveTexture = { index: texture(maps.emissive.dataUrl) };
        mat.emissiveFactor = [1, 1, 1];
      }
      material = materials.length;
      materials.push(mat);
      materialCache.set(materialKey, material);
    }
    const shape = JSON.stringify([
      part.positions,
      part.uvs,
      part.indices,
      material,
      spec.scale,
      clamp,
    ]);
    let mesh = meshCache.get(shape);
    if (mesh === undefined) {
      const normals = Array(part.positions.length).fill(0);
      for (let i = 0; i < part.indices.length; i += 3) {
        const [a, b, c] = part.indices.slice(i, i + 3).map((v) => v * 3),
          v = part.positions,
          ux = v[b] - v[a],
          uy = v[b + 1] - v[a + 1],
          uz = v[b + 2] - v[a + 2],
          vx = v[c] - v[a],
          vy = v[c + 1] - v[a + 1],
          vz = v[c + 2] - v[a + 2],
          n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
        for (const index of [a, b, c])
          for (let k = 0; k < 3; k++) normals[index + k] += n[k];
      }
      for (let i = 0; i < normals.length; i += 3) {
        const length =
          Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
        for (let k = 0; k < 3; k++) normals[i + k] /= length;
      }
      const scale = clamp ? 1 : (spec.scale ?? 1),
        uvs = part.uvs.map((v) => v / scale);
      geometries.push({
        name: `c3-mesh-${geometries.length}`,
        primitives: [
          {
            attributes: {
              POSITION: attribute(part.positions, 3, "VEC3", false, true),
              NORMAL: attribute(normals, 3, "VEC3"),
              TEXCOORD_0: attribute(uvs, 2, "VEC2"),
            },
            indices: attribute(part.indices, 1, "SCALAR", true),
            material,
            mode: 4,
          },
        ],
      });
      mesh = geometries.length - 1;
      meshCache.set(shape, mesh);
    }
    nodes.push({
      name: `c3-${part.id.replace(/^c3-/, "")}`,
      mesh,
      translation: part.origin,
      extras: {
        sourceId: part.id,
        solid: part.solid,
        walkable: part.walkable ?? false,
        action: part.action ?? null,
        category: part.category,
      },
    });
  }
  if (!nodes.length) throw new Error("GLB scene is empty.");
  const document = {
    asset: {
      version: "2.0",
      generator: "c3 World Studio 0.5",
      extras: {
        units: "metres",
        actions:
          "static authored geometry; action strings are metadata, not glTF animations",
      },
    },
    scene: 0,
    scenes: [{ name: project.name, nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: geometries,
    materials,
    images,
    textures,
    samplers: [
      { wrapS: 10497, wrapT: 10497, magFilter: 9729, minFilter: 9987 },
      { wrapS: 33071, wrapT: 33071, magFilter: 9729, minFilter: 9987 },
    ],
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: offset }],
  };
  const json = new TextEncoder().encode(JSON.stringify(document)),
    jsonSize = Math.ceil(json.length / 4) * 4,
    total = 12 + 8 + jsonSize + 8 + offset,
    bytes = new Uint8Array(total),
    header = new DataView(bytes.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, total, true);
  header.setUint32(12, jsonSize, true);
  header.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + jsonSize);
  bytes.set(json, 20);
  header.setUint32(20 + jsonSize, offset, true);
  header.setUint32(24 + jsonSize, 0x004e4942, true);
  let at = 28 + jsonSize;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}
