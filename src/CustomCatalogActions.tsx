import { useState } from 'react';
import { CatalogEntry } from './model';
import CustomItemDialog from './CustomItemDialog';
import { deleteCustomEntry } from './customCatalog';
export default function CustomCatalogActions({entry}:{entry:CatalogEntry}){
  const [confirm,setConfirm]=useState(false),[error,E]=useState('');
  return <div className="custom-catalog-actions"><CustomItemDialog initial={entry}/><CustomItemDialog initial={entry} copy/>{confirm?<><span>仅删除库条目；场景实例保留。</span><button onClick={()=>{try{deleteCustomEntry(entry)}catch(e){E((e as Error).message)}}}>确认删除</button><button onClick={()=>{setConfirm(false);E('')}}>取消</button></>:<button aria-label={`删除库物件 ${entry.name}`} onClick={()=>setConfirm(true)}>删除</button>}{error&&<span role="alert">{error}</span>}</div>;
}
