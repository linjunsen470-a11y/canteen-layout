import { useMemo, useRef, useState } from 'react';
import { analyzeShop } from './shopAnalytics';
import { Sparkles, Store, Ruler, Check } from 'lucide-react';
import { FloorMaterial, LightingPreset, WallMaterial } from './model';
import { CustomShopSpec, createCustomShopShell, shopTemplates } from './shopTemplates';
import { copyProject, useProjectSession } from './projectSession';
import { useWorkspace } from './workspace';

export default function ShopWizardDialog({ notify }: { notify: (msg: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const previews = useMemo(() => opened ? shopTemplates.map(t => {
    const stats = analyzeShop(t.build());
    return { ...t, seats: stats.seats, ratio: `${stats.diningRatioPct}∶${stats.kitchenRatioPct}` };
  }) : [], [opened]);
  const busy = useProjectSession(s => s.busy);
  const [tab, setTab] = useState<'templates' | 'custom'>('templates');
  const [spec, setSpec] = useState<CustomShopSpec>({
    name: '我的新店铺位规划',
    widthM: 10,
    depthM: 8,
    ceilingM: 3.2,
    shape: 'rectangle',
    floorMaterial: 'oak-wood',
    wallMaterial: 'warm-cream',
    lightingPreset: 'warm-dining',
    addWalls: true,
    addStorefront: true,
    addZones: true,
  });

  const areaSqm = spec.widthM * spec.depthM * (spec.shape === 'l-shape' ? 1 - 0.38 * 0.45 : 1);
  const applyTemplate = async (templateId: string) => {
    const tpl = shopTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    const project = tpl.build();
    const ok = await copyProject(project.name, project);
    if (ok) {
      dialog.current?.close();
      useWorkspace.getState().set({ view: 'split', focusMode: false });
      notify(`已载入「${tpl.name}」完整方案，可直接在 2D/3D 中修改布置`);
    }
  };

  const buildCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = createCustomShopShell(spec);
    const ok = await copyProject(project.name, project);
    if (ok) {
      dialog.current?.close();
      useWorkspace.getState().set({ view: 'split', focusMode: false });
      notify(`已生成 ${spec.widthM}m × ${spec.depthM}m 铺位框架，可开始拖放桌椅厨具与灯具`);
    }
  };

  return <>
    <button className="wizard-trigger" onClick={() => { setOpened(true); dialog.current?.showModal(); }}>
      <Sparkles />开店模板 / 建铺
    </button>
    <dialog ref={dialog} className="shop-wizard-dialog" aria-labelledby="shop-wizard-heading">
      <header className="wizard-header">
        <div>
          <h2 id="shop-wizard-heading">快速开店规划中心</h2>
          <p>选择成熟业态样板一键预览 3D 效果，或按实际租赁铺位尺寸快速生成毛坯围墙与门头</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()}>关闭</button>
      </header>
      <div className="wizard-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'templates'} onClick={() => setTab('templates')}>
          <Store />精选开店示范方案
        </button>
        <button type="button" role="tab" aria-selected={tab === 'custom'} onClick={() => setTab('custom')}>
          <Ruler />按实测尺寸新建铺位
        </button>
      </div>

      {tab === 'templates' ? (
        <div className="template-grid">
          {previews.map(tpl => (
            <article key={tpl.id} className="template-card">
              <div className="template-badge-row">
                <span className="template-tag" style={{ background: tpl.accent }}>{tpl.tag}</span>
                <small>{tpl.areaLabel} · {tpl.seats} 座 · 餐厨比 {tpl.ratio} · {tpl.feature}</small>
              </div>
              <h3>{tpl.name}</h3>
              <p>{tpl.summary}</p>
              <button type="button" className="primary" disabled={busy} onClick={() => void applyTemplate(tpl.id)}>
                <Check />以此方案起步
              </button>
            </article>
          ))}
        </div>
      ) : (
        <form className="custom-shell-form" onSubmit={e => void buildCustom(e)}>
          <label className="full">铺位 / 门店名称
            <input required value={spec.name} onChange={e => setSpec(s => ({ ...s, name: e.target.value }))} placeholder="例如：万象城 B1-108 轻食面馆" />
          </label>
          <label>开间长度（米 m）
            <input type="number" min="4" max="60" step="0.1" required value={spec.widthM} onChange={e => setSpec(s => ({ ...s, widthM: Number(e.target.value) || 8 }))} />
          </label>
          <label>进深宽度（米 m）
            <input type="number" min="4" max="60" step="0.1" required value={spec.depthM} onChange={e => setSpec(s => ({ ...s, depthM: Number(e.target.value) || 6 }))} />
          </label>
          <label>空间层高（米 m）
            <input type="number" min="2.4" max="6" step="0.1" required value={spec.ceilingM} onChange={e => setSpec(s => ({ ...s, ceilingM: Number(e.target.value) || 3.2 }))} />
          </label>
          <label>铺位轮廓形状
            <select value={spec.shape} onChange={e => setSpec(s => ({ ...s, shape: e.target.value as CustomShopSpec['shape'] }))}>
              <option value="rectangle">标准矩形铺位</option>
              <option value="l-shape">L 形转角铺位</option>
            </select>
          </label>
          <label>地面默认材质
            <select value={spec.floorMaterial} onChange={e => setSpec(s => ({ ...s, floorMaterial: e.target.value as FloorMaterial }))}>
              <option value="oak-wood">暖橡木地板（咖啡/西餐）</option>
              <option value="terrazzo">商业水磨石（快餐/轻食）</option>
              <option value="warm-tile">暖灰仿古地砖（食堂/中餐）</option>
              <option value="concrete">微水泥工业风</option>
            </select>
          </label>
          <label>墙面默认质感
            <select value={spec.wallMaterial} onChange={e => setSpec(s => ({ ...s, wallMaterial: e.target.value as WallMaterial }))}>
              <option value="warm-cream">暖奶油艺术漆</option>
              <option value="plaster">干净白乳胶漆</option>
              <option value="wood-panel">原木护墙格栅</option>
              <option value="brick-white">白色文化砖</option>
              <option value="concrete">清水水泥墙</option>
            </select>
          </label>
          <label>默认 3D 灯光氛围
            <select value={spec.lightingPreset} onChange={e => setSpec(s => ({ ...s, lightingPreset: e.target.value as LightingPreset }))}>
              <option value="warm-dining">暖光营业氛围</option>
              <option value="daylight">白天自然采光</option>
              <option value="evening">晚间精致灯光</option>
            </select>
          </label>
          <div className="shell-toggles full">
            <label><input type="checkbox" checked={spec.addWalls} onChange={e => setSpec(s => ({ ...s, addWalls: e.target.checked }))} />自动围合四周外墙</label>
            <label><input type="checkbox" disabled={!spec.addWalls} checked={spec.addWalls && spec.addStorefront} onChange={e => setSpec(s => ({ ...s, addStorefront: e.target.checked }))} />按临街面宽生成入口门、招牌及可容纳的橱窗</label>
            <label><input type="checkbox" checked={spec.addZones} onChange={e => setSpec(s => ({ ...s, addZones: e.target.checked }))} />自动划分前厅客区 / 后厨参考分区</label>
          </div>
          <div className="shell-summary full">
            预计铺位面积：<b>{areaSqm.toFixed(1)} ㎡</b>
            <span> · 按面积粗估 {Math.round(areaSqm * 0.65 / 1.8)} ~ {Math.round(areaSqm * 0.65 / 1.35)} 座，实际可用座位以布置结果为准</span>
          </div>
          <div className="dialog-actions full">
            <button type="button" onClick={() => dialog.current?.close()}>取消</button>
            <button type="submit" className="primary" disabled={busy}>立即生成铺位框架</button>
          </div>
        </form>
      )}
    </dialog>
  </>;
}
