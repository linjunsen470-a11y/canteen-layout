import ZoneSummary from './ZoneSummary';
import UnderlayFields from './UnderlayFields';
import PlanningFields from './PlanningFields';
import { useStore } from './store';
import { NumberField } from './NumberField';
import { siteArea, siteOutline, SitePoint } from './site';

export default function SiteFields({onEdit}:{onEdit:(draw?:boolean)=>void}) {
  const {project:p,commit,resize}=useStore();
  const update=(outline:SitePoint[]|undefined)=>commit({...p,outline});
  const preset=()=>update([{x:0,y:0},{x:p.width,y:0},{x:p.width,y:p.height*.5},{x:p.width*.6,y:p.height*.5},{x:p.width*.6,y:p.height},{x:0,y:p.height}]);
  return <>
    <label>场地形状<select aria-label="场地形状" value={p.outline?'polygon':'rectangle'} onChange={e=>{if(e.target.value==='rectangle')update(undefined);else{update(siteOutline(p));onEdit()}}}><option value="rectangle">长方形</option><option value="polygon">不规则轮廓</option></select></label>
    <div className="site-actions"><button onClick={()=>{preset();onEdit()}}>L 形起步</button><button onClick={()=>onEdit(true)}>自由绘制</button></div>
    <label>场地范围长度（mm）<NumberField value={p.width} min={1} onCommit={n=>resize(n,p.height)}/></label>
    <label>场地范围宽度（mm）<NumberField value={p.height} min={1} onCommit={n=>resize(p.width,n)}/></label>
    <p className="site-area">实际面积 <b>{(siteArea(p)/1e6).toFixed(2)} ㎡</b></p>
    {p.outline&&<><button className="site-edit" onClick={()=>onEdit()}>在画布编辑轮廓</button><p>拖动顶点改变边界，点击边上的 + 增加顶点。此处修改整场地地面；局部经营区请使用独立规划范围。修改边界会保留现有设备。</p>
      <details className="site-points"><summary>精确坐标 · {p.outline.length} 个顶点</summary><div className="point-head"><span>点</span><span>X / mm</span><span>Y / mm</span><span/></div>{p.outline.map((v,index)=><div className="point-row" key={index}><span>{index+1}</span><NumberField value={v.x} min={0} onCommit={x=>update(p.outline!.map((q,i)=>i===index?{...q,x}:q))}/><NumberField value={v.y} min={0} onCommit={y=>update(p.outline!.map((q,i)=>i===index?{...q,y}:q))}/><button aria-label={`删除顶点 ${index+1}`} disabled={p.outline!.length<=3} onClick={()=>update(p.outline!.filter((_,i)=>i!==index))}>×</button></div>)}</details>
    </>}
    <UnderlayFields/><PlanningFields/><ZoneSummary/>
    <p className="hint">地面使用 1m 低对比度交错色块。调整场地范围会同比例缩放轮廓；设备位置不变。</p>
  </>;
}
