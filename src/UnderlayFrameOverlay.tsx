import { useRef } from 'react';
import type { Point } from './model';
import { useStore } from './store';
import { useUnderlayFrame } from './underlayFrameState';
import {
  dragFrameCorner,
  dragFrameNotch,
  framePolygon,
  notchInnerCorner,
  normalizeFrame,
  type FrameCornerHandle,
  type UnderlayFrame,
} from './underlayFrame';

type DragState =
  | { mode: 'move'; start: Point; origin: UnderlayFrame }
  | { mode: 'corner'; handle: FrameCornerHandle; origin: UnderlayFrame }
  | { mode: 'notch'; origin: UnderlayFrame };

export default function UnderlayFrameOverlay({ scale }: { scale: number }) {
  const projectId = useStore(s => s.project.id);
  const { projectId: frameProjectId, frame, update } = useUnderlayFrame();
  const drag = useRef<DragState | null>(null);

  if (!frame || frameProjectId !== projectId) return null;

  const coord = (e: React.PointerEvent<SVGElement>): Point => {
    const m = e.currentTarget.closest<SVGGElement>('[data-plan]')!.getScreenCTM()!;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const begin = (e: React.PointerEvent<SVGElement>, next: DragState) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = next;
  };

  const onMove = (e: React.PointerEvent<SVGElement>) => {
    const d = drag.current;
    if (!d) return;
    e.stopPropagation();
    const pt = coord(e);
    const step = e.altKey ? 1 : 50;
    if (d.mode === 'move') {
      const dx = pt.x - d.start.x;
      const dy = pt.y - d.start.y;
      const q = (v: number) => (step > 1 ? Math.round(v / step) * step : Math.round(v));
      update(normalizeFrame({ ...d.origin, x: q(d.origin.x + dx), y: q(d.origin.y + dy) }));
    } else if (d.mode === 'corner') {
      update(dragFrameCorner(d.origin, d.handle, pt, step));
    } else {
      update(dragFrameNotch(d.origin, pt, step));
    }
  };

  const onEnd = (e: React.PointerEvent<SVGElement>) => {
    if (!drag.current) return;
    e.stopPropagation();
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const points = framePolygon(frame);
  const cornerHandles: Array<{ id: FrameCornerHandle; x: number; y: number; cursor: string }> = [
    { id: 'top-left', x: frame.x, y: frame.y, cursor: 'nwse-resize' },
    { id: 'top-right', x: frame.x + frame.width, y: frame.y, cursor: 'nesw-resize' },
    { id: 'bottom-right', x: frame.x + frame.width, y: frame.y + frame.depth, cursor: 'nwse-resize' },
    { id: 'bottom-left', x: frame.x, y: frame.y + frame.depth, cursor: 'nesw-resize' },
  ];
  const notch = notchInnerCorner(frame);

  return (
    <g
      data-ui="true"
      data-underlay-frame="true"
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
    >
      <polygon
        points={points.map(p => `${p.x},${p.y}`).join(' ')}
        fill="#246e5520"
        stroke="#1d664c"
        strokeWidth={2.2 / scale}
        strokeDasharray={`${8 / scale} ${4 / scale}`}
        style={{ cursor: 'move' }}
        onPointerDown={e => begin(e, { mode: 'move', start: coord(e), origin: frame })}
      />
      <text
        x={frame.x + frame.width / 2}
        y={frame.y - 12 / scale}
        textAnchor="middle"
        fontSize={12 / scale}
        fontWeight="700"
        fill="#1b5943"
        stroke="white"
        strokeWidth={3 / scale}
        paintOrder="stroke"
        pointerEvents="none"
      >
        净宽 {(frame.width / 1000).toFixed(2)} m
      </text>
      <text
        x={frame.x - 14 / scale}
        y={frame.y + frame.depth / 2}
        textAnchor="middle"
        fontSize={12 / scale}
        fontWeight="700"
        fill="#1b5943"
        stroke="white"
        strokeWidth={3 / scale}
        paintOrder="stroke"
        transform={`rotate(-90 ${frame.x - 14 / scale} ${frame.y + frame.depth / 2})`}
        pointerEvents="none"
      >
        净深 {(frame.depth / 1000).toFixed(2)} m
      </text>
      {cornerHandles.map(h => (
        <circle
          key={h.id}
          data-frame-handle={h.id}
          cx={h.x}
          cy={h.y}
          r={7 / scale}
          fill="#ffffff"
          stroke="#1d664c"
          strokeWidth={2 / scale}
          style={{ cursor: h.cursor }}
          onPointerDown={e => begin(e, { mode: 'corner', handle: h.id, origin: frame })}
        />
      ))}
      {notch && (
        <>
          <circle
            data-frame-handle="notch"
            cx={notch.x}
            cy={notch.y}
            r={7 / scale}
            fill="#fff4e5"
            stroke="#c45c1c"
            strokeWidth={2.2 / scale}
            style={{ cursor: 'move' }}
            onPointerDown={e => begin(e, { mode: 'notch', origin: frame })}
          />
          <text
            x={notch.x}
            y={notch.y - 12 / scale}
            textAnchor="middle"
            fontSize={11 / scale}
            fontWeight="700"
            fill="#9b4312"
            stroke="white"
            strokeWidth={3 / scale}
            paintOrder="stroke"
            pointerEvents="none"
          >
            缺口 {(frame.notchWidth / 1000).toFixed(2)} × {(frame.notchDepth / 1000).toFixed(2)} m
          </text>
        </>
      )}
    </g>
  );
}
