import { isVisible } from './editorInteraction';
import { Item, Point, Project } from './model';
import { bounds, edges, footprint, length, projectPoint, subtract } from './spatial';
import { wallPoint } from './structure';
export type SnapGuide={a:Point;b:Point;label:string};
export function snapTranslation(p:Project,origins:Item[],delta:Point,tolerance:number):{delta:Point;guides:SnapGuide[]}{
 const ids=new Set(origins.map(i=>i.id)),targets=p.items.filter(i=>isVisible(i,p)&&!ids.has(i.id)&&!(i.wallId&&ids.has(i.wallId))&&!['zone','dimension','text','leader','utility'].includes(i.kind));
 if(!origins.length||!targets.length)return{delta,guides:[]};const moving=origins.map(i=>({...i,x:i.x+delta.x,y:i.y+delta.y})),box=bounds(moving);let edgeSnap:{offset:Point;guide:SnapGuide;distance:number}|undefined;
 for(const item of moving)for(const v of footprint(item))for(const target of targets)for(const edge of edges(footprint(target))){const q=projectPoint(v,edge.a,edge.b),offset=subtract(q,v),distance=length(offset);if(distance<tolerance&&(!edgeSnap||distance<edgeSnap.distance))edgeSnap={offset,distance,guide:{a:edge.a,b:edge.b,label:target.kind==='wall'?'墙边':'物体边缘'}}}
 for(const item of moving)for(const v of [...footprint(item),{x:item.x+item.w/2,y:item.y+item.d/2}])for(const target of targets){const points=target.kind==='wall'?[wallPoint(target,0),wallPoint(target,target.w)]:[{x:target.x+target.w/2,y:target.y+target.d/2}];for(const q of points){const offset=subtract(q,v),distance=length(offset);if(distance<tolerance&&(!edgeSnap||distance<edgeSnap.distance))edgeSnap={offset,distance,guide:{a:q,b:v,label:target.kind==='wall'?'墙端点':'物体中心'}}}}
 if(edgeSnap)return{delta:{x:delta.x+edgeSnap.offset.x,y:delta.y+edgeSnap.offset.y},guides:[edgeSnap.guide]};
 let sx:{d:number;x:number;other:ReturnType<typeof bounds>}|undefined,sy:{d:number;y:number;other:ReturnType<typeof bounds>}|undefined;
 for(const target of targets){const other=bounds([target]);for(const x of [box.x,box.x+box.w/2,box.x+box.w])for(const tx of [other.x,other.x+other.w/2,other.x+other.w]){const d=tx-x;if(Math.abs(d)<tolerance&&(!sx||Math.abs(d)<Math.abs(sx.d)))sx={d,x:tx,other}}for(const y of [box.y,box.y+box.h/2,box.y+box.h])for(const ty of [other.y,other.y+other.h/2,other.y+other.h]){const d=ty-y;if(Math.abs(d)<tolerance&&(!sy||Math.abs(d)<Math.abs(sy.d)))sy={d,y:ty,other}}}
 const guides:SnapGuide[]=[];if(sx)guides.push({a:{x:sx.x,y:Math.min(box.y,sx.other.y)},b:{x:sx.x,y:Math.max(box.y+box.h,sx.other.y+sx.other.h)},label:'边缘 / 中心'});if(sy)guides.push({a:{x:Math.min(box.x,sy.other.x),y:sy.y},b:{x:Math.max(box.x+box.w,sy.other.x+sy.other.w),y:sy.y},label:'边缘 / 中心'});
 return{delta:{x:delta.x+(sx?.d??0),y:delta.y+(sy?.d??0)},guides};
}
