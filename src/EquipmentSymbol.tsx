import { Item } from './model';
import { facingModels, operationFace } from './equipmentFacing';

export default function EquipmentSymbol({item:i,scale=1}:{item:Item;scale?:number}) {
  if(!i.model || !facingModels.has(i.model))return null;
  const {w,d,model}=i, line=Math.min(2/scale,Math.min(w,d)*.045), front=operationFace(i)==='positive-y';
  const cabinet=['upright-fridge','steamer','sterilizer'].includes(model);
  return <g data-equipment-symbol={model} pointerEvents="none" fill="none" stroke="#344f49" strokeWidth={line}>
    <title>{front?(model==='buffet'?'实线侧为操作侧；双线侧为对客侧':'粗线为正面 / 操作边'):'未声明操作面'}</title>
    {front&&<path data-operation-edge="true" d={`M ${-w*.4} ${d*.46} H ${w*.4}`} stroke="#126b61" strokeWidth={line*2}/ >}
    <g data-symbol-detail="true" visibility={Math.min(w,d)*scale<16?'hidden':'visible'}>
      {model==='stove'&&<>{[-.25,.25].map(x=><g key={x}><circle cx={w*x} cy={-d*.05} r={Math.min(w*.16,d*.24)} fill="#e7ece8"/><path d={`M ${w*x-w*.13} ${-d*.05} h ${w*.26} M ${w*x} ${-d*.24} v ${d*.38}`}/></g>)}</>}
      {['sink','single-sink','triple-sink'].includes(model)&&Array.from({length:model==='sink'?2:model==='triple-sink'?3:1},(_,n,)=>{const count=model==='sink'?2:model==='triple-sink'?3:1;return <rect key={n} x={-w*.43+n*w*.86/count} y={-d*.3} width={w*.86/count-w*.04} height={d*.58} rx={d*.08} fill="#dce9ed"/>})}
      {['sink','single-sink','triple-sink','stove','worktable','chair'].includes(model)&&<path data-back-edge="true" d={`M ${-w*.45} ${-d*.43} H ${w*.45}`} strokeWidth={model==='chair'?d*.13:line*1.5}/ >}
      {cabinet&&<><path d={`M 0 ${-d*.35} V ${d*.35} M ${-w*.12} ${d*.3} h ${w*.08} M ${w*.04} ${d*.3} h ${w*.08}`}/><rect x={-w*.43} y={-d*.38} width={w*.86} height={d*.73} rx={d*.03}/></>}
      {model==='buffet'&&<>{[-.3,0,.3].map(x=><rect key={x} x={w*(x-.11)} y={-d*.25} width={w*.22} height={d*.45} fill="#e3e9e2"/>)}<path data-customer-edge="true" d={`M ${-w*.46} ${-d*.42} H ${w*.46} M ${-w*.46} ${-d*.34} H ${w*.46}`} stroke="#526a92"/></>}
    </g>
  </g>;
}
