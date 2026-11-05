import ZoneSummary from './ZoneSummary';
import { useWorkspace } from './workspace';
import { useState } from 'react';
import { Item } from './model';
import { useStore } from './store';
import { splitZone, zoneArea } from './zones';
export default function ZoneFields({item}:{item:Item}){
 const s=useStore(),[axis,A]=useState<'w'|'d'>('w'),[distance,D]=useState(''),[error,E]=useState('');
 if(item.kind!=='zone')return <label>所属区域<select aria-label="所属区域" value={item.zoneId??''} onChange={e=>s.update(item.id,{zoneId:e.target.value||undefined})}><option value="">未分配</option>{s.project.items.filter(i=>i.kind==='zone').map(z=><option key={z.id} value={z.id}>{z.name}</option>)}</select></label>;
 return <div className="zone-fields"><p>场地内面积：{(zoneArea(s.project,item)/1e6).toFixed(2)} ㎡ · 已分配 {s.project.items.filter(i=>i.zoneId===item.id).length} 件</p><button onClick={()=>{if(useWorkspace.getState().view==='3d')useWorkspace.getState().set({view:'split'});s.setTool('zone-edit')}}>编辑分区顶点</button><ZoneSummary/>{!item.polygon&&<details><summary>分割区域</summary><label>分割方向<select aria-label="分割方向" value={axis} onChange={e=>{A(e.target.value as 'w'|'d');D('')}}><option value="w">沿长度分割</option><option value="d">沿宽度分割</option></select></label><label>首段尺寸（mm）<input type="number" min={100} max={item[axis]-100} value={distance} placeholder={String(item[axis]/2)} onChange={e=>D(e.target.value)}/></label><button type="button" onClick={()=>{try{const next=splitZone(s.project,item.id,axis,distance===''?item[axis]/2:Number(distance));s.commit(next);E('');D('')}catch(e){E((e as Error).message)}}}>分割为两个区域</button><p>按物件中心重新分配原区域的归属，不移动物件；一次撤销恢复。重叠区域面积分别统计，不相加作为场地总面积。</p>{error&&<p role="alert">{error}</p>}</details>}</div>;
}
