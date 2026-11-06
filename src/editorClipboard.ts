import { create } from 'zustand';
import { Item, Project, uid } from './model';
import { useStore } from './store';
import { movableSelection } from './layoutGroups';
import { isAttachedOpening, openingSlot, syncStructure } from './structure';
import { planningEditable } from './planning';
import { bounds } from './spatial';
import { isEditable } from './editorInteraction';

type Clip={projectId:string;items:Item[];groups:Project['groups']};
export const useEditorClipboard=create<{clip:Clip|null;message:string}>(()=>({clip:null,message:''}));
export function copySelection(){
 const s=useStore.getState(),ids=new Set(movableSelection(s.project,s.selectedIds).map(i=>i.id));
 for(const i of s.project.items)if(i.wallId&&ids.has(i.wallId))ids.add(i.id);
 if(!ids.size)throw Error('请先选择可复制的对象');
 const clip=structuredClone({projectId:s.project.id,items:s.project.items.filter(i=>ids.has(i.id)),groups:s.project.groups?.filter(g=>g.members.every(id=>ids.has(id)))});
 useEditorClipboard.setState({clip,message:`已复制 ${clip.items.length} 个对象，点击粘贴或按 Ctrl/⌘+V 放置`});
}
export function pasteSelection(){
 const clip=useEditorClipboard.getState().clip;if(!clip)throw Error('请先复制对象');
 const s=useStore.getState(),p=s.project,map=new Map(clip.items.map(i=>[i.id,uid()])),same=clip.projectId===p.id;
 const ref=(id:string|undefined)=>id?(map.get(id)??(same&&p.items.some(i=>i.id===id)?id:undefined)):undefined;
 const copies:Item[]=clip.items.map(i=>({...structuredClone(i),id:map.get(i.id)!,name:i.name+' 副本',locked:false,x:i.x+300,y:i.y+300,wallId:ref(i.wallId),zoneId:ref(i.zoneId),supportId:ref(i.supportId),measure:i.measure?{...i.measure,a:ref(i.measure.a)??'',b:ref(i.measure.b)??''}:undefined}));
 for(const copy of copies){
  if(copy.measure&&(!copy.measure.a||!copy.measure.b))throw Error('关联净距标注需连同被测对象一起复制');
  if(isAttachedOpening(copy)&&!copies.some(i=>i.id===copy.wallId)){
   const wall=p.items.find(i=>i.id===copy.wallId&&i.kind==='wall');
   if(!wall)throw Error('所属墙体不在当前项目，请连同墙体一起复制门窗');
   if(!isEditable(wall,p))throw Error('所属墙体不可编辑，请先解锁或调整规划范围');
   const offset=openingSlot(wall,copy,[...p.items,...copies.filter(i=>i!==copy)],(copy.offset??0)+copy.w+100);
   if(offset===undefined)throw Error('墙体没有足够空间粘贴门窗');copy.offset=offset;
  }
 }
 const project=syncStructure({...p,items:[...p.items,...copies],groups:[...(p.groups??[]),...(clip.groups??[]).map(g=>({...g,id:uid(),members:g.members.map(id=>map.get(id)!)}))]});
 const ids=copies.map(i=>i.id),origins=project.items.filter(i=>ids.includes(i.id)&&!(i.wallId&&ids.includes(i.wallId)));
 if(origins.some(i=>!planningEditable(i,project)))throw Error('粘贴位置超出规划范围，请切回整场地');
 const b=bounds(origins);
 useStore.setState({gesture:p,project,placement:{origins,previousSelection:s.selectedIds,anchor:{x:b.x+b.w/2,y:b.y+b.h/2}},tool:'place-copy',selectedIds:ids,selected:ids.at(-1)??null,error:null});
 useEditorClipboard.setState({message:'移动指针选择粘贴位置，点击落位；Esc 取消'});
}

useStore.subscribe((s,previous)=>{
 if(s.project!==previous.project||s.selectedIds!==previous.selectedIds||(!s.placement&&previous.placement))useEditorClipboard.setState({message:''});
});
