import { useWallPlacement, cancelWallPlacement } from './wallPlacement';
import { copySelection, pasteSelection } from './editorClipboard';
import { layoutAction, groupSelected, ungroupSelected } from './layoutCommands';
import { isEditable } from './editorInteraction';
import { useWorkspace } from './workspace';
import { useEffect } from 'react';
import { useStore } from './store';
import { useProjectSession } from './projectSession';
import { isTextInput } from './editorInteraction';
import { movableSelection } from './layoutGroups';

export function useEditorKeyboard(){
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.defaultPrevented||document.querySelector('dialog[open], .workbench-popover:popover-open')||isTextInput(e.target)||!useProjectSession.getState().ready)return;
      const s=useStore.getState();
      if(e.key==='Escape'&&useWallPlacement.getState().session){e.preventDefault();cancelWallPlacement();return}
      if(useWallPlacement.getState().session){
        if((e.ctrlKey||e.metaKey)&&['z','y'].includes(e.key.toLowerCase())){e.preventDefault();cancelWallPlacement();return}
        if(['Delete','Backspace','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||(e.ctrlKey||e.metaKey)&&['a','c','v','d','g'].includes(e.key.toLowerCase())){
          if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&e.target instanceof HTMLElement&&e.target.closest('button,summary,[role=separator]'))return;
          e.preventDefault();useWallPlacement.setState({error:'定位期间不修改原设备；请先确认落位或按 Esc 取消'});return;
        }
      }
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&['a','c','v','d','g'].includes(e.key.toLowerCase())){
        e.preventDefault();if(s.gesture)return;
        const key=e.key.toLowerCase();
        if(key==='a'){s.cancelInteraction();s.selectMany(s.project.items.filter(i=>isEditable(i,s.project)&&i.kind!=='zone').map(i=>i.id))}
        if(key==='c')layoutAction(copySelection);
        if(key==='v'){const p=useWorkspace.getState();if(p.view==='3d')p.set({view:'split'});layoutAction(pasteSelection)}
        if(key==='d')layoutAction(()=>s.duplicate(s.selectedIds));
        if(key==='g')layoutAction(e.shiftKey?ungroupSelected:groupSelected);
        return;
      }
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&!e.ctrlKey&&!e.metaKey&&s.tool==='select'&&!s.gesture&&!(e.target instanceof HTMLElement&&e.target.closest('button,summary,[role=separator]'))){
        e.preventDefault();const step=e.altKey?1:e.shiftKey?100:10,dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
        try{s.updateMany(movableSelection(s.project,s.selectedIds).filter(i=>!i.measure).map(i=>({id:i.id,patch:{x:i.x+dx,y:i.y+dy}})))}catch(error){useStore.setState({error:(error as Error).message})}return;
      }
      if(e.key.toLowerCase()==='f'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!s.gesture){e.preventDefault();s.cancelInteraction();const p=useWorkspace.getState();p.set({focusMode:!p.focusMode,focusView:null});return}
      if(e.key==='Escape'&&!s.gesture&&s.tool==='select'&&useWorkspace.getState().focusMode){e.preventDefault();useWorkspace.getState().set({focusMode:false});return}
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
