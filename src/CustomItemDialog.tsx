import { useId, useRef, useState } from 'react';
import { catalog } from './model';
import CatalogThumbnail from './CatalogThumbnail';
type Entry=typeof catalog[number];
const templates=catalog.filter(c=>!['wall','door','window','zone'].includes(c.kind));
export default function CustomItemDialog({onAdd,initial,copy=false}:{onAdd:(item:Entry)=>void;initial?:Entry;copy?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null),heading=useId();
  const [base,B]=useState<Entry>(templates.find(c=>c.model==='worktable')!);
  const [name,N]=useState(''),[w,W]=useState('1200'),[d,D]=useState('600'),[h,H]=useState('800'),[color,C]=useState('#a6aeb7');
  const edit=!!initial&&!copy;
  const open=()=>{const item=initial??templates.find(c=>c.model==='worktable')!;B(item);N(initial?item.name+(copy?' 副本':''):'自定义工作台');W(String(item.w));D(String(item.d));H(String(item.h));C(item.color);dialog.current?.showModal()};
  const valid=!!name.trim()&&[w,d,h].every(v=>Number.isFinite(Number(v))&&Number(v)>0);
  const item:Entry={...base,id:edit?initial.id:undefined,name:name.trim(),w:Number(w),d:Number(d),h:Number(h),color,group:'我的物件'};
  return <><button className={initial?'':'custom-add'} onClick={open} aria-label={initial?`${copy?'复制':'编辑'}库物件 ${initial.name}`:undefined}>{initial?(copy?'复制':'编辑'):'创建自定义物件'}</button><dialog ref={dialog} className="custom-dialog" aria-labelledby={heading}><form onSubmit={e=>{e.preventDefault();if(valid){onAdd(item);dialog.current?.close()}}}><h2 id={heading}>{edit?'编辑库物件':'创建自定义物件'}</h2><p>以通用示意模型为基础调整规格。库中的修改仅用于今后添加，已有场景物件保持原样。</p><label>基础模型<select aria-label="基础模型" value={templates.findIndex(c=>c.model===base.model&&c.kind===base.kind)} onChange={e=>{const c=templates[Number(e.target.value)];B(c);W(String(c.w));D(String(c.d));H(String(c.h));C(c.color)}}>{templates.map((c,i)=><option key={i} value={i}>{c.name}</option>)}</select></label><label>物件名称<input required value={name} onChange={e=>N(e.target.value)}/></label><div className="custom-dimensions">{([['长度（mm）',w,W],['宽度（mm）',d,D],['高度（mm）',h,H]] as const).map(([label,value,set])=><label key={label}>{label}<input type="number" min="1" required value={value} onChange={e=>set(e.target.value)}/></label>)}</div><label>物件颜色<input type="color" value={color} onChange={e=>C(e.target.value)}/></label>{valid&&<CatalogThumbnail item={item}/>}<div className="dialog-actions"><button type="button" onClick={()=>dialog.current?.close()}>取消</button><button className="primary" disabled={!valid}>{edit?'保存库物件':'加入我的物件'}</button></div></form></dialog></>;
}
