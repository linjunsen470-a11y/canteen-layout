import { useWallPlacement, cancelWallPlacement } from './wallPlacement';
import { useStore } from './store';
import { useWorkspace } from './workspace';

export default function WallPlacementBar(){
  const {session,error}=useWallPlacement(),p=useStore(s=>s.project),prefs=useWorkspace();if(!session)return null;
  const item=p.items.find(i=>i.id===session.itemId),wall=p.items.find(i=>i.id===session.wallId);
  return <div className="wall-placement-bar" role="status"><span><b>离墙定位 · {item?.name}</b><small>{error??(session.picking?'点击墙面或选择推荐 · 空格/中键平移':`${wall?.name} · ${session.side===1?'B':'A'} 面 · ${session.target===null?'输入净距后预览':`预览 ${session.target} mm，尚未保存`}`)}</small></span>{(!prefs.propsOpen||prefs.focusMode)&&<button onClick={()=>prefs.set({propsOpen:true,focusMode:false})}>调整净距</button>}<button onClick={cancelWallPlacement}>退出定位 · Esc</button></div>;
}
