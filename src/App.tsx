import ImageExport from './ImageExport';
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
import PresentationDialog from './PresentationDialog';
import PlanEditor, { PlanHandle } from './PlanEditor';
import SplitView from './SplitView';
import SidebarResize from './SidebarResize';
import BasicDraftBar from './BasicDraftBar';
import UnderlayQuickFrameBar from './UnderlayQuickFrameBar';
import ShopWizardDialog from './ShopWizardDialog';
import ShopInsightsDialog from './ShopInsightsDialog';
import ConceptPlannerDialog from './ConceptPlannerDialog';
import { ComboPreset, comboPresets, placeCombo } from './combos';
import { analyzeShop } from './shopAnalytics';
import { checkSpace } from './spaceChecks';
import { Maximize2, Minimize2, Store, PanelLeftClose, PanelRightClose, PanelLeftOpen, PanelRightOpen, Undo2, Redo2, Save, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useStore } from './store';
import { catalog, Item } from './model';
import ProjectLibrary from './ProjectManager';
import { saveProject, useProjectSession } from './projectSession';
import { planningArea, sitePlacement } from './site';
import { isOpening, attachOpening } from './structure';
import PropertiesPanel from './PropertiesPanel';
import { useWorkspace } from './workspace';
import { useEditorKeyboard } from './useEditorKeyboard';
import { toolLabels } from './editorInteraction';

const Scene3D = lazy(() => import('./Scene3D'));
type CatalogItem = typeof catalog[number];

