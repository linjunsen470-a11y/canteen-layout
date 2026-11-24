import { useRef, useState, type FormEvent } from 'react';
import type { Point } from './model';
import { dimensionedOutline, type NotchCorner } from './site';

export default function SketchDimensions({ onApply, editing }: { onApply: (corners: Point[]) => void; editing: boolean }) {
  const details = useRef<HTMLDetailsElement>(null);
  const [shape, setShape] = useState('rectangle');
  const [error, setError] = useState('');
  function apply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const mm = (key: string) => Math.round(Number(data.get(key)) * 1000);
    try {
      const notch = shape === 'l-shape'
        ? { width: mm('notchWidth'), depth: mm('notchDepth'), corner: data.get('corner') as NotchCorner }
        : undefined;
      onApply(dimensionedOutline(mm('width'), mm('depth'), notch));
      details.current!.open = false;
      setError('');
    } catch (err) { setError((err as Error).message); }
  }
  const dimension = (name: string, label: string) => <label>{label}（米）
    <input name={name} type="number" inputMode="decimal" min=".001" max="60" step=".001" required />
  </label>;
  return <details ref={details} className="sketch-dimensions">
    <summary>{editing ? '修改轮廓尺寸' : '按尺寸画矩形或 L 形'}</summary>
    <form onSubmit={apply} onChange={() => setError('')}>
      <label>铺位形状<select value={shape} onChange={e => setShape(e.target.value)}>
        <option value="rectangle">矩形</option><option value="l-shape">L 形</option>
      </select></label>
      {dimension('width','铺位净宽')}{dimension('depth','铺位净深')}
      {shape === 'l-shape' && <>
        <label>缺口位置<select name="corner" defaultValue="bottom-right">
          <option value="top-left">左上</option><option value="top-right">右上</option>
          <option value="bottom-left">左下</option><option value="bottom-right">右下</option>
        </select></label>
        {dimension('notchWidth','缺口宽度')}{dimension('notchDepth','缺口深度')}
      </>}
      <button type="submit">应用尺寸</button>
      {error && <p role="alert" className="property-error">{error}</p>}
    </form>
  </details>;
}
