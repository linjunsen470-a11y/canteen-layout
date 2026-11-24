import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Sparkles, Store, Ruler, Check, Wand2, ImageUp, ArrowRight } from 'lucide-react';
import { FloorMaterial, LightingPreset, WallMaterial, blankProject } from './model';
import { CustomShopSpec, createCustomShopShell, shopTemplates } from './shopTemplates';
import {
  AutoShopSpec, KitchenSide, LayoutStrategy, ShopBusinessType,
  buildAutoShopPlan, businessTypePresets, strategyMeta,
} from './autoShopLayout';
import { analyzeShop } from './shopAnalytics';
import { copyProject, useProjectSession } from './projectSession';
import { useWorkspace } from './workspace';
import { useStore } from './store';
import { importImage } from './imageAssets';
import PlanMiniPreview from './PlanMiniPreview';

export type WizardTab = 'templates' | 'auto' | 'custom' | 'underlay';
export type ShopWizardHandle = { open: (tab?: WizardTab) => void };

const fmtYuan = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString()}`;

const ShopWizardDialog = forwardRef<ShopWizardHandle, { notify: (msg: string) => void }>(function ShopWizardDialog({ notify }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<WizardTab>('templates');
  const busy = useProjectSession(s => s.busy);

  const openModal = (targetTab: WizardTab = 'templates') => {
    setOpened(true);
    setTab(targetTab);
    dialog.current?.showModal();
  };

  useImperativeHandle(ref, () => ({ open: openModal }));

  // Tab 1: Curated showcase templates with live floor-plan previews
  const previews = useMemo(() => opened ? shopTemplates.map(t => {
    const project = t.build();
    const stats = analyzeShop(project);
    return { ...t, project, seats: stats.seats, ratio: `${stats.diningRatioPct}∶${stats.kitchenRatioPct}`, powerKw: stats.estimatedPowerKw };
  }) : [], [opened]);

  // Tab 2: Parametric smart auto-layout for the owner's real leased space
  const [autoSpec, setAutoSpec] = useState<AutoShopSpec>({
    name: '松间明档面馆',
    widthM: 10.8,
    depthM: 7.8,
    ceilingM: 3.2,
    shape: 'rectangle',
    businessType: 'bistro',
    strategy: 'balanced',
    kitchenSide: 'rear',
    floorMaterial: 'terrazzo',
    wallMaterial: 'warm-cream',
    lightingPreset: 'warm-dining',
  });

  const autoPreview = useMemo(() => {
    if (!opened || tab !== 'auto') return null;
    const project = buildAutoShopPlan(autoSpec);
    const stats = analyzeShop(project);
    return { project, stats };
  }, [opened, tab, autoSpec]);

  const selectBusinessType = (bt: ShopBusinessType) => {
    const preset = businessTypePresets[bt];
    setAutoSpec(s => ({
      ...s,
      businessType: bt,
      floorMaterial: preset.floor,
      wallMaterial: preset.wall,
      lightingPreset: preset.lighting,
    }));
  };

  // Tab 3: Blank leased-unit shell builder (preserves exact workflow for empty-shell builders)
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

  // Tab 4: Landlord floor plan image upload state
  const [underlayName, setUnderlayName] = useState('我的户型图铺位');
  const [underlayW, setUnderlayW] = useState(12);
  const [underlayD, setUnderlayD] = useState(9);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

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

  const applyAutoPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const project = buildAutoShopPlan(autoSpec);
    const stats = analyzeShop(project);
    const ok = await copyProject(project.name, project);
    if (ok) {
      dialog.current?.close();
      useWorkspace.getState().set({ view: 'split', focusMode: false });
      notify(`已为「${project.name}」生成 ${stats.seats} 座完整 2D/3D 方案，可点击「换一种摆法」对比其他方案`);
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

  const handleUnderlayUpload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setUploadError('');
    try {
      const result = await importImage(file);
      const base = blankProject(underlayName.trim() || file.name.replace(/\.[^.]+$/, ''));
      const wMm = Math.max(4000, Math.round(underlayW * 1000));
      const hMm = Math.max(4000, Math.round(underlayD * 1000));
      const project = {
        ...base,
        width: wMm,
        height: hMm,
        underlay: {
          assetId: result.asset.id,
          name: file.name,
          pixelWidth: result.width,
          pixelHeight: result.height,
          x: 0,
          y: 0,
          mmPerPixel: Math.min(wMm / result.width, hMm / result.height),
          rotation: 0,
          opacity: 0.65,
          hidden: false,
          locked: true,
        },
        metadata: { ...base.metadata, site: `${underlayW}m × ${underlayD}m（已导入现场底图）`, purpose: '底图临摹规划' },
      };
      const ok = await copyProject(project.name, project);
      if (ok) {
        dialog.current?.close();
        useWorkspace.getState().set({ view: '2d', focusMode: false, propsOpen: true });
        useStore.getState().setMode('site');
        notify('已导入户型底图！请先在右侧「现场底图 → 两点校准」按真实尺寸对齐，再描墙摆家具');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '图片导入失败，请使用 PNG 或 JPEG 户型图');
    } finally {
      setUploading(false);
    }
  };

  return <>
    <button className="wizard-trigger" onClick={() => openModal('templates')}>
      <Sparkles />开店模板 / 建铺
    </button>
    <dialog ref={dialog} className="shop-wizard-dialog" aria-labelledby="shop-wizard-heading">
      <header className="wizard-header">
        <div>
          <h2 id="shop-wizard-heading">开店规划起步中心</h2>
          <p>输入你租下的真实铺位尺寸 10 秒生成整套方案，或上传商场户型图、从成熟样板起步</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()}>关闭</button>
      </header>
      <div className="wizard-tabs wizard-tabs-4" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'templates'} onClick={() => setTab('templates')}>
          <Store />精选开店示范方案
        </button>
        <button type="button" role="tab" aria-selected={tab === 'auto'} onClick={() => setTab('auto')}>
          <Wand2 />智能生成我的铺位
        </button>
        <button type="button" role="tab" aria-selected={tab === 'custom'} onClick={() => setTab('custom')}>
          <Ruler />按实测尺寸新建铺位
        </button>
        <button type="button" role="tab" aria-selected={tab === 'underlay'} onClick={() => setTab('underlay')}>
          <ImageUp />上传户型图起步
        </button>
      </div>

      {tab === 'templates' && (
        <div className="wizard-tab-body">
          <div className="wizard-callout">
            <div>
              <strong>手里已有自己的铺位长宽尺寸？</strong>
              <span>输入开间、进深与想开的业态，自动排好厨房、吧台、餐桌椅、灯光和门头招牌</span>
            </div>
            <button type="button" className="primary" onClick={() => setTab('auto')}>
              <Wand2 />用我的真实尺寸生成 <ArrowRight />
            </button>
          </div>
          <div className="template-grid">
            {previews.map(tpl => (
              <article key={tpl.id} className="template-card">
                <div className="template-preview-box">
                  <PlanMiniPreview project={tpl.project} />
                </div>
                <div className="template-badge-row">
                  <span className="template-tag" style={{ background: tpl.accent }}>{tpl.tag}</span>
                  <small>{tpl.areaLabel} · {tpl.seats} 座 · 餐厨比 {tpl.ratio} · 约 {tpl.powerKw}kW</small>
                </div>
                <h3>{tpl.name}</h3>
                <p>{tpl.summary}</p>
                <button type="button" className="primary" disabled={busy} onClick={() => void applyTemplate(tpl.id)}>
                  <Check />以此方案起步
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'auto' && (
        <form className="auto-layout-grid" onSubmit={e => void applyAutoPlan(e)}>
          <div className="auto-form-col">
            <label>你的店名（会自动点亮在 3D 门头招牌上）
              <input required value={autoSpec.name} onChange={e => setAutoSpec(s => ({ ...s, name: e.target.value }))} placeholder="例如：松间小面 · 社区明档铺" />
            </label>
            <div className="auto-row-3">
              <label>开间（米 m）
                <input type="number" min="5" max="30" step="0.1" required value={autoSpec.widthM} onChange={e => setAutoSpec(s => ({ ...s, widthM: Number(e.target.value) || 8 }))} />
              </label>
              <label>进深（米 m）
                <input type="number" min="4.5" max="24" step="0.1" required value={autoSpec.depthM} onChange={e => setAutoSpec(s => ({ ...s, depthM: Number(e.target.value) || 7 }))} />
              </label>
              <label>层高（米 m）
                <input type="number" min="2.6" max="5.5" step="0.1" required value={autoSpec.ceilingM} onChange={e => setAutoSpec(s => ({ ...s, ceilingM: Number(e.target.value) || 3.2 }))} />
              </label>
            </div>
            <div className="auto-row-2">
              <label>铺位轮廓
                <select value={autoSpec.shape} onChange={e => setAutoSpec(s => ({ ...s, shape: e.target.value as AutoShopSpec['shape'] }))}>
                  <option value="rectangle">标准矩形铺位</option>
                  <option value="l-shape">L 形转角铺位</option>
                </select>
              </label>
              <label>厨房 / 操作区方位
                <select value={autoSpec.kitchenSide} onChange={e => setAutoSpec(s => ({ ...s, kitchenSide: e.target.value as KitchenSide }))}>
                  <option value="rear">后置一字型厨房（最通用）</option>
                  <option value="left">左侧纵深明档（适合长条铺）</option>
                </select>
              </label>
            </div>
            <div className="auto-pill-group">
              <span className="auto-field-label">想开什么店？</span>
              <div className="pill-options">
                {(['bistro', 'cafe', 'restaurant', 'canteen'] as ShopBusinessType[]).map(bt => (
                  <button
                    key={bt}
                    type="button"
                    className={autoSpec.businessType === bt ? 'is-active' : ''}
                    onClick={() => selectBusinessType(bt)}
                  >
                    <b>{businessTypePresets[bt].label}</b>
                    <small>{businessTypePresets[bt].subtitle}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="auto-pill-group">
              <span className="auto-field-label">空间摆法策略</span>
              <div className="pill-options pill-options-3">
                {(['balanced', 'high-capacity', 'comfort'] as LayoutStrategy[]).map(st => (
                  <button
                    key={st}
                    type="button"
                    className={autoSpec.strategy === st ? 'is-active' : ''}
                    onClick={() => setAutoSpec(s => ({ ...s, strategy: st }))}
                  >
                    <b>{strategyMeta[st].label}</b>
                    <small>{strategyMeta[st].badge}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="auto-row-3">
              <label>地面材质
                <select value={autoSpec.floorMaterial} onChange={e => setAutoSpec(s => ({ ...s, floorMaterial: e.target.value as FloorMaterial }))}>
                  <option value="terrazzo">商业浅水磨石</option>
                  <option value="oak-wood">暖橡木地板</option>
                  <option value="warm-tile">暖灰仿古地砖</option>
                  <option value="concrete">微水泥工业风</option>
                </select>
              </label>
              <label>墙面材质
                <select value={autoSpec.wallMaterial} onChange={e => setAutoSpec(s => ({ ...s, wallMaterial: e.target.value as WallMaterial }))}>
                  <option value="warm-cream">暖奶油艺术漆</option>
                  <option value="plaster">干净白乳胶漆</option>
                  <option value="wood-panel">原木护墙格栅</option>
                  <option value="brick-white">白色文化砖</option>
                </select>
              </label>
              <label>3D 灯光氛围
                <select value={autoSpec.lightingPreset} onChange={e => setAutoSpec(s => ({ ...s, lightingPreset: e.target.value as LightingPreset }))}>
                  <option value="warm-dining">暖光营业</option>
                  <option value="daylight">自然采光</option>
                  <option value="evening">晚间灯光</option>
                </select>
              </label>
            </div>
          </div>

          <div className="auto-preview-col">
            <div className="auto-preview-head">
              <b>实时平面预览</b>
              <span>{autoSpec.widthM.toFixed(1)}m × {autoSpec.depthM.toFixed(1)}m · 自动避让门扇与主通道</span>
            </div>
            <div className="auto-preview-canvas">
              {autoPreview && <PlanMiniPreview project={autoPreview.project} />}
            </div>
            {autoPreview && (
              <div className="auto-preview-kpis">
                <div><small>实用面积</small><strong>{autoPreview.stats.areaSqm.toFixed(1)} ㎡</strong></div>
                <div><small>实排客座</small><strong>{autoPreview.stats.seats} 座</strong></div>
                <div><small>舒适度</small><strong>{autoPreview.stats.sqmPerSeat ? `${autoPreview.stats.sqmPerSeat.toFixed(1)}㎡/座` : '—'}</strong></div>
                <div><small>预估配电</small><strong>{autoPreview.stats.estimatedPowerKw} kW</strong></div>
                <div className="wide"><small>设备软装参考预算</small><strong>{fmtYuan(autoPreview.stats.budgetMin)} ~ {fmtYuan(autoPreview.stats.budgetMax)}</strong></div>
              </div>
            )}
            <div className="dialog-actions">
              <button type="button" onClick={() => dialog.current?.close()}>取消</button>
              <button type="submit" className="primary" disabled={busy}>
                <Wand2 />一键生成我的完整方案
              </button>
            </div>
          </div>
        </form>
      )}

      {tab === 'custom' && (
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

      {tab === 'underlay' && (
        <div className="underlay-start-panel">
          <div className="underlay-start-card">
            <h3>有房东或商场发来的户型图 / 平面截图？</h3>
            <p>上传 PNG 或 JPEG 户型图后，系统会直接按大致外框铺好底图并打开「两点校准」，你只需点出图上任意一段已知长度（比如柱距或墙长），即可 1:1 真实比例描墙摆桌椅。</p>
            <div className="auto-row-3">
              <label>方案名称
                <input value={underlayName} onChange={e => setUnderlayName(e.target.value)} />
              </label>
              <label>预估总宽（m）
                <input type="number" min="4" max="60" step="0.5" value={underlayW} onChange={e => setUnderlayW(Number(e.target.value) || 12)} />
              </label>
              <label>预估进深（m）
                <input type="number" min="4" max="60" step="0.5" value={underlayD} onChange={e => setUnderlayD(Number(e.target.value) || 9)} />
              </label>
            </div>
            <label className="underlay-dropzone">
              <ImageUp />
              <b>{uploading ? '正在导入户型图…' : '点击选择商场户型图（PNG / JPEG）'}</b>
              <span>图片仅保存在本地浏览器，不会上传至任何第三方服务器</span>
              <input hidden disabled={uploading || busy} type="file" accept="image/png,image/jpeg" onChange={e => { void handleUnderlayUpload(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {uploadError && <p role="alert" className="property-error">{uploadError}</p>}
          </div>
        </div>
      )}
    </dialog>
  </>;
});

export default ShopWizardDialog;
