import { useState } from 'react';
import { Item, resolveStyle } from './model';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { surveyWall, surveyWallInwardPoint } from './interiorSurvey';
import { contains, footprint } from './spatial';
import { siteOutline } from './site';

type SitePresetKey = 'column' | 'entrance' | 'exhaust' | 'water' | 'drain' | 'power';

const SITE_PRESETS: Record<SitePresetKey, {
  label: string;
  kind: 'column' | 'utility';
  model: Item['model'];
  pointType?: Item['pointType'];
  w: number;
  d: number;
  color: string;
}> = {
  column: { label: '结构承重柱', kind: 'column', model: 'column', w: 500, d: 500, color: '#8a8d89' },
  entrance: { label: '顾客主入口点位', kind: 'utility', model: 'utility', pointType: 'entrance', w: 420, d: 420, color: '#2b7a52' },
  exhaust: { label: '排烟井 / 排烟口', kind: 'utility', model: 'utility', pointType: 'exhaust', w: 420, d: 420, color: '#5c717d' },
  water: { label: '上水给水点', kind: 'utility', model: 'utility', pointType: 'water', w: 360, d: 360, color: '#3b82b6' },
  drain: { label: '下水 / 隔油池点', kind: 'utility', model: 'utility', pointType: 'drain', w: 360, d: 360, color: '#5f6f82' },
  power: { label: '强电配电箱', kind: 'utility', model: 'utility', pointType: 'power', w: 360, d: 360, color: '#c4842d' },
};

export default function SurveySiteObjectFields({ datum }: {
  datum: NonNullable<ReturnType<typeof surveyWall>>;
}) {
  const s = useStore();
  const { surveyFromEnd: fromEnd, set } = useWorkspace();
  const [presetKey, setPresetKey] = useState<SitePresetKey>('column');
  const [along, setAlong] = useState(1000);
  const [inset, setInset] = useState(0);
  const [sizeW, setSizeW] = useState(500);
  const [sizeD, setSizeD] = useState(500);

  const preset = SITE_PRESETS[presetKey];
  const isColumn = preset.kind === 'column';
  const w = isColumn ? sizeW : preset.w;
  const d = isColumn ? sizeD : preset.d;

  function place() {
    try {
      const pos = surveyWallInwardPoint(datum, along, inset, w, d, fromEnd);
      const style = resolveStyle(s.project);
      const candidate: Item = {
        id: crypto.randomUUID(),
        kind: preset.kind,
        model: preset.model,
        name: preset.label,
        x: pos.x,
        y: pos.y,
        w,
        d,
        h: isColumn ? style.ceilingHeight : 260,
        rotation: 0,
        color: preset.color,
        verification: 'confirmed',
        ...(preset.pointType ? { pointType: preset.pointType } : {}),
      };
      if (!contains(siteOutline(s.project), footprint(candidate))) {
        throw Error('该位置超出铺位室内轮廓，请调小离墙净距或沿墙距离');
      }
      const id = s.addItem(candidate);
      if (id) s.selectMany([id]);
    } catch (e) {
      useStore.setState({ error: (e as Error).message });
    }
  }

  return (
    <details className="survey-opening full-field">
      <summary>按内墙角量距添加柱子 / 水电入口</summary>
      <label>构件类型
        <select value={presetKey} onChange={e => setPresetKey(e.target.value as SitePresetKey)}>
          {(Object.keys(SITE_PRESETS) as SitePresetKey[]).map(k => (
            <option key={k} value={k}>{SITE_PRESETS[k].label}</option>
          ))}
        </select>
      </label>
      <label>从内墙哪头量
        <select value={fromEnd ? 'end' : 'start'} onChange={e => set({ surveyFromEnd: e.target.value === 'end' })}>
          <option value="start">起角（按录入方向）</option>
          <option value="end">末角（反向）</option>
        </select>
      </label>
      <label>距内墙角沿墙（mm）
        <input type="number" min="0" value={Number.isFinite(along) ? along : ''} onChange={e => setAlong(e.target.valueAsNumber)} />
      </label>
      <label>离该墙内面净距（mm，0 为贴墙）
        <input type="number" min="0" value={Number.isFinite(inset) ? inset : ''} onChange={e => setInset(e.target.valueAsNumber)} />
      </label>
      {isColumn && <>
        <label>柱宽 X（mm）
          <input type="number" min="100" max="3000" value={Number.isFinite(sizeW) ? sizeW : ''} onChange={e => setSizeW(e.target.valueAsNumber)} />
        </label>
        <label>柱深 Y（mm）
          <input type="number" min="100" max="3000" value={Number.isFinite(sizeD) ? sizeD : ''} onChange={e => setSizeD(e.target.valueAsNumber)} />
        </label>
      </>}
      <button type="button" onClick={place}>按量距放置构件</button>
    </details>
  );
}
