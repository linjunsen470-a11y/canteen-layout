import { useState } from 'react';
import { Item } from './model';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { ordinaryEquipment } from './equipmentFacing';
import EquipmentFacingFields from './EquipmentFacingFields';
import { clearanceBlocked } from './wallClearance';
import { recommendedFaces, wallFaceChoices } from './wallFaceChoices';
import { useWallPlacement, startWallPlacement, selectWallFace, previewWallPlacement, confirmWallPlacement, cancelWallPlacement, clearWallPreview, startPickingWall } from './wallPlacement';

export default function WallClearanceFields({item}:{item:Item}) {
  const s=useStore(),state=useWallPlacement(),[input,setInput]=useState('0');
  if(!ordinaryEquipment(item))return null;
  const session=state.session?.itemId===item.id?state.session:null,choices=session?wallFaceChoices(s.project,item):[],blocked=clearanceBlocked(s.project,item);
  const choice=choices.find(c=>c.face.wallId===session?.wallId&&c.face.side===session?.side),face=choice?.face,reason=choice?.reason;
  const distance=choice?.distance===null?undefined:choice?.distance?.toFixed(1),recommended=recommendedFaces(choices);
  return <section className="equipment-fields">
    <EquipmentFacingFields item={item} disabled={!!session}/>
    {!session?<><button disabled={!!blocked||!!s.placement||!!s.gesture} onClick={()=>{const prefs=useWorkspace.getState();if(prefs.view==='3d')prefs.set({view:'split'});startWallPlacement(item.id)}}>精确离墙定位</button>{blocked&&<small>{blocked}</small>}</>:<div className="clearance-form">
      <b>离墙定位 · 单个设备</b>
      {session.picking?<p>点击画布上的墙面，或明确选择下方推荐项。仅沿墙面法向移动，保持角度。</p>:<button className="pick-wall-button" onClick={startPickingWall}>重新在画布选墙</button>}
      {session.picking&&recommended.length>0&&<div className="wall-recommendations"><small>附近可测墙面 · 点击才选用</small>{recommended.map(c=><button key={`${c.face.wallId}|${c.face.side}`} onClick={()=>selectWallFace(c.face.wallId,c.face.side)}>{c.label}<small>当前净距 {c.distance!.toFixed(1)} mm</small></button>)}</div>}
      <label>参考墙面<select aria-label="参考墙面" value={face?`${face.wallId}|${face.side}`:''} onChange={e=>{const c=choices.find(c=>`${c.face.wallId}|${c.face.side}`===e.target.value);if(c)selectWallFace(c.face.wallId,c.face.side)}}><option value="" disabled>请选择墙面（不自动切换）</option>{choices.map(c=><option key={`${c.face.wallId}|${c.face.side}`} value={`${c.face.wallId}|${c.face.side}`}>{c.label}{c.reason?' · 不适用':` · ${c.distance!.toFixed(1)}mm`}</option>)}</select></label>
      {!choices.length&&<p>场地中没有可见墙体，请先画墙。</p>}
      {distance!==undefined&&<p data-wall-distance>当前净距：{distance} mm</p>}{reason&&<p role="alert">{reason}</p>}
      <label>目标净距（mm）<input aria-label="目标净距（mm）" inputMode="decimal" value={input} onChange={e=>{setInput(e.target.value);clearWallPreview()}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();previewWallPlacement(input)}if(e.key==='Escape'){e.preventDefault();cancelWallPlacement()}}}/></label>
      <div className="site-actions"><button disabled={!face||!!reason||session.picking} onClick={()=>previewWallPlacement(input)}>预览移动</button><button disabled={session.target===null||!!reason||session.picking} onClick={confirmWallPlacement}>确认落位</button><button onClick={cancelWallPlacement}>取消定位</button></div>
      {session.target!==null&&<p>预览净距 {session.target} mm · 虚线轮廓尚未保存</p>}{state.error&&<p role="alert">{state.error}</p>}<small>0 表示接触墙面；仍检查实际穿透。Esc 取消。</small>
    </div>}
  </section>;
}
