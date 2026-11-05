import LayoutTools from './LayoutTools';
import { alignChanges } from './layoutGroups';
import { layoutAction } from './layoutCommands';
import { useEffect, useRef, useState } from 'react';
import ProjectFiles from './ProjectFiles';
import { PlanningBar } from './PlanningFields';
import { usePlanning } from './planning';
import Scene3D, { SceneHandle } from './Scene3D';
import SceneBoundary from './SceneBoundary';
import PresentationDialog from './PresentationDialog';
import PlanEditor, { PlanHandle } from './PlanEditor';
import SplitView from './SplitView';
import CatalogThumbnail from './CatalogThumbnail';
import { Layers, Plus, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, Search, Undo2, Redo2, Save, Download, Trash2, Copy, AlignLeft, ArrowLeftRight, LockKeyhole, LockOpen } from 'lucide-react';
import { useStore } from './store';
import { catalog, Item, modelOf } from './model';
import ProjectLibrary from './ProjectManager';
import { saveProject, useProjectSession } from './projectSession';
import { siteArea, sitePlacement } from './site';
import { isOpening, attachOpening } from './structure';
import ObjectList from './ObjectList';
import CustomItemDialog from './CustomItemDialog';
import { isAnnotation } from './annotations';
import { EditorTool } from './editorInteraction';
import GridSettings from './GridSettings';
import CustomCatalogActions from './CustomCatalogActions';
import PropertiesPanel from './PropertiesPanel';
import { useWorkspace } from './workspace';
import { useEditorKeyboard } from './useEditorKeyboard';
import { modeLabels, toolLabels } from './editorInteraction';

