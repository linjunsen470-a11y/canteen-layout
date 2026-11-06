import { Item } from './model';
import { NumberField } from './NumberField';
import { useStore } from './store';
import { isAttachedOpening } from './structure';
import { normalizeRotation } from './rotation';
export default function RotationFields({item}:{item:Item}){
 const update=useStore(s=>s.update);
 const attached=isAttachedOpening(item);
 return <div className="rotation-fields"><label title="拖动旋转柄调整；Shift 吸附 15°，Esc 取消">{attached?'跟随墙体角度（°）':'旋转角度（°）'}<NumberField disabled={attached} value={normalizeRotation(item.rotation)} onCommit={rotation=>update(item.id,{rotation})}/></label>{attached&&<><p>方向跟随墙体，沿墙拖动可调整位置。</p><button onClick={()=>useStore.getState().select(item.wallId!)}>选择所属墙体</button></>}</div>;
}
