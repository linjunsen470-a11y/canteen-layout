import { useEffect } from 'react';
import { useStore } from './store';
import { useProjectSession } from './projectSession';
import { isTextInput } from './editorInteraction';
import { movableSelection } from './layoutGroups';

export function useEditorKeyboard(){
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.defaultPrevented||document.querySelector('dialog[open]')||isTextInput(e.target)||!useProjectSession.getState().ready)return;
      const s=useStore.getState();
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&!e.ctrlKey&&!e.metaKey&&s.tool==='select'&&!s.gesture&&!(e.target instanceof HTMLElement&&e.target.closest('button,summary,[role=separator]'))){
        e.preventDefault();const step=e.altKey?1:e.shiftKey?100:10,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
        try{s.updateMany(movableSelection(s.project,s.selectedIds).filter(i=>!i.measure).map(i=>({id:i.id,patch:{x:i.x+dx,y:i.y+dy}})))}catch(error){useStore.setState({error:(error as Error).message})}return;
      }
      if(e.key==='Escape'){e.preventDefault();const active=!!s.gesture||s.tool!=='select';s.cancelInteraction();if(!active)s.selectMany([]);return}
      if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){
        e.preventDefault();if(s.gesture){s.cancelInteraction();return}
        if(e.key.toLowerCase()==='y'||e.shiftKey)s.redo();else s.undo();return;
      }
      if(e.key==='Delete'||e.key==='Backspace'){
        if(s.tool!=='select'&&s.tool!=='pan')return;
        e.preventDefault();s.cancelInteraction();s.removeMany(s.selectedIds);
      }
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[]);
}
