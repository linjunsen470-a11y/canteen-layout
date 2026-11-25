import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { businessTypeDefaults, type ConceptBusinessType } from './conceptPlanner';
import type { BasicLayoutCandidate } from './basicLayout';
import { requestLayoutCandidates } from './requestBasicLayout';
import { checkSketchEdge, placeSketchFixture, sketchFixtures, sketchShell, type SketchFixture } from './sketchGeometry';
import type { Point, Project } from './model';
import { footprint } from './spatial';
import SketchDimensions from './SketchDimensions';
import { polygonArea } from './site';

const grid = 100;
const coords = (pts: Point[]) => pts.map(p => p.x + ',' + p.y).join(' ');
const metres = (mm: number) => String(Math.round(mm) / 1000);

export default function SketchWizard({ busy, onSave, onBusy }: {
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onSave: (choices: BasicLayoutCandidate[]) => Promise<void>;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [fromDimensions, setFromDimensions] = useState(false);
  const [shells, setShells] = useState<Project[]>([]);
  const shell = shells.at(-1);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [camera, setCamera] = useState({ x: -1000, y: -1000, width: 16000 });
  const pan = useRef<{ point: Point; x: number; y: number; scale: number } | null>(null);
  const [panMode, setPanMode] = useState(false);
  const [length, setLength] = useState('');
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<Point | null>(null);
  const [fixture, setFixture] = useState<SketchFixture>('entrance');
  const [width, setWidth] = useState('0.5'), [depth, setDepth] = useState('0.5');
  const [business, setBusiness] = useState<ConceptBusinessType>('bistro');
  const [name, setName] = useState('我的铺位');
  const last = corners.at(-1);
  const shift = shell ? { x: shell.survey!.corners[0].x - corners[0].x, y: shell.survey!.corners[0].y - corners[0].y } : { x: 0, y: 0 };

  function world(clientX: number, clientY: number) {
    const point = new DOMPoint(clientX, clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());
    return { x: Math.round(point.x / grid) * grid, y: Math.round(point.y / grid) * grid };
  }
  function endpoint(point: Point) {
    if (!last) return point;
    const dx = point.x - last.x, dy = point.y - last.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const typed = Math.round(Number(length) * 1000);
    if (horizontal) return { x: length ? last.x + Math.sign(dx) * typed : point.x, y: last.y };
    return { x: last.x, y: length ? last.y + Math.sign(dy) * typed : point.y };
  }
  function undo() {
    setError(''); setInvalid(null); setLength('');
    if (fromDimensions && shells.length === 1) {
      setShells([]); setCorners([]); setFromDimensions(false);
    } else if (shell) setShells(shells.slice(0, -1));
    else setCorners(corners.slice(0, -1));
  }
  function applyDimensions(points: Point[], direct: boolean) {
    const next = sketchShell(points);
    const w = Math.max(...points.map(p => p.x)), d = Math.max(...points.map(p => p.y));
    const width = Math.max(2000, w * 1.2, d * 1.2 / .56);
    setCamera({ width, x: (w - width) / 2, y: (d - width * .56) / 2 });
    setCorners(points); setShells([next]); setFromDimensions(true);
    setError(''); setInvalid(null); setLength(''); setPanMode(false);
    if (direct) void generate(next);
  }
  function zoom(factor: number, anchor?: Point) {
    setCamera(c => {
      const w = Math.min(140000, Math.max(2000, c.width * factor));
      const x = anchor?.x ?? c.x + c.width / 2;
      const y = anchor?.y ?? c.y + c.width * .28;
      return { width: w, x: x + (c.x - x) * w / c.width, y: y + (c.y - y) * w / c.width };
    });
  }
  useEffect(() => {
    const element = svg.current;
    if (!element || busy) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!pan.current && e.deltaY) zoom(e.deltaY > 0 ? 1.15 : 1/1.15, world(e.clientX, e.clientY));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [busy]);
  function stamp(point: Point, type: SketchFixture) {
    if (!shell) return;
    const next = placeSketchFixture(shell, type, { x: point.x + shift.x, y: point.y + shift.y },
      Math.round(Number(width) * 1000), Math.round(Number(depth) * 1000));
    setShells([...shells, next]);
  }
  function place(point: Point, close = false) {
    setError(''); setInvalid(null);
    try {
      if (shell) { stamp(point, fixture); return; }
      const first = corners[0];
      const closing = close || (corners.length >= 4 && Math.hypot(first.x - point.x, first.y - point.y) < camera.width / 80);
      if (length && !(Number(length) > 0 && Number(length) <= 60)) throw Error('边长须大于 0 米且不超过 60 米');
      const end = closing ? first : endpoint(point);
      checkSketchEdge(corners, end, closing);
      if (closing && length && last && Math.abs(Math.hypot(first.x-last.x, first.y-last.y) - Number(length)*1000) > .5)
        throw Error('输入的末段长度与起点位置不符，请修改边长或退回上一点');
      if (closing) setShells([sketchShell(corners)]);
      else setCorners([...corners, end]);
      setLength('');
    } catch (e) { setError((e as Error).message); setInvalid(close ? corners[0] : endpoint(point)); }
  }
  function pointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (busy) return;
    if (panMode || e.button === 1 || e.shiftKey) {
      e.preventDefault();
      pan.current = { point: { x: e.clientX, y: e.clientY }, ...camera, scale: 1 / svg.current!.getScreenCTM()!.a };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.button === 0) place(world(e.clientX, e.clientY));
  }
  function pointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const p = pan.current;
    if (p) setCamera({ ...camera, x: p.x - (e.clientX - p.point.x) * p.scale, y: p.y - (e.clientY - p.point.y) * p.scale });
    else setCursor(world(e.clientX, e.clientY));
  }
  async function generate(source = shell) {
    if (!source || busy) return;
    onBusy(true);
    try {
      const choices = await requestLayoutCandidates({ ...source, name: name.trim() || '我的铺位' }, business);
      await onSave(choices);
    } catch (e) { setError((e as Error).message); }
    finally { onBusy(false); }
  }
  // A stamp may add a door and its entrance marker as one editable fixture.
  const stamps = useMemo(() => {
    const live = new Set(shell?.items.map(i => i.id));
    return shells.slice(1).flatMap((state, index) => {
      const previous = new Set(shells[index].items.map(i => i.id));
      const added = state.items.filter(i => !previous.has(i.id) && live.has(i.id));
      return added.length ? [added] : [];
    });
  }, [shells, shell]);
  const size = camera.width / 900;
  const preview = invalid ?? (cursor && endpoint(cursor));
  return <fieldset className="sketch-wizard" disabled={busy}>
    <div className="sketch-options">
      <label>铺位名称<input value={name} onChange={e => setName(e.target.value)} /></label>
      <label>餐饮业态<select value={business} onChange={e => setBusiness(e.target.value as ConceptBusinessType)}>
        {Object.entries(businessTypeDefaults).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
      </select></label>
    </div>
    <div hidden={corners.length > 0 && (!fromDimensions || stamps.length > 0)}>
      <SketchDimensions onApply={applyDimensions} editing={fromDimensions} />
    </div>
    <div className="sketch-controls">
      <strong>{shell ? '已闭合 · 估算 ' + (polygonArea(corners) / 1e6).toFixed(1) + ' ㎡' : '沿内墙依次点出墙角，点回起点闭合'}</strong>
      <button onClick={() => zoom(.75)} aria-label="放大建铺格网">＋</button><button onClick={() => zoom(1.33)} aria-label="缩小建铺格网">－</button>
      <button aria-pressed={panMode} onClick={() => setPanMode(!panMode)}>平移</button>
      <button disabled={!corners.length} onClick={undo}>退回一步</button>
    </div>
    <svg ref={svg} className="sketch-grid" viewBox={[camera.x,camera.y,camera.width,camera.width * .56].join(' ')}
      role="img" aria-label="直角铺位绘图格网" style={{ cursor: panMode ? 'grab' : 'crosshair' }}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerLeave={() => setCursor(null)}
      onPointerUp={() => { pan.current = null; }} onLostPointerCapture={() => { pan.current = null; }}
      onDragOver={e => { if (shell) e.preventDefault(); }} onDrop={e => {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/canteen-sketch');
        if (busy || !Object.hasOwn(sketchFixtures, type)) return;
        try { stamp(world(e.clientX,e.clientY), type as SketchFixture); setError(''); } catch (err) { setError((err as Error).message); }
      }}>
      <defs><pattern id="sketch-metre" width="1000" height="1000" patternUnits="userSpaceOnUse">
        <path d="M 0 1000 V 0 H 1000" fill="none" stroke="#bdcdc1" strokeWidth={size * 1.3}/>
      </pattern></defs>
      <rect x={camera.x} y={camera.y} width={camera.width} height={camera.width * .56} fill="url(#sketch-metre)" />
      {shell ? <polygon points={coords(corners)} fill="#ccdcca" stroke="#335e4b" strokeWidth={size * 3}/> :
        <polyline points={coords(corners)} fill="none" stroke="#335e4b" strokeWidth={size * 3}/>}
      {corners.map((p,i) => {
        const next = corners[i + 1] ?? (shell ? corners[0] : undefined);
        return <g key={i}><circle cx={p.x} cy={p.y} r={size * (i ? 3 : 6)} fill="#335e4b"/>
          {next && <text x={(p.x + next.x)/2} y={(p.y + next.y)/2 - size * 6} textAnchor="middle" fontSize={size*14}>{metres(Math.hypot(p.x-next.x,p.y-next.y))} m</text>}</g>;
      })}
      {!shell && last && preview && <line x1={last.x} y1={last.y} x2={preview.x} y2={preview.y} stroke={invalid ? '#ad402e' : '#61836a'} strokeDasharray={size*7} strokeWidth={size*3}/>}
      <g transform={`translate(${-shift.x} ${-shift.y})`}>{shell?.items.filter(i => i.kind !== 'wall').map(i =>
        <polygon key={i.id} points={coords(footprint(i))} fill={i.kind === 'utility' || i.kind === 'door' ? '#659e71' : '#737f7a'}><title>{i.name}</title></polygon>)}</g>
    </svg>
    {!shell ? <div className="sketch-controls">
      <span>每格 1 米</span><label>下一段边长（米）<input type="number" min=".001" step=".001" placeholder="随点位" value={length} onChange={e => setLength(e.target.value)}/></label>
      <button disabled={corners.length < 4} onClick={() => place(corners[0], true)}>闭合轮廓</button>
    </div> : <>
      <div className="sketch-controls"><span>知道入口可点外墙，也可拖入固定构件</span>{Object.entries(sketchFixtures).map(([key,label]) =>
        <button draggable key={key} aria-pressed={fixture === key} onClick={() => setFixture(key as SketchFixture)}
          onDragStart={e => e.dataTransfer.setData('application/canteen-sketch',key)}>{label}</button>)}</div>
      {stamps.length > 0 && <div className="size-presets" aria-label="已标固定构件">{stamps.map((items, index) =>
        <button key={items[0].id} title={'移除' + items[0].name} onClick={() => {
          const ids = new Set(items.map(i => i.id));
          setShells([...shells, { ...shell, items: shell.items.filter(i => !ids.has(i.id)) }]);
          setError('');
        }}>{items[0].name} {index + 1} ×</button>)}</div>}
      {fixture !== 'entrance' && <div className="sketch-controls">
        <label>构件宽（米）<input type="number" min=".1" step=".1" value={width} onChange={e => setWidth(e.target.value)}/></label>
        <label>构件深（米）<input type="number" min=".1" step=".1" value={depth} onChange={e => setDepth(e.target.value)}/></label>
      </div>}
      <button className="primary" onClick={() => void generate()}>{busy ? '正在试排…' : '生成基础布局'}</button>
    </>}
    {error && <p role="alert" className="property-error">{error}</p>}
  </fieldset>;
}
