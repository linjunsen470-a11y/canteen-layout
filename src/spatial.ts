import { Item, Point, Project, modelOf } from './model';
import { zoneCorners } from './zones';
import { pointInSite, polygonArea } from './site';
import { polygonCoverage } from './polygonArea';
export const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
export const subtract=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
export const length=(p:Point)=>Math.hypot(p.x,p.y);
export const edges=(p:Point[])=>p.map((a,i)=>({a,b:p[(i+1)%p.length]}));
export const inPolygon=(p:Point,outline:Point[])=>pointInSite({outline} as Project,p);
export function footprint(i:Item):Point[]{
 if(modelOf(i)==='round-table')return Array.from({length:48},(_,n)=>{const a=n*Math.PI/24,t=i.rotation*Math.PI/180,x=Math.cos(a)*i.w/2,y=Math.sin(a)*i.d/2;return{x:i.x+i.w/2+x*Math.cos(t)-y*Math.sin(t),y:i.y+i.d/2+x*Math.sin(t)+y*Math.cos(t)}});
 return zoneCorners(i);
}
export function bounds(items:Item[]){const p=items.flatMap(footprint),x=Math.min(...p.map(p=>p.x)),y=Math.min(...p.map(p=>p.y));return{x,y,w:Math.max(...p.map(p=>p.x))-x,h:Math.max(...p.map(p=>p.y))-y}}
export function contains(outline:Point[],inner:Point[]){return polygonArea(inner)-polygonCoverage(outline,[inner]).union<Math.max(.1,polygonArea(inner)*1e-8)}
export function projectPoint(p:Point,a:Point,b:Point){const v=subtract(b,a),d=v.x*v.x+v.y*v.y,t=d?Math.max(0,Math.min(1,((p.x-a.x)*v.x+(p.y-a.y)*v.y)/d)):0;return{x:a.x+t*v.x,y:a.y+t*v.y}}
export function polygonDistance(a:Point[],b:Point[]){
 let result={distance:Infinity,a:a[0],b:b[0]};
 if(inPolygon(a[0],b)||inPolygon(b[0],a)){const p=inPolygon(a[0],b)?a[0]:b[0];return{distance:0,a:p,b:p}}
 for(const e of edges(a))for(const f of edges(b)){
  const r=subtract(e.b,e.a),s=subtract(f.b,f.a),q=subtract(f.a,e.a),den=cross(r,s);if(Math.abs(den)>1e-9){const t=cross(q,s)/den,u=cross(q,r)/den;if(t>=0&&t<=1&&u>=0&&u<=1){const p={x:e.a.x+r.x*t,y:e.a.y+r.y*t};return{distance:0,a:p,b:p}}}
  for(const p of [e.a,e.b]){const v=projectPoint(p,f.a,f.b),d=length(subtract(p,v));if(d<result.distance)result={distance:d,a:p,b:v}}
  for(const p of [f.a,f.b]){const v=projectPoint(p,e.a,e.b),d=length(subtract(p,v));if(d<result.distance)result={distance:d,a:v,b:p}}
 }return result;
}
export const surfaceModels=new Set(['coffee-machine','microwave','rice-cooker','beverage']);
export const isSurface=(i:Item)=>i.kind==='table'||i.kind==='fixture'||i.kind==='counter'&&['buffet','worktable','display-counter','return-counter','salad-counter','cashier'].includes(modelOf(i));
export function supportFor(p:Project,i:Item){
 if(i.supportId)return p.items.find(v=>v.id===i.supportId&&isSurface(v));
 if(!surfaceModels.has(modelOf(i)))return undefined;
 return p.items.find(v=>v.id!==i.id&&!v.hidden&&isSurface(v)&&contains(footprint(v),footprint(i)));
}
export const baseHeight=(p:Project,i:Item)=>(i.sill??supportFor(p,i)?.h??0);
export function doorSwing(i:Item){const a=i.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),sign=i.flipped?-1:1,cx=i.x+i.w/2,cy=i.y+i.d/2;const points=[{x:-i.w/2,y:0},...Array.from({length:25},(_,n)=>({x:-i.w/2+i.w*Math.cos(n*Math.PI/48),y:sign*i.w*Math.sin(n*Math.PI/48)}))];return points.map(p=>({x:cx+p.x*c-p.y*s,y:cy+p.x*s+p.y*c}))}
