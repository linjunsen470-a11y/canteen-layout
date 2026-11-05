import { Item } from './model';
import { useStore } from './store';
import { isEditable } from './editorInteraction';
import { NumberField } from './NumberField';
import { isAttachedOpening } from './structure';

export default function BatchProperties(){
  const s=useStore(),items=s.project.items.filter(i=>s.selectedIds.includes(i.id)),editable=items.filter(i=>isEditable(i,s.project));
  const common=(key:'w'|'d'|'h'|'rotation')=>editable.every(i=>i[key]===editable[0]?.[key])?editable[0]?.[key]:undefined;
  const patch=(p:Partial<Item>)=>s.updateMany(editable.filter(i=>p.rotation===undefined||!isAttachedOpening(i)||!editable.some(w=>w.id===i.wallId)).map(i=>({id:i.id,patch:p})));
  const color=editable[0]?.color??'#a6aeb7';
  return <div className="batch-props"><p className="selection-note">共同属性将应用于 {editable.length} 个可编辑对象。{items.length-editable.length>0&&`已跳过 ${items.length-editable.length} 个隐藏或锁定对象。`} 留空表示多个值；每次修改可整体撤销。</p>
    <fieldset className="batch-actions" disabled={!!s.placement}><button onClick={()=>s.setFlags(s.selectedIds,{locked:true})}>锁定全部</button><button onClick={()=>s.setFlags(s.selectedIds,{locked:false})}>解锁全部</button><button onClick={()=>s.setFlags(s.selectedIds,{hidden:true})}>隐藏全部</button><button onClick={()=>s.setFlags(s.selectedIds,{hidden:false})}>显示全部</button></fieldset>
    <fieldset disabled={!!s.placement||!editable.length}>
      {(['w','d','h','rotation'] as const).filter(k=>k!=='d'||!editable.some(isAttachedOpening)).filter(k=>k!=='h'||!editable.some(i=>i.kind==='zone')).map(key=><label key={key}>{{w:'统一长度（mm）',d:'统一宽度（mm）',h:'统一高度（mm）',rotation:'统一朝向（°）'}[key]}<NumberField value={common(key)} placeholder="多个值" min={key==='rotation'?undefined:key==='h'?0:1} onCommit={n=>patch({[key]:n})}/></label>)}
      <label>统一颜色{editable.some(i=>i.color!==color)&&'（多个值）'}<input type="color" value={color} onChange={e=>patch({color:e.target.value})}/></label>
    </fieldset>
    <p>朝向围绕各自中心调整，可输入任意角度；单独旋转门窗会转为独立放置，选中墙体及其门窗时只旋转墙体并带动门窗。门窗的墙厚、方向由所属墙体决定；关联尺寸校验失败时整批不应用。</p>
  </div>;
}
