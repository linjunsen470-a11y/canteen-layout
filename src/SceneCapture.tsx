import { useEffect, RefObject } from 'react';
import { Object3D, PerspectiveCamera, Vector2 } from 'three';
import { useStore } from './store';
import { useThree } from '@react-three/fiber';
// Render immediately before copying pixels; no permanent preserveDrawingBuffer cost.
export default function SceneCapture({capture}:{capture:RefObject<(()=>string)|null>}){
 const {gl,scene,camera,invalidate}=useThree();
 useEffect(()=>{capture.current=()=>{
  const u=useStore.getState().project.underlay;if(u&&!u.hidden&&scene.getObjectByName('site-floor')&&!scene.getObjectByName(`site-underlay:${u.assetId}`))throw Error('底图未加载完成或资产缺失，请先恢复底图后截图');
  const highlights:Object3D[]=[];
  scene.updateMatrixWorld(true);
  scene.traverse(o=>{if(o.name==='selection-highlight'&&o.visible){highlights.push(o);o.visible=false}});
  const size=gl.getSize(new Vector2()),ratio=gl.getPixelRatio(),shot=camera.clone() as PerspectiveCamera;
  const scale=Math.min(1600/Math.max(1,size.x),2000/Math.max(1,size.y)),width=Math.max(1,Math.round(size.x*scale)),height=Math.max(1,Math.round(size.y*scale));
  // Export the view the user framed, including regional zoom and panning.
  shot.aspect=width/height;
  shot.updateProjectionMatrix();shot.updateMatrixWorld(true);
  try{gl.setPixelRatio(1);gl.setSize(width,height,false);gl.render(scene,shot);return gl.domElement.toDataURL('image/png')}finally{gl.setPixelRatio(ratio);gl.setSize(size.x,size.y,false);highlights.forEach(o=>{o.visible=true});invalidate()}
 };return()=>{capture.current=null}},[gl,scene,camera,capture,invalidate]);
 return null;
}
