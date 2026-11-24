import { useEffect, RefObject } from 'react';
import { Object3D, PerspectiveCamera, Vector2, Vector3 } from 'three';
import { useStore } from './store';
import { useThree } from '@react-three/fiber';
import { frameDistance, frameShop } from './sceneFraming';
import { computeFrontFacingWallIds } from './wallVisibility3D';
import { surveyWall } from './interiorSurvey';
import { siteOutline, sitePlacement } from './site';
import { Project } from './model';

export type SceneGalleryShots = {
  birdseye: string;
  storefront: string;
  interior: string;
};

export type SceneCaptureAPI = {
  galleryReady: () => boolean;
  captureCurrent: () => string;
  captureShot: (project: Project, kind: keyof SceneGalleryShots) => string;
};

// New drafts may have an entrance on any face, including an inside corner.
function entryView(project: Project) {
  if (!project.survey) return;
  const marker = project.items.find(i => !i.hidden && i.pointType === 'entrance');
  if (!marker) return;
  const doors = project.items.filter(i => i.kind === 'door' && !i.hidden && i.wallId);
  const distance = (d: typeof marker) => Math.hypot(d.x+d.w/2-marker.x-marker.w/2, d.y+d.d/2-marker.y-marker.d/2);
  const door = doors.sort((a,b) => distance(a)-distance(b))[0];
  if (!door || distance(door) > 1000) return;
  const wall = project.items.find(i => i.id === door.wallId);
  const face = wall && surveyWall(project, wall);
  if (!face) return;
  const center = { x: door.x + door.w / 2, y: door.y + door.d / 2 };
  const axis = face.inward.x ? 'x' : 'y';
  const across = axis === 'x' ? 'y' : 'x';
  const outline = siteOutline(project);
  // The first outward intersection is the door facade, the next can be the opposite wing.
  const crossings = outline.flatMap((a, i) => {
    const b = outline[(i + 1) % outline.length];
    if (a[axis] !== b[axis] || center[across] < Math.min(a[across], b[across]) ||
        center[across] > Math.max(a[across], b[across])) return [];
    return [(center[axis] - a[axis]) * face.inward[axis] / 1000];
  }).filter(d => d > 0).sort((a,b) => a - b);
  const facade = crossings[0] ?? 0;
  const opposite = crossings.find(d => d > facade + .001);
  const setback = opposite === undefined ? 5.8 : Math.min(5.8, (facade + opposite) / 2);
  return (inset: number, height: number) => new Vector3(
    center.x / 1000 + Math.max(-setback, inset) * face.inward.x, height,
    center.y / 1000 + Math.max(-setback, inset) * face.inward.y,
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
  const start = interiorPoint(project, startX, startZ);
  return {
    pos: new Vector3(start.x/1000, 1.62, start.y/1000),
    target: new Vector3(targetX, 1.18, targetZ),
    fov: 52,
  };
}

function interiorPoint(project: Project, x: number, z: number) {
  const floor = project.survey ? { ...project, outline: project.survey.corners } : project;
  return sitePlacement(floor, { x: x * 1000, y: z * 1000 });
}

export function computeEyeView(project: Project, index: number) {
  const idx = ((index % 4) + 4) % 4;
  if (idx === 0) return computeInteriorShot(project);
  if (idx === 3) return computeStorefrontShot(project);
  const w = project.width / 1000, h = project.height / 1000;
  const dining = idx === 1;
  const eye = dining
    ? interiorPoint(project, Math.max(.9, w * .14), Math.max(1, h * .82))
    : interiorPoint(project, Math.min(w - .9, w * .82), Math.max(1, h * .72));
  const target = interiorPoint(project, w * (dining ? .62 : .3), h * (dining ? .32 : .42));
  return {
    pos: new Vector3(eye.x / 1000, dining ? 1.74 : 1.70, eye.y / 1000),
    target: new Vector3(target.x / 1000, dining ? 1.1 : 1.15, target.y / 1000),
    fov: 50,
  };
}

export function computeBirdseyeShot(project: Project) {
  const w = project.width / 1000;
  const h = project.height / 1000;
  const extent = Math.max(w, h);
  const center = new Vector3(w / 2, 0.45, h / 2);
  const dir = new Vector3(0.86, 0.92, 1.24).normalize();
  if (project.survey || project.outline) {
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
    const renderShot = (shot: PerspectiveCamera, targetWidth = 1600, targetHeight = 1000, hiddenNames?: Set<string>) => {
      const u = useStore.getState().project.underlay;
      if (u && !u.hidden && scene.getObjectByName('site-floor') && !scene.getObjectByName(`site-underlay:${u.assetId}`)) {
        throw Error('底图未加载完成或资产缺失，请先恢复底图后截图');
      }
      const hidden: Object3D[] = [];
      scene.updateMatrixWorld(true);
      scene.traverse(o => {
        if (o.visible && (o.name === 'selection-highlight' || hiddenNames?.has(o.name))) {
          hidden.push(o);
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
        hidden.forEach(o => { o.visible = true; });
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
      captureShot: (project, kind) => {
        const shot = { birdseye: computeBirdseyeShot, storefront: computeStorefrontShot, interior: computeInteriorShot }[kind](project);
        const cam = new PerspectiveCamera(shot.fov, 1440 / 900, .05, 500);
        cam.position.copy(shot.pos);
        cam.lookAt(shot.target);
        const hidden = new Set<string>();
        if (kind === 'birdseye') {
          hidden.add('ceiling-assembly');
          const near = computeFrontFacingWallIds(project, shot.pos);
          for (const item of project.items) {
            if (near.has(item.id) || (item.wallId && near.has(item.wallId))) hidden.add('item:' + item.id);
          }
        }
        return renderShot(cam, 1440, 900, hidden);
      },
    };
    return () => { capture.current = null; };
  }, [gl, scene, camera, capture, invalidate]);
  return null;
}
