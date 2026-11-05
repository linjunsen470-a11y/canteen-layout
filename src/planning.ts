import { create } from 'zustand';
import { Item, Project } from './model';
import { polygonArea } from './site';
import { zoneArea, zoneCorners } from './zones';
export const usePlanning=create<{activeId:string|null;protect:boolean;dim:boolean;set:(p:Partial<{activeId:string|null;protect:boolean;dim:boolean}>)=>void}>(set=>({activeId:null,protect:true,dim:true,set}));
export function insidePlanning(i:Item,p:Project){
 const area=p.planningAreas?.find(a=>a.id===usePlanning.getState().activeId);if(!area)return true;
 const total=polygonArea(zoneCorners(i));return Math.abs(zoneArea({...p,outline:area.outline},i)-total)<Math.max(1,total*1e-8);
}
export function planningEditable(i:Item,p:Project){return !usePlanning.getState().protect||insidePlanning(i,p)}
