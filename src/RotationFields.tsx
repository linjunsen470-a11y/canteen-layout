import { Item } from './model';
import { NumberField } from './NumberField';
import { useStore } from './store';
import { isAttachedOpening } from './structure';
import { normalizeRotation } from './rotation';
export default function RotationFields({item}:{item:Item}){
 const update=useStore(s=>s.update);
 return <div className="rotation-fields"><label>旋转角度（°）<NumberField value={normalizeRotation(item.rotation)} onCommit={rotation=>update(item.id,{rotation})}/></label><p>拖动平面图上的旋转柄可自由转动 360°；按住 Shift 临时吸附 15°。也可直接输入任意角度。</p>{isAttachedOpening(item)&&<p>单独旋转门窗将转为独立放置，原墙开口恢复；可通过“所属墙体”重新贴墙。</p>}</div>;
}
