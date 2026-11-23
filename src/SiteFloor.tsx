import { useEffect, useMemo } from 'react';
import * as T from 'three';
import { Project, resolveStyle } from './model';
import { siteOutline } from './site';
import ZoneSurface from './ZoneSurface';
import { useWorkspace } from './workspace';
import { floorMaterialTexture } from './materials';

export default function SiteFloor({ project, grid, forceCeiling = false }: { project: Project; grid: boolean; forceCeiling?: boolean }) {
  const gridSize = useWorkspace(s => s.gridSize);
  const style = resolveStyle(project);
  const key = JSON.stringify(siteOutline(project));
  const isClay = style.lightingPreset === 'clay';

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

  useEffect(() => () => { geometry.dispose(); plinthGeometry.dispose(); }, [geometry, plinthGeometry]);

  const ceilingY = (style.ceilingHeight || 3200) / 1000;
  const showCeiling = (style.showCeiling || forceCeiling) && !style.wallCutaway;

  return <group>
    {/* Subtle architectural base plinth under the shop floor */}
    <mesh geometry={plinthGeometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.082, 0]} receiveShadow>
      <meshStandardMaterial color={style.lightingPreset === 'evening' ? '#2c3238' : '#d6d2c8'} roughness={0.82} />
    </mesh>
    {/* Primary textured interior floor */}
    <mesh name="site-floor" geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial
        color={isClay ? '#ecebe6' : floorTex.tint}
        map={isClay ? null : floorTex.map}
        roughness={isClay ? 0.88 : floorTex.roughness}
        metalness={0.04}
        side={T.DoubleSide}
      />
    </mesh>
    <lineSegments rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
      <edgesGeometry args={[geometry]} />
      <lineBasicMaterial color={style.lightingPreset === 'evening' ? '#4f5d58' : '#96a194'} />
    </lineSegments>
    {/* One-sided downward ceiling: invisible from bird's-eye above, visible when standing inside at eye level */}
    {showCeiling && (
      <mesh name="site-ceiling" geometry={geometry} rotation={[Math.PI / 2, 0, 0]} position={[0, ceilingY, 0]}>
        <meshStandardMaterial
          color={style.lightingPreset === 'evening' ? '#36322d' : '#f4f0e8'}
          roughness={0.92}
          side={T.FrontSide}
        />
      </mesh>
    )}
    {style.showZoneTint3D && project.items.filter(i => i.kind === 'zone' && !i.hidden).map(i => <ZoneSurface key={i.id} project={project} item={i} />)}
  </group>;
}
