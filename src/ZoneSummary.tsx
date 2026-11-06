import { useMemo } from 'react';
import { useStore } from './store';
import { zoneStats } from './zones';
export default function ZoneSummary(){
 const p=useStore(s=>s.project),key=JSON.stringify([p.width,p.height,p.outline,p.items.filter(i=>i.kind==='zone')]);
 const stats=useMemo(()=>zoneStats(p),[key]);
 return <details className="site-data"><summary>功能分区统计</summary><p>各区面积之和：<b>{(stats.sum/1e6).toFixed(2)} ㎡</b><br/>去重覆盖面积：<b>{(stats.union/1e6).toFixed(2)} ㎡</b><br/>重叠覆盖面积：<b>{(stats.overlap/1e6).toFixed(2)} ㎡</b></p><p>统计全部功能分区（含隐藏项），仅计算场地内部分。重叠覆盖指被至少两个分区覆盖的面积，多重重叠只计一次；场地总面积独立计算。</p></details>;
}
