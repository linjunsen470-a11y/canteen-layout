import { Project, modelOf } from './model';
import { siteOutline } from './site';
import { zoneCorners } from './zones';
import { isAnnotation } from './annotations';

export default function PlanMiniPreview({ project, className = '' }: { project: Project; className?: string }) {
  const pad = Math.max(project.width, project.height) * 0.055;
  const vb = `${-pad} ${-pad} ${project.width + pad * 2} ${project.height + pad * 2}`;
  const outline = siteOutline(project).map(p => `${p.x},${p.y}`).join(' ');
  const zones = project.items.filter(i => i.kind === 'zone' && !i.hidden);
  const bodies = project.items.filter(i => i.kind !== 'zone' && !isAnnotation(i) && !i.hidden && i.kind !== 'lighting');
  const lights = project.items.filter(i => i.kind === 'lighting' && !i.hidden);

  return (
    <svg className={`plan-mini-svg ${className}`} viewBox={vb} aria-hidden="true">
      <polygon points={outline} fill="#faf7f1" stroke="#b9b2a4" strokeWidth={Math.max(40, project.width * 0.005)} />
      {zones.map(z => (
        <polygon key={z.id} points={zoneCorners(z).map(p => `${p.x},${p.y}`).join(' ')} fill={z.color} opacity={0.42} />
      ))}
      {bodies.map(i => {
        const m = modelOf(i);
        const transform = `translate(${i.x + i.w / 2},${i.y + i.d / 2}) rotate(${i.rotation})`;
        if (i.kind === 'wall') {
          return <rect key={i.id} transform={transform} x={-i.w / 2} y={-i.d / 2} width={i.w} height={i.d} fill="#3a453f" />;
        }
        if (i.kind === 'window') {
          return <rect key={i.id} transform={transform} x={-i.w / 2} y={-i.d / 2} width={i.w} height={i.d} fill="#89bcc4" stroke="#2c4e56" strokeWidth={24} />;
        }
        if (i.kind === 'door') {
          return <rect key={i.id} transform={transform} x={-i.w / 2} y={-i.d / 2} width={i.w} height={i.d} fill="#d79d4b" />;
        }
        if (m === 'hood') {
          return <rect key={i.id} transform={transform} x={-i.w / 2} y={-i.d / 2} width={i.w} height={i.d} fill="none" stroke="#6c7d85" strokeWidth={28} strokeDasharray="110 80" />;
        }
        if (m === 'round-table' || m === 'marble-round-table' || m === 'potted-plant') {
          return <ellipse key={i.id} transform={transform} rx={i.w / 2} ry={i.d / 2} fill={i.color} stroke="#44524a" strokeWidth={22} />;
        }
        return (
          <rect
            key={i.id}
            transform={transform}
            x={-i.w / 2}
            y={-i.d / 2}
            width={i.w}
            height={i.d}
            rx={Math.min(60, Math.min(i.w, i.d) * 0.14)}
            fill={i.color}
            stroke="#4c5951"
            strokeWidth={20}
          />
        );
      })}
      {lights.map(l => (
        <circle key={l.id} cx={l.x + l.w / 2} cy={l.y + l.d / 2} r={Math.max(95, project.width * 0.01)} fill="#f3be62" opacity={0.55} />
      ))}
    </svg>
  );
}
