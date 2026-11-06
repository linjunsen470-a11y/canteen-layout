import { Item, Point, Project } from './model';
import { canvasDirection } from './equipmentFacing';
import { projectPoint } from './spatial';
import { measureWall, WallFace, wallFaces } from './wallClearance';

export type WallFaceChoice={face:WallFace;label:string;distance:number|null;reason:string|null};
export function wallFaceChoices(p:Project,i:Item):WallFaceChoice[]{
  return wallFaces(p).map(face=>{
    const wall=p.items.find(w=>w.id===face.wallId)!;
    const label=`${wall.name} · 朝${canvasDirection(face.normal)}（${face.side===1?'B':'A'} 面）`;
    try{return {face,label,distance:measureWall(p,i,face).distance,reason:null}}
    catch(e){return {face,label,distance:null,reason:(e as Error).message}}
  });
}
export function recommendedFaces(choices:WallFaceChoice[]){
  return choices.filter(c=>c.distance!==null).sort((a,b)=>a.distance!-b.distance!||a.face.wallId.localeCompare(b.face.wallId)||a.face.side-b.face.side).slice(0,3);
}
// A click picks only a uniquely applicable face near the pointer. Ambiguity is explicit.
// Thin walls may have overlapping hit regions; the device-facing side is unambiguous
// only when the geometry can measure that side. Never fall back to a distant wall.
export function faceAtPoint(choices:WallFaceChoice[],point:Point,tolerance:number,wallId?:string):WallFaceChoice {
  const near=choices.filter(c=>!wallId||c.face.wallId===wallId).filter(c=>{
    const q=projectPoint(point,c.face.a,c.face.b);return Math.hypot(point.x-q.x,point.y-q.y)<=tolerance;
  });
  const usable=near.filter(c=>c.distance!==null);
  if(usable.length===1)return usable[0];
  if(usable.length>1)throw Error('此处有多个可用墙面，请在推荐项或墙面列表中明确选择');
  if(near.length)throw Error(near[0].reason??'此墙面当前不适用，请查看墙面列表');
  throw Error('请点击靠近设备的实体墙面；空白处不会更换参考墙');
}
