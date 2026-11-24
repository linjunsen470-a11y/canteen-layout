import { useRef, useState, type FormEvent } from 'react';
import type { Point } from './model';
import { dimensionedOutline, type NotchCorner } from './site';

const presets = [
  { label: '小店 5 × 8 m', width: '5', depth: '8' },
  { label: '常规 7 × 10 m', width: '7', depth: '10' },
  { label: '深窄 4 × 12 m', width: '4', depth: '12' },
  { label: 'L 形 8 × 12 m', width: '8', depth: '12' },
];
export default function SketchDimensions({ onApply, editing }: {
  onApply: (corners: Point[], generate: boolean) => void;
  editing: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [shape, setShape] = useState('rectangle');
  const [width, setWidth] = useState(''), [depth, setDepth] = useState('');
  const [error, setError] = useState('');
  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const mm = (key: string) => Math.round(Number(data.get(key)) * 1000);
    try {
      const notch = shape === 'l-shape'
        ? { width: mm('notchWidth'), depth: mm('notchDepth'), corner: data.get('corner') as NotchCorner }
        : undefined;
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      onApply(dimensionedOutline(mm('width'), mm('depth'), notch), submitter?.value === 'generate');
      details.current!.open = false;
      setError('');
    } catch (err) { setError((err as Error).message); }
  }
  const input = { type:'number', min:'.001', max:'60', step:'.001', required:true };
  return <details ref={details} open={!editing} className="sketch-dimensions">
    <summary>{editing ? '修改轮廓尺寸' : '按尺寸画矩形或 L 形'}</summary>
    <div className="size-presets">{presets.map((p,i) => <button key={p.label} type="button" onClick={() => {
      setWidth(p.width); setDepth(p.depth); setShape(i === 3 ? 'l-shape' : 'rectangle'); setError('');
    }}>{p.label}</button>)}</div>
    <form onSubmit={apply} onChange={() => setError('')}>
      <label>铺位形状<select value={shape} onChange={e => setShape(e.target.value)}>
        <option value="rectangle">矩形</option><option value="l-shape">L 形</option>
      </select></label>
      <label>铺位净宽（米）<input {...input} name="width" value={width} onChange={e => setWidth(e.target.value)}/></label>
      <label>铺位净深（米）<input {...input} name="depth" value={depth} onChange={e => setDepth(e.target.value)}/></label>
      {shape === 'l-shape' && <>
        <label>缺口位置<select name="corner" defaultValue="bottom-right">
          <option value="top-left">左上</option><option value="top-right">右上</option>
          <option value="bottom-left">左下</option><option value="bottom-right">右下</option>
        </select></label>
        <label>缺口宽度（米）<input {...input} name="notchWidth" defaultValue="3"/></label>
        <label>缺口深度（米）<input {...input} name="notchDepth" defaultValue="4"/></label>
      </>}
      <button type="submit" className="primary" value="generate">直接生成草稿</button>
      <button type="submit">先标入口和柱子</button>
      {error && <p role="alert" className="property-error">{error}</p>}
    </form>
  </details>;
}
