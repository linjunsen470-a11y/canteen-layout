import { Project } from './model';
import { footprint, isSurface, polygonDistance } from './spatial';
export function validateLayout(p:Project){
 const capacity=(n:unknown)=>n===undefined||typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=1000;
 if(p.clearance!==undefined&&(!Number.isFinite(p.clearance)||p.clearance<0||p.clearance>10000))throw Error('参考净距需为 0–10000mm');
 const used=new Set<string>(),groupIds=new Set<string>();if(p.groups!==undefined&&!Array.isArray(p.groups))throw Error('组合数据无效');
 for(const g of p.groups??[]){if(!g||typeof g.id!=='string'||!g.id||groupIds.has(g.id)||typeof g.name!=='string'||!capacity(g.seats)||!Array.isArray(g.members)||g.members.length<2)throw Error('组合数据无效');groupIds.add(g.id);for(const id of g.members){if(used.has(id)||!p.items.some(i=>i.id===id))throw Error('组合成员缺失或重复');used.add(id)}}
 for(const i of p.items){if(!capacity(i.seats))throw Error('座位数需为 0–1000 的整数');if(i.supportId!==undefined&&(!p.items.some(v=>v.id===i.supportId&&v.id!==i.id&&isSurface(v))||isSurface(i)||['wall','column','zone','door','window','utility','partition','dimension','text','leader'].includes(i.kind)))throw Error('承托物必须为场景中的桌面、操作台或固定设施');if(i.measure){const a=p.items.find(v=>v.id===i.measure!.a),b=p.items.find(v=>v.id===i.measure!.b);if(i.kind!=='dimension'||!a||!b||a===b||[a,b].some(v=>['zone','dimension','text','leader','utility'].includes(v.kind)))throw Error('净距标注的关联对象无效')}}
}
export function syncMeasurements(p:Project){return {...p,items:p.items.map(i=>{if(!i.measure)return i;const a=p.items.find(v=>v.id===i.measure!.a)!,b=p.items.find(v=>v.id===i.measure!.b)!,m=polygonDistance(footprint(a),footprint(b)),w=Math.max(1,m.distance);return{...i,x:(m.a.x+m.b.x)/2-w/2,y:(m.a.y+m.b.y)/2-i.d/2,w,rotation:Math.atan2(m.b.y-m.a.y,m.b.x-m.a.x)*180/Math.PI,measure:{a:a.id,b:b.id,distance:m.distance}}})}}
export function pruneLayout(p:Project):Project{
 const originalIds=new Set(p.items.map(i=>i.id)),items=p.items.filter(i=>!i.measure||originalIds.has(i.measure.a)&&originalIds.has(i.measure.b)).map(i=>i.supportId&&!originalIds.has(i.supportId)?{...i,supportId:undefined}:i),ids=new Set(items.map(i=>i.id));
 return {...p,items,groups:p.groups?.map(g=>{const members=g.members.filter(id=>ids.has(id));return{...g,members,...(members.length!==g.members.length?{seats:undefined}:{})}}).filter(g=>g.members.length>1)};
}
