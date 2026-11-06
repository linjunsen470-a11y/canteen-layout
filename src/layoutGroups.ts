import { Item, Project, Point } from './model';
import { isEditable } from './editorInteraction';
import { isAttachedOpening } from './structure';
import { bounds } from './spatial';
import { normalizeRotation } from './rotation';
export function groupSelection(p:Project,id:string,ids:string[],shift=false,individual=false){
 const members=individual?[id]:p.groups?.find(g=>g.members.includes(id))?.members??[id];
 if(shift)return ids.includes(id)?ids.filter(v=>!members.includes(v)):[...new Set([...ids,...members])];
 return individual?[id]:ids.includes(id)?ids:members;
}
export function movableSelection(p:Project,ids:string[]){
 for(const g of p.groups??[])if(g.members.every(id=>ids.includes(id))&&g.members.some(id=>!isEditable(p.items.find(i=>i.id===id)!,p)))throw Error('组合包含锁定、隐藏或范围外成员；请解锁、切回整场地，或双击单件调整');
 if(p.items.some(i=>i.wallId&&ids.includes(i.wallId)&&!isEditable(i,p)))throw Error('选中墙体包含锁定、隐藏或范围外门窗，请先处理关联成员');
 return p.items.filter(i=>ids.includes(i.id)&&isEditable(i,p)&&!(i.wallId&&ids.includes(i.wallId)));
}
export function rotateChanges(items:Item[],pivot:Point,degrees:number){if(items.some(isAttachedOpening))throw Error('整体旋转贴墙门窗时，请同时选中所属墙体');const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return items.map(i=>{const x=i.x+i.w/2-pivot.x,y=i.y+i.d/2-pivot.y;return{id:i.id,patch:{x:pivot.x+x*c-y*s-i.w/2,y:pivot.y+x*s+y*c-i.d/2,rotation:normalizeRotation(i.rotation+degrees)}}})}
export function selectionUnits(p:Project,ids:string[]){
 const items=movableSelection(p,ids),used=new Set<string>(),units:Item[][]=[];
 for(const i of items){if(used.has(i.id)||isAttachedOpening(i))continue;const g=p.groups?.find(g=>g.members.includes(i.id)&&g.members.every(id=>ids.includes(id))),members=g?items.filter(v=>g.members.includes(v.id)):[i];members.forEach(v=>used.add(v.id));units.push(members)}return units;
}
export function alignChanges(p:Project,ids:string[],distribute=false){const units=selectionUnits(p,ids).sort((a,b)=>bounds(a).x-bounds(b).x);if(units.length<(distribute?3:2))throw Error(distribute?'请选择至少三个对象或组合':'请选择至少两个对象或组合');const boxes=units.map(bounds),left=boxes[0].x,gap=(boxes.at(-1)!.x+boxes.at(-1)!.w-left-boxes.reduce((n,b)=>n+b.w,0))/(boxes.length-1);let x=left;return units.flatMap((items,n)=>{const dx=(distribute?x:left)-boxes[n].x;x+=boxes[n].w+gap;return items.map(i=>({id:i.id,patch:{x:i.x+dx}}))})}
export function seatSummary(p:Project){
 const handled=new Set<string>();let seats=0,unknown=0;
 for(const g of p.groups??[])if(g.seats!==undefined){const members=p.items.filter(i=>g.members.includes(i.id));if(members.every(i=>!i.hidden))seats+=g.seats;else if(members.some(i=>!i.hidden))unknown++;g.members.forEach(id=>handled.add(id))}
 for(const i of p.items)if(!i.hidden&&!handled.has(i.id)){if(i.seats!==undefined)seats+=i.seats;else if(i.kind==='chair')unknown++}return{seats,unknown};
}
