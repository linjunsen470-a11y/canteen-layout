import { Item, Point, Project, modelOf } from './model';
import { footprint, bounds, contains, inPolygon, polygonDistance, doorSwings, baseHeight, supportFor } from './spatial';
import { polygonCoverage } from './polygonArea';
import { siteOutline } from './site';
import { surveyWall } from './interiorSurvey';
export type SpaceIssue={ids:string[];type:string;message:string};
export type DragClearance = {
  a: Point;
  b: Point;
  distance: number;
  reference: number;
  tight: boolean;
  overlapping: boolean;
  targetKind: 'wall' | 'item';
  targetId: string;
};
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
 // Pair checks share the same immutable footprints, bounds and heights for this inspection.
 const geometry = bodies.map(item => ({
   polygon: footprint(item), box: bounds([item]), bottom: baseHeight(p, item),
 }));
 for(let n=0;n<bodies.length;n++)for(let m=n+1;m<bodies.length;m++){
  const a=bodies[n],b=bodies[m];if(a.wallId===b.id||b.wallId===a.id)continue;
  const ga=geometry[n],gb=geometry[m];
  if(Math.min(ga.bottom+a.h,gb.bottom+b.h)-Math.max(ga.bottom,gb.bottom)<1)continue;
  const x=ga.box,y=gb.box;if(Math.max(x.x-y.x-y.w,y.x-x.x-x.w,x.y-y.y-y.h,y.y-x.y-x.h)>Math.max(reference, measureAisles ? 2400 : 0))continue;
  const fa=ga.polygon,fb=gb.polygon,overlap=polygonCoverage(fa,[fb]).union;
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

const nonDragClearanceKinds = new Set<Item['kind']>(['zone', 'text', 'dimension', 'leader', 'utility', 'window', 'lighting']);

function fastHalfExtents(item: Item): { hx: number; hy: number } {
  const r = ((item.rotation % 180) + 180) % 180;
  if (r === 0) return { hx: item.w / 2, hy: item.d / 2 };
  if (r === 90) return { hx: item.d / 2, hy: item.w / 2 };
  const rad = item.rotation * Math.PI / 180;
  const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
  return { hx: (item.w * c + item.d * s) / 2, hy: (item.w * s + item.d * c) / 2 };
}

// Fast local clearance check for the currently dragged item(s): broad-phase AABB expanded by clearance + 600 mm,
// narrow-phase exact polygon/surveyWall distance only against nearby hits so 300-item drags stay smooth.
export function computeDragClearance(p: Project, draggedIds: readonly string[]): DragClearance | null {
  if (!draggedIds.length) return null;
  const draggedSet = new Set(draggedIds);
  const excluded = new Set(draggedIds);
  for (const g of p.groups ?? []) {
    if (g.members.some(id => draggedSet.has(id))) {
      for (const id of g.members) excluded.add(id);
    }
  }

  const active: Array<{ item: Item; poly: Point[]; bottom: number }> = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of p.items) {
    if (!draggedSet.has(item.id) || item.hidden) continue;
    if (nonDragClearanceKinds.has(item.kind) || isWallOrOpening(item) || isWallMounted(item)) continue;
    const bottom = baseHeight(p, item);
    if (item.kind === 'decor' && bottom >= 1100) continue;
    const poly = footprint(item);
    active.push({ item, poly, bottom });
    for (const pt of poly) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }
  if (!active.length) return null;

  const reference = p.clearance ?? 900;
  const margin = reference + 600;
  const qMinX = minX - margin, qMinY = minY - margin, qMaxX = maxX + margin, qMaxY = maxY + margin;

  let hiddenWalls: Set<string> | null = null;
  for (const item of p.items) {
    if (item.kind === 'wall' && item.hidden) {
      if (!hiddenWalls) hiddenWalls = new Set();
      hiddenWalls.add(item.id);
    }
  }

  let best: DragClearance | null = null;
  for (const other of p.items) {
    if (other.hidden || excluded.has(other.id)) continue;
    if (nonDragClearanceKinds.has(other.kind) || other.kind === 'door' || isWallMounted(other)) continue;
    if (other.wallId && hiddenWalls?.has(other.wallId)) continue;

    // Cheap AABB broad-phase filter before any polygon/height allocation.
    const cx = other.x + other.w / 2;
    const cy = other.y + other.d / 2;
    const { hx, hy } = fastHalfExtents(other);
    if (cx + hx < qMinX || cx - hx > qMaxX || cy + hy < qMinY || cy - hy > qMaxY) continue;

    const otherBottom = baseHeight(p, other);
    if (other.kind === 'decor' && otherBottom >= 1100) continue;

    const isWall = other.kind === 'wall';
    const otherFootprint = footprint(other);
    const datum = isWall && p.survey ? surveyWall(p, other) : undefined;
    const measurePoly = datum ? [datum.a, datum.b] : otherFootprint;

    for (const ab of active) {
      if (ab.item.wallId === other.id || other.wallId === ab.item.id) continue;
      if (Math.min(ab.bottom + ab.item.h, otherBottom + other.h) - Math.max(ab.bottom, otherBottom) < 1) continue;
      if (isHoodOverStove(ab.item, other)) continue;

      const overlap = polygonCoverage(ab.poly, [otherFootprint]).union;
      if (overlap > 1) {
        const gap = polygonDistance(ab.poly, measurePoly);
        const candidate: DragClearance = {
          a: gap.a,
          b: gap.b,
          distance: 0,
          reference,
          tight: true,
          overlapping: true,
          targetKind: isWall ? 'wall' : 'item',
          targetId: other.id,
        };
        if (!best || !best.overlapping) best = candidate;
        continue;
      }

      const gap = polygonDistance(ab.poly, measurePoly);
      if (other.kind === 'partition' && gap.distance <= 220) continue;
      if (!isWall && isModularLine(ab.item) && isModularLine(other) && gap.distance <= 200) continue;
      if (gap.distance > margin) continue;

      if (!best || gap.distance < best.distance) {
        best = {
          a: gap.a,
          b: gap.b,
          distance: gap.distance,
          reference,
          tight: reference > 0 && gap.distance < reference - 0.1,
          overlapping: false,
          targetKind: isWall ? 'wall' : 'item',
          targetId: other.id,
        };
      }
    }
  }
  return best;
}
