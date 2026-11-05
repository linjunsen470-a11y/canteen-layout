import { useWorkspace } from './workspace';
export default function GridSettings(){
 const {gridSize,snapSize,set}=useWorkspace();
 return <details className="grid-settings"><summary>间距</summary><div><label>网格间距（mm）<select aria-label="网格间距（mm）" value={gridSize} onChange={e=>set({gridSize:Number(e.target.value)})}>{[100,250,500,1000,2000].map(n=><option key={n}>{n}</option>)}</select></label><label>吸附步长（mm）<select aria-label="吸附步长（mm）" value={snapSize} onChange={e=>set({snapSize:Number(e.target.value)})}>{[1,10,50,100,250,500,1000].map(n=><option key={n}>{n}</option>)}</select></label><small>网格与吸附独立设置。Alt 拖动临时关闭吸附。</small></div></details>;
}
