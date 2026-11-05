import { Item, Project, uid } from './model';
import { polygonCoverage } from './polygonArea';
import { pointInSite, SitePoint, siteOutline, validateSite } from './site';
export function zoneCorners(i:Item):SitePoint[]{
 const a=i.rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a),cx=i.x+i.w/2,cy=i.y+i.d/2;
 return (i.polygon?i.polygon.map(p=>[(p.x-.5)*i.w,(p.y-.5)*i.d]):[[-i.w/2,-i.d/2],[i.w/2,-i.d/2],[i.w/2,i.d/2],[-i.w/2,i.d/2]]).map(([x,y])=>({x:cx+x*c-y*s,y:cy+x*s+y*c}));
}
export function inZone(i:Item,p:SitePoint){return pointInSite({outline:zoneCorners(i)} as Project,p)}
export function zoneArea(p:Project,i:Item){return polygonCoverage(siteOutline(p),[zoneCorners(i)]).union}
export function zoneStats(p:Project){return polygonCoverage(siteOutline(p),p.items.filter(i=>i.kind==='zone').map(zoneCorners))}
export function polygonPatch(points:SitePoint[]){
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y)),w=Math.max(...points.map(p=>p.x))-x,d=Math.max(...points.map(p=>p.y))-y;
 if(w<1||d<1)throw Error('分区轮廓需要有效面积');
 return {x,y,w,d,rotation:0,polygon:points.map(p=>({x:(p.x-x)/w,y:(p.y-y)/d}))};
}
export function validateZone(i:Item){if(i.polygon!==undefined){
 if(i.kind!=='zone'||!Array.isArray(i.polygon)||i.polygon.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))throw Error('多边形分区顶点无效');
 validateSite({width:i.w,height:i.d,outline:i.polygon.map(p=>({x:p.x*i.w,y:p.y*i.d}))} as Project);
}}
export function splitZone(p:Project,id:string,axis:'w'|'d',distance:number):Project{
 const z=p.items.find(i=>i.id===id&&i.kind==='zone');
 if(z?.polygon)throw Error('多边形分区请使用顶点编辑；矩形分割仅适用于矩形区域');
 if(!z||z.locked||z.hidden)throw Error('请选择可编辑区域');
 if(!Number.isFinite(distance)||distance<100||distance>z[axis]-100)throw Error('分割后每侧至少保留 100mm');
 const angle=z.rotation*Math.PI/180,dx=axis==='w'?Math.cos(angle):-Math.sin(angle),dy=axis==='w'?Math.sin(angle):Math.cos(angle);
 const part=(length:number,shift:number,newId:string,name:string)=>{const w=axis==='w'?length:z.w,d=axis==='d'?length:z.d;return {...z,id:newId,name,w,d,x:z.x+z.w/2+dx*shift-w/2,y:z.y+z.d/2+dy*shift-d/2}};
 const first=part(distance,(distance-z[axis])/2,z.id,z.name),second=part(z[axis]-distance,distance/2,uid(),z.name+' · 分区');
 return {...p,items:[...p.items.map(i=>i.id===id?first:i.zoneId===id&&inZone(second,{x:i.x+i.w/2,y:i.y+i.d/2})?{...i,zoneId:second.id}:i),second]};
}
