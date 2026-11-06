import { useStore } from './store';
import { usePlanning } from './planning';
import { useWorkspace } from './workspace';
import { polygonArea } from './site';
export function PlanningBar(){
 const s=useStore(),state=usePlanning(),areas=s.project.planningAreas??[];
 if(!areas.length&&s.mode!=='site')return null;
 return <div className="planning-bar"><label>规划范围<select aria-label="当前规划范围" value={areas.some(a=>a.id===state.activeId)?state.activeId??'':''} onChange={e=>{s.cancelInteraction();s.selectMany([]);state.set({activeId:e.target.value||null})}}><option value="">整场地</option>{areas.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{areas.some(a=>a.id===state.activeId)&&<label><input type="checkbox" checked={state.protect} onChange={e=>{s.cancelInteraction();state.set({protect:e.target.checked})}}/>范围外保护</label>}<button onClick={()=>{s.setMode('site');useWorkspace.getState().set({propsOpen:true,focusMode:false})}}>场地资料 / 范围</button></div>;
}
export default function PlanningFields(){
 const s=useStore(),state=usePlanning(),area=s.project.planningAreas?.find(a=>a.id===state.activeId);
 const tool=(draw:boolean)=>{if(useWorkspace.getState().view==='3d')useWorkspace.getState().set({view:'split'});s.setTool(draw?'planning-draw':'planning-edit')};
 return <details className="site-data"><summary>独立规划范围 · {s.project.planningAreas?.length??0} 个</summary><p>规划范围不改变整场地或功能分区；切换时设备世界坐标保持不变。</p><button onClick={()=>tool(true)}>绘制新规划范围</button>{area&&<><label>规划范围名称<input value={area.name} onChange={e=>s.commit({...s.project,planningAreas:s.project.planningAreas!.map(a=>a.id===area.id?{...a,name:e.target.value}:a)})}/></label><label>规划范围颜色<input type="color" value={area.color} onChange={e=>s.commit({...s.project,planningAreas:s.project.planningAreas!.map(a=>a.id===area.id?{...a,color:e.target.value}:a)})}/></label><p>范围面积：{(polygonArea(area.outline)/1e6).toFixed(2)} ㎡ · 规划线仅定义本次工作边界，不裁切地面</p><div className="site-actions"><button onClick={()=>tool(false)}>调整规划边界</button><button onClick={()=>{s.cancelInteraction();if(s.commit({...s.project,planningAreas:s.project.planningAreas!.filter(a=>a.id!==area.id)}))state.set({activeId:null})}}>删除此规划范围</button></div><label><input type="checkbox" checked={state.dim} onChange={e=>state.set({dim:e.target.checked})}/>淡化范围外物件</label><p>保护开启时，只有完整位于范围内的物件可编辑；门窗同时遵守所属墙体规则。需要调整区外物件时切回整场地。</p></>}</details>;
}
