import { useEffect, useMemo } from 'react';
import * as T from 'three';
import { Project, resolveStyle } from './model';
import { siteOutline } from './site';
import ZoneSurface from './ZoneSurface';
import { useWorkspace } from './workspace';
import { floorBumpTexture, floorMaterialTexture } from './materials';

export default function SiteFloor({ project, grid, forceCeiling = false }: { project: Project; grid: boolean; forceCeiling?: boolean }) {
  const gridSize = useWorkspace(s => s.gridSize);
  const style = resolveStyle(project);
  const key = JSON.stringify(siteOutline(project));
  const isClay = style.lightingPreset === 'clay';
  const isEvening = style.lightingPreset === 'evening';

  const { geometry, plinthGeometry } = useMemo(() => {
    const points = JSON.parse(key) as { x: number; y: number }[];
    const shape = new T.Shape(points.map(p => new T.Vector2(p.x / 1000, -p.y / 1000)));
    const flat = new T.ShapeGeometry(shape);
    const plinth = new T.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    return { geometry: flat, plinthGeometry: plinth };
  }, [key]);

  const floorTex = useMemo(
    () => floorMaterialTexture(isClay ? 'checker' : style.floorMaterial, grid, gridSize),
    [isClay, style.floorMaterial, grid, gridSize]
  );
  const floorBump = useMemo(
    () => isClay ? null : floorBumpTexture(style.floorMaterial),
    [isClay, style.floorMaterial]
  );

  useEffect(() => () => { geometry.dispose(); plinthGeometry.dispose(); }, [geometry, plinthGeometry]);

  const ceilingY = (style.ceilingHeight || 3200) / 1000;
  const showCeiling = (style.showCeiling || forceCeiling) && !style.wallCutaway;
  const wM = project.width / 1000;
  const hM = project.height / 1000;
  const beamCount = Math.max(2, Math.min(6, Math.round(wM / 2.6)));

  return <group>
    {/* Subtle exterior mall corridor / street promenade apron along storefront facade */}
    {!isClay && !project.basicDraft && (
      <group position={[wM / 2, -0.025, hM + 1.55]}>
        <mesh receiveShadow>
          <boxGeometry args={[wM + 3.6, 0.05, 3.1]} />
          <meshStandardMaterial color={isEvening ? '#272d34' : '#dcd8ce'} roughness={0.84} />
        </mesh>
        {/* Subtle brass/stone threshold strip at storefront entry */}
        <mesh position={[0, 0.028, -1.52]} receiveShadow>
          <boxGeometry args={[wM, 0.01, 0.08]} />
          <meshStandardMaterial color={isEvening ? '#5b5245' : '#b7a994'} roughness={0.55} metalness={0.25} />
        </mesh>
      </group>
    )}
    {/* Subtle architectural base plinth under the shop floor */}
    <mesh geometry={plinthGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.082, 0]} receiveShadow>
      <meshStandardMaterial color={isEvening ? '#2c3238' : '#d6d2c8'} roughness={0.82} />
    </mesh>
    {/* Primary textured interior floor with procedural PBR bump */}
    <mesh name="site-floor" geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        color={isClay ? '#ecebe6' : floorTex.tint}
        map={isClay ? null : floorTex.map}
        bumpMap={floorBump?.bumpMap ?? null}
        bumpScale={floorBump?.bumpScale ?? 0}
        roughness={isClay ? 0.88 : floorTex.roughness}
        metalness={0.04}
        side={T.DoubleSide}
      />
    </mesh>
    <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
      <edgesGeometry args={[geometry]} />
      <lineBasicMaterial color={isEvening ? '#4f5d58' : '#96a194'} />
    </lineSegments>
    {/* One-sided downward ceiling with subtle architectural wood/plaster ceiling beams in eye-level views */}
    {showCeiling && (
      <group>
        <mesh name="site-ceiling" geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, ceilingY, 0]}>
          <meshStandardMaterial
            color={isEvening ? '#332f2b' : '#f4efe7'}
            roughness={0.92}
            side={T.BackSide}
          />
        </mesh>
        {!isClay && !project.basicDraft && Array.from({ length: beamCount }, (_, idx) => {
          const bx = ((idx + 0.5) / beamCount) * wM;
          return (
            <mesh key={idx} position={[bx, ceilingY - 0.055, hM / 2]}>
              <boxGeometry args={[0.09, 0.11, Math.max(1, hM - 0.5)]} />
              <meshStandardMaterial color={isEvening ? '#4a3a2d' : '#c5a57e'} roughness={0.62} />
            </mesh>
          );
        })}
      </group>
    )}
    {style.showZoneTint3D && project.items.filter(i => i.kind === 'zone' && !i.hidden).map(i => <ZoneSurface key={i.id} project={project} item={i} />)}
  </group>;
}
