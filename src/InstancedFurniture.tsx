import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as T from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Item } from './model';
import { createFurniture, disposeFurniture, fadeFurniture } from './furniture';
export type FurnitureHandlers={onPointerDown:(e:ThreeEvent<PointerEvent>,item:Item)=>void;onPointerMove:(e:ThreeEvent<PointerEvent>)=>void;onPointerUp:(e:ThreeEvent<PointerEvent>)=>void;onDoubleClick:(e:ThreeEvent<MouseEvent>,item:Item)=>void};
type Part={geometry:T.BufferGeometry;material:T.Material|T.Material[];matrix:T.Matrix4;castShadow:boolean;receiveShadow:boolean};
function Instances({part,items,handlers}:{part:Part;items:Item[];handlers:FurnitureHandlers}){
 const ref=useRef<T.InstancedMesh>(null);
 useEffect(()=>{const mesh=ref.current!;return()=>{mesh.dispose()}},[]);
 useLayoutEffect(()=>{const mesh=ref.current!,world=new T.Matrix4(),rotation=new T.Quaternion(),position=new T.Vector3(),scale=new T.Vector3(1,1,1),axis=new T.Vector3(0,1,0);
  items.forEach((i,n)=>{position.set((i.x+i.w/2)/1000,(i.sill??0)/1000,(i.y+i.d/2)/1000);rotation.setFromAxisAngle(axis,-i.rotation*Math.PI/180);world.compose(position,rotation,scale).multiply(part.matrix);mesh.setMatrixAt(n,world)});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
 },[items,part]);
 return <instancedMesh name="item:instances" ref={ref} args={[part.geometry,part.material,items.length]} castShadow={part.castShadow} receiveShadow={part.receiveShadow} onDoubleClick={e=>{if(e.instanceId!==undefined)handlers.onDoubleClick(e,items[e.instanceId])}} onPointerDown={e=>{if(e.instanceId!==undefined)handlers.onPointerDown(e,items[e.instanceId])}} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp} dispose={null}/>;
}
// Identical local specifications share each component mesh in one instanced draw.
export default function InstancedFurniture({items,spec,handlers,faded}:{items:Item[];spec:string;handlers:FurnitureHandlers;faded:boolean}){
 const model=useMemo(()=>{const model=createFurniture(items[0]);if(faded)fadeFurniture(model);return model},[spec,faded]);
 const parts=useMemo(()=>{model.updateMatrixWorld(true);const result:Part[]=[];model.traverse(o=>{if(o instanceof T.Mesh)result.push({geometry:o.geometry,material:o.material,matrix:o.matrixWorld.clone(),castShadow:o.castShadow,receiveShadow:o.receiveShadow})});return result},[model]);
 useEffect(()=>()=>disposeFurniture(model),[model]);
 return <>{parts.map((part,n)=><Instances key={`${n}:${items.length}`} part={part} items={items} handlers={handlers}/>)}</>;
}
