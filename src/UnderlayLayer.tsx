import { useEffect, useRef } from 'react';
import { useStore } from './store';
import { useImageAsset } from './imageAssets';
import { imageToWorld, worldToImage } from './siteExtras';
import { Point } from './model';
export function UnderlayLayer(){const u=useStore(s=>s.project.underlay),{url}=useImageAsset(u?.assetId);return u&&!u.hidden&&url?<image data-underlay="true" href={url} width={u.pixelWidth} height={u.pixelHeight} transform={`translate(${u.x},${u.y}) rotate(${u.rotation}) scale(${u.mmPerPixel})`} opacity={u.opacity} pointerEvents="none"/>:null}
export function UnderlayInteraction({scale}:{scale:number}){
 const s=useStore(),u=s.project.underlay,points=s.calibrationPoints,drag=useRef<{start:Point;x:number;y:number;release:()=>void}|null>(null);
 const coord=(e:React.PointerEvent<SVGElement>)=>{const m=e.currentTarget.closest<SVGGElement>('[data-plan]')!.getScreenCTM()!;return new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse())};
 const finish=(cancel=false)=>{const d=drag.current;drag.current=null;if(d){if(cancel)useStore.getState().cancelMove();else useStore.getState().endMove();d.release()}};
 useEffect(()=>{const cancel=()=>finish(true),sub=useStore.subscribe((a,b)=>{if(a.interactionEpoch!==b.interactionEpoch)cancel()});window.addEventListener('blur',cancel);return()=>{sub();window.removeEventListener('blur',cancel);cancel()}},[]);
 if(!u||u.hidden||!s.tool.startsWith('underlay'))return null;
 return <g data-ui="true" onPointerDown={e=>{e.preventDefault();e.stopPropagation();if(e.button!==0)return;e.currentTarget.closest('svg')?.focus();const q=coord(e),p=worldToImage(u,q);if(p.x<0||p.y<0||p.x>u.pixelWidth||p.y>u.pixelHeight)return;if(s.tool==='underlay-calibrate'){s.setCalibrationPoints(points.length>=2?[p]:[...points,p]);return}if(u.locked)return;const target=e.currentTarget,id=e.pointerId;target.setPointerCapture(id);drag.current={start:q,x:u.x,y:u.y,release:()=>{if(target.hasPointerCapture(id))target.releasePointerCapture(id)}};s.beginMove()}} onPointerMove={e=>{e.stopPropagation();const d=drag.current;if(d){const p=coord(e);s.moveUnderlay({x:d.x+p.x-d.start.x,y:d.y+p.y-d.start.y})}}} onPointerUp={()=>finish()} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish(true)}>
  <rect x={-1e7} y={-1e7} width={2e7} height={2e7} fill="transparent" style={{cursor:s.tool==='underlay-calibrate'?'crosshair':'move'}}/>
  <polygon points={[{x:0,y:0},{x:u.pixelWidth,y:0},{x:u.pixelWidth,y:u.pixelHeight},{x:0,y:u.pixelHeight}].map(p=>{const v=imageToWorld(u,p);return`${v.x},${v.y}`}).join(' ')} fill="none" stroke="#337aa2" strokeWidth={2/scale} pointerEvents="none"/>
  {points.length===2&&<line x1={imageToWorld(u,points[0]).x} y1={imageToWorld(u,points[0]).y} x2={imageToWorld(u,points[1]).x} y2={imageToWorld(u,points[1]).y} stroke="#b45c28" strokeWidth={2/scale} pointerEvents="none"/>}
  {points.map((p,i)=>{const v=imageToWorld(u,p);return <g key={i} pointerEvents="none"><circle cx={v.x} cy={v.y} r={5/scale} fill="#b45c28"/><text x={v.x+10/scale} y={v.y-10/scale} fontSize={14/scale} fill="#b45c28">{i+1}</text></g>})}
 </g>;
}
