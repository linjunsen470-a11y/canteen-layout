import { useState } from 'react';
import { catalog } from './model';
import CustomItemDialog from './CustomItemDialog';
type Entry=typeof catalog[number];
export default function CustomCatalogActions({entry,onSave,onDelete}:{entry:Entry;onSave:(c:Entry)=>void;onDelete:()=>void}){
  const [confirm,setConfirm]=useState(false);
  return <div className="custom-catalog-actions"><CustomItemDialog initial={entry} onAdd={onSave}/><CustomItemDialog initial={entry} copy onAdd={onSave}/>{confirm?<><span>只删除库条目？</span><button onClick={onDelete}>确认删除</button><button onClick={()=>setConfirm(false)}>取消</button></>:<button aria-label={`删除库物件 ${entry.name}`} onClick={()=>setConfirm(true)}>删除</button>}</div>;
}
