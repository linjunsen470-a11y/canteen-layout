import * as T from 'three';
import { Item, Point, Project } from './model';
import { baseHeight, footprint } from './spatial';
export type SceneFrame={min:[number,number,number];max:[number,number,number];label:string};
export function framePoints(points:Point[],height:number,label:string):SceneFrame {
  if(!points.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw Error('当前区域无法定位');
  return {min:[Math.min(...points.map(p=>p.x))/1000,0,Math.min(...points.map(p=>p.y))/1000],max:[Math.max(...points.map(p=>p.x))/1000,Math.max(.05,height/1000),Math.max(...points.map(p=>p.y))/1000],label};
}
export function frameItems(project:Project,items:Item[],label='选中对象'){
  return framePoints(items.flatMap(footprint),Math.max(...items.map(i=>baseHeight(project,i)+i.h)),label);
}
export function frameDistance(frame:SceneFrame,direction:T.Vector3,fov:number,aspect:number){
  const box=new T.Box3(new T.Vector3(...frame.min),new T.Vector3(...frame.max)),center=box.getCenter(new T.Vector3()),back=direction.clone().normalize();
  const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),back).normalize(),up=new T.Vector3().crossVectors(back,right),tan=Math.tan(fov*Math.PI/360);let distance=.1;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const v=new T.Vector3(x,y,z).sub(center);distance=Math.max(distance,v.dot(back)+Math.abs(v.dot(right))/(tan*Math.max(.05,aspect)),v.dot(back)+Math.abs(v.dot(up))/tan)}
  return {center,distance:distance*1.12};
}
