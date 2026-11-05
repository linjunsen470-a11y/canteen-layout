import { Item } from './model';
import { isAnnotation } from './annotations';
import { isBuilding } from './structure';
import { useStore } from './store';
const layer=(i:Item)=>['column','fixture','utility'].includes(i.kind)?'现场':i.kind==='zone'?'区域':isAnnotation(i)?'标注':isBuilding(i)||i.kind==='stairs'?'建筑':'设备';
export default function LayerControls(){
 const {project,setFlags,selectMany,cancelInteraction}=useStore();
 return <details className="layer-controls"><summary>分层操作</summary><p>对该层全部对象操作，可撤销。</p>{['区域','建筑','现场','设备','标注'].map(name=>{const items=project.items.filter(i=>layer(i)===name),ids=items.map(i=>i.id),hidden=items.every(i=>i.hidden),locked=items.every(i=>i.locked);return <div key={name}><button disabled={!ids.length} aria-label={`选择${name}层`} onClick={()=>{cancelInteraction();selectMany(ids)}}>{name} · {ids.length}</button><button disabled={!ids.length} aria-label={`${hidden?'显示':'隐藏'}${name}层`} onClick={()=>setFlags(ids,{hidden:!hidden})}>{hidden?'显示':'隐藏'}</button><button disabled={!ids.length} aria-label={`${locked?'解锁':'锁定'}${name}层`} onClick={()=>setFlags(ids,{locked:!locked})}>{locked?'解锁':'锁定'}</button></div>})}</details>;
}
