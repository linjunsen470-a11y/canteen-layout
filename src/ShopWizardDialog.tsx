import { useRef, useState } from 'react';
import { ImageUp, Ruler } from 'lucide-react';
import { blankProject } from './model';
import { createCustomShopShell } from './shopTemplates';
import { copyProject, useProjectSession } from './projectSession';
import { useWorkspace } from './workspace';
import { useStore } from './store';
import { importImage } from './imageAssets';

export default function ShopWizardDialog({ notify }: { notify: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [fromImage, setFromImage] = useState(false);
  const [shape, setShape] = useState<'rectangle' | 'l-shape'>('rectangle');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const session = useProjectSession();

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
      useWorkspace.getState().set({ view: fromImage ? '2d' : 'split', focusMode: false, propsOpen: true });
      useStore.getState().setTool(fromImage ? 'underlay-calibrate' : 'select');
      notify(fromImage ? '请在底图上点选两个已知距离的点' : '铺位已创建，可按现场位置添加门窗、柱子和桌椅');
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return <>
    <button className="wizard-trigger" disabled={!session.ready || session.busy}
      onClick={() => { setError(''); dialog.current?.showModal(); }}><Ruler />新建铺位</button>
    <dialog ref={dialog} className="shop-wizard-dialog" aria-labelledby="new-shop-heading" onCancel={e => { if (saving) e.preventDefault(); }}>
      <header className="wizard-header"><h2 id="new-shop-heading">新建铺位</h2>
        <button disabled={saving} onClick={() => dialog.current?.close()}>关闭</button></header>
      <div className="wizard-tabs" role="group" aria-label="建铺方式">
        <button disabled={saving} aria-pressed={!fromImage} onClick={() => { setFromImage(false); setError(''); }}><Ruler />按实测尺寸</button>
        <button disabled={saving} aria-pressed={fromImage} onClick={() => { setFromImage(true); setError(''); }}><ImageUp />从户型图描绘</button>
      </div>
      <form onSubmit={create}><fieldset disabled={saving} className="custom-shell-form">
        <label className="full">铺位名称<input name="name" defaultValue="我的铺位" required /></label>
        <label>{fromImage ? '底图覆盖宽度' : '开间'}（米）<input name="width" type="number" required min="1" max="60" step="0.001" defaultValue="10" /></label>
        <label>{fromImage ? '底图覆盖深度' : '进深'}（米）<input name="depth" type="number" required min="1" max="60" step="0.001" defaultValue="8" /></label>
        {fromImage ? <label className="full">户型图（PNG / JPEG）<input name="image" type="file" accept="image/png,image/jpeg" required /></label> : <>
          <label>层高（米）<input name="ceiling" type="number" required min="2.4" max="6" step="0.001" defaultValue="3.2" /></label>
          <label>铺位轮廓<select value={shape} onChange={e => setShape(e.target.value as typeof shape)}>
            <option value="rectangle">矩形</option><option value="l-shape">L 形（右下缺口）</option></select></label>
          {shape === 'l-shape' && <>
            <label>缺口宽度（米）<input name="notchWidth" type="number" min="0.001" step="0.001" required /></label>
            <label>缺口深度（米）<input name="notchDepth" type="number" min="0.001" step="0.001" required /></label>
          </>}
          <div className="shell-toggles full"><label><input name="walls" type="checkbox" defaultChecked />沿轮廓生成外墙</label></div>
        </>}
        {error && <p className="full property-error" role="alert">{error}</p>}
        <div className="dialog-actions full"><button className="primary" type="submit">{saving ? '正在保存…' : fromImage ? '导入并两点校准' : '创建铺位'}</button></div>
      </fieldset></form>
    </dialog>
  </>;
}
