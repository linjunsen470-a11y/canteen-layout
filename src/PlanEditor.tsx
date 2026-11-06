import { useWallPlacement, pickWallAt } from './wallPlacement';
import { facingModels } from './equipmentFacing';
import EquipmentSymbol from './EquipmentSymbol';
import WallClearanceOverlay from './WallClearanceOverlay';
import { groupSelection, movableSelection } from './layoutGroups';
import { snapTranslation, SnapGuide } from './layoutSnapping';
import { finishCopyPlacement } from './layoutCommands';
import RotationHandle from './RotationHandle';
import { pointGlyphs } from './siteObjects';
import { nearestWallEnd, wallProfiles } from './wallJoints';
import { forwardRef, memo, useMemo, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState } from 'react';
import { Hand, MousePointer2, Plus, Minus, Scan, Focus } from 'lucide-react';
import { isEditable, isVisible, isTextInput } from './editorInteraction';
import { useWorkspace } from './workspace';
import { Item, modelOf } from './model';
import { useStore } from './store';
import { UnderlayLayer, UnderlayInteraction } from './UnderlayLayer';
import { insidePlanning, usePlanning } from './planning';
import { capturePlan } from './capturePlan';
import AnnotationSymbol from './AnnotationSymbol';
import { isAnnotation } from './annotations';
import BuildingSymbol from './BuildingSymbol';
import SiteOutline, { SiteOutlineHandle } from './SiteOutline';
import { siteOutline, floorColors } from './site';
import { zoneArea, zoneCorners } from './zones';
import { isBuilding, isOpening, isAttachedOpening, wallPoint, segmentPose, dragOpening } from './structure';

