import { Item, Point, Project, modelOf } from './model';
import { localPoint, ordinaryEquipment } from './equipmentFacing';
import { footprint, contains, supportFor, baseHeight } from './spatial';
import { wallProfiles } from './wallJoints';
import { isEditable } from './editorInteraction';
import { planningEditable } from './planning';
import { polygonCoverage } from './polygonArea';
import { siteOutline } from './site';

export type WallFace={wallId:string;side:1|-1;a:Point;b:Point;normal:Point;label:string};
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
const sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
const EPS=.01; // millimetres, only numerical contact tolerance
export function wallFaces(p:Project):WallFace[]{
  const profiles=wallProfiles(p);
  return p.items.filter(w=>w.kind==='wall'&&!w.hidden).flatMap(w=>([-1,1] as const).map(side=>{
    const profile=profiles.get(w.id)!,a=localPoint(w,profile[side===1?1:0]),b=localPoint(w,profile[side===1?2:3]),r=w.rotation*Math.PI/180;
    return {wallId:w.id,side,a,b,normal:{x:-Math.sin(r)*side,y:Math.cos(r)*side},label:`${w.name} · ${side===1?'B 面（局部 +Y）':'A 面（局部 −Y）'}`};
  }));
}
export function clearanceBlocked(p:Project,i:Item):string|null {
  if(!ordinaryEquipment(i))return '仅支持单个普通设备；门窗请使用所属墙体定位';
  if(modelOf(i)==='round-table')return '当前精确离墙定位仅支持矩形占地设备，圆桌暂不支持';
  if(!isEditable(i,p))return '对象已锁定、隐藏或位于受保护范围外';
  if(p.groups?.some(g=>g.members.includes(i.id)))return '此设备属于组合，请先明确解组后定位';
  if(i.supportId||supportFor(p,i)||p.items.some(v=>v.id!==i.id&&(v.supportId===i.id||supportFor(p,v)?.id===i.id)))return '此设备存在承托关联，本轮不支持关联移动';
  return null;
}
export function measureWall(p:Project,i:Item,face:WallFace){
  if(!ordinaryEquipment(i)||modelOf(i)==='round-table')throw Error('当前仅支持矩形占地设备的精确墙面净距');
  const span=sub(face.b,face.a),len=Math.hypot(span.x,span.y),t={x:span.x/len,y:span.y/len};
  const points=footprint(i),projection=points.map(q=>dot(sub(q,face.a),t));
  // Conservative finite-segment domain: the whole footprint must project onto this face.
  if(len<EPS||Math.min(...projection)<-EPS||Math.max(...projection)>len+EPS)throw Error('墙端或无完整投影：设备轮廓须完整对应所选墙面，请切换墙面');
  const distances=points.map(q=>dot(sub(q,face.a),face.normal)),distance=Math.min(...distances);
  if(distance < -EPS)throw Error('设备穿入所选墙面或位于该面的另一侧，请切换墙面或先移出墙体');
  const wall=p.items.find(w=>w.id===face.wallId)!;
  const wa=wall.rotation*Math.PI/180,axis={x:Math.cos(wa),y:Math.sin(wa)},c={x:wall.x+wall.w/2,y:wall.y+wall.d/2};
  const offsets=points.map(q=>dot(sub(q,c),axis)+wall.w/2);
  if(p.items.some(o=>o.wallId===wall.id&&Math.min(Math.max(...offsets),(o.offset??0)+o.w)>Math.max(Math.min(...offsets),o.offset??0)+EPS))throw Error('投影经过门窗开口，当前不作为连续实体墙面参考');
  const support=points.filter((_,n)=>distances[n]<=distance+EPS);
  const edgePoint={x:support.reduce((sum,q)=>sum+q.x,0)/support.length,y:support.reduce((sum,q)=>sum+q.y,0)/support.length};
  return {distance:Math.max(0,distance),edge:support,edgePoint,wallPoint:{x:edgePoint.x-face.normal.x*distance,y:edgePoint.y-face.normal.y*distance}};
}
export function parseClearance(input:string):number {
  if(!input.trim()||!/^\+?(\d+(\.\d*)?|\.\d+)$/.test(input.trim()))throw Error('请输入大于或等于 0 的毫米数值');
  const n=Number(input);if(!Number.isFinite(n)||n<0||n>1000000)throw Error('净距须在 0–1000000 mm 之间');return n;
}
export function placeAtClearance(p:Project,i:Item,face:WallFace,target:number):Item {
  const blocked=clearanceBlocked(p,i);if(blocked)throw Error(blocked);
  if(!Number.isFinite(target)||target<0||target>1000000)throw Error('净距须在 0–1000000 mm 之间');
  // Resolve again from the project so callers cannot pass a stale or invented face.
  const actual=wallFaces(p).find(f=>f.wallId===face.wallId&&f.side===face.side);if(!actual)throw Error('参考墙面已不可用');
  const m=measureWall(p,i,actual),delta=target-m.distance;
  const next={...i,x:i.x+actual.normal.x*delta,y:i.y+actual.normal.y*delta};
  if(!planningEditable(next,p))throw Error('移动后超出当前受保护规划范围');
  if(!contains(siteOutline(p),footprint(next)))throw Error('移动后超出场地轮廓');
  const candidate={...p,items:p.items.map(v=>v.id===i.id?next:v)};
  if(supportFor(candidate,next)||p.items.some(v=>v.id!==i.id&&supportFor(candidate,v)?.id===i.id))throw Error('移动后将产生承托关联，请使用承托设置');
  const profiles=wallProfiles(p),shape=footprint(next);
  for(const other of p.items){
    if(other.id===i.id||['zone','text','dimension','leader','utility'].includes(other.kind))continue;
    if(Math.min(baseHeight(p,other)+other.h,baseHeight(p,i)+i.h)-Math.max(baseHeight(p,other),baseHeight(p,i))<EPS)continue;
    const boundary=other.kind==='wall'?(profiles.get(other.id)?.map(q=>localPoint(other,q))??footprint(other)):footprint(other);
    if(polygonCoverage(shape,[boundary]).union>1)throw Error(`目标位置与“${other.name}”实际穿透，请调整净距`);
  }
  measureWall(p,next,actual);
  return next;
}
