import { Item } from './model';
import { ordinaryEquipment } from './equipmentFacing';
import { specificationFromItem } from './customCatalog';
import CustomItemDialog from './CustomItemDialog';
export default function EquipmentSpecification({item,onSaved}:{item:Item;onSaved?:()=>void}){
  if(!ordinaryEquipment(item))return null;
  let entry;try{entry=specificationFromItem(item)}catch{/* Old extreme dimensions remain editable, but cannot become new library defaults. */}
  return <div className="equipment-specification"><details><summary>设备规格与来源</summary><p>通用示意 · 当前实例独立于设备库</p>{item.specification&&<p>{item.specification}</p>}{item.notes&&<p className="spec-notes">{item.notes}</p>}<small>{item.catalogId?`来源标识：${item.catalogId}`:'未记录目录来源（历史或独立设备）'}</small>{!entry&&<p>当前规格超出库条目支持范围，请先检查尺寸和备注。</p>}{entry&&<CustomItemDialog initial={entry} copy label="另存为库规格" onSaved={onSaved}/>}</details></div>;
}
