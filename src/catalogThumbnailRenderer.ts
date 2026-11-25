import * as T from 'three';
import { createFurniture, disposeFurniture, type FurnitureSpec, studioEnvironment } from './furniture';
import { modelOf } from './model';

const cache = new Map<string, string>();
// Render at most one uncached thumbnail per animation frame, so a visible row cannot monopolize a frame.
const pending = new Set<() => void>();
let queued = false;

export function enqueueThumbnail(task: () => void) {
  pending.add(task);
  const next = () => {
    const fn = pending.values().next().value;
    if (fn) {
      pending.delete(fn);
      fn();
    }
    if (pending.size) requestAnimationFrame(next);
    else queued = false;
  };
  if (!queued) {
    queued = true;
    requestAnimationFrame(next);
  }
  return () => { pending.delete(task); };
}

let renderer: T.WebGLRenderer | undefined;
let scene: T.Scene;
let camera: T.PerspectiveCamera;
let environment: T.WebGLRenderTarget;
let cleanup: ReturnType<typeof setTimeout>;

function releaseRenderer() {
  scene.traverse(o => {
    if (o instanceof T.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    }
    if (o instanceof T.DirectionalLight) o.shadow.dispose();
  });
  environment.dispose();
  renderer?.dispose();
  renderer?.forceContextLoss();
  renderer = undefined;
}

export function renderCatalogThumbnail(item: FurnitureSpec): string {
  const key = JSON.stringify([modelOf(item), item.w, item.d, item.h, item.color]);
  if (cache.has(key)) return cache.get(key)!;
  if (!renderer) {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(360, 260);
    renderer.setPixelRatio(1);
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.background = new T.Color('#edf0ed');
    environment = studioEnvironment(renderer);
    scene.environment = environment.texture;
    scene.add(new T.HemisphereLight('#ffffff', '#a6a49a', 1));
    const light = new T.DirectionalLight('#fff3df', 4);
    light.position.set(3, 5, 4);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -3;
    light.shadow.camera.right = 3;
    light.shadow.camera.top = 3;
    light.shadow.camera.bottom = -3;
    light.shadow.normalBias = 0.015;
    scene.add(light);
    const floor = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshStandardMaterial({ color: '#edf0ed', roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.008;
    floor.receiveShadow = true;
    scene.add(floor);
    camera = new T.PerspectiveCamera(32, 360 / 260, 0.01, 100);
  }
  const model = createFurniture(item);
  scene.add(model);
  const size = Math.max(item.w, item.h, item.d) / 1000;
  const center = new T.Vector3(0, item.h / 2100, 0);
  camera.position.copy(center).add(new T.Vector3(1.3, 0.92, 1.55).normalize().multiplyScalar(size * 2.5));
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const image = renderer.domElement.toDataURL('image/png');
  scene.remove(model);
  disposeFurniture(model);
  cache.set(key, image);
  if (cache.size > 160) cache.delete(cache.keys().next().value!);
  clearTimeout(cleanup);
  cleanup = setTimeout(releaseRenderer, 300);
  return image;
}
