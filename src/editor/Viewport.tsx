import { textureAlpha } from "../core/texture-alpha";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import {
  Crosshair,
  Maximize2,
  MousePointer2,
  PersonStanding,
  RotateCcw,
  Eye,
  Layers3,
} from "lucide-react";
import {
  MeshData,
  materialsFor,
  MaterialRole,
  Vec3,
  BIOMES,
} from "../core/project";
import { moveWalker, bounds, findWalkSpawn } from "../core/geometry";
import { textureImage } from "../core/textures";
import { useStudio, clockSeconds } from "./store";
import { ActionRuntime } from "../core/actions";
import { floorElevation } from "../core/building";
import { publishPerformance } from "../core/performance";

function disposeGroup(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(),
    mats = new Set<THREE.Material>(),
    maps = new Set<THREE.Texture>();
  group.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        mats.add(m);
        for (const value of Object.values(m))
          if (value instanceof THREE.Texture) maps.add(value);
      }
      if (o instanceof THREE.InstancedMesh) o.dispose();
    }
  });
  geometries.forEach((g) => g.dispose());
  mats.forEach((m) => m.dispose());
  maps.forEach((t) => t.dispose());
  group.clear();
}
interface Runtime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  walk: PointerLockControls;
  group: THREE.Group;
  frame: (buildingOnly?: boolean) => void;
  light: THREE.DirectionalLight;
  grid: THREE.GridHelper;
  navigation?: Set<string>;
  actions?: ActionRuntime;
  bindings?: Map<string, THREE.Object3D>;
}
export function Viewport() {
  const s = useStudio(),
    container = useRef<HTMLDivElement>(null),
    runtime = useRef<Runtime | null>(null),
    current = useRef(s),
    [error, setError] = useState(""),
    [locked, setLocked] = useState(false),
    [touch, setTouch] = useState(false),
    touchActive = useRef(false),
    cameraRestored = useRef(false),
    skipInitialFrame = useRef(false),
    [showGrid, setShowGrid] = useState(false),
    [coords, setCoords] = useState("0.0, 0.0, 0.0"),
    [contextRevision, setContextRevision] = useState(0);
  const inspectionFloor =
    s.inspectionLevel === null
      ? null
      : Math.min(
          s.inspectionLevel,
          Math.max(
            s.renderProject.structure.storeys,
            ...s.meshes.map((mesh) => (mesh.level ?? 0) + 1),
          ) - 1,
        );
  current.current = s;
  touchActive.current = touch;
  useEffect(() => {
    const host = container.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setError(
        "WebGL could not start. Enable hardware acceleration or try another browser. Your project and export controls remain available.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#d5dcd9");
    scene.fog = new THREE.Fog("#d5dcd9", 40, 100);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.05, 200),
      orbit = new OrbitControls(camera, renderer.domElement),
      walk = new PointerLockControls(camera, renderer.domElement);
    camera.rotation.order = "YXZ";
    renderer.domElement.style.touchAction = "none";
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.08;
    orbit.maxDistance = 90;
    orbit.minDistance = 1;
    orbit.maxPolarAngle = Math.PI / 2 - 0.03;
    const group = new THREE.Group();
    scene.add(group);
    scene.add(new THREE.HemisphereLight("#e8f1ff", "#766957", 1.7));
    const light = new THREE.DirectionalLight("#fff0d6", 3.2);
    light.position.set(-15, 26, 12);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, {
      left: -35,
      right: 35,
      top: 35,
      bottom: -35,
      near: 0.5,
      far: 70,
    });
    light.shadow.normalBias = 0.018;
    light.shadow.bias = -0.00008;
    scene.add(light);
    const grid = new THREE.GridHelper(60, 60, "#829a91", "#a0afa7");
    grid.position.y = -0.017;
    grid.visible = false;
    scene.add(grid);
    const frame = (buildingOnly = false) => {
      walk.unlock();
      orbit.enabled = true;
      const state = current.current;
      const meshes =
        state.view === "export" && state.bundle
          ? state.bundle.meshes
          : state.meshes;
      const selected = buildingOnly
        ? meshes.filter((m) =>
            ["structure", "windows", "roof", "interior"].includes(m.category),
          )
        : meshes;
      const box = new THREE.Box3();
      for (const mesh of selected) {
        const b = bounds(mesh);
        box.expandByPoint(new THREE.Vector3(...b.min));
        box.expandByPoint(new THREE.Vector3(...b.max));
      }
      if (box.isEmpty())
        box.set(new THREE.Vector3(-5, 0, -5), new THREE.Vector3(5, 3, 5));
      const center = box.getCenter(new THREE.Vector3()),
        size = box.getSize(new THREE.Vector3());
      const distance = Math.max(size.x, size.z, size.y * 1.5) * 1.4;
      if (scene.fog instanceof THREE.Fog) {
        scene.fog.near = Math.max(55, distance * 0.9);
        scene.fog.far = Math.max(140, distance * 2.5);
      }
      camera.far = Math.max(200, distance * 5);
      camera.updateProjectionMatrix();
      orbit.maxDistance = Math.max(90, distance * 3);
      camera.position
        .copy(center)
        .add(
          new THREE.Vector3(distance * 0.65, distance * 0.7, distance * 0.9),
        );
      orbit.target.copy(center);
      orbit.update();
    };
    runtime.current = {
      renderer,
      scene,
      camera,
      orbit,
      walk,
      group,
      frame,
      light,
      grid,
    };
    frame();
    const snapshot = current.current.cameraState.current;
    if (snapshot && snapshot.mode === current.current.mode) {
      camera.position.fromArray(snapshot.position);
      orbit.target.fromArray(snapshot.target);
      orbit.update();
      camera.quaternion.fromArray(snapshot.quaternion);
      cameraRestored.current = true;
      skipInitialFrame.current = true;
    }
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);
    const keys = new Set<string>();
    runtime.current.navigation = keys;
    const down = (e: KeyboardEvent) => {
        if (
          (e.target as HTMLElement).closest(
            "input,textarea,select,[contenteditable=true]",
          )
        )
          return;
        if (
          (walk.isLocked || touchActive.current) &&
          !current.current.generating
        ) {
          if (e.code === "KeyE" && !e.repeat && current.current.mode === "walk")
            current.current.interactDoor(camera.position.toArray() as Vec3);
          keys.add(e.code);
          if (
            [
              "KeyW",
              "KeyA",
              "KeyS",
              "KeyD",
              "ArrowUp",
              "ArrowDown",
              "ArrowLeft",
              "ArrowRight",
              "Space",
            ].includes(e.code)
          )
            e.preventDefault();
        }
      },
      up = (e: KeyboardEvent) => keys.delete(e.code),
      blur = () => keys.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    const onLock = () => {
        orbit.enabled = false;
        setLocked(true);
        keys.clear();
      },
      onUnlock = () => {
        setLocked(false);
        keys.clear();
        orbit.enabled = current.current.mode === "orbit";
      };
    walk.addEventListener("lock", onLock);
    walk.addEventListener("unlock", onUnlock);
    let px = 0,
      py = 0;
    const ray = new THREE.Raycaster();
    let touchLook: [number, number] | null = null;
    const pointerDown = (e: PointerEvent) => {
      if (touchActive.current && e.pointerType === "touch") {
        touchLook = [e.clientX, e.clientY];
        renderer.domElement.setPointerCapture(e.pointerId);
      }
      px = e.clientX;
      py = e.clientY;
    };
    const pointerMove = (e: PointerEvent) => {
      if (!touchActive.current || !touchLook) return;
      camera.rotation.y -= (e.clientX - touchLook[0]) * 0.005;
      camera.rotation.x = Math.max(
        -Math.PI / 2 + 0.05,
        Math.min(
          Math.PI / 2 - 0.05,
          camera.rotation.x - (e.clientY - touchLook[1]) * 0.005,
        ),
      );
      touchLook = [e.clientX, e.clientY];
    };
    const pointerUp = (e: PointerEvent) => {
      touchLook = null;
      if (
        current.current.mode !== "orbit" ||
        Math.hypot(e.clientX - px, e.clientY - py) > 5
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects(group.children, false)
        .find(
          (h) =>
            h.object.visible && (h.object.userData.id || h.object.userData.ids),
        );
      current.current.select(
        hit
          ? (hit.object.userData.id ??
              hit.object.userData.ids[hit.instanceId ?? 0])
          : null,
      );
    };
    const contextMenu = (e: MouseEvent) => {
      if (current.current.mode !== "orbit") return;
      e.preventDefault();
      const rect = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hit = ray
        .intersectObjects(group.children, false)
        .find(
          (h) =>
            h.object.visible && (h.object.userData.id || h.object.userData.ids),
        );
      const id = hit
        ? (hit.object.userData.id ??
          hit.object.userData.ids[hit.instanceId ?? 0])
        : null;
      current.current.select(id);
      window.dispatchEvent(
        new CustomEvent("c3-context", {
          detail: { x: e.clientX, y: e.clientY, id },
        }),
      );
    };
    renderer.domElement.addEventListener("contextmenu", contextMenu);
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointercancel", pointerUp);
    const lost = (e: Event) => {
      e.preventDefault();
      walk.unlock();
      keys.clear();
      setTouch(false);
      setError("Graphics context interrupted. Waiting for recovery…");
    };
    const restored = () => {
      setError("");
      setContextRevision((v) => v + 1);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    renderer.domElement.addEventListener("webglcontextrestored", restored);
    let tick = 0,
      last = performance.now();
    let perfTick = 0,
      frameSum = 0,
      frameCount = 0;
    const gpu = renderer.getContext(),
      gpuExtension = gpu.getExtension("WEBGL_debug_renderer_info"),
      gpuName = gpuExtension
        ? String(gpu.getParameter(gpuExtension.UNMASKED_RENDERER_WEBGL))
        : String(gpu.getParameter(gpu.RENDERER));
    renderer.setAnimationLoop((now) => {
      frameSum += now - last;
      frameCount++;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const state = current.current;
      const elapsed = clockSeconds(state.simulation, now);
      if (runtime.current?.actions && runtime.current.bindings)
        for (const [id, object] of runtime.current.bindings) {
          try {
            const pose = runtime.current.actions.snapshot(
              id,
              elapsed,
              state.simulation.rotation,
            );
            object.position.fromArray(pose.position);
            object.rotation.set(...pose.rotation);
            object.visible = pose.visible;
          } catch (error) {
            setError((error as Error).message);
          }
        }
      if ((walk.isLocked || touchActive.current) && !state.generating) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        if (state.mode !== "fly") forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3()
          .crossVectors(forward, camera.up)
          .normalize();
        let f =
            (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
            (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
          r =
            (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
            (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
        const norm = Math.max(1, Math.hypot(f, r));
        f /= norm;
        r /= norm;
        const speed = (keys.has("ShiftLeft") ? 4 : 2.2) * dt;
        const meshes =
          state.view === "export" && state.bundle
            ? state.bundle.meshes
            : state.meshes;
        if (state.mode === "fly") {
          camera.position
            .addScaledVector(forward, f * speed)
            .addScaledVector(right, r * speed);
          camera.position.y +=
            ((keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0)) * speed;
        } else {
          const moved = moveWalker(
            camera.position.toArray() as Vec3,
            [
              (forward.x * f + right.x * r) * speed,
              (forward.z * f + right.z * r) * speed,
            ],
            meshes,
          );
          camera.position.fromArray(moved);
        }
      } else if (orbit.enabled) orbit.update();
      if (now - tick > 200) {
        setCoords(
          camera.position
            .toArray()
            .map((v) => v.toFixed(1))
            .join(", "),
        );
        tick = now;
      }
      if (
        host.clientWidth &&
        host.clientHeight &&
        !document.hidden &&
        !renderer.getContext().isContextLost()
      )
        renderer.render(scene, camera);
      if (now - perfTick > 500) {
        publishPerformance({
          time: now / 1000,
          frameMS: frameSum / Math.max(1, frameCount),
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
          width: host.clientWidth,
          height: host.clientHeight,
          pixelRatio: renderer.getPixelRatio(),
          renderer: gpuName,
        });
        perfTick = now;
        frameSum = 0;
        frameCount = 0;
      }
    });
    return () => {
      current.current.cameraState.current = {
        position: camera.position.toArray() as Vec3,
        target: orbit.target.toArray() as Vec3,
        quaternion: camera.quaternion.toArray() as [
          number,
          number,
          number,
          number,
        ],
        mode: current.current.mode,
      };
      renderer.setAnimationLoop(null);
      walk.unlock();
      resize.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("contextmenu", contextMenu);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      renderer.domElement.removeEventListener("webglcontextrestored", restored);
      walk.dispose();
      orbit.dispose();
      disposeGroup(group);
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      light.shadow.map?.dispose();
      if (scene.background instanceof THREE.Texture) scene.background.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    const { group } = rt;
    disposeGroup(group);
    const exported = s.view === "export" && s.bundle,
      meshes = exported ? s.bundle!.meshes : s.meshes,
      specs = exported ? s.bundle!.specs : materialsFor(s.renderProject),
      loader = new THREE.TextureLoader(),
      cache = new Map<string, THREE.MeshStandardMaterial>(),
      geometryCache = new Map<string, THREE.BufferGeometry>(),
      batches = new Map<
        string,
        {
          geometry: THREE.BufferGeometry;
          material: THREE.MeshStandardMaterial;
          parts: MeshData[];
        }
      >();
    rt.actions = new ActionRuntime(meshes);
    rt.bindings = new Map();
    for (const part of meshes) {
      if (part.category === "roof" && s.cutaway) continue;
      if (
        s.mode !== "walk" &&
        s.cutaway &&
        inspectionFloor !== null &&
        ["structure", "windows", "interior"].includes(part.category) &&
        (part.level ?? 0) !== inspectionFloor
      )
        continue;
      const spec = specs[part.material];
      const materialKey =
        part.material +
        ":" +
        (part.materialColor ?? spec.color) +
        ":" +
        (part.bakedTexture ? part.id : (part.textureRef ?? ""));
      let mat = cache.get(materialKey);
      if (!mat) {
        const data = exported
          ? (s.bundle!.textureImages[part.textureRef ?? ""] ??
            s.bundle!.images[part.material])
          : (part.bakedTexture?.dataUrl ?? textureImage(spec, s.renderProject));
        const texture = loader.load(data);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT =
          part.bakedTexture || part.textureRef?.startsWith("c3-terrain-")
            ? THREE.ClampToEdgeWrapping
            : THREE.RepeatWrapping;
        texture.anisotropy = Math.min(
          8,
          rt.renderer.capabilities.getMaxAnisotropy(),
        );
        if (!part.bakedTexture && !part.textureRef?.startsWith("c3-terrain-"))
          texture.repeat.set(1 / (spec.scale ?? 1), 1 / (spec.scale ?? 1));
        const alpha = textureAlpha(data),
          transparent = spec.opacity < 1 || alpha === "blend";
        mat = new THREE.MeshStandardMaterial({
          color: part.materialColor ?? spec.color,
          map: texture,
          roughness: exported ? 0.84 : (spec.roughness ?? 0.84),
          metalness: exported ? 0 : (spec.metalness ?? 0),
          transparent,
          alphaTest: alpha === "mask" ? 0.5 : alpha === "blend" ? 0.01 : 0,
          opacity: spec.opacity,
          depthWrite: !transparent,
        });
        const maps = !exported
          ? s.renderProject.materialMaps[part.material]
          : undefined;
        if (maps) {
          const load = (
            asset: { dataUrl: string } | undefined,
            color = false,
          ) => {
            if (!asset) return null;
            const t = loader.load(asset.dataUrl);
            t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.copy(texture.repeat);
            return t;
          };
          mat.normalMap = load(maps.normal);
          mat.roughnessMap = load(maps.roughness);
          mat.metalnessMap = load(maps.metalness);
          mat.emissiveMap = load(maps.emissive, true);
          if (maps.emissive) mat.emissive.set("#ffffff");
          if (maps.normalConvention === "directx") mat.normalScale.y = -1;
        }
        cache.set(materialKey, mat);
      }
      const shape = JSON.stringify([part.positions, part.uvs, part.indices]);
      let g = geometryCache.get(shape);
      if (!g) {
        g = new THREE.BufferGeometry();
        g.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(part.positions, 3),
        );
        g.setAttribute("uv", new THREE.Float32BufferAttribute(part.uvs, 2));
        g.setIndex(part.indices);
        g.computeVertexNormals();
        g.computeBoundingBox();
        geometryCache.set(shape, g);
      }
      if (
        !mat.transparent &&
        !part.doorId &&
        !/\b(move|rotate|visible|name)\b/i.test(part.action ?? "")
      ) {
        const key =
          shape +
          materialKey +
          ":" +
          Math.floor(part.origin[0] / 32) +
          "," +
          Math.floor(part.origin[2] / 32);
        const batch = batches.get(key) ?? {
          geometry: g,
          material: mat,
          parts: [],
        };
        batch.parts.push(part);
        batches.set(key, batch);
        continue;
      }
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.fromArray(part.origin);
      mesh.userData = { id: part.id };
      if (part.action && /\b(move|rotate|visible|name)\b/i.test(part.action))
        rt.bindings?.set(part.id, mesh);
      mesh.castShadow = part.material !== "glass";
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    const matrix = new THREE.Matrix4();
    for (const batch of batches.values()) {
      if (batch.parts.length === 1) {
        const part = batch.parts[0],
          mesh = new THREE.Mesh(batch.geometry, batch.material);
        mesh.position.fromArray(part.origin);
        mesh.userData = { id: part.id };
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      } else {
        const mesh = new THREE.InstancedMesh(
          batch.geometry,
          batch.material,
          batch.parts.length,
        );
        batch.parts.forEach((part, i) => {
          matrix.makeTranslation(...part.origin);
          mesh.setMatrixAt(i, matrix);
        });
        mesh.userData = { ids: batch.parts.map((p) => p.id) };
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    }
  }, [
    s.meshes,
    s.bundle,
    s.view,
    s.cutaway,
    s.inspectionLevel,
    s.mode,
    contextRevision,
    s.assetRevision,
    s.renderProject,
  ]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    for (const o of [...rt.group.children])
      if (o.userData.selectionOutline) {
        rt.group.remove(o);
        if (o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      }
    const part = (
      s.view === "export" && s.bundle ? s.bundle.meshes : s.meshes
    ).find((m) => m.id === s.selected);
    const room = s.renderProject.rooms.find((room) => room.id === s.selected);
    if (part || room) {
      const b = part
          ? bounds(part)
          : {
              min: [
                room!.x - room!.width / 2,
                floorElevation(s.renderProject, room!.level),
                room!.z - room!.depth / 2,
              ] as Vec3,
              max: [
                room!.x + room!.width / 2,
                floorElevation(s.renderProject, room!.level) +
                  s.renderProject.height,
                room!.z + room!.depth / 2,
              ] as Vec3,
            },
        line = new THREE.Box3Helper(
          new THREE.Box3(
            new THREE.Vector3(...b.min),
            new THREE.Vector3(...b.max),
          ),
          0xb5ef76,
        );
      (line.material as THREE.Material).depthTest = false;
      line.renderOrder = 10;
      line.userData.selectionOutline = true;
      rt.group.add(line);
    }
  }, [s.selected, s.meshes, s.cutaway, s.view, s.bundle, s.renderProject]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    setTouch(false);
    rt.navigation?.clear();
    if (cameraRestored.current) {
      cameraRestored.current = false;
      rt.orbit.enabled = s.mode === "orbit";
      return;
    }
    if (s.mode !== "orbit") {
      if (rt.scene.fog instanceof THREE.Fog) {
        rt.scene.fog.near = s.mode === "fly" ? 80 : 55;
        rt.scene.fog.far =
          s.mode === "fly" ? Math.max(300, rt.camera.far * 0.6) : 140;
      }
      rt.walk.unlock();
      rt.orbit.enabled = false;
      const meshes =
        s.view === "export" && s.bundle ? s.bundle.meshes : s.meshes;
      const spawn = findWalkSpawn(meshes, [
        0,
        1.68,
        s.renderProject.depth / 2 + 5,
      ]);
      if (!spawn) {
        setError(
          "No supported clear walking spawn exists. Inspect geometry in orbit mode.",
        );
        return;
      }
      rt.camera.position.fromArray(spawn);
      if (s.mode === "fly") rt.camera.position.y += 4;
      rt.camera.lookAt(0, 1.66, 0);
    } else {
      rt.walk.unlock();
      rt.frame();
    }
  }, [s.mode]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    const biome = BIOMES[s.renderProject.biome];
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 256;
    const c = canvas.getContext("2d")!,
      gradient = c.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, biome.sky);
    gradient.addColorStop(0.65, biome.fog);
    gradient.addColorStop(1, biome.fog);
    c.fillStyle = gradient;
    c.fillRect(0, 0, 2, 256);
    if (rt.scene.background instanceof THREE.Texture)
      rt.scene.background.dispose();
    const sky = new THREE.CanvasTexture(canvas);
    sky.colorSpace = THREE.SRGBColorSpace;
    rt.scene.background = sky;
    rt.scene.fog = new THREE.Fog(biome.fog, 55, 140);
    rt.light.color.set(biome.sun);
    if (skipInitialFrame.current) skipInitialFrame.current = false;
    else if (s.mode === "orbit") rt.frame();
  }, [
    s.renderProject.biome,
    s.renderProject.landscape.extent,
    s.renderProject.landscape.enabled,
    s.renderProject.world.enabled,
    s.renderProject.world.blocks,
    s.renderProject.world.blockSize,
  ]);
  const lastPreview = useRef({ view: s.view, bundle: s.bundle });
  useEffect(() => {
    const previous = lastPreview.current;
    lastPreview.current = { view: s.view, bundle: s.bundle };
    if (
      s.mode === "orbit" &&
      (previous.view !== s.view ||
        (s.view === "export" && previous.bundle !== s.bundle))
    )
      runtime.current?.frame();
  }, [s.view, s.bundle]);
  useEffect(() => {
    if (runtime.current) runtime.current.grid.visible = showGrid;
  }, [showGrid]);
  const beginWalk = () => {
    try {
      runtime.current?.walk.lock();
    } catch {
      setError(
        "Pointer lock is unavailable in this browser. Orbit and floor plan remain available.",
      );
    }
  };
  const shown = s.view === "export" && s.bundle ? s.bundle.meshes : s.meshes,
    triangles = shown.reduce((n, m) => n + m.indices.length / 3, 0);
  return (
    <div className="viewport-shell">
      <div className="viewport-toolbar">
        <div className="segmented">
          <button
            className={s.mode === "orbit" ? "active" : ""}
            onClick={() => s.setMode("orbit")}
          >
            <MousePointer2 size={14} /> Orbit
          </button>
          <button
            className={s.mode === "walk" ? "active" : ""}
            onClick={() => s.setMode("walk")}
          >
            <PersonStanding size={15} /> Walk
          </button>
        </div>
        <button
          className={s.mode === "fly" ? "tool active" : "tool"}
          onClick={() => s.setMode("fly")}
          title="Fly inspection has no collision"
        >
          Fly
        </button>
        <button
          className={s.cutaway ? "tool active" : "tool"}
          onClick={() => s.setCutaway(!s.cutaway)}
          title="Hide roof to inspect interiors"
        >
          <Layers3 size={15} /> Cutaway
        </button>
        {s.cutaway && (
          <select
            aria-label="Isolate floor for orbit or fly inspection"
            value={inspectionFloor ?? -1}
            onChange={(e) =>
              s.setInspectionLevel(
                Number(e.target.value) < 0 ? null : Number(e.target.value),
              )
            }
          >
            <option value={-1}>All floors</option>
            {Array.from(
              {
                length: Math.max(
                  s.renderProject.structure.storeys,
                  ...s.meshes.map((m) => (m.level ?? 0) + 1),
                ),
              },
              (_, level) => (
                <option key={level} value={level}>
                  Inspect floor {level + 1}
                </option>
              ),
            )}
          </select>
        )}
        <button
          className="tool"
          onClick={() => {
            s.setMode("orbit");
            runtime.current?.frame(true);
          }}
          title="Frame building"
        >
          <Maximize2 size={15} /> Building
        </button>
        <button
          className={showGrid ? "tool active" : "tool"}
          onClick={() => setShowGrid(!showGrid)}
          title="Toggle construction grid"
        >
          Grid
        </button>
        <button
          className="tool"
          onClick={() => {
            s.setMode("orbit");
            runtime.current?.frame();
          }}
          title="Frame whole scene"
        >
          <RotateCcw size={14} /> Scene
        </button>
      </div>
      <div ref={container} className="viewport-canvas" />
      <div className="viewport-tag">
        <span className="status-dot" />
        {s.view === "export" ? "EXPORTED RWX" : "LIVE AUTHORING"}
        <span>
          {" "}
          / {s.renderProject.theme.toUpperCase()} ·{" "}
          {s.renderProject.biome.toUpperCase()}
        </span>
      </div>
      <div className="axis-compass">
        <span>N</span>
        <i />
        <small>X · Z</small>
      </div>
      {s.mode !== "orbit" && !locked && !touch && !error && (
        <div className="walk-prompt">
          <PersonStanding size={28} />
          <h3>
            {s.mode === "fly"
              ? "Fly through the scene."
              : "Step inside your creation."}
          </h3>
          <p>
            WASD to move · mouse to look · Shift to run
            <br />
            {s.mode === "fly"
              ? "Q/E: down/up. Fly inspection has no collision."
              : "E: doors. Step, slope and headroom collision enabled."}{" "}
            Esc releases the cursor.
          </p>
          <button className="btn accent" onClick={beginWalk}>
            Capture mouse <Crosshair size={16} />
          </button>
          <button className="small-button" onClick={() => setTouch(true)}>
            Use touch controls
          </button>
        </div>
      )}
      {touch && s.mode !== "orbit" && (
        <div className="touch-navigation" aria-label="Touch navigation">
          {[
            ["KeyA", "Left"],
            ["KeyW", "Forward"],
            ["KeyS", "Back"],
            ["KeyD", "Right"],
            ...(s.mode === "fly"
              ? [
                  ["KeyQ", "Down"],
                  ["KeyE", "Up"],
                ]
              : []),
          ].map(([key, label]) => (
            <button
              key={key}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                runtime.current?.navigation?.add(key);
              }}
              onPointerUp={() => runtime.current?.navigation?.delete(key)}
              onPointerCancel={() => runtime.current?.navigation?.delete(key)}
              onLostPointerCapture={() =>
                runtime.current?.navigation?.delete(key)
              }
            >
              {label}
            </button>
          ))}
          {s.mode === "walk" && (
            <button
              onClick={() => {
                const rt = runtime.current;
                if (rt) s.interactDoor(rt.camera.position.toArray() as Vec3);
              }}
            >
              Door
            </button>
          )}
          <button
            onClick={() => {
              setTouch(false);
              runtime.current?.navigation?.clear();
            }}
          >
            Exit
          </button>
          <small>Drag scene to look</small>
        </div>
      )}
      {locked && (
        <div className="crosshair" aria-hidden="true">
          +
        </div>
      )}
      {error && (
        <div className="graphics-error" role="alert">
          <Eye size={24} />
          <p>{error}</p>
        </div>
      )}
      <div className="viewport-footer">
        <span>
          {shown.length} pieces · {triangles.toLocaleString()} triangles
        </span>
        <span>{coords} m</span>
        <span>
          {touch
            ? "Touch controls · drag to look"
            : locked
              ? "WASD · Esc to exit"
              : "Drag to orbit · wheel to zoom"}
        </span>
      </div>
    </div>
  );
}
