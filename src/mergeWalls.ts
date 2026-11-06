import { Project } from './model';
import { wallPoint, segmentPose, syncStructure } from './structure';
import { isEditable } from './editorInteraction';
import { planningEditable } from './planning';
// Merge a connected collinear union, without filling real gaps or losing references.
export function mergeWalls(project:Project,ids:string[]){
  const chosen=new Set(ids),walls=project.items.filter(i=>chosen.has(i.id));
  if(walls.length<2||walls.length!==chosen.size||walls.some(i=>i.kind!=='wall'))throw Error('请选择至少两段墙体');
  const base=walls[0],start=wallPoint(base,0),angle=base.rotation*Math.PI/180,u={x:Math.cos(angle),y:Math.sin(angle)};
  const associated=project.items.filter(i=>chosen.has(i.id)||i.wallId&&chosen.has(i.wallId));
  if(associated.some(i=>!isEditable(i,project)))throw Error('墙体或关联门窗已锁定、隐藏或位于保护范围外');
  if(project.groups?.some(g=>g.members.some(id=>associated.some(i=>i.id===id))))throw Error('请先解组墙体或关联门窗，再合并');
  if(project.items.some(i=>i.measure&&(chosen.has(i.measure.a)||chosen.has(i.measure.b))))throw Error('墙体有关联净距标注，请先处理标注再合并');
  if(walls.some(w=>Math.abs(w.d-base.d)>.01||Math.abs(w.h-base.h)>.01||w.color!==base.color||w.zoneId!==base.zoneId||w.notes!==base.notes||w.specification!==base.specification))throw Error('墙厚、高度、颜色、分区及备注需一致，避免合并丢失属性');
  const along=(p:{x:number;y:number})=>(p.x-start.x)*u.x+(p.y-start.y)*u.y;
  const segments=walls.map(w=>{const a=wallPoint(w,0),b=wallPoint(w,w.w);if([a,b].some(p=>Math.abs((p.x-start.x)*u.y-(p.y-start.y)*u.x)>.1))throw Error('只能合并共线墙；转角墙请保留分段连接');return {wall:w,lo:Math.min(along(a),along(b)),hi:Math.max(along(a),along(b)),reverse:along(b)<along(a)}}).sort((a,b)=>a.lo-b.lo);
  const lo=segments[0].lo;let hi=segments[0].hi;for(const s of segments.slice(1)){if(s.lo>hi+.1)throw Error('墙段之间存在空隙，不能自动补墙');hi=Math.max(hi,s.hi)}
  const merged={...base,...segmentPose({x:start.x+u.x*lo,y:start.y+u.y*lo},{x:start.x+u.x*hi,y:start.y+u.y*hi},base.d)};
  const items=project.items.filter(i=>!chosen.has(i.id)||i.id===base.id).map(i=>{if(i.id===base.id)return merged;const segment=segments.find(s=>s.wall.id===i.wallId);if(!segment)return i;const center=wallPoint(segment.wall,(i.offset??0)+i.w/2);return {...i,wallId:base.id,offset:along(center)-lo-i.w/2,...(segment.reverse&&i.kind==='door'?{flipped:!i.flipped,...(i.model!=='double-door'?{hingeRight:!i.hingeRight}:{})}:{})}});
  const next=syncStructure({...project,items});if(next.items.some(i=>(i.id===base.id||i.wallId===base.id)&&!planningEditable(i,next)))throw Error('合并后的墙体或门窗超出保护范围');
  return {project:next,id:base.id,count:walls.length,length:hi-lo,openings:associated.length-walls.length};
}
