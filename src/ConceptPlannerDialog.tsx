import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Columns2, CopyPlus, Sparkles, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { useStore } from './store';
import { copyProject, useProjectSession } from './projectSession';
import { useWorkspace } from './workspace';
import { analyzeShop } from './shopAnalytics';
import {
  businessTypeDefaults,
  ConceptBusinessType,
  ConceptKitchenSide,
  ConceptPlannerOptions,
  ConceptSeatingStyle,
  ConceptThemeId,
  decorThemePresets,
  defaultConceptOptions,
  generateConceptLayout,
} from './conceptPlanner';
import PlanMiniPreview from './PlanMiniPreview';

export type ConceptPlannerHandle = { open: () => void };

const fmtYuan = (n: number) => (n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString()}`);

const kitchenSideLabels: Record<ConceptKitchenSide, string> = {
  rear: '后置明档',
  left: '左侧厨区',
  right: '右侧厨区',
  none: '不设后厨（全厅）',
};

const seatingStyleLabels: Record<ConceptSeatingStyle, string> = {
  balanced: '均衡卡座 + 散台',
  compact: '高坪效紧凑翻台',
  comfort: '宽敞舒适聚餐',
  'canteen-bench': '食堂六人长桌',
};

const ConceptPlannerDialog = forwardRef<ConceptPlannerHandle, { notify: (msg: string) => void }>(function ConceptPlannerDialog({ notify }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const project = useStore(s => s.project);
  const commit = useStore(s => s.commit);
  const session = useProjectSession();

  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConceptPlannerOptions>(() => defaultConceptOptions('bistro'));
  const [compareMode, setCompareMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setOpen(true);
    dialog.current?.showModal();
  };
  useImperativeHandle(ref, () => ({ open: openModal }));

  const currentInsights = useMemo(() => (open ? analyzeShop(project) : null), [open, project]);

  const result = useMemo(() => {
    if (!open) return null;
    try {
      return generateConceptLayout(project, options);
    } catch {
      return null;
    }
  }, [open, project, options]);

  const switchBusiness = (bt: ConceptBusinessType) => {
    const def = businessTypeDefaults[bt];
    setOptions(prev => ({
      ...prev,
      businessType: bt,
      kitchenRatioPct: def.defaultKitchenPct,
      seatingStyle: def.defaultSeating,
      themeId: prev.themeId === 'keep' ? 'keep' : def.defaultTheme,
    }));
  };

  const applyToCurrent = () => {
    if (!result) return;
    if (commit(result.project)) {
      dialog.current?.close();
      setOpen(false);
      useWorkspace.getState().set({ view: 'split', focusMode: false });
      notify(`已按实测壳体落位：后厨 ${result.estimate.kitchenAreaSqm.toFixed(1)}㎡ · 前厅 ${result.estimate.diningAreaSqm.toFixed(1)}㎡ · ${result.estimate.seats} 座（可一键撤销）`);
    }
  };

  const saveAsVariant = async () => {
    if (!result || saving || session.busy) return;
    setSaving(true);
    try {
      const tag = `${businessTypeDefaults[options.businessType].label.split(' ')[0]}·${result.estimate.seats}座`;
      const copyName = `${project.name}（${tag}）`;
      const ok = await copyProject(copyName, { ...result.project, name: copyName });
      if (ok) {
        dialog.current?.close();
        setOpen(false);
        useWorkspace.getState().set({ view: 'split', focusMode: false });
        notify(`已另存同壳对比方案「${copyName}」，原方案完整保留`);
      }
    } finally {
      setSaving(false);
    }
  };

  const est = result?.estimate;

  return (
    <>
      <button
        type="button"
        className="concept-planner-btn"
        disabled={!session.ready || session.busy}
        title="基于当前实测外墙与门窗柱子，快速试算后厨/前厅面积占比与桌椅数量"
        onClick={openModal}
      >
        <Sparkles />智能分区估算
      </button>

      <dialog
        ref={dialog}
        className="concept-dialog"
        aria-labelledby="concept-dialog-title"
        onClose={() => setOpen(false)}
      >
        <header className="concept-header">
          <div>
            <h2 id="concept-dialog-title">智能分区与摆桌估算</h2>
            <p>
              严格保留当前铺位的真实外墙、门窗、柱子与实测记录，仅试算内部功能分区与桌椅排布，让你 10 秒看清“后厨占多大、前厅摆几桌”。
            </p>
          </div>
          <div className="concept-header-actions">
            <button
              type="button"
              aria-pressed={compareMode}
              className={compareMode ? 'active' : ''}
              onClick={() => setCompareMode(v => !v)}
            >
              <Columns2 />{compareMode ? '退出对比' : '对比当前方案'}
            </button>
            <button type="button" onClick={() => dialog.current?.close()}>关闭</button>
          </div>
        </header>

        <div className="concept-body">
          <aside className="concept-controls">
            <div className="concept-group">
              <span className="concept-label">1. 餐饮业态参考</span>
              <div className="concept-chip-grid">
                {(Object.keys(businessTypeDefaults) as ConceptBusinessType[]).map(bt => (
                  <button
                    key={bt}
                    type="button"
                    aria-pressed={options.businessType === bt}
                    className={`concept-chip ${options.businessType === bt ? 'active' : ''}`}
                    onClick={() => switchBusiness(bt)}
                  >
                    <b>{businessTypeDefaults[bt].label}</b>
                    <small>{businessTypeDefaults[bt].subtitle}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="concept-group">
              <span className="concept-label">2. 后厨方位与面积占比</span>
              <div className="concept-seg">
                {(Object.keys(kitchenSideLabels) as ConceptKitchenSide[]).map(side => (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={options.kitchenSide === side}
                    className={options.kitchenSide === side ? 'active' : ''}
                    onClick={() => setOptions(o => ({ ...o, kitchenSide: side }))}
                  >
                    {kitchenSideLabels[side]}
                  </button>
                ))}
              </div>
              {options.kitchenSide !== 'none' && (
                <label className="concept-slider">
                  <div>
                    <span>后厨目标占比</span>
                    <strong>{options.kitchenRatioPct}% {est ? `（约 ${est.kitchenAreaSqm.toFixed(1)} ㎡）` : ''}</strong>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={50}
                    step={2}
                    value={options.kitchenRatioPct}
                    onChange={e => setOptions(o => ({ ...o, kitchenRatioPct: Number(e.target.value) }))}
                  />
                  <div className="concept-slider-ticks">
                    <span>20% 轻食水吧</span>
                    <span>35% 标准热厨</span>
                    <span>50% 重餐大后厨</span>
                  </div>
                </label>
              )}
            </div>

            <div className="concept-group">
              <span className="concept-label">3. 桌椅排布与通道净距</span>
              <div className="concept-seg concept-seg-2">
                {(Object.keys(seatingStyleLabels) as ConceptSeatingStyle[]).map(st => (
                  <button
                    key={st}
                    type="button"
                    aria-pressed={options.seatingStyle === st}
                    className={options.seatingStyle === st ? 'active' : ''}
                    onClick={() => setOptions(o => ({ ...o, seatingStyle: st }))}
                  >
                    {seatingStyleLabels[st]}
                  </button>
                ))}
              </div>
              <div className="concept-aisle-row">
                <span>桌间最小通道净距</span>
                <div className="concept-seg">
                  {[800, 950, 1100].map(mm => (
                    <button
                      key={mm}
                      type="button"
                      aria-pressed={options.aisleMm === mm}
                      className={options.aisleMm === mm ? 'active' : ''}
                      onClick={() => setOptions(o => ({ ...o, aisleMm: mm }))}
                    >
                      {mm} mm
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="concept-group">
              <span className="concept-label">4. 附带配置与 3D 装修氛围</span>
              <div className="concept-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={options.includeKitchenEquip}
                    onChange={e => setOptions(o => ({ ...o, includeKitchenEquip: e.target.checked }))}
                  />
                  在后厨示意炉灶、排烟罩、水槽与收银台
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={options.includeLights}
                    onChange={e => setOptions(o => ({ ...o, includeLights: e.target.checked }))}
                  />
                  在餐桌上方配暖光吊灯（3D 氛围更直观）
                </label>
              </div>
              <label className="concept-theme-select">
                <span>3D 装修风格主题</span>
                <select
                  value={options.themeId}
                  onChange={e => setOptions(o => ({ ...o, themeId: e.target.value as ConceptThemeId }))}
                >
                  <option value="keep">保持当前材质与灯光不变</option>
                  {decorThemePresets.map(t => (
                    <option key={t.id} value={t.id}>{t.label}（{t.subtitle}）</option>
                  ))}
                </select>
              </label>
            </div>
          </aside>

          <section className="concept-preview-pane">
            {est && result ? (
              <>
                <div className="concept-kpi-strip">
                  <div className="concept-kpi">
                    <small>后厨 / 操作区</small>
                    <strong>{est.kitchenAreaSqm.toFixed(1)} ㎡</strong>
                    <span>占室内净面积 {est.kitchenPct}%</span>
                  </div>
                  <div className="concept-kpi">
                    <small>前厅就餐区</small>
                    <strong>{est.diningAreaSqm.toFixed(1)} ㎡</strong>
                    <span>占室内净面积 {est.diningPct}%</span>
                  </div>
                  <div className="concept-kpi highlight">
                    <small>估算客座容量</small>
                    <strong>{est.seats} 座</strong>
                    <span>{est.tableGroups} 组桌椅{est.sqmPerSeat ? ` · ${est.sqmPerSeat.toFixed(1)}㎡/座` : ''}</span>
                  </div>
                  <div className="concept-kpi">
                    <small>预估配电 / 采购</small>
                    <strong>{est.estimatedPowerKw} kW</strong>
                    <span>{fmtYuan(est.budgetMin)}–{fmtYuan(est.budgetMax)}</span>
                  </div>
                </div>

                <div className={`concept-canvas-grid ${compareMode ? 'is-compare' : ''}`}>
                  {compareMode && currentInsights && (
                    <div className="concept-canvas-card">
                      <header>
                        <b>当前方案（原稿）</b>
                        <span>{currentInsights.seats} 座 · {currentInsights.estimatedPowerKw} kW · {fmtYuan(currentInsights.budgetMin)}–{fmtYuan(currentInsights.budgetMax)}</span>
                      </header>
                      <PlanMiniPreview project={project} />
                    </div>
                  )}
                  <div className="concept-canvas-card is-primary">
                    <header>
                      <b>估算预览（实时贴合你的实测外墙）</b>
                      <span>
                        {est.criticalConflicts === 0
                          ? <><CheckCircle2 size={14} /> 零碰撞 · 保留外墙与门窗 {est.preservedShellCount} 项</>
                          : <><AlertTriangle size={14} /> {est.criticalConflicts} 处待微调</>}
                      </span>
                    </header>
                    <PlanMiniPreview project={result.project} />
                  </div>
                </div>

                <div className="concept-breakdown">
                  <div><b>桌型明细：</b>{est.seatBreakdown}（{est.comfortLabel}）</div>
                  {est.warnings.map((w, idx) => (
                    <div key={idx} className="concept-warning"><AlertTriangle size={14} /> {w}</div>
                  ))}
                </div>
              </>
            ) : (
              <p className="property-error">当前铺位轮廓暂不支持自动估算，请先确认外轮廓已闭合且尺寸有效。</p>
            )}
          </section>
        </div>

        <footer className="concept-footer">
          <button
            type="button"
            onClick={() => setOptions(defaultConceptOptions(options.businessType))}
          >
            <RotateCcw />恢复默认比例
          </button>
          <div className="concept-footer-right">
            <button
              type="button"
              disabled={!result || saving || session.busy}
              onClick={() => void saveAsVariant()}
            >
              <CopyPlus />{saving ? '正在另存…' : '另存为对比方案'}
            </button>
            <button
              type="button"
              className="primary"
              disabled={!result || saving}
              onClick={applyToCurrent}
            >
              <Sparkles />应用到当前铺位（可撤销）
            </button>
          </div>
        </footer>
      </dialog>
    </>
  );
});

export default ConceptPlannerDialog;
