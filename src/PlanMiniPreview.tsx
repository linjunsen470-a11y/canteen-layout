import { memo, useMemo } from 'react';
import { Project, modelOf } from './model';
import { siteOutline } from './site';
import { footprint } from './spatial';
import { zoneArea, zoneCorners } from './zones';

export default memo(function PlanMiniPreview({ project, className = '', showZoneLabels = true }: {
  project: Project;
  className?: string;
  showZoneLabels?: boolean;
}) {
  const { outlinePts, pad, vbW, vbH, zones, furniture, walls, openings, columns } = useMemo(() => {
    const outline = siteOutline(project);
    const padVal = Math.max(project.width, project.height) * 0.08;
    const zonesList = project.items.filter(i => i.kind === 'zone' && !i.hidden);
    const wallsList = project.items.filter(i => (i.kind === 'wall' || i.kind === 'partition') && !i.hidden);
    const openingsList = project.items.filter(i => (i.kind === 'door' || i.kind === 'window') && !i.hidden);
    const columnsList = project.items.filter(i => (i.kind === 'column' || i.kind === 'fixture' || i.kind === 'stairs') && !i.hidden);
    const furnList = project.items.filter(i =>
      !i.hidden && !['zone', 'wall', 'partition', 'door', 'window', 'lighting', 'text', 'dimension', 'leader', 'column', 'fixture', 'stairs', 'utility'].includes(i.kind)
    );
    return {
      outlinePts: outline.map(p => `${p.x},${p.y}`).join(' '),
      pad: padVal,
      vbW: project.width + padVal * 2,
      vbH: project.height + padVal * 2,
      zones: zonesList,
      furniture: furnList,
      walls: wallsList,
      openings: openingsList,
      columns: columnsList,
    };
  }, [project]);

  const fs = Math.max(220, Math.min(460, Math.max(project.width, project.height) * 0.029));

  return (
    <svg
      className={`plan-mini-preview ${className}`}
      viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      role="img"
      aria-label={`${project.name} 平面预览`}
    >
      <polygon points={outlinePts} fill="#faf7f1" stroke="#354f43" strokeWidth={Math.max(40, project.width * 0.005)} />
      {zones.map(z => (
        <polygon
          key={z.id}
          points={zoneCorners(z).map(p => `${p.x},${p.y}`).join(' ')}
          fill={z.color}
          fillOpacity={0.78}
          stroke="#9bb0a2"
          strokeWidth={Math.max(24, project.width * 0.003)}
          strokeDasharray={`${fs * 0.45} ${fs * 0.3}`}
        />
      ))}
      {furniture.map(i => {
        const m = modelOf(i);
        const isHood = m === 'hood';
        return (
          <polygon
            key={i.id}
            points={footprint(i).map(p => `${p.x},${p.y}`).join(' ')}
            fill={isHood ? 'none' : i.color}
            fillOpacity={isHood ? 0 : 0.92}
            stroke={isHood ? '#5d747e' : '#3a4c42'}
            strokeWidth={Math.max(18, project.width * 0.0024)}
            strokeDasharray={isHood ? `${fs * 0.35} ${fs * 0.25}` : undefined}
          />
        );
      })}
      {columns.map(i => (
        <polygon
          key={i.id}
          points={footprint(i).map(p => `${p.x},${p.y}`).join(' ')}
          fill="#6e7673"
          stroke="#2f3935"
          strokeWidth={Math.max(22, project.width * 0.003)}
        />
      ))}
      {walls.map(i => (
        <polygon
          key={i.id}
          points={footprint(i).map(p => `${p.x},${p.y}`).join(' ')}
          fill="#354c41"
          stroke="#253830"
          strokeWidth={Math.max(16, project.width * 0.002)}
        />
      ))}
      {openings.map(i => (
        <polygon
          key={i.id}
          points={footprint(i).map(p => `${p.x},${p.y}`).join(' ')}
          fill={i.kind === 'door' ? '#d9a45b' : '#85b5c8'}
          stroke="#263c33"
          strokeWidth={Math.max(18, project.width * 0.0024)}
        />
      ))}
      {showZoneLabels && zones.map(z => {
        const area = zoneArea(project, z) / 1e6;
        if (area < 1.5) return null;
        const corners = zoneCorners(z);
        const cx = corners.reduce((s, p) => s + p.x, 0) / corners.length;
        const cy = corners.reduce((s, p) => s + p.y, 0) / corners.length;
        const label = `${z.name} ${area.toFixed(1)}㎡`;
        const bw = label.length * fs * 0.72 + fs * 0.7;
        const bh = fs * 1.65;
        return (
          <g key={`lbl-${z.id}`}>
            <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={bh * 0.35} fill="#ffffff" fillOpacity={0.9} stroke="#b9c6bc" strokeWidth={fs * 0.08} />
            <text x={cx} y={cy + fs * 0.08} fontSize={fs * 0.82} fontWeight={650} fill="#213b30" textAnchor="middle" dominantBaseline="middle">
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
