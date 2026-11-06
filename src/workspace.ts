import { create } from 'zustand';

type Preferences={focusMode:boolean;focusView:'2d'|'3d'|null;toolsOpen:boolean;libraryWidth:number;propsWidth:number;objectSnap:boolean;view:'2d'|'split'|'3d';libraryOpen:boolean;propsOpen:boolean;leftTab:'catalog'|'objects';ratio:number;axis:'auto'|'columns'|'rows';camera:'oblique'|'top';move3D:boolean;gridSize:number;snapSize:number};
const defaults:Preferences={focusMode:false,focusView:null,toolsOpen:true,libraryWidth:256,propsWidth:280,objectSnap:true,view:'2d',libraryOpen:true,propsOpen:true,leftTab:'catalog',ratio:58,axis:'auto',camera:'oblique',move3D:false,gridSize:1000,snapSize:100};
function read():Preferences{
  try{const p=JSON.parse(localStorage.getItem('canteen-workspace-v1')||'{}');return {
    focusMode:false,focusView:null,toolsOpen:p.toolsOpen!==false,
    libraryWidth:Number.isFinite(p.libraryWidth)?Math.max(200,Math.min(400,p.libraryWidth)):256,
    propsWidth:Number.isFinite(p.propsWidth)?Math.max(220,Math.min(420,p.propsWidth)):280,
    objectSnap:p.objectSnap!==false,
    view:['2d','split','3d'].includes(p.view)?p.view:defaults.view,
    libraryOpen:typeof p.libraryOpen==='boolean'?p.libraryOpen:true,propsOpen:typeof p.propsOpen==='boolean'?p.propsOpen:true,
    leftTab:p.leftTab==='objects'?'objects':'catalog',ratio:Number.isFinite(p.ratio)?Math.max(25,Math.min(75,p.ratio)):58,
    axis:['auto','columns','rows'].includes(p.axis)?p.axis:'auto',camera:p.camera==='top'?'top':'oblique',move3D:p.move3D===true,
    gridSize:[100,250,500,1000,2000].includes(p.gridSize)?p.gridSize:1000,snapSize:[1,10,50,100,250,500,1000].includes(p.snapSize)?p.snapSize:100,
  }}catch{return defaults}
}
export const useWorkspace=create<Preferences&{set:(patch:Partial<Preferences>)=>void}>((set)=>({...read(),set}));
let timer:ReturnType<typeof setTimeout>;
useWorkspace.subscribe(state=>{clearTimeout(timer);timer=setTimeout(()=>{try{localStorage.setItem('canteen-workspace-v1',JSON.stringify(state))}catch{/* Editing works without preference storage. */}},150)});
