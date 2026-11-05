import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { polygonPatch, zoneCorners } from './zones';
import { isEditable } from './editorInteraction';
import { uid } from './model';
import { usePlanning } from './planning';
import { useWorkspace } from './workspace';
import { useStore } from './store';
import { SitePoint, siteOutline } from './site';

export type SiteOutlineHandle={finish:()=>void};
export default forwardRef<SiteOutlineHandle,{mode:'draw'|'edit';scale:number;snap:boolean;onDone:()=>void;target?:'site'|'planning'|'zone'}>(function SiteOutline({mode,scale,snap,onDone,target='site'},ref){
  const activeId=usePlanning(s=>s.activeId);
  const snapSize=useWorkspace(s=>s.snapSize);
  const p=useStore(s=>s.project),[points,setPoints]=useState<SitePoint[]>([]),[hover,setHover]=useState<SitePoint|null>(null);
  const drag=useRef<{index:number;points:SitePoint[];release:()=>void}|null>(null);
  const coord=(e:React.PointerEvent<SVGElement>)=>{const matrix=e.currentTarget.closest<SVGGElement>('[data-plan]')!.getScreenCTM()!;const q=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());const step=snap&&!e.altKey?snapSize:1;return{x:Math.max(0,Math.min(p.width,Math.round(q.x/step)*step)),y:Math.max(0,Math.min(p.height,Math.round(q.y/step)*step))}};
  const commitOutline=(outline:SitePoint[],create=false)=>{const state=useStore.getState(),project=state.project;if(target==='site')return state.commit({...project,outline});if(target==='zone'){try{const patch=polygonPatch(outline);if(create){return !!state.addItem({kind:'zone',name:'多边形分区',h:0,color:'#8ca9ca',...patch})}const item=project.items.find(i=>i.id===state.selected);if(!item||!isEditable(item,project))return false;state.update(item.id,patch);return !useStore.getState().error}catch(e){useStore.setState({error:(e as Error).message});return false}}const id=create?uid():activeId;if(!id)return false;const areas=project.planningAreas??[],next=create?[...areas,{id,name:'规划范围 '+(areas.length+1),color:'#c38434',outline}]:areas.map(a=>a.id===id?{...a,outline}:a);if(state.commit({...project,planningAreas:next})){usePlanning.getState().set({activeId:id});return true}return false};
  const finish=()=>{if(mode==='edit'||commitOutline(points,true))onDone()};
  useImperativeHandle(ref,()=>({finish}));
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(document.querySelector('dialog[open]'))return;if(e.target instanceof HTMLElement&&e.target.closest('input,select,textarea'))return;if(e.key==='Enter'){e.preventDefault();e.stopPropagation();finish()}if(mode==='draw'&&e.key==='Backspace'){e.preventDefault();e.stopPropagation();setPoints(v=>v.slice(0,-1))}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)},[mode,points,onDone]);
  const cancel=()=>{const d=drag.current;drag.current=null;if(d){useStore.getState().cancelMove();d.release()}};
  useEffect(()=>{const unsub=useStore.subscribe((s,p)=>{if(s.interactionEpoch!==p.interactionEpoch)cancel()});window.addEventListener('blur',cancel);return()=>{unsub();window.removeEventListener('blur',cancel);cancel()}},[]);
  const selectedZone=p.items.find(i=>i.id===useStore.getState().selected&&i.kind==='zone');
  const outline=target==='zone'?(selectedZone?zoneCorners(selectedZone):[]):target==='planning'?(p.planningAreas?.find(a=>a.id===activeId)?.outline??[]):siteOutline(p),display=mode==='draw'?points:outline;
  const end=()=>{const d=drag.current;drag.current=null;if(d){useStore.getState().endMove();d.release()}};
  return <g data-ui="true" className="site-outline" onPointerDown={e=>{e.stopPropagation();e.preventDefault();if(e.button!==0||mode!=='draw')return;const q=coord(e);if(points.length&&Math.hypot(q.x-points[0].x,q.y-points[0].y)*scale<12&&points.length>=3){finish();return}if(points.length<64)setPoints([...points,q])}} onPointerMove={e=>{e.stopPropagation();const q=coord(e);if(drag.current){const {index,points:original}=drag.current;target==='zone'?useStore.getState().moveZone(selectedZone!.id,original.map((v,i)=>i===index?q:v)):useStore.getState().moveOutline(original.map((v,i)=>i===index?q:v),target==='planning'?activeId??undefined:undefined)}else if(mode==='draw')setHover(q)}} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel}>
    <rect width={p.width} height={p.height} fill="#5885700a" stroke="#8ca595" strokeWidth={1/scale} strokeDasharray={`${5/scale} ${5/scale}`}/>
    {display.length>0&&<polyline points={[...display,...(mode==='edit'?[display[0]]:hover?[hover]:[])].map(v=>`${v.x},${v.y}`).join(' ')} fill={mode==='edit'?'#487a6212':'none'} stroke="#3c7959" strokeWidth={2/scale} pointerEvents="none"/>}
    {mode==='edit'&&outline.length<64&&outline.map((v,i)=>{const next=outline[(i+1)%outline.length],x=(v.x+next.x)/2,y=(v.y+next.y)/2;return <g key={`mid-${i}`} style={{cursor:'copy'}} onPointerDown={e=>{e.stopPropagation();if(e.button!==0)return;commitOutline([...outline.slice(0,i+1),{x,y},...outline.slice(i+1)])}}><circle cx={x} cy={y} r={7/scale} fill="#fff" stroke="#8ca595" strokeWidth={1/scale}/><path d={`M ${x-3/scale} ${y} H ${x+3/scale} M ${x} ${y-3/scale} V ${y+3/scale}`} stroke="#598068" strokeWidth={1/scale} pointerEvents="none"/></g>})}
    {display.map((v,i)=><g key={i}><circle cx={v.x} cy={v.y} r={7/scale} fill={i===0&&mode==='draw'?'#3c7959':'#fff'} stroke="#3c7959" strokeWidth={2/scale} style={{cursor:mode==='edit'?'move':'pointer'}} onContextMenu={e=>{e.preventDefault();e.stopPropagation();if(mode==='edit'&&outline.length>3)commitOutline(outline.filter((_,n)=>n!==i))}} onPointerDown={e=>{e.stopPropagation();if(e.button!==0)return;if(mode==='draw'){if(i===0&&points.length>=3)finish();return}e.currentTarget.setPointerCapture(e.pointerId);const target=e.currentTarget,id=e.pointerId;drag.current={index:i,points:outline,release:()=>{if(target.hasPointerCapture(id))target.releasePointerCapture(id)}};useStore.getState().beginMove()}}/><text x={v.x+10/scale} y={v.y-10/scale} fill="#37684e" fontSize={11/scale}>{i+1}</text></g>)}
  </g>;
});
