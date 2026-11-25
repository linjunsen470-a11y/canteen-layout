import { memo, RefObject, useEffect, useMemo, useRef } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import * as T from 'three';
import { Item, LightingPreset, Point, Project, modelOf, resolveStyle } from './model';
import { baseHeight } from './spatial';
import { isVisible } from './editorInteraction';
import { zoneCorners } from './zones';
import { wallProfiles } from './wallJoints';
import { createFurniture, disposeFurniture, studioEnvironment, fadeFurniture } from './furniture';
import { BuildingRenderOptions } from './buildingModels';
import SiteFloor from './SiteFloor';
import SiteOverlay3D from './SiteOverlay3D';
import { isAnnotation } from './annotations';
import SceneCapture, { SceneCaptureAPI } from './SceneCapture';
import InstancedFurniture, { FurnitureHandlers } from './InstancedFurniture';
import { cutawayWallDecorModels, isItemNearWalls } from './wallVisibility3D';

export const atmosphereConfig: Record<LightingPreset, {
  bg: string;
  ground: string;
  hemiSky: string;
  hemiGround: string;
  hemiInt: number;
  sunColor: string;
  sunInt: number;
  fillColor: string;
  fillInt: number;
  envInt: number;
  exposure: number;
}> = {
  'daylight': {
    bg: '#e8edf0', ground: '#e0e4e2',
    hemiSky: '#f4f9ff', hemiGround: '#bfb4a2', hemiInt: 0.78,
    sunColor: '#fff6e6', sunInt: 2.6,
    fillColor: '#d8e8ff', fillInt: 1.0,
    envInt: 0.72, exposure: 1.08,
  },
  'warm-dining': {
    bg: '#eee8df', ground: '#e5dfd5',
    hemiSky: '#fff6e9', hemiGround: '#b59d82', hemiInt: 0.72,
    sunColor: '#ffebd0', sunInt: 2.2,
    fillColor: '#ffe0b8', fillInt: 0.75,
    envInt: 0.65, exposure: 1.06,
  },
  'evening': {
    bg: '#1c222a', ground: '#21272f',
    hemiSky: '#687b96', hemiGround: '#3e3328', hemiInt: 0.36,
    sunColor: '#a8bee0', sunInt: 0.62,
    fillColor: '#ffbe78', fillInt: 0.42,
    envInt: 0.28, exposure: 1.12,
  },
  'clay': {
    bg: '#f2f2ef', ground: '#ebebe7',
    hemiSky: '#ffffff', hemiGround: '#c8c6be', hemiInt: 0.9,
    sunColor: '#fffdf8', sunInt: 2.2,
    fillColor: '#e4eaf0', fillInt: 0.9,
    envInt: 0.45, exposure: 1.04,
  },
};

