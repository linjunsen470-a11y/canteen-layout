import {create} from 'zustand'; import {Item,Project,initial,uid,catalog,Kind} from './model';
type State={project:Project;selected:string|null;tool:'select'|'zone';past:Project[];future:Project[];setProject:(p:Project)=>void;select:(id:string|null)=>void;add:(kind:Kind)=>void;update:(id:string,patch:Partial<Item>)=>void;remove:()=>void;undo:()=>void;redo:()=>void;resize:(w:number,h:number)=>void};
export const useStore=create<State>((set,get)=>({
project:initial,selected:null,tool:'select',past:[],future:[],
setProject:p=>set({project:p,selected:null,past:[],future:[]}),select:id=>set({selected:id}),
add:kind=>{const p=get().project;const def=catalog.find(x=>x.kind===kind)!;const item:Item={id:uid(),kind,name:def.name,x:Math.round(p.width*.4/100)*100,y:Math.round(p.height*.35/100)*100,w:def.w,d:def.d,h:def.h,rotation:0,color:def.color};set(s=>({past:[...s.past,s.project].slice(-60),future:[],project:{...s.project,items:[...s.project.items,item]},selected:item.id}));},
update:(id,patch)=>set(s=>({past:[...s.past,s.project].slice(-60),future:[],project:{...s.project,items:s.project.items.map(i=>i.id===id?{...i,...patch}:i)}})),
remove:()=>{const s=get();if(!s.selected)return;set({past:[...s.past,s.project].slice(-60),future:[],project:{...s.project,items:s.project.items.filter(i=>i.id!==s.selected)},selected:null})},
undo:()=>set(s=>s.past.length?{project:s.past[s.past.length-1],past:s.past.slice(0,-1),future:[s.project,...s.future]}:{}),
redo:()=>set(s=>s.future.length?{project:s.future[0],past:[...s.past,s.project],future:s.future.slice(1)}:{}),
resize:(width,height)=>set(s=>({past:[...s.past,s.project].slice(-60),future:[],project:{...s.project,width,height}}))
}));