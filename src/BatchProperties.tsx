import MergeWallsPanel from './MergeWallsPanel';
import DoorControls from './DoorControls';
import { Item } from './model';
import { useStore } from './store';
import { isEditable } from './editorInteraction';
import { NumberField } from './NumberField';
import { isAttachedOpening } from './structure';

export default function BatchProperties(){
  const s=useStore(),items=s.project.items.filter(i=>s.selectedIds.includes(i.id)),editable=items.filter(i=>isEditable(i,s.project));
  const common=(key:'w'|'d'|'h'|'rotation')=>editable.every(i=>i[key]===editable[0]?.[key])?editable[0]?.[key]:undefined;
  const patch=(p:Partial<Item>)=>s.updateMany(editable.filter(i=>p.rotation===undefined||!isAttachedOpening(i)).map(i=>({id:i.id,patch:p})));
  const color=editable[0]?.color??'#a6aeb7';
  return <div className="batch-props"><MergeWallsPanel/><p className="selection-note">共同属性将应用于 {editable.length} 个可编辑对象。{items.length-editable.length>0&&`已跳过 ${items.length-editable.length} 个隐藏或锁定对象。`} 留空表示多个值；每次修改可整体撤销。</p>
    <fieldset className="batch-actions" disabled={!!s.placement}><button onClick={()=>s.setFlags(s.selectedIds,{locked:true})}>锁定全部</button><button onClick={()=>s.setFlags(s.selectedIds,{locked:false})}>解锁全部</button><button onClick={()=>s.setFlags(s.selectedIds,{hidden:true})}>隐藏全部</button><button onClick={()=>s.setFlags(s.selectedIds,{hidden:false})}>显示全部</button></fieldset>
    <fieldset disabled={!!s.placement||!editable.length}>
      <DoorControls items={editable.filter(i=>i.kind==='door')}/>
      {(['w','d','h','rotation'] as const).filter(k=>k!=='d'||!editable.some(isAttachedOpening)).filter(k=>k!=='h'||!editable.some(i=>i.kind==='zone')).map(key=><label key={key}>{{w:'统一长度（mm）',d:'统一宽度（mm）',h:'统一高度（mm）',rotation:'统一朝向（°）'}[key]}<NumberField disabled={key==='rotation'&&editable.every(isAttachedOpening)} value={common(key)} placeholder="多个值" min={key==='rotation'?undefined:key==='h'?0:1} onCommit={n=>patch({[key]:n})}/></label>)}
      <label>统一颜色{editable.some(i=>i.color!==color)&&'（多个值）'}<input type="color" value={color} onChange={e=>patch({color:e.target.value})}/></label>
    </fieldset>
    <p>统一朝向跳过贴墙门窗；选中所属墙体时，门窗随墙旋转。门窗的墙厚、方向由所属墙体决定；关联尺寸校验失败时整批不应用。</p>
  </div>;
}
