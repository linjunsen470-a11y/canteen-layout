import { Project } from './model';
import { isAnnotation } from './annotations';
import { isVisible } from './editorInteraction';
import { siteArea } from './site';
import { zoneArea, zoneStats } from './zones';
import { analyzeShop } from './shopAnalytics';

export const escapeHTML = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmtYuan = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString()}`;

export function presentationHTML(p: Project, plan: string, scene: string, date: string) {
  const e = escapeHTML;
  const items = p.items.filter(i => i.kind !== 'zone' && !isAnnotation(i) && isVisible(i, p));
  const zones = p.items.filter(i => i.kind === 'zone' && !i.hidden);
  const stats = zoneStats({ ...p, items: zones });
  const insights = analyzeShop(p);
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(p.name)} · 开店空间规划方案书</title><style>
 *{box-sizing:border-box}body{margin:0;background:#f0ede7;color:#27372f;font:15px/1.6 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1120px;margin:24px auto;padding:42px;background:white;border-radius:10px;box-shadow:0 10px 40px rgba(32,44,38,.08)}h1{font-size:28px;margin:0;letter-spacing:-.01em}h2{font-size:18px;border-bottom:1px solid #dfd9ce;padding-bottom:8px;margin-top:28px;color:#244b3c}.meta{color:#6b776e;margin:6px 0 0}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;padding:18px 0;border-bottom:1px solid #dfd9ce}.stat{background:#f7f5f0;padding:14px 16px;border-radius:8px;border:1px solid #e7e2d8}.stat small{display:block;color:#6c776f;font-size:12px}.stat strong{font-size:22px;display:block;margin-top:4px;color:#223a2f}.stat span{font-size:12px;color:#78847b}img{width:100%;height:auto;object-fit:contain;max-height:660px;border:1px solid #e6e2d8;border-radius:8px;background:#faf9f5}.legend{display:flex;gap:16px;flex-wrap:wrap;margin-top:10px}.legend span{padding-left:10px;border-left:8px solid}.note{font-size:13px;color:#667369}table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:10px 9px;text-align:left;border-bottom:1px solid #e2ddd3}th{background:#f5f2eb;color:#394c42}tr{break-inside:avoid}footer{margin-top:32px;border-top:1px solid #dfd9ce;padding-top:12px;font-size:12px;color:#6b776e}@media(max-width:650px){main{margin:0;padding:18px;border-radius:0}h1{font-size:22px}table{font-size:12px}th,td{padding:5px}}@media print{@page{size:A4 landscape;margin:12mm}body{background:white}main{padding:0;margin:0;max-width:none;box-shadow:none}.view{break-inside:avoid;break-after:page}body{font-size:11px;line-height:1.35}h1{font-size:20px}.stats{padding:8px 0;gap:10px}.stat{padding:8px 10px}.stat strong{font-size:16px}h2{font-size:14px;margin:8px 0;padding-bottom:4px}img{display:block;max-height:132mm}.view:first-of-type img{max-height:110mm}th,td{padding:5px}thead{display:table-header-group}}
 </style><main><header><h1>${e(p.name)}</h1><p class="meta">开店空间规划与 3D 效果图方案书 · ${e(date)}${p.metadata.site ? ' · ' + e(p.metadata.site) : ''}${p.metadata.purpose ? ' · ' + e(p.metadata.purpose) : ''}</p></header>
 <div class="stats">
  <div class="stat"><small>铺位实用面积</small><strong>${(siteArea(p) / 1e6).toFixed(2)} ㎡</strong><span>${e(p.width / 1000)}m × ${e(p.height / 1000)}m</span></div>
  <div class="stat"><small>规划客座总数</small><strong>${insights.seats} 座</strong><span>${insights.sqmPerSeat ? `约 ${insights.sqmPerSeat.toFixed(2)} ㎡/座 · ${e(insights.comfortLabel)}` : '待配置桌椅'}</span></div>
  <div class="stat"><small>餐厨面积配比</small><strong>${insights.diningRatioPct !== null ? `${insights.diningRatioPct}% : ${insights.kitchenRatioPct}%` : '未分区'}</strong><span>可见构件与设备 ${items.length} 件</span></div>
  <div class="stat"><small>设备软装参考预算</small><strong>${insights.budgetMax > 0 ? `${fmtYuan(insights.budgetMin)} ~ ${fmtYuan(insights.budgetMax)}` : '待布置'}</strong><span>不含土建硬装与报建费用</span></div>
 </div>
 <section class="view"><h2>一、2D 平面布局图</h2><img alt="完整场地平面图" src="${plan}"><div class="legend">${zones.map(z => `<span style="border-color:${e(z.color)}">${e(z.name)} · ${(zoneArea(p, z) / 1e6).toFixed(2)} ㎡</span>`).join('')}</div><p class="note">${e(insights.ratioAdvice)} 可见分区面积之和 ${(stats.sum / 1e6).toFixed(2)}㎡，去重覆盖 ${(stats.union / 1e6).toFixed(2)}㎡。尺寸单位为毫米。</p></section>
 <section class="view"><h2>二、3D 空间效果图</h2><img alt="当前三维效果图" src="${scene}"><p class="note">实时材质与商业灯光示意效果图，用于开店前布局评审、招商沟通与装修交底。</p></section>
 <section><h2>三、分类设备、灯具与软装参考清单</h2><table><thead><tr><th>分类</th><th>名称</th><th>长 × 宽 × 高</th><th>数量</th><th>参考小计区间</th></tr></thead><tbody>${insights.bom.map(r => `<tr><td>${e(r.category)}</td><td><b>${e(r.name)}</b></td><td>${e(r.spec)}</td><td>${r.count}</td><td>${r.unitPriceMax > 0 ? `${fmtYuan(r.unitPriceMin * r.count)} ~ ${fmtYuan(r.unitPriceMax * r.count)}` : '按现场实测'}</td></tr>`).join('')}</tbody></table></section>
 <footer>本方案书固定为生成时的布局快照，后续编辑不会改变此文件。清单与图片仅包含可见对象；参考预算为市场估算，实际以供应商报价及现场施工复尺为准。</footer></main></html>`;
}
