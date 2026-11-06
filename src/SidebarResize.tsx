import { useWorkspace } from './workspace';

export default function SidebarResize({side}:{side:'library'|'props'}) {
  const prefs=useWorkspace(),left=side==='library',key=left?'libraryWidth':'propsWidth';
  const value=prefs[key],min=left?200:220,max=left?400:420;
  const change=(n:number)=>prefs.set({[key]:Math.max(min,Math.min(max,n))});
  return <div className="sidebar-resize" role="separator" tabIndex={0} aria-label={left?'调整设备库宽度':'调整属性面板宽度'} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
    onDoubleClick={()=>change(left?256:280)}
    onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home'].includes(e.key)){e.preventDefault();e.stopPropagation();change(e.key==='Home'?(left?256:280):value+(e.key==='ArrowRight'?1:-1)*(left?1:-1)*20)}}}
    onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId)}}
    onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const host=e.currentTarget.parentElement!,r=host.getBoundingClientRect();change(left?e.clientX-r.left-8:r.right-e.clientX-8)}}
    onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}><span/></div>;
}
