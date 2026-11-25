import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as T from 'three';
import { Project } from './model';
import { useImageAsset } from './imageAssets';

export default function SiteOverlay3D({
  project,
  activeAreaId = null,
  onUnderlayError,
}: {
  project: Project;
  activeAreaId?: string | null;
  onUnderlayError?: (error: string) => void;
}) {
  const u = project.underlay;
  const { url, error } = useImageAsset(u && !u.hidden ? u.assetId : undefined);
  const invalidate = useThree(s => s.invalidate);
  const [texture, setTexture] = useState<T.Texture | null>(null);

  useEffect(() => {
    if (u && !u.hidden && error) onUnderlayError?.(error);
  }, [u?.assetId, u?.hidden, error, onUnderlayError]);

  useEffect(() => {
    if (!url) { setTexture(null); return; }
    let live = true;
    const t = new T.TextureLoader().load(
      url,
      () => {
        if (live) {
          t.colorSpace = T.SRGBColorSpace;
          setTexture(t);
          invalidate();
        }
      },
      undefined,
      () => {
        if (live) onUnderlayError?.('底图未加载完成或资产缺失，请先恢复底图后截图');
      },
    );
    return () => { live = false; t.dispose(); setTexture(null); };
  }, [url, invalidate, onUnderlayError]);

  const area = activeAreaId ? project.planningAreas?.find(a => a.id === activeAreaId) : undefined;
  const key = JSON.stringify(area?.outline ?? []);
  const geometry = useMemo(
    () => area ? new T.ShapeGeometry(new T.Shape(area.outline.map(v => new T.Vector2(v.x / 1000, -v.y / 1000)))) : null,
    [key],
  );
  useEffect(() => () => { geometry?.dispose(); }, [geometry]);

  return <>
    {u && !u.hidden && texture && (
      <group position={[u.x / 1000, 0.001, u.y / 1000]} rotation={[0, -u.rotation * Math.PI / 180, 0]}>
        <mesh renderOrder={1} name={`site-underlay:${u.assetId}`} position={[u.pixelWidth * u.mmPerPixel / 2000, 0, u.pixelHeight * u.mmPerPixel / 2000]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
          <planeGeometry args={[u.pixelWidth * u.mmPerPixel / 1000, u.pixelHeight * u.mmPerPixel / 1000]} />
          <meshBasicMaterial map={texture} transparent opacity={u.opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} side={T.DoubleSide} />
        </mesh>
      </group>
    )}
    {geometry && area && (
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
        <mesh renderOrder={3} geometry={geometry} raycast={() => {}}>
          <meshBasicMaterial color={area.color} transparent opacity={0.13} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} side={T.DoubleSide} />
        </mesh>
        <lineSegments raycast={() => {}}>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color={area.color} />
        </lineSegments>
      </group>
    )}
  </>;
}
