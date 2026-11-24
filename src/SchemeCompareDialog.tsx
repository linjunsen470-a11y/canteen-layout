import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Columns3, Check, Sparkles } from 'lucide-react';
import { useStore } from './store';
import { analyzeShop } from './shopAnalytics';
import { buildShopVariants, inferAutoSpecFromProject } from './autoShopLayout';
import { copyProject, useProjectSession } from './projectSession';
import { useWorkspace } from './workspace';
import PlanMiniPreview from './PlanMiniPreview';

export type SchemeCompareHandle = { open: () => void };

const fmtYuan = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString()}`;

const SchemeCompareDialog = forwardRef<SchemeCompareHandle, { notify: (msg: string) => void }>(function SchemeCompareDialog({ notify }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const project = useStore(s => s.project);
  const busy = useProjectSession(s => s.busy);

  const openModal = () => {
    setOpened(true);
    dialog.current?.showModal();
  };

  useImperativeHandle(ref, () => ({ open: openModal }));

  const currentStats = useMemo(() => analyzeShop(project), [project]);
  const supported = project.width <= 60000 && project.height <= 60000;
  const variants = useMemo(() => {
    if (!opened || !supported) return [];
    const base = inferAutoSpecFromProject(project);
    return buildShopVariants(base, project).map(v => ({
      ...v,
      stats: analyzeShop(v.project),
    }));
  }, [opened, project, supported]);

  const applyVariant = async (title: string, target: typeof variants[number]) => {
    const ok = await copyProject(target.project.name, target.project);
    if (ok) {
      dialog.current?.close();
      useWorkspace.getState().set({ view: 'split', focusMode: false });
      notify(`已另存并切换至「${title}」（${target.stats.seats} 座），原方案已保留在项目库中随时对比`);
    }
  };

  return <>
    <button onClick={openModal} title="基于当前铺位尺寸自动生成 3 种不同摆法，对比座位数、动线与预算">
      <Columns3 />换一种摆法
    </button>
    <dialog ref={dialog} className="compare-dialog" onClose={() => setOpened(false)} aria-labelledby="compare-heading">
      <header className="wizard-header">
        <div>
          <h2 id="compare-heading">同一铺位 · 换一种摆法对比</h2>
          <p>当前铺位 {project.width / 1000} m × {project.height / 1000} m。三种摆法均保留底图、墙柱和后厨，只调整可移动桌椅。采用后另存为新方案。</p>
        </div>
        <button type="button" onClick={() => dialog.current?.close()}>关闭</button>
      </header>

      <div className="compare-current-bar">
        <Sparkles />
        <span>当前正在编辑：<b>{project.name}</b></span>
        <span>·</span>
        <span><b>{currentStats.seats} 座</b>（{currentStats.sqmPerSeat ? `${currentStats.sqmPerSeat.toFixed(1)}㎡/座` : '未布置'}）</span>
        <span>·</span>
        <span>设备参考 {currentStats.budgetMax > 0 ? `${fmtYuan(currentStats.budgetMin)} ~ ${fmtYuan(currentStats.budgetMax)}` : '待布置'}</span>
      </div>

      {!supported && <p role="status">当前铺位超过自动摆法支持的 60 m × 60 m 范围，可从项目库另存副本后手动调整。</p>}
      <div className="compare-grid">
        {variants.map(v => {
          const seatDelta = v.stats.seats - currentStats.seats;
          return (
            <article key={v.id} className="compare-card">
              <div className="compare-card-head">
                <span className="compare-badge">{v.badge}</span>
                {seatDelta !== 0 && (
                  <em className={seatDelta > 0 ? 'delta-up' : 'delta-down'}>
                    {seatDelta > 0 ? `+${seatDelta} 座` : `${seatDelta} 座`}
                  </em>
                )}
              </div>
              <h3>{v.title}</h3>
              <p>{v.summary}</p>
              <div className="compare-preview">
                <PlanMiniPreview project={v.project} />
              </div>
              <dl className="compare-metrics">
                <div><dt>规划客座</dt><dd><b>{v.stats.seats} 座</b></dd></div>
                <div><dt>人均空间</dt><dd>{v.stats.sqmPerSeat ? `${v.stats.sqmPerSeat.toFixed(2)} ㎡/座` : '—'}</dd></div>
                <div><dt>餐厨配比</dt><dd>{v.stats.diningRatioPct !== null ? `${v.stats.diningRatioPct}:${v.stats.kitchenRatioPct}` : '—'}</dd></div>
                <div><dt>预估配电</dt><dd>{v.stats.estimatedPowerKw} kW</dd></div>
                <div className="wide"><dt>设备软装参考</dt><dd>{fmtYuan(v.stats.budgetMin)} ~ {fmtYuan(v.stats.budgetMax)}</dd></div>
              </dl>
              <button type="button" className="primary" disabled={busy} onClick={() => void applyVariant(v.title, v)}>
                <Check />另存并预览此摆法
              </button>
            </article>
          );
        })}
      </div>
    </dialog>
  </>;
});

export default SchemeCompareDialog;
