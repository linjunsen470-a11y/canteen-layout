import { create } from 'zustand';
import { blankProject, initial, Project, projectIdentity } from './model';
import { parseProject } from './projectIO';
import { useStore } from './store';
import { legacyMigrationId, listProjects, migrateLegacy, ProjectRecord, readProject, RevisionConflict, setDeleted, writeProject } from './projectLibrary';

type Session = {ready:boolean;status:'unsaved'|'saving'|'saved'|'failed'|'conflict';message:string;rows:ProjectRecord[];busy:boolean};
export const useProjectSession=create<Session>(()=>({ready:false,status:'unsaved',message:'正在打开本地项目库…',rows:[],busy:false}));
let revision=0,saved='',loading=false,timer:ReturnType<typeof setTimeout>|undefined,inflight:Promise<boolean>|undefined,started:Promise<void>|undefined;
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('canteen-layout-library'):undefined;
const signature=(p:Project)=>JSON.stringify(p);
const remember=(id:string)=>{try{sessionStorage.setItem('canteen-active-project',id);localStorage.setItem('canteen-last-project',id)}catch{/* Project data is stored in IndexedDB. */}};
const fail=(e:unknown)=>useProjectSession.setState({status:e instanceof RevisionConflict?'conflict':'failed',message:e instanceof Error?e.message:'本地存储不可用，请导出 JSON 备份'});
export async function refreshProjects(){const rows=await listProjects();useProjectSession.setState({rows:rows.sort((a,b)=>b.project.updatedAt.localeCompare(a.project.updatedAt))})}
function activate(project:Project,rev:number){
  loading=true;useStore.getState().setProject(project);loading=false;
  revision=rev;saved=rev?signature(useStore.getState().project):'';remember(project.id);
  useProjectSession.setState({status:rev?'saved':'unsaved',message:''});
}
export function startProjectSession(){
  if(started)return started;
  started=(async()=>{
    let warning='';
    try{
      let legacy:string|null=null;
      try{legacy=localStorage.getItem('canteen-layout-project')}catch{warning='旧存档入口不可读；项目库仍可使用。'}
      if(legacy && !(await legacyMigrationId())){
        let parsed:Project|undefined;
        try{parsed=parseProject(JSON.parse(legacy))}catch(e){warning=`旧存档未迁移，原文已保留：${(e as Error).message}`}
        if(parsed){await migrateLegacy(parsed);const id=await legacyMigrationId();if(!id||!(await readProject(id)))throw Error('旧项目迁移核对失败，原文仍保留')}
      }
      await refreshProjects();
      let last:string|null=null;
      try{last=sessionStorage.getItem('canteen-active-project')??localStorage.getItem('canteen-last-project')}catch{/* use latest */}
      const rows=useProjectSession.getState().rows.filter(r=>!r.deletedAt);
      const row=rows.find(r=>r.id===last)??rows[0];
      if(row)activate(parseProject(row.project),row.revision);
      else activate(blankProject(),0);
      useProjectSession.setState({ready:true,message:warning});
      if(!row)await saveProject();
      if(warning)useProjectSession.setState({message:warning});
    }catch(e){useProjectSession.setState({ready:true});fail(e)}
  })();
  return started;
}

