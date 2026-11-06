import { groupSelection } from './layoutGroups';
import { memo, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, LockOpen, Focus } from 'lucide-react';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { Item } from './model';
import LayerControls from './LayerControls';
const ObjectRow=memo(function ObjectRow({item:i,parent,selected}:{item:Item;parent?:Item;selected:boolean}){
 const visible=!i.hidden&&!parent?.hidden;
 return <article className={selected?'selected':''} data-object-id={i.id}>
  <label className="object-check"><input type="checkbox" aria-label={`选择 ${i.name}`} checked={selected} onChange={()=>{const s=useStore.getState();s.cancelInteraction();s.selectMany(groupSelection(s.project,i.id,s.selectedIds,true))}}/>选择</label>
  <button className="object-select" onDoubleClick={e=>{const s=useStore.getState();s.cancelInteraction();s.selectMany(e.shiftKey?[...new Set([...s.selectedIds,i.id])]:[i.id])}} aria-pressed={selected} onClick={e=>{const s=useStore.getState();s.cancelInteraction();s.selectMany(groupSelection(s.project,i.id,s.selectedIds,e.shiftKey,e.ctrlKey||e.metaKey))}}><b>{i.name}</b><small>{i.w} × {i.d} mm{parent?` · 属于 ${parent.name}`:''}{!visible?' · 已隐藏':''}{i.locked||parent?.locked?' · 锁定':''}</small></button>
  <div className="object-actions"><button aria-label={`${i.hidden?'显示':'隐藏'} ${i.name}`} title={parent?.hidden?'所属墙体已隐藏；需显示墙体':undefined} aria-pressed={!i.hidden} onClick={()=>useStore.getState().setFlags([i.id],{hidden:!i.hidden})}>{visible?<Eye/>:<EyeOff/>}</button><button aria-label={`${i.locked?'解锁':'锁定'} ${i.name}`} aria-pressed={!!i.locked} onClick={()=>useStore.getState().setFlags([i.id],{locked:!i.locked})}>{i.locked?<LockKeyhole/>:<LockOpen/>}</button><button aria-label={`定位 ${i.name}`} disabled={!visible} onClick={()=>{useStore.getState().locate(i.id);useWorkspace.getState().set({propsOpen:true})}}><Focus/></button></div>
 </article>;
});
export default function ObjectList(){
 const {project,selectedIds}=useStore(),[query,setQuery]=useState('');
 const rows=project.items.filter(i=>`${i.name} ${i.id}`.toLowerCase().includes(query.trim().toLowerCase())),byId=new Map(project.items.map(i=>[i.id,i]));
 return <section className="object-browser"><LayerControls/><label className="catalog-search"><input aria-label="搜索对象" placeholder="按名称或 ID 搜索" value={query} onChange={e=>setQuery(e.target.value)}/></label><p className="panel-help">{rows.length} 个对象 · 已选 {selectedIds.length} 项 · Shift 点击多选</p><div className="site-actions"><button onClick={()=>{const s=useStore.getState();s.cancelInteraction();s.selectMany(rows.map(i=>i.id))}}>全选搜索结果</button><button disabled={!selectedIds.length} onClick={()=>useStore.getState().selectMany([])}>取消选择</button></div><div className="object-list">{rows.map(i=><ObjectRow key={i.id} item={i} parent={i.wallId?byId.get(i.wallId):undefined} selected={selectedIds.includes(i.id)}/>)}{!rows.length&&<p>没有匹配的对象。</p>}</div></section>;
}
