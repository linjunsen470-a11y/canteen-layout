import { useStore } from './store';
import { useWallPlacement } from './wallPlacement';
import { measureWall, placeAtClearance, wallFaces } from './wallClearance';
import { footprint } from './spatial';
import EquipmentSymbol from './EquipmentSymbol';
import { wallFaceChoices } from './wallFaceChoices';

export default function WallClearanceOverlay({scale}:{scale:number}){
  const p=useStore(s=>s.project),{session}=useWallPlacement();if(!session)return null;
  const i=p.items.find(i=>i.id===session.itemId),face=wallFaces(p).find(f=>f.wallId===session.wallId&&f.side===session.side);if(!i)return null;
  if(session.picking)return <g data-ui="true" data-wall-picking="true" pointerEvents="none">{wallFaceChoices(p,i).filter(c=>c.distance!==null).map(c=><line key={`${c.face.wallId}|${c.face.side}`} x1={c.face.a.x} y1={c.face.a.y} x2={c.face.b.x} y2={c.face.b.y} stroke="#217fa1" strokeWidth={3/scale} strokeDasharray={`${6/scale} ${3/scale}`}/>)}</g>;
  if(!face)return null;
  let measurement,preview;
  try{preview=session.target===null?null:placeAtClearance(p,i,face,session.target);measurement=measureWall(p,preview??i,face)}catch{/* The chosen face stays highlighted even when inapplicable. */}
  const origin=measurement?.wallPoint??{x:(face.a.x+face.b.x)/2,y:(face.a.y+face.b.y)/2},tip={x:origin.x+face.normal.x*28/scale,y:origin.y+face.normal.y*28/scale};
  return <g data-ui="true" data-wall-clearance="true" pointerEvents="none">
    <line x1={face.a.x} y1={face.a.y} x2={face.b.x} y2={face.b.y} stroke="#b55414" strokeWidth={4/scale}/>
    <path d={`M ${origin.x} ${origin.y} L ${tip.x} ${tip.y} M ${tip.x-face.normal.x*7/scale+face.normal.y*4/scale} ${tip.y-face.normal.y*7/scale-face.normal.x*4/scale} L ${tip.x} ${tip.y} L ${tip.x-face.normal.x*7/scale-face.normal.y*4/scale} ${tip.y-face.normal.y*7/scale+face.normal.x*4/scale}`} fill="none" stroke="#b55414" strokeWidth={1.5/scale}/>
    {preview&&<><polygon data-wall-preview="true" points={footprint(preview).map(q=>`${q.x},${q.y}`).join(' ')} fill="#168b8022" stroke="#126b61" strokeWidth={2/scale} strokeDasharray={`${5/scale} ${3/scale}`}/><g transform={`translate(${preview.x+preview.w/2},${preview.y+preview.d/2}) rotate(${preview.rotation})`}><EquipmentSymbol item={preview} scale={scale}/></g></>}
    {measurement&&<><line x1={measurement.wallPoint.x} y1={measurement.wallPoint.y} x2={measurement.edgePoint.x} y2={measurement.edgePoint.y} stroke="#b55414" strokeWidth={2/scale}/><polyline points={measurement.edge.map(q=>`${q.x},${q.y}`).join(' ')} fill="none" stroke="#c44b93" strokeWidth={4/scale}/><circle cx={measurement.edgePoint.x} cy={measurement.edgePoint.y} r={4/scale} fill="#c44b93"/><circle cx={measurement.wallPoint.x} cy={measurement.wallPoint.y} r={3/scale} fill="#b55414"/><text x={(measurement.wallPoint.x+measurement.edgePoint.x)/2+8/scale} y={(measurement.wallPoint.y+measurement.edgePoint.y)/2-8/scale} fontSize={12/scale} fill="#833c12" stroke="white" strokeWidth={3/scale} paintOrder="stroke">{measurement.distance.toFixed(1)} mm{preview?' · 预览':''}</text></>}
  </g>;
}
