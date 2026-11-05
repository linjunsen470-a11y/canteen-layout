import { groupSelection, movableSelection } from './layoutGroups';
import { baseHeight } from './spatial';
import { forwardRef, useImperativeHandle, memo, useMemo, useEffect, useRef, useState, ComponentRef } from 'react';
import { Canvas, useThree, ThreeEvent } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as T from 'three';
import { useStore } from './store';
import { isEditable, isVisible } from './editorInteraction';
import { useWorkspace } from './workspace';
import { zoneCorners } from './zones';
import { wallProfiles } from './wallJoints';
import { Item, Point, modelOf } from './model';
import { createFurniture, disposeFurniture, studioEnvironment, fadeFurniture } from './furniture';
import SiteFloor from './SiteFloor';
import SiteOverlay3D from './SiteOverlay3D';
import { usePlanning, insidePlanning } from './planning';
import { isAnnotation } from './annotations';
import SceneCapture from './SceneCapture';
import InstancedFurniture from './InstancedFurniture';
import { dragOpening, isAttachedOpening } from './structure';

function SelectionBox({item}:{item:Item}){
  const geometry=useMemo(()=>{const box=new T.BoxGeometry(item.w/1000+.02,Math.max(.02,item.h/1000)+.02,item.d/1000+.02);const edges=new T.EdgesGeometry(box);box.dispose();return edges},[item.w,item.d,item.h]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <lineSegments name="selection-highlight" geometry={geometry} position={[0,item.h/2000,0]} renderOrder={10} raycast={()=>{}}><lineBasicMaterial color="#e09b27" depthTest={false}/></lineSegments>;
}
function ZoneHighlight({item}:{item:Item}){
 const key=JSON.stringify(zoneCorners(item));const geometry=useMemo(()=>{const points=zoneCorners(item);return new T.BufferGeometry().setFromPoints([...points,points[0]].map(p=>new T.Vector3(p.x/1000,.015,p.y/1000)))},[key]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);return <lineLoop name="selection-highlight" geometry={geometry} raycast={()=>{}}><lineBasicMaterial color="#e09b27" depthTest={false}/></lineLoop>;
}
type DragHandlers={onPointerDown:(e:ThreeEvent<PointerEvent>,item:Item)=>void;onPointerMove:(e:ThreeEvent<PointerEvent>)=>void;onPointerUp:(e:ThreeEvent<PointerEvent>)=>void;onDoubleClick:(e:ThreeEvent<MouseEvent>,item:Item)=>void};

const Furniture=memo(function Furniture({item,selected,openings=[],handlers,faded,profile}:{item:Item;selected:boolean;openings?:Item[];handlers:DragHandlers;faded:boolean;profile?:Point[]}) {
  const host=useRef<T.Group>(null);
  const variant=modelOf(item);const openingKey=JSON.stringify(openings.map(o=>[o.offset,o.sill,o.w,o.h]));
  useEffect(()=>{const model=createFurniture(item,openings,profile);if(faded)fadeFurniture(model);const group=host.current!;group.add(model);return()=>{group.remove(model);disposeFurniture(model)}},[variant,item.w,item.d,item.h,item.color,item.flipped,item.pointType,item.verification,openingKey,faded,JSON.stringify(profile)]);
  return <group name={`item:${item.id}`} position={[(item.x+item.w/2)/1000,(item.sill??0)/1000,(item.y+item.d/2)/1000]} rotation={[0,-item.rotation*Math.PI/180,0]} ref={host} onDoubleClick={e=>handlers.onDoubleClick(e,item)} onPointerDown={e=>handlers.onPointerDown(e,item)} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp} >{selected&&<SelectionBox item={item}/>}</group>;
});
function Environment({center,extent}:{center:[number,number,number];extent:number}){
  const {gl,scene}=useThree();
  useEffect(()=>{const target=studioEnvironment(gl);scene.environment=target.texture;scene.environmentIntensity=.6;return()=>{scene.environment=null;target.dispose()}},[gl,scene]);
  const target=useRef(new T.Object3D());target.current.position.set(...center);
  return <><primitive object={target.current}/><hemisphereLight args={['#eaf3ff','#b8aa91',.65]}/><directionalLight target={target.current} position={[center[0]+extent*.4,extent*1.4,center[2]+extent*.6]} intensity={2.5} color="#fff0d9" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-far={extent*5+10} shadow-normalBias={.005}/><directionalLight position={[-10,7,-4]} intensity={1.1} color="#dbe9ff"/></>;
}
function CameraRig({focus,reset,dragging,pose}:{focus:Item|undefined;reset:number;dragging:boolean;pose:'top'|'oblique'}) {
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const {camera,size}=useThree();const width=useStore(s=>s.project.width),height=useStore(s=>s.project.height);
  const framed=useRef('');
  useEffect(()=>{if(dragging||!controls.current||size.width<1||size.height<1)return;
    const center=focus?new T.Vector3((focus.x+focus.w/2)/1000,focus.h/2100,(focus.y+focus.d/2)/1000):new T.Vector3(width/2000,0,height/2000);
    const key=[focus?.id??'all',focus?.w,focus?.d,focus?.h,reset,pose,width,height].join(':');
    if(framed.current===key){if(focus){const delta=center.clone().sub(controls.current.target);camera.position.add(delta);controls.current.target.copy(center);controls.current.update()}return}
    framed.current=key;
    const extent=focus?Math.max(focus.w,focus.d,focus.h)/1000:Math.max(width,height)/1000;
    const structural=focus?.kind==='wall'||focus?.kind==='partition';
    const aspect=size.width/size.height;const distance=extent*(structural?1.6:focus?2.5:1.35)/Math.min(1,aspect);
    const direction=pose==='top'?new T.Vector3(0,1,.001):structural?new T.Vector3(.5,.7,1.5).applyAxisAngle(new T.Vector3(0,1,0),-focus.rotation*Math.PI/180):new T.Vector3(1,.95,1.3);
    camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));camera.near=.01;camera.far=Math.max(300,distance*5);camera.updateProjectionMatrix();controls.current.target.copy(center);controls.current.update();
  },[focus?.id,focus?.x,focus?.y,focus?.w,focus?.d,focus?.h,reset,pose,width,height,size.width,size.height,dragging]);
  return <OrbitControls ref={controls} enabled={!dragging} makeDefault minDistance={.1} maxPolarAngle={Math.PI/2-.03}/>;
}
export type SceneHandle={capturePNG:()=>string};
export default forwardRef<SceneHandle,{active?:boolean;snap?:boolean}>(function Scene3D({active=true,snap=true},ref){
  const project=useStore(s=>s.project),selected=useStore(s=>s.selected),ids=useStore(s=>s.selectedIds),focusRequest=useStore(s=>s.focusRequest);
  const prefs=useWorkspace(),moveMode=prefs.move3D,planning=usePlanning();
  const faded=(i:Item)=>planning.dim&&!insidePlanning(i,project);
  const [closeup,setCloseup]=useState(false),[grid,setGrid]=useState(false),[reset,setReset]=useState(0);
  const [dragging,setDragging]=useState(false),[captureError,setCaptureError]=useState('');
  const capture=useRef<(()=>string)|null>(null);
  useImperativeHandle(ref,()=>({capturePNG:()=>{const data=capture.current?.();if(!data)throw Error('三维场景尚未就绪');return data}}));
  const screenshot=()=>{try{const data=capture.current?.();if(!data)throw Error();const link=document.createElement('a');link.href=data;link.download=project.name+'-三维.png';link.click();setCaptureError('')}catch(e){setCaptureError(e instanceof Error?e.message:'截图失败，请重试')}};
  const drag=useRef<{item:Item;origins:Item[];start:T.Vector3;plane:T.Plane;screen:{x:number;y:number};release:()=>void}|null>(null);
  const finish=(cancel=false)=>{const current=drag.current;if(!current)return;drag.current=null;current.release();if(cancel)useStore.getState().cancelMove();else useStore.getState().endMove();setDragging(false)};
  useEffect(()=>{const up=()=>finish(),cancel=()=>finish(true);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);const unsub=useStore.subscribe((s,p)=>{if(s.interactionEpoch!==p.interactionEpoch)cancel()});return()=>{window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);unsub();if(drag.current){drag.current.release();drag.current=null;useStore.getState().cancelMove()}}},[]);
  useEffect(()=>{if(!active)finish(true)},[active]);
  useEffect(()=>{if(focusRequest){setCloseup(true);setReset(n=>n+1)}},[focusRequest]);
  const handlers=useMemo<DragHandlers>(()=>({
    onPointerDown:(e,i)=>{if(e.button!==0)return;e.stopPropagation();const state=useStore.getState();i=state.project.items.find(v=>v.id===i.id)??i;state.setTool('select');if(e.shiftKey){state.selectMany(groupSelection(state.project,i.id,ids,true,e.ctrlKey||e.metaKey));return}const selectedIds=groupSelection(state.project,i.id,ids,false,e.ctrlKey||e.metaKey);state.selectMany(selectedIds);if(!moveMode||!isEditable(i,state.project))return;let origins:Item[];try{origins=movableSelection(state.project,selectedIds)}catch(error){useStore.setState({error:(error as Error).message});return}
      const plane=new T.Plane(new T.Vector3(0,1,0),-e.point.y),start=e.ray.intersectPlane(plane,new T.Vector3());if(!start)return;
      const target=e.target as unknown as {setPointerCapture:(id:number)=>void;hasPointerCapture:(id:number)=>boolean;releasePointerCapture:(id:number)=>void},pointer=e.pointerId;target.setPointerCapture(pointer);
      drag.current={item:{...i},origins,start,plane,screen:{x:e.clientX,y:e.clientY},release:()=>{if(target.hasPointerCapture(pointer))target.releasePointerCapture(pointer)}};
      useStore.getState().beginMove();setDragging(true);
    },
    onPointerMove:e=>{const current=drag.current;if(!current)return;e.stopPropagation();if(Math.hypot(e.clientX-current.screen.x,e.clientY-current.screen.y)<3)return;
      const point=e.ray.intersectPlane(current.plane,new T.Vector3());if(!point)return;
      const i=current.item,dx=(point.x-current.start.x)*1000,dy=(point.z-current.start.z)*1000,quantize=(n:number)=>snap&&!e.altKey?Math.round(n/prefs.snapSize)*prefs.snapSize:n;
      const patch=isAttachedOpening(i)&&current.origins.length===1?dragOpening(useStore.getState().project,i,{x:i.x+i.w/2+dx,y:i.y+i.d/2+dy},snap&&!e.altKey,400,prefs.snapSize):{x:i.x+quantize(dx),y:i.y+quantize(dy)};
      if(isAttachedOpening(i)&&current.origins.length===1)useStore.getState().move(i.id,patch);else useStore.getState().moveMany(current.origins.map(origin=>({id:origin.id,patch:{x:origin.x+quantize(dx),y:origin.y+quantize(dy)}})));
    },
    onPointerUp:e=>{if(drag.current){e.stopPropagation();finish()}},
    onDoubleClick:(e,i)=>{e.stopPropagation();const s=useStore.getState();s.cancelInteraction();s.selectMany([i.id])},
  }),[moveMode,snap,prefs.snapSize,ids]);
  const item=project.items.find(i=>i.id===selected&&i.kind!=='zone'&&!isAnnotation(i)&&isVisible(i,project));const focus=closeup?(item?.wallId?project.items.find(w=>w.id===item.wallId):item):undefined;
  const visible=focus?[focus,...project.items.filter(i=>i.wallId===focus.id)]:project.items.filter(i=>i.kind!=='zone'&&!isAnnotation(i));
  const shown=visible.filter(i=>isVisible(i,project));
  const profiles=wallProfiles(project);
  const groups=new Map<string,Item[]>();for(const original of shown){const i={...original,sill:baseHeight(project,original)};const key=['wall','door','window'].includes(i.kind)?i.id:JSON.stringify([i.kind,modelOf(i),i.w,i.d,i.h,i.color,i.flipped,i.pointType,i.verification,faded(i)]);const group=groups.get(key);if(group)group.push(i);else groups.set(key,[i])}
  return <div className="scene-shell" tabIndex={0} onPointerDownCapture={e=>{if(e.target instanceof HTMLCanvasElement)e.currentTarget.focus({preventScroll:true})}}>
    <div className="scene-toolbar"><div className="scene-mode"><button className={!focus?'active':''} onClick={()=>{setCloseup(false);setReset(n=>n+1)}}>空间全景</button><button disabled={!item} className={focus?'active':''} onClick={()=>{setCloseup(true);setReset(n=>n+1)}}>物体特写</button></div><button aria-pressed={moveMode} title="开启后可直接拖动物体；关闭后拖动旋转视角" onClick={()=>{useStore.getState().cancelInteraction();prefs.set({move3D:!moveMode})}}>{moveMode?'移动已开启':'移动已关闭'}</button><button aria-pressed={prefs.camera==='top'} onClick={()=>{prefs.set({camera:'top'});setReset(n=>n+1)}}>俯视</button><button aria-pressed={prefs.camera==='oblique'} onClick={()=>{prefs.set({camera:'oblique'});setReset(n=>n+1)}}>斜视</button><button aria-pressed={grid} title="三维网格" onClick={()=>setGrid(v=>!v)}>网格</button><button title="重置三维视角" onClick={()=>{setCloseup(false);prefs.set({camera:'oblique'});setReset(n=>n+1)}}>复位</button><button onClick={screenshot}>三维截图</button>{captureError&&<span role="alert">{captureError}</span>}</div>
    <Canvas frameloop={active?'demand':'never'} shadows dpr={[1,1.75]} camera={{position:[20,18,24],fov:40}} gl={{localClippingEnabled:true,antialias:true,toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1.05}}>
      <SceneCapture capture={capture}/>
      <color attach="background" args={['#e7ebe8']}/><Environment center={focus?[(focus.x+focus.w/2)/1000,0,(focus.y+focus.d/2)/1000]:[project.width/2000,0,project.height/2000]} extent={focus?Math.max(focus.w,focus.d,focus.h)/1000*1.5:Math.max(project.width,project.height)/1000}/>
      <mesh rotation={[-Math.PI/2,0,0]} position={[project.width/2000,focus?-.002:-.045,project.height/2000]} receiveShadow><planeGeometry args={[1000,1000]}/><meshStandardMaterial color="#e4e8e4" roughness={.92}/></mesh>
      {!focus&&<><SiteFloor project={project} grid={grid}/><SiteOverlay3D/></>}
      {!focus&&project.items.filter(i=>i.kind==='zone'&&ids.includes(i.id)&&isVisible(i,project)).map(i=><ZoneHighlight key={i.id} item={i}/>)}
      {[...groups].map(([spec,items])=>items.length>=3?<InstancedFurniture key={spec} spec={spec} items={items} handlers={handlers} faded={faded(items[0])}/>:items.map(i=><Furniture key={i.id} profile={profiles.get(i.id)} item={i} selected={ids.includes(i.id)} faded={faded(i)} handlers={handlers} openings={i.kind==='wall'?project.items.filter(o=>o.wallId===i.id):undefined}/>))}
      {[...groups.values()].filter(items=>items.length>=3).flat().filter(i=>ids.includes(i.id)).map(i=><group key={i.id} position={[(i.x+i.w/2)/1000,(i.sill??0)/1000,(i.y+i.d/2)/1000]} rotation={[0,-i.rotation*Math.PI/180,0]}><SelectionBox item={i}/></group>)}


      {focus&&<ContactShadows key={[focus.id,focus.x,focus.y,focus.w,focus.d,focus.h,focus.rotation].join('-')} position={[(focus.x+focus.w/2)/1000,0,(focus.y+focus.d/2)/1000]} scale={Math.max(focus.w,focus.d)/1000*2.5} far={focus.h/1000*1.5} resolution={256} blur={2.5} opacity={.4} frames={1} color="#3e453d"/>}
      <CameraRig focus={focus} reset={reset} dragging={dragging} pose={prefs.camera}/>
    </Canvas>
    <div className="scene-caption"><b>{focus?focus.name:'空间材质预览'}</b><span>{focus?`${focus.w} × ${focus.d} × ${focus.h} mm`:moveMode?'拖物体移动 · 空白处旋转 · Alt 关闭吸附':'拖动旋转视角 · 点击物体选中'}</span></div>
  </div>;
});
