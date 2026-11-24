import { useEffect, RefObject } from 'react';
import { Object3D, PerspectiveCamera, Vector2, Vector3 } from 'three';
import { useStore } from './store';
import { useThree } from '@react-three/fiber';
import { frameDistance, frameShop } from './sceneFraming';
import { surveyWall } from './interiorSurvey';
import { sitePlacement } from './site';
import { Project } from './model';

export type SceneGalleryShots = {
  birdseye: string;
  storefront: string;
  interior: string;
};

export type SceneCaptureAPI = {
  galleryReady: () => boolean;
  captureCurrent: () => string;
  captureGallery: (project: Project) => SceneGalleryShots;
};

// New drafts may have an entrance on any face, including an inside corner.
function entryView(project: Project) {
  if (!project.basicDraft) return;
  const marker = project.items.find(i => !i.hidden && i.pointType === 'entrance');
  if (!marker) return;
  const doors = project.items.filter(i => i.kind === 'door' && !i.hidden && i.wallId);
  const distance = (d: typeof marker) => Math.hypot(d.x+d.w/2-marker.x-marker.w/2, d.y+d.d/2-marker.y-marker.d/2);
  const door = doors.sort((a,b) => distance(a)-distance(b))[0];
  if (!door || distance(door) > 1000) return;
  const wall = project.items.find(i => i.id === door.wallId);
  const face = wall && surveyWall(project, wall);
  if (!face) return;
  return (inset: number, height: number) => new Vector3(
    (door.x+door.w/2)/1000 + inset*face.inward.x, height, (door.y+door.d/2)/1000 + inset*face.inward.y,
  );
}

export function computeStorefrontShot(project: Project) {
  const entry = entryView(project);
  if (entry) return { pos: entry(-5.8,2.05), target: entry(0,1.55), fov:44 };
  const w = project.width / 1000;
  const h = project.height / 1000;
  const door = project.items.find(i => i.kind === 'door' && !i.hidden && (i.y + i.d / 2) / 1000 > h * 0.65);
  const cx = door ? (door.x + door.w / 2) / 1000 : w * 0.5;
  const dist = Math.max(5.8, Math.min(11.5, w * 0.68));
  return {
    pos: new Vector3(cx + w * 0.16, 2.05, h + dist),
    target: new Vector3(cx, 1.55, h * 0.68),
    fov: 44,
  };
}

export function computeInteriorShot(project: Project) {
  const entry = entryView(project);
  if (entry) return { pos: entry(.32,1.62), target: entry(2.5,1.35), fov:52 };
  const w = project.width / 1000;
  const h = project.height / 1000;
  const door = project.items.find(i => i.kind === 'door' && !i.hidden && (i.y + i.d / 2) / 1000 > h * 0.6);
  const counter = project.items.find(i => (i.kind === 'counter' || i.model === 'serving-window') && !i.hidden);
  const startX = door ? Math.min(w - 0.85, Math.max(0.85, (door.x + door.w / 2) / 1000)) : w * 0.35;
  const startZ = Math.max(1.2, h - 1.1);
  const targetX = counter ? (counter.x + counter.w / 2) / 1000 : w * 0.55;
  const targetZ = counter ? Math.max(1.0, (counter.y + counter.d / 2) / 1000) : h * 0.32;
  const start = project.basicDraft ? sitePlacement(project, { x: startX*1000, y: startZ*1000 }) : { x:startX*1000, y:startZ*1000 };
  return {
    pos: new Vector3(start.x/1000, 1.62, start.y/1000),
    target: new Vector3(targetX, 1.18, targetZ),
    fov: 52,
  };
}

export function computeBirdseyeShot(project: Project) {
  const w = project.width / 1000;
  const h = project.height / 1000;
  const extent = Math.max(w, h);
  const center = new Vector3(w / 2, 0.45, h / 2);
  const dir = new Vector3(0.86, 0.92, 1.24).normalize();
  if (project.basicDraft) {
    const fit = frameDistance(frameShop(project),dir,38,1440/900);
    return { pos: fit.center.clone().addScaledVector(dir, fit.distance), target: fit.center, fov:38 };
  }
  return {
    pos: center.clone().add(dir.multiplyScalar(extent * 1.24)),
    target: center,
    fov: 38,
  };
}

// Render immediately before copying pixels; no permanent preserveDrawingBuffer cost.
export default function SceneCapture({ capture }: { capture: RefObject<SceneCaptureAPI | null> }) {
  const { gl, scene, camera, invalidate } = useThree();
  useEffect(() => {
    const renderShot = (shot: PerspectiveCamera, targetWidth = 1600, targetHeight = 1000) => {
      const u = useStore.getState().project.underlay;
      if (u && !u.hidden && scene.getObjectByName('site-floor') && !scene.getObjectByName(`site-underlay:${u.assetId}`)) {
        throw Error('底图未加载完成或资产缺失，请先恢复底图后截图');
      }
      const highlights: Object3D[] = [];
      scene.updateMatrixWorld(true);
      scene.traverse(o => {
        if (o.name === 'selection-highlight' && o.visible) {
          highlights.push(o);
          o.visible = false;
        }
      });
      const size = gl.getSize(new Vector2()), ratio = gl.getPixelRatio();
      shot.aspect = targetWidth / targetHeight;
      shot.updateProjectionMatrix();
      shot.updateMatrixWorld(true);
      try {
        gl.setPixelRatio(1);
        gl.setSize(targetWidth, targetHeight, false);
        gl.render(scene, shot);
        return gl.domElement.toDataURL('image/png');
      } finally {
        gl.setPixelRatio(ratio);
        gl.setSize(size.x, size.y, false);
        highlights.forEach(o => { o.visible = true; });
        invalidate();
      }
    };

    capture.current = {
      galleryReady: () => !!scene.getObjectByName('site-floor'),
      captureCurrent: () => {
        const size = gl.getSize(new Vector2());
        const scale = Math.min(1600 / Math.max(1, size.x), 2000 / Math.max(1, size.y));
        const width = Math.max(1, Math.round(size.x * scale));
        const height = Math.max(1, Math.round(size.y * scale));
        const shot = camera.clone() as PerspectiveCamera;
        return renderShot(shot, width, height);
      },
      captureGallery: (project: Project) => {
        const makeCam = (cfg: { pos: Vector3; target: Vector3; fov: number }) => {
          const cam = new PerspectiveCamera(cfg.fov, 1440 / 900, 0.05, 500);
          cam.position.copy(cfg.pos);
          cam.lookAt(cfg.target);
          return cam;
        };
        return {
          birdseye: renderShot(makeCam(computeBirdseyeShot(project)), 1440, 900),
          storefront: renderShot(makeCam(computeStorefrontShot(project)), 1440, 900),
          interior: renderShot(makeCam(computeInteriorShot(project)), 1440, 900),
        };
      },
    };
    return () => { capture.current = null; };
  }, [gl, scene, camera, capture, invalidate]);
  return null;
}
