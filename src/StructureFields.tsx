import { Item, catalog } from './model';
import { useStore } from './store';
import { NumberField } from './NumberField';
import { isOpening, openingSlot } from './structure';
export default function StructureFields({ item }: {
    item: Item;
}) {
    const s = useStore(), wall = s.project.items.find(w => w.id === item.wallId);
    const update = (patch: Partial<Item>) => s.update(item.id, patch);
    if (isOpening(item))
        return <>
  <label className="full-field">所属墙体<select aria-label="所属墙体" value={item.wallId??''} onChange={e=>{if(!e.target.value){update({freeStanding:true,wallId:undefined,offset:undefined});return}const next=s.project.items.find(w=>w.id===e.target.value)!;const offset=openingSlot(next,item,s.project.items,(next.w-item.w)/2);if(offset===undefined){useStore.setState({error:'这面墙没有足够空间容纳该门窗'});return}update({freeStanding:false,wallId:next.id,offset})}}><option value="">独立放置 · 可自由旋转</option>{s.project.items.filter(w=>w.kind==='wall').map(w=><option key={w.id} value={w.id} disabled={w.locked||w.hidden}>{w.name}{w.locked?'（锁定）':''}</option>)}</select></label>
  <label>开口宽度（mm）<NumberField value={item.w} min={100} onCommit={w => update({ w })}/></label><label>开口高度（mm）<NumberField value={item.h} min={100} onCommit={h => update({ h })}/>{wall&&<small>最高 {Math.max(0,wall.h-(item.sill??0)-50)} mm</small>}</label>
  {wall?<label className="full-field">距墙起点（mm）<NumberField value={item.offset ?? 50} min={50} onCommit={offset=>update({offset})}/></label>:<><label>X 坐标（mm）<NumberField value={item.x} onCommit={x=>update({x})}/></label><label>Y 坐标（mm）<NumberField value={item.y} onCommit={y=>update({y})}/></label><label>厚度（mm）<NumberField value={item.d} min={1} onCommit={d=>update({d})}/></label></>}
  {item.kind === 'window' && <label>窗台离地（mm）<NumberField value={item.sill ?? 900} min={0} onCommit={sill => update({ sill })}/></label>}
  <label>颜色<input type="color" value={item.color} onChange={e => update({ color: e.target.value })}/></label>
  {item.kind === 'door' && <button onClick={() => update({ flipped: !item.flipped })}>反转开门方向</button>}
  <p>{wall?`贴墙模式：沿墙拖动，厚度与方向跟随墙体。墙长 ${wall.w.toFixed(0)}mm，高 ${wall.h}mm。`:'独立模式：可自由移动与旋转，不在墙体生成开口。选取所属墙体可恢复贴墙及开口。'}</p>
 </>;
    const cx = item.x + item.w / 2, cy = item.y + item.d / 2;
    return <>
  {item.kind==='partition'&&<label className="full-field">隔断样式<select value={item.model??'partition'} onChange={e=>update({model:e.target.value as Item['model']})}>{catalog.filter(c=>c.kind==='partition').map(c=><option value={c.model} key={c.model}>{c.name}</option>)}</select></label>}
  <label>长度（mm）<NumberField value={item.w} min={100} onCommit={w => update({ w, x: cx - w / 2 })}/></label><label>厚度（mm）<NumberField value={item.d} min={50} onCommit={d => update({ d, y: cy - d / 2 })}/></label>
  <label>高度（mm）<NumberField value={item.h} min={100} onCommit={h => update({ h })}/></label>
  <label>中心 X（mm）<NumberField value={cx} onCommit={x => update({ x: x - item.w / 2 })}/></label><label>中心 Y（mm）<NumberField value={cy} onCommit={y => update({ y: y - item.d / 2 })}/></label>
  <label>颜色<input type="color" value={item.color} onChange={e => update({ color: e.target.value })}/></label>
  <p>拖动两端圆点可调整长度和方向。开启吸附时靠近现有墙端点可连接，Alt 临时关闭；同高双墙转角自动修整。{item.kind === 'wall' ? '移动、旋转会带动门窗；删除墙体会同时删除所属门窗。' : '隔断独立放置，不承载门窗。'}</p>
 </>;
}
