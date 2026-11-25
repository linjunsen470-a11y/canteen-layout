import { useEffect, useRef, useState } from 'react';
import type { Project, Underlay } from './model';
import type { NotchCorner } from './site';
import { businessTypeDefaults, type ConceptBusinessType } from './conceptPlanner';
import { rememberDraftChoices } from './draftChoices';
import { requestLayoutCandidates } from './requestBasicLayout';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { buildUnderlayFramedShell, initialUnderlayFrame, normalizeFrame } from './underlayFrame';
import { useUnderlayFrame } from './underlayFrameState';

export default function UnderlayQuickFrameBar({
  project,
  notify,
}: {
  project: Project;
  notify: (msg: string) => void;
}) {
  const { projectId, frame, start, update, clear } = useUnderlayFrame();
  const tool = useStore(s => s.tool);
  const [business, setBusiness] = useState<ConceptBusinessType>('bistro');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const worker = useRef<AbortController | null>(null);

  const u = project.underlay;
  const activeFrame = frame && projectId === project.id ? frame : null;
  const eligible = !!u?.calibration && !project.basicDraft && !project.items.length;

  useEffect(() => () => worker.current?.abort(), []);
  useEffect(() => {
    if (projectId && projectId !== project.id) clear();
  }, [projectId, project.id, clear]);
  useEffect(() => {
    if (!eligible && activeFrame) clear();
  }, [eligible, activeFrame, clear]);
  useEffect(() => {
    if (tool !== 'select' && activeFrame) clear();
  }, [tool, activeFrame, clear]);

  if (!eligible || !u) return null;

  const patchUnderlay = (patch: Partial<Underlay>) => {
    const live = useStore.getState().project;
    if (!live.underlay) return;
    useStore.getState().commit({ ...live, underlay: { ...live.underlay, ...patch } });
  };

  const startShape = (shape: 'rectangle' | 'l-shape') => {
    setError('');
    useStore.getState().setTool('select');
    start(project.id, initialUnderlayFrame(project, shape));
  };

  const setMetres = (field: 'width' | 'depth' | 'notchWidth' | 'notchDepth', raw: string) => {
    if (!activeFrame) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return;
    update(normalizeFrame({ ...activeFrame, [field]: Math.round(n * 1000) }));
  };

  async function confirmGenerate() {
    if (!activeFrame || busy) return;
    worker.current?.abort();
    const controller = new AbortController();
    worker.current = controller;
    setBusy(true);
    setError('');
    try {
      const live = useStore.getState().project;
      const shell = buildUnderlayFramedShell(live, activeFrame);
      const choices = await requestLayoutCandidates(shell, business, controller.signal);
      if (controller.signal.aborted) return;
      const { project: drafted, warnings } = choices[0];
      if (!useStore.getState().commit(drafted)) {
        throw Error(useStore.getState().error || '应用首稿失败');
      }
      rememberDraftChoices(useStore.getState().project, choices, 0);
      clear();
      useWorkspace.getState().set({
        view: 'split',
        focusMode: false,
        camera: 'oblique',
        move3D: false,
        propsOpen: false,
        libraryOpen: true,
      });
      useStore.getState().setMode('layout');
      useStore.getState().setTool('select');
      notify(warnings.length ? '已按底图套框生成首稿，点「生成记录」查看缺项' : '已按底图套框生成第一稿，可拖改桌椅或一键隐藏底图');
    } catch (e) {
      if (!controller.signal.aborted) setError((e as Error).message || '套框生成失败，请重试');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return (
    <div className="underlay-quick-bar" role="region" aria-label="户型图快速套框">
      {!activeFrame ? (
        <>
          <strong>底图已校准</strong>
          <button type="button" className="primary" onClick={() => startShape('rectangle')}>按尺寸套矩形</button>
          <button type="button" onClick={() => startShape('l-shape')}>按尺寸套 L 形</button>
          <button type="button" onClick={() => { clear(); useStore.getState().setTool('outline-draw'); }}>沿底图点角</button>
          <label className="underlay-quick-opacity">
            透明度
            <input
              aria-label="套框底图透明度"
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={u.opacity}
              onChange={e => patchUnderlay({ opacity: Number(e.target.value) })}
            />
          </label>
          <button type="button" onClick={() => patchUnderlay({ hidden: !u.hidden })}>
            {u.hidden ? '恢复显示底图' : '出图隐藏底图'}
          </button>
        </>
      ) : (
        <>
          <strong>{activeFrame.shape === 'l-shape' ? 'L 形套框' : '矩形套框'}</strong>
          <label>
            净宽(m)
            <input
              aria-label="套框净宽（米）"
              type="number"
              inputMode="decimal"
              min="1"
              max="60"
              step="0.1"
              disabled={busy}
              value={Number((activeFrame.width / 1000).toFixed(2))}
              onChange={e => setMetres('width', e.target.value)}
            />
          </label>
          <label>
            净深(m)
            <input
              aria-label="套框净深（米）"
              type="number"
              inputMode="decimal"
              min="1"
              max="60"
              step="0.1"
              disabled={busy}
              value={Number((activeFrame.depth / 1000).toFixed(2))}
              onChange={e => setMetres('depth', e.target.value)}
            />
          </label>
          {activeFrame.shape === 'l-shape' && (
            <>
              <label>
                缺口
                <select
                  aria-label="套框缺口位置"
                  disabled={busy}
                  value={activeFrame.notchCorner}
                  onChange={e => update(normalizeFrame({ ...activeFrame, notchCorner: e.target.value as NotchCorner }))}
                >
                  <option value="top-left">左上</option>
                  <option value="top-right">右上</option>
                  <option value="bottom-left">左下</option>
                  <option value="bottom-right">右下</option>
                </select>
              </label>
              <label>
                缺宽(m)
                <input
                  aria-label="套框缺口宽（米）"
                  type="number"
                  inputMode="decimal"
                  min="0.5"
                  max="59"
                  step="0.1"
                  disabled={busy}
                  value={Number((activeFrame.notchWidth / 1000).toFixed(2))}
                  onChange={e => setMetres('notchWidth', e.target.value)}
                />
              </label>
              <label>
                缺深(m)
                <input
                  aria-label="套框缺口深（米）"
                  type="number"
                  inputMode="decimal"
                  min="0.5"
                  max="59"
                  step="0.1"
                  disabled={busy}
                  value={Number((activeFrame.notchDepth / 1000).toFixed(2))}
                  onChange={e => setMetres('notchDepth', e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            业态
            <select
              aria-label="套框餐饮业态"
              disabled={busy}
              value={business}
              onChange={e => setBusiness(e.target.value as ConceptBusinessType)}
            >
              {Object.entries(businessTypeDefaults).map(([key, v]) => (
                <option key={key} value={key}>{v.label}</option>
              ))}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={() => patchUnderlay({ hidden: !u.hidden })}>
            {u.hidden ? '恢复显示底图' : '出图隐藏底图'}
          </button>
          <button type="button" className="primary" disabled={busy} onClick={() => void confirmGenerate()}>
            {busy ? '正在生成…' : '确认并生成第一稿'}
          </button>
          <button type="button" disabled={busy} onClick={() => { worker.current?.abort(); clear(); }}>
            退出套框
          </button>
          {error && <span role="alert" className="underlay-quick-error">{error}</span>}
        </>
      )}
    </div>
  );
}
