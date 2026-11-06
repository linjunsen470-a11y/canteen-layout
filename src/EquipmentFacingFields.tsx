import { Item } from './model';
import { facingDirection, operationFace, facingModels } from './equipmentFacing';
import { normalizeRotation } from './rotation';
import { useStore } from './store';
import EquipmentSymbol from './EquipmentSymbol';

export default function EquipmentFacingFields({item,disabled=false}:{item:Item;disabled?:boolean}){
  const update=useStore(s=>s.update);if(!item.model||!facingModels.has(item.model))return null;
  const size=Math.hypot(item.w,item.d)*1.15,rotation=normalizeRotation(item.rotation);
  return <div className="equipment-facing-fields">
    <div className="facing-preview"><svg viewBox={`${-size/2} ${-size/2} ${size} ${size}`} role="img" aria-label={`设备当前朝向：${facingDirection(item)}，${rotation}°`}>
      <g data-facing-preview transform={`rotate(${rotation})`}><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} fill={item.color}/><EquipmentSymbol item={item} scale={80/size}/></g>
    </svg><span><b>{facingDirection(item)}</b><small>当前 {rotation}° · 与画布一致</small>{item.model==='buffet'&&<small>蓝色双线：对客侧</small>}</span></div>
    <fieldset disabled={disabled} className="facing-actions"><button type="button" onClick={()=>update(item.id,{rotation:item.rotation+90})}>右转 90°</button><button type="button" onClick={()=>update(item.id,{rotation:item.rotation+180})}>反向 180°</button></fieldset>
    <label>操作面显示<select disabled={disabled} aria-label="操作面显示" value={operationFace(item)} onChange={e=>update(item.id,{operationFace:e.target.value as Item['operationFace']})}><option value="positive-y">已确认：模型正面</option><option value="none">无明确操作面 · 不显示</option></select></label>
  </div>;
}
