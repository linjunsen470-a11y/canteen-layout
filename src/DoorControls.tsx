import { Item } from './model';
import { useStore } from './store';
import BuildingSymbol from './BuildingSymbol';

const direction=(rotation:number,flipped:boolean)=>['画布右侧','画布右下侧','画布下侧','画布左下侧','画布左侧','画布左上侧','画布上侧','画布右上侧'][((Math.round((rotation+(flipped?-90:90))/45)%8)+8)%8];
export default function DoorControls({items}:{items:Item[]}){
 const updateMany=useStore(s=>s.updateMany);
 if(!items.length)return null;
 const first=items[0],single=items.length===1;
 const patch=(flipped:boolean)=>updateMany(items.map(i=>({id:i.id,patch:{flipped}})));
 return <section className="door-controls" aria-label="开门朝向控制"><b>{single?'开门朝向':`批量开门朝向 · ${items.length} 扇门`}</b>
 {single&&<svg viewBox="-110 -110 220 220" role="img" aria-label={`开门预览：${direction(first.rotation,!!first.flipped)}`}><g transform={`rotate(${first.rotation}) scale(${85/first.w})`}><BuildingSymbol item={first} selected={false} scale={85/first.w}/></g></svg>}
 <div className="door-side-options">{[false,true].map(flipped=><button key={String(flipped)} aria-pressed={items.every(i=>!!i.flipped===flipped)} onClick={()=>patch(flipped)}>{single?direction(first.rotation,flipped):flipped?'统一到墙线另一侧':'统一到墙线默认侧'}</button>)}</div>
 <button onClick={()=>updateMany(items.map(i=>({id:i.id,patch:{flipped:!i.flipped}})))}>反转开门方向</button>
 {single&&first.model!=='double-door'&&<label>门轴位置<select aria-label="门轴位置" value={first.hingeRight?'right':'left'} onChange={e=>updateMany([{id:first.id,patch:{hingeRight:e.target.value==='right'}}])}><option value="left">墙起点侧</option><option value="right">墙终点侧</option></select></label>}
 {!single&&items.some(i=>i.model!=='double-door')&&<button onClick={()=>updateMany(items.filter(i=>i.model!=='double-door').map(i=>({id:i.id,patch:{hingeRight:!i.hingeRight}})))}>交换单开门门轴</button>}
 <small>朝向以画布为准；修改开启侧不会旋转门洞。双开门两扇同时反向。</small></section>;
}
