import ToolMenu from './ToolMenu';
import EditorToolbar from './EditorToolbar';
import EquipmentLibrary from './EquipmentLibrary';
import { useCustomCatalog, catalogItemDefaults } from './customCatalog';
import WallPlacementBar from './WallPlacementBar';
import { useWallPlacement } from './wallPlacementState';
import { useEditorClipboard } from './editorClipboard';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProjectFiles from './ProjectFiles';
import { PlanningBar } from './PlanningFields';
import { usePlanning } from './planning';
import type { SceneHandle } from './Scene3D';
import SceneBoundary from './SceneBoundary';
import PresentationDialog, { PresentationDialogHandle } from './PresentationDialog';
import PlanEditor, { PlanHandle } from './PlanEditor';
import SplitView from './SplitView';
import SidebarResize from './SidebarResize';
import ShopWizardDialog from './ShopWizardDialog';
import ShopInsightsDialog from './ShopInsightsDialog';
import ConceptPlannerDialog from './ConceptPlannerDialog';
import { ComboPreset, comboPresets, placeCombo } from './combos';
import { seatSummary } from './layoutGroups';
import { Maximize2, Minimize2, ChevronUp, ChevronDown, Store, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, Undo2, Redo2, Save, Download, Share2 } from 'lucide-react';
import { useStore } from './store';
import { catalog, Item, resolveStyle } from './model';
import ProjectLibrary from './ProjectManager';
import { saveProject, useProjectSession } from './projectSession';
import { planningArea, sitePlacement } from './site';
import { isOpening, attachOpening } from './structure';
import { isAnnotation } from './annotations';
import PropertiesPanel from './PropertiesPanel';
import { useWorkspace } from './workspace';
import { useEditorKeyboard } from './useEditorKeyboard';
import { toolLabels } from './editorInteraction';

const Scene3D = lazy(() => import('./Scene3D'));
type CatalogItem = typeof catalog[number];
const m = (n: number) => (n / 1000).toFixed(2) + ' m';
const lightingText: Record<string, string> = { 'daylight': '自然光', 'warm-dining': '暖光营业', 'evening': '晚间灯光', 'clay': '白模' };

