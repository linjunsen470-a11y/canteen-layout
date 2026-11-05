import { Project } from './model';

export type ProjectRecord = { id:string; project:Project; revision:number; recovery?:Project; deletedAt?:string };
export class RevisionConflict extends Error {
  constructor() { super('此项目已在其他标签页修改或删除。当前编辑仍在内存中，请另存副本，或导出后打开最新记录。'); }
}
let connection:Promise<IDBDatabase>|undefined;
function database() {
  if (!connection) connection = new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('canteen-layout-library',1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      db.createObjectStore('projects',{keyPath:'id'});
      db.createObjectStore('meta');
      db.createObjectStore('assets',{keyPath:'id'});
    };
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();connection=undefined};resolve(request.result)};
    request.onerror=()=>{connection=undefined;reject(request.error)};
    request.onblocked=()=>{connection=undefined;reject(Error('项目库升级被其他标签页阻塞，请关闭旧标签页后重试'))};
  });
  return connection;
}
async function read<T>(store:string,key?:string):Promise<T> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,'readonly'),s=tx.objectStore(store),r=key===undefined?s.getAll():s.get(key);
    tx.oncomplete=()=>resolve(r.result);
    tx.onabort=()=>reject(tx.error??Error('读取项目库失败'));
    tx.onerror=()=>reject(tx.error??Error('读取项目库失败'));
  });
}
export const listProjects=()=>read<ProjectRecord[]>('projects');
export const readProject=(id:string)=>read<ProjectRecord|undefined>('projects',id);

// Read + expected revision check + backup + write share one transaction, including across tabs.
export async function writeProject(project:Project,expectedRevision:number):Promise<ProjectRecord> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');
    let failure:Error|undefined,result:ProjectRecord;
    store.get(project.id).onsuccess=e=>{
      const previous=(e.target as IDBRequest<ProjectRecord|undefined>).result;
      if ((previous?.revision??0)!==expectedRevision || previous?.deletedAt) {failure=new RevisionConflict();tx.abort();return}
      result={id:project.id,project,revision:expectedRevision+1,recovery:previous?.project};
      try { store.put(result); } catch(e) { failure=e as Error; try{tx.abort()}catch{/* already aborted */} }
    };
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(failure??tx.error??Error('写入失败，上一份成功记录仍保留'));
    tx.onerror=()=>{ /* onabort reports the failure after rollback */ };
  });
}
export async function setDeleted(id:string,revision:number,deleted:boolean) {
  const db=await database();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction('projects','readwrite'),store=tx.objectStore('projects');
    let failure:Error|undefined;
    store.get(id).onsuccess=e=>{
      const row=(e.target as IDBRequest<ProjectRecord|undefined>).result;
      if(!row||row.revision!==revision){failure=new RevisionConflict();tx.abort();return}
      store.put({...row,revision:revision+1,deletedAt:deleted?new Date().toISOString():undefined});
    };
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure??tx.error??Error('更新项目失败'));
  });
}
// The marker and imported project are atomic; keep the original localStorage value as an extra backup.
export async function migrateLegacy(project:Project) {
  const db=await database();
  return new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(['projects','meta'],'readwrite'),meta=tx.objectStore('meta');
    meta.get('legacyMigrated').onsuccess=e=>{
      if((e.target as IDBRequest).result)return;
      tx.objectStore('projects').add({id:project.id,project,revision:1});
      meta.put(project.id,'legacyMigrated');
    };
    tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('旧项目迁移失败，原始存档已保留'));
  });
}
export const legacyMigrationId=()=>read<string|undefined>('meta','legacyMigrated');

export type ImageAsset={id:string;name:string;blob:Blob};
export const readAsset=(id:string)=>read<ImageAsset|undefined>('assets',id);
// Immutable asset IDs keep project copies, undo and recovery records usable.
export async function writeAssets(assets:ImageAsset[]){
 const db=await database();
 return new Promise<void>((resolve,reject)=>{const tx=db.transaction('assets','readwrite');for(const asset of assets)tx.objectStore('assets').add(asset);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('图片保存失败，项目未更改'))});
}
