import { useRef, useState } from 'react';
import { download } from './projectIO';
import { useStore } from './store';
import { presentationHTML } from './presentation';
export default function PresentationDialog({capture}:{capture:()=>Promise<{plan:string;scene:string}>}){
 const dialog=useRef<HTMLDialogElement>(null),frame=useRef<HTMLIFrameElement>(null),[html,H]=useState(''),[name,N]=useState(''),[busy,B]=useState(false),[error,E]=useState('');
 const prepare=async()=>{B(true);E('');H('');dialog.current?.showModal();useStore.getState().cancelInteraction();const project=structuredClone(useStore.getState().project);try{const {plan,scene}=await capture();H(presentationHTML(project,plan,scene,new Date().toLocaleString('zh-CN')));N(project.name)}catch(e){E((e as Error).message)}finally{B(false)}};
 return <><button disabled={busy} onClick={()=>void prepare()}>{busy?'生成中…':'客户成果'}</button><dialog ref={dialog} className="presentation-dialog" aria-label="客户布局成果" onCancel={e=>{if(busy)e.preventDefault()}}><header><b>客户布局成果 · 生成时快照</b><button disabled={busy||!html} onClick={()=>download(new Blob([html],{type:'text/html;charset=utf-8'}),name+'-布局成果.html')}>下载展示页</button><button disabled={busy||!html} onClick={()=>frame.current?.contentWindow?.print()}>打印 / PDF</button><button disabled={busy} onClick={()=>dialog.current?.close()}>关闭成果</button></header>{busy?<p role="status">正在生成平面、三维及清单…</p>:error?<p role="alert">{error}</p>:<iframe ref={frame} title="客户方案预览" sandbox="allow-same-origin allow-modals" srcDoc={html}/>}</dialog></>;
}
