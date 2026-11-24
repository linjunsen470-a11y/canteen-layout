import { useMemo } from 'react';
import { Project, modelOf } from './model';
import { inspectSpace } from './spaceChecks';
import { bounds } from './spatial';
import { isVisible } from './editorInteraction';

export default function PlanArchitecturalOverlay({
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

  // Locate primary entrance door (prefer front-most glass/double door)
  const entranceDoor = useMemo(() => {
    const doors = project.items.filter(i => i.kind === 'door' && isVisible(i, project));
    if (!doors.length) return null;
    return doors.sort((a, b) => (b.y + b.d / 2) - (a.y + a.d / 2))[0];
  }, [project]);

  const flowMetrics = useMemo(() => {
    if (!showFlow) return null;
    const { issues, clearances } = inspectSpace(project, null, true);
    const critical = issues.filter(i => i.type !== '参考净距');

    // Main customer flow arrow: entrance -> cashier/bar -> center dining
    const counter = project.items.find(i => !i.hidden && (modelOf(i) === 'cashier' || modelOf(i) === 'tea-bar' || modelOf(i) === 'buffet'));
    const entryPt = entranceDoor
      ? { x: entranceDoor.x + entranceDoor.w / 2, y: entranceDoor.y + entranceDoor.d / 2 }
      : { x: project.width * 0.5, y: project.height - 200 };
    const midPt = { x: entryPt.x, y: Math.max(project.height * 0.45, entryPt.y - 2200) };
    const counterPt = counter ? { x: counter.x + counter.w / 2, y: counter.y + counter.d + 450 } : null;

    return { critical, clearances, entryPt, midPt, counterPt };
  }, [project, showFlow, entranceDoor]);

  const widthLabel = `${(project.width / 1000).toFixed(2)} m`;
  const heightLabel = `${(project.height / 1000).toFixed(2)} m`;
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

      {/* Storefront main entrance badge */}
      {entranceDoor && (
        <g transform={`translate(${entranceDoor.x + entranceDoor.w / 2}, ${Math.max(project.height + 24 / scale, entranceDoor.y + entranceDoor.d + 22 / scale)})`}>
          <rect x={-38 / scale} y={-11 / scale} width={76 / scale} height={22 / scale} rx={11 / scale} fill="#1f4638" />
          <text x={0} y={1 / scale} fontSize={10 / scale} fill="#faf5eb" textAnchor="middle" dominantBaseline="middle" fontWeight="600">
            ▲ 主入口
          </text>
        </g>
      )}

      {/* Toggleable Aisle Clearance & Customer Flow Overlay */}
      {showFlow && flowMetrics && (
        <g data-ui="true">
          {/* Customer entry & service flow path */}
          <path
            d={flowMetrics.counterPt
              ? `M ${flowMetrics.entryPt.x} ${flowMetrics.entryPt.y + 180} L ${flowMetrics.midPt.x} ${flowMetrics.midPt.y} L ${flowMetrics.counterPt.x} ${flowMetrics.counterPt.y}`
              : `M ${flowMetrics.entryPt.x} ${flowMetrics.entryPt.y + 180} L ${flowMetrics.midPt.x} ${flowMetrics.midPt.y}`}
            fill="none"
            stroke="#2a7a5c"
            strokeWidth={2.5 / scale}
            strokeDasharray={`${8 / scale} ${6 / scale}`}
            opacity={0.75}
          />
          <circle cx={flowMetrics.midPt.x} cy={flowMetrics.midPt.y} r={5 / scale} fill="#2a7a5c" />

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
