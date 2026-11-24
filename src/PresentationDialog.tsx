import { createPortal } from 'react-dom';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { download } from './projectIO';
import { useStore } from './store';
import { presentationHTML } from './presentation';
import type { SceneGalleryShots } from './SceneCapture';

export type PresentationCaptureResult = {
  plan: string;
  scene: string;
  gallery?: SceneGalleryShots;
};

export type PresentationDialogHandle = { open: () => void };

const PresentationDialog = forwardRef<PresentationDialogHandle, {
  capture: () => Promise<PresentationCaptureResult>;
}>(function PresentationDialog({ capture }, ref) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, H] = useState('');
  const [name, N] = useState('');
  const [busy, B] = useState(false);
  const [error, E] = useState('');
  const notes = useStore(s => s.project.metadata.notes);
  const commit = useStore(s => s.commit);

  const prepare = async () => {
    B(true);
    E('');
    H('');
    dialog.current?.showModal();
    useStore.getState().cancelInteraction();
    const project = structuredClone(useStore.getState().project);
    try {
      const { plan, scene, gallery } = await capture();
      H(presentationHTML(project, plan, scene, new Date().toLocaleString('zh-CN'), gallery));
      N(project.name);
    } catch (e) {
      E((e as Error).message);
    } finally {
      B(false);
    }
  };

  useImperativeHandle(ref, () => ({ open: () => { void prepare(); } }));

  return <>
    <button disabled={busy} onClick={() => void prepare()}>{busy ? '生成中…' : '客户成果'}</button>
    {createPortal(
      <dialog ref={dialog} className="presentation-dialog" aria-label="客户布局成果" onCancel={e => { if (busy) e.preventDefault(); }}>
        <header>
          <div>
            <b>合伙人方案书 · 多角度效果图快照</b>
            <small>包含 2D 建筑平面 + 3 视角 3D 效果图 + 配电预算清单，可直接发给合伙人手机/电脑查阅</small>
          </div>
          <div className="presentation-actions">
            <button disabled={busy} onClick={() => void prepare()}>刷新快照</button>
            <button className="primary" disabled={busy || !html} onClick={() => download(new Blob([html], { type: 'text/html;charset=utf-8' }), `${name}-开店规划方案书.html`)}>下载展示页</button>
            <button disabled={busy || !html} onClick={() => frame.current?.contentWindow?.print()}>打印 / PDF</button>
            <button disabled={busy} onClick={() => dialog.current?.close()}>关闭成果</button>
          </div>
        </header>
        <div className="presentation-note-bar">
          <label>
            <span>给合伙人/房东的备注：</span>
            <input
              value={notes}
              onChange={e => {
                const p = useStore.getState().project;
                commit({ ...p, metadata: { ...p.metadata, notes: e.target.value } });
              }}
              placeholder="例如：月租与排烟条件待确认，重点讨论客座数量与门头风格（改完点右侧「刷新快照」）"
            />
          </label>
        </div>
        {busy
          ? <p className="presentation-status" role="status">正在拍摄 2D 建筑平面与 3 组 3D 效果图并生成方案书…</p>
          : error
            ? <p className="presentation-status" role="alert">{error}</p>
            : <iframe ref={frame} title="客户方案预览" sandbox="allow-same-origin allow-modals allow-scripts" srcDoc={html} />}
      </dialog>,
      document.body
    )}
  </>;
});

export default PresentationDialog;
