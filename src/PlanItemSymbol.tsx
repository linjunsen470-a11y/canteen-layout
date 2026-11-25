import { memo } from 'react';
import { type Item, type Point, modelOf } from './model';
import { facingModels } from './equipmentFacing';
import { isBuilding } from './structure';
import { isAnnotation } from './annotations';
import { pointGlyphs } from './siteObjectMeta';
import BuildingSymbol from './BuildingSymbol';
import AnnotationSymbol from './AnnotationSymbol';
import EquipmentSymbol from './EquipmentSymbol';

const quietLabels = new Set(['wood-feature-wall', 'wall-art', 'tv-screen', 'shop-sign', 'menu-board']);

type Props = {
  item: Item;
  selected: boolean;
  draftSeat: boolean;
  singleSelected: boolean;
  scale: number;
  profile?: Point[];
  faded: boolean;
  passThrough: boolean;
  cursor: string;
  onEndpoint?: (event: React.PointerEvent, item: Item, end: 'start' | 'end') => void;
};

export default memo(function PlanItemSymbol({
  item: i,
  selected,
  draftSeat,
  singleSelected,
  scale,
  profile,
  faded,
  passThrough,
  cursor,
  onEndpoint,
}: Props) {
  const m = modelOf(i);
  const isRound = m === 'round-table' || m === 'marble-round-table';
  const isLight = i.kind === 'lighting';
  const isPlant = m === 'potted-plant';
  const isHood = m === 'hood';
  const showName = draftSeat ? singleSelected : !quietLabels.has(m) || selected;
  const angle = ((i.rotation % 360) + 360) % 360;
  const flipText = angle > 90 && angle < 270;
  const labelY = !draftSeat && i.model && facingModels.has(i.model) ? i.d / 2 + 12 / scale : 0;
  const wallLabelY = -i.d / 2 - 12 / scale;
  return (
    <g
      data-item-id={i.id}
      opacity={faded ? 0.3 : isLight ? 0.82 : 1}
      transform={`translate(${i.x + i.w / 2},${i.y + i.d / 2}) rotate(${i.rotation})`}
      pointerEvents={passThrough ? 'none' : undefined}
      style={{ cursor }}
    >
      <title>
        {i.name} · {i.w} × {i.d} × {i.h} mm
      </title>
      {isAnnotation(i) ? (
        <AnnotationSymbol item={i} selected={selected} scale={scale} />
      ) : isBuilding(i) ? (
        <BuildingSymbol profile={profile} item={i} selected={selected} scale={scale} />
      ) : isHood ? (
        <g>
          <rect
            x={-i.w / 2}
            y={-i.d / 2}
            width={i.w}
            height={i.d}
            rx={Math.min(40, 2 / scale)}
            fill="#7f95a0"
            fillOpacity={0.14}
            stroke={selected ? '#b67523' : '#556c78'}
            strokeWidth={(selected ? 2.5 : 1.3) / scale}
            strokeDasharray={`${7 / scale} ${4 / scale}`}
          />
          <line
            x1={-i.w / 2}
            y1={-i.d / 2}
            x2={i.w / 2}
            y2={i.d / 2}
            stroke="#556c78"
            strokeOpacity={0.28}
            strokeWidth={0.9 / scale}
            pointerEvents="none"
          />
          <line
            x1={-i.w / 2}
            y1={i.d / 2}
            x2={i.w / 2}
            y2={-i.d / 2}
            stroke="#556c78"
            strokeOpacity={0.28}
            strokeWidth={0.9 / scale}
            pointerEvents="none"
          />
        </g>
      ) : isLight || isPlant ? (
        <ellipse
          rx={i.w / 2}
          ry={i.d / 2}
          fill="transparent"
          stroke={selected ? '#b67523' : 'none'}
          strokeWidth={selected ? 2.5 / scale : 0}
        />
      ) : isRound ? (
        <ellipse
          rx={i.w / 2}
          ry={i.d / 2}
          fill={i.color}
          stroke={selected ? '#b67523' : '#5e7166'}
          strokeWidth={(selected ? 2.5 : 1) / scale}
        />
      ) : (
        <rect
          x={-i.w / 2}
          y={-i.d / 2}
          width={i.w}
          height={i.d}
          rx={Math.min(50, 3 / scale)}
          fill={i.color}
          stroke={selected ? '#b67523' : '#5e7166'}
          strokeWidth={(selected ? 2.5 : 1) / scale}
        />
      )}
      {!isBuilding(i) && !isHood && <EquipmentSymbol item={i} scale={scale} />}
      {i.kind === 'utility' && (
        <g pointerEvents="none">
          <circle r={Math.min(i.w, i.d) * 0.4} fill="none" stroke="#fff" strokeWidth={1.5 / scale} />
          <text textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(i.w, i.d) * 0.6} fill="#fff">
            {pointGlyphs[i.pointType ?? 'power']}
          </text>
          {i.verification !== 'confirmed' && (
            <text x={i.w / 2} y={-i.d / 2} fill="#9f5d12" fontSize={12 / scale}>
              ?
            </text>
          )}
        </g>
      )}
      {i.kind === 'column' && (
        <path
          pointerEvents="none"
          d={`M ${-i.w / 2} ${-i.d / 2} L ${i.w / 2} ${i.d / 2} M ${-i.w / 2} ${i.d / 2} L ${i.w / 2} ${-i.d / 2}`}
          stroke="#66766b"
          strokeWidth={1 / scale}
        />
      )}
      {i.kind === 'stairs' && (
        <g pointerEvents="none" stroke="#5e7166" strokeWidth={1 / scale}>
          {Array.from({ length: Math.max(3, Math.min(40, Math.round(i.h / 160))) - 1 }, (_, k) => (
            <line
              key={k}
              x1={-i.w / 2}
              x2={i.w / 2}
              y1={i.d / 2 - ((k + 1) * i.d) / Math.max(3, Math.min(40, Math.round(i.h / 160)))}
              y2={i.d / 2 - ((k + 1) * i.d) / Math.max(3, Math.min(40, Math.round(i.h / 160)))}
            />
          ))}
        </g>
      )}
      {!isAnnotation(i) &&
        !isBuilding(i) &&
        !isLight &&
        !isPlant &&
        !isHood &&
        i.kind !== 'utility' &&
        showName &&
        (i.w * scale > 60 || selected) && (
          <text
            y={labelY}
            transform={flipText ? `rotate(180 0 ${labelY})` : undefined}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.min(11 / scale, i.w / Math.max(4, i.name.length))}
            fill="#273e31"
            pointerEvents="none"
          >
            {i.locked ? '▣ ' : ''}
            {i.name}
          </text>
        )}
      {onEndpoint && (
        <g data-ui="true">
          <circle
            cx={-i.w / 2}
            cy={0}
            r={6 / scale}
            fill="#fff"
            stroke="#b67523"
            strokeWidth={2 / scale}
            onPointerDown={(e) => onEndpoint(e, i, 'start')}
          />
          <circle
            cx={i.w / 2}
            cy={0}
            r={6 / scale}
            fill="#fff"
            stroke="#b67523"
            strokeWidth={2 / scale}
            onPointerDown={(e) => onEndpoint(e, i, 'end')}
          />
          <text
            x={0}
            y={wallLabelY}
            transform={flipText ? `rotate(180 0 ${wallLabelY})` : undefined}
            textAnchor="middle"
            fontSize={11 / scale}
            fill="#997037"
          >
            {Math.round(i.w)} mm
          </text>
        </g>
      )}
    </g>
  );
});
