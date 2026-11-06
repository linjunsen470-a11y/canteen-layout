import { ComponentRef, RefObject, useEffect } from 'react';
import { OrbitControls } from '@react-three/drei';
import { MOUSE } from 'three';
import { isTextInput } from './editorInteraction';

export type ScenePanMode='off'|'ready'|'dragging';

/** Temporary camera input only: no project, selection or undo state changes. */
export function useSceneSpacePan(canvas:HTMLCanvasElement, controls:RefObject<ComponentRef<typeof OrbitControls>|null>, active:boolean, blocked:boolean, pan:RefObject<boolean>, onChange:(mode:ScenePanMode)=>void) {
  useEffect(()=>{
    const control=controls.current;
    if(!active||blocked||!control)return;
    const shell=canvas.closest('.scene-shell'),left=control.mouseButtons.LEFT;
    let held=false,pending=false,pointer:number|null=null,down=false,damping:boolean|undefined;
    const restoreDamping=()=>{if(damping!==undefined){control.enableDamping=damping;damping=undefined}};
    const publish=()=>{pan.current=held||pointer!==null;onChange(pointer!==null?'dragging':held?'ready':'off')};
    const reset=()=>{
      held=false;pending=false;
      // End our captured OrbitControls gesture on blur/hide, not just its key flag.
      if(pointer!==null){
        canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:pointer,pointerType:'mouse',bubbles:true}));
        const damping=control.enableDamping;control.enableDamping=false;control.update();control.enableDamping=damping;
      }
      restoreDamping();pointer=null;down=false;control.mouseButtons.LEFT=left;publish();
    };
    const keyDown=(e:KeyboardEvent)=>{
      if(e.code!=='Space'||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||isTextInput(e.target)||document.querySelector('dialog[open],.workbench-popover:popover-open'))return;
      if(e.target instanceof HTMLElement&&e.target.closest('button,summary,a,[role=separator]')){
        // A toolbar may retain focus after a mouse click. Arm only the next canvas
        // drag; a normal Space activation of that button remains untouched.
        pending=canvas.matches(':hover')&&!down;return;
      }
      if(!canvas.matches(':hover')&&document.activeElement!==shell&&document.activeElement!==canvas)return;
      if(held){e.preventDefault();return}
      if(e.repeat||down)return; // Do not convert an existing object/orbit gesture midway.
      e.preventDefault();held=true;control.mouseButtons.LEFT=MOUSE.PAN;publish();
    };
    const keyUp=(e:KeyboardEvent)=>{if(e.code==='Space'){held=false;pending=false;control.mouseButtons.LEFT=left;publish()}};
    const start=(e:PointerEvent)=>{down=true;if((held||pending)&&e.button===0){
      held=true;pending=false;
      // OrbitControls swaps rotate/pan when a modifier is held; Space still means pan.
      control.mouseButtons.LEFT=e.ctrlKey||e.metaKey||e.shiftKey?MOUSE.ROTATE:MOUSE.PAN;
      // CAD-style panning follows the pointer and stops when it stops. Restore
      // ordinary orbit damping afterward, without leaving a residual pan offset.
      damping=control.enableDamping;control.enableDamping=false;control.update();
      pointer=e.pointerId;publish();
    }};
    const end=(e:PointerEvent)=>{if(pointer===e.pointerId){pointer=null;restoreDamping()}down=false;publish()};
    const focus=(e:FocusEvent)=>{if(e.target!==shell&&e.target!==canvas)reset()};
    const visibility=()=>{if(document.hidden)reset()};
    window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);
    window.addEventListener('blur',reset);document.addEventListener('visibilitychange',visibility);
    document.addEventListener('focusin',focus);
    canvas.addEventListener('pointerdown',start,true);window.addEventListener('pointerup',end);
    canvas.addEventListener('pointercancel',end);
    return()=>{
      reset();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);
      window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',visibility);
      document.removeEventListener('focusin',focus);canvas.removeEventListener('pointerdown',start,true);
      window.removeEventListener('pointerup',end);canvas.removeEventListener('pointercancel',end);
    };
  },[canvas,controls,active,blocked,pan,onChange]);
}
