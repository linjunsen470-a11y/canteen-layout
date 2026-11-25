import { isVisible } from './editorInteraction';
import { Item, Point, Project, modelOf } from './model';
import { bounds, edges, footprint, length, projectPoint, subtract } from './spatial';
import { wallPoint } from './structure';
export type SnapGuide={a:Point;b:Point;label:string};

type Box = { x: number; y: number; w: number; h: number };
const ROUND_MODELS = new Set(['round-table', 'marble-round-table', 'pendant-lamp', 'chandelier', 'potted-plant']);

function fastItemBounds(i: Item): Box {
  if (i.polygon || ROUND_MODELS.has(modelOf(i))) return bounds([i]);
  const a = i.rotation * Math.PI / 180;
  const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const w = i.w * c + i.d * s, h = i.w * s + i.d * c;
  return { x: i.x + i.w / 2 - w / 2, y: i.y + i.d / 2 - h / 2, w, h };
}

export function snapTranslation(p:Project,origins:Item[],delta:Point,tolerance:number):{delta:Point;guides:SnapGuide[]}{
 const ids=new Set(origins.map(i=>i.id)),targets=p.items.filter(i=>isVisible(i,p)&&!ids.has(i.id)&&!(i.wallId&&ids.has(i.wallId))&&!['zone','dimension','text','leader','utility'].includes(i.kind));
 if(!origins.length||!targets.length)return{delta,guides:[]};
 const moving=origins.map(i=>({...i,x:i.x+delta.x,y:i.y+delta.y}));
 const movingData=moving.map(item=>{
  const fp=footprint(item), b=fastItemBounds(item);
  return { item, fp, center: { x: item.x + item.w / 2, y: item.y + item.d / 2 }, box: b };
 });
 let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
 for (const m of movingData) {
  if (m.box.x < minX) minX = m.box.x;
  if (m.box.y < minY) minY = m.box.y;
  if (m.box.x + m.box.w > maxX) maxX = m.box.x + m.box.w;
  if (m.box.y + m.box.h > maxY) maxY = m.box.y + m.box.h;
 }
 const box: Box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
 const targetBoxes = targets.map(fastItemBounds);

 let edgeSnap:{offset:Point;guide:SnapGuide;distance:number}|undefined;
 for (let ti = 0; ti < targets.length; ti++) {
  const tb = targetBoxes[ti];
  if (tb.x > maxX + tolerance || tb.x + tb.w < minX - tolerance || tb.y > maxY + tolerance || tb.y + tb.h < minY - tolerance) continue;
  const target = targets[ti];
  const targetEdges = edges(footprint(target));
  for (const m of movingData) {
   if (tb.x > m.box.x + m.box.w + tolerance || tb.x + tb.w < m.box.x - tolerance || tb.y > m.box.y + m.box.h + tolerance || tb.y + tb.h < m.box.y - tolerance) continue;
   for (const v of m.fp) {
    for (const edge of targetEdges) {
     const q = projectPoint(v, edge.a, edge.b), offset = subtract(q, v), distance = length(offset);
     if (distance < tolerance && (!edgeSnap || distance < edgeSnap.distance)) {
      edgeSnap = { offset, distance, guide: { a: edge.a, b: edge.b, label: target.kind === 'wall' ? '墙边' : '物体边缘' } };
     }
    }
   }
  }
 }
 for (let ti = 0; ti < targets.length; ti++) {
  const tb = targetBoxes[ti];
  if (tb.x > maxX + tolerance || tb.x + tb.w < minX - tolerance || tb.y > maxY + tolerance || tb.y + tb.h < minY - tolerance) continue;
  const target = targets[ti];
  const points = target.kind === 'wall' ? [wallPoint(target, 0), wallPoint(target, target.w)] : [{ x: target.x + target.w / 2, y: target.y + target.d / 2 }];
  for (const m of movingData) {
   if (tb.x > m.box.x + m.box.w + tolerance || tb.x + tb.w < m.box.x - tolerance || tb.y > m.box.y + m.box.h + tolerance || tb.y + tb.h < m.box.y - tolerance) continue;
   for (const q of points) {
    for (const v of m.fp) {
     const offset = subtract(q, v), distance = length(offset);
     if (distance < tolerance && (!edgeSnap || distance < edgeSnap.distance)) {
      edgeSnap = { offset, distance, guide: { a: q, b: v, label: target.kind === 'wall' ? '墙端点' : '物体中心' } };
     }
    }
    const offset = subtract(q, m.center), distance = length(offset);
    if (distance < tolerance && (!edgeSnap || distance < edgeSnap.distance)) {
     edgeSnap = { offset, distance, guide: { a: q, b: m.center, label: target.kind === 'wall' ? '墙端点' : '物体中心' } };
    }
   }
  }
 }
 if(edgeSnap)return{delta:{x:delta.x+edgeSnap.offset.x,y:delta.y+edgeSnap.offset.y},guides:[edgeSnap.guide]};
 let sx:{d:number;x:number;other:Box}|undefined,sy:{d:number;y:number;other:Box}|undefined;
 const bx0 = box.x, bx1 = box.x + box.w / 2, bx2 = box.x + box.w;
 const by0 = box.y, by1 = box.y + box.h / 2, by2 = box.y + box.h;
 for (let ti = 0; ti < targets.length; ti++) {
  const other = targetBoxes[ti];
  const ox0 = other.x, ox1 = other.x + other.w / 2, ox2 = other.x + other.w;
  for (const x of [bx0, bx1, bx2]) {
   for (const tx of [ox0, ox1, ox2]) {
    const d = tx - x;
    if (Math.abs(d) < tolerance && (!sx || Math.abs(d) < Math.abs(sx.d))) sx = { d, x: tx, other };
   }
  }
  const oy0 = other.y, oy1 = other.y + other.h / 2, oy2 = other.y + other.h;
  for (const y of [by0, by1, by2]) {
   for (const ty of [oy0, oy1, oy2]) {
    const d = ty - y;
    if (Math.abs(d) < tolerance && (!sy || Math.abs(d) < Math.abs(sy.d))) sy = { d, y: ty, other };
   }
  }
 }
 const guides:SnapGuide[]=[];if(sx)guides.push({a:{x:sx.x,y:Math.min(box.y,sx.other.y)},b:{x:sx.x,y:Math.max(box.y+box.h,sx.other.y+sx.other.h)},label:'边缘 / 中心'});if(sy)guides.push({a:{x:Math.min(box.x,sy.other.x),y:sy.y},b:{x:Math.max(box.x+box.w,sy.other.x+sy.other.w),y:sy.y},label:'边缘 / 中心'});
 return{delta:{x:delta.x+(sx?.d??0),y:delta.y+(sy?.d??0)},guides};
}
