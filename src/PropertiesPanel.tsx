import EquipmentSpecification from './EquipmentSpecification';
import { useWallPlacement } from './wallPlacementState';
import WallClearanceFields from './WallClearanceFields';
import DoorControls from './DoorControls';
import LayoutItemFields from './LayoutItemFields';
import RotationFields from './RotationFields';
import SiteObjectFields from './SiteObjectFields';
import { isSiteObject } from './siteObjects';
import { polygonArea } from './site';
import { zoneCorners } from './zones';
import { PanelRightClose, LockOpen, Trash2 } from 'lucide-react';
import { useStore } from './store';
import { NumberField } from './NumberField';
import StructureFields from './StructureFields';
import SiteFields from './SiteFields';
import { isAnnotation } from './annotations';
import AnnotationFields from './AnnotationFields';
import ZoneFields from './ZoneFields';
import BatchProperties from './BatchProperties';
import { isBuilding } from './structure';
import { isEditable, isVisible } from './editorInteraction';
import { planningEditable, usePlanning } from './planning';
import { useWorkspace } from './workspace';
import { defaultElevation } from './spatial';

const COLOR_SWATCHES = [
  { label: '暖橡木', hex: '#c79a66' },
  { label: '深胡桃', hex: '#7c5638' },
  { label: '奶油白', hex: '#f0eae0' },
  { label: '复古绿', hex: '#4f6d60' },
  { label: '焦糖棕', hex: '#9b6b4a' },
  { label: '雅灰石', hex: '#8e989e' },
  { label: '磨砂黑', hex: '#2c3236' },
  { label: '暖黄铜', hex: '#d4a254' },
];

export default function PropertiesPanel({ onEditOutline, onSavedSpec }: { onEditOutline: (draw?: boolean) => void; onSavedSpec?: () => void }) {
  const wallSession = useWallPlacement(s => s.session);
  const s = useStore(), { project, selected, selectedIds: multi } = s, M = s.selectMany, item = project.items.find(i => i.id === selected), prefs = useWorkspace();
  usePlanning();
  const supportsElevation = !!item && (item.kind === 'lighting' || item.kind === 'decor' || item.model === 'wall-shelf');
  const currentElevation = item ? (item.elevation ?? defaultElevation(item)) : 0;

  return <aside className="props" hidden={!prefs.propsOpen || prefs.focusMode || (!multi.length && s.mode !== 'site')}>
    <div className="panel-heading">
      <div><h3>{multi.length > 1 ? `组合与多选 · ${multi.length} 项` : item ? '对象属性' : '铺位与风格设置'}</h3><p>{multi.length > 0 ? '尺寸单位：mm' : '材质 · 氛围 · 场地轮廓'}</p></div>
      <button aria-label="收起属性面板" onClick={() => prefs.set({ propsOpen: false })}><PanelRightClose /></button>
    </div>
    {s.error && <p className="property-error" role="alert">{s.error}</p>}
    {multi.length === 1 && item && <>
      {item.wallId && <p className="selection-note">所属墙体：{project.items.find(w => w.id === item.wallId)?.name}</p>}
      {!planningEditable(item, project) && <p className="selection-note">此对象在当前规划范围外，已保护。切回整场地或关闭范围外保护后可编辑。</p>}
      {!isVisible(item, project) && <p>对象或所属墙体已隐藏，请从对象列表显示后编辑。</p>}
      {item.locked && <button onClick={() => s.setFlags([item.id], { locked: false })}><LockOpen />解锁对象</button>}
      {item.wallId && project.items.find(w => w.id === item.wallId)?.locked && <button onClick={() => s.select(item.wallId!)}>所属墙体已锁定 · 选择墙体</button>}
    </>}
    {multi.length > 1 ? <BatchProperties /> : item ? (
      <fieldset key={item.id} disabled={!!s.placement || !isEditable(item, project)}>
        {!isAnnotation(item) && <label>名称<input disabled={!!wallSession} value={item.name} onChange={e => s.update(item.id, { name: e.target.value })} /></label>}
        {item.kind === 'door' && <DoorControls items={[item]} />}
        <WallClearanceFields item={item} />
        <fieldset className="object-detail-fields" disabled={!!wallSession}>
          {!item.measure && <RotationFields item={item} />}
          {isAnnotation(item) ? <AnnotationFields item={item} /> : isBuilding(item) ? <StructureFields item={item} /> : <>
            {item.kind !== 'zone' && <>
              <label>长度（mm）<NumberField value={item.w} min={1} onCommit={n => s.update(item.id, { w: n })} /></label>
              <label>宽度（mm）<NumberField value={item.d} min={1} onCommit={n => s.update(item.id, { d: n })} /></label>
              <label>高度（mm）<NumberField value={item.h} min={0} onCommit={n => s.update(item.id, { h: n })} /></label>
            </>}
            {supportsElevation && (
              <div className="full-field elevation-field">
                <label>安装离地高度（mm）
                  <NumberField value={currentElevation} min={0} max={15000} onCommit={elevation => s.update(item.id, { elevation })} />
                </label>
                <div className="quick-pills">
                  {[['贴地', 0], ['壁挂 1.5m', 1500], ['吊装 2.2m', 2200], ['吸顶 2.8m', 2800]].map(([label, val]) => (
                    <button key={String(label)} type="button" onClick={() => s.update(item.id, { elevation: Number(val) })}>{label}</button>
                  ))}
                </div>
              </div>
            )}
            {item.kind === 'zone' && <>
              <label>区域长度（mm）<NumberField value={item.w} min={1} onCommit={n => s.update(item.id, { w: Math.max(100, n) })} /></label>
              <label>区域宽度（mm）<NumberField value={item.d} min={1} onCommit={n => s.update(item.id, { d: Math.max(100, n) })} /></label>
              <p>区域面积：{(polygonArea(zoneCorners(item)) / 1e6).toFixed(2)} ㎡</p>
            </>}
            <label>X 坐标（mm）<NumberField value={item.x} onCommit={n => s.update(item.id, { x: n })} /></label>
            <label>Y 坐标（mm）<NumberField value={item.y} onCommit={n => s.update(item.id, { y: n })} /></label>
            <div className="full-field">
              <label>颜色与材质色调<input type="color" value={item.color} onChange={e => s.update(item.id, { color: e.target.value })} /></label>
              {item.kind !== 'zone' && (
                <div className="color-swatches" role="group" aria-label="快捷色板">
                  {COLOR_SWATCHES.map(sw => (
                    <button key={sw.hex} type="button" title={sw.label} aria-label={sw.label} style={{ background: sw.hex }} className={item.color.toLowerCase() === sw.hex ? 'is-active' : ''} onClick={() => s.update(item.id, { color: sw.hex })} />
                  ))}
                </div>
              )}
            </div>
          </>}
          <EquipmentSpecification item={item} onSaved={onSavedSpec} />
          <LayoutItemFields item={item} />
          {isSiteObject(item) && <SiteObjectFields item={item} />}
          {!isAnnotation(item) && <>
            <ZoneFields key={item.id} item={item} />
            {item.kind !== 'zone' && <p>外包占地：{(item.w * item.d / 1e6).toFixed(2)} ㎡</p>}
          </>}
          <button className="delete" onClick={() => { s.removeMany(multi.length ? multi : [item.id]); M([]); }}><Trash2 />删除选中对象</button>
        </fieldset>
      </fieldset>
    ) : <SiteFields onEdit={onEditOutline} />}
  </aside>;
}
