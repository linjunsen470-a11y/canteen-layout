import { Item, Project, modelOf } from './model';
import { footprint, bounds, contains, inPolygon, polygonDistance, doorSwings, baseHeight, supportFor } from './spatial';
import { polygonCoverage } from './polygonArea';
import { siteOutline } from './site';
export type SpaceIssue={ids:string[];type:string;message:string};
const wallMountedModels=new Set(['shop-sign','wall-art','menu-board','tv-screen','wood-feature-wall','wall-sconce']);
const isWallOrOpening=(i:Item)=>i.kind==='wall'||i.kind==='partition'||i.kind==='door'||i.kind==='window';
const isStructural=(i:Item)=>['wall','partition','door','window','column','fixture','stairs'].includes(i.kind);
const isWallMounted=(i:Item)=>wallMountedModels.has(modelOf(i));
const isModularLine=(i:Item)=>['counter','sink','stove','fridge','shelf','decor'].includes(i.kind);
const isHoodOverStove=(a:Item,b:Item)=>(modelOf(a)==='hood'&&b.kind==='stove')||(modelOf(b)==='hood'&&a.kind==='stove');
function wallEndpoints(i:Item){const t=i.rotation*Math.PI/180,cx=i.x+i.w/2,cy=i.y+i.d/2,dx=i.w/2*Math.cos(t),dy=i.w/2*Math.sin(t);return [{x:cx-dx,y:cy-dy},{x:cx+dx,y:cy+dy}]}
function wallsJoined(a:Item,b:Item,fa:ReturnType<typeof footprint>,fb:ReturnType<typeof footprint>){
 const ea=wallEndpoints(a),eb=wallEndpoints(b);
 // L-corner join (endpoints meet) or T-junction join (one wall's endpoint meets the other wall's body).
 if(ea.some(u=>eb.some(v=>Math.hypot(u.x-v.x,u.y-v.y)<1)))return true;
 return ea.some(p=>inPolygon(p,fb))||eb.some(p=>inPolygon(p,fa));
}
type Aisle = ReturnType<typeof polygonDistance>;

export function checkSpace(p: Project, activeId: string | null) {
 return inspectSpace(p, activeId).issues;
}

export function inspectSpace(p: Project, activeId: string | null, measureAisles = false) {
 const nearest = new Map<string, Aisle>();
 const groupOf = new Map((p.groups ?? []).flatMap(g => g.members.map(id => [id, g.id] as const)));
 const groupId = (i: Item) => groupOf.get(i.id) ?? i.id;
 const remember = (i: Item, gap: Aisle) => {
   if (!['table', 'chair', 'counter'].includes(i.kind)) return;
   const key = groupId(i), previous = nearest.get(key);
   if (!previous || gap.distance < previous.distance) nearest.set(key, gap);
 };
 const bodies=p.items.filter(i=>!i.hidden&&!['zone','text','dimension','leader','utility'].includes(i.kind)&&!(i.wallId&&p.items.find(w=>w.id===i.wallId)?.hidden)),issues:SpaceIssue[]=[],area=p.planningAreas?.find(a=>a.id===activeId),reference=p.clearance??900;
 for(const i of bodies){const f=footprint(i);if(modelOf(i)!=='shop-sign'&&!contains(siteOutline(p),f))issues.push({ids:[i.id],type:'场地越界',message:`${i.name} 的完整轮廓超出整场地`});if(area&&modelOf(i)!=='shop-sign'&&!contains(area.outline,f))issues.push({ids:[i.id],type:'范围越界',message:`${i.name} 超出 ${area.name}`});const support=supportFor(p,i);if(i.supportId&&support&&!contains(footprint(support),f))issues.push({ids:[i.id,support.id],type:'叠放待调整',message:`${i.name} 未完整落在承托物上`})}
 for(let n=0;n<bodies.length;n++)for(let m=n+1;m<bodies.length;m++){
  const a=bodies[n],b=bodies[m];if(a.wallId===b.id||b.wallId===a.id)continue;
  if(Math.min(baseHeight(p,a)+a.h,baseHeight(p,b)+b.h)-Math.max(baseHeight(p,a),baseHeight(p,b))<1)continue;
  const x=bounds([a]),y=bounds([b]);if(Math.max(x.x-y.x-y.w,y.x-x.x-x.w,x.y-y.y-y.h,y.y-x.y-x.h)>Math.max(reference, measureAisles ? 2400 : 0))continue;
  const fa=footprint(a),fb=footprint(b),overlap=polygonCoverage(fa,[fb]).union;
  // Wall corners and T-junctions intentionally overlap where centerlines meet.
  if(a.kind==='wall'&&b.kind==='wall'&&wallsJoined(a,b,fa,fb))continue;
  // Exhaust hoods intentionally sit above stoves/fryers/noodle cookers.
  if(isHoodOverStove(a,b))continue;
  // Wall-mounted signage/art/screens/sconces and ceiling lights intentionally attach to walls, partitions, or storefront facades.
  if(overlap>1){
   if((isWallOrOpening(a)&&(b.kind==='lighting'||isWallMounted(b)))||(isWallOrOpening(b)&&(a.kind==='lighting'||isWallMounted(a))))continue;
   const fixed=[a,b].some(i=>['wall','partition','column','fixture'].includes(i.kind));
   issues.push({ids:[a.id,b.id],type:fixed?'固定障碍碰撞':'物件重叠',message:`${a.name} 与 ${b.name} 外包轮廓重叠`});
  }
  else if((reference>0||measureAisles)&&a.kind!=='window'&&b.kind!=='window'&&a.kind!=='lighting'&&b.kind!=='lighting'&&!isWallMounted(a)&&!isWallMounted(b)&&!(a.kind==='decor'&&baseHeight(p,a)>=1100)&&!(b.kind==='decor'&&baseHeight(p,b)>=1100)&&!(isStructural(a)&&isStructural(b))&&groupId(a)!==groupId(b)){
   const wallPair = a.kind==='wall'||b.kind==='wall';
   if(wallPair&&!measureAisles)continue;
   const gap=polygonDistance(fa,fb), d=gap.distance;
   // Equipment placed flush against a partition or lined up side-by-side in a kitchen/bar run is not an aisle pinch-point.
   if((a.kind==='partition'||b.kind==='partition')&&d<=220)continue;
   if(isModularLine(a)&&isModularLine(b)&&d<=200)continue;
   if(measureAisles && d <= 2400) { remember(a, gap); remember(b, gap); }
   if(!wallPair && d<reference-.1)issues.push({ids:[a.id,b.id],type:'参考净距',message:`${a.name} ↔ ${b.name}：${Math.round(d)}mm，小于参考 ${reference}mm`});
  }
 }
 for(const door of bodies.filter(i=>i.kind==='door'))for(const other of bodies){if(other.id===door.id||other.id===door.wallId||other.kind==='door'||other.kind==='lighting'||isWallMounted(other)||baseHeight(p,other)>=door.h)continue;if(doorSwings(door).some(swing=>polygonCoverage(swing,[footprint(other)]).union>1))issues.push({ids:[door.id,other.id],type:'门扇开启范围',message:`${door.name} 的示意开启范围与 ${other.name} 重叠`})}
 const clearances = [...new Set(nearest.values())].sort((a,b) => a.distance-b.distance).slice(0,8);
 return { issues, clearances };
}
