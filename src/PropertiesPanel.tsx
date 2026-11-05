import LayoutItemFields from './LayoutItemFields';
import RotationFields from './RotationFields';
import SiteObjectFields from './SiteObjectFields';
import { isSiteObject } from './siteObjects';
import { polygonArea } from './site';
import { zoneCorners } from './zones';
import { PanelRightClose, LockOpen, Trash2 } from 'lucide-react';
import { useStore } from './store';
import { NumberField } from './NumberField';
import StructureFields from './StructureFields';
import SiteFields from './SiteFields';
import { isAnnotation } from './annotations';
import AnnotationFields from './AnnotationFields';
import ZoneFields from './ZoneFields';
import BatchProperties from './BatchProperties';
import { isBuilding } from './structure';
import { isEditable, isVisible } from './editorInteraction';
import { planningEditable, usePlanning } from './planning';
import { useWorkspace } from './workspace';
export default function PropertiesPanel({onEditOutline}:{onEditOutline:(draw?:boolean)=>void}){
 const s=useStore(),{project,selected,selectedIds:multi}=s,M=s.selectMany,item=project.items.find(i=>i.id===selected),prefs=useWorkspace();usePlanning();
 return <aside className="props" hidden={!prefs.propsOpen}><div className="panel-heading"><div><h3>{multi.length>1?`批量属性 · ${multi.length} 项`:item?'对象属性':'场地设置'}</h3><p>{item?'尺寸单位：mm':'单层场地 · 毫米'}</p></div><button aria-label="收起属性面板" onClick={()=>prefs.set({propsOpen:false})}><PanelRightClose/></button></div>
 {s.error&&<p className="property-error" role="alert">{s.error}</p>}
 {multi.length===1&&item&&<><p className="selection-note">{item.name}{item.wallId?` · 所属墙体：${project.items.find(w=>w.id===item.wallId)?.name}`:''}</p>{!planningEditable(item,project)&&<p className="selection-note">此对象在当前规划范围外，已保护。切回整场地或关闭范围外保护后可编辑。</p>}{!isVisible(item,project)&&<p>对象或所属墙体已隐藏，请从对象列表显示后编辑。</p>}{item.locked&&<button onClick={()=>s.setFlags([item.id],{locked:false})}><LockOpen/>解锁对象</button>}{item.wallId&&project.items.find(w=>w.id===item.wallId)?.locked&&<button onClick={()=>s.select(item.wallId!)}>所属墙体已锁定 · 选择墙体</button>}</>}
 {multi.length>1?<BatchProperties/>:item ? <fieldset key={item.id} disabled={!!s.placement||!isEditable(item,project)}>{!isAnnotation(item)&&<label>名称<input value={item.name} onChange={e => s.update(item.id, { name: e.target.value })}/></label>}{!item.measure&&<RotationFields item={item}/>}{isAnnotation(item)?<AnnotationFields item={item}/>:isBuilding(item)?<StructureFields item={item}/>:<>{item.kind !== 'zone' && <><label>长度（mm）<NumberField value={item.w} min={1} onCommit={n => s.update(item.id, { w: n })}/></label><label>宽度（mm）<NumberField value={item.d} min={1} onCommit={n => s.update(item.id, { d: n })}/></label><label>高度（mm）<NumberField value={item.h} min={0} onCommit={n => s.update(item.id, { h: n })}/></label></>}{item.kind === 'zone' && <><label>区域长度（mm）<NumberField value={item.w} min={1} onCommit={n => s.update(item.id, { w: Math.max(100, n) })}/></label><label>区域宽度（mm）<NumberField value={item.d} min={1} onCommit={n => s.update(item.id, { d: Math.max(100, n) })}/></label><p>区域面积：{(polygonArea(zoneCorners(item)) / 1e6).toFixed(2)} ㎡</p></>}<label>X 坐标（mm）<NumberField value={item.x} onCommit={n => s.update(item.id, { x: n })}/></label><label>Y 坐标（mm）<NumberField value={item.y} onCommit={n => s.update(item.id, { y: n })}/></label><label>颜色<input type="color" value={item.color} onChange={e => s.update(item.id, { color: e.target.value })}/></label></>}<LayoutItemFields item={item}/>{isSiteObject(item)&&<SiteObjectFields item={item}/>} {!isAnnotation(item)&&<><ZoneFields key={item.id} item={item}/>{item.kind!=='zone'&&<p>外包占地：{(item.w*item.d/1e6).toFixed(2)} ㎡</p>}</>}<button className="delete" onClick={() => { s.removeMany(multi.length ? multi : [item.id]); M([]); }}><Trash2 />删除选中对象</button></fieldset> : <SiteFields onEdit={onEditOutline}/>}</aside>;
}
