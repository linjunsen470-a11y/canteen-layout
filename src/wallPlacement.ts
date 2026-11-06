import { useStore } from './store';
import { usePlanning } from './planning';
import { parseClearance, placeAtClearance, wallFaces, clearanceBlocked } from './wallClearance';
import { faceAtPoint, wallFaceChoices } from './wallFaceChoices';
import { Point } from './model';
import { useWallPlacement, cancelWallPlacement } from './wallPlacementState';
export { useWallPlacement, cancelWallPlacement } from './wallPlacementState';

export function startWallPlacement(itemId:string){
  const s=useStore.getState(),i=s.project.items.find(v=>v.id===itemId);
  if(!i)return;
  const reason=clearanceBlocked(s.project,i);if(reason){useWallPlacement.setState({error:reason});return}
  s.cancelInteraction();s.selectMany([itemId]);
  useWallPlacement.setState({session:{itemId,wallId:null,side:1,target:null,picking:true},error:null});
}
export function selectWallFace(wallId:string,side:1|-1){
  const s=useWallPlacement.getState().session;if(s)useWallPlacement.setState({session:{...s,wallId,side,target:null,picking:false},error:null});
}
export function startPickingWall(){const s=useWallPlacement.getState().session;if(s)useWallPlacement.setState({session:{...s,picking:true,target:null},error:null})}
export function pickWallAt(point:Point,tolerance:number,wallId?:string){
  try{const s=useWallPlacement.getState().session,p=useStore.getState().project,i=p.items.find(i=>i.id===s?.itemId);if(!s?.picking||!i)return;
    const choice=faceAtPoint(wallFaceChoices(p,i),point,tolerance,wallId);selectWallFace(choice.face.wallId,choice.face.side);
  }catch(e){useWallPlacement.setState({error:(e as Error).message})}
}
export function clearWallPreview(){const s=useWallPlacement.getState().session;if(s)useWallPlacement.setState({session:{...s,target:null},error:null})}
export function wallPlacementResult(){
  const session=useWallPlacement.getState().session,p=useStore.getState().project;
  if(!session)throw Error('请先开始离墙定位');
  const item=p.items.find(i=>i.id===session.itemId),face=wallFaces(p).find(f=>f.wallId===session.wallId&&f.side===session.side);
  if(!item||!face)throw Error('请明确选择参考墙面');
  return {item,face,next:session.target===null?null:placeAtClearance(p,item,face,session.target)};
}
export function previewWallPlacement(input:string){
  clearWallPreview();
  try {const target=parseClearance(input),s=useWallPlacement.getState().session;
    if(!s)throw Error('请先开始离墙定位');
    if(s.picking)throw Error('请先明确选用参考墙面');
    const {item,face}=wallPlacementResult();placeAtClearance(useStore.getState().project,item,face,target);
    useWallPlacement.setState({session:{...s,target},error:null});
  }catch(e){useWallPlacement.setState({error:(e as Error).message})}
}
export function confirmWallPlacement(){
  try{const {item,next}=wallPlacementResult();if(!next)throw Error('请先预览移动');
    // Validation above runs against the current project before releasing the edit guard.
    cancelWallPlacement();const s=useStore.getState();s.update(item.id,{x:next.x,y:next.y});
    if(useStore.getState().error)throw Error(useStore.getState().error!);cancelWallPlacement();
  }catch(e){useWallPlacement.setState({error:(e as Error).message})}
}
// A preview never modifies Project, history or autosave. Any intervening edit cancels it.
const unsubscribeStore=useStore.subscribe((s,previous)=>{
  if(!useWallPlacement.getState().session)return;
  const changed=s.project!==previous.project&&JSON.stringify({...s.project,updatedAt:''})!==JSON.stringify({...previous.project,updatedAt:''});
  if(changed||s.interactionEpoch!==previous.interactionEpoch||s.selectedIds.join()!==previous.selectedIds.join())cancelWallPlacement();
});
const unsubscribePlanning=usePlanning.subscribe(()=>cancelWallPlacement());
if(import.meta.hot)import.meta.hot.dispose(()=>{unsubscribeStore();unsubscribePlanning()});
