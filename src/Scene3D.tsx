import { ScenePanMode, useSceneSpacePan } from './useSceneSpacePan';
import { SceneFrame, frameItems, framePoints, frameDistance } from './sceneFraming';
import SceneRegionPicker, { SceneNavigation } from './SceneRegionPicker';
import { useWallPlacement } from './wallPlacementState';
import { groupSelection, movableSelection } from './layoutGroups';
import { baseHeight } from './spatial';
import { forwardRef, useImperativeHandle, memo, useMemo, useEffect, useRef, useState, ComponentRef } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
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
  const invalidate=useThree(s=>s.invalidate);
  const variant=modelOf(item);const openingKey=JSON.stringify(openings.map(o=>[o.offset,o.sill,o.w,o.h]));
  useEffect(()=>{const model=createFurniture(item,openings,profile);if(faded)fadeFurniture(model);const group=host.current!;group.add(model);invalidate();return()=>{group.remove(model);disposeFurniture(model)}},[variant,item.w,item.d,item.h,item.color,item.flipped,item.hingeRight,item.pointType,item.verification,openingKey,faded,JSON.stringify(profile)]);
  return <group name={`item:${item.id}`} position={[(item.x+item.w/2)/1000,(item.sill??0)/1000,(item.y+item.d/2)/1000]} rotation={[0,-item.rotation*Math.PI/180,0]} ref={host} onDoubleClick={e=>handlers.onDoubleClick(e,item)} onPointerDown={e=>handlers.onPointerDown(e,item)} onPointerMove={handlers.onPointerMove} onPointerUp={handlers.onPointerUp} >{selected&&<SelectionBox item={item}/>}</group>;
});
function Environment({center,extent,detail}:{center:[number,number,number];extent:number;detail:boolean}){
  const {gl,scene,invalidate}=useThree();
  useEffect(()=>{const target=studioEnvironment(gl);scene.environment=target.texture;scene.environmentIntensity=.6;invalidate();return()=>{scene.environment=null;target.dispose()}},[gl,scene]);
  const target=useRef(new T.Object3D());target.current.position.set(...center);
  return <><primitive object={target.current}/><hemisphereLight args={['#eaf3ff','#b8aa91',.65]}/><directionalLight target={target.current} position={[center[0]+extent*.4,extent*1.4,center[2]+extent*.6]} intensity={2.5} color="#fff0d9" castShadow key={String(detail)} shadow-mapSize={detail?[2048,2048]:[1024,1024]} shadow-camera-left={-extent} shadow-camera-right={extent} shadow-camera-top={extent} shadow-camera-bottom={-extent} shadow-camera-far={extent*5+10} shadow-normalBias={.005}/><directionalLight position={[-10,7,-4]} intensity={1.1} color="#dbe9ff"/></>;
}
function CameraRig({focus,frame,reset,dragging,picking,pose,active,navigation,pan,onPanChange}:{pan:React.RefObject<boolean>;onPanChange:(mode:ScenePanMode)=>void;focus:Item|undefined;frame:SceneFrame|null;reset:number;dragging:boolean;picking:boolean;pose:'top'|'oblique';active:boolean;navigation:React.RefObject<SceneNavigation|null>}) {
  const controls=useRef<ComponentRef<typeof OrbitControls>>(null);
  const {camera,size,invalidate,gl}=useThree();const width=useStore(s=>s.project.width),height=useStore(s=>s.project.height);
  useSceneSpacePan(gl.domElement,controls,active,dragging||picking,pan,onPanChange);
  const framed=useRef(''),lastCenter=useRef<T.Vector3|null>(null);
  const extent=Math.max(.1,frame?Math.max(...frame.max.map((v,n)=>v-frame.min[n])):focus?Math.max(focus.w,focus.d,focus.h)/1000:Math.max(width,height)/1000);
  const maxDistance=Math.max(width,height)/1000*12,minDistance=Math.max(.05,extent*.01);
  useEffect(()=>{navigation.current={ground:(x,y)=>{const r=gl.domElement.getBoundingClientRect(),ray=new T.Raycaster();ray.setFromCamera(new T.Vector2((x-r.x)/r.width*2-1,-(y-r.y)/r.height*2+1),camera);const p=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());return p&&p.distanceTo(camera.position)<10000?{x:p.x*1000,y:p.z*1000}:null},zoom:factor=>{const c=controls.current;if(!c)return;camera.position.sub(c.target).multiplyScalar(factor).add(c.target);c.update();invalidate()}};return()=>{navigation.current=null}},[camera,gl,invalidate,navigation]);
  // Keep depth precision useful at every zoom level and keep the whole site in range.
  useFrame(()=>{const distance=controls.current?camera.position.distanceTo(controls.current.target):extent*2;
    const near=Math.max(.01,distance/200),far=Math.max(1000,distance+extent*24);
    if(Math.abs(camera.near-near)>1e-6||Math.abs(camera.far-far)>1e-6){camera.near=near;camera.far=far;camera.updateProjectionMatrix()}
  });
  useEffect(()=>{if(active)invalidate()},[active,size.width,size.height,invalidate]);
  useEffect(()=>{if(!active||dragging||!controls.current||size.width<1||size.height<1)return;
    let center=frame?new T.Vector3(...frame.min).add(new T.Vector3(...frame.max)).multiplyScalar(.5):focus?new T.Vector3((focus.x+focus.w/2)/1000,focus.h/2100,(focus.y+focus.d/2)/1000):new T.Vector3(width/2000,0,height/2000);
    const key=[JSON.stringify(frame),focus?.id??'all',focus?.w,focus?.d,focus?.h,reset,pose,width,height].join(':');
    if(framed.current===key){if(!frame&&focus&&lastCenter.current){const delta=center.clone().sub(lastCenter.current);camera.position.add(delta);controls.current.target.add(delta);controls.current.update()}lastCenter.current=center;invalidate();return}
    framed.current=key;lastCenter.current=center;
    // Finish old orbit damping before a deliberate reframe, so it cannot drift afterward.
    const damping=controls.current.enableDamping;controls.current.enableDamping=false;controls.current.update();controls.current.enableDamping=damping;
    const extent=focus?Math.max(focus.w,focus.d,focus.h)/1000:Math.max(width,height)/1000;
    const structural=focus?.kind==='wall'||focus?.kind==='partition';
    const aspect=Math.max(.25,size.width/size.height);let distance=extent*(structural?1.6:focus?2.5:1.35)/Math.min(1,aspect);
    const direction=pose==='top'?new T.Vector3(0,1,.001):structural?new T.Vector3(.5,.7,1.5).applyAxisAngle(new T.Vector3(0,1,0),-focus.rotation*Math.PI/180):new T.Vector3(1,.95,1.3);
    if(frame){const fitted=frameDistance(frame,direction,(camera as T.PerspectiveCamera).fov,aspect);center=fitted.center;distance=fitted.distance}
    camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));camera.near=Math.max(.01,distance/200);camera.far=Math.max(1000,distance+extent*24);camera.updateProjectionMatrix();controls.current.target.copy(center);controls.current.update();invalidate();
  },[frame,focus?.id,focus?.x,focus?.y,focus?.w,focus?.d,focus?.h,reset,pose,width,height,size.width,size.height,dragging,active]);
  return <OrbitControls ref={controls} zoomToCursor screenSpacePanning enabled={active&&!dragging&&!picking} makeDefault minDistance={minDistance} maxDistance={maxDistance} maxPolarAngle={Math.PI/2-.03}/>;
}
function ShadowUpdates({items,focus,detail}:{items:Item[];focus?:string;detail:boolean}){const {gl,invalidate}=useThree();useEffect(()=>{gl.shadowMap.autoUpdate=false;gl.shadowMap.needsUpdate=true;invalidate()},[gl,items,focus,detail,invalidate]);return null}
export type SceneHandle={capturePNG:()=>string};
export default memo(forwardRef<SceneHandle,{active?:boolean;snap?:boolean}>(function Scene3D({active=true,snap=true},ref){
  const live=useStore(s=>active?s.project:null),lastProject=useRef(useStore.getState().project);if(live)lastProject.current=live;const project=lastProject.current;
  const lastView=useRef({selected:useStore.getState().selected,ids:useStore.getState().selectedIds,focusRequest:useStore.getState().focusRequest});
  const selected=useStore(s=>active?s.selected:lastView.current.selected),ids=useStore(s=>active?s.selectedIds:lastView.current.ids),focusRequest=useStore(s=>active?s.focusRequest:lastView.current.focusRequest);if(active)lastView.current={selected,ids,focusRequest};
  const prefs=useWorkspace(),moveMode=prefs.move3D,planning=usePlanning();
  const faded=(i:Item)=>planning.dim&&!insidePlanning(i,project);
  const navigation=useRef<SceneNavigation|null>(null);
  const [frame,setFrame]=useState<SceneFrame|null>(null),[picking,setPicking]=useState(false),[detail,setDetail]=useState(false);
  const [closeup,setCloseup]=useState(false),[grid,setGrid]=useState(false),[reset,setReset]=useState(0);
  const [dragging,setDragging]=useState(false),[captureError,setCaptureError]=useState('');
  const pan=useRef(false),[panMode,setPanMode]=useState<ScenePanMode>('off');
  const capture=useRef<(()=>string)|null>(null);
  useImperativeHandle(ref,()=>({capturePNG:()=>{const data=capture.current?.();if(!data)throw Error('三维场景尚未就绪');return data}}));
  const screenshot=()=>{try{const data=capture.current?.();if(!data)throw Error();const link=document.createElement('a');link.href=data;link.download=project.name+'-三维.png';link.click();setCaptureError('')}catch(e){setCaptureError(e instanceof Error?e.message:'截图失败，请重试')}};
  const drag=useRef<{item:Item;origins:Item[];start:T.Vector3;plane:T.Plane;screen:{x:number;y:number};release:()=>void}|null>(null);
  const finish=(cancel=false)=>{const current=drag.current;if(!current)return;drag.current=null;current.release();if(cancel)useStore.getState().cancelMove();else useStore.getState().endMove();setDragging(false)};
  useEffect(()=>{const up=()=>finish(),cancel=()=>finish(true);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',cancel);const unsub=useStore.subscribe((s,p)=>{if(s.interactionEpoch!==p.interactionEpoch)cancel()});return()=>{window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',cancel);unsub();if(drag.current){drag.current.release();drag.current=null;useStore.getState().cancelMove()}}},[]);
  useEffect(()=>{if(!active){finish(true);setPicking(false)}},[active]);
  useEffect(()=>{if(focusRequest){setFrame(null);setPicking(false);setCloseup(true);setReset(n=>n+1)}},[focusRequest]);
  const handlers=useMemo<DragHandlers>(()=>({
    onPointerDown:(e,i)=>{if(e.button!==0||pan.current)return;if(useWallPlacement.getState().session){e.stopPropagation();return}e.stopPropagation();const state=useStore.getState();i=state.project.items.find(v=>v.id===i.id)??i;state.setTool('select');if(e.shiftKey){state.selectMany(groupSelection(state.project,i.id,ids,true,e.ctrlKey||e.metaKey));return}const selectedIds=groupSelection(state.project,i.id,ids,false,e.ctrlKey||e.metaKey);state.selectMany(selectedIds);if(!moveMode||!isEditable(i,state.project))return;let origins:Item[];try{origins=movableSelection(state.project,selectedIds)}catch(error){useStore.setState({error:(error as Error).message});return}
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
    onDoubleClick:(e,i)=>{if(pan.current)return;e.stopPropagation();if(useWallPlacement.getState().session)return;const s=useStore.getState();s.cancelInteraction();s.selectMany([i.id])},
  }),[moveMode,snap,prefs.snapSize,ids]);
  const item=project.items.find(i=>i.id===selected&&i.kind!=='zone'&&!isAnnotation(i)&&isVisible(i,project));const focus=closeup?(item?.wallId?project.items.find(w=>w.id===item.wallId):item):undefined;
  const profiles=useMemo(()=>wallProfiles(project),[project.items]);
  const groups=useMemo(()=>{const visible=focus?[focus,...project.items.filter(i=>i.wallId===focus.id)]:project.items.filter(i=>i.kind!=='zone'&&!isAnnotation(i));
  const shown=visible.filter(i=>isVisible(i,project));
  const groups=new Map<string,Item[]>();for(const original of shown){const i={...original,sill:baseHeight(project,original)};const key=['wall','door','window'].includes(i.kind)?i.id:JSON.stringify([i.kind,modelOf(i),i.w,i.d,i.h,i.color,i.flipped,i.pointType,i.verification,faded(i)]);const group=groups.get(key);if(group)group.push(i);else groups.set(key,[i])}return groups},[project.items,focus?.id,project.planningAreas,planning.activeId,planning.dim]);
  const selectedItems=project.items.filter(i=>ids.includes(i.id)&&isVisible(i,project)&&!isAnnotation(i));
  const area=project.planningAreas?.find(a=>a.id===planning.activeId);
  const showFrame=(next:SceneFrame)=>{setFrame(next);setCloseup(false);setPicking(false);setReset(n=>n+1)};
  return <div className="scene-shell" tabIndex={0} onPointerDownCapture={e=>{if(e.target instanceof HTMLCanvasElement)e.currentTarget.focus({preventScroll:true})}}>
    <div className="scene-toolbar"><button onClick={()=>{useStore.getState().cancelInteraction();prefs.set(prefs.focusMode&&prefs.focusView==='3d'?{focusMode:false,focusView:null}:{focusMode:true,focusView:'3d'})}}>{prefs.focusMode&&prefs.focusView==='3d'?'还原三维':'最大化三维'}</button><button disabled={!selectedItems.length} onClick={()=>showFrame(frameItems(project,selectedItems))}>聚焦选中</button><button disabled={!area} onClick={()=>{if(area)showFrame(framePoints(area.outline,Math.max(2800,...project.items.map(i=>i.h)),area.name))}}>聚焦规划范围</button><button aria-pressed={picking} onClick={()=>{if(picking){setPicking(false);return}setCloseup(false);setFrame(null);prefs.set({camera:'top'});setReset(n=>n+1);setPicking(true)}}>{picking?'取消框选':'框选放大'}</button><button aria-label="三维放大" onClick={()=>navigation.current?.zoom(.8)}>＋</button><button aria-label="三维缩小" onClick={()=>navigation.current?.zoom(1.25)}>－</button><div className="scene-mode"><button className={!focus&&!frame?'active':''} onClick={()=>{setFrame(null);setPicking(false);setCloseup(false);setReset(n=>n+1)}}>空间全景</button></div><details className="scene-more"><summary>更多</summary><div className="scene-more-actions"><button disabled={!item} className={focus?'active':''} onClick={()=>{setFrame(null);setPicking(false);setCloseup(true);setReset(n=>n+1)}}>物体特写</button><button aria-pressed={moveMode} title="开启后可直接拖动物体；关闭后拖动旋转视角" onClick={()=>{useStore.getState().cancelInteraction();prefs.set({move3D:!moveMode})}}>{moveMode?'移动已开启':'移动已关闭'}</button><button aria-pressed={prefs.camera==='top'} onClick={()=>{prefs.set({camera:'top'});setReset(n=>n+1)}}>俯视</button><button aria-pressed={prefs.camera==='oblique'} onClick={()=>{prefs.set({camera:'oblique'});setReset(n=>n+1)}}>斜视</button><button aria-pressed={grid} title="三维网格" onClick={()=>setGrid(v=>!v)}>网格</button><button title="重置三维视角" onClick={()=>{setFrame(null);setPicking(false);setCloseup(false);prefs.set({camera:'oblique'});setReset(n=>n+1)}}>复位</button><button aria-pressed={detail} onClick={()=>setDetail(v=>!v)}>{detail?'精细画质':'流畅画质'}</button><button onClick={screenshot}>三维截图</button>{captureError&&<span role="alert">{captureError}</span>}</div></details></div>
    <div className={`scene-viewport scene-pan-${panMode}`}><Canvas frameloop={active?'demand':'never'} shadows dpr={detail?[1,1.75]:1} camera={{position:[20,18,24],fov:40}} gl={{localClippingEnabled:true,antialias:true,toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1.05}}>
      <SceneCapture capture={capture}/><ShadowUpdates items={project.items} focus={focus?.id} detail={detail}/>
      <color attach="background" args={['#e7ebe8']}/><Environment detail={detail} center={focus?[(focus.x+focus.w/2)/1000,0,(focus.y+focus.d/2)/1000]:[project.width/2000,0,project.height/2000]} extent={focus?Math.max(focus.w,focus.d,focus.h)/1000*1.5:Math.max(project.width,project.height)/1000}/>
      <mesh rotation={[-Math.PI/2,0,0]} position={[project.width/2000,focus?-.002:-.045,project.height/2000]} receiveShadow><planeGeometry args={[1000,1000]}/><meshStandardMaterial color="#e4e8e4" roughness={.92}/></mesh>
      {!focus&&<><SiteFloor project={project} grid={grid}/><SiteOverlay3D/></>}
      {!focus&&project.items.filter(i=>i.kind==='zone'&&ids.includes(i.id)&&isVisible(i,project)).map(i=><ZoneHighlight key={i.id} item={i}/>)}
      {[...groups].map(([spec,items])=>items.length>=3?<InstancedFurniture key={spec} spec={spec} items={items} handlers={handlers} faded={faded(items[0])}/>:items.map(i=><Furniture key={i.id} profile={profiles.get(i.id)} item={i} selected={ids.includes(i.id)} faded={faded(i)} handlers={handlers} openings={i.kind==='wall'?project.items.filter(o=>o.wallId===i.id):undefined}/>))}
      {[...groups.values()].filter(items=>items.length>=3).flat().filter(i=>ids.includes(i.id)).map(i=><group key={i.id} position={[(i.x+i.w/2)/1000,(i.sill??0)/1000,(i.y+i.d/2)/1000]} rotation={[0,-i.rotation*Math.PI/180,0]}><SelectionBox item={i}/></group>)}


      {focus&&<ContactShadows key={[focus.id,focus.x,focus.y,focus.w,focus.d,focus.h,focus.rotation].join('-')} position={[(focus.x+focus.w/2)/1000,0,(focus.y+focus.d/2)/1000]} scale={Math.max(focus.w,focus.d)/1000*2.5} far={focus.h/1000*1.5} resolution={256} blur={2.5} opacity={.4} frames={1} color="#3e453d"/>}
      <CameraRig pan={pan} onPanChange={setPanMode} navigation={navigation} frame={frame} active={active} focus={focus} reset={reset} dragging={dragging} picking={picking} pose={prefs.camera}/>
    </Canvas>{picking&&<SceneRegionPicker navigation={navigation} onCancel={()=>setPicking(false)} onPick={points=>showFrame(framePoints(points,0,'框选区域'))}/>}
    <div className="scene-caption"><b>{panMode!=='off'?'平移视图 · 松开空格恢复':focus?focus.name:frame?.label??'空间材质预览'}</b><span>{focus?`${focus.w} × ${focus.d} × ${focus.h} mm`:moveMode?'拖物体移动 · 空格＋左键平移视图 · Alt 关闭吸附':'空格＋左键／右键平移 · 左键旋转 · 滚轮缩放'}</span></div>
  </div></div>;
}));
