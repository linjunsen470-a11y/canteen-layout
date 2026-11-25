import { ScenePanMode, useSceneSpacePan } from './useSceneSpacePan';
import { SceneFrame, frameItems, framePoints, frameShop, frameDistance } from './sceneFraming';
import SceneRegionPicker, { SceneNavigation } from './SceneRegionPicker';
import { useWallPlacement } from './wallPlacementState';
import { groupSelection, movableSelection } from './layoutGroups';
import { forwardRef, useCallback, useImperativeHandle, memo, useMemo, useEffect, useRef, useState, ComponentRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as T from 'three';
import { useStore } from './store';
import { isEditable, isVisible } from './editorInteraction';
import { useWorkspace } from './workspace';
import { zoneCorners } from './zones';
import { Item, LightingPreset, Project, resolveStyle } from './model';
import { usePlanning, insidePlanning } from './planning';
import { isAnnotation } from './annotations';
import { SceneCaptureAPI, SceneGalleryShots, computeEyeView } from './SceneCapture';
import { FurnitureHandlers } from './InstancedFurniture';
import { dragOpening, isAttachedOpening } from './structure';
import { computeFrontFacingWallIds } from './wallVisibility3D';
import SceneContent, { atmosphereConfig } from './SceneContent';

const eyeViewNames = ['进店视角', '客区漫游视角', '吧台/明档视角', '临街门头外观'];
function CameraRig({
  project, focus, frame, reset, dragging, picking, pose, eyeIndex, active, navigation, pan, onPanChange
}: {
  project: Project;
  pan: React.RefObject<boolean>;
  onPanChange: (mode: ScenePanMode) => void;
  focus: Item | undefined;
  frame: SceneFrame | null;
  reset: number;
  dragging: boolean;
  picking: boolean;
  pose: 'top' | 'oblique' | 'eye-level';
  eyeIndex: number;
  active: boolean;
  navigation: React.RefObject<SceneNavigation | null>;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size, invalidate, gl } = useThree();
  const width = project.width, height = project.height;
  useSceneSpacePan(gl.domElement, controls, active, dragging || picking, pan, onPanChange);
  const framed = useRef(''), lastCenter = useRef<T.Vector3 | null>(null);
  const extent = Math.max(0.1, frame ? Math.max(...frame.max.map((v, n) => v - frame.min[n])) : focus ? Math.max(focus.w, focus.d, focus.h) / 1000 : Math.max(width, height) / 1000);
  const maxDistance = Math.max(width, height) / 1000 * 12, minDistance = Math.max(0.05, extent * 0.01);

  // Allow smooth WASD walking in eye-level walkthrough mode when the 3D scene has focus.
  useEffect(() => {
    if (!active || pose !== 'eye-level') return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const shell = gl.domElement.closest('.scene-shell');
      if (!shell || !shell.contains(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (!['w', 'a', 's', 'd'].includes(k)) return;
      const c = controls.current;
      if (!c) return;
      const forward = c.target.clone().sub(camera.position);
      forward.y = 0;
      if (forward.lengthSq() < 1e-4) return;
      forward.normalize();
      const right = new T.Vector3(-forward.z, 0, forward.x);
      const step = 0.45;
      const delta = new T.Vector3();
      if (k === 'w') delta.addScaledVector(forward, step);
      if (k === 's') delta.addScaledVector(forward, -step);
      if (k === 'd') delta.addScaledVector(right, step);
      if (k === 'a') delta.addScaledVector(right, -step);
      camera.position.add(delta);
      c.target.add(delta);
      c.update();
      invalidate();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, pose, camera, gl, invalidate]);

  useEffect(() => {
    navigation.current = {
      ground: (x, y) => {
        const r = gl.domElement.getBoundingClientRect(), ray = new T.Raycaster();
        ray.setFromCamera(new T.Vector2((x - r.x) / r.width * 2 - 1, -(y - r.y) / r.height * 2 + 1), camera);
        const p = ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), new T.Vector3());
        return p && p.distanceTo(camera.position) < 10000 ? { x: p.x * 1000, y: p.z * 1000 } : null;
      },
      zoom: factor => {
        const c = controls.current;
        if (!c) return;
        camera.position.sub(c.target).multiplyScalar(factor).add(c.target);
        c.update();
        invalidate();
      },
    };
    return () => { navigation.current = null; };
  }, [camera, gl, invalidate, navigation]);

  useFrame(() => {
    const distance = controls.current ? camera.position.distanceTo(controls.current.target) : extent * 2;
    const near = Math.max(0.01, distance / 200), far = Math.max(1000, distance + extent * 24);
    if (Math.abs(camera.near - near) > 1e-6 || Math.abs(camera.far - far) > 1e-6) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  });

  useEffect(() => { if (active) invalidate(); }, [active, size.width, size.height, invalidate]);

  useEffect(() => {
    if (!active || dragging || !controls.current || size.width < 1 || size.height < 1) return;
    const persp = camera as T.PerspectiveCamera;
    const desiredFov = pose === 'eye-level' && !focus && !frame ? 50 : 40;
    if (Math.abs(persp.fov - desiredFov) > 0.1) {
      persp.fov = desiredFov;
      persp.updateProjectionMatrix();
    }

    const overview = (project.survey || project.outline) && !frame && !focus && pose !== 'eye-level';
    const key = [project.id, JSON.stringify(frame), focus?.id ?? 'all', focus?.w, focus?.d, focus?.h, reset, pose, pose === 'eye-level' ? eyeIndex : 0, width, height].join(':');
    if (pose === 'eye-level' && !focus && !frame) {
      if (framed.current === key) { invalidate(); return; }
      framed.current = key;
      const damping = controls.current.enableDamping;
      controls.current.enableDamping = false;
      controls.current.update();
      controls.current.enableDamping = damping;
      const view = computeEyeView(project, eyeIndex);
      camera.position.copy(view.pos);
      camera.near = 0.05;
      camera.far = Math.max(400, extent * 20);
      camera.updateProjectionMatrix();
      controls.current.target.copy(view.target);
      controls.current.update();
      invalidate();
      return;
    }

    let center = frame
      ? new T.Vector3(...frame.min).add(new T.Vector3(...frame.max)).multiplyScalar(0.5)
      : focus
        ? new T.Vector3((focus.x + focus.w / 2) / 1000, focus.h / 2100, (focus.y + focus.d / 2) / 1000)
        : new T.Vector3(width / 2000, 0.5, height / 2000);

    if (framed.current === key) {
      if (!frame && focus && lastCenter.current) {
        const delta = center.clone().sub(lastCenter.current);
        camera.position.add(delta);
        controls.current.target.add(delta);
        controls.current.update();
      }
      lastCenter.current = center;
      invalidate();
      return;
    }
    framed.current = key;
    lastCenter.current = center;
    const damping = controls.current.enableDamping;
    controls.current.enableDamping = false;
    controls.current.update();
    controls.current.enableDamping = damping;
    const localExtent = focus ? Math.max(focus.w, focus.d, focus.h) / 1000 : Math.max(width, height) / 1000;
    const structural = focus?.kind === 'wall' || focus?.kind === 'partition';
    const aspect = Math.max(0.25, size.width / size.height);
    let distance = localExtent * (structural ? 1.6 : focus ? 2.5 : 1.28) / Math.min(1, aspect);
    const direction = pose === 'top'
      ? new T.Vector3(0, 1, 0.001)
      : structural
        ? new T.Vector3(0.5, 0.7, 1.5).applyAxisAngle(new T.Vector3(0, 1, 0), -focus.rotation * Math.PI / 180)
        : new T.Vector3(0.95, 0.88, 1.28);
    const bounds = frame ?? (overview ? frameShop(project) : null);
    if (bounds) {
      const fitted = frameDistance(bounds, direction, persp.fov, aspect);
      center = fitted.center;
      distance = fitted.distance;
    }
    camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));
    camera.near = Math.max(0.01, distance / 200);
    camera.far = Math.max(1000, distance + localExtent * 24);
    camera.updateProjectionMatrix();
    controls.current.target.copy(center);
    controls.current.update();
    invalidate();
  }, [frame, focus?.id, focus?.x, focus?.y, focus?.w, focus?.d, focus?.h, reset, pose, eyeIndex, width, height, size.width, size.height, dragging, active, project]);

  return <OrbitControls
    ref={controls}
    zoomToCursor
    screenSpacePanning
    enabled={active && !dragging && !picking}
    makeDefault
    minDistance={minDistance}
    maxDistance={maxDistance}
    maxPolarAngle={pose === 'eye-level' ? Math.PI * 0.62 : Math.PI / 2 - 0.03}
  />;
}

