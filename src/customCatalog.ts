import { create } from 'zustand';
import { catalog, CatalogEntry, Item, modelOf } from './model';
import { ordinaryEquipment, facingModels, operationFace } from './equipmentFacing';

export const customCatalogKey='canteen-custom-items';
// Catalog data is a default snapshot. No scene or project holds a live reference.
export function validateCatalogEntry(value:unknown,legacy=false):CatalogEntry {
  if(!value||typeof value!=='object')throw Error('库条目格式无效');
  const c=value as CatalogEntry;
  if(typeof c.name!=='string'||!c.name.trim()||(!legacy&&c.name.length>120))throw Error('名称需为 1–120 个字符');
  if(!catalog.some(t=>t.kind===c.kind&&(c.model===undefined||t.model===c.model)))throw Error('基础模型与类型不匹配');
  if(![c.w,c.d,c.h].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&(legacy||n<=100000)))throw Error('尺寸需大于 0 且不超过 100000mm');
  if(typeof c.color!=='string'||!/^#[0-9a-f]{6}$/i.test(c.color))throw Error('颜色格式无效');
  if(c.id!==undefined&&(typeof c.id!=='string'||!c.id.trim()||c.id.length>200))throw Error('库条目标识无效');
  if(c.specification!==undefined&&(typeof c.specification!=='string'||c.specification.length>500))throw Error('规格说明最多 500 个字符');
  if(c.notes!==undefined&&(typeof c.notes!=='string'||c.notes.length>2000))throw Error('备注最多 2000 个字符');
  if(c.seats!==undefined&&(!Number.isInteger(c.seats)||c.seats<0||c.seats>1000))throw Error('座位数需为 0–1000 的整数，未知请留空');
  const model=modelOf(c),face=c.operationFace??'none';
  if(!['positive-y','none'].includes(face)||(face==='positive-y'&&(!ordinaryEquipment(c)||!facingModels.has(model))))throw Error('此模型尚未定义操作面');
  return {id:c.id,model,kind:c.kind,name:c.name.trim(),w:c.w,d:c.d,h:c.h,color:c.color,group:'我的物件',seats:c.seats,specification:c.specification,notes:c.notes,...(ordinaryEquipment(c)?{operationFace:face}:{} )};
}
export function parseCustomCatalog(raw:string|null):CatalogEntry[]{
  if(raw===null)return [];
  const values:unknown=JSON.parse(raw);if(!Array.isArray(values))throw Error('自定义库必须为条目数组');
  const ids=new Set<string>();return values.map((value,index)=>{
    const c=validateCatalogEntry(value,true);c.id??=`custom-legacy-${index+1}`;
    if(ids.has(c.id)||catalog.some(t=>t.id===c.id))throw Error('库条目标识重复或占用内置标识');ids.add(c.id);return c;
  });
}
export function specificationFromItem(i:Item):CatalogEntry {
  // Explicit whitelist excludes position, rotation, locks, zones and all relationships.
  return validateCatalogEntry({model:modelOf(i),kind:i.kind,name:i.name,w:i.w,d:i.d,h:i.h,color:i.color,seats:i.seats,specification:i.specification,notes:i.notes,operationFace:ordinaryEquipment(i)?operationFace(i):undefined});
}
export function catalogItemDefaults(c:CatalogEntry):Pick<Item,'catalogId'|'specification'|'notes'|'model'|'kind'|'name'|'w'|'d'|'h'|'color'|'seats'|'operationFace'> {
  return {catalogId:c.id,specification:c.specification,notes:c.notes,model:modelOf(c),kind:c.kind,name:c.name,w:c.w,d:c.d,h:c.h,color:c.color,seats:c.seats,...(ordinaryEquipment(c)?{operationFace:c.operationFace??operationFace(c)}:{})};
}
type CatalogState={entries:CatalogEntry[];raw:string|null;error:string|null};
function readCatalog():CatalogState {
  let raw:string|null=null;try{raw=localStorage.getItem(customCatalogKey);return {entries:parseCustomCatalog(raw),raw,error:null}}
  catch(e){return {entries:[],raw,error:`自定义库读取失败，原数据未覆盖：${(e as Error).message}`}};
}
export const useCustomCatalog=create<CatalogState>(()=>readCatalog());
export function reloadCustomCatalog(){useCustomCatalog.setState(readCatalog())}
function persist(entries:CatalogEntry[]){
  const state=useCustomCatalog.getState();if(state.error)throw Error(state.error);
  if(localStorage.getItem(customCatalogKey)!==state.raw){reloadCustomCatalog();throw Error('设备库已在另一页面更新，请重新打开编辑器后保存')}
  const raw=JSON.stringify(entries);try{localStorage.setItem(customCatalogKey,raw)}catch{throw Error('设备库保存失败，请检查浏览器存储后重试；当前草稿仍保留')}
  useCustomCatalog.setState({entries,raw,error:null});
}
export function saveCustomEntry(entry:CatalogEntry,expected?:CatalogEntry){
  const state=useCustomCatalog.getState(),c=validateCatalogEntry(entry),existing=state.entries.find(v=>v.id===c.id);
  if(c.id&&(!existing||!expected||JSON.stringify(existing)!==JSON.stringify(expected)))throw Error('此规格已更新或删除，请重新打开编辑器');
  c.id??=crypto.randomUUID();persist(existing?state.entries.map(v=>v.id===c.id?c:v):[...state.entries,c]);
}
export function deleteCustomEntry(entry:CatalogEntry){
  const state=useCustomCatalog.getState();if(JSON.stringify(state.entries.find(c=>c.id===entry.id))!==JSON.stringify(entry))throw Error('此规格已更新，请重新确认删除');
  persist(state.entries.filter(c=>c.id!==entry.id));
}
const onStorage=(e:StorageEvent)=>{if(e.key===customCatalogKey||e.key===null)reloadCustomCatalog()};
window.addEventListener('storage',onStorage);
if(import.meta.hot)import.meta.hot.dispose(()=>window.removeEventListener('storage',onStorage));
