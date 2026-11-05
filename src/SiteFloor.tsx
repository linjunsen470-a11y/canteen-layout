import { useEffect, useMemo } from 'react';
import * as T from 'three';
import { Project } from './model';
import { floorColors, siteOutline } from './site';
import ZoneSurface from './ZoneSurface';
import { useWorkspace } from './workspace';

export default function SiteFloor({project,grid}:{project:Project;grid:boolean}) {
  const gridSize=useWorkspace(s=>s.gridSize);
  const key=JSON.stringify(siteOutline(project));
  const geometry=useMemo(()=>{const points=JSON.parse(key) as {x:number;y:number}[];const shape=new T.Shape(points.map(p=>new T.Vector2(p.x/1000,-p.y/1000)));return new T.ShapeGeometry(shape)},[key]);
  const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle=floorColors[0];ctx.fillRect(0,0,256,256);ctx.fillStyle=floorColors[1];ctx.fillRect(128,0,128,128);ctx.fillRect(0,128,128,128);
    if(grid){ctx.strokeStyle='#aebbad';ctx.lineWidth=1;for(let v=0;v<=256;v+=gridSize/2000*256){ctx.beginPath();ctx.moveTo(v,0);ctx.lineTo(v,256);ctx.moveTo(0,v);ctx.lineTo(256,v);ctx.stroke()}}
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(.5,.5);map.anisotropy=4;return map;
  },[grid,gridSize]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);useEffect(()=>()=>texture.dispose(),[texture]);
  return <group>
    <mesh name="site-floor" geometry={geometry} rotation={[-Math.PI/2,0,0]} receiveShadow><meshStandardMaterial color="#bdc7b6" map={texture} roughness={.88} side={T.DoubleSide}/></mesh>
    <lineSegments rotation={[-Math.PI/2,0,0]} position={[0,.007,0]}><edgesGeometry args={[geometry]}/><lineBasicMaterial color="#91a08b"/></lineSegments>
    {project.items.filter(i=>i.kind==='zone'&&!i.hidden).map(i=><ZoneSurface key={i.id} project={project} item={i}/>)}
  </group>;
}
