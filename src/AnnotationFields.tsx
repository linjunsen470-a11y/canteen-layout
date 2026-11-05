import { Item } from './model';
import { useStore } from './store';
import { NumberField } from './NumberField';
export default function AnnotationFields({item:i}:{item:Item}){
 const update=useStore(s=>s.update);
 return <><label>标注文字<textarea aria-label="标注文字" value={i.name} onChange={e=>update(i.id,{name:e.target.value})}/></label><label>{i.kind==='dimension'?'测量长度（mm）':'标注长度（mm）'}<NumberField disabled={!!i.measure} value={i.measure?.distance??i.w} min={1} onCommit={w=>update(i.id,{w})}/></label><label>{i.kind==='text'?'文本框高度（mm）':'偏移高度（mm）'}<NumberField value={i.d} min={1} onCommit={d=>update(i.id,{d})}/></label><label>文字高度（mm）<NumberField value={i.fontSize??180} min={20} onCommit={fontSize=>update(i.id,{fontSize})}/></label>{!i.measure&&(['x','y'] as const).map(k=><label key={k}>{{x:'X 坐标（mm）',y:'Y 坐标（mm）',rotation:'旋转角度'}[k]}<NumberField value={i[k]} onCommit={v=>update(i.id,{[k]:v})}/></label>)}<label>标注颜色<input type="color" value={i.color} onChange={e=>update(i.id,{color:e.target.value})}/></label><p>{i.measure?'自动测量两对象旋转后边界的最短净距；移动对象会更新，重叠时为 0。可调整偏移与文字，删除端点对象会移除此标注。':'尺寸为毫米世界坐标，随缩放显示；手绘尺寸记录绘制时的长度，不会随设备移动更新。'}</p></>;
}
