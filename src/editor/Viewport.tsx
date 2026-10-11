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
import { moveWalker } from "../core/geometry";
import { textureImage } from "../core/textures";
import { useStudio } from "./store";

function disposeGroup(group: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>(),
    mats = new Set<THREE.Material>(),
    maps = new Set<THREE.Texture>();
  group.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        mats.add(m);
        if ("map" in m && m.map instanceof THREE.Texture) maps.add(m.map);
      }
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
}
export function Viewport() {
  const s = useStudio(),
    container = useRef<HTMLDivElement>(null),
    runtime = useRef<Runtime | null>(null),
    current = useRef(s),
    [error, setError] = useState(""),
    [locked, setLocked] = useState(false),
    [showGrid, setShowGrid] = useState(false),
    [coords, setCoords] = useState("0.0, 0.0, 0.0"),
    [contextRevision, setContextRevision] = useState(0);
  current.current = s;
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
      const p = current.current.project;
      const margin =
        p.landscape.enabled && !buildingOnly ? p.landscape.extent : 0;
      camera.position.set(
        p.width * 1.2 + margin,
        p.height * 2.1 + margin * 0.9,
        p.depth * 1.55 + margin * 1.15,
      );
      orbit.target.set(0, p.height * 0.65, 0);
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
    const resize = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    resize.observe(host);
    const keys = new Set<string>();
    const down = (e: KeyboardEvent) => {
        if (walk.isLocked) {
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
    const pointerDown = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
    };
    const pointerUp = (e: PointerEvent) => {
      if (
        current.current.mode === "walk" ||
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
        .find((h) => h.object.userData.id);
      current.current.select(hit?.object.userData.id ?? null);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const lost = (e: Event) => {
      e.preventDefault();
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
    renderer.setAnimationLoop((now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const state = current.current;
      if (walk.isLocked) {
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, camera.up);
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
        const moved = moveWalker(
          camera.position.toArray() as Vec3,
          [
            (forward.x * f + right.x * r) * speed,
            (forward.z * f + right.z * r) * speed,
          ],
          meshes,
        );
        camera.position.fromArray(moved);
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
    });
    return () => {
      renderer.setAnimationLoop(null);
      walk.unlock();
      resize.disconnect();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
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
      specs = exported ? s.bundle!.specs : materialsFor(s.project),
      loader = new THREE.TextureLoader(),
      cache = new Map<MaterialRole, THREE.MeshStandardMaterial>(),
      geometryCache = new Map<number[], THREE.BufferGeometry>();
    for (const part of meshes) {
      if (part.category === "roof" && s.cutaway) continue;
      const spec = specs[part.material];
      let mat = cache.get(part.material);
      if (!mat) {
        const data = exported
          ? s.bundle!.images[part.material]
          : textureImage(spec, s.project);
        const texture = loader.load(data);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.anisotropy = Math.min(
          8,
          rt.renderer.capabilities.getMaxAnisotropy(),
        );
        mat = new THREE.MeshStandardMaterial({
          color: spec.color,
          map: texture,
          roughness: part.material === "glass" ? 0.15 : 0.84,
          metalness: part.material === "trim" ? 0.1 : 0,
          transparent: spec.opacity < 1,
          opacity: spec.opacity,
          depthWrite: spec.opacity >= 1,
        });
        cache.set(part.material, mat);
      }
      let g = geometryCache.get(part.positions);
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
        geometryCache.set(part.positions, g);
      }
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.fromArray(part.origin);
      mesh.userData = { id: part.id };
      mesh.castShadow = part.material !== "glass";
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }, [
    s.meshes,
    s.bundle,
    s.view,
    s.cutaway,
    s.project,
    contextRevision,
    s.assetRevision,
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
    const mesh = rt.group.children.find((o) => o.userData.id === s.selected);
    if (mesh instanceof THREE.Mesh) {
      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        new THREE.LineBasicMaterial({ color: "#b5ef76", depthTest: false }),
      );
      line.position.copy(mesh.position);
      line.renderOrder = 10;
      line.userData.selectionOutline = true;
      rt.group.add(line);
    }
  }, [s.selected, s.meshes, s.cutaway, s.view, s.bundle]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    if (s.mode === "walk") {
      rt.walk.unlock();
      rt.orbit.enabled = false;
      rt.camera.position.set(0, 1.66, s.project.depth / 2 + 5);
      rt.camera.lookAt(0, 1.66, 0);
    } else {
      rt.walk.unlock();
      rt.frame();
    }
  }, [s.mode]);
  useEffect(() => {
    const rt = runtime.current;
    if (!rt) return;
    const biome = BIOMES[s.project.biome];
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
    if (s.mode === "orbit") rt.frame();
  }, [
    s.project.biome,
    s.project.landscape.extent,
    s.project.landscape.enabled,
  ]);
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
          className={s.cutaway ? "tool active" : "tool"}
          onClick={() => s.setCutaway(!s.cutaway)}
          title="Hide roof to inspect interiors"
        >
          <Layers3 size={15} /> Cutaway
        </button>
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
          / {s.project.theme.toUpperCase()} · {s.project.biome.toUpperCase()}
        </span>
      </div>
      <div className="axis-compass">
        <span>N</span>
        <i />
        <small>X · Z</small>
      </div>
      {s.mode === "walk" && !locked && !error && (
        <div className="walk-prompt">
          <PersonStanding size={28} />
          <h3>Step inside your creation.</h3>
          <p>
            WASD to move · mouse to look · Shift to run
            <br />
            Esc releases the cursor. Flat-ground collision enabled.
          </p>
          <button className="btn accent" onClick={beginWalk}>
            Enter walk mode <Crosshair size={16} />
          </button>
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
          {locked ? "WASD · Esc to exit" : "Drag to orbit · wheel to zoom"}
        </span>
      </div>
    </div>
  );
}
