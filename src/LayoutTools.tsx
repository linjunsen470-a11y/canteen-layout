import { useState } from 'react';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { NumberField } from './NumberField';
import { addDiningSet, groupSelected, layoutAction, measureSelected, repeatSelected, rotateSelected, startCopyPlacement, ungroupSelected } from './layoutCommands';
import { seatSummary } from './layoutGroups';
import { checkSpace, SpaceIssue } from './spaceChecks';
import { usePlanning } from './planning';
export default function LayoutTools(){
 const s=useStore(),prefs=useWorkspace(),scope=usePlanning(),[rows,R]=useState(2),[cols,C]=useState(3),[dx,X]=useState(3000),[dy,Y]=useState(3500),[angle,A]=useState(90),[issues,I]=useState<SpaceIssue[]|null>(null),[checked,Q]=useState('');
 const signature=JSON.stringify([{...s.project,updatedAt:undefined},scope.activeId]),summary=seatSummary(s.project),group=s.project.groups?.find(g=>g.members.length===s.selectedIds.length&&g.members.every(id=>s.selectedIds.includes(id)));
 const act=(f:()=>void)=>layoutAction(f),place=()=>{if(prefs.view==='3d')prefs.set({view:'split'});act(startCopyPlacement)};
 return <details className="layout-tools"><summary>布局工具 · {summary.seats} 座{summary.unknown?` · ${summary.unknown} 项待确认`:''}</summary><div className="layout-tool-panel"><fieldset disabled={!!s.placement}>
  <div className="site-actions"><button onClick={()=>act(addDiningSet)}>四人桌椅组合</button><button disabled={s.selectedIds.length<2} onClick={()=>act(groupSelected)}>组合选中</button><button disabled={!s.selectedIds.length} onClick={()=>act(ungroupSelected)}>解组</button><button disabled={!s.selectedIds.length} onClick={e=>{place();e.currentTarget.closest('details')?.removeAttribute('open')}}>复制后放置</button><button disabled={s.selectedIds.length!==2} onClick={()=>act(measureSelected)}>标注边界净距</button></div>
  <p>单击组合成员选择整组，双击可单独调整，Ctrl+Shift 可逐个选择组内成员；方向键微移 10mm，Shift 为 100mm，Alt 为 1mm。复制放置：移动指针预览，点击落位，Esc 取消。</p>
  <label className="check-label"><input type="checkbox" checked={prefs.objectSnap} onChange={e=>prefs.set({objectSnap:e.target.checked})}/>几何吸附：墙边 / 物体边缘与中心（Alt 临时关闭）</label>
  {group&&<div className="layout-row"><label>组合名称<input value={group.name} onChange={e=>s.commit({...s.project,groups:s.project.groups!.map(g=>g.id===group.id?{...g,name:e.target.value}:g)})}/></label><label>组合声明座位<NumberField value={group.seats} min={0} placeholder="按成员相加" onCommit={seats=>s.commit({...s.project,groups:s.project.groups!.map(g=>g.id===group.id?{...g,seats}:g)})}/></label><button onClick={()=>s.commit({...s.project,groups:s.project.groups!.map(g=>g.id===group.id?{...g,seats:undefined}:g)})}>改按成员统计</button></div>}
  <div className="layout-row"><label>整体旋转（°）<NumberField value={angle} onCommit={A}/></label><button disabled={!s.selectedIds.length} onClick={()=>act(()=>rotateSelected(angle))}>整体旋转</button></div>
  <div className="layout-row">{[['行数',rows,R],['列数',cols,C],['列间距（mm）',dx,X],['行间距（mm）',dy,Y]].map(([name,value,set])=><label key={String(name)}>{String(name)}<NumberField value={value as number} onCommit={set as (v:number)=>void}/></label>)}<button disabled={!s.selectedIds.length} onClick={()=>act(()=>repeatSelected(rows,cols,dx,dy))}>按行列重复</button></div><p>行列包含原件，间距为每组原点的位移；一次撤销整个阵列。组合整体旋转保持相对位置。座位按可见对象的明确数值统计，隐藏项不计。组合声明替代成员计数，组合部分隐藏或座椅未声明时标为待确认，不猜容量。</p>
  <div className="layout-row"><label>参考净距（mm）<NumberField value={s.project.clearance??900} min={0} onCommit={clearance=>s.commit({...s.project,clearance})}/></label><button onClick={()=>{I(checkSpace(s.project,scope.activeId));Q(signature)}}>检查空间</button></div><p>业务参考值，不是合规结论；碰撞和净距是提示，不阻止布置。自动识别完整位于桌面的常见小设备，或在属性中指定承托物。</p>
  {issues&&<div className="space-results"><b>{checked===signature?`检查完成：${issues.length} 条提示`:'布局已修改，请重新检查'}</b>{issues.slice(0,200).map((issue,n)=><button key={n} disabled={checked!==signature} onClick={e=>{s.cancelInteraction();s.selectMany(issue.ids);s.locate();prefs.set({view:prefs.view==='3d'?'split':prefs.view});e.currentTarget.closest('details')?.removeAttribute('open')}}><strong>{issue.type}</strong> {issue.message} · 定位</button>)}{issues.length>200&&<p>仅显示前 200 条，请分步处理。</p>}</div>}
 </fieldset></div></details>;
}