type CatalogItem = typeof catalog[number];
const m = (n: number) => (n / 1000).toFixed(2) + ' m';
export default function App() {
    const s = useStore();
    const sessionReady = useProjectSession(s=>s.ready);
    const sessionBusy = useProjectSession(s=>s.busy);
    const { project, selected } = s;
    const planning=usePlanning();
    const prefs=useWorkspace(),{view,libraryOpen,propsOpen,leftTab}=prefs;
    const V=(view:'2d'|'split'|'3d')=>{s.cancelInteraction();prefs.set({view})};
    const setLibraryOpen=(value:boolean|((v:boolean)=>boolean))=>prefs.set({libraryOpen:typeof value==='function'?value(libraryOpen):value});
    const setPropsOpen=(value:boolean|((v:boolean)=>boolean))=>prefs.set({propsOpen:typeof value==='function'?value(propsOpen):value});
    const multi=s.selectedIds,M=s.selectMany;
    const allLocked=multi.length>0&&project.items.filter(i=>multi.includes(i.id)).every(i=>i.locked);
    useEditorKeyboard();
    const [grid, G] = useState(true), [snap, S] = useState(true), [notice, notify] = useState(''), [custom, C] = useState<CatalogItem[]>(() => { try {
        const rows = JSON.parse(localStorage.getItem('canteen-custom-items') || '[]');
        return Array.isArray(rows) ? rows.filter(c => c && catalog.some(d => d.kind === c.kind) && typeof c.name === 'string' && [c.w, c.d, c.h].every(n => typeof n === 'number' && Number.isFinite(n) && n > 0) && /^#[0-9a-f]{6}$/i.test(c.color)).map(c=>({...c,id:typeof c.id==='string'?c.id:crypto.randomUUID()})) : [];
    }
    catch {
        return [];
    } });
    const plan=useRef<PlanHandle>(null),scene=useRef<SceneHandle>(null),item=project.items.find(i=>i.id===selected);
    const [search,setSearch]=useState(''),[category,setCategory]=useState('全部分类');
    useEffect(()=>{if(notice){const timeout=setTimeout(()=>notify(''),4500);return()=>clearTimeout(timeout)}},[notice]);
    const save = () => { void saveProject(); };
    const png=()=>plan.current?.exportPNG();
    const capture=async()=>{const previous=useWorkspace.getState().view;try{if(previous==='2d')prefs.set({view:'split'});await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,120))));if(!plan.current||!scene.current)throw Error('视图尚未就绪，请稍后重试');const image3D=scene.current.capturePNG(),image2D=await plan.current.capturePNG();return {plan:image2D,scene:image3D}}finally{if(previous==='2d')prefs.set({view:previous})}};
    const alignLeft=()=>layoutAction(()=>s.updateMany(alignChanges(project,multi)));
    const distributeX=()=>layoutAction(()=>s.updateMany(alignChanges(project,multi,true)));
    const duplicate=()=>{const ids=s.duplicate(multi.length?multi:selected?[selected]:[]);if(ids.length)M(ids)};
    const addZone=()=>{if(view==='3d')V('split');s.setTool('zone')};
    const groups = Array.from(new Set([...catalog.map(c => c.group), ...(custom.length ? ['我的物件'] : [])])).sort((a,b)=>a==='空间构件'?-1:b==='空间构件'?1:0);
    const matches=(c:CatalogItem)=>c.name.includes(search.trim())&&(category==='全部分类'||(custom.includes(c)?'我的物件':c.group)===category);
    const count=[...catalog,...custom].filter(matches).length;
    const addFrom = (c: CatalogItem, point?: {
        x: number;
        y: number;
    }) => {
      const area=project.planningAreas?.find(a=>a.id===planning.activeId);const center=point??sitePlacement(area?{...project,outline:area.outline}:project,plan.current?.center()??{x:project.width/2,y:project.height/2});
      let candidate:Item={id:crypto.randomUUID(),model:modelOf(c),kind:c.kind,name:c.name,w:c.w,d:c.d,h:c.h,color:c.color,seats:c.seats,x:center.x-c.w/2,y:center.y-c.d/2,rotation:0,...(c.kind==='utility'?{pointType:'power' as const,verification:'pending' as const}:['column','fixture'].includes(c.kind)?{verification:'pending' as const}:{})};
      try{if(isOpening(candidate))candidate=project.items.some(i=>i.kind==='wall'&&!i.locked&&!i.hidden)?attachOpening(project,candidate,center,item?.kind==='wall'?item.id:item?.wallId,!!point,snap?prefs.snapSize:0):{...candidate,freeStanding:true,sill:candidate.kind==='window'?900:0};else if(snap){candidate.x=Math.round(candidate.x/prefs.snapSize)*prefs.snapSize;candidate.y=Math.round(candidate.y/prefs.snapSize)*prefs.snapSize}
       const id=s.addItem(candidate);if(id){M([id]);s.setTool('select')}
      }catch(e){notify((e as Error).message)}
    };
    const persistCustom=(next:CatalogItem[])=>{C(next);try{localStorage.setItem('canteen-custom-items',JSON.stringify(next));notify('物件库已保存；场景中的已有物件保持原样')}catch{notify('本次物件库已更新，但浏览器保存失败')}};
    const makeCustom=(entry:CatalogItem)=>{const next={...entry,id:entry.id??crypto.randomUUID()};persistCustom(custom.some(c=>c.id===next.id)?custom.map(c=>c.id===next.id?next:c):[...custom,next])};
    return <main className="app"><header className="topbar"><div className="brand"><Layers /><div><b>空间规划 Studio</b><small>食堂 · 餐饮 · 商业空间</small></div></div><ProjectLibrary/><input disabled={!sessionReady||sessionBusy} className="project-title" aria-label="项目名称" value={project.name} onChange={e => s.commit({ ...project, name: e.target.value })}/><div className="actions" inert={!sessionReady||sessionBusy}><button disabled={!s.past.length} onClick={() => { s.undo(); M([]); }}><Undo2 />撤销</button><button disabled={!s.future.length} onClick={() => { s.redo(); M([]); }}><Redo2 />重做</button><button onClick={save}><Save />保存</button><ProjectFiles notify={notify}/><button className="primary" disabled={view === '3d'} onClick={png}><Download />PNG</button><PresentationDialog capture={capture}/></div></header>
    <div inert={!sessionReady||sessionBusy} className={`workspace ${libraryOpen?'':'library-closed'} ${propsOpen?'':'props-closed'}`}><aside className="library" hidden={!libraryOpen}><div className="panel-heading"><div><h3>{leftTab==='objects'?'场景对象':'设备与空间构件'}</h3><p>{leftTab==='objects'?'搜索、选择、显隐与锁定':'点击添加 · 拖入画布放置'}</p></div><button title="收起设备库" aria-label="收起设备库" onClick={()=>setLibraryOpen(false)}><PanelLeftClose/></button></div><div className="sidebar-tabs" role="tablist" aria-label="左侧面板"><button role="tab" aria-selected={leftTab==='catalog'} onClick={()=>prefs.set({leftTab:'catalog'})}>设备库</button><button role="tab" aria-selected={leftTab==='objects'} onClick={()=>prefs.set({leftTab:'objects'})}>对象列表</button></div>{leftTab==='objects'?<ObjectList/>:<><label className="catalog-search"><Search/><input aria-label="搜索设备" placeholder="搜索设备名称" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="catalog-filter"><select aria-label="设备分类" value={category} onChange={e=>setCategory(e.target.value)}>{['全部分类',...groups].map(g=><option key={g}>{g}</option>)}</select><small>{count} 项</small></div>{groups.filter(g=>(g==='我的物件'?custom:catalog.filter(c=>c.group===g)).some(matches)).map(g => <section key={g}><h4>{g}</h4><div className="catalog">{(g === '我的物件' ? custom : catalog.filter(c => c.group === g)).filter(matches).map(c => <div className="catalog-entry" key={c.id??c.name}><button draggable onDragStart={e => { e.dataTransfer.setData('application/canteen-item', JSON.stringify(c)); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addFrom(c)}><CatalogThumbnail item={c}/><b>{c.name}</b><small>{c.w} × {c.d} × {c.h} mm</small></button>{custom.includes(c)&&<CustomCatalogActions entry={c} onSave={makeCustom} onDelete={()=>persistCustom(custom.filter(v=>v.id!==c.id))}/>}</div>)}</div></section>)}{count===0&&<p className="empty-state">没有匹配的设备</p>}<CustomItemDialog onAdd={makeCustom}/></>}</aside>
    <section className="editor">
      <div className="editor-heading"><div className="workspace-controls"><button title={libraryOpen?'收起设备库':'展开设备库'} aria-label="切换设备库" aria-pressed={libraryOpen} onClick={()=>setLibraryOpen(v=>!v)}>{libraryOpen?<PanelLeftClose/>:<PanelLeftOpen/>}</button><b>布局工作台</b><button className="site-settings-button" onClick={()=>{s.setMode('site');setPropsOpen(true)}}>场地设置</button></div><div className="tabs" aria-label="画布视图">{(['2d','split','3d'] as const).map(v=><button key={v} aria-pressed={view===v} className={view===v?'on':''} onClick={()=>V(v)}>{v==='2d'?'2D 编辑':v==='3d'?'3D 预览':'分屏'}</button>)}</div><button aria-label="切换属性面板" title={propsOpen?'收起属性面板':'展开属性面板'} aria-pressed={propsOpen} onClick={()=>setPropsOpen(v=>!v)}>{propsOpen?<PanelRightClose/>:<PanelRightOpen/>}</button></div>
      <div className="mode-strip"><div className="mode-tabs" aria-label="编辑模式">{(['layout','structure','site'] as const).map(mode=><button key={mode} aria-pressed={s.mode===mode} onClick={()=>{if(view==='3d')V('split');s.setMode(mode);if(mode==='site')setPropsOpen(true)}}>{modeLabels[mode]}</button>)}</div><span role="status">{view==='3d'?'三维查看':`${modeLabels[s.mode]} · ${toolLabels[s.tool]}`}</span>{s.tool!=='select'&&<button onClick={()=>s.cancelInteraction()}>取消工具 · Esc</button>}</div>
      <PlanningBar/><LayoutTools/><nav className="edit-actions" aria-label="编辑操作"><button hidden={s.mode!=='structure'} onClick={()=>{if(view==='3d')V('split');s.setTool('wall')}}>画墙</button><button hidden={s.mode!=='structure'} onClick={()=>{if(view==='3d')V('split');s.setTool('partition')}}>隔断</button><button hidden={s.mode!=='layout'} onClick={addZone}><Plus/>区域</button>{s.mode==='layout'&&<button onClick={()=>{if(view==='3d')V('split');s.setTool('zone-draw')}}>多边形分区</button>}{s.mode==='layout'&&<select aria-label="添加标注" value={['text','dimension','leader'].includes(s.tool)?s.tool:''} onChange={e=>{if(view==='3d')V('split');s.setTool((e.target.value||'select') as EditorTool)}}><option value="">标注…</option><option value="text">文字</option><option value="dimension">尺寸</option><option value="leader">引线</option></select>}{s.mode==='site'&&<><button onClick={()=>s.setTool('outline-edit')}>调整轮廓</button><button onClick={()=>s.setTool('outline-draw')}>绘制轮廓</button></>}<div className="toolbar-divider"/><button disabled={!!s.placement||!multi.length} onClick={duplicate} title="复制选中物件"><Copy/>复制</button><button disabled={!!s.placement||!multi.length} onClick={()=>{s.removeMany(multi);M([])}} title="删除未锁定的选中物件"><Trash2/>删除</button><button disabled={!!s.placement||!item} onClick={()=>s.setFlags(multi,{locked:!allLocked})}>{allLocked?<LockOpen/>:<LockKeyhole/>}{multi.length>1?(allLocked?'全部解锁':'全部锁定'):(allLocked?'解锁':'锁定')}</button><div className="toolbar-divider"/><button disabled={multi.length<2} onClick={alignLeft} title="左对齐（旋转边界；门窗随墙）"><AlignLeft/></button><button disabled={multi.length<3} onClick={distributeX} title="水平等距（旋转边界；门窗随墙）"><ArrowLeftRight/></button><div className="toolbar-spacer"/><button aria-pressed={grid} disabled={view==='3d'} onClick={()=>G(v=>!v)}>网格</button><button aria-pressed={snap} onClick={()=>S(v=>!v)}>吸附 · {prefs.snapSize}mm</button><GridSettings/></nav>
      <SplitView key={project.id} view={view} first={<div className="plan"><div className="viewtitle"><b>2D</b><span>平面编辑</span><small>{m(project.width)} × {m(project.height)}</small></div><PlanEditor ref={plan} grid={grid} snap={snap} notify={notify} onDropItem={(name,kind,point,id)=>{const c=[...catalog,...custom].find(c=>id?c.id===id:c.name===name&&c.kind===kind);if(c)addFrom(c,point)}}/></div>} second={<div className="three"><div className="viewtitle"><b>3D</b><span>实时预览</span><small>点击选择 · 滚轮缩放</small></div><SceneBoundary><Scene3D ref={scene} snap={snap} active={view!=='2d'}/></SceneBoundary></div>}/>
      <footer role="status"><span>{s.error||notice|| (multi.length?`已选 ${multi.length} 个对象 · Shift 点击增减选择`:'选择设备开始编辑 · Shift 多选 · Ctrl/⌘ Z 撤销')}</span><span>{project.items.filter(i=>i.kind!=='zone'&&!isAnnotation(i)).length} 个对象 · {(siteArea(project)/1e6).toFixed(2)} ㎡</span></footer>
    </section>
    <PropertiesPanel onEditOutline={draw=>{if(view==='3d')V('split');s.setTool(draw?'outline-draw':'outline-edit')}}/></div></main>;
}
