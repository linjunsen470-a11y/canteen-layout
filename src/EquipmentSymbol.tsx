import { Item, modelOf } from './model';
import { facingModels, operationFace } from './equipmentFacing';

export default function EquipmentSymbol({ item: i, scale = 1 }: { item: Item; scale?: number }) {
  const model = modelOf(i);
  const { w, d } = i;
  const line = Math.min(2 / scale, Math.min(w, d) * 0.045);

  // Architectural 2D symbols for lighting & decor & specialty tables
  if (i.kind === 'lighting') {
    const stroke = '#b87b29';
    if (model === 'pendant-lamp' || model === 'chandelier') {
      const r = Math.min(w, d) * 0.45;
      return <g data-equipment-symbol={model} pointerEvents="none" fill="none" stroke={stroke} strokeWidth={line * 1.1}>
        <circle r={r} fill="#ffdfa344" strokeDasharray={`${5 / scale} ${3 / scale}`} />
        <circle r={r * 0.48} fill="#ffcf7066" />
        <path d={`M ${-r * 0.7} 0 H ${r * 0.7} M 0 ${-r * 0.7} V ${r * 0.7}`} />
      </g>;
    }
    if (model === 'track-light') {
      return <g data-equipment-symbol={model} pointerEvents="none" fill="none" stroke={stroke} strokeWidth={line * 1.1}>
        <line x1={-w * 0.45} y1={0} x2={w * 0.45} y2={0} strokeDasharray={`${5 / scale} ${3 / scale}`} />
        {[-0.32, 0, 0.32].map(x => <circle key={x} cx={w * x} cy={0} r={Math.min(w, d) * 0.32} fill="#ffcf7077" />)}
      </g>;
    }
    return <g data-equipment-symbol={model} pointerEvents="none" fill="none" stroke={stroke} strokeWidth={line}>
      <rect x={-w * 0.44} y={-d * 0.38} width={w * 0.88} height={d * 0.76} rx={d * 0.2} fill="#ffe4ad55" strokeDasharray={`${5 / scale} ${3 / scale}`} />
    </g>;
  }

  if (i.kind === 'decor') {
    if (model === 'potted-plant') {
      const r = Math.min(w, d) * 0.46;
      return <g data-equipment-symbol={model} pointerEvents="none" fill="#4b7b51" stroke="#2d5234" strokeWidth={line}>
        <circle r={r} fill="#5e916388" />
        {[0, 60, 120, 180, 240, 300].map(deg => {
          const a = (deg * Math.PI) / 180;
          return <circle key={deg} cx={Math.cos(a) * r * 0.45} cy={Math.sin(a) * r * 0.45} r={r * 0.34} fill="#46764c99" />;
        })}
        <circle r={r * 0.22} fill="#7cb077" />
      </g>;
    }
    if (model === 'planter-divider') {
      const count = Math.max(3, Math.round(w / 320));
      return <g data-equipment-symbol={model} pointerEvents="none" fill="#4c7a52aa" stroke="#2d5234" strokeWidth={line}>
        {Array.from({ length: count }, (_, idx) => (
          <circle key={idx} cx={-w * 0.38 + (idx * w * 0.76) / Math.max(1, count - 1)} cy={0} r={Math.min(d * 0.36, w / count * 0.45)} />
        ))}
      </g>;
    }
    if (model === 'menu-board' || model === 'shop-sign' || model === 'tv-screen') {
      return <g data-equipment-symbol={model} pointerEvents="none" fill="none" stroke="#d9a154" strokeWidth={line * 1.4}>
        <line x1={-w * 0.44} y1={d * 0.36} x2={w * 0.44} y2={d * 0.36} />
      </g>;
    }
    return null;
  }

  if (model === 'hotpot-table') {
    return <g data-equipment-symbol={model} pointerEvents="none" fill="none" stroke="#30383a" strokeWidth={line}>
      <rect x={-w * 0.17} y={-d * 0.2} width={w * 0.34} height={d * 0.4} rx={d * 0.05} fill="#252c30" />
      <circle r={Math.min(w, d) * 0.12} stroke="#d4a254" />
    </g>;
  }

  if (!i.model || !facingModels.has(i.model)) return null;
  const front = operationFace(i) === 'positive-y';
  const cabinet = ['upright-fridge', 'steamer', 'sterilizer'].includes(model);
  return <g data-equipment-symbol={model} pointerEvents="none" fill="none" stroke="#344f49" strokeWidth={line}>
    <title>{front ? (model === 'buffet' ? '实线侧为操作侧；双线侧为对客侧' : '粗线为正面 / 操作边') : '未声明操作面'}</title>
    {front && <path data-operation-edge="true" d={`M ${-w * 0.4} ${d * 0.46} H ${w * 0.4}`} stroke="#126b61" strokeWidth={line * 2} />}
    <g data-symbol-detail="true" visibility={Math.min(w, d) * scale < 16 ? 'hidden' : 'visible'}>
      {model === 'stove' && <>{[-0.25, 0.25].map(x => <g key={x}><circle cx={w * x} cy={-d * 0.05} r={Math.min(w * 0.16, d * 0.24)} fill="#e7ece8" /><path d={`M ${w * x - w * 0.13} ${-d * 0.05} h ${w * 0.26} M ${w * x} ${-d * 0.24} v ${d * 0.38}`} /></g>)}</>}
      {['sink', 'single-sink', 'triple-sink'].includes(model) && Array.from({ length: model === 'sink' ? 2 : model === 'triple-sink' ? 3 : 1 }, (_, n) => { const count = model === 'sink' ? 2 : model === 'triple-sink' ? 3 : 1; return <rect key={n} x={-w * 0.43 + n * w * 0.86 / count} y={-d * 0.3} width={w * 0.86 / count - w * 0.04} height={d * 0.58} rx={d * 0.08} fill="#dce9ed" />; })}
      {['sink', 'single-sink', 'triple-sink', 'stove', 'worktable', 'chair', 'dining-armchair', 'curved-booth'].includes(model) && <path data-back-edge="true" d={`M ${-w * 0.45} ${-d * 0.43} H ${w * 0.45}`} strokeWidth={model === 'chair' || model === 'dining-armchair' || model === 'curved-booth' ? d * 0.15 : line * 1.5} />}
      {cabinet && <><path d={`M 0 ${-d * 0.35} V ${d * 0.35} M ${-w * 0.12} ${d * 0.3} h ${w * 0.08} M ${w * 0.04} ${d * 0.3} h ${w * 0.08}`} /><rect x={-w * 0.43} y={-d * 0.38} width={w * 0.86} height={d * 0.73} rx={d * 0.03} /></>}
      {(model === 'buffet' || model === 'tea-bar' || model === 'sushi-display') && <>{[-0.3, 0, 0.3].map(x => <rect key={x} x={w * (x - 0.11)} y={-d * 0.25} width={w * 0.22} height={d * 0.45} fill="#e3e9e2" />)}<path data-customer-edge="true" d={`M ${-w * 0.46} ${-d * 0.42} H ${w * 0.46} M ${-w * 0.46} ${-d * 0.34} H ${w * 0.46}`} stroke="#526a92" /></>}
    </g>
  </g>;
}
