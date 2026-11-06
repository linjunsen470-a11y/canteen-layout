import { useRef, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import { useStore } from './store';
import { copyProject } from './projectSession';
import { download } from './projectIO';
import { projectPackage, readProjectFile } from './imageAssets';
export default function ProjectFiles({notify}:{notify:(s:string)=>void}){
 const [busy,B]=useState(false),p=useStore(s=>s.project),input=useRef<HTMLInputElement>(null);
 const json=()=>{download(new Blob([JSON.stringify({...p,exportInfo:{assetsIncluded:false,note:'普通 JSON 不含底图图片；跨设备迁移请导出项目包。'}},null,2)],{type:'application/json'}),p.name+'.json');if(p.underlay)notify('JSON 不包含底图图片，跨设备请使用“项目包”')};
 const pack=async()=>{B(true);try{download(new Blob([JSON.stringify(await projectPackage(p))],{type:'application/json'}),p.name+'.canteen.json');notify('已导出含底图图片的项目包')}catch(e){notify((e as Error).message)}finally{B(false)}};
 const load=async(file?:File)=>{if(!file)return;B(true);useStore.getState().cancelInteraction();try{const {project,missingImage}=await readProjectFile(file);if(await copyProject(project.name,project))notify(missingImage?'几何已导入；底图缺失，请导入项目包或重新选择图片':'方案已导入为独立项目')}catch(e){notify('导入失败：'+(e as Error).message)}finally{B(false)}};
 return <><button onClick={json} title="几何 JSON 不包含底图图片"><Download/>JSON</button><button disabled={busy} onClick={()=>void pack()} title="含底图图片，可跨设备迁移"><Download/>项目包</button><button disabled={busy} onClick={()=>input.current?.click()}><FileUp/>导入</button><input ref={input} hidden disabled={busy} type="file" accept=".json" onChange={e=>{void load(e.target.files?.[0]);e.target.value=''}}/></>;
}
