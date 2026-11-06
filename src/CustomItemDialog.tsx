import { useId, useRef, useState } from 'react';
import { catalog, CatalogEntry } from './model';
import CatalogThumbnail from './CatalogThumbnail';
import EquipmentSymbol from './EquipmentSymbol';
import { facingModels, ordinaryEquipment, operationFace } from './equipmentFacing';
import { saveCustomEntry, validateCatalogEntry } from './customCatalog';

const templates=catalog.filter((c,index)=>!['wall','door','window','zone'].includes(c.kind)&&catalog.findIndex(t=>t.model===c.model&&t.kind===c.kind)===index);
export default function CustomItemDialog({initial,copy=false,label,onSaved}:{initial?:CatalogEntry;copy?:boolean;label?:string;onSaved?:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),heading=useId(),snapshot=useRef<CatalogEntry|undefined>(undefined);
  const [base,B]=useState<CatalogEntry>(templates.find(c=>c.model==='worktable')!);
  const [name,N]=useState(''),[w,W]=useState('1200'),[d,D]=useState('600'),[h,H]=useState('800'),[color,C]=useState('#a6aeb7');
  const [spec,S]=useState(''),[notes,T]=useState(''),[seats,Q]=useState(''),[face,F]=useState<'none'|'positive-y'>('none'),[error,E]=useState('');
  const edit=!!initial&&!copy;
  const open=()=>{const c=initial??templates.find(c=>c.model==='worktable')!;snapshot.current=initial?{...initial}:undefined;B(c);N(initial?c.name+(copy?' 副本':''):'自定义工作台');W(String(c.w));D(String(c.d));H(String(c.h));C(c.color);S(c.specification??'');T(c.notes??'');Q(c.seats===undefined?'':String(c.seats));F(initial?operationFace(c):'none');E('');dialog.current?.showModal()};
  let item:CatalogEntry|undefined,validation='';
  try{if([w,d,h].some(v=>!v.trim()))throw Error('请完整填写尺寸');item=validateCatalogEntry({model:base.model,kind:base.kind,id:edit?snapshot.current?.id:undefined,name,w:Number(w),d:Number(d),h:Number(h),color,group:'我的物件',specification:spec.trim()||undefined,notes:notes.trim()||undefined,seats:seats.trim()===''?undefined:Number(seats),operationFace:ordinaryEquipment(base)?face:undefined})}catch(e){validation=(e as Error).message}
  const size=item?Math.max(item.w,item.d)*1.2:1;
  return <><button type="button" className={initial?'catalog-spec-action':'custom-add'} onClick={open} aria-label={label??(initial?`${copy?'复制':'编辑'}库物件 ${initial.name}`:undefined)}>{label?.startsWith('另存规格 · ')?'另存规格':label??(initial?(copy?'复制':'编辑'):'创建自定义物件')}</button>
    <dialog ref={dialog} className="custom-dialog" aria-labelledby={heading}><form onSubmit={e=>{e.preventDefault();if(item)try{saveCustomEntry(item,edit?snapshot.current:undefined);dialog.current?.close();onSaved?.()}catch(e){E((e as Error).message)}}}>
      <h2 id={heading}>{edit?'编辑库物件':'创建自定义物件'}</h2><p>通用示意模型，不代表已核实产品。库的修改只用于今后添加；已有场景实例保持独立。库单独保存在当前浏览器。</p>
      <label>基础模型<select aria-label="基础模型" value={base.model} onChange={e=>{const c=templates.find(c=>c.model===e.target.value)!;B(c);W(String(c.w));D(String(c.d));H(String(c.h));C(c.color);Q(c.seats===undefined?'':String(c.seats));F('none')}}>{templates.map(c=><option key={c.model} value={c.model}>{c.name}</option>)}</select></label>
      <label>物件名称<input required maxLength={120} value={name} onChange={e=>N(e.target.value)}/></label>
      <div className="custom-dimensions">{([['长度（mm）',w,W],['宽度（mm）',d,D],['高度（mm）',h,H]] as const).map(([label,value,set])=><label key={label}>{label}<input type="number" min="0" max="100000" step="any" required value={value} onChange={e=>set(e.target.value)}/></label>)}</div>
      <label>规格说明<input maxLength={500} placeholder="选填；填写已知规格，不自动推算" value={spec} onChange={e=>S(e.target.value)}/></label>
      {ordinaryEquipment(base)&&<div className="spec-options"><label>声明座位数<input type="number" min="0" max="1000" step="1" placeholder="未知留空" value={seats} onChange={e=>Q(e.target.value)}/></label><label>操作面默认值<select aria-label="操作面默认值" value={face} onChange={e=>F(e.target.value as typeof face)}><option value="none">无明确操作面</option>{base.model&&facingModels.has(base.model)&&<option value="positive-y">已确认：模型正面</option>}</select></label></div>}
      <label>规格备注<textarea maxLength={2000} rows={2} value={notes} onChange={e=>T(e.target.value)}/></label>
      <label>物件颜色<input type="color" value={color} onChange={e=>C(e.target.value)}/></label>
      {item&&<div className="spec-previews"><CatalogThumbnail item={item}/>{ordinaryEquipment(item)&&<svg viewBox={`${-size/2} ${-size/2} ${size} ${size}`} role="img" aria-label="规格二维预览，初始角度为零"><rect x={-item.w/2} y={-item.d/2} width={item.w} height={item.d} fill={item.color}/><EquipmentSymbol item={{...item,id:'preview',x:0,y:0,rotation:0}} scale={100/size}/></svg>}</div>}
      <p>尺寸为外包示意尺寸，允许小数；座位未知时留空。另存规格不包含位置、角度、锁定、分区或承托关系。</p>
      {(error||validation)&&<p role="alert" className="property-error">{error||validation}</p>}
      <div className="dialog-actions"><button type="button" onClick={()=>dialog.current?.close()}>取消</button><button className="primary" disabled={!item}>{edit?'保存库物件':'加入我的物件'}</button></div>
    </form></dialog></>;
}
