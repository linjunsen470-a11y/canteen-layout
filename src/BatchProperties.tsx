import { modelOf } from './model';
import { useState } from 'react';
import { useStore } from './store';
import { bounds } from './spatial';
import { isEditable } from './editorInteraction';
import { isAttachedOpening, duplicateItems } from './structure';
import { planningEditable } from './planning';
import { movableSelection } from './layoutGroups';
import { layoutAction, rotateSelected, groupSelected, ungroupSelected } from './layoutCommands';
import { checkSpace } from './spaceChecks';
import { NumberField } from './NumberField';
import DoorControls from './DoorControls';
import MergeWallsPanel from './MergeWallsPanel';

export default function BatchProperties() {
  const s = useStore(), { project, selectedIds } = s;
  const items = project.items.filter(i => selectedIds.includes(i.id));
  const group = project.groups?.find(g => g.members.length === items.length && g.members.every(id => selectedIds.includes(id)));
  const box = bounds(items);
  const [gap, setGap] = useState(project.clearance ?? 900);
  const editable = items.every(i => isEditable(i, project));
  const detached = items.some(i => isAttachedOpening(i) && !selectedIds.includes(i.wallId!));
  const canTransform = editable && !detached && !items.some(i => i.measure);
  const hasLocked = items.some(i => i.locked);
  const sameEquipment = items.every(i => i.kind === items[0].kind && modelOf(i) === modelOf(items[0]))
    && ['table', 'chair', 'stove', 'counter', 'fridge', 'sink', 'shelf'].includes(items[0].kind);
  const translate = (dx: number, dy: number) => layoutAction(() => {
    s.updateMany(movableSelection(project, selectedIds).map(i => ({ id: i.id, patch: { x: i.x + dx, y: i.y + dy } })));
  });
  const copyBeside = (right: boolean) => layoutAction(() => {
    const ids = movableSelection(project, selectedIds).map(i => i.id);
    const copy = duplicateItems(project, ids, right ? box.w + gap : 0, right ? 0 : box.h + gap);
    const added = new Set(copy.ids);
    if (copy.project.items.some(i => added.has(i.id) && !planningEditable(i, copy.project))) throw Error('该位置超出当前规划范围');
    const conflict = checkSpace(copy.project, null).find(v => v.type !== '参考净距' && v.ids.some(id => added.has(id)));
    if (conflict) throw Error('无法在此处复制：' + conflict.message);
    if (s.commit(copy.project)) s.selectMany(copy.ids);
  });
  return <div className="batch-props">
    <div className="batch-summary"><strong>{group?.name ?? '多项选择'}</strong>
      <small>占地 {Math.round(box.w)} × {Math.round(box.h)} mm{group?.seats !== undefined && ` · ${group.seats} 座`}</small></div>
    {!canTransform && <p role="status">{!editable ? '有成员已锁定、隐藏或受规划范围保护。' : detached ? '请同时选择贴墙门窗所属的墙，再整体移动。' : '关联尺寸标注随物件移动，请从选择中移除标注。'}</p>}
    <fieldset disabled={!canTransform || !!s.placement}><legend>整体定位</legend>
      <label>左边缘 X（mm）<NumberField value={box.x} onCommit={n => translate(n-box.x, 0)} /></label>
      <label>上边缘 Y（mm）<NumberField value={box.y} onCommit={n => translate(0, n-box.y)} /></label>
      <button onClick={() => layoutAction(() => rotateSelected(-90))}>左转 90°</button>
      <button onClick={() => layoutAction(() => rotateSelected(90))}>右转 90°</button>
    </fieldset>
    <fieldset disabled={!canTransform || !!s.placement}><legend>相邻复制</legend>
      <label className="full-field">边缘间距（mm）<NumberField value={gap} min={0} onCommit={setGap} /></label>
      <button onClick={() => copyBeside(true)}>向右复制</button><button onClick={() => copyBeside(false)}>向下复制</button>
    </fieldset>
    <fieldset disabled={!!s.placement}>
      <button disabled={!editable} onClick={() => layoutAction(group ? ungroupSelected : groupSelected)}>{group ? '解散组合' : '编为一组'}</button>
      <button onClick={() => s.setFlags(selectedIds, { locked: !hasLocked })}>{hasLocked ? '解锁所选' : '锁定所选'}</button>
    </fieldset>
    {sameEquipment && <details><summary>同款设备尺寸</summary>
      <fieldset disabled={!editable || !!s.placement}>
        {(['w', 'd', 'h'] as const).map(key => <label key={key}>{{ w: '长度', d: '宽度', h: '高度' }[key]}（mm）
          <NumberField value={items.every(i => i[key] === items[0][key]) ? items[0][key] : undefined}
            placeholder="多个值" min={key === 'h' ? 0 : 1}
            onCommit={n => s.updateMany(items.map(i => ({ id: i.id, patch: { [key]: n } })))} />
        </label>)}
      </fieldset></details>}
    <MergeWallsPanel />
    {items.every(i => i.kind === 'door') && <DoorControls items={items.filter(i => isEditable(i, project))} />}
  </div>;
}
