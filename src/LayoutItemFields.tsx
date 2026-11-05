import { Item } from './model';
import { useStore } from './store';
import { NumberField } from './NumberField';
import { isSurface, supportFor } from './spatial';
export default function LayoutItemFields({item:i}:{item:Item}){
 const s=useStore(),physical=!['zone','dimension','text','leader','utility','wall','partition','door','window','column'].includes(i.kind);
 if(!physical)return null;const support=supportFor(s.project,i);
 return <><label>声明座位数<NumberField value={i.seats} min={0} placeholder="未声明" onCommit={seats=>s.update(i.id,{seats})}/></label>{i.seats!==undefined&&<button onClick={()=>s.update(i.id,{seats:undefined})}>清除座位声明</button>}{!isSurface(i)&&<><label>承托桌面<select value={i.supportId??''} onChange={e=>s.update(i.id,{supportId:e.target.value||undefined})}><option value="">自动识别 / 地面</option>{s.project.items.filter(v=>v.id!==i.id&&isSurface(v)).map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label><p>{support?`放置于 ${support.name} 顶面；检查按标高区分叠放，移动仍独立。`:'未识别桌面承托，按地面物件检查。'}</p></>}</>;
}
