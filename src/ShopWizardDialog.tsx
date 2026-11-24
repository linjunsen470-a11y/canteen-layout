import { useMemo, useRef, useState } from 'react';
import { ImageUp, LayoutGrid, Ruler } from 'lucide-react';
import { blankProject } from './model';
import SketchWizard from './SketchWizard';
import SurveyFields, { draftLegs, initialSurvey } from './SurveyFields';
import { createSurveyShop } from './interiorSurvey';
import { createCustomShopShell, shopTemplates } from './shopTemplates';
import { copyProject, useProjectSession } from './projectSession';
import { useWorkspace } from './workspace';
import { useStore } from './store';
import { importImage } from './imageAssets';
import { seatSummary } from './layoutGroups';
import PlanMiniPreview from './PlanMiniPreview';

export default function ShopWizardDialog({ notify }: { notify: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'sketch' | 'survey' | 'outer' | 'image' | 'templates'>('sketch');
  const [sketchNumber, setSketchNumber] = useState(0);
  const [survey, setSurvey] = useState(initialSurvey);
  const fromImage = mode === 'image';
  const [shape, setShape] = useState<'rectangle' | 'l-shape'>('rectangle');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const session = useProjectSession();

  const templatePreviews = useMemo(
    () => (mode === 'templates' ? shopTemplates.map(t => ({ meta: t, project: t.build() })) : []),
    [mode],
  );

  async function openTemplate(templateId: string) {
    if (saving || session.busy) return;
    const found = shopTemplates.find(t => t.id === templateId);
    if (!found) return;
    setSaving(true);
    setError('');
    try {
      const proj = found.build();
      if (!await copyProject(proj.name, proj)) throw Error(useProjectSession.getState().message || '打开示范案例失败');
      dialog.current?.close();
      useWorkspace.getState().set({ view: 'split', focusMode: false, propsOpen: false, libraryOpen: true });
      useStore.getState().setTool('select');
      notify(`已打开示范案例「${proj.name}」（可自由微调或对照 3D 效果）`);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || session.busy) return;
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name')).trim() || '我的铺位';
    const widthM = Number(data.get('width')), depthM = Number(data.get('depth'));
    setSaving(true);
    setError('');
    try {
      let project;
      if (fromImage) {
        const file = data.get('image');
        if (!(file instanceof File) || !file.size) throw Error('请选择户型图');
        const image = await importImage(file);
        const width = Math.round(widthM * 1000), height = Math.round(depthM * 1000);
        project = { ...blankProject(name), width, height, underlay: {
          assetId: image.asset.id, name: file.name, pixelWidth: image.width, pixelHeight: image.height,
          x: 0, y: 0, mmPerPixel: Math.min(width / image.width, height / image.height),
          rotation: 0, opacity: 0.65, hidden: false, locked: true,
        } };
      } else if (mode === 'survey') {
        project = createSurveyShop(name, draftLegs(survey), survey.thickness, Math.round(Number(data.get('ceiling')) * 1000));
      } else {
        project = createCustomShopShell({
          name, widthM, depthM, shape, ceilingM: Number(data.get('ceiling')),
          notchWidthM: Number(data.get('notchWidth')), notchDepthM: Number(data.get('notchDepth')),
          addWalls: data.has('walls'), addStorefront: false, addZones: false,
          floorMaterial: 'concrete', wallMaterial: 'plaster', lightingPreset: 'daylight',
        });
      }
      if (!await copyProject(name, project)) throw Error(useProjectSession.getState().message || '保存铺位失败');
      dialog.current?.close();
      useWorkspace.getState().set({ view: mode === 'outer' ? 'split' : '2d', focusMode: false, propsOpen: true,
        ...(mode === 'survey' ? { libraryOpen: true, leftTab: 'catalog' as const } : {}) });
      useStore.getState().setTool(fromImage ? 'underlay-calibrate' : 'select');
      notify(fromImage ? '请在底图上点选两个已知距离的点' : '铺位已创建：可直接点顶部「智能分区估算」快速算餐厨比和桌椅数，或按现场添加门窗');
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return <>
    <button className="wizard-trigger" disabled={!session.ready || session.busy}
      onClick={() => { setMode('sketch'); setError(''); dialog.current?.showModal(); }}><Ruler />新建铺位</button>
    <dialog ref={dialog} className="shop-wizard-dialog" aria-labelledby="new-shop-heading" onCancel={e => { if (saving) e.preventDefault(); }}>
      <header className="wizard-header"><h2 id="new-shop-heading">新建铺位</h2>
        <button disabled={saving} onClick={() => dialog.current?.close()}>关闭</button></header>
      <div className="wizard-tabs" role="group" aria-label="建铺方式">
        <button disabled={saving} aria-pressed={mode === 'sketch'} onClick={() => { setMode('sketch'); setError(''); }}>格网点角</button>
        <button disabled={saving} aria-pressed={mode === 'survey'} onClick={() => { setMode('survey'); setError(''); }}><Ruler />按内墙净尺寸</button>
        <button disabled={saving} aria-pressed={mode === 'outer'} onClick={() => { setMode('outer'); setError(''); }}>按外轮廓尺寸</button>
        <button disabled={saving} aria-pressed={fromImage} onClick={() => { setMode('image'); setError(''); }}><ImageUp />从户型图描绘</button>
        <button disabled={saving} aria-pressed={mode === 'templates'} onClick={() => { setMode('templates'); setError(''); }}><LayoutGrid />示范案例参考</button>
      </div>
      {mode === 'sketch' ? <SketchWizard key={sketchNumber} onBusy={setSaving} busy={saving || session.busy} onSave={async (project, warnings) => {
        setSaving(true);
        try {
          if (!await copyProject(project.name, project)) throw Error(useProjectSession.getState().message || '保存草稿失败');
          dialog.current?.close();
          useWorkspace.getState().set({ view: 'split', focusMode: false, camera: 'oblique', move3D: false, propsOpen: false, libraryOpen: true });
          useStore.getState().setTool('select');
          setSketchNumber(n => n + 1);
          notify(['已生成基础布局', ...warnings].join(' · '));
        } finally { setSaving(false); }
      }} /> : mode === 'templates' ? (
        <div className="template-gallery">
          <p className="template-gallery-note">
            以下示范案例供快速预览 2D/3D 效果参考；若要按您租下的真实铺位尺寸规划，请先用「按内墙净尺寸」建铺，再点击顶部 <b>「智能分区估算」</b>。
          </p>
          <div className="template-gallery-grid">
            {templatePreviews.map(({ meta, project }) => (
              <button
                key={meta.id}
                type="button"
                className="template-card"
                disabled={saving}
                onClick={() => void openTemplate(meta.id)}
              >
                <PlanMiniPreview project={project} showZoneLabels={false} />
                <div className="template-card-meta">
                  <strong>{meta.name}</strong>
                  <span>{meta.areaLabel} · {seatSummary(project).seats} 座 · {meta.feature}</span>
                  <small>{meta.summary}</small>
                </div>
              </button>
            ))}
          </div>
          {error && <p className="property-error" role="alert">{error}</p>}
        </div>
      ) : (
        <form onSubmit={create}><fieldset disabled={saving} className="custom-shell-form">
          <label className="full">铺位名称<input name="name" defaultValue="我的铺位" required /></label>
          {mode === 'survey' ? <SurveyFields value={survey} onChange={s => { setSurvey(s); setError(''); }} /> : <>
          <label>{fromImage ? '底图覆盖宽度' : '外轮廓开间'}（米）<input name="width" type="number" required min="1" max="60" step="0.001" defaultValue="10" /></label>
          <label>{fromImage ? '底图覆盖深度' : '外轮廓进深'}（米）<input name="depth" type="number" required min="1" max="60" step="0.001" defaultValue="8" /></label></>}
          {fromImage ? <label className="full">户型图（PNG / JPEG）<input name="image" type="file" accept="image/png,image/jpeg" required /></label> : <>
            <label>层高（米）<input name="ceiling" type="number" required min="2.4" max="6" step="0.001" defaultValue="3.2" /></label>
            {mode === 'outer' && <>
            <label>铺位轮廓<select value={shape} onChange={e => setShape(e.target.value as typeof shape)}>
              <option value="rectangle">矩形</option><option value="l-shape">L 形（右下缺口）</option></select></label>
            {shape === 'l-shape' && <>
              <label>缺口宽度（米）<input name="notchWidth" type="number" min="0.001" step="0.001" required /></label>
              <label>缺口深度（米）<input name="notchDepth" type="number" min="0.001" step="0.001" required /></label>
            </>}
            <div className="shell-toggles full"><label><input name="walls" type="checkbox" defaultChecked />沿轮廓生成外墙</label></div></>}
          </>}
          {error && <p className="full property-error" role="alert">{error}</p>}
          <div className="dialog-actions full"><button className="primary" type="submit">{saving ? '正在保存…' : fromImage ? '导入并两点校准' : '创建铺位'}</button></div>
        </fieldset></form>
      )}
    </dialog>
  </>;
}
