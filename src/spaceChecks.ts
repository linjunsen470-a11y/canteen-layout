import { Project } from './model';
import { footprint, bounds, contains, polygonDistance, doorSwing, baseHeight, supportFor } from './spatial';
import { polygonCoverage } from './polygonArea';
import { siteOutline } from './site';
export type SpaceIssue={ids:string[];type:string;message:string};
export function checkSpace(p:Project,activeId:string|null){
 const bodies=p.items.filter(i=>!i.hidden&&!['zone','text','dimension','leader','utility'].includes(i.kind)&&!(i.wallId&&p.items.find(w=>w.id===i.wallId)?.hidden)),issues:SpaceIssue[]=[],area=p.planningAreas?.find(a=>a.id===activeId),reference=p.clearance??900;
 for(const i of bodies){const f=footprint(i);if(!contains(siteOutline(p),f))issues.push({ids:[i.id],type:'场地越界',message:`${i.name} 的完整轮廓超出整场地`});if(area&&!contains(area.outline,f))issues.push({ids:[i.id],type:'范围越界',message:`${i.name} 超出 ${area.name}`});const support=supportFor(p,i);if(i.supportId&&support&&!contains(footprint(support),f))issues.push({ids:[i.id,support.id],type:'叠放待调整',message:`${i.name} 未完整落在承托物上`})}
 for(let n=0;n<bodies.length;n++)for(let m=n+1;m<bodies.length;m++){
  const a=bodies[n],b=bodies[m];if(a.wallId===b.id||b.wallId===a.id)continue;
  if(Math.min(baseHeight(p,a)+a.h,baseHeight(p,b)+b.h)-Math.max(baseHeight(p,a),baseHeight(p,b))<1)continue;
  const x=bounds([a]),y=bounds([b]);if(Math.max(x.x-y.x-y.w,y.x-x.x-x.w,x.y-y.y-y.h,y.y-x.y-x.h)>reference)continue;
  const fa=footprint(a),fb=footprint(b),overlap=polygonCoverage(fa,[fb]).union;
  // Wall ends joined by the G3 centreline rule intentionally overlap at corners.
  if(a.kind==='wall'&&b.kind==='wall'){const end=(i:typeof a,sign:number)=>{const t=i.rotation*Math.PI/180;return{x:i.x+i.w/2+sign*i.w/2*Math.cos(t),y:i.y+i.d/2+sign*i.w/2*Math.sin(t)}};if([-1,1].some(s=>[-1,1].some(t=>{const u=end(a,s),v=end(b,t);return Math.hypot(u.x-v.x,u.y-v.y)<1})))continue}
  if(overlap>1){const fixed=[a,b].some(i=>['wall','partition','column','fixture'].includes(i.kind));issues.push({ids:[a.id,b.id],type:fixed?'固定障碍碰撞':'物件重叠',message:`${a.name} 与 ${b.name} 外包轮廓重叠`})}
  else if(reference>0&&!(p.groups??[]).some(g=>g.members.includes(a.id)&&g.members.includes(b.id))){const d=polygonDistance(fa,fb).distance;if(d<reference-.1)issues.push({ids:[a.id,b.id],type:'参考净距',message:`${a.name} ↔ ${b.name}：${Math.round(d)}mm，小于参考 ${reference}mm`})}
 }
 for(const door of bodies.filter(i=>i.kind==='door'))for(const other of bodies){if(other.id===door.id||other.id===door.wallId||other.kind==='door'||baseHeight(p,other)>=door.h)continue;if(polygonCoverage(doorSwing(door),[footprint(other)]).union>1)issues.push({ids:[door.id,other.id],type:'门扇开启范围',message:`${door.name} 的示意开启范围与 ${other.name} 重叠`})}
 return issues;
}
