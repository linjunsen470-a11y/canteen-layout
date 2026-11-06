import { useEffect, useRef, useState } from 'react';
import { Point } from './model';
export type SceneNavigation={ground:(x:number,y:number)=>Point|null;zoom:(factor:number)=>void};
export default function SceneRegionPicker({navigation,onPick,onCancel}:{navigation:React.RefObject<SceneNavigation|null>;onPick:(points:Point[])=>void;onCancel:()=>void}){
  const [rect,setRect]=useState<{a:Point;b:Point}|null>(null),origin=useRef<Point|null>(null);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();onCancel()}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true)},[onCancel]);
  return <div className="scene-region-picker" aria-label="框选三维预览区域" onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);origin.current={x:e.clientX,y:e.clientY};const r=e.currentTarget.getBoundingClientRect();setRect({a:{x:e.clientX-r.x,y:e.clientY-r.y},b:{x:e.clientX-r.x,y:e.clientY-r.y}})}} onPointerMove={e=>{if(!origin.current)return;const r=e.currentTarget.getBoundingClientRect();setRect({a:{x:origin.current.x-r.x,y:origin.current.y-r.y},b:{x:e.clientX-r.x,y:e.clientY-r.y}})}} onPointerCancel={()=>{origin.current=null;setRect(null)}} onPointerUp={e=>{const a=origin.current;origin.current=null;setRect(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);if(!a||Math.abs(e.clientX-a.x)<8||Math.abs(e.clientY-a.y)<8)return;const points=[[a.x,a.y],[e.clientX,a.y],[e.clientX,e.clientY],[a.x,e.clientY]].map(([x,y])=>navigation.current?.ground(x,y));if(points.every((p):p is Point=>!!p))onPick(points)}}>
    <span>拖框选择地面区域 · Esc 取消</span>{rect&&<div className="scene-region-rect" style={{left:Math.min(rect.a.x,rect.b.x),top:Math.min(rect.a.y,rect.b.y),width:Math.abs(rect.a.x-rect.b.x),height:Math.abs(rect.a.y-rect.b.y)}}/>}
  </div>;
}
