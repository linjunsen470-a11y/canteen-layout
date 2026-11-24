import { useLayoutEffect, useRef, useState } from 'react';
import { autoCloseLegs, closureMessage, directions, rectangleLegs, traceLegs } from './interiorSurvey';
import type { SurveyLeg } from './interiorSurvey';
import { polygonArea } from './site';

export type SurveyDraft = { mode: 'rectangle' | 'chain'; width: number; depth: number; legs: SurveyLeg[]; thickness: number };
export const initialSurvey: SurveyDraft = { mode: 'rectangle', width: 10000, depth: 8000, thickness: 200, legs: [] };
export function draftLegs(draft: SurveyDraft) {
  return draft.mode === 'rectangle' ? rectangleLegs(draft.width, draft.depth) : draft.legs;
}

function SurveyPreview({ legs }: { legs: SurveyLeg[] }) {
  const points = traceLegs(legs);
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  const scale = Math.min(280 / (w || 1), 142 / (h || 1));
  const pts = points.map(p => ({ x: 198 + (p.x - x0 - w / 2) * scale, y: 104 + (p.y - y0 - h / 2) * scale }));
  const end = points[points.length - 1], last = pts[pts.length - 1], first = pts[0];
  const closed = !end.x && !end.y && legs.length >= 4 && legs.every(l => l.length > 0);
  const netAreaM2 = closed ? polygonArea(points.slice(0, -1)) / 1e6 : 0;
  return <div className="survey-preview">
    <svg viewBox="0 0 400 212" aria-label="内墙净尺寸预览" role="img">
      <polyline points={pts.map(p => p.x + ',' + p.y).join(' ')} fill={closed ? '#dce9db' : 'none'} stroke="#375c47" strokeWidth="2.5" />
      {!closed && legs.length > 1 && <line x1={last.x} y1={last.y} x2={first.x} y2={first.y} stroke="#ac692c" strokeDasharray="4 4" />}
      {legs.map((leg, i) => {
        if (!leg.length) return null;
        const a = pts[i], b = pts[i+1], vertical = a.x === b.x;
        const x = (a.x+b.x)/2, y = (a.y+b.y)/2;
        return <text key={i} transform={'translate('+x+' '+y+') rotate('+(vertical ? -90 : 0)+')'}
          y="-5" textAnchor="middle">{i+1} · {leg.length} mm</text>;
      })}
      <circle cx={first.x} cy={first.y} r="4" fill="#375c47" />
      <text x={first.x} y={first.y-15} textAnchor="middle">起点</text>
    </svg>
    <small role="status">
      {closed
        ? `首尾已闭合 · 室内净面积 ${netAreaM2.toFixed(2)} ㎡（外包 ${(w / 1000).toFixed(2)} × ${(h / 1000).toFixed(2)} m）`
        : closureMessage(end) || '从一个内墙角开始，按顺序录入'}
    </small>
  </div>;
}

export default function SurveyFields({ value, onChange }: { value: SurveyDraft; onChange: (draft: SurveyDraft) => void }) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const addedRow = useRef(false);
  const [closeNote, setCloseNote] = useState('');
  useLayoutEffect(() => {
    if (addedRow.current) inputs.current[value.legs.length-1]?.focus();
    addedRow.current = false;
  }, [value.legs.length]);
  function patch(update: Partial<SurveyDraft>) { setCloseNote(''); onChange({ ...value, ...update }); }
  function setRow(i: number, update: Partial<SurveyLeg>) {
    patch({ legs: value.legs.map((l, n) => n === i ? { ...l, ...update } : l) });
  }
  function addRow() {
    if (value.legs.length >= 64) return;
    const last = value.legs[value.legs.length-1];
    const next = { right: 'down', down: 'left', left: 'up', up: 'right' } as const;
    addedRow.current = true;
    patch({ legs: [...value.legs, { direction: last ? next[last.direction] : 'right', length: 0 }] });
  }
  const chainEnd = value.mode === 'chain' ? traceLegs(value.legs).at(-1)! : { x: 0, y: 0 };
  const canAutoClose = value.mode === 'chain' && value.legs.filter(l => l.length > 0).length >= 2 && (chainEnd.x !== 0 || chainEnd.y !== 0);
  return <>
    <label>铺位轮廓<select value={value.mode} onChange={e => patch({ mode: e.target.value as SurveyDraft['mode'],
      legs: value.legs.length ? value.legs : [{ direction: 'right', length: 0 }] })}>
      <option value="rectangle">矩形</option><option value="chain">逐段录入（直角凹位 / L 形）</option>
    </select></label>
    <label>墙厚（mm）<input type="number" required min="50" max="1000" value={value.thickness || ''} onChange={e => patch({ thickness: Number(e.target.value) })} /></label>
    {value.mode === 'rectangle' && <>
      <label>室内净宽（mm{value.width > 0 ? ` · ${(value.width / 1000).toFixed(2)}m` : ''}）<input type="number" required min="1" max="60000" value={value.width || ''} onChange={e => patch({width:Number(e.target.value)})} /></label>
      <label>室内净深（mm{value.depth > 0 ? ` · ${(value.depth / 1000).toFixed(2)}m` : ''}）<input type="number" required min="1" max="60000" value={value.depth || ''} onChange={e => patch({depth:Number(e.target.value)})} /></label>
    </>}
    <div className={'full survey-layout ' + (value.mode === 'chain' ? 'has-legs' : '')}>
      {value.mode === 'chain' && <div className="survey-entry">
        <div className="survey-rows">{value.legs.map((leg,i) => <div className="survey-row" key={i}>
          <span>{i+1}</span>
          <select aria-label={'第 '+(i+1)+' 段方向'} value={leg.direction} onChange={e => setRow(i,{direction:e.target.value as SurveyLeg['direction']})}>
            {Object.entries(directions).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input aria-label={'第 '+(i+1)+' 段净长（mm）'} type="number" required min="1" max="60000" placeholder="净长 mm"
            value={leg.length || ''} ref={el => { inputs.current[i] = el; }}
            onChange={e => setRow(i,{length:Number(e.target.value)})} onKeyDown={e => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              if (!e.currentTarget.reportValidity()) return;
              if (i+1 < value.legs.length) { inputs.current[i+1]?.focus(); return; }
              const path = traceLegs(value.legs), end = path[path.length-1];
              if (end.x || end.y) addRow();
            }} />
        </div>)}</div>
        <div className="survey-row-actions">
          <button type="button" disabled={value.legs.length >= 64} onClick={addRow}>加一段</button>
          <button type="button" disabled={!value.legs.length} onClick={() => patch({legs:value.legs.slice(0,-1)})}>退回上一段</button>
          <button type="button" disabled={!canAutoClose} onClick={() => {
            try { patch({ legs: autoCloseLegs(value.legs) }); } catch (e) { setCloseNote((e as Error).message); }
          }}>自动闭合</button>
        </div>
        {closeNote && <small className="property-error" role="alert">{closeNote}</small>}
      </div>}
      <SurveyPreview legs={draftLegs(value)} />
    </div>
  </>;
}
