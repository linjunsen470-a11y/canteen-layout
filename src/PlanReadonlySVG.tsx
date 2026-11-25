import { useMemo } from 'react';
import { Project, modelOf, resolveStyle } from './model';
import { isVisible } from './editorInteraction';
import { wallProfiles } from './wallJoints';
import { siteOutline } from './site';
import { zoneCorners } from './zones';
import { isBuilding, isOpening } from './structure';
import { isAnnotation } from './annotations';
import { pointGlyphs } from './siteObjects';
import PlanFloorPattern from './PlanFloorPattern';
import AnnotationSymbol from './AnnotationSymbol';
import BuildingSymbol from './BuildingSymbol';
import EquipmentSymbol from './EquipmentSymbol';

// Pure read-only 2D plan SVG for offscreen export; matches PlanEditor's geometry and symbols without store hooks.
export default function PlanReadonlySVG({ project, underlayUrl }: { project: Project; underlayUrl?: string }) {
  const style = resolveStyle(project);
  const scale = Math.max(1, Math.round(2000 * project.width / Math.max(project.width, project.height))) / Math.max(1, project.width);
  const profiles = useMemo(() => wallProfiles(project), [project]);
  const floorPoints = useMemo(() => siteOutline(project).map(v => `${v.x},${v.y}`).join(' '), [project]);

  const visibleItems = project.items.filter(i => isVisible(i, project) && (style.showLightsIn2D || i.kind !== 'lighting'));
  const orderedItems = [
    ...visibleItems.filter(i => i.kind === 'wall' || i.kind === 'partition'),
    ...visibleItems.filter(i => i.kind !== 'zone' && i.kind !== 'wall' && i.kind !== 'partition' && i.kind !== 'lighting' && !isOpening(i) && !isAnnotation(i) && modelOf(i) !== 'hood'),
    ...visibleItems.filter(i => modelOf(i) === 'hood'),
    ...visibleItems.filter(isOpening),
    ...visibleItems.filter(i => i.kind === 'lighting'),
    ...visibleItems.filter(isAnnotation),
  ];
  const u = project.underlay;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${project.width} ${project.height}`}>
      <defs>
        <clipPath id="site-clip"><polygon points={floorPoints} /></clipPath>
        <PlanFloorPattern material={style.floorMaterial} />
      </defs>
      <g data-plan="true">
        <polygon data-site-floor="true" points={floorPoints} fill="url(#plan-floor)" stroke="#7c9286" strokeWidth={1.2 / scale} />
        {u && !u.hidden && underlayUrl && (
          <image
            data-underlay="true"
            href={underlayUrl}
            width={u.pixelWidth}
            height={u.pixelHeight}
            transform={`translate(${u.x},${u.y}) rotate(${u.rotation}) scale(${u.mmPerPixel})`}
            opacity={u.opacity}
            pointerEvents="none"
          />
        )}
        {visibleItems.filter(i => i.kind === 'zone').map(i => (
          <g key={i.id} data-item-id={i.id}>
            <polygon points={zoneCorners(i).map(p => `${p.x},${p.y}`).join(' ')} fill={i.color} opacity={0.26} pointerEvents="none" clipPath="url(#site-clip)" />
            <polygon points={zoneCorners(i).map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#acbcb3" strokeWidth={1 / scale} strokeDasharray={`${5 / scale} ${4 / scale}`} />
          </g>
        ))}
        {orderedItems.map(i => {
          const m = modelOf(i);
          const isRound = m === 'round-table' || m === 'marble-round-table';
          const isLight = i.kind === 'lighting';
          const isPlant = m === 'potted-plant';
          const isHood = m === 'hood';
          return (
            <g key={i.id} data-item-id={i.id} opacity={isLight ? 0.82 : 1} transform={`translate(${i.x + i.w / 2},${i.y + i.d / 2}) rotate(${i.rotation})`}>
              {isAnnotation(i)
                ? <AnnotationSymbol item={i} selected={false} scale={scale} />
                : isBuilding(i)
                  ? <BuildingSymbol profile={profiles.get(i.id)} item={i} selected={false} scale={scale} />
                  : isHood
                    ? <g>
                        <rect x={-i.w / 2} y={-i.d / 2} width={i.w} height={i.d} rx={Math.min(40, 2 / scale)} fill="#7f95a0" fillOpacity={0.14} stroke="#556c78" strokeWidth={1.3 / scale} strokeDasharray={`${7 / scale} ${4 / scale}`} />
                        <line x1={-i.w / 2} y1={-i.d / 2} x2={i.w / 2} y2={i.d / 2} stroke="#556c78" strokeOpacity={0.28} strokeWidth={0.9 / scale} pointerEvents="none" />
                        <line x1={-i.w / 2} y1={i.d / 2} x2={i.w / 2} y2={-i.d / 2} stroke="#556c78" strokeOpacity={0.28} strokeWidth={0.9 / scale} pointerEvents="none" />
                      </g>
                    : isLight || isPlant
                      ? <ellipse rx={i.w / 2} ry={i.d / 2} fill="transparent" stroke="none" strokeWidth={0} />
                      : isRound
                        ? <ellipse rx={i.w / 2} ry={i.d / 2} fill={i.color} stroke="#5e7166" strokeWidth={1 / scale} />
                        : <rect x={-i.w / 2} y={-i.d / 2} width={i.w} height={i.d} rx={Math.min(50, 3 / scale)} fill={i.color} stroke="#5e7166" strokeWidth={1 / scale} />}
              {!isBuilding(i) && !isHood && <EquipmentSymbol item={i} scale={scale} />}
              {i.kind === 'utility' && (
                <g pointerEvents="none">
                  <circle r={Math.min(i.w, i.d) * 0.4} fill="none" stroke="#fff" strokeWidth={1.5 / scale} />
                  <text textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(i.w, i.d) * 0.6} fill="#fff">{pointGlyphs[i.pointType ?? 'power']}</text>
                  {i.verification !== 'confirmed' && <text x={i.w / 2} y={-i.d / 2} fill="#9f5d12" fontSize={12 / scale}>?</text>}
                </g>
              )}
              {i.kind === 'column' && <path pointerEvents="none" d={`M ${-i.w / 2} ${-i.d / 2} L ${i.w / 2} ${i.d / 2} M ${-i.w / 2} ${i.d / 2} L ${i.w / 2} ${-i.d / 2}`} stroke="#66766b" strokeWidth={1 / scale} />}
              {i.kind === 'stairs' && (
                <g pointerEvents="none" stroke="#5e7166" strokeWidth={1 / scale}>
                  {Array.from({ length: Math.max(3, Math.min(40, Math.round(i.h / 160))) - 1 }, (_, k) => (
                    <line
                      key={k}
                      x1={-i.w / 2}
                      x2={i.w / 2}
                      y1={i.d / 2 - (k + 1) * i.d / Math.max(3, Math.min(40, Math.round(i.h / 160)))}
                      y2={i.d / 2 - (k + 1) * i.d / Math.max(3, Math.min(40, Math.round(i.h / 160)))}
                    />
                  ))}
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
