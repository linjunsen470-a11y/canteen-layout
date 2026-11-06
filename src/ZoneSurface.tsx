import { useEffect, useMemo } from 'react';
import * as T from 'three';
import { usePlanning, insidePlanning } from './planning';
import { Item, Project, Point } from './model';
import { siteOutline } from './site';
import { zoneCorners } from './zones';
function triangles(points:Point[]){const p=points.map(v=>new T.Vector2(v.x,v.y));return T.ShapeUtils.triangulateShape(p,[]).map(indices=>indices.map(i=>points[i]));}
function clip(points:Point[],triangle:Point[]){
 const area=triangle.reduce((n,a,i)=>{const b=triangle[(i+1)%3];return n+a.x*b.y-b.x*a.y},0),sign=area>0?1:-1;
 for(let k=0;k<3;k++){const a=triangle[k],b=triangle[(k+1)%3],side=(p:Point)=>sign*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)),next:Point[]=[];
  for(let j=0;j<points.length;j++){const p=points[j],q=points[(j+1)%points.length],u=side(p),v=side(q);if(u>=0)next.push(p);if((u>=0)!==(v>=0)){const t=u/(u-v);next.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t})}}points=next;
 }return points;
}
export default function ZoneSurface({project,item}:{project:Project;item:Item}){
 const planning=usePlanning();
 const key=JSON.stringify([siteOutline(project),zoneCorners(item)]);
 const geometry=useMemo(()=>{const positions:number[]=[];for(const a of triangles(siteOutline(project)))for(const b of triangles(zoneCorners(item))){const p=clip(a,b);for(let i=1;i<p.length-1;i++)for(const v of [p[0],p[i],p[i+1]])positions.push(v.x/1000,.004,v.y/1000)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g},[key]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh renderOrder={2} name={`zone:${item.id}`} geometry={geometry} raycast={()=>{}}><meshBasicMaterial color={item.color} transparent opacity={planning.dim&&!insidePlanning(item,project)? .066 : .22} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} side={T.DoubleSide}/></mesh>;
}
