import { planningEditable } from './planning';
import { Item, Project } from './model';
export type EditorMode='layout'|'structure'|'site';
export type EditorTool='select'|'pan'|'wall'|'partition'|'zone'|'outline-edit'|'outline-draw'|'text'|'dimension'|'leader'|'underlay-move'|'underlay-calibrate'|'planning-draw'|'planning-edit'|'zone-draw'|'zone-edit'|'place-copy';
export const modeLabels:Record<EditorMode,string>={layout:'设备布置',structure:'建筑构件',site:'场地轮廓'};
export const toolLabels:Record<EditorTool,string>={select:'选择',pan:'平移',wall:'画墙',partition:'画隔断',zone:'画区域','outline-edit':'调整轮廓','outline-draw':'绘制轮廓',text:'文字标注',dimension:'尺寸标注',leader:'引线标注','underlay-move':'移动底图','underlay-calibrate':'两点校准底图','planning-draw':'绘制规划范围','planning-edit':'调整规划范围','zone-draw':'绘制多边形分区','zone-edit':'调整分区边界','place-copy':'放置副本'};
export const isVisible=(i:Item,p:Project)=>!i.hidden&&(!i.wallId||!p.items.find(w=>w.id===i.wallId)?.hidden);
export const isEditable=(i:Item,p:Project)=>isVisible(i,p)&&planningEditable(i,p)&&(!i.wallId||planningEditable(p.items.find(w=>w.id===i.wallId)??i,p))&&!i.locked&&(!i.wallId||!p.items.find(w=>w.id===i.wallId)?.locked);
export const isTextInput=(target:EventTarget|null)=>target instanceof HTMLElement&&!!target.closest('input,textarea,select,[contenteditable]');
