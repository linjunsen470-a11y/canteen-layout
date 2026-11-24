import { useEffect, useMemo, useRef, useState } from 'react';
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

export default function ConceptPlannerDialog({ notify, openSignal = 0 }: { notify: (msg: string) => void; openSignal?: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const project = useStore(s => s.project);
  const commit = useStore(s => s.commit);
  const session = useProjectSession();

  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConceptPlannerOptions>(() => defaultConceptOptions('bistro'));
  const [draftRatio, setDraftRatio] = useState<number | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setOpen(true);
    if (!dialog.current?.open) dialog.current?.showModal();
  };
  useEffect(() => {
    if (openSignal > 0 && session.ready && !session.busy) openModal();
  }, [openSignal]);
  const commitRatio = (value: number) => {
    setDraftRatio(null);
    setOptions(prev => prev.kitchenRatioPct === value ? prev : { ...prev, kitchenRatioPct: value });
  };

  const currentInsights = useMemo(() => (open ? analyzeShop(project) : null), [open, project]);

  const { result, error } = useMemo(() => {
    if (!open) return { result: null, error: '' };
    try {
      return { result: generateConceptLayout(project, options), error: '' };
    } catch (e) {
      return { result: null, error: (e as Error).message };
    }
  }, [open, project, options]);

  const switchBusiness = (bt: ConceptBusinessType) => {
    setDraftRatio(null);
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
    if (!result || project.basicDraft) return;
    if (commit(result.project)) {
      dialog.current?.close();
      setOpen(false);
      useWorkspace.getState().set({ view: 'split', focusMode: false });
      notify(`已按当前铺位落位，后厨 ${result.estimate.kitchenAreaSqm.toFixed(1)}㎡ · 前厅 ${result.estimate.diningAreaSqm.toFixed(1)}㎡ · ${result.estimate.seats} 座（可一键撤销）`);
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
        title="基于当前铺位外墙与门窗柱子，快速试算后厨/前厅面积占比与桌椅数量"
        onClick={openModal}
      >
        <Sparkles />智能分区估算
      </button>

      <dialog
        ref={dialog}
        className="concept-dialog"
        aria-labelledby="concept-dialog-title"
        onClose={() => { setOpen(false); setDraftRatio(null); }}
      >
        <header className="concept-header">
          <div>
            <h2 id="concept-dialog-title">智能分区与摆桌估算</h2>
            <p>
              按当前铺位的墙、隔断和柱子试排。可比较餐厨面积与可摆座数，满意后再应用或另存。
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
                    <strong>{draftRatio ?? options.kitchenRatioPct}% {draftRatio === null && est ? `（约 ${est.kitchenAreaSqm.toFixed(1)} ㎡）` : ''}</strong>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={50}
                    step={1}
                    value={draftRatio ?? options.kitchenRatioPct}
                    onChange={e => setDraftRatio(e.currentTarget.valueAsNumber)}
                    onPointerUp={e => commitRatio(e.currentTarget.valueAsNumber)}
                    onKeyUp={e => commitRatio(e.currentTarget.valueAsNumber)}
                    onBlur={e => commitRatio(e.currentTarget.valueAsNumber)}
                    onPointerCancel={() => setDraftRatio(null)}
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
                {options.kitchenSide !== 'none' && options.includeKitchenEquip && (
                  <label>
                    <input
                      type="checkbox"
                      checked={!!options.includePartition}
                      onChange={e => setOptions(o => ({ ...o, includePartition: e.target.checked }))}
                    />
                    在餐厨交界加明档半高隔断
                  </label>
                )}
                {!project.items.some(i => i.kind === 'door' && !(i.generated === 'concept' && !i.locked)) && project.items.some(i => i.kind === 'wall') && (
                  <label>
                    <input
                      type="checkbox"
                      checked={!!options.includeStorefront}
                      onChange={e => setOptions(o => ({ ...o, includeStorefront: e.target.checked }))}
                    />
                    在临街外墙示意双开玻璃门与橱窗
                  </label>
                )}
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
                    <small>配电估算（含场地基础负荷）</small>
                    <strong>{est.estimatedPowerKw} kW</strong>
                    <span>已摆物件采购 {fmtYuan(est.budgetMin)}–{fmtYuan(est.budgetMax)}</span>
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
                      <b>估算预览（沿当前铺位外墙试排）</b>
                      <span>
                        {est.criticalConflicts === 0
                          ? <><CheckCircle2 size={14} /> 未发现物件碰撞</>
                          : <><AlertTriangle size={14} /> {est.criticalConflicts} 处待微调</>}
                      </span>
                    </header>
                    <PlanMiniPreview project={result.project} nearestTables={est.nearestTables} />
                  </div>
                </div>

                <div className="concept-breakdown">
                  <div><b>桌型明细：</b>{est.seatBreakdown}（{est.comfortLabel}）</div>
                  {est.nearestTables && <div>桌组间最窄处（含椅背） {Math.floor(est.nearestTables.distance + 1e-6)} mm</div>}
                  {est.replacementNames.length > 0 && <details>
                    <summary>应用将替换 {est.replacementNames.length} 件原有物件或分区</summary>
                    <p>{est.replacementNames.join('、')}</p>
                  </details>}
                  {est.warnings.map((w, idx) => (
                    <div key={idx} className="concept-warning"><AlertTriangle size={14} /> {w}</div>
                  ))}
                </div>
              </>
            ) : (
              <p className="property-error" role="alert">{error}</p>
            )}
          </section>
        </div>

        <footer className="concept-footer">
          <button
            type="button"
            onClick={() => { setDraftRatio(null); setOptions(defaultConceptOptions(options.businessType)); }}
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
            {!project.basicDraft && <button
              type="button"
              className="primary"
              disabled={!result || saving}
              onClick={applyToCurrent}
            >
              <Sparkles />应用到当前铺位（可撤销）
            </button>}
          </div>
        </footer>
      </dialog>
    </>
  );
}
