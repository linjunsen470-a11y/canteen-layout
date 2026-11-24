import ZoneSummary from './ZoneSummary';
import UnderlayFields from './UnderlayFields';
import PlanningFields from './PlanningFields';
import { useStore } from './store';
import { NumberField } from './NumberField';
import { planningArea, planningAreaLabel, siteArea, siteOutline, SitePoint } from './site';
import { FloorMaterial, LightingPreset, ProjectStyle, WallMaterial, resolveStyle } from './model';
import { buildPerimeterWalls } from './shopTemplates';
import { decorThemePresets } from './conceptPlanner';

export default function SiteFields({ onEdit }: { onEdit: (draw?: boolean) => void }) {
  const { project: p, commit, resize } = useStore();
  const style = resolveStyle(p);
  const update = (outline: SitePoint[] | undefined) => commit({ ...p, outline });
  const updateStyle = (patch: Partial<ProjectStyle>) => commit({ ...p, style: { ...style, ...patch } });
  const preset = () => update([{ x: 0, y: 0 }, { x: p.width, y: 0 }, { x: p.width, y: p.height * 0.5 }, { x: p.width * 0.6, y: p.height * 0.5 }, { x: p.width * 0.6, y: p.height }, { x: 0, y: p.height }]);
  const encloseWalls = () => {
    const walls = buildPerimeterWalls(p);
    if (walls.length) commit({ ...p, items: [...p.items, ...walls] });
  };

  return <>
    <details className="site-data" open>
      <summary>装修材质与 3D 效果氛围</summary>
      <div className="theme-chip-row" role="group" aria-label="一键装修风格主题">
        {decorThemePresets.map(t => {
          const active = style.floorMaterial === t.floorMaterial && style.wallMaterial === t.wallMaterial && style.lightingPreset === t.lightingPreset;
          return (
            <button
              key={t.id}
              type="button"
              className={`theme-chip ${active ? 'active' : ''}`}
              title={t.subtitle}
              onClick={() => updateStyle({ floorMaterial: t.floorMaterial, wallMaterial: t.wallMaterial, lightingPreset: t.lightingPreset })}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <label>地面材质
        <select aria-label="地面材质" value={style.floorMaterial} onChange={e => updateStyle({ floorMaterial: e.target.value as FloorMaterial })}>
          <option value="oak-wood">暖橡木地板（咖啡/主题餐馆）</option>
          <option value="terrazzo">商业浅水磨石（快餐/轻食）</option>
          <option value="warm-tile">暖灰仿古地砖（食堂/中餐）</option>
          <option value="concrete">微水泥工业风</option>
          <option value="checker">技术规划网格地面</option>
        </select>
      </label>
      <label>墙面材质
        <select aria-label="墙面材质" value={style.wallMaterial} onChange={e => updateStyle({ wallMaterial: e.target.value as WallMaterial })}>
          <option value="warm-cream">暖奶油艺术漆</option>
          <option value="plaster">干净白乳胶漆</option>
          <option value="wood-panel">原木护墙格栅</option>
          <option value="brick-white">白色文化砖</option>
          <option value="concrete">清水水泥质感</option>
        </select>
      </label>
      <label>3D 渲染灯光氛围
        <select aria-label="3D 渲染灯光氛围" value={style.lightingPreset} onChange={e => updateStyle({ lightingPreset: e.target.value as LightingPreset })}>
          <option value="warm-dining">暖光营业氛围（推荐）</option>
          <option value="daylight">白天自然采光</option>
          <option value="evening">晚间精致灯光</option>
          <option value="clay">干净白模汇报</option>
        </select>
      </label>
      <label>空间层高（mm）
        <NumberField value={style.ceilingHeight} min={2200} max={8000} onCommit={ceilingHeight => updateStyle({ ceilingHeight })} />
      </label>
      <label><input type="checkbox" checked={style.wallCutaway} onChange={e => updateStyle({ wallCutaway: e.target.checked })} />鸟瞰半高透视墙（便于查看室内）</label>
      <label><input type="checkbox" checked={style.showCeiling} onChange={e => updateStyle({ showCeiling: e.target.checked })} />人视点显示室内吊顶</label>
      <label><input type="checkbox" checked={style.showZoneTint3D} onChange={e => updateStyle({ showZoneTint3D: e.target.checked })} />3D 地面显示功能区色块</label>
      <label><input type="checkbox" checked={style.showLightsIn2D} onChange={e => updateStyle({ showLightsIn2D: e.target.checked })} />2D 平面显示灯具点位</label>
    </details>

    <label>场地形状<select aria-label="场地形状" value={p.outline ? 'polygon' : 'rectangle'} onChange={e => { if (e.target.value === 'rectangle') update(undefined); else { update(siteOutline(p)); onEdit(); } }}><option value="rectangle">长方形</option><option value="polygon">不规则轮廓</option></select></label>
    <div className="site-actions"><button onClick={() => { preset(); onEdit(); }}>L 形起步</button><button onClick={() => onEdit(true)}>自由绘制</button></div>
    <label>场地范围长度（mm）<NumberField value={p.width} min={1} onCommit={n => resize(n, p.height)} /></label>
    <label>场地范围宽度（mm）<NumberField value={p.height} min={1} onCommit={n => resize(p.width, n)} /></label>
    <p className="site-area">{p.survey ? '外轮廓面积' : '场地轮廓面积'} <b>{(siteArea(p) / 1e6).toFixed(2)} ㎡</b></p>
    {p.survey && <details className="site-data"><summary>{planningAreaLabel(p)} {(planningArea(p)/1e6).toFixed(2)} ㎡</summary>
      <p>建铺时记录的内墙净长 · 墙厚 {p.survey.thickness} mm</p>
      <ol>{p.survey.corners.map((v,i,points) => {
        const b = points[(i+1)%points.length], dx = b.x-v.x, dy = b.y-v.y;
        return <li key={i}>{dx ? (dx > 0 ? '右' : '左') : (dy > 0 ? '下' : '上')} · {Math.hypot(dx,dy)} mm</li>;
      })}</ol></details>}
    <button className="site-edit" onClick={encloseWalls} title="沿当前场地轮廓自动生成四周外围墙体">沿场地轮廓一键围合外墙</button>
    {p.outline && <>
      <button className="site-edit" onClick={() => onEdit()}>在画布编辑轮廓</button>
      <p>拖动顶点改变边界，点击边上的 + 增加顶点。此处修改整场地地面；局部经营区请使用独立规划范围。修改边界会保留现有设备。</p>
      <details className="site-points"><summary>精确坐标 · {p.outline.length} 个顶点</summary><div className="point-head"><span>点</span><span>X / mm</span><span>Y / mm</span><span /></div>{p.outline.map((v, index) => <div className="point-row" key={index}><span>{index + 1}</span><NumberField value={v.x} min={0} onCommit={x => update(p.outline!.map((q, i) => i === index ? { ...q, x } : q))} /><NumberField value={v.y} min={0} onCommit={y => update(p.outline!.map((q, i) => i === index ? { ...q, y } : q))} /><button aria-label={`删除顶点 ${index + 1}`} disabled={p.outline!.length <= 3} onClick={() => update(p.outline!.filter((_, i) => i !== index))}>×</button></div>)}</details>
    </>}
    <UnderlayFields /><PlanningFields /><ZoneSummary />
    <p className="hint">调整场地范围会同比例缩放轮廓；设备位置不变。可在上方切换木地板、水磨石或暖光营业氛围实时查看 3D 效果图。</p>
  </>;
}
