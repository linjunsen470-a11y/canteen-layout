import { useEffect, useMemo, useState } from 'react';
import * as T from 'three';
import { useStore } from './store';
import { useImageAsset } from './imageAssets';
import { usePlanning } from './planning';
export default function SiteOverlay3D(){
 const p=useStore(s=>s.project),u=p.underlay,{url}=useImageAsset(u?.assetId),{activeId}=usePlanning();
 const [texture,S]=useState<T.Texture|null>(null);
 useEffect(()=>{if(!url){S(null);return}let live=true;const t=new T.TextureLoader().load(url,()=>{if(live){t.colorSpace=T.SRGBColorSpace;S(t)}});return()=>{live=false;t.dispose();S(null)}},[url]);
 const area=p.planningAreas?.find(a=>a.id===activeId),key=JSON.stringify(area?.outline??[]);
 const geometry=useMemo(()=>area?new T.ShapeGeometry(new T.Shape(area.outline.map(v=>new T.Vector2(v.x/1000,-v.y/1000)))):null,[key]);
 useEffect(()=>()=>{geometry?.dispose()},[geometry]);
 return <>{u&&!u.hidden&&texture&&<group position={[u.x/1000,.001,u.y/1000]} rotation={[0,-u.rotation*Math.PI/180,0]}><mesh renderOrder={1} name={`site-underlay:${u.assetId}`} position={[u.pixelWidth*u.mmPerPixel/2000,0,u.pixelHeight*u.mmPerPixel/2000]} rotation={[-Math.PI/2,0,0]} raycast={()=>{}}><planeGeometry args={[u.pixelWidth*u.mmPerPixel/1000,u.pixelHeight*u.mmPerPixel/1000]}/><meshBasicMaterial map={texture} transparent opacity={u.opacity} depthWrite={false} side={T.DoubleSide}/></mesh></group>}{geometry&&area&&<group rotation={[-Math.PI/2,0,0]} position={[0,.008,0]}><mesh renderOrder={3} geometry={geometry} raycast={()=>{}}><meshBasicMaterial color={area.color} transparent opacity={.13} depthWrite={false} side={T.DoubleSide}/></mesh><lineSegments raycast={()=>{}}><edgesGeometry args={[geometry]}/><lineBasicMaterial color={area.color}/></lineSegments></group>}</>;
}