function SelectionBox({ item }: { item: Item }) {
  const geometry = useMemo(() => {
    const box = new T.BoxGeometry(item.w / 1000 + 0.02, Math.max(0.02, item.h / 1000) + 0.02, item.d / 1000 + 0.02);
    const edges = new T.EdgesGeometry(box);
    box.dispose();
    return edges;
  }, [item.w, item.d, item.h]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <lineSegments name="selection-highlight" geometry={geometry} position={[0, item.h / 2000, 0]} renderOrder={10} raycast={() => {}}><lineBasicMaterial color="#e09b27" depthTest={false} /></lineSegments>;
}

function ZoneHighlight({ item }: { item: Item }) {
  const key = JSON.stringify(zoneCorners(item));
  const geometry = useMemo(() => {
    const points = zoneCorners(item);
    return new T.BufferGeometry().setFromPoints([...points, points[0]].map(p => new T.Vector3(p.x / 1000, 0.015, p.y / 1000)));
  }, [key]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <lineLoop name="selection-highlight" geometry={geometry} raycast={() => {}}><lineBasicMaterial color="#e09b27" depthTest={false} /></lineLoop>;
}

const Furniture = memo(function Furniture({
  item, selected, openings = [], handlers, faded, profile, renderOptions,
}: {
  item: Item;
  selected: boolean;
  openings?: Item[];
  handlers?: FurnitureHandlers;
  faded: boolean;
  profile?: Point[];
  renderOptions: BuildingRenderOptions;
}) {
  const host = useRef<T.Group>(null);
  const invalidate = useThree(s => s.invalidate);
  const variant = modelOf(item);
  const signName = variant === 'shop-sign' ? item.name : '';
  const openingKey = JSON.stringify(openings.map(o => [o.offset, o.sill, o.w, o.h]));
  useEffect(() => {
    const model = createFurniture(item, openings, profile, renderOptions);
    if (faded) fadeFurniture(model);
    const group = host.current!;
    group.add(model);
    invalidate();
    return () => { group.remove(model); disposeFurniture(model); };
  }, [variant, signName, item.w, item.d, item.h, item.color, item.flipped, item.hingeRight, item.pointType, item.verification, openingKey, faded, JSON.stringify(profile), renderOptions.wallMaterial, renderOptions.cutaway, renderOptions.lightingPreset]);

  const pointerProps = handlers ? {
    onDoubleClick: (e: ThreeEvent<MouseEvent>) => handlers.onDoubleClick(e, item),
    onPointerDown: (e: ThreeEvent<PointerEvent>) => handlers.onPointerDown(e, item),
    onPointerMove: handlers.onPointerMove,
    onPointerUp: handlers.onPointerUp,
  } : {};

  return (
    <group
      name={`item:${item.id}`}
      position={[(item.x + item.w / 2) / 1000, (item.sill ?? 0) / 1000, (item.y + item.d / 2) / 1000]}
      rotation={[0, -item.rotation * Math.PI / 180, 0]}
      ref={host}
      {...pointerProps}
    >
      {selected && <SelectionBox item={item} />}
    </group>
  );
});

function Environment({ center, extent, detail, preset }: { center: [number, number, number]; extent: number; detail: boolean; preset: LightingPreset }) {
  const { gl, scene, invalidate } = useThree();
  const cfg = atmosphereConfig[preset];
  useEffect(() => {
    const target = studioEnvironment(gl);
    scene.environment = target.texture;
    return () => { scene.environment = null; target.dispose(); };
  }, [gl, scene]);
  useEffect(() => {
    scene.environmentIntensity = cfg.envInt;
    gl.toneMappingExposure = cfg.exposure;
    invalidate();
  }, [scene, gl, cfg.envInt, cfg.exposure, invalidate]);
  const target = useRef(new T.Object3D());
  target.current.position.set(...center);
  return <>
    <color attach="background" args={[cfg.bg]} />
    <primitive object={target.current} />
    <hemisphereLight args={[cfg.hemiSky, cfg.hemiGround, cfg.hemiInt]} />
    <directionalLight
      target={target.current}
      position={[center[0] + extent * 0.45, extent * 1.45, center[2] + extent * 0.62]}
      intensity={cfg.sunInt}
      color={cfg.sunColor}
      castShadow
      key={`${detail}:${preset}`}
      shadow-mapSize={detail ? [2048, 2048] : [1024, 1024]}
      shadow-camera-left={-extent * 1.1}
      shadow-camera-right={extent * 1.1}
      shadow-camera-top={extent * 1.1}
      shadow-camera-bottom={-extent * 1.1}
      shadow-camera-far={extent * 5 + 12}
      shadow-normalBias={0.006}
    />
    <directionalLight position={[center[0] - extent * 0.7, extent * 0.8, center[2] - extent * 0.5]} intensity={cfg.fillInt} color={cfg.fillColor} />
  </>;
}

// Active interior point lights generated from placed light fixtures so warm pools of light spill across tables & counters.
function InteriorLights({ project, preset }: { project: Project; preset: LightingPreset }) {
  const invalidate = useThree(s => s.invalidate);
  const lights = useMemo(() => {
    if (preset === 'clay') return [];
    const fixtures = project.items.filter(i => i.kind === 'lighting' && isVisible(i, project));
    const maxLights = 4;
    const step = Math.max(1, Math.ceil(fixtures.length / maxLights));
    const sampled = fixtures.filter((_, idx) => idx % step === 0).slice(0, maxLights);
    const boost = preset === 'evening' ? 5.0 : preset === 'warm-dining' ? 2.4 : 0.75;
    if (sampled.length) {
      return sampled.map(i => {
        const m = modelOf(i);
        const y = Math.max(1.2, (baseHeight(project, i) + (m === 'pendant-lamp' || m === 'chandelier' ? 80 : 0)) / 1000);
        const cool = m === 'kitchen-panel-light';
        const intensity = (m === 'chandelier' ? 1.55 : m === 'linear-light' || m === 'track-light' ? 1.25 : 1.0) * boost;
        return {
          id: i.id,
          pos: [(i.x + i.w / 2) / 1000, y, (i.y + i.d / 2) / 1000] as [number, number, number],
          color: cool ? '#e8f5ff' : '#ffcb88',
          intensity,
          distance: m === 'chandelier' ? 11 : 8.5,
        };
      });
    }
    if (preset === 'evening') {
      // Gentle warm interior fill if the owner toggles evening mode before placing light fixtures
      return [
        { id: 'fallback-1', pos: [project.width * 0.35 / 1000, 2.5, project.height * 0.5 / 1000] as [number, number, number], color: '#ffca85', intensity: 4.5, distance: 10 },
        { id: 'fallback-2', pos: [project.width * 0.7 / 1000, 2.5, project.height * 0.5 / 1000] as [number, number, number], color: '#ffd9a8', intensity: 4.0, distance: 10 },
      ];
    }
    return [];
  }, [project.items, project.width, project.height, preset]);

  useEffect(() => { invalidate(); }, [lights, invalidate]);

  return <>
    {lights.map(l => (
      <pointLight key={l.id} position={l.pos} color={l.color} intensity={l.intensity} distance={l.distance} decay={2} />
    ))}
  </>;
}

function ShadowUpdates({ items, focus, detail, styleKey }: { items: Item[]; focus?: string; detail: boolean; styleKey: string }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, items, focus, detail, styleKey, invalidate]);
  return null;
}

