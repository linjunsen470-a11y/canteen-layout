import { memo, useMemo } from 'react';
import type { ComboPreset } from './combos';
import { bounds, footprint } from './spatial';
import EquipmentSymbol from './EquipmentSymbol';

export default memo(function ComboCard({ combo, onAdd }: {
  combo: ComboPreset; onAdd?: (combo: ComboPreset) => void;
}) {
  const { items, box, contents } = useMemo(() => {
    const items = combo.build(0, 0);
    const counts = new Map<string, number>();
    for (const i of items) counts.set(i.name, (counts.get(i.name) ?? 0) + 1);
    return { items, box: bounds(items), contents: [...counts].map(([name, n]) => n > 1 ? name + ' × ' + n : name).join('、') };
  }, [combo]);
  const pad = Math.max(box.w, box.h) * 0.07;
  return <button type="button" className="combo-card" draggable
    title={contents + '。点击自动找空位，或拖到平面指定位置。'}
    onDragStart={e => {
      e.dataTransfer.setData('application/canteen-combo', combo.id);
      e.dataTransfer.effectAllowed = 'copy';
    }}
    onClick={() => onAdd?.(combo)}>
    <svg className="combo-plan" aria-hidden="true" viewBox={`${box.x-pad} ${box.y-pad} ${box.w+2*pad} ${box.h+2*pad}`}>
      {items.map(i => <g key={i.id}>
        <polygon points={footprint(i).map(p => p.x + ',' + p.y).join(' ')}
          fill={i.model === 'hood' ? 'none' : i.color} stroke="#47584f" strokeWidth="1"
          strokeDasharray={i.model === 'hood' ? '3 2' : undefined} vectorEffect="non-scaling-stroke" />
        {i.model !== 'hood' && <g transform={`translate(${i.x+i.w/2} ${i.y+i.d/2}) rotate(${i.rotation})`}>
          <EquipmentSymbol item={i} scale={72 / Math.max(box.w, box.h)} />
        </g>}
      </g>)}
    </svg>
    <span className="combo-description">
      <b>{combo.name}</b><small>{contents}</small>
      <span>{Math.round(box.w)} × {Math.round(box.h)} mm{combo.seats ? ' · ' + combo.seats + ' 座' : ''}</span>
    </span>
  </button>;
});
