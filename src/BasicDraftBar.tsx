import { useRef, useState } from 'react';
import { businessTypeDefaults, type ConceptBusinessType } from './conceptPlanner';
import type { Project } from './model';
import { copyProject, useProjectSession } from './projectSession';
import { requestBasicLayout } from './requestBasicLayout';
import { useWorkspace } from './workspace';
import { useStore } from './store';

export default function BasicDraftBar({ project, notify }: { project: Project; notify: (msg: string) => void }) {
  const draft = project.basicDraft!;
  const dialog = useRef<HTMLDialogElement>(null);
  const [business, setBusiness] = useState(draft.business);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function generate() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await requestBasicLayout(project, business);
      const base = project.name.replace(/(?: · 新稿(?: \d+)?)+$/, '');
      const names = new Set(useProjectSession.getState().rows.map(row => row.project.name));
      let name = base + ' · 新稿';
      for (let n = 2; names.has(name); n++) name = base + ' · 新稿 ' + n;
      if (!await copyProject(name, result.project)) throw Error(useProjectSession.getState().message || '保存新稿失败');
      useWorkspace.getState().set({ view: 'split', focusMode: false, camera: 'oblique', move3D: false, propsOpen: false });
      useStore.getState().setMode('layout');
      dialog.current?.close();
      notify('新稿已打开，原稿可从项目库打开');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="basic-draft-bar">
    <span>拖动桌组调整位置，双击可单选椅子</span>
    <details><summary>生成记录{draft.warnings.length ? `（${draft.warnings.length}）` : ''}</summary>
      <div><strong>{businessTypeDefaults[draft.business].label}</strong>
        {draft.warnings.length ? <ul>{draft.warnings.map(w => <li key={w}>{w}</li>)}</ul> : <p>基础设备和桌组均已摆入。</p>}
      </div>
    </details>
    <button onClick={() => { setError(''); setBusiness(draft.business); dialog.current?.showModal(); }}>另生成一稿</button>
    <dialog ref={dialog} className="draft-variant-dialog" aria-label="另生成一稿" onCancel={e => { if (busy) e.preventDefault(); }}>
      <h2>另生成一稿</h2><p>沿用这间铺位和固定构件，另存为独立项目。当前的拖改保存在原稿。</p>
      <label>餐饮业态<select disabled={busy} value={business} onChange={e => setBusiness(e.target.value as ConceptBusinessType)}>
        {Object.entries(businessTypeDefaults).map(([key,v]) => <option key={key} value={key}>{v.label}</option>)}
      </select></label>
      {error && <p role="alert">{error}</p>}
      <footer><button disabled={busy} onClick={() => dialog.current?.close()}>返回</button>
        <button disabled={busy} className="primary" onClick={generate}>{busy ? '正在试排…' : '生成并另存'}</button></footer>
    </dialog>
  </div>;
}
