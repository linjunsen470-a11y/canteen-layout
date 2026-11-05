import { useEffect, RefObject } from 'react';
import { Box3, Object3D, PerspectiveCamera, Vector2, Vector3 } from 'three';
import { useStore } from './store';
import { useThree } from '@react-three/fiber';
// Render immediately before copying pixels; no permanent preserveDrawingBuffer cost.
export default function SceneCapture({capture}:{capture:RefObject<(()=>string)|null>}){
 const {gl,scene,camera,invalidate}=useThree();
 useEffect(()=>{capture.current=()=>{
  const u=useStore.getState().project.underlay;if(u&&!u.hidden&&scene.getObjectByName('site-floor')&&!scene.getObjectByName(`site-underlay:${u.assetId}`))throw Error('底图未加载完成或资产缺失，请先恢复底图后截图');
  const highlights:Object3D[]=[],bounds=new Box3();
  scene.updateMatrixWorld(true);
  scene.traverse(o=>{if(o.name==='selection-highlight'&&o.visible){highlights.push(o);o.visible=false}if(o.visible&&(o.name.startsWith('item:')||o.name==='site-floor'))bounds.expandByObject(o)});
  const size=gl.getSize(new Vector2()),ratio=gl.getPixelRatio(),shot=camera.clone() as PerspectiveCamera;
  shot.aspect=1.6;
  if(!bounds.isEmpty()){
   const center=bounds.getCenter(new Vector3()),right=new Vector3(1,0,0).applyQuaternion(shot.quaternion),up=new Vector3(0,1,0).applyQuaternion(shot.quaternion),back=new Vector3(0,0,1).applyQuaternion(shot.quaternion),tan=Math.tan(shot.fov*Math.PI/360);let distance=.1;
   for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const v=new Vector3(x,y,z).sub(center);distance=Math.max(distance,v.dot(back)+Math.abs(v.dot(right))/(tan*shot.aspect),v.dot(back)+Math.abs(v.dot(up))/tan)}
   shot.position.copy(center).addScaledVector(back,distance*1.12);shot.near=.01;shot.far=Math.max(300,distance*5);
  }
  shot.updateProjectionMatrix();shot.updateMatrixWorld(true);
  try{gl.setPixelRatio(1);gl.setSize(1600,1000,false);gl.render(scene,shot);return gl.domElement.toDataURL('image/png')}finally{gl.setPixelRatio(ratio);gl.setSize(size.x,size.y,false);highlights.forEach(o=>{o.visible=true});invalidate()}
 };return()=>{capture.current=null}},[gl,scene,camera,capture,invalidate]);
 return null;
}
