import { useEffect, useState } from 'react';
import { ImageAsset, readAsset, writeAssets } from './projectLibrary';
import { Project, uid } from './model';
import { parseProject } from './projectIO';
const maxBytes=12*1024*1024;
export const blobDataURL=(blob:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('图片读取失败'));reader.readAsDataURL(blob)});
export async function inspectImage(blob:Blob){
 if(blob.size>maxBytes||blob.size<8)throw Error('底图需为不超过 12MB 的 PNG/JPEG');
 const bytes=new Uint8Array(await blob.slice(0,8).arrayBuffer()),mime=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':null;
 if(!mime)throw Error('只支持 PNG/JPEG 底图');
 const image=await createImageBitmap(blob).catch(()=>{throw Error('图片损坏或无法解码')});const {width,height}=image;image.close();
 if(width*height>32000000)throw Error('底图超过 3200 万像素，请先缩小图片');
 return {width,height,mime};
}
export async function importImage(file:File){const size=await inspectImage(file),asset:ImageAsset={id:uid(),name:file.name,blob:new Blob([file],{type:size.mime})};await writeAssets([asset]);return {...size,asset}}
export function useImageAsset(id?:string){
 const [state,set]=useState<{id?:string;url:string;error:string}>({url:'',error:''});
 useEffect(()=>{let live=true;if(id)readAsset(id).then(async asset=>{if(!asset)throw Error('底图资产缺失，请导入含图片的项目包，或重新导入底图');const url=await blobDataURL(asset.blob);if(live)set({id,url,error:''})}).catch(e=>{if(live)set({id,url:'',error:(e as Error).message})});return()=>{live=false}},[id]);
 return id===state.id?state:{url:'',error:''};
}
export async function projectPackage(p:Project){
 const assets=[];if(p.underlay){const asset=await readAsset(p.underlay.assetId);if(!asset)throw Error('底图缺失，不能导出完整项目包，请重新导入底图');assets.push({id:asset.id,name:asset.name,data:await blobDataURL(asset.blob)})}
 return {format:'canteen-layout-package',version:1,project:p,assets};
}
export async function readProjectFile(file:File):Promise<{project:Project;missingImage:boolean}>{
 if(file.size>20*1024*1024)throw Error('项目文件超过 20MB');
 const value=JSON.parse(await file.text());
 if(value.format!=='canteen-layout-package'){const project=parseProject(value);return {project,missingImage:!!project.underlay&&!(await readAsset(project.underlay.assetId))}}
 if(value.version!==1||!Array.isArray(value.assets))throw Error('项目包版本或资产清单无效');
 const project=parseProject(value.project),u=project.underlay;
 if(u){
  const entries=value.assets.filter((a:{id?:unknown})=>a?.id===u.assetId);if(entries.length!==1)throw Error('项目包缺少底图或底图 ID 重复');
  const entry=entries[0];if(typeof entry.data!=='string'||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(entry.data)||entry.data.length>maxBytes*1.4)throw Error('底图资产内容无效');
  const [header,data]=entry.data.split(','),bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:header.includes('png')?'image/png':'image/jpeg'}),size=await inspectImage(blob);
  if(size.width!==u.pixelWidth||size.height!==u.pixelHeight)throw Error('底图像素尺寸与方案引用不一致');
  const id=uid();await writeAssets([{id,name:u.name,blob}]);project.underlay={...u,assetId:id};
 }
 return {project,missingImage:false};
}
