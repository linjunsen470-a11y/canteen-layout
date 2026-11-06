import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export function closeToolMenu(target: HTMLElement) {
  target.closest<HTMLElement>('[popover]')?.hidePopover();
}

/** Native top-layer popovers avoid clipping in the canvas and narrow sidebars. */
export default function ToolMenu({label, children, wide=false, dismissOnAction=false}: {label:string; children:ReactNode; wide?:boolean; dismissOnAction?:boolean}) {
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false);
  const position=()=>{
    const rect=trigger.current?.getBoundingClientRect(),el=panel.current;
    if(!rect||!el)return;
    const width=Math.min(wide?580:300,window.innerWidth-24);
    el.style.width=`${width}px`;
    el.style.left=`${Math.max(12,Math.min(rect.left,window.innerWidth-width-12))}px`;
    el.style.top=`${rect.bottom+6}px`;
    el.style.maxHeight=`${Math.max(80,window.innerHeight-rect.bottom-18)}px`;
  };
  useEffect(()=>{
    if(!open)return;
    window.addEventListener('resize',position);
    return()=>window.removeEventListener('resize',position);
  },[open]);
  return <>
    <button ref={trigger} className="tool-menu-trigger" popoverTarget={id} aria-expanded={open} onClick={position}>{label}<ChevronDown/></button>
    <div ref={panel} id={id} popover="auto" className="workbench-popover" aria-label={label}
      onToggle={e=>setOpen(e.newState==='open')}
      onClick={e=>{const target=e.target as HTMLElement;if(dismissOnAction&&!target.closest('dialog')&&target.closest('button:not(:disabled),.btn'))panel.current?.hidePopover()}}
      onKeyDown={e=>{if(e.key==='Escape'&&!(e.target instanceof HTMLElement&&e.target.closest('dialog[open]'))){e.preventDefault();e.stopPropagation();panel.current?.hidePopover();trigger.current?.focus()}}}>
      {children}
    </div>
  </>;
}
