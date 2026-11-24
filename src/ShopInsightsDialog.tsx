import { useEffect, useRef } from 'react';
import { BarChart3, CheckCircle2, AlertTriangle, Download, LocateFixed, Zap, Lightbulb } from 'lucide-react';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { planningAreaLabel, siteArea } from './site';
import { type ShopInsights, bomCSV } from './shopAnalytics';
import type { SpaceIssue } from './spaceChecks';
import { download } from './projectIO';

const fmtYuan = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString()}`;

type Props = {
  openSignal: number;
  insights: ShopInsights;
  issues: SpaceIssue[];
  criticalCount: number;
};

export default function ShopInsightsDialog({ openSignal, insights, issues, criticalCount }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const project = useStore(s => s.project);
  const commit = useStore(s => s.commit);
  const open = () => dialog.current?.showModal();

  useEffect(() => {
    if (openSignal > 0) open();
  }, [openSignal]);

  const exportCSV = () => {
    const csv = bomCSV(project, insights);
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${project.name}-设备与预算参考清单.csv`);
  };

  const locateIssue = (ids: string[]) => {
    const s = useStore.getState();
    s.cancelInteraction();
    s.selectMany(ids);
    s.locate();
    const prefs = useWorkspace.getState();
    if (prefs.view === '3d') prefs.set({ view: 'split' });
    dialog.current?.close();
  };

  const clearanceCount = issues.length - criticalCount;

  return <>
    <button onClick={open} title="查看面积坪效、餐厨比、配电负荷、动线体检与采购预算">
      <BarChart3 />开店概览
    </button>
    <dialog ref={dialog} className="insights-dialog" aria-labelledby="insights-heading">
      <header className="wizard-header">
        <div>
          <h2 id="insights-heading">{project.name} · 可行性体检与预算概览</h2>
          <p>汇总实测面积、客座舒适度、餐厨比、商用配电预估、空间体检与分类采购预算</p>
        </div>
        <div className="insights-header-actions">
          <button type="button" onClick={exportCSV}><Download />导出清单 CSV</button>
          <button type="button" onClick={() => dialog.current?.close()}>关闭</button>
        </div>
      </header>

      <div className="kpi-grid kpi-grid-5">
        <div className="kpi-card">
          <small>{planningAreaLabel(project)}</small>
          <strong>{insights.areaSqm.toFixed(2)} ㎡</strong>
          <span>{project.survey && <>外轮廓面积 {(siteArea(project)/1e6).toFixed(2)} ㎡ · </>}{(project.width / 1000).toFixed(1)}m × {(project.height / 1000).toFixed(1)}m</span>
        </div>
        <div className="kpi-card">
          <small>明确客座总数</small>
          <strong>{insights.seats} 座</strong>
          <span>{insights.sqmPerSeat ? `约 ${insights.sqmPerSeat.toFixed(2)} ㎡/座 · ${insights.comfortLabel}` : '请添加桌椅组合'}</span>
        </div>
        <div className="kpi-card">
          <small>餐厨面积配比</small>
          <strong>{insights.diningRatioPct !== null ? `${insights.diningRatioPct}% : ${insights.kitchenRatioPct}%` : '未分区'}</strong>
          <span>{insights.diningSqm > 0 ? `客区 ${insights.diningSqm.toFixed(1)}㎡ · 后厨 ${insights.kitchenSqm.toFixed(1)}㎡` : '可添加分区查看'}</span>
        </div>
        <div className="kpi-card">
          <small>预估商用配电</small>
          <strong>{insights.estimatedPowerKw} kW</strong>
          <span>{insights.estimatedPowerKw >= 10 ? '建议核实 380V 三相电' : '220V 商用电通常够用'}</span>
        </div>
        <div className="kpi-card">
          <small>设备软装估算参考</small>
          <strong>{insights.budgetMax > 0 ? `${fmtYuan(insights.budgetMin)} ~ ${fmtYuan(insights.budgetMax)}` : '待布置'}</strong>
          <span>共 {insights.bom.reduce((sum, r) => sum + r.count, 0)} 件（不含硬装）</span>
        </div>
      </div>

      <div className="insights-advice-grid">
        <div className="insights-advice"><Lightbulb /><span>{insights.ratioAdvice} {insights.actionTips[0]}</span></div>
        <div className="insights-advice is-power"><Zap /><span>{insights.powerAdvice}</span></div>
      </div>

      <div className="insights-columns">
        <section className="insights-section">
          <h3>开店必备项体检</h3>
          <ul className="readiness-list">
            {insights.readiness.map(item => (
              <li key={item.label} className={item.ok ? 'is-ok' : 'is-warn'}>
                {item.ok ? <CheckCircle2 /> : <AlertTriangle />}
                <div><b>{item.label}</b><small>{item.detail}</small></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="insights-section">
          <h3>空间碰撞与通道体检（{criticalCount > 0 ? `${criticalCount} 项冲突 · ` : '0 项冲突 · '}{clearanceCount} 条净距参考）</h3>
          {issues.length === 0 ? (
            <p className="check-clear">未发现碰撞、门扇冲突或越界问题，动线状态良好。</p>
          ) : (
            <div className="insights-issues">
              {issues.slice(0, 20).map((issue, idx) => (
                <button type="button" key={idx} className={issue.type !== '参考净距' ? 'is-critical' : ''} onClick={() => locateIssue(issue.ids)}>
                  <span><strong>{issue.type}</strong> {issue.message}</span>
                  <LocateFixed />
                </button>
              ))}
              {issues.length > 20 && <small>还有 {issues.length - 20} 条提示，可在「排列与检查」面板分步查看。</small>}
            </div>
          )}
        </section>
      </div>

      {insights.categoryBudgets.length > 0 && (
        <section className="insights-section">
          <h3>分类投入占比一览</h3>
          <div className="cat-budget-strip">
            {insights.categoryBudgets.map(cb => (
              <div key={cb.category} className="cat-budget-pill">
                <small>{cb.category}（{cb.count} 件）</small>
                <b>{cb.max > 0 ? `${fmtYuan(cb.min)} ~ ${fmtYuan(cb.max)}` : '按实测计价'}</b>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="insights-section">
        <h3>给合伙人 / 房东的讨论备注（将同步写入导出的方案书）</h3>
        <textarea
          className="partner-notes-input"
          rows={2}
          value={project.metadata.notes}
          onChange={e => commit({ ...project, metadata: { ...project.metadata, notes: e.target.value } })}
          placeholder="例如：月租 2.8 万，需向物业核实排烟井口位置及 380V 三相电增容条件，周末约合伙人看 A/B 两版摆法…"
        />
      </section>

      <section className="insights-section">
        <h3>分类设备、灯具与软装参考清单</h3>
        <div className="bom-table-wrap">
          <table className="bom-table">
            <thead>
              <tr><th>分类</th><th>名称</th><th>规格尺寸</th><th>数量</th><th>参考小计区间</th></tr>
            </thead>
            <tbody>
              {insights.bom.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.category}</td>
                  <td><b>{row.name}</b></td>
                  <td>{row.spec}</td>
                  <td>{row.count}</td>
                  <td>{row.unitPriceMax > 0 ? `${fmtYuan(row.unitPriceMin * row.count)} ~ ${fmtYuan(row.unitPriceMax * row.count)}` : '按实测计价'}</td>
                </tr>
              ))}
              {insights.bom.length === 0 && <tr><td colSpan={5}>当前方案暂无可见设备与家具。</td></tr>}
            </tbody>
          </table>
        </div>
        <small className="bom-disclaimer">说明：预算区间为商用餐饮家具/厨具/灯具市场常见参考价，不包含商场硬装拆改、消防暖通报建与品牌定制费，实际以供应商报价为准。</small>
      </section>
    </dialog>
  </>;
}
