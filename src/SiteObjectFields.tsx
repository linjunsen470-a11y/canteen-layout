import { Item } from './model';
import { useStore } from './store';
import { pointTypes } from './siteObjects';
export default function SiteObjectFields({item}:{item:Item}){
 const update=useStore(s=>s.update);
 return <div className="site-object-fields">{item.kind==='utility'&&<label>点位类型<select value={item.pointType??'power'} onChange={e=>{const pointType=e.target.value as NonNullable<Item['pointType']>;update(item.id,{pointType,...(item.name==='工程点位'||Object.values(pointTypes).some(name=>item.name===name+'点位')?{name:pointTypes[pointType]+'点位'}:{})})}}>{Object.entries(pointTypes).map(([v,name])=><option key={v} value={v}>{name}</option>)}</select></label>}<label>现场确认<select value={item.verification??'pending'} onChange={e=>update(item.id,{verification:e.target.value as Item['verification']})}><option value="pending">待核实</option><option value="confirmed">已确认</option></select></label><label>现场备注<textarea value={item.notes??''} placeholder="例如：电力容量待现场核实" onChange={e=>update(item.id,{notes:e.target.value})}/></label><p>仅记录已知位置与现场条件，不进行工程系统或合规判断。可用对象锁定保护固定设施。</p></div>;
}
