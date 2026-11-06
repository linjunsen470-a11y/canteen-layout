import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { usePlanning } from './planning';
import { isEditable } from './editorInteraction';
import { Item } from './model';
import { normalizeRotation } from './rotation';
import { isAttachedOpening } from './structure';
export default function RotationHandle({scale}:{scale:number}){
 const s=useStore();usePlanning();const i=s.project.items.find(i=>i.id===s.selected);
 const drag=useRef<{item:Item;angle:number;release:()=>void}|null>(null);
 const coord=(e:React.PointerEvent<SVGElement>)=>new DOMPoint(e.clientX,e.clientY).matrixTransform(e.currentTarget.closest<SVGGElement>('[data-plan]')!.getScreenCTM()!.inverse());
 const finish=(cancel=false)=>{const d=drag.current;drag.current=null;if(d){if(cancel)useStore.getState().cancelMove();else useStore.getState().endMove();d.release()}};
 useEffect(()=>{const cancel=()=>finish(true),unsub=useStore.subscribe((s,p)=>{if(s.interactionEpoch!==p.interactionEpoch)cancel()});window.addEventListener('blur',cancel);return()=>{unsub();window.removeEventListener('blur',cancel);cancel()}},[]);
 if(!i||s.selectedIds.length!==1||s.tool!=='select'||!isEditable(i,s.project)||i.measure||isAttachedOpening(i))return null;
 const radius=Math.max(i.d/2+32/scale,44/scale),angle=normalizeRotation(i.rotation);
 return <g data-ui="true" data-rotation-overlay={i.id} transform={`translate(${i.x+i.w/2},${i.y+i.d/2}) rotate(${i.rotation})`} onPointerMove={e=>{const d=drag.current;if(!d)return;e.preventDefault();e.stopPropagation();const p=coord(e),dx=p.x-d.item.x-d.item.w/2,dy=p.y-d.item.y-d.item.d/2;if(Math.hypot(dx,dy)*scale<6)return;let rotation=d.item.rotation+(Math.atan2(dy,dx)-d.angle)*180/Math.PI;rotation=e.shiftKey?Math.round(rotation/15)*15:Math.round(rotation*10)/10;useStore.getState().move(d.item.id,{rotation:normalizeRotation(rotation)})}} onPointerUp={e=>{e.stopPropagation();finish()}} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish(true)}>
  <line y1={-i.d/2} y2={-radius} stroke="#ae6b1c" strokeWidth={1.5/scale} pointerEvents="none"/>
  <circle r={3/scale} fill="#ae6b1c" pointerEvents="none"/>
  <g transform={`translate(0,${-radius}) rotate(${-i.rotation})`}>
   <circle data-rotation-handle={i.id} role="button" tabIndex={0} aria-label={`自由旋转 ${i.name}`} r={11/scale} fill="#fff7df" stroke="#ae6b1c" strokeWidth={2/scale} style={{cursor:s.gesture?'grabbing':'grab'}} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();e.stopPropagation();s.update(i.id,{rotation:e.key==='Home'?0:i.rotation+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?15:1)})}}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();const state=useStore.getState(),item=state.project.items.find(v=>v.id===i.id)!;if(!isEditable(item,state.project))return;e.currentTarget.closest('svg')?.focus();const p=coord(e),target=e.currentTarget,id=e.pointerId;target.setPointerCapture(id);drag.current={item:{...item},angle:Math.atan2(p.y-item.y-item.d/2,p.x-item.x-item.w/2),release:()=>{if(target.hasPointerCapture(id))target.releasePointerCapture(id)}};state.beginMove()}}><title>拖动自由旋转 · Shift 吸附 15° · Esc 取消</title></circle>
   <text textAnchor="middle" dominantBaseline="central" fontSize={17/scale} fill="#935a17" pointerEvents="none">↻</text>
   <text y={-17/scale} textAnchor="middle" fontSize={12/scale} fill="#935a17" stroke="#fff" strokeWidth={3/scale} paintOrder="stroke" pointerEvents="none">{Math.round(angle*10)/10}°</text>
  </g>
 </g>;
}