const presetLabels: Record<LightingPreset, string> = {
  'daylight': '自然光',
  'warm-dining': '暖光营业',
  'evening': '晚间灯光',
  'clay': '白模',
};

export type SceneHandle = {
  galleryReady: () => boolean;
  capturePNG: () => string;
  captureShot: (kind: keyof SceneGalleryShots) => string;
};

function CameraWallCutaway({ project, enabled, onChange }: { project: Project; enabled: boolean; onChange: (key: string) => void }) {
  const { camera } = useThree();
  const lastKey = useRef('');
  useEffect(() => {
    if (!enabled) {
      if (lastKey.current !== '') { lastKey.current = ''; onChange(''); }
      return;
    }
    const next = [...computeFrontFacingWallIds(project, { x: camera.position.x, z: camera.position.z })].sort().join(',');
    if (next !== lastKey.current) { lastKey.current = next; onChange(next); }
  }, [enabled, project, camera, onChange]);
  useFrame(() => {
    if (!enabled) return;
    const next = [...computeFrontFacingWallIds(project, { x: camera.position.x, z: camera.position.z })].sort().join(',');
    if (next !== lastKey.current) { lastKey.current = next; onChange(next); }
  });
  return null;
}

export default memo(forwardRef<SceneHandle, { active?: boolean; snap?: boolean; takingGallery?: boolean }>(function Scene3D({ active = true, snap = true, takingGallery = false }, ref) {
  const live = useStore(s => active ? s.project : null), lastProject = useRef(useStore.getState().project);
  if (live) lastProject.current = live;
  const project = lastProject.current;
  const style = resolveStyle(project);

  const lastView = useRef({ selected: useStore.getState().selected, ids: useStore.getState().selectedIds, focusRequest: useStore.getState().focusRequest });
  const selected = useStore(s => active ? s.selected : lastView.current.selected);
  const ids = useStore(s => active ? s.selectedIds : lastView.current.ids);
  const focusRequest = useStore(s => active ? s.focusRequest : lastView.current.focusRequest);
  if (active) lastView.current = { selected, ids, focusRequest };

  const prefs = useWorkspace(), moveMode = !project.basicDraft && prefs.move3D, planning = usePlanning();
  const faded = useCallback((i: Item) => planning.dim && !insidePlanning(i, project), [planning.dim, planning.activeId, project]);
  const navigation = useRef<SceneNavigation | null>(null);
  const [frame, setFrame] = useState<SceneFrame | null>(null), [picking, setPicking] = useState(false), [detail, setDetail] = useState(false);
  const [closeup, setCloseup] = useState(false), [grid, setGrid] = useState(false), [reset, setReset] = useState(0);
  const [eyeIndex, setEyeIndex] = useState(0);
  const [autoWallCutaway, setAutoWallCutaway] = useState(true);
  const [frontWallKey, setFrontWallKey] = useState('');
  const [dragging, setDragging] = useState(false), [captureError, setCaptureError] = useState('');
  const pan = useRef(false), [panMode, setPanMode] = useState<ScenePanMode>('off');
  const capture = useRef<SceneCaptureAPI | null>(null);

  useImperativeHandle(ref, () => ({
    galleryReady: () => takingGallery && !!capture.current?.galleryReady(),
    capturePNG: () => {
      const data = capture.current?.captureCurrent();
      if (!data) throw Error('三维场景尚未就绪');
      return data;
    },
    captureShot: kind => {
      const shots = capture.current?.captureShot(useStore.getState().project, kind);
      if (!shots) throw Error('三维场景尚未就绪');
      return shots;
    },
  }));

  const updateStyle = (patch: Partial<NonNullable<Project['style']>>) => {
    const s = useStore.getState();
    s.commit({ ...s.project, style: { ...resolveStyle(s.project), ...patch } });
  };

  const screenshot = () => {
    try {
      const data = capture.current?.captureCurrent();
      if (!data) throw Error();
      const link = document.createElement('a');
      link.href = data;
      link.download = `${project.name}-3D效果图.png`;
      link.click();
      setCaptureError('');
    } catch (e) {
      setCaptureError(e instanceof Error ? e.message : '截图失败，请重试');
    }
  };

  const drag = useRef<{ item: Item; origins: Item[]; start: T.Vector3; plane: T.Plane; screen: { x: number; y: number }; release: () => void } | null>(null);
  const finish = (cancel = false) => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    current.release();
    if (cancel) useStore.getState().cancelMove();
    else useStore.getState().endMove();
    setDragging(false);
  };
  useEffect(() => {
    const up = () => finish(), cancel = () => finish(true);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    const unsub = useStore.subscribe((s, p) => { if (s.interactionEpoch !== p.interactionEpoch) cancel(); });
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      unsub();
      if (drag.current) { drag.current.release(); drag.current = null; useStore.getState().cancelMove(); }
    };
  }, []);
  useEffect(() => { if (!active) { finish(true); setPicking(false); } }, [active]);
  useEffect(() => {
    if (!focusRequest) return;
    const state = useStore.getState();
    const sel = state.project.items.find(i => i.id === state.selected);
    if (sel?.kind === 'zone') {
      setPicking(false);
      setCloseup(false);
      if (useWorkspace.getState().camera === 'eye-level') prefs.set({ camera: 'oblique' });
      setFrame(framePoints(zoneCorners(sel), Math.max(2600, ...state.project.items.map(i => i.h)), sel.name));
      setReset(n => n + 1);
      return;
    }
    setFrame(null); setPicking(false); setCloseup(true); setReset(n => n + 1);
  }, [focusRequest]);

  const handlers = useMemo<FurnitureHandlers>(() => ({
    onPointerDown: (e, i) => {
      if (e.button !== 0 || pan.current) return;
      if (useWallPlacement.getState().session) { e.stopPropagation(); return; }
      e.stopPropagation();
      const state = useStore.getState();
      i = state.project.items.find(v => v.id === i.id) ?? i;
      state.setTool('select');
      if (e.shiftKey) { state.selectMany(groupSelection(state.project, i.id, ids, true, e.ctrlKey || e.metaKey)); return; }
      const selectedIds = groupSelection(state.project, i.id, ids, false, e.ctrlKey || e.metaKey);
      state.selectMany(selectedIds);
      if (!moveMode || !isEditable(i, state.project)) return;
      let origins: Item[];
      try { origins = movableSelection(state.project, selectedIds); } catch (error) { useStore.setState({ error: (error as Error).message }); return; }
      const plane = new T.Plane(new T.Vector3(0, 1, 0), -e.point.y), start = e.ray.intersectPlane(plane, new T.Vector3());
      if (!start) return;
      const target = e.target as unknown as { setPointerCapture: (id: number) => void; hasPointerCapture: (id: number) => boolean; releasePointerCapture: (id: number) => void }, pointer = e.pointerId;
      target.setPointerCapture(pointer);
      drag.current = { item: { ...i }, origins, start, plane, screen: { x: e.clientX, y: e.clientY }, release: () => { if (target.hasPointerCapture(pointer)) target.releasePointerCapture(pointer); } };
      useStore.getState().beginMove();
      setDragging(true);
    },
    onPointerMove: e => {
      const current = drag.current;
      if (!current) return;
      e.stopPropagation();
      if (Math.hypot(e.clientX - current.screen.x, e.clientY - current.screen.y) < 3) return;
      const point = e.ray.intersectPlane(current.plane, new T.Vector3());
      if (!point) return;
      const i = current.item, dx = (point.x - current.start.x) * 1000, dy = (point.z - current.start.z) * 1000;
      const quantize = (n: number) => snap && !e.altKey ? Math.round(n / prefs.snapSize) * prefs.snapSize : n;
      const patch = isAttachedOpening(i) && current.origins.length === 1 ? dragOpening(useStore.getState().project, i, { x: i.x + i.w / 2 + dx, y: i.y + i.d / 2 + dy }, snap && !e.altKey, 400, prefs.snapSize) : { x: i.x + quantize(dx), y: i.y + quantize(dy) };
      if (isAttachedOpening(i) && current.origins.length === 1) useStore.getState().move(i.id, patch);
      else useStore.getState().moveMany(current.origins.map(origin => ({ id: origin.id, patch: { x: origin.x + quantize(dx), y: origin.y + quantize(dy) } })));
    },
    onPointerUp: e => { if (drag.current) { e.stopPropagation(); finish(); } },
    onDoubleClick: (e, i) => {
      if (pan.current) return;
      e.stopPropagation();
      if (useWallPlacement.getState().session) return;
      const s = useStore.getState();
      s.cancelInteraction();
      s.selectMany([i.id]);
    },
  }), [moveMode, snap, prefs.snapSize, ids]);

  const item = project.items.find(i => i.id === selected && i.kind !== 'zone' && !isAnnotation(i) && isVisible(i, project));
  const inspectionFocus = closeup ? (item?.wallId ? project.items.find(w => w.id === item.wallId) : item) : undefined;
  const focus = takingGallery ? undefined : inspectionFocus;

  const frontWallIds = useMemo(() => new Set(frontWallKey ? frontWallKey.split(',') : []), [frontWallKey]);
  const smartWallActive = autoWallCutaway && prefs.camera === 'oblique' && !focus && !style.wallCutaway && !takingGallery;

  const selectedItems = project.items.filter(i => ids.includes(i.id) && isVisible(i, project) && !isAnnotation(i));
  const area = project.planningAreas?.find(a => a.id === planning.activeId);
  const showFrame = (next: SceneFrame) => { setFrame(next); setCloseup(false); setPicking(false); setReset(n => n + 1); };
  const cfg = atmosphereConfig[style.lightingPreset];

  const hideSelectionBox = takingGallery || (prefs.camera === 'eye-level' && eyeIndex === 3);

  return <div className="scene-shell" tabIndex={0} onPointerDownCapture={e => { if (e.target instanceof HTMLCanvasElement) e.currentTarget.focus({ preventScroll: true }); }}>
    <div className={`scene-viewport scene-pan-${panMode}`}>
      <div className={`scene-toolbar is-floating ${style.lightingPreset === 'evening' ? 'is-dark' : ''}`} role="toolbar" aria-label="三维视图控制">
        <div className="scene-segment" role="group" aria-label="三维视角">
          <button aria-pressed={prefs.camera === 'oblique' && !focus && !frame} onClick={() => { setFrame(null); setPicking(false); setCloseup(false); prefs.set({ camera: 'oblique' }); setReset(n => n + 1); }}>鸟瞰</button>
          <button aria-pressed={prefs.camera === 'eye-level' && eyeIndex === 3 && !focus && !frame} title="站在街面/商场通道直视门头招牌、落地橱窗与店门" onClick={() => { setFrame(null); setPicking(false); setCloseup(false); setEyeIndex(3); prefs.set({ camera: 'eye-level' }); setReset(n => n + 1); }}>门头外观</button>
          <button aria-pressed={prefs.camera === 'eye-level' && eyeIndex !== 3 && !focus && !frame} title="1.6m 真实进店人视点，再次点击切换室内机位，可用 WASD 漫步" onClick={() => { setFrame(null); setPicking(false); setCloseup(false); setEyeIndex(i => (prefs.camera === 'eye-level' && i !== 3 ? (i + 1) % 3 : 0)); prefs.set({ camera: 'eye-level' }); setReset(n => n + 1); }}>
            {prefs.camera === 'eye-level' && eyeIndex !== 3 ? `进店 · ${eyeViewNames[eyeIndex]}` : '人视点进店'}
          </button>
          <button aria-pressed={prefs.camera === 'top' && !focus && !frame} onClick={() => { setFrame(null); setPicking(false); setCloseup(false); prefs.set({ camera: 'top' }); setReset(n => n + 1); }}>俯视</button>
        </div>
        <details className="scene-atmos-menu">
          <summary title="切换光照与渲染氛围">{presetLabels[style.lightingPreset]}</summary>
          <div className="scene-more-actions is-compact-menu" role="group" aria-label="渲染氛围" onClick={e => { const d = e.currentTarget.closest('details'); if (d) d.open = false; }}>
            {(['daylight', 'warm-dining', 'evening', 'clay'] as LightingPreset[]).map(p => (
              <button key={p} aria-pressed={style.lightingPreset === p} onClick={() => updateStyle({ lightingPreset: p })}>{presetLabels[p]}</button>
            ))}
          </div>
        </details>
        <button className="scene-pill-btn" aria-pressed={autoWallCutaway && !style.wallCutaway} title="鸟瞰旋转时自动降低挡住视线的近侧外墙，后侧墙保持全高" onClick={() => { if (style.wallCutaway) updateStyle({ wallCutaway: false }); setAutoWallCutaway(v => !v); }}>智能透视墙</button>
        <details className="scene-more"><summary>更多</summary><div className="scene-more-actions">
          <button aria-pressed={style.wallCutaway} title="将所有墙体降至半高便于俯瞰" onClick={() => updateStyle({ wallCutaway: !style.wallCutaway })}>全部半高墙</button>
          <button aria-pressed={!style.showZoneTint3D} title="隐藏地面规划色块，呈现干净材质效果图" onClick={() => updateStyle({ showZoneTint3D: !style.showZoneTint3D })}>纯净地面</button>
          <button onClick={screenshot} title="保存当前高清 3D 效果图 PNG">效果图截图</button>
          <button onClick={() => { useStore.getState().cancelInteraction(); prefs.set(prefs.focusMode && prefs.focusView === '3d' ? { focusMode: false, focusView: null } : { focusMode: true, focusView: '3d' }); }}>
            {prefs.focusMode && prefs.focusView === '3d' ? '还原三维' : '最大化三维'}
          </button>
          <button disabled={!selectedItems.length} onClick={() => showFrame(frameItems(project, selectedItems))}>聚焦选中</button>
          <button disabled={!area} onClick={() => { if (area) showFrame(framePoints(area.outline, Math.max(2800, ...project.items.map(i => i.h)), area.name)); }}>聚焦规划范围</button>
          <button aria-pressed={picking} onClick={() => { if (picking) { setPicking(false); return; } setCloseup(false); setFrame(null); prefs.set({ camera: 'top' }); setReset(n => n + 1); setPicking(true); }}>{picking ? '取消框选' : '框选放大'}</button>
          <button aria-label="三维放大" onClick={() => navigation.current?.zoom(0.8)}>放大 ＋</button>
          <button aria-label="三维缩小" onClick={() => navigation.current?.zoom(1.25)}>缩小 －</button>
          <button className={!focus && !frame ? 'active' : ''} onClick={() => { setFrame(null); setPicking(false); setCloseup(false); setReset(n => n + 1); }}>空间全景</button>
          <button disabled={!item} className={focus ? 'active' : ''} onClick={() => { setFrame(null); setPicking(false); setCloseup(true); setReset(n => n + 1); }}>物体特写</button>
          <button aria-pressed={style.showCeiling} onClick={() => updateStyle({ showCeiling: !style.showCeiling })}>{style.showCeiling ? '吊顶已开启' : '吊顶已关闭'}</button>
          {!project.basicDraft && <button aria-pressed={moveMode} title="开启后可直接拖动物体；关闭后拖动旋转视角" onClick={() => { useStore.getState().cancelInteraction(); prefs.set({ move3D: !moveMode }); }}>{moveMode ? '移动已开启' : '移动已关闭'}</button>}
          <button aria-pressed={grid} title="三维网格" onClick={() => setGrid(v => !v)}>网格</button>
          <button title="重置三维视角" onClick={() => { setFrame(null); setPicking(false); setCloseup(false); prefs.set({ camera: 'oblique' }); setReset(n => n + 1); }}>复位</button>
          <button aria-pressed={detail} onClick={() => setDetail(v => !v)}>{detail ? '精细画质' : '流畅画质'}</button>
          {captureError && <span role="alert">{captureError}</span>}
        </div></details>
      </div>
      <Canvas frameloop={active ? 'demand' : 'never'} shadows dpr={detail ? [1, 1.85] : 1} camera={{ position: [14, 12, 16], fov: 40 }} gl={{ localClippingEnabled: true, antialias: true, toneMapping: T.ACESFilmicToneMapping, toneMappingExposure: cfg.exposure }}>
        <SceneContent
          project={project}
          interactive
          capture={capture}
          detail={detail}
          grid={grid}
          gridSize={prefs.gridSize}
          forceCeiling={prefs.camera === 'eye-level' && eyeIndex !== 3}
          cameraMode={prefs.camera}
          focus={focus}
          selectedIds={ids}
          hideSelectionBox={hideSelectionBox}
          activeAreaId={planning.activeId}
          faded={faded}
          handlers={handlers}
          smartWallActive={smartWallActive}
          frontWallIds={frontWallIds}
          frontWallKey={frontWallKey}
        />
        <CameraWallCutaway project={project} enabled={smartWallActive} onChange={setFrontWallKey} />
        <CameraRig project={project} pan={pan} onPanChange={setPanMode} navigation={navigation} frame={frame} active={active} focus={inspectionFocus} reset={reset} dragging={dragging} picking={picking} pose={prefs.camera} eyeIndex={eyeIndex} />
      </Canvas>
      {picking && <SceneRegionPicker navigation={navigation} onCancel={() => setPicking(false)} onPick={points => showFrame(framePoints(points, 0, '框选区域'))} />}
      <div className={`scene-caption ${style.lightingPreset === 'evening' ? 'is-dark' : ''}`}>
        <b>{panMode !== 'off' ? '平移视图 · 松开空格恢复' : focus ? focus.name : frame?.label ?? `${presetLabels[style.lightingPreset]} · ${prefs.camera === 'eye-level' ? eyeViewNames[eyeIndex] : prefs.camera === 'top' ? '立体俯视' : '鸟瞰效果图'}`}</b>
        <span>{focus ? `${focus.w} × ${focus.d} × ${focus.h} mm` : prefs.camera === 'eye-level' ? '左键环视 · WASD 室内漫步 · 滚轮缩放' : moveMode ? '拖物体移动 · 空格＋左键平移 · Alt 关闭吸附' : '左键环绕 · 滚轮缩放 · 右键／空格平移'}</span>
      </div>
    </div>
  </div>;
}));