type Point={x:number;y:number};
type Camera={x:number;y:number;zoom:number};
type Gesture={type:'pan'|'move'|'resize'|'box'|'build'|'endpoint';buildKind?:'wall'|'partition'|'zone'|'text'|'dimension'|'leader';endpoint?:'start'|'end';start:Point;camera:Camera;origins:Item[];id?:string;additive?:boolean};
export type PlanHandle={capturePNG:()=>Promise<string>;exportPNG:()=>void;center:()=>Point};
type Props={active?:boolean;grid:boolean;snap:boolean;onDropItem:(name:string,kind:string,point:Point,id?:string)=>void;notify:(text:string)=>void};
function itemBounds(i:Item){const angle=i.rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));const w=i.w*c+i.d*s,d=i.w*s+i.d*c;return{x:i.x+i.w/2-w/2,y:i.y+i.d/2-d/2,w,d}}
const PlanEditor=forwardRef<PlanHandle,Props>(function PlanEditor({active=true,grid,snap,onDropItem,notify},ref){
  const last=useRef(useStore.getState());const project=useStore(s=>active?s.project:last.current.project),selected=useStore(s=>active?s.selected:last.current.selected),ids=useStore(s=>active?s.selectedIds:last.current.selectedIds),onSelect=useStore(s=>s.selectMany),tool=useStore(s=>active?s.tool:last.current.tool),setTool=useStore(s=>s.setTool),focusRequest=useStore(s=>active?s.focusRequest:last.current.focusRequest);if(active)last.current=useStore.getState();
  const wallSession=useWallPlacement(s=>s.session);
  const planning=usePlanning(),activeArea=project.planningAreas?.find(a=>a.id===planning.activeId);
  const {gridSize,snapSize,objectSnap}=useWorkspace();
  const [guides,setGuides]=useState<SnapGuide[]>([]);
  const profiles=useMemo(()=>wallProfiles(project),[project.items]);
  const [snapTarget,setSnapTarget]=useState<Point|null>(null);
  const visibleItems=project.items.filter(i=>isVisible(i,project));
  const host=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null);
  const [size,setSize]=useState({w:600,h:500}),[camera,setCamera]=useState<Camera|null>(null),[space,setSpace]=useState(false),[box,setBox]=useState<{a:Point;b:Point}|null>(null),[dragging,setDragging]=useState(false);
  const outlineMode=tool==='outline-draw'||tool==='planning-draw'||tool==='zone-draw'?'draw':tool==='outline-edit'||tool==='planning-edit'||tool==='zone-edit'?'edit':null;const setOutlineMode=(mode:'draw'|'edit'|null)=>setTool(mode==='draw'?'outline-draw':mode==='edit'?'outline-edit':'select');const outlineEditor=useRef<SiteOutlineHandle>(null);
  const floorPoints=siteOutline(project).map(v=>`${v.x},${v.y}`).join(' ');
  const [draft,setDraft]=useState<Item|null>(null);
  const gesture=useRef<Gesture|null>(null),cameraRef=useRef<Camera>({x:0,y:0,zoom:1});
  const drawingTop=outlineMode?50:0;
  const fit=Math.max(.000001,Math.min(Math.max(80,size.w-88)/project.width,Math.max(80,size.h-100-drawingTop)/project.height));
  const cam=camera??{x:project.width/2,y:project.height/2,zoom:1};cameraRef.current=cam;
  const scale=fit*cam.zoom,offset={x:size.w/2-cam.x*scale,y:(size.h-60+drawingTop)/2-cam.y*scale};
  const screen=(e:{clientX:number;clientY:number})=>{const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.current!.getScreenCTM()!.inverse());return{x:p.x,y:p.y}};
  const world=(p:Point)=>({x:(p.x-size.w/2)/scale+cam.x,y:(p.y-(size.h-60+drawingTop)/2)/scale+cam.y});
  const pointer=useRef<number|null>(null);
  const finish=(cancel=false)=>{const g=gesture.current;gesture.current=null;if(g?.type==='move'||g?.type==='resize'||g?.type==='endpoint'){if(cancel)useStore.getState().cancelMove();else useStore.getState().endMove()}const id=pointer.current;pointer.current=null;if(id!==null&&svg.current?.hasPointerCapture(id))svg.current.releasePointerCapture(id);setDragging(false);setBox(null);setDraft(null);setSnapTarget(null);setGuides([])};
  useEffect(()=>useStore.subscribe((state,prev)=>{if(state.interactionEpoch!==prev.interactionEpoch){finish(true);setSpace(false)}}),[]);
  const view=useWorkspace(s=>s.view);useEffect(()=>{if(view==='3d')finish(true)},[view]);
  useEffect(()=>{const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width>0&&height>0)setSize({w:width,h:height})});observer.observe(host.current!);return()=>observer.disconnect()},[]);
  useEffect(()=>{setCamera(null)},[project.width,project.height]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(document.querySelector('dialog[open]'))return;if(e.code==='Space'&&e.type==='keyup'){setSpace(false);return}if(isTextInput(e.target)||(e.target instanceof HTMLElement&&e.target.closest('button,[role=separator]')))return;
      if(e.code==='Space'){e.preventDefault();setSpace(e.type==='keydown')}

    };
    const blur=()=>{setSpace(false);finish(true);if(useStore.getState().placement)useStore.getState().cancelInteraction()};window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur)};
  },[onSelect]);
  useEffect(()=>()=>{finish(true)},[]);
  const zoomAt=(factor:number,point={x:size.w/2,y:(size.h-60+drawingTop)/2})=>setCamera(previous=>{const c=previous??{x:project.width/2,y:project.height/2,zoom:1},next=Math.min(12,Math.max(.2,c.zoom*factor));const before={x:(point.x-size.w/2)/(fit*c.zoom)+c.x,y:(point.y-(size.h-60+drawingTop)/2)/(fit*c.zoom)+c.y};return{x:before.x-(point.x-size.w/2)/(fit*next),y:before.y-(point.y-(size.h-60+drawingTop)/2)/(fit*next),zoom:next}});
  useLayoutEffect(()=>{const el=svg.current!;const wheel=(e:WheelEvent)=>{e.preventDefault();if(gesture.current||useStore.getState().gesture)return;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?size.h:1);zoomAt(Math.exp(-Math.max(-180,Math.min(180,delta))*.002),screen(e))};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel)},[fit,size.w,size.h,drawingTop,project.width,project.height]);
  const focus=()=>{const items=project.items.filter(i=>ids.includes(i.id));if(!items.length)return;const bounds=items.map(itemBounds),left=Math.min(...bounds.map(b=>b.x)),top=Math.min(...bounds.map(b=>b.y)),right=Math.max(...bounds.map(b=>b.x+b.w)),bottom=Math.max(...bounds.map(b=>b.y+b.d));setCamera({x:(left+right)/2,y:(top+bottom)/2,zoom:Math.max(.2,Math.min(12,Math.min(Math.max(20,size.w-100)/Math.max(1,right-left),Math.max(20,size.h-120)/Math.max(1,bottom-top))/fit))})};
  useEffect(()=>{if(focusRequest)focus()},[focusRequest]);
  useImperativeHandle(ref,()=>({capturePNG:()=>svg.current?capturePlan(svg.current,project):Promise.reject(Error('平面图尚未就绪')),center:()=>({x:cam.x,y:cam.y}),exportPNG:()=>{
    if(svg.current)capturePlan(svg.current,project).then(data=>{const link=document.createElement('a');link.href=data;link.download=project.name+'-平面.png';link.click();notify('已导出完整场地平面图')}).catch(e=>notify(e.message));
  }}));
  const snapPoint=(p:Point,enabled=snap)=>enabled?{x:Math.round(p.x/snapSize)*snapSize,y:Math.round(p.y/snapSize)*snapSize}:p;
  const drawingItem=(g:Gesture,p:Point,shift:boolean,alt=false):Item=>{let q=snapPoint(p,snap&&!alt);if(g.buildKind==='text')return{id:'drawing',kind:'text',name:'文字说明',x:g.start.x,y:g.start.y,w:Math.max(2000,Math.abs(q.x-g.start.x)),d:Math.max(300,Math.abs(q.y-g.start.y)),h:0,rotation:0,color:'#334d40',fontSize:180};if(g.buildKind==='dimension'||g.buildKind==='leader'){if(shift){if(Math.abs(q.x-g.start.x)>Math.abs(q.y-g.start.y))q.y=g.start.y;else q.x=g.start.x}return{id:'drawing',kind:g.buildKind,name:g.buildKind==='dimension'?'尺寸':'说明',d:400,h:0,color:'#334d40',fontSize:180,...segmentPose(g.start,q,400)}}if(g.buildKind==='zone')return{id:'drawing',kind:'zone',name:'新区域',x:Math.min(q.x,g.start.x),y:Math.min(q.y,g.start.y),w:Math.abs(q.x-g.start.x),d:Math.abs(q.y-g.start.y),h:0,rotation:0,color:'#e8edf7'};if(shift){if(Math.abs(q.x-g.start.x)>Math.abs(q.y-g.start.y))q.y=g.start.y;else q.x=g.start.x}const kind=g.buildKind??'wall',d=kind==='wall'?200:100;if(kind==='wall'){const target=snap&&!alt?nearestWallEnd(project,p,12/scale):undefined;if(target)q=target;setSnapTarget(target??null)}return{id:'drawing',kind,model:kind,name:(kind==='wall'?'墙体':'隔断')+' '+(visibleItems.filter(i=>i.kind===kind).length+1),d,h:kind==='wall'?2800:1800,color:kind==='wall'?'#dddcd3':'#b7c0c8',...segmentPose(g.start,q,d)}};
  const beginEndpoint=(e:React.PointerEvent,i:Item,endpoint:'start'|'end')=>{if(!isEditable(i,useStore.getState().project))return;if(e.button!==0||space||tool==='pan'||tool==='wall'||tool==='partition'||tool==='zone'||tool==='text'||tool==='dimension'||tool==='leader'){begin(e,i);return}e.preventDefault();e.stopPropagation();svg.current!.focus({preventScroll:true});i=useStore.getState().project.items.find(v=>v.id===i.id)??i;svg.current!.setPointerCapture(e.pointerId);pointer.current=e.pointerId;useStore.getState().beginMove();gesture.current={type:'endpoint',endpoint,start:wallPoint(i,endpoint==='start'?i.w:0),camera:cam,origins:[i],id:i.id};setDragging(true)};
  const begin=(e:React.PointerEvent,i?:Item,resize=false)=>{
    if(e.button!==0&&e.button!==1)return;if(useStore.getState().placement){e.preventDefault();e.stopPropagation();finishCopyPlacement();setGuides([]);return}e.preventDefault();e.stopPropagation();svg.current!.focus({preventScroll:true});const currentProject=useStore.getState().project;if(i)i=currentProject.items.find(v=>v.id===i!.id)??i;const point=screen(e);
    const wallPlacement=useWallPlacement.getState().session;
    if(wallPlacement&&e.button===0&&!space&&tool!=='pan'){if(wallPlacement.picking)pickWallAt(world(point),12/scale,i?.kind==='wall'?i.id:i?.wallId);return}
    svg.current!.setPointerCapture(e.pointerId);pointer.current=e.pointerId;
    if(e.button===1||space||tool==='pan'){gesture.current={type:'pan',start:point,camera:cam,origins:[]};setDragging(true);return}
    if(tool==='wall'||tool==='partition'||tool==='zone'||tool==='text'||tool==='dimension'||tool==='leader'){gesture.current={type:'build',buildKind:tool,start:tool==='wall'&&snap&&!e.altKey?(nearestWallEnd(currentProject,world(point),12/scale)??snapPoint(world(point))):snapPoint(world(point),snap&&!e.altKey),camera:cam,origins:[]};setDragging(true);return}
    if(!i){gesture.current={type:'box',start:world(point),camera:cam,origins:[],additive:e.shiftKey};setBox({a:world(point),b:world(point)});return}
    if(e.shiftKey&&!resize){onSelect(groupSelection(currentProject,i.id,ids,true,e.ctrlKey||e.metaKey));finish();return}
    const selectedIds=resize?[i.id]:groupSelection(currentProject,i.id,ids,false,e.ctrlKey||e.metaKey);onSelect(selectedIds);if(!isEditable(i,currentProject)||i.measure){finish();return}
    let origins:Item[];try{origins=movableSelection(currentProject,selectedIds)}catch(error){notify((error as Error).message);finish();return}gesture.current={type:resize?'resize':'move',start:world(point),camera:cam,origins,id:i.id};useStore.getState().beginMove();setDragging(true);
  };
  const translate=(origins:Item[],delta:Point,alt:boolean)=>{const result=objectSnap&&!alt?snapTranslation(useStore.getState().project,origins,delta,9/scale):{delta,guides:[]};setGuides(result.guides);if(!result.guides.length&&snap&&!alt)result.delta={x:Math.round(delta.x/snapSize)*snapSize,y:Math.round(delta.y/snapSize)*snapSize};useStore.getState().moveMany(origins.map(i=>({id:i.id,patch:{x:i.x+result.delta.x,y:i.y+result.delta.y}})))};
  const move=(e:React.PointerEvent)=>{const point=screen(e),q=world(point),placement=useStore.getState().placement;if(placement){translate(placement.origins,{x:q.x-placement.anchor.x,y:q.y-placement.anchor.y},e.altKey);return}const g=gesture.current;if(!g)return;
    if(g.type==='pan'){setCamera({...g.camera,x:g.camera.x-(point.x-g.start.x)/scale,y:g.camera.y-(point.y-g.start.y)/scale});return}
    if(g.type==='build'){setDraft(drawingItem(g,q,e.shiftKey,e.altKey));return}
    if(g.type==='endpoint'){const i=g.origins[0];let endpoint=snapPoint(q,snap&&!e.altKey);if(e.shiftKey){if(Math.abs(endpoint.x-g.start.x)>Math.abs(endpoint.y-g.start.y))endpoint.y=g.start.y;else endpoint.x=g.start.x}const target=i.kind==='wall'&&snap&&!e.altKey?nearestWallEnd(project,q,12/scale,i.id):undefined;if(target)endpoint=target;setSnapTarget(target??null);const pose=g.endpoint==='start'?segmentPose(endpoint,g.start,i.d):segmentPose(g.start,endpoint,i.d);useStore.getState().move(i.id,pose);return}
    if(g.type==='box'){setBox({a:g.start,b:q});return}
    const store=useStore.getState();if(g.type==='resize'){const i=g.origins.find(i=>i.id===g.id)!;const a=i.rotation*Math.PI/180,c=Math.cos(a),sn=Math.sin(a),anchor=zoneCorners(i)[0],dx=q.x-anchor.x,dy=q.y-anchor.y;const quantize=(v:number)=>Math.max(100,snap&&!e.altKey?Math.round(v/snapSize)*snapSize:v),w=quantize(dx*c+dy*sn),d=quantize(-dx*sn+dy*c);store.move(i.id,{w,d,x:anchor.x+w/2*c-d/2*sn-w/2,y:anchor.y+w/2*sn+d/2*c-d/2});return}
    let dx=q.x-g.start.x,dy=q.y-g.start.y;if(g.origins.length===1&&isAttachedOpening(g.origins[0])){const i=g.origins[0];store.move(i.id,dragOpening(store.project,i,{x:i.x+i.w/2+dx,y:i.y+i.d/2+dy},snap&&!e.altKey,12/scale,snapSize));return}translate(g.origins,{x:dx,y:dy},e.altKey);
  };
  const end=(e:React.PointerEvent)=>{const g=gesture.current;if(g?.type==='build'){const i=drawingItem(g,world(screen(e)),e.shiftKey,e.altKey);if(i.w>=100&&(i.kind!=='zone'||i.d>=100)){const id=useStore.getState().addItem(i);if(id)onSelect([id]);setTool('select')}else notify('长度至少 100mm；区域长宽均至少 100mm')}if(g?.type==='box'){const q=world(screen(e)),left=Math.min(g.start.x,q.x),top=Math.min(g.start.y,q.y),right=Math.max(g.start.x,q.x),bottom=Math.max(g.start.y,q.y);const found=(right-left)*scale<4&&(bottom-top)*scale<4?[]:visibleItems.filter(i=>{const b=itemBounds(i);return i.kind!=='zone'&&b.x>=left&&b.y>=top&&b.x+b.w<=right&&b.y+b.d<=bottom}).map(i=>i.id);onSelect(g.additive?[...new Set([...ids,...found])]:found)}finish();if(svg.current?.hasPointerCapture(e.pointerId))svg.current.releasePointerCapture(e.pointerId)};
  const font=12/scale;
  return <div className="plan-viewport" ref={host}>
    <svg ref={svg} tabIndex={0} aria-label="二维布局画布" viewBox={`0 0 ${size.w} ${size.h}`} className={tool==='wall'||tool==='partition'||tool==='zone'||tool==='text'||tool==='dimension'||tool==='leader'?'is-drawing':space||tool==='pan'?(dragging?'is-grabbing':'is-pan'):dragging?'is-moving':''}
      onPointerDown={e=>begin(e)} onPointerMove={move} onPointerUp={end} onPointerCancel={()=>finish(true)} onLostPointerCapture={()=>finish(true)}
      onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='copy'}} onDrop={e=>{e.preventDefault();if(useWallPlacement.getState().session)return;try{const c=JSON.parse(e.dataTransfer.getData('application/canteen-item'));onDropItem(c.name,c.kind,world(screen(e)),c.id)}catch{}}}>
      <defs><clipPath id="site-clip"><polygon points={floorPoints}/></clipPath><pattern id="floor-checker" width="2000" height="2000" patternUnits="userSpaceOnUse"><rect width="2000" height="2000" fill={floorColors[0]}/><path d="M 1000 0 H 2000 V 1000 H 1000 Z M 0 1000 H 1000 V 2000 H 0 Z" fill={floorColors[1]}/></pattern><pattern id="plan-grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse"><path d={`M ${gridSize} 0 H 0 V ${gridSize}`} fill="none" stroke="#bdcbc4" strokeWidth={.7/scale}/></pattern></defs>
      <g data-plan="true" transform={`translate(${offset.x},${offset.y}) scale(${scale})`}>
        <polygon data-site-floor="true" points={floorPoints} fill="url(#floor-checker)" stroke="#7c9286" strokeWidth={1.2/scale}/><UnderlayLayer/>
        {visibleItems.filter(i=>i.kind==='zone').map(i=><g key={i.id} data-item-id={i.id} onDoubleClick={e=>{e.stopPropagation();if(useWallPlacement.getState().session)return;onSelect(e.shiftKey?[...new Set([...useStore.getState().selectedIds,i.id])]:[i.id])}} opacity={planning.dim&&!insidePlanning(i,project)?0.3:1}>
          <polygon points={zoneCorners(i).map(p=>`${p.x},${p.y}`).join(' ')} fill={i.color} opacity={.22} pointerEvents="none" clipPath="url(#site-clip)"/>
          <polygon points={zoneCorners(i).map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={ids.includes(i.id)?'#b67523':'#acbcb3'} strokeWidth={(ids.includes(i.id)?2:1)/scale} strokeDasharray={`${5/scale} ${4/scale}`} pointerEvents="stroke" onPointerDown={e=>begin(e,i)}/>
          <text x={i.x+10/scale} y={i.y+20/scale} fontSize={font} fill="#6c7d73" style={{pointerEvents:'all',cursor:'move'}} onPointerDown={e=>begin(e,i)}>{i.name} · {(zoneArea(project,i)/1e6).toFixed(1)}㎡</text>
          {selected===i.id&&ids.length===1&&!i.polygon&&isEditable(i,project)&&<circle data-ui="true" cx={zoneCorners(i)[2].x} cy={zoneCorners(i)[2].y} r={7/scale} fill="#fff" stroke="#b67523" strokeWidth={2/scale} style={{cursor:'nwse-resize'}} onPointerDown={e=>begin(e,i,true)}/>}
        </g>)}
        {grid&&<rect width={project.width} height={project.height} fill="url(#plan-grid)" pointerEvents="none" clipPath="url(#site-clip)"/>}
        <text data-ui="true" x={project.width/2} y={-14/scale} fontSize={11/scale} fill="#7c8d82" textAnchor="middle">{project.width/1000} m × {project.height/1000} m</text>
        {[...visibleItems.filter(i=>i.kind==='wall'||i.kind==='partition'),...visibleItems.filter(i=>i.kind!=='zone'&&i.kind!=='wall'&&i.kind!=='partition'&&!isOpening(i)&&!isAnnotation(i)),...visibleItems.filter(isOpening),...visibleItems.filter(isAnnotation)].map(i=><g key={i.id} data-item-id={i.id} onDoubleClick={e=>{e.stopPropagation();if(useWallPlacement.getState().session)return;onSelect(e.shiftKey?[...new Set([...useStore.getState().selectedIds,i.id])]:[i.id])}} opacity={planning.dim&&!insidePlanning(i,project)?0.3:1} transform={`translate(${i.x+i.w/2},${i.y+i.d/2}) rotate(${i.rotation})`} onPointerDown={e=>begin(e,i)} style={{cursor:wallSession?(wallSession.picking&&i.kind==='wall'?'crosshair':'default'):i.locked?'not-allowed':'move'}}>
          <title>{i.name} · {i.w} × {i.d} × {i.h} mm</title>
          {isAnnotation(i)?<AnnotationSymbol item={i} selected={ids.includes(i.id)} scale={scale}/>:isBuilding(i)?<BuildingSymbol profile={profiles.get(i.id)} item={i} selected={ids.includes(i.id)} scale={scale}/>:modelOf(i)==='round-table'?<ellipse rx={i.w/2} ry={i.d/2} fill={i.color} stroke={ids.includes(i.id)?'#b67523':'#5e7166'} strokeWidth={(ids.includes(i.id)?2.5:1)/scale}/>:<rect x={-i.w/2} y={-i.d/2} width={i.w} height={i.d} rx={Math.min(50,3/scale)} fill={i.color} stroke={ids.includes(i.id)?'#b67523':'#5e7166'} strokeWidth={(ids.includes(i.id)?2.5:1)/scale}/>}
          {!isBuilding(i)&&<EquipmentSymbol item={i} scale={scale}/>}
          {i.kind==='utility'&&<g pointerEvents="none"><circle r={Math.min(i.w,i.d)*.4} fill="none" stroke="#fff" strokeWidth={1.5/scale}/><text textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(i.w,i.d)*.6} fill="#fff">{pointGlyphs[i.pointType??'power']}</text>{i.verification!=='confirmed'&&<text x={i.w/2} y={-i.d/2} fill="#9f5d12" fontSize={12/scale}>?</text>}</g>}{i.kind==='column'&&<path pointerEvents="none" d={`M ${-i.w/2} ${-i.d/2} L ${i.w/2} ${i.d/2} M ${-i.w/2} ${i.d/2} L ${i.w/2} ${-i.d/2}`} stroke="#66766b" strokeWidth={1/scale}/>} {i.kind==='stairs'&&<g pointerEvents="none" stroke="#5e7166" strokeWidth={1/scale}>{Array.from({length:Math.max(3,Math.min(40,Math.round(i.h/160)))-1},(_,k)=><line key={k} x1={-i.w/2} x2={i.w/2} y1={i.d/2-(k+1)*i.d/Math.max(3,Math.min(40,Math.round(i.h/160)))} y2={i.d/2-(k+1)*i.d/Math.max(3,Math.min(40,Math.round(i.h/160)))}/>)}</g>}
          {!isAnnotation(i)&&!isBuilding(i)&&i.kind!=='utility'&&(i.w*scale>60||ids.includes(i.id))&&<text y={i.model&&facingModels.has(i.model)?i.d/2+12/scale:0} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(11/scale,i.w/Math.max(4,i.name.length))} fill="#273e31" pointerEvents="none">{i.locked?'▣ ':''}{i.name}</text>}
          {(i.kind==='wall'||i.kind==='partition')&&selected===i.id&&ids.length===1&&isEditable(i,project)&&<g data-ui="true"><circle cx={-i.w/2} cy={0} r={6/scale} fill="#fff" stroke="#b67523" strokeWidth={2/scale} onPointerDown={e=>beginEndpoint(e,i,'start')}/><circle cx={i.w/2} cy={0} r={6/scale} fill="#fff" stroke="#b67523" strokeWidth={2/scale} onPointerDown={e=>beginEndpoint(e,i,'end')}/><text x={0} y={-i.d/2-12/scale} textAnchor="middle" fontSize={11/scale} fill="#997037">{Math.round(i.w)} mm</text></g>}
        </g>)}
        {activeArea&&<g data-ui="true" pointerEvents="none"><polygon points={activeArea.outline.map(v=>`${v.x},${v.y}`).join(' ')} fill={activeArea.color} fillOpacity={.07} stroke={activeArea.color} strokeWidth={2/scale} strokeDasharray={`${8/scale} ${4/scale}`}/><text x={activeArea.outline[0].x} y={activeArea.outline[0].y-10/scale} fontSize={13/scale} fill={activeArea.color}>{activeArea.name}</text></g>}
        {guides.map((g,n)=><g key={n} data-ui="true" data-snap-guide="true" pointerEvents="none"><line x1={g.a.x} y1={g.a.y} x2={g.b.x} y2={g.b.y} stroke="#c75f1b" strokeWidth={1.5/scale} strokeDasharray={`${5/scale} ${3/scale}`}/><text x={g.a.x+8/scale} y={g.a.y-8/scale} fontSize={11/scale} fill="#a65017">{g.label}</text></g>)}{snapTarget&&<g data-ui="true" pointerEvents="none"><circle cx={snapTarget.x} cy={snapTarget.y} r={8/scale} fill="none" stroke="#b55c25" strokeWidth={2/scale}/><text x={snapTarget.x+12/scale} y={snapTarget.y-12/scale} fontSize={12/scale} fill="#a65c24">墙端点</text></g>}<WallClearanceOverlay scale={scale}/>{!wallSession&&<RotationHandle scale={scale}/>}<UnderlayInteraction scale={scale}/>{outlineMode&&<SiteOutline target={tool.startsWith('zone-')?'zone':tool.startsWith('planning')?'planning':'site'} key={tool} ref={outlineEditor} mode={outlineMode} scale={scale} snap={snap} onDone={()=>setOutlineMode(null)}/>}
        {draft?.kind==='zone'&&<rect data-ui="true" x={draft.x} y={draft.y} width={draft.w} height={draft.d} fill="#7897b444" stroke="#547797" strokeWidth={2/scale} pointerEvents="none"/>}
        {draft&&isAnnotation(draft)&&<g data-ui="true" pointerEvents="none" transform={`translate(${draft.x+draft.w/2},${draft.y+draft.d/2}) rotate(${draft.rotation})`}><AnnotationSymbol item={draft} selected scale={scale}/></g>}
        {draft&&!isAnnotation(draft)&&draft.kind!=='zone'&&<g data-ui="true" pointerEvents="none" opacity={.7} transform={`translate(${draft.x+draft.w/2},${draft.y+draft.d/2}) rotate(${draft.rotation})`}><BuildingSymbol item={draft} selected scale={scale}/><text y={-draft.d/2-12/scale} fontSize={12/scale} textAnchor="middle">{Math.round(draft.w)} mm</text></g>}
      </g>
      {box&&<rect data-ui="true" x={Math.min(box.a.x,box.b.x)*scale+offset.x} y={Math.min(box.a.y,box.b.y)*scale+offset.y} width={Math.abs(box.a.x-box.b.x)*scale} height={Math.abs(box.a.y-box.b.y)*scale} fill="#47796418" stroke="#477964" strokeDasharray="4 3" pointerEvents="none"/>}
    </svg>
    {outlineMode&&<div className="outline-toolbar"><span>{outlineMode==='draw'?'逐点点击 · 点起点或 Enter 闭合':'拖动顶点 · 点击 + 加点'}</span><button onClick={()=>outlineEditor.current?.finish()}>{outlineMode==='draw'?'闭合轮廓':'完成编辑'}</button><button onClick={()=>{useStore.getState().cancelMove();setOutlineMode(null)}}>取消 / 退出</button></div>}
    <div className="plan-tools"><div className="tool-segment"><button aria-label="选择工具" title="选择 / 框选" aria-pressed={tool==='select'} onClick={()=>{setTool('select')}}><MousePointer2/></button><button disabled={!!wallSession} aria-label="平移工具" title="平移（或按住空格 / 中键拖动）" aria-pressed={tool==='pan'} onClick={()=>{setTool('pan')}}><Hand/></button></div><div className="tool-segment"><button aria-label="缩小" onClick={()=>zoomAt(1/1.25)}><Minus/></button><button title="适应整个场地" onClick={()=>setCamera(null)}>{Math.round(cam.zoom*100)}% <Scan/></button><button aria-label="放大" onClick={()=>zoomAt(1.25)}><Plus/></button></div><button title="定位选中物件" disabled={!ids.length} onClick={focus}><Focus/>定位</button></div>
    <div hidden={tool==='select'||tool==='pan'} className={tool==='wall'||tool==='partition'||tool==='zone'||tool==='text'||tool==='dimension'||tool==='leader'?'canvas-hint drawing-hint':'canvas-hint'}>{wallSession?'离墙定位中 · 空格/中键平移 · Esc 取消':tool==='place-copy'?'移动指针预览复制位置 · 点击落位 · Esc 取消':outlineMode?'轮廓编辑 · Alt 关闭吸附 · Esc 退出':tool==='wall'||tool==='partition'||tool==='zone'||tool==='text'||tool==='dimension'||tool==='leader'?tool==='text'?'点击放置文字 · 在属性中修改内容 · Esc 取消':tool==='zone'?'拖动矩形 · 松开完成 · Esc 取消':'拖动画线 · 松开完成 · Shift 水平/垂直 · Esc 取消':'拖动物体移动 · 拖动 ↻ 自由旋转 · 空格平移'}</div>
  </div>;
});
export default memo(PlanEditor);