export default function App() {
  const s = useStore();
  const wallSession = useWallPlacement(s => s.session);
  const clipboard = useEditorClipboard();
  const sessionReady = useProjectSession(s => s.ready);
  const sessionBusy = useProjectSession(s => s.busy);
  const { project } = s;
  const style = resolveStyle(project);

  const prefs = useWorkspace(), { focusMode } = prefs;
  const view = focusMode ? (prefs.focusView ?? prefs.view) : prefs.view;
  const libraryOpen = !focusMode && prefs.libraryOpen;
  const propsOpen = !focusMode && prefs.propsOpen && (s.selectedIds.length > 0 || s.mode === 'site');
  const [sceneMounted, setSceneMounted] = useState(view !== '2d');
  useEffect(() => { if (view !== '2d') setSceneMounted(true); }, [view]);

  const toggleFocus = () => { s.cancelInteraction(); prefs.set({ focusMode: !focusMode, focusView: null }); };
  const V = (nextView: '2d' | 'split' | '3d') => { s.cancelInteraction(); prefs.set({ view: nextView, focusMode: false }); };
  const setLibraryOpen = (value: boolean | ((v: boolean) => boolean)) => prefs.set({ focusMode: false, libraryOpen: typeof value === 'function' ? value(libraryOpen) : value });
  const setPropsOpen = (value: boolean | ((v: boolean) => boolean)) => prefs.set({ focusMode: false, propsOpen: typeof value === 'function' ? value(propsOpen) : value });
  const multi = s.selectedIds;

  useEditorKeyboard();
  const [grid, G] = useState(true), [snap, S] = useState(true), [notice, notify] = useState('');
  const plan = useRef<PlanHandle>(null), scene = useRef<SceneHandle>(null);
  const presentationRef = useRef<PresentationDialogHandle>(null);
  const [librarySignal, setLibrarySignal] = useState(0);
  useEffect(() => { if (notice) { const timeout = setTimeout(() => notify(''), 4500); return () => clearTimeout(timeout); } }, [notice]);

  const seatsInfo = useMemo(() => seatSummary(project), [project.items, project.groups]);
  const save = () => { void saveProject(); };
  const png = () => plan.current?.exportPNG();

  const [takingGallery, setTakingGallery] = useState(false);
  const capture = async () => {
    const current = useWorkspace.getState(), previous = { view: current.view, focusMode: current.focusMode, focusView: current.focusView };
    try {
      setTakingGallery(true);
      prefs.set({ focusMode: false, view: 'split' });
      for (let attempt = 0; attempt < 30 && (!plan.current || !scene.current?.galleryReady()); attempt++) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 140))));
      if (!plan.current || !scene.current?.galleryReady()) throw Error('视图尚未就绪，请稍后重试');
      const gallery = scene.current.captureGallery();
      const image2D = await plan.current.capturePNG();
      return { plan: image2D, scene: gallery.birdseye, gallery };
    } finally { setTakingGallery(false); prefs.set(previous); }
  };

  const addFrom = useCallback((c: CatalogItem, point?: { x: number; y: number }) => {
    const state = useStore.getState(), proj = state.project, item = proj.items.find(i => i.id === state.selected), p = useWorkspace.getState(), planning = usePlanning.getState(), M = state.selectMany;
    const area = proj.planningAreas?.find(a => a.id === planning.activeId);
    const center = point ?? sitePlacement(area ? { ...proj, outline: area.outline } : proj, plan.current?.center() ?? { x: proj.width / 2, y: proj.height / 2 });
    const defaultWindowSill = c.model === 'storefront-window' ? 150 : c.model === 'serving-window' ? 950 : 900;
    let candidate: Item = {
      ...catalogItemDefaults(c),
      id: crypto.randomUUID(),
      x: center.x - c.w / 2,
      y: center.y - c.d / 2,
      rotation: 0,
      ...(c.kind === 'window' ? { sill: defaultWindowSill } : {}),
      ...(c.kind === 'utility' ? { pointType: 'power' as const, verification: 'pending' as const } : ['column', 'fixture'].includes(c.kind) ? { verification: 'pending' as const } : {}),
    };
    try {
      if (isOpening(candidate)) {
        candidate = proj.items.some(i => i.kind === 'wall')
          ? attachOpening(proj, candidate, center, item?.kind === 'wall' ? item.id : item?.wallId, !!point, snap ? p.snapSize : 0)
          : { ...candidate, freeStanding: true, sill: candidate.kind === 'window' ? defaultWindowSill : 0 };
      } else if (snap) {
        candidate.x = Math.round(candidate.x / p.snapSize) * p.snapSize;
        candidate.y = Math.round(candidate.y / p.snapSize) * p.snapSize;
      }
      const id = state.addItem(candidate);
      if (id) {
        M([id]);
        state.setTool('select');
        if (isOpening(candidate) && candidate.freeStanding) notify('已添加独立门窗；绘制墙体后，可在属性中选择所属墙体生成开口');
      }
    } catch (e) { notify((e as Error).message); }
  }, [snap]);

  const addCombo = useCallback((combo: ComboPreset, point?: { x: number; y: number }) => {
    try {
      placeCombo(combo, point, point === undefined);
      notify(`已放置「${combo.name}」（整组可一起拖动与旋转，双击可单件微调）`);
    } catch (e) {
      notify((e as Error).message);
    }
  }, []);

  const dropItem = useCallback((name: string, kind: string, point: { x: number; y: number }, id?: string) => {
    const c = [...catalog, ...useCustomCatalog.getState().entries].find(c => id ? c.id === id : c.name === name && c.kind === kind);
    if (c) addFrom(c, point);
  }, [addFrom]);

  const dropCombo = useCallback((comboId: string, point: { x: number; y: number }) => {
    const combo = comboPresets.find(c => c.id === comboId);
    if (combo) addCombo(combo, point);
  }, [addCombo]);

  return <main className={`app ${focusMode ? 'is-focused' : ''}`}>
    <header className="topbar">
      <div className="brand">
        <Store />
        <div>
          <h1>铺位规划 Studio</h1>
          <small>餐饮开店 · 2D 平面与 3D 效果图</small>
        </div>
      </div>
      <ShopWizardDialog notify={notify} />
      <ProjectLibrary />
      <input disabled={!sessionReady || sessionBusy} className="project-title" aria-label="项目名称" value={project.name} onChange={e => s.commit({ ...project, name: e.target.value })} />
      <div className="actions" inert={!sessionReady || sessionBusy}>
        <ConceptPlannerDialog notify={notify} />
        <ShopInsightsDialog />
        <button className="share-partner-btn" title="一键拍摄 2D 平面 + 3 视角 3D 效果图，生成可发给合伙人讨论的精美方案书" onClick={() => presentationRef.current?.open()}>
          <Share2 />发给合伙人
        </button>
        <button disabled={!s.past.length && !wallSession} title={wallSession ? '取消未确认的离墙定位' : '撤销上一步编辑'} onClick={() => s.undo()}><Undo2 />撤销</button>
        <button disabled={!s.future.length && !wallSession} title={wallSession ? '取消未确认的离墙定位' : '重做编辑'} onClick={() => s.redo()}><Redo2 />重做</button>
        <button onClick={save}><Save />保存</button>
        <ToolMenu label="导出与汇报" dismissOnAction>
          <div className="menu-action-list">
            <ProjectFiles notify={notify} />
            <button className="primary" disabled={view === '3d'} onClick={png}><Download />导出 2D 平面图 PNG</button>
            <PresentationDialog ref={presentationRef} capture={capture} />
          </div>
        </ToolMenu>
      </div>
    </header>

    <div inert={!sessionReady || sessionBusy} className={`workspace ${libraryOpen ? '' : 'library-closed'} ${propsOpen ? '' : 'props-closed'}`} style={{ '--library-width': `${prefs.libraryWidth}px`, '--props-width': `${prefs.propsWidth}px` } as React.CSSProperties}>
      <EquipmentLibrary onAdd={addFrom} onAddCombo={addCombo} savedSignal={librarySignal} />
      {libraryOpen && <SidebarResize side="library" />}
      <section className="editor">
        <div className="editor-heading">
          <div className="workspace-controls">
            <button title={libraryOpen ? '收起素材库' : '展开素材库'} aria-label="切换设备库" aria-pressed={libraryOpen} onClick={() => setLibraryOpen(v => !v)}>{libraryOpen ? <PanelLeftClose /> : <PanelLeftOpen />}</button>
            <button className="site-settings-button" onClick={() => { s.setMode('site'); setPropsOpen(true); }}>铺位与装修风格</button>
          </div>
          <div className="tabs" aria-label="画布视图">
            {(['2d', 'split', '3d'] as const).map(v => (
              <button key={v} aria-pressed={view === v} className={view === v ? 'on' : ''} onClick={() => V(v)}>{v === '2d' ? '2D 平面' : v === '3d' ? '3D 效果图' : '2D + 3D 分屏'}</button>
            ))}
          </div>
          <button className="tools-toggle" aria-label={prefs.toolsOpen && !focusMode ? '收起工具区' : '展开工具区'} aria-expanded={prefs.toolsOpen && !focusMode} aria-controls="editor-tools" onClick={() => prefs.set({ focusMode: false, toolsOpen: focusMode ? true : !prefs.toolsOpen })}>{prefs.toolsOpen && !focusMode ? <ChevronUp /> : <ChevronDown />}</button>
          <button className="focus-toggle" title="专注画布 · F；Esc 退出" aria-pressed={focusMode} onClick={toggleFocus}>{focusMode ? <Minimize2 /> : <Maximize2 />}{focusMode ? '退出专注' : '专注画布'}</button>
          <button aria-label="切换属性面板" title={propsOpen ? '收起属性面板' : '展开属性面板'} aria-pressed={propsOpen} onClick={() => { if (!propsOpen && !s.selectedIds.length) s.setMode('site'); setPropsOpen(!propsOpen); }}>{propsOpen ? <PanelRightClose /> : <PanelRightOpen />}</button>
        </div>
        <div id="editor-tools" className="editor-tools" hidden={view === '3d' || !prefs.toolsOpen || focusMode} role="region" aria-label="绘图工具">
          <EditorToolbar grid={grid} snap={snap} onGrid={() => G(v => !v)} onSnap={() => S(v => !v)} />
        </div>
        <PlanningBar />
        <WallPlacementBar />
        <div className="canvas-context" hidden={s.tool === 'select'}>
          <span>{toolLabels[s.tool]} · {multi.length ? `已选 ${multi.length} 项` : '未选择'}</span>
          {s.tool !== 'select' && <button onClick={() => s.cancelInteraction()}>退出工具 · Esc</button>}
        </div>
        <SplitView
          key={project.id}
          view={view}
          first={
            <div className="plan">
              <div className="viewtitle"><b>2D</b><span>平面布局</span><small>{m(project.width)} × {m(project.height)} · 拖放素材或组合</small></div>
              <PlanEditor active={view !== '3d'} ref={plan} grid={grid} snap={snap} notify={notify} onDropItem={dropItem} onDropCombo={dropCombo} />
            </div>
          }
          second={
            <div className="three">
              <div className="viewtitle"><b>3D</b><span>实时效果图</span><small>{lightingText[style.lightingPreset]} · 门头外观 / 进店漫游 / 灯光切换</small></div>
              <SceneBoundary>
                {sceneMounted && (
                  <Suspense fallback={<div className="scene-loading">正在加载三维渲染引擎…</div>}>
                    <Scene3D ref={scene} takingGallery={takingGallery} snap={snap} active={view !== '2d'} />
                  </Suspense>
                )}
              </SceneBoundary>
            </div>
          }
        />
        <footer role="status">
          <span>{s.error || notice || clipboard.message || (multi.length ? `已选 ${multi.length} 个对象` : '就绪 · 可从素材库拖入桌椅和设备')}</span>
          <span className="project-count">
            <b>{seatsInfo.seats} 座</b> · {project.survey && '实测净面积 '}{(planningArea(project) / 1e6).toFixed(2)} ㎡ · {project.items.filter(i => i.kind !== 'zone' && !isAnnotation(i)).length} 件 · {lightingText[style.lightingPreset]}
          </span>
        </footer>
      </section>
      {propsOpen && <SidebarResize side="props" />}
      <PropertiesPanel onSavedSpec={() => { setLibrarySignal(n => n + 1); prefs.set({ libraryOpen: true, leftTab: 'catalog', focusMode: false }); }} onEditOutline={draw => { if (view === '3d') V('split'); s.setTool(draw ? 'outline-draw' : 'outline-edit'); }} />
    </div>
  </main>;
}
