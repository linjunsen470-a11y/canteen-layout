import { Project } from './model';
import { isAnnotation } from './annotations';
import { isVisible } from './editorInteraction';
import { siteArea } from './site';
import { zoneArea, zoneStats } from './zones';
import { analyzeShop } from './shopAnalytics';
import { checkSpace } from './spaceChecks';
import type { SceneGalleryShots } from './SceneCapture';

export const escapeHTML = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const fmtYuan = (n: number) => n >= 10000 ? `¥${(n / 10000).toFixed(1)}万` : `¥${n.toLocaleString()}`;

export function presentationHTML(
  p: Project,
  plan: string,
  scene: string,
  date: string,
  gallery?: SceneGalleryShots,
) {
  const e = escapeHTML;
  const items = p.items.filter(i => i.kind !== 'zone' && !isAnnotation(i) && isVisible(i, p));
  const zones = p.items.filter(i => i.kind === 'zone' && !i.hidden);
  const stats = zoneStats({ ...p, items: zones });
  const insights = analyzeShop(p);
  const criticalIssues = checkSpace(p, null).filter(i => i.type !== '参考净距');

  const renders = gallery
    ? [
      { title: '鸟瞰空间全景', subtitle: '整体动线、餐厨分区与空间比例一览', src: gallery.birdseye },
      { title: '进店第一眼人视点', subtitle: '1.6m 真实顾客站立高度，直视客区、灯光与明档吧台', src: gallery.interior },
      { title: '临街门头外观效果', subtitle: '发光品牌门头、落地玻璃橱窗与通道视觉吸引力', src: gallery.storefront },
    ]
    : [{ title: '3D 空间效果图', subtitle: '实时材质与商业灯光示意效果图', src: scene }];

  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(p.name)} · 开店空间规划方案书</title><style>
 *{box-sizing:border-box}
 body{margin:0;background:#ede9e1;color:#22312a;font:15px/1.65 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased}
 main{max-width:1160px;margin:28px auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 20px 56px rgba(24,38,31,.12);border:1px solid #dfd9ce}
 .hero-band{background:linear-gradient(135deg,#1b392e 0%,#264c3e 62%,#2f5948 100%);color:#fbf6ec;padding:38px 46px 34px;position:relative}
 .hero-kicker{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#dfbb7c;font-weight:700;margin-bottom:8px}
 .hero-band h1{font-size:32px;line-height:1.2;margin:0;letter-spacing:-.01em;font-weight:700}
 .hero-meta{margin:10px 0 0;color:rgba(251,246,236,.78);font-size:14px}
 .hero-rule{height:2px;width:64px;background:#d6aa63;margin-top:18px;border-radius:2px}
 .body-wrap{padding:32px 46px 42px}
 .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px;margin-bottom:24px}
 .stat{background:#f9f7f2;padding:15px 18px;border-radius:10px;border:1px solid #e7e1d6}
 .stat small{display:block;color:#6c786f;font-size:12px;font-weight:600}
 .stat strong{font-size:23px;display:block;margin-top:4px;color:#1d392e;letter-spacing:-.01em}
 .stat span{font-size:12px;color:#728076}
 .notes-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:16px;margin-bottom:28px}
 .note-card{background:#faf8f3;border:1px solid #e6e0d4;border-radius:10px;padding:16px 20px}
 .note-card h3{margin:0 0 8px;font-size:14px;color:#1f4335;letter-spacing:.02em}
 .note-card p{margin:0 0 6px;font-size:13.5px;color:#394a41}
 .note-card p:last-child{margin-bottom:0}
 .verdict-badge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#e4f2eb;color:#1d5a42;margin-bottom:8px}
 .verdict-badge.warn{background:#fdf0e1;color:#9d5314}
 h2{font-size:19px;margin:30px 0 14px;padding-bottom:8px;border-bottom:1px solid #e4ded3;color:#1e4134;display:flex;align-items:baseline;justify-content:space-between;gap:12px}
 h2 small{font-size:12.5px;font-weight:400;color:#738076}
 .figure-frame{background:#faf9f5;border:1px solid #e5dfd4;border-radius:12px;padding:12px;overflow:hidden}
 .figure-frame img{display:block;width:100%;height:auto;object-fit:contain;max-height:640px;border-radius:8px;background:#ffffff;cursor:zoom-in}
 .gallery-hero{margin-bottom:14px}
 .gallery-pair{display:grid;grid-template-columns:1fr 1fr;gap:14px}
 .render-card{background:#faf9f5;border:1px solid #e5dfd4;border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}
 .render-card img{display:block;width:100%;height:auto;border-radius:8px;cursor:zoom-in;background:#1c222a}
 .render-cap{padding:2px 4px}
 .render-cap b{display:block;font-size:14px;color:#22382e}
 .render-cap span{font-size:12.5px;color:#6d7a71}
 .legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px}
 .legend span{padding:3px 10px 3px 10px;border-left:5px solid;background:#f7f5ef;border-radius:4px;font-size:13px;color:#35463d}
 .note{font-size:13px;color:#68756b;margin-top:10px}
 .cat-row{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 16px}
 .cat-pill{background:#f7f4ee;border:1px solid #e4ded3;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#5d6c62}
 .cat-pill b{display:block;font-size:14px;color:#1f3f33;margin-top:2px}
 table{width:100%;border-collapse:collapse;font-size:13.5px}
 th,td{padding:10px 10px;text-align:left;border-bottom:1px solid #e7e2d8}
 th{background:#f6f3ec;color:#2e4238;font-weight:600}
 tr{break-inside:avoid}
 .readiness-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}
 .r-item{padding:10px 12px;border-radius:8px;border:1px solid #e4ded3;background:#faf8f3;font-size:12.5px}
 .r-item.ok{border-color:#cde2d6;background:#f3faf6}
 .r-item b{display:block;color:#1f3f32;margin-bottom:2px}
 .r-item span{color:#617066}
 footer{margin-top:34px;border-top:1px solid #e4ded3;padding-top:14px;font-size:12px;color:#6d7a71;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
 .lightbox{position:fixed;inset:0;background:rgba(15,24,20,.88);display:none;align-items:center;justify-content:center;padding:24px;z-index:99;cursor:zoom-out}
 .lightbox.open{display:flex}
 .lightbox img{max-width:96vw;max-height:92vh;border-radius:10px;box-shadow:0 24px 60px rgba(0,0,0,.5)}
 @media(max-width:760px){main{margin:0;border-radius:0}.hero-band{padding:24px 20px}.body-wrap{padding:20px}.notes-grid,.gallery-pair,.readiness-grid{grid-template-columns:1fr}table{font-size:12px}th,td{padding:6px}}
 @media print{@page{size:A4 landscape;margin:10mm}body{background:#fff}main{margin:0;max-width:none;border:none;box-shadow:none;border-radius:0}.hero-band{padding:18px 24px}.hero-band h1{font-size:22px}.body-wrap{padding:14px 24px}.view{break-inside:avoid;break-after:page}.stats{gap:8px;margin-bottom:12px}.stat{padding:8px 10px}.stat strong{font-size:16px}h2{font-size:15px;margin:12px 0 8px}.figure-frame img{max-height:118mm}.gallery-hero img{max-height:112mm}.gallery-pair img{max-height:86mm}.lightbox{display:none!important}}
 </style><main>
 <header class="hero-band">
  <div class="hero-kicker">SHOP PLANNING & 3D VISUALIZATION PROPOSAL</div>
  <h1>${e(p.name)}</h1>
  <p class="meta">开店空间规划与 3D 效果图方案书 · 生成于 ${e(date)}${p.metadata.site ? ' · ' + e(p.metadata.site) : ''}${p.metadata.purpose ? ' · ' + e(p.metadata.purpose) : ''}</p>
  <div class="hero-rule"></div>
 </header>
 <div class="body-wrap">
  <div class="stats">
   <div class="stat"><small>铺位实用面积</small><strong>${(siteArea(p) / 1e6).toFixed(2)} ㎡</strong><span>${e((p.width / 1000).toFixed(1))}m × ${e((p.height / 1000).toFixed(1))}m</span></div>
   <div class="stat"><small>规划客座总数</small><strong>${insights.seats} 座</strong><span>${insights.sqmPerSeat ? `约 ${insights.sqmPerSeat.toFixed(2)} ㎡/座 · ${e(insights.comfortLabel)}` : '待配置桌椅'}</span></div>
   <div class="stat"><small>餐厨面积配比</small><strong>${insights.diningRatioPct !== null ? `${insights.diningRatioPct}% : ${insights.kitchenRatioPct}%` : '未分区'}</strong><span>可见构件与设备 ${items.length} 件</span></div>
   <div class="stat"><small>预估商用配电</small><strong>${insights.estimatedPowerKw} kW</strong><span>${insights.estimatedPowerKw >= 10 ? '建议核实 380V 三相电' : '220V 商用电参考'}</span></div>
   <div class="stat"><small>设备软装参考预算</small><strong>${insights.budgetMax > 0 ? `${fmtYuan(insights.budgetMin)} ~ ${fmtYuan(insights.budgetMax)}` : '待布置'}</strong><span>不含土建硬装与报建费</span></div>
  </div>

  <div class="notes-grid">
   <div class="note-card">
    <h3>可行性诊断与工程提示</h3>
    <span class="verdict-badge ${criticalIssues.length > 0 ? 'warn' : ''}">${criticalIssues.length === 0 ? '空间零碰撞 · 动线通过校验' : `待复核 ${criticalIssues.length} 处空间冲突`}</span>
    <p>${e(insights.ratioAdvice)}</p>
    <p>${e(insights.powerAdvice)}</p>
    ${insights.actionTips.map(t => `<p>• ${e(t)}</p>`).join('')}
   </div>
   <div class="note-card">
    <h3>给合伙人 / 房东的方案备注</h3>
    <p>${e(p.metadata.notes || '本方案用于开店前布局评估、合伙人讨论及装修复尺参考，可根据现场上下水、排烟井与柱位继续微调。')}</p>
   </div>
  </div>

  <section class="view">
   <h2>一、2D 建筑平面布局图 <small>含实测尺寸标尺、主入口方向与功能分区面积（单位：mm）</small></h2>
   <div class="figure-frame"><img alt="完整场地平面图" src="${plan}"></div>
   <div class="legend">${zones.map(z => `<span style="border-color:${e(z.color)}">${e(z.name)} · ${(zoneArea(p, z) / 1e6).toFixed(2)} ㎡</span>`).join('')}</div>
   <p class="note">可见分区面积之和 ${(stats.sum / 1e6).toFixed(2)}㎡，去重覆盖 ${(stats.union / 1e6).toFixed(2)}㎡。点击任意图片可全屏放大审阅。</p>
  </section>

  <section class="view">
   <h2>二、多角度 3D 空间效果图 <small>鸟瞰整体 + 进店第一眼 + 临街门头形象</small></h2>
   <div class="render-card gallery-hero">
    <img alt="${e(renders[0].title)}" src="${renders[0].src}">
    <div class="render-cap"><b>${e(renders[0].title)}</b><span>${e(renders[0].subtitle)}</span></div>
   </div>
   ${renders.length > 1 ? `<div class="gallery-pair">${renders.slice(1).map(r => `<div class="render-card"><img alt="${e(r.title)}" src="${r.src}"><div class="render-cap"><b>${e(r.title)}</b><span>${e(r.subtitle)}</span></div></div>`).join('')}</div>` : ''}
  </section>

  <section>
   <h2>三、开店配套自检与分类预算清单 <small>可用于合伙人投资测算与供应商询价</small></h2>
   <div class="readiness-grid">${insights.readiness.map(r => `<div class="r-item ${r.ok ? 'ok' : ''}"><b>${r.ok ? '✓ ' : '△ '}${e(r.label)}</b><span>${e(r.detail)}</span></div>`).join('')}</div>
   ${insights.categoryBudgets.length ? `<div class="cat-row" style="margin-top:18px">${insights.categoryBudgets.map(cb => `<div class="cat-pill">${e(cb.category)}（${cb.count} 件）<b>${cb.max > 0 ? `${fmtYuan(cb.min)} ~ ${fmtYuan(cb.max)}` : '按现场计价'}</b></div>`).join('')}</div>` : ''}
   <table><thead><tr><th>分类</th><th>名称</th><th>长 × 宽 × 高</th><th>数量</th><th>参考小计区间</th></tr></thead><tbody>${insights.bom.map(r => `<tr><td>${e(r.category)}</td><td><b>${e(r.name)}</b></td><td>${e(r.spec)}</td><td>${r.count}</td><td>${r.unitPriceMax > 0 ? `${fmtYuan(r.unitPriceMin * r.count)} ~ ${fmtYuan(r.unitPriceMax * r.count)}` : '按现场实测'}</td></tr>`).join('')}</tbody></table>
  </section>

  <footer>
   <span>本方案书为生成时刻的独立离线快照，可直接微信发给合伙人/房东在手机或电脑浏览器打开。</span>
   <span>参考预算为商用餐饮市场常见估算区间，实际以供应商报价及施工复尺为准。</span>
  </footer>
 </div>
 </main>
 <div class="lightbox" id="lb"></div>
 <script>
  const lb=document.getElementById('lb');
  document.querySelectorAll('main img').forEach(img=>img.addEventListener('click',()=>{lb.innerHTML='';const big=document.createElement('img');big.alt=img.alt||'大图预览';big.src=img.src;lb.appendChild(big);lb.classList.add('open')}));
  lb.addEventListener('click',()=>{lb.classList.remove('open');lb.innerHTML=''});
 </script></html>`;
}
