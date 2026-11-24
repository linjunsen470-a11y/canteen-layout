import { useEffect, useRef, useState } from 'react';
import type { BasicLayoutCandidate } from './basicLayout';
import { businessTypeDefaults, type ConceptBusinessType } from './conceptPlanner';
import { currentDraftChoices, draftSnapshot, rememberDraftChoices } from './draftChoices';
import type { Project } from './model';
import PlanMiniPreview from './PlanMiniPreview';
import { copyProject, useProjectSession } from './projectSession';
import { requestLayoutCandidates } from './requestBasicLayout';
import { useWorkspace } from './workspace';
import { useStore } from './store';

type Comparison = { snapshot: string; choices: BasicLayoutCandidate[]; current?: number };

export default function BasicDraftBar({ project, notify }: { project: Project; notify: (msg: string) => void }) {
  const draft = project.basicDraft!;
  const dialog = useRef<HTMLDialogElement>(null);
  const worker = useRef<AbortController | null>(null);
  const [business, setBusiness] = useState(draft.business);
  const [comparison, setComparison] = useState<Comparison>();
  const [selected, setSelected] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => () => worker.current?.abort(), []);

  async function compare(next: ConceptBusinessType) {
    worker.current?.abort();
    const controller = new AbortController();
    worker.current = controller;
    setBusiness(next); setError(''); setComparison(undefined); setSelected(0);
    const live = useStore.getState().project;
    const snapshot = draftSnapshot(live);
    const cached = next === live.basicDraft?.business && currentDraftChoices(snapshot);
    if (cached) {
      setComparison({ snapshot, choices: cached.choices, current: cached.selected });
      setSelected(cached.selected);
      return;
    }
    try {
      const choices = await requestLayoutCandidates(live, next, controller.signal);
      if (!controller.signal.aborted) setComparison({ snapshot, choices });
    } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
  }

  async function apply(copy: boolean) {
    if (!comparison || saving) return;
    const live = useStore.getState().project;
    if (comparison.snapshot !== draftSnapshot(live)) {
      setComparison(undefined); setError('铺位内容已有变化，请重新比较。'); return;
    }
    const candidate = comparison.choices[selected];
    const { items, groups, clearance, basicDraft } = candidate.project;
    const next = { ...live, items, groups, clearance, basicDraft };
    setSaving(true); setError('');
    try {
      if (copy) {
        const base = live.name.replace(/(?: · 新稿(?: \d+)?)+$/, '');
        const names = new Set(useProjectSession.getState().rows.map(row => row.project.name));
        let name = base + ' · 新稿';
        for (let n = 2; names.has(name); n++) name = base + ' · 新稿 ' + n;
        if (!await copyProject(name, next)) throw Error(useProjectSession.getState().message || '保存新稿失败');
        useWorkspace.getState().set({ view: 'split', focusMode: false, camera: 'oblique', move3D: false, propsOpen: false });
      } else {
        if (comparison.current === undefined || !currentDraftChoices(comparison.snapshot)) return;
        if (!useStore.getState().commit(next)) throw Error(useStore.getState().error || '应用摆法失败');
      }
      rememberDraftChoices(useStore.getState().project, comparison.choices, selected);
      useStore.getState().setMode('layout');
      dialog.current?.close();
      notify(copy ? '新稿已打开，原稿可从项目库打开' : '已应用摆法，可撤销');
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  return <div className="basic-draft-bar">
    <span>拖动桌组调整位置，双击可单选椅子</span>
    <details><summary>生成记录{draft.warnings.length ? `（${draft.warnings.length}）` : ''}</summary>
      <div><strong>{businessTypeDefaults[draft.business].label}</strong>
        {draft.warnings.length ? <ul>{draft.warnings.map(w => <li key={w}>{w}</li>)}</ul> : <p>基础设备和桌组均已摆入。</p>}
      </div>
    </details>
    <button onClick={() => { dialog.current?.showModal(); void compare(draft.business); }}>比较摆法</button>
    <dialog ref={dialog} className="draft-variant-dialog" aria-labelledby="draft-compare-title"
      onClose={() => worker.current?.abort()} onCancel={e => { if (saving) e.preventDefault(); }}>
      <header><h2 id="draft-compare-title">比较摆法</h2>
        <button disabled={saving} onClick={() => dialog.current?.close()}>关闭</button></header>
      <label>餐饮业态<select disabled={saving} value={business} onChange={e => void compare(e.target.value as ConceptBusinessType)}>
        {Object.entries(businessTypeDefaults).map(([key,v]) => <option key={key} value={key}>{v.label}</option>)}
      </select></label>
      {comparison ? <>
        <div className="draft-choice-grid" role="group" aria-label="候选摆法">
          {comparison.choices.map((choice, index) => <button key={index} aria-pressed={selected === index}
            disabled={saving} onClick={() => setSelected(index)}>
            <PlanMiniPreview project={choice.project} showZoneLabels={false}/>
            <strong>{choice.label}</strong>
            <span>{choice.tables} 桌 · {choice.capacity.seats} 座{choice.capacity.unknown ? '（另有未标定座位）' : ''}</span>
            {choice.tableGapMm !== null && <span>最窄桌组间距 {choice.tableGapMm} mm</span>}
            {comparison.current === index && <small>当前摆法</small>}
          </button>)}
        </div>
        {comparison.choices.length === 1 && <p>这间铺位仅有一份可供比较的草稿。</p>}
        {!!comparison.choices[selected].warnings.length && <details key={selected} className="draft-choice-warnings">
          <summary>所选摆法的生成记录（{comparison.choices[selected].warnings.length}）</summary>
          <ul>{comparison.choices[selected].warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </details>}
        <div className="draft-choice-actions"><span>{comparison.current === undefined ? '另存后，当前草稿可在项目库找回。' : '应用后可撤销。'}</span>
          <button disabled={saving} className={comparison.current === undefined ? 'primary' : ''} onClick={() => void apply(true)}>另存为新稿</button>
          {comparison.current !== undefined && <button disabled={saving || selected === comparison.current} className="primary" onClick={() => void apply(false)}>应用摆法</button>}
        </div>
      </> : !error && <p role="status">正在按铺位轮廓和固定构件试排…</p>}
      {error && <p role="alert">{error} <button disabled={saving} onClick={() => void compare(business)}>重新比较</button></p>}
    </dialog>
  </div>;
}
