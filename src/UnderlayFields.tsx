import { useState } from 'react';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { Underlay, Point } from './model';
import { NumberField } from './NumberField';
import { importImage, useImageAsset } from './imageAssets';
import { calibrate } from './siteExtras';
export default function UnderlayFields(){
 const s=useStore(),u=s.project.underlay,[busy,B]=useState(false),[error,E]=useState(''),[known,K]=useState(5000),asset=useImageAsset(u?.assetId);
 const patch=(p:Partial<Underlay>)=>{if(u)s.commit({...s.project,underlay:{...u,...p}})};
 const tool=(t:'underlay-move'|'underlay-calibrate')=>{if(useWorkspace.getState().view==='3d')useWorkspace.getState().set({view:'split'});s.setTool(t)};
 const load=async(file?:File)=>{if(!file)return;B(true);E('');const id=s.project.id;try{const result=await importImage(file),state=useStore.getState();if(state.project.id!==id)throw Error('项目已切换，请在当前项目重新导入');state.cancelInteraction();state.commit({...state.project,underlay:{assetId:result.asset.id,name:file.name,pixelWidth:result.width,pixelHeight:result.height,x:0,y:0,mmPerPixel:Math.min(state.project.width/result.width,state.project.height/result.height),rotation:0,opacity:.65,hidden:false,locked:true}})}catch(e){E((e as Error).message)}finally{B(false)}};
 return <details className="site-data" open={!!u}><summary>现场底图</summary><label className="btn">{busy?'保存图片中…':u?'替换 PNG/JPEG 底图':'导入 PNG/JPEG 底图'}<input aria-label="导入底图" hidden disabled={busy} type="file" accept="image/png,image/jpeg" onChange={e=>{void load(e.target.files?.[0]);e.target.value=''}}/></label>{u&&<>
  <p>{u.name} · {u.pixelWidth} × {u.pixelHeight}px</p><div className="site-actions"><button onClick={()=>patch({hidden:!u.hidden})}>{u.hidden?'显示底图':'隐藏底图'}</button><button onClick={()=>{s.cancelInteraction();patch({locked:!u.locked})}}>{u.locked?'解锁底图':'锁定底图'}</button></div>
  <label>底图透明度<input aria-label="底图透明度" type="range" min={0} max={1} step={.05} value={u.opacity} onChange={e=>patch({opacity:Number(e.target.value)})}/></label>
  <fieldset disabled={u.locked}><label>底图 X（mm）<NumberField value={u.x} onCommit={x=>patch({x})}/></label><label>底图 Y（mm）<NumberField value={u.y} onCommit={y=>patch({y})}/></label><label>底图旋转（°）<NumberField value={u.rotation} onCommit={rotation=>patch({rotation})}/></label><button disabled={u.hidden} onClick={()=>tool('underlay-move')}>拖动底图</button></fieldset>
  <button disabled={u.hidden||!asset.url} onClick={()=>tool('underlay-calibrate')}>两点校准</button>{s.tool==='underlay-calibrate'&&<><p>在图片上点选两个已知间距的点（已选 {s.calibrationPoints.length}/2）；校准不改变设备或场地坐标。</p><label>已知距离（mm）<NumberField value={known} min={1} onCommit={K}/></label><button disabled={s.calibrationPoints.length!==2} onClick={()=>{try{const next=calibrate(u,s.calibrationPoints as [Point,Point],known);if(s.commit({...s.project,underlay:next})){s.setTool('select');E('')}}catch(e){E((e as Error).message)}}}>应用校准</button></>}
  <p>{u.calibration?`已校准 ${u.calibration.distance}mm`:'未校准 · 当前仅适配场地'} · {u.mmPerPixel.toFixed(4)} mm/px</p><button onClick={()=>{s.cancelInteraction();s.commit({...useStore.getState().project,underlay:undefined})}}>移除底图</button><p>图片保存在本机；可撤销替换/移除。跨设备请用“项目包”，普通 JSON 不包含图片。</p>
 </>}{(error||asset.error)&&<p role="alert">{error||asset.error}</p>}</details>;
}