export async function saveProject():Promise<boolean>{
  clearTimeout(timer);
  if(inflight){const ok=await inflight;return ok?saveProject():false}
  if(useStore.getState().gesture)return false;
  if(useProjectSession.getState().status==='conflict')return false;
  const project=useStore.getState().project;
  if(saved===signature(project)){useProjectSession.setState({status:'saved'});return true}
  useProjectSession.setState({status:'saving',message:''});
  inflight=(async()=>{
    try{
      const next={...project,updatedAt:new Date().toISOString()};
      const row=await writeProject(next,revision);
      revision=row.revision;
      // Do not reset selection/history or replace edits made while the transaction was running.
      loading=true;
      const current=useStore.getState().project;
      useStore.setState({project:{...current,updatedAt:next.updatedAt}});
      loading=false;saved=signature(next);
      const clean=saved===signature(useStore.getState().project);
      useProjectSession.setState({status:clean?'saved':'unsaved',message:''});
      channel?.postMessage(project.id);
      try{await refreshProjects()}catch{/* Successful transaction remains successful. */}
      if(!clean)schedule();
      return true;
    }catch(e){fail(e);return false}
  })();
  try{return await inflight}finally{inflight=undefined}
}
function schedule(){clearTimeout(timer);timer=setTimeout(()=>void saveProject(),450)}
const unsubscribe=useStore.subscribe((state,previous)=>{
  if(loading||!useProjectSession.getState().ready)return;
  if(state.project===previous.project&&state.gesture===previous.gesture)return;
  clearTimeout(timer);
  const status=useProjectSession.getState().status;
  if(status==='conflict'||status==='failed')return;
  useProjectSession.setState({status:signature(state.project)===saved?'saved':'unsaved'});
  if(!state.gesture)schedule();
});
channel?.addEventListener('message',async e=>{
  try{
    await refreshProjects();
    if(e.data===useStore.getState().project.id){
      const row=await readProject(e.data);
      if(row&&row.revision!==revision)fail(new RevisionConflict());
    }
  }catch{/* Actual saves still enforce revision checks. */}
});
const beforeUnload=(e:BeforeUnloadEvent)=>{
  if(useProjectSession.getState().ready&&(signature(useStore.getState().project)!==saved||!!useStore.getState().gesture)){
    void saveProject();e.preventDefault();e.returnValue='';
  }
};
const onVisibility=()=>{if(document.hidden&&useProjectSession.getState().ready)void saveProject()};
window.addEventListener('beforeunload',beforeUnload);
document.addEventListener('visibilitychange',onVisibility);
if(import.meta.hot)import.meta.hot.dispose(()=>{
  clearTimeout(timer);unsubscribe();channel?.close();
  window.removeEventListener('beforeunload',beforeUnload);
  document.removeEventListener('visibilitychange',onVisibility);
});

async function run(action:()=>Promise<void>){
  if(useProjectSession.getState().busy)return false;
  useProjectSession.setState({busy:true});
  try{await action();return true}catch(e){fail(e);return false}finally{useProjectSession.setState({busy:false})}
}
async function leaveCurrent(){
  if(useStore.getState().gesture)throw Error('请先完成或取消当前拖动');
  do {
    if(!(await saveProject()))throw Error(useProjectSession.getState().message||'当前修改尚未保存，请先重试或另存副本');
  } while(signature(useStore.getState().project)!==saved);
}
export const openProject=(id:string)=>run(async()=>{
  await leaveCurrent();
  const row=await readProject(id);if(!row||row.deletedAt)throw Error('项目已删除，请刷新项目列表');
  activate(parseProject(row.project),row.revision);
});
export const createProject=(name:string,example=false)=>run(async()=>{
  await leaveCurrent();
  const project=example?{...structuredClone(initial),...projectIdentity(),name:name||'食堂示例方案'}:blankProject(name||'未命名方案');
  const row=await writeProject(project,0);activate(row.project,row.revision);channel?.postMessage(row.id);await refreshProjects();
});
// Also works after a conflict or failed save: never discard the in-memory document until a new ID is durable.
export const copyProject=(name:string,source?:Project)=>run(async()=>{
  if(useStore.getState().gesture)throw Error('请先完成或取消当前拖动');
  clearTimeout(timer);if(inflight)await inflight;
  const current=source??useStore.getState().project;
  if(source)await leaveCurrent();
  const next={...structuredClone(current),...projectIdentity(),metadata:{...current.metadata},name:name||`${current.name} · 副本`};
  const row=await writeProject(next,0);activate(row.project,row.revision);channel?.postMessage(row.id);await refreshProjects();
});
export const deleteProject=(row:ProjectRecord,deleted:boolean)=>run(async()=>{
  if(row.id===useStore.getState().project.id)throw Error('请先打开其他项目，再删除此项目');
  await setDeleted(row.id,row.revision,deleted);channel?.postMessage(row.id);await refreshProjects();
});
