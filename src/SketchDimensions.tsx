import { useEffect, useState, type FormEvent } from 'react';
import type { Point } from './model';
import { dimensionedOutline, type NotchCorner } from './site';

type SizePreset = {
  label: string;
  shape: 'rectangle' | 'l-shape';
  width: string;
  depth: string;
  notchWidth?: string;
  notchDepth?: string;
  corner?: NotchCorner;
};

const presets: SizePreset[] = [
  { label: '小店 5 × 8 m', shape: 'rectangle', width: '5', depth: '8' },
  { label: '常规 7 × 10 m', shape: 'rectangle', width: '7', depth: '10' },
  { label: '深窄 4 × 12 m', shape: 'rectangle', width: '4', depth: '12' },
  { label: 'L 形 8 × 12 m', shape: 'l-shape', width: '8', depth: '12', notchWidth: '3', notchDepth: '4', corner: 'bottom-right' },
];
export default function SketchDimensions({ onApply, editing }: {
  onApply: (corners: Point[], generate: boolean) => void;
  editing: boolean;
}) {
  const [expanded, setExpanded] = useState(!editing);
  const [shape, setShape] = useState<'rectangle' | 'l-shape'>('rectangle');
  const [width, setWidth] = useState(''), [depth, setDepth] = useState('');
  const [corner, setCorner] = useState<NotchCorner>('bottom-right');
  const [notchWidth, setNotchWidth] = useState('3'), [notchDepth, setNotchDepth] = useState('4');
  const [error, setError] = useState('');
  useEffect(() => { setExpanded(!editing); }, [editing]);
  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const mm = (value: string) => Math.round(Number(value) * 1000);
    try {
      const notch = shape === 'l-shape'
        ? { width: mm(notchWidth), depth: mm(notchDepth), corner }
        : undefined;
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      onApply(dimensionedOutline(mm(width), mm(depth), notch), submitter?.value === 'generate');
      setExpanded(false);
      setError('');
    } catch (err) { setError((err as Error).message); }
  }
  const input = { type: 'number', inputMode: 'decimal' as const, min: '.001', max: '60', step: '.001', required: true };
  return <details open={expanded} onToggle={e => setExpanded(e.currentTarget.open)} className="sketch-dimensions">
    <summary>{editing ? '修改轮廓尺寸' : '按尺寸画矩形或 L 形'}</summary>
    <div className="size-presets">{presets.map(p => <button key={p.label} type="button" onClick={() => {
      setWidth(p.width);
      setDepth(p.depth);
      setShape(p.shape);
      if (p.shape === 'l-shape') {
        setCorner(p.corner ?? 'bottom-right');
        setNotchWidth(p.notchWidth ?? '3');
        setNotchDepth(p.notchDepth ?? '4');
      }
      setError('');
    }}>{p.label}</button>)}</div>
    <form onSubmit={apply} onChange={() => setError('')}>
      <label>铺位形状<select value={shape} onChange={e => setShape(e.target.value as 'rectangle' | 'l-shape')}>
        <option value="rectangle">矩形</option><option value="l-shape">L 形</option>
      </select></label>
      <label>铺位净宽（米）<input {...input} name="width" value={width} onChange={e => setWidth(e.target.value)}/></label>
      <label>铺位净深（米）<input {...input} name="depth" value={depth} onChange={e => setDepth(e.target.value)}/></label>
      {shape === 'l-shape' && <>
        <label>缺口位置<select name="corner" value={corner} onChange={e => setCorner(e.target.value as NotchCorner)}>
          <option value="top-left">左上</option><option value="top-right">右上</option>
          <option value="bottom-left">左下</option><option value="bottom-right">右下</option>
        </select></label>
        <label>缺口宽度（米）<input {...input} name="notchWidth" value={notchWidth} onChange={e => setNotchWidth(e.target.value)}/></label>
        <label>缺口深度（米）<input {...input} name="notchDepth" value={notchDepth} onChange={e => setNotchDepth(e.target.value)}/></label>
      </>}
      <button type="submit" className="primary" value="generate">直接生成草稿</button>
      <button type="submit">先标入口和柱子</button>
      {error && <p role="alert" className="property-error">{error}</p>}
    </form>
  </details>;
}
