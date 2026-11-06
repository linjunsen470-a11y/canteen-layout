import { useWorkspace } from './workspace';
export default function GridSettings(){
 const {gridSize,snapSize,set}=useWorkspace();
 return <div className="grid-settings-content"><label>网格间距（mm）<select aria-label="网格间距（mm）" value={gridSize} onChange={e=>set({gridSize:Number(e.target.value)})}>{[100,250,500,1000,2000].map(n=><option key={n}>{n}</option>)}</select></label><label>吸附步长（mm）<select aria-label="吸附步长（mm）" value={snapSize} onChange={e=>set({snapSize:Number(e.target.value)})}>{[1,10,50,100,250,500,1000].map(n=><option key={n}>{n}</option>)}</select></label><details><summary>操作提示与快捷键</summary><p>点击选择，Shift 点击多选；拖动物体移动，拖动旋转柄调整朝向。</p><p>空格或中键拖动平移，滚轮缩放。Alt 拖动临时关闭吸附。</p><p>Ctrl / ⌘ + C 复制，V 粘贴，Z 撤销；F 专注画布，Esc 退出当前工具。</p></details></div>;
}
