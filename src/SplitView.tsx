import { ReactNode, useEffect, useRef, useState } from 'react';
import { useWorkspace } from './workspace';
export default function SplitView({view,first,second}:{view:string;first:ReactNode;second:ReactNode}){
 const host=useRef<HTMLDivElement>(null),[width,setWidth]=useState(900);
 const {ratio,axis,set}=useWorkspace(),setRatio=(ratio:number)=>set({ratio}),setAxis=(axis:'auto'|'columns'|'rows')=>set({axis});
 const rows=axis==='rows'||(axis==='auto'&&width<760);
 useEffect(()=>{const o=new ResizeObserver(([e])=>setWidth(e.contentRect.width));o.observe(host.current!);return()=>o.disconnect()},[]);
 const change=(n:number)=>setRatio(Math.max(25,Math.min(75,n)));
 return <div className={`split-view ${view==='split'?'is-split':''} ${rows?'split-rows':'split-columns'}`} ref={host} style={view==='split'?{gridTemplateColumns:rows?'minmax(0,1fr)':`minmax(0,${ratio}fr) 12px minmax(0,${100-ratio}fr)`,gridTemplateRows:rows?`minmax(0,${ratio}fr) 12px minmax(0,${100-ratio}fr)`:'minmax(0,1fr)'}:undefined}>
   <div className="split-panel" hidden={view==='3d'}>{first}</div>
   {view==='split'&&<div className="split-divider" role="separator" tabIndex={0} aria-label="调整分屏比例" aria-orientation={rows?'horizontal':'vertical'} aria-valuemin={25} aria-valuemax={75} aria-valuenow={Math.round(ratio)}
    onKeyDown={e=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Home'].includes(e.key)){e.preventDefault();change(e.key==='Home'?58:ratio+(['ArrowLeft','ArrowUp'].includes(e.key)?-5:5))}}} onDoubleClick={()=>setRatio(58)}
    onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault()}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const r=host.current!.getBoundingClientRect();change(rows?(e.clientY-r.top)/r.height*100:(e.clientX-r.left)/r.width*100)}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}>
    <span/><button title={rows?'切换左右分屏':'切换上下分屏'} aria-label="切换分屏方向" onPointerDown={e=>e.stopPropagation()} onClick={()=>setAxis(rows?'columns':'rows')}>{rows?'左右':'上下'}</button>
   </div>}
   <div className="split-panel" hidden={view==='2d'}>{second}</div>
 </div>
}
