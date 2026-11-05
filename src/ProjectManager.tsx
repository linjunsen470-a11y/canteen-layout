import { useEffect, useRef, useState } from 'react';
import { useStore } from './store';
import { copyProject, createProject, deleteProject, openProject, refreshProjects, saveProject, startProjectSession, useProjectSession } from './projectSession';

export default function ProjectLibrary(){
  const session=useProjectSession(),project=useStore(s=>s.project);
  const dialog=useRef<HTMLDialogElement>(null);
  const [name,setName]=useState(''),[trash,setTrash]=useState(false);
  useEffect(()=>{void startProjectSession()},[]);
  const status={unsaved:'未保存',saving:'保存中…',saved:'已保存',failed:'保存失败',conflict:'版本冲突'}[session.status];
  const show=()=>{dialog.current?.showModal();void refreshProjects().catch(()=>{})};
  return <>
    <button onClick={show} disabled={!session.ready}>项目库</button>
    <button className={`save-status ${session.status}`} onClick={show} title={session.message||'本地自动保存 · 点击管理项目'} aria-live="polite">{session.ready?status:'读取中…'}</button>
    <dialog ref={dialog} className="project-dialog" aria-labelledby="project-library-heading">
      <header><div><h2 id="project-library-heading">本地项目库</h2><p>工作草稿自动保存 · 命名副本独立编辑 · 恢复记录保留上一份成功保存</p></div><button onClick={()=>dialog.current?.close()} aria-label="关闭项目库">关闭</button></header>
      <p className={`storage-message ${session.status}`} role="status">{status}{session.message&&`：${session.message}`}<br/>仅存于当前浏览器，请定期导出 JSON 备份。</p>
      {(session.status==='failed'||session.status==='conflict')&&<div className="project-buttons"><button onClick={()=>void saveProject()} disabled={session.status==='conflict'||session.busy}>重试保存</button><button onClick={()=>void copyProject(`${project.name} · 恢存副本`)} disabled={session.busy}>将当前编辑另存副本</button><span>原记录保留；另存成功后可打开其他项目。也可关闭此窗口导出 JSON。</span></div>}
      <fieldset disabled={session.busy||!session.ready}>
        <section className="project-details"><h3>当前工作草稿</h3>
          <label>项目名称（重命名）<input value={project.name} onChange={e=>useStore.getState().commit({...project,name:e.target.value})}/></label>
          {([['customer','客户称呼'],['site','场地称呼'],['purpose','用途']] as const).map(([key,label])=><label key={key}>{label}<input value={project.metadata[key]} onChange={e=>useStore.getState().commit({...project,metadata:{...project.metadata,[key]:e.target.value}})}/></label>)}
          <label className="wide">需求备注<textarea rows={2} value={project.metadata.notes} onChange={e=>useStore.getState().commit({...project,metadata:{...project.metadata,notes:e.target.value}})}/></label>
          <small className="wide">创建：{new Date(project.createdAt).toLocaleString()} · 修改：{new Date(project.updatedAt).toLocaleString()}<br/>项目 ID：{project.id} · 文件版本：{project.schemaVersion}</small>
        </section>
        <div className="project-buttons"><input aria-label="新项目或副本名称" placeholder="新项目 / 命名副本名称" value={name} onChange={e=>setName(e.target.value)}/><button onClick={()=>void createProject(name)}>新建空白项目</button><button onClick={()=>void copyProject(name)}>保存命名副本</button><button onClick={()=>void createProject(name,true)}>打开示例</button></div>
        <div className="project-buttons"><h3>{trash?'回收站':'所有项目'}</h3><button onClick={()=>setTrash(v=>!v)}>{trash?'返回项目':'查看回收站'}</button></div>
        <div className="project-list">{session.rows.filter(r=>!!r.deletedAt===trash).map(row=><article key={row.id}>
          <div><b>{row.project.name||'未命名方案'} {row.id===project.id&&<em>当前</em>}</b><p>{[row.project.metadata.customer,row.project.metadata.site,row.project.metadata.purpose].filter(Boolean).join(' · ')||'未填写客户 / 场地资料'}</p><small>{new Date(row.project.updatedAt).toLocaleString()} · {row.project.items.length} 个对象 · 修订 {row.revision}</small></div>
          <div className="project-buttons">{trash?<button onClick={()=>void deleteProject(row,false)}>恢复项目</button>:<>
            <button disabled={row.id===project.id} onClick={()=>void openProject(row.id)}>打开 / 重命名</button>
            <button onClick={()=>void copyProject(name||`${row.project.name} · 副本`,row.id===project.id?undefined:row.project)}>复制</button>
            {row.recovery&&<button onClick={()=>void copyProject(`${row.project.name} · 恢复记录`,row.recovery)}>恢复上一份为新项目</button>}
            <button disabled={row.id===project.id} title={row.id===project.id?'请先打开其他项目':'移入回收站，可恢复'} onClick={()=>void deleteProject(row,true)}>删除</button>
          </>}</div>
        </article>)}{!session.rows.some(r=>!!r.deletedAt===trash)&&<p>这里还没有项目。</p>}</div>
      </fieldset>
    </dialog>
  </>;
}