export default function App() {
  const s = useStore();
  const wallSession = useWallPlacement(s => s.session);
  const clipboard = useEditorClipboard();
  const sessionReady = useProjectSession(s => s.ready);
  const sessionBusy = useProjectSession(s => s.busy);
  const { project } = s;

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
  const wizardTrigger = useRef<HTMLButtonElement>(null);
  const multi = s.selectedIds;

  useEditorKeyboard();
  const [grid, G] = useState(true), [snap, S] = useState(true), [notice, notify] = useState('');
  const plan = useRef<PlanHandle>(null), scene = useRef<SceneHandle>(null);
  const [librarySignal, setLibrarySignal] = useState(0);
  const [conceptSignal, setConceptSignal] = useState(0);
  const [insightsSignal, setInsightsSignal] = useState(0);
  const [draftCompareSignal, setDraftCompareSignal] = useState(0);
  useEffect(() => { if (notice) { const timeout = setTimeout(() => notify(''), 4500); return () => clearTimeout(timeout); } }, [notice]);

  const activeAreaId = usePlanning(state => state.activeId);
  // During a drag, inspect the committed layout until the gesture finishes.
  const inspectionProject = s.gesture ?? project;
  const insights = useMemo(() => analyzeShop(inspectionProject), [inspectionProject]);
  const issues = useMemo(() => checkSpace(inspectionProject, activeAreaId)
    .sort((a, b) => Number(a.type === '参考净距') - Number(b.type === '参考净距')),
    [inspectionProject, activeAreaId]);
  const criticalCount = issues.filter(issue => issue.type !== '参考净距').length;

  const save = () => { void saveProject(); };
  const png = () => plan.current?.exportPNG();

  const [takingGallery, setTakingGallery] = useState(false);
  async function withExportViews<T>(take: (plan: PlanHandle, scene: SceneHandle) => Promise<T>) {
    const current = useWorkspace.getState(), previous = { view: current.view, focusMode: current.focusMode, focusView: current.focusView };
    try {
      setTakingGallery(true);
      prefs.set({ focusMode: false, view: 'split' });
      for (let attempt = 0; attempt < 30 && (!plan.current || !scene.current?.galleryReady()); attempt++) {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
      }
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 140))));
      if (!plan.current || !scene.current?.galleryReady()) throw Error('视图尚未就绪，请稍后重试');
      return await take(plan.current, scene.current);
    } finally { setTakingGallery(false); prefs.set(previous); }
  }
  const capture = () => withExportViews(async (flat, scene) => {
    const gallery = { birdseye: scene.captureShot('birdseye'), interior: scene.captureShot('interior'), storefront: scene.captureShot('storefront') };
    return { plan: await flat.capturePNG(), scene: gallery.birdseye, gallery };
  });

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
      notify(`已放置「${combo.name}」（整组可一起拖动，按 R 旋转 90°，双击单件微调）`);
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
        <h1>铺位规划</h1>
      </div>
      <ShopWizardDialog trigger={wizardTrigger} notify={notify} />
      <ProjectLibrary />
      <input disabled={!sessionReady || sessionBusy} className="project-title" aria-label="项目名称" value={project.name} onChange={e => s.commit({ ...project, name: e.target.value })} />
      <div className="tabs" aria-label="画布视图">
        {(['2d', 'split', '3d'] as const).map(v => (
          <button key={v} aria-pressed={view === v} className={view === v ? 'on' : ''} onClick={() => V(v)}>{v === '2d' ? '2D 平面' : v === '3d' ? '3D 效果图' : '2D + 3D 分屏'}</button>
        ))}
      </div>
      <div className="actions" inert={!sessionReady || sessionBusy}>
        <ConceptPlannerDialog notify={notify} openSignal={conceptSignal} />
        <ShopInsightsDialog openSignal={insightsSignal} insights={insights} issues={issues} criticalCount={criticalCount} />
        <button disabled={!s.past.length && !wallSession} title={wallSession ? '取消未确认的离墙定位' : '撤销上一步编辑'} onClick={() => s.undo()}><Undo2 />撤销</button>
        <button disabled={!s.future.length && !wallSession} title={wallSession ? '取消未确认的离墙定位' : '重做编辑'} onClick={() => s.redo()}><Redo2 />重做</button>
        <button onClick={save}><Save />保存</button>
        <ImageExport project={project} capture={(options?: { skipPlan?: boolean }) => withExportViews(async (flat, scene) => ({
          planBare: options?.skipPlan ? '' : await flat.capturePNG({ header: false }),
          bird: scene.captureShot('birdseye'),
          inside: scene.captureShot('interior'),
        }))} hasCurrent={view !== '2d'}
          onOpenCompareDrafts={project.basicDraft ? () => {
            if (focusMode) prefs.set({ focusMode: false, focusView: null });
            setDraftCompareSignal(n => n + 1);
          } : undefined}
          current={() => { if (!scene.current) throw Error('三维视图尚未就绪'); return scene.current.capturePNG(); }}
          flat={async () => {
            const previous = useWorkspace.getState();
            try {
              if (view === '3d') {
                prefs.set({ view: '2d', focusMode: false });
                await new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done())));
              }
              if (!plan.current) throw Error('平面图尚未就绪');
              return await plan.current.capturePNG();
            } finally {
              if (view === '3d') prefs.set({ view: previous.view, focusMode: previous.focusMode, focusView: previous.focusView });
            }
          }} />
        <ToolMenu label="项目文件" dismissOnAction>
          <div className="menu-action-list">
            <ProjectFiles notify={notify} />
            <button className="primary" disabled={view === '3d'} onClick={png}><Download />导出 2D 平面图 PNG</button>
            <PresentationDialog capture={capture} />
          </div>
        </ToolMenu>
      </div>
    </header>

    <div inert={!sessionReady || sessionBusy} className={`workspace ${libraryOpen ? '' : 'library-closed'} ${propsOpen ? '' : 'props-closed'}`} style={{ '--library-width': `${prefs.libraryWidth}px`, '--props-width': `${prefs.propsWidth}px` } as React.CSSProperties}>
      <EquipmentLibrary onAdd={addFrom} onAddCombo={addCombo} savedSignal={librarySignal} />
      {libraryOpen && <SidebarResize side="library" />}
      <section className="editor">
        <div className="editor-heading is-unified">
          <div className="workspace-controls">
            <button title={libraryOpen ? '收起素材库' : '展开素材库'} aria-label="切换设备库" aria-pressed={libraryOpen} onClick={() => setLibraryOpen(v => !v)}>{libraryOpen ? <PanelLeftClose /> : <PanelLeftOpen />}</button>
          </div>
          {view !== '3d' && !focusMode && (
            <div id="editor-tools" className="editor-tools-inline" role="region" aria-label="绘图工具">
              <EditorToolbar grid={grid} snap={snap} onGrid={() => G(v => !v)} onSnap={() => S(v => !v)} />
            </div>
          )}
          <div className="editor-heading-right">
            <button className="site-settings-button" onClick={() => { s.setMode('site'); setPropsOpen(true); }}>铺位与装修风格</button>
            <button className="focus-toggle" title="专注画布 · F；Esc 退出" aria-pressed={focusMode} onClick={toggleFocus}>{focusMode ? <Minimize2 /> : <Maximize2 />}{focusMode ? '退出专注' : '专注画布'}</button>
            <button aria-label="切换属性面板" title={propsOpen ? '收起属性面板' : '展开属性面板'} aria-pressed={propsOpen} onClick={() => { if (!propsOpen && !s.selectedIds.length) s.setMode('site'); setPropsOpen(!propsOpen); }}>{propsOpen ? <PanelRightClose /> : <PanelRightOpen />}</button>
          </div>
        </div>
        {project.basicDraft && <BasicDraftBar key={'draft-' + project.id} project={project} notify={notify} openSignal={draftCompareSignal} />}
        <UnderlayQuickFrameBar key={project.id} project={project} notify={notify} />
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
              {sessionReady && !project.items.length && !project.outline && !project.underlay && !project.survey && s.tool === 'select' &&
                <button className="blank-start" onClick={() => wizardTrigger.current?.click()}>输入铺位尺寸，生成第一稿</button>}
              <PlanEditor active={view !== '3d'} ref={plan} grid={grid} snap={snap} notify={notify} onDropItem={dropItem} onDropCombo={dropCombo} onOpenConcept={() => setConceptSignal(n => n + 1)} />
            </div>
          }
          second={
            <div className="three">
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
          <span className="status-message">{s.error || notice || clipboard.message || (multi.length ? `已选 ${multi.length} 个对象 · R 旋转 90°` : '就绪 · 从左侧拖入组合，点外墙加门窗，或一键智能分区')}</span>
          <span className="project-count">
            <b>{insights.seats} 座</b>
            <span>·</span>
            <span>{project.survey && (project.survey.source === 'estimated' ? '估算净面积 ' : '实测净面积 ')}{(planningArea(project) / 1e6).toFixed(2)} ㎡</span>
            {insights.kitchenRatioPct !== null && insights.diningRatioPct !== null && <>
              <span>·</span>
              <span>厨 {insights.kitchenRatioPct}% / 厅 {insights.diningRatioPct}%</span>
            </>}
            <button
              type="button"
              className={`footer-check-pill ${criticalCount > 0 ? 'is-warn' : 'is-ok'}`}
              onClick={() => setInsightsSignal(n => n + 1)}
              title="点击查看完整可行性体检、商用配电与采购预算"
            >
              {criticalCount > 0 ? <><AlertTriangle />体检与预算 · {criticalCount} 处冲突</> : <><CheckCircle2 />体检与预算 · 无冲突</>}
            </button>
          </span>
        </footer>
      </section>
      {propsOpen && <SidebarResize side="props" />}
      <PropertiesPanel onSavedSpec={() => { setLibrarySignal(n => n + 1); prefs.set({ libraryOpen: true, leftTab: 'catalog', focusMode: false }); }} onEditOutline={draw => { if (view === '3d') V('split'); s.setTool(draw ? 'outline-draw' : 'outline-edit'); }} />
    </div>
  </main>;
}
