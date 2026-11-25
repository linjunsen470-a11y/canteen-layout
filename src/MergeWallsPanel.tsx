import { useStore } from './store';
import { mergeWalls } from './mergeWalls';
export default function MergeWallsPanel(){
  const project=useStore(s=>s.gesture??s.project),selectedIds=useStore(s=>s.selectedIds),hasPlacement=useStore(s=>!!s.placement),hasGesture=useStore(s=>!!s.gesture);
  if(selectedIds.length<2||!selectedIds.every(id=>project.items.find(i=>i.id===id)?.kind==='wall'))return null;
  let result:ReturnType<typeof mergeWalls>|undefined,reason='';try{result=mergeWalls(project,selectedIds)}catch(e){reason=(e as Error).message}
  return <div className="merge-walls-panel"><b>合并共线墙</b><p>{result?`${result.count} 段 → ${Math.round(result.length)}mm，保留 ${result.openings} 个门窗；沿用首段名称，门向不变。一次撤销可恢复。`:reason}</p><button disabled={!result||hasPlacement||hasGesture} onClick={()=>{try{const current=useStore.getState(),r=mergeWalls(current.project,current.selectedIds);if(current.commit(r.project))current.selectMany([r.id])}catch(e){useStore.setState({error:(e as Error).message})}}}>合并选中墙体</button></div>;
}
