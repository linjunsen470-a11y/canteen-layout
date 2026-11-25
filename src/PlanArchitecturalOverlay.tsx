import { memo, useMemo } from 'react';
import { Project } from './model';
import { inspectSpace } from './spaceChecks';
import { bounds } from './spatial';

function PlanArchitecturalOverlay({
  project,
  scale,
  showFlow,
}: {
  project: Project;
  scale: number;
  showFlow: boolean;
}) {
  const stroke = 1 / scale;
  const tick = 5 / scale;
  const font = 11 / scale;
  const offset = 28 / scale;

  const flowMetrics = useMemo(() => {
    if (!showFlow) return null;
    const { issues, clearances } = inspectSpace(project, null, true);
    const critical = issues.filter(i => i.type !== '参考净距');

    return { critical, clearances };
  }, [project, showFlow]);

  const prefix = project.survey ? '外 ' : '';
  const widthLabel = prefix + `${(project.width / 1000).toFixed(2)} m`;
  const heightLabel = prefix + `${(project.height / 1000).toFixed(2)} m`;
  const scaleBarW = project.width >= 6000 ? 2000 : 1000;

  return (
    <g pointerEvents="none">
      {/* Top architectural exterior dimension line */}
      <g stroke="#7a887e" strokeWidth={stroke} fill="#5c6c61">
        <line x1={0} y1={-offset} x2={project.width} y2={-offset} />
        <line x1={0} y1={-offset - tick} x2={0} y2={-offset + tick} />
        <line x1={project.width} y1={-offset - tick} x2={project.width} y2={-offset + tick} />
        <rect
          x={project.width / 2 - 34 / scale}
          y={-offset - 9 / scale}
          width={68 / scale}
          height={18 / scale}
          rx={4 / scale}
          fill="#f4f1ea"
          stroke="none"
        />
        <text x={project.width / 2} y={-offset + 1 / scale} fontSize={font} textAnchor="middle" dominantBaseline="middle" stroke="none" fontWeight="600">
          {widthLabel}
        </text>
      </g>

      {/* Left architectural exterior dimension line */}
      <g stroke="#7a887e" strokeWidth={stroke} fill="#5c6c61">
        <line x1={-offset} y1={0} x2={-offset} y2={project.height} />
        <line x1={-offset - tick} y1={0} x2={-offset + tick} y2={0} />
        <line x1={-offset - tick} y1={project.height} x2={-offset + tick} y2={project.height} />
        <g transform={`translate(${-offset},${project.height / 2}) rotate(-90)`}>
          <rect x={-34 / scale} y={-9 / scale} width={68 / scale} height={18 / scale} rx={4 / scale} fill="#f4f1ea" stroke="none" />
          <text x={0} y={1 / scale} fontSize={font} textAnchor="middle" dominantBaseline="middle" stroke="none" fontWeight="600">
            {heightLabel}
          </text>
        </g>
      </g>

      {/* Subtle architectural scale bar at bottom-left */}
      <g transform={`translate(0, ${project.height + 24 / scale})`}>
        <rect x={0} y={0} width={scaleBarW / 2} height={4 / scale} fill="#46594f" />
        <rect x={scaleBarW / 2} y={0} width={scaleBarW / 2} height={4 / scale} fill="#ffffff" stroke="#46594f" strokeWidth={stroke} />
        <text x={0} y={14 / scale} fontSize={9.5 / scale} fill="#66766b">0</text>
        <text x={scaleBarW / 2} y={14 / scale} fontSize={9.5 / scale} fill="#66766b" textAnchor="middle">{scaleBarW / 2000}m</text>
        <text x={scaleBarW} y={14 / scale} fontSize={9.5 / scale} fill="#66766b" textAnchor="middle">{scaleBarW / 1000}m</text>
      </g>

      {/* Toggleable Aisle Clearance & Customer Flow Overlay */}
      {showFlow && flowMetrics && (
        <g data-ui="true">
          {/* Measured passage clearance callouts */}
          {flowMetrics.clearances.map((c, idx) => {
            const ok = c.distance >= (project.clearance ?? 900) - 0.1;
            const color = ok ? '#1d6e52' : '#c0671e';
            const bg = ok ? '#eaf5f0' : '#fdf2e6';
            const mx = (c.a.x + c.b.x) / 2;
            const my = (c.a.y + c.b.y) / 2;
            return (
              <g key={idx}>
                <line x1={c.a.x} y1={c.a.y} x2={c.b.x} y2={c.b.y} stroke={color} strokeWidth={1.6 / scale} strokeDasharray={`${4 / scale} ${3 / scale}`} />
                <circle cx={c.a.x} cy={c.a.y} r={3 / scale} fill={color} />
                <circle cx={c.b.x} cy={c.b.y} r={3 / scale} fill={color} />
                <rect x={mx - 30 / scale} y={my - 9 / scale} width={60 / scale} height={18 / scale} rx={9 / scale} fill={bg} stroke={color} strokeWidth={1 / scale} />
                <text x={mx} y={my + 1 / scale} fontSize={9.5 / scale} fill={color} textAnchor="middle" dominantBaseline="middle" fontWeight="700">
                  {Math.round(c.distance)}mm
                </text>
              </g>
            );
          })}

          {/* Highlight genuine collisions / door conflicts directly on canvas */}
          {flowMetrics.critical.map((issue, idx) => {
            const items = project.items.filter(i => issue.ids.includes(i.id));
            if (!items.length) return null;
            const b = bounds(items);
            return (
              <g key={idx}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="#d94e3422" stroke="#d94e34" strokeWidth={2 / scale} strokeDasharray={`${6 / scale} ${3 / scale}`} />
                <rect x={b.x} y={b.y - 20 / scale} width={78 / scale} height={18 / scale} rx={4 / scale} fill="#c83e28" />
                <text x={b.x + 39 / scale} y={b.y - 10 / scale} fontSize={9.5 / scale} fill="#fff" textAnchor="middle" dominantBaseline="middle" fontWeight="700">
                  {issue.type}
                </text>
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

export default memo(PlanArchitecturalOverlay, (prev, next) => {
  if (prev.scale !== next.scale || prev.showFlow !== next.showFlow) return false;
  if (next.showFlow) return prev.project === next.project;
  return (
    prev.project.width === next.project.width &&
    prev.project.height === next.project.height &&
    !!prev.project.survey === !!next.project.survey
  );
});