const emptySet = new Set<string>();
const emptyIds: string[] = [];
const neverFaded = () => false;

export type SceneContentProps = {
  project: Project;
  interactive: boolean;
  capture: RefObject<SceneCaptureAPI | null>;
  detail?: boolean;
  grid?: boolean;
  gridSize?: number;
  forceCeiling?: boolean;
  cameraMode?: 'top' | 'oblique' | 'eye-level';
  focus?: Item;
  selectedIds?: string[];
  hideSelectionBox?: boolean;
  activeAreaId?: string | null;
  faded?: (item: Item) => boolean;
  handlers?: FurnitureHandlers;
  smartWallActive?: boolean;
  frontWallIds?: Set<string>;
  frontWallKey?: string;
  onUnderlayError?: (error: string) => void;
};

// Pure project-driven 3D scene graph shared by interactive Scene3D and read-only OffscreenStage.
export default function SceneContent({
  project,
  interactive,
  capture,
  detail = false,
  grid = false,
  gridSize = 500,
  forceCeiling = false,
  cameraMode = 'oblique',
  focus,
  selectedIds = emptyIds,
  hideSelectionBox = false,
  activeAreaId = null,
  faded,
  handlers,
  smartWallActive = false,
  frontWallIds = emptySet,
  frontWallKey = '',
  onUnderlayError,
}: SceneContentProps) {
  const style = resolveStyle(project);
  const cfg = atmosphereConfig[style.lightingPreset];

  const effectiveFocus = interactive ? focus : undefined;
  const effectiveHandlers = interactive ? handlers : undefined;
  const effectiveIds = interactive ? selectedIds : emptyIds;
  const showSelection = interactive && !hideSelectionBox;
  const effectiveFaded = interactive && faded ? faded : neverFaded;
  const effectiveAreaId = interactive ? activeAreaId : null;
  const effectiveSmartWall = interactive && smartWallActive;
  const effectiveFrontWallIds = interactive ? frontWallIds : emptySet;
  const effectiveFrontWallKey = interactive ? frontWallKey : '';

  const profiles = useMemo(() => wallProfiles(project), [project.items]);
  const renderOptions: BuildingRenderOptions = useMemo(() => ({
    wallMaterial: style.wallMaterial,
    cutaway: style.wallCutaway && cameraMode !== 'eye-level',
    lightingPreset: style.lightingPreset,
  }), [style.wallMaterial, style.wallCutaway, style.lightingPreset, cameraMode]);
  const cutawayRenderOptions: BuildingRenderOptions = useMemo(() => ({ ...renderOptions, cutaway: true }), [renderOptions]);

  const groups = useMemo(() => {
    const visible = effectiveFocus
      ? [effectiveFocus, ...project.items.filter(i => i.wallId === effectiveFocus.id)]
      : project.items.filter(i => i.kind !== 'zone' && !isAnnotation(i));
    const cutWalls = effectiveFrontWallIds.size ? project.items.filter(w => w.kind === 'wall' && effectiveFrontWallIds.has(w.id)) : [];
    const nearCutWall = (item: Item) => isItemNearWalls(item, cutWalls);
    const shown = visible.filter(i => {
      if (!isVisible(i, project)) return false;
      if (!effectiveFocus && cutawayWallDecorModels.has(modelOf(i)) && (renderOptions.cutaway || nearCutWall(i))) return false;
      return true;
    });
    const map = new Map<string, Item[]>();
    for (const original of shown) {
      const m = modelOf(original);
      const h = (renderOptions.cutaway || nearCutWall(original)) && !effectiveFocus && m === 'wood-feature-wall'
        ? Math.min(original.h, 1180)
        : original.h;
      const i = { ...original, h, sill: baseHeight(project, original) };
      const key = ['wall', 'door', 'window'].includes(i.kind) || cutawayWallDecorModels.has(m)
        ? i.id
        : JSON.stringify([i.kind, m, i.w, i.d, i.h, i.color, i.flipped, i.pointType, i.verification, m === 'shop-sign' ? i.name : '', effectiveFaded(i)]);
      const group = map.get(key);
      if (group) group.push(i);
      else map.set(key, [i]);
    }
    return map;
  }, [project, effectiveFocus?.id, renderOptions.cutaway, effectiveFrontWallIds, effectiveFaded]);

  const styleKey = JSON.stringify([style.floorMaterial, style.wallMaterial, style.lightingPreset, style.wallCutaway, style.showCeiling, cameraMode, effectiveFrontWallKey]);

  return <>
    <SceneCapture capture={capture} project={project} />
    <ShadowUpdates items={project.items} focus={effectiveFocus?.id} detail={detail} styleKey={styleKey} />
    <Environment
      detail={detail}
      preset={style.lightingPreset}
      center={effectiveFocus
        ? [(effectiveFocus.x + effectiveFocus.w / 2) / 1000, 0, (effectiveFocus.y + effectiveFocus.d / 2) / 1000]
        : [project.width / 2000, 0, project.height / 2000]}
      extent={effectiveFocus
        ? Math.max(effectiveFocus.w, effectiveFocus.d, effectiveFocus.h) / 1000 * 1.5
        : Math.max(project.width, project.height) / 1000}
    />
    {!effectiveFocus && <InteriorLights project={project} preset={style.lightingPreset} />}
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[project.width / 2000, effectiveFocus ? -0.002 : -0.085, project.height / 2000]} receiveShadow>
      <planeGeometry args={[1000, 1000]} />
      <meshStandardMaterial color={cfg.ground} roughness={0.94} />
    </mesh>
    {!effectiveFocus && <>
      <SiteFloor project={project} grid={grid} gridSize={gridSize} forceCeiling={forceCeiling} faded={effectiveFaded} />
      <SiteOverlay3D project={project} activeAreaId={effectiveAreaId} onUnderlayError={onUnderlayError} />
    </>}
    {!effectiveFocus && showSelection && project.items
      .filter(i => i.kind === 'zone' && effectiveIds.includes(i.id) && isVisible(i, project))
      .map(i => <ZoneHighlight key={i.id} item={i} />)}
    {[...groups].map(([spec, items]) => items.length >= 3
      ? <InstancedFurniture key={spec} spec={spec} items={items} handlers={effectiveHandlers} faded={effectiveFaded(items[0])} renderOptions={renderOptions} />
      : items.map(i => {
        const isFrontCut = effectiveSmartWall && ((i.kind === 'wall' && effectiveFrontWallIds.has(i.id)) || (!!i.wallId && effectiveFrontWallIds.has(i.wallId)));
        return (
          <Furniture
            key={i.id}
            profile={profiles.get(i.id)}
            item={i}
            selected={showSelection && effectiveIds.includes(i.id)}
            faded={effectiveFaded(i)}
            handlers={effectiveHandlers}
            renderOptions={isFrontCut ? cutawayRenderOptions : renderOptions}
            openings={i.kind === 'wall' ? project.items.filter(o => o.wallId === i.id) : undefined}
          />
        );
      }))}
    {showSelection && [...groups.values()]
      .filter(items => items.length >= 3)
      .flat()
      .filter(i => effectiveIds.includes(i.id))
      .map(i => (
        <group key={i.id} position={[(i.x + i.w / 2) / 1000, (i.sill ?? 0) / 1000, (i.y + i.d / 2) / 1000]} rotation={[0, -i.rotation * Math.PI / 180, 0]}>
          <SelectionBox item={i} />
        </group>
      ))}
    {effectiveFocus && (
      <ContactShadows
        key={[effectiveFocus.id, effectiveFocus.x, effectiveFocus.y, effectiveFocus.w, effectiveFocus.d, effectiveFocus.h, effectiveFocus.rotation].join('-')}
        position={[(effectiveFocus.x + effectiveFocus.w / 2) / 1000, 0, (effectiveFocus.y + effectiveFocus.d / 2) / 1000]}
        scale={Math.max(effectiveFocus.w, effectiveFocus.d) / 1000 * 2.5}
        far={effectiveFocus.h / 1000 * 1.5}
        resolution={256}
        blur={2.5}
        opacity={0.4}
        frames={1}
        color="#3e453d"
      />
    )}
  </>;
}
