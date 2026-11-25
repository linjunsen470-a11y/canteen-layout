import { memo, useEffect, useRef, useState } from 'react';
import { computeDragClearance, type DragClearance } from './spaceChecks';
import { useStore } from './store';

// Lightweight live aisle-clearance ruler shown only while dragging furniture in 2D.
// Computation is throttled to one requestAnimationFrame per frame and unsubscribes on release.
export default memo(function DragClearanceOverlay({
  draggedIds,
  scale,
}: {
  draggedIds: readonly string[] | null;
  scale: number;
}) {
  const [clearance, setClearance] = useState<DragClearance | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!draggedIds || !draggedIds.length) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setClearance(null);
      return;
    }

    const ids = draggedIds;
    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setClearance(computeDragClearance(useStore.getState().project, ids));
      });
    };

    schedule();
    const unsub = useStore.subscribe((state, prev) => {
      if (state.project !== prev.project) schedule();
    });

    return () => {
      unsub();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setClearance(null);
    };
  }, [draggedIds]);

  if (!clearance) return null;

  const color = clearance.tight ? '#c83b2b' : '#1d6e52';
  const bg = clearance.tight ? '#fdeceb' : '#eaf5f0';
  const label = clearance.overlapping ? '重叠 0 mm' : `${Math.round(clearance.distance)} mm`;
  const mx = (clearance.a.x + clearance.b.x) / 2;
  const my = (clearance.a.y + clearance.b.y) / 2;
  const pillW = (label.length * 6.8 + 16) / scale;
  const pillH = 18 / scale;

  return (
    <g
      data-ui="true"
      data-drag-clearance="true"
      data-tight={clearance.tight ? 'true' : 'false'}
      className={clearance.tight ? 'drag-clearance is-tight' : 'drag-clearance'}
      pointerEvents="none"
    >
      {!clearance.overlapping && (
        <line
          x1={clearance.a.x}
          y1={clearance.a.y}
          x2={clearance.b.x}
          y2={clearance.b.y}
          stroke={color}
          strokeWidth={1.6 / scale}
          strokeDasharray={`${4 / scale} ${3 / scale}`}
        />
      )}
      <circle cx={clearance.a.x} cy={clearance.a.y} r={3 / scale} fill={color} />
      <circle cx={clearance.b.x} cy={clearance.b.y} r={3 / scale} fill={color} />
      <rect
        x={mx - pillW / 2}
        y={my - pillH / 2}
        width={pillW}
        height={pillH}
        rx={9 / scale}
        fill={bg}
        stroke={color}
        strokeWidth={1 / scale}
      />
      <text
        x={mx}
        y={my + 1 / scale}
        fontSize={10 / scale}
        fill={color}
        textAnchor="middle"
        dominantBaseline="middle"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  );
});
