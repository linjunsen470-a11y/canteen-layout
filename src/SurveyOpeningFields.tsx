import { useState } from 'react';
import type { Item } from './model';
import { catalog } from './model';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { cornerDistance, openingOffset, surveyWall } from './interiorSurvey';
import { NumberField } from './NumberField';

export default function SurveyOpeningFields({ wall, item, datum }: {
  wall: Item; item?: Item; datum: NonNullable<ReturnType<typeof surveyWall>>;
}) {
  const s = useStore();
  const { surveyFromEnd: fromEnd, set } = useWorkspace();
  const [kind, setKind] = useState<'door' | 'window'>('door');
  const [width, setWidth] = useState(900), [distance, setDistance] = useState(0);
  const w = item?.w ?? width, gap = item ? cornerDistance(datum, item.offset!, w, fromEnd) : distance;
  const net = datum.end - datum.start;
  function apply(nextWidth: number, nextDistance: number) {
    try {
      const offset = openingOffset(datum, nextDistance, nextWidth, fromEnd);
      if (item) { s.update(item.id, { w: nextWidth, offset }); return; }
      const spec = catalog.find(c => c.model === kind)!;
      s.addItem({ kind, model: kind, name: spec.name, w: nextWidth, h: spec.h, d: wall.d, color: spec.color,
        x: 0, y: 0, rotation: wall.rotation, wallId: wall.id, offset, sill: kind === 'door' ? 0 : 900 });
    } catch (e) { useStore.setState({ error: (e as Error).message }); }
  }
  const fields = <>
    {!item && <label>洞口类型<select value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
      <option value="door">单开门</option><option value="window">推拉窗</option></select></label>}
    <label>从内墙哪头量<select value={fromEnd ? 'end' : 'start'} onChange={e => set({ surveyFromEnd: e.target.value === 'end' })}>
      <option value="start">起角（按录入方向）</option><option value="end">末角（反向）</option></select></label>
    <label>内墙角到洞口近边（mm）{item
      ? <NumberField value={gap} min={0} max={net-w} onCommit={n => apply(w,n)} />
      : <input type="number" min="0" value={Number.isFinite(gap) ? gap : ''} onChange={e=>setDistance(e.target.valueAsNumber)} />}</label>
    <label>开口宽度（mm）{item
      ? <NumberField value={w} min={100} max={net} onCommit={n => apply(n,gap)} />
      : <input type="number" min="100" value={Number.isFinite(w) ? w : ''} onChange={e=>setWidth(e.target.valueAsNumber)} />}</label>
    {!item && <button type="button" onClick={() => apply(w,gap)}>放置洞口</button>}
  </>;
  return item ? <div className="survey-opening full-field">{fields}</div> : <details className="survey-opening full-field">
    <summary>按内墙角量距添加门窗</summary>{fields}</details>;
}
