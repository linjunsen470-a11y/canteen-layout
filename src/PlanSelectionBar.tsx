import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Compass, Copy, DoorOpen, FlipHorizontal2, LayoutGrid, RotateCcw, RotateCw, Ruler, Sparkles, Sun, Trash2 } from 'lucide-react';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { useWallPlacement } from './wallPlacementState';
import { isEditable } from './editorInteraction';
import { layoutAction, rotateSelected } from './layoutCommands';
import { movableSelection } from './layoutGroups';
import { duplicateItems, isAttachedOpening, openingSlot } from './structure';
import { bounds } from './spatial';
import { checkSpace } from './spaceChecks';
import { planningEditable } from './planning';
import { catalog, Item, resolveStyle } from './model';
import { buildPerimeterWalls } from './shopTemplates';
import { decorThemePresets } from './conceptPlanner';
import { surveyWall } from './interiorSurvey';

export default function PlanSelectionBar({
  onOpenConcept,
  notify,
}: {
  onOpenConcept?: () => void;
  notify: (msg: string) => void;
}) {
  const s = useStore();
  const wallSession = useWallPlacement(v => v.session);
  const { project, selectedIds, tool, gesture, placement } = s;

  if (wallSession || gesture || placement || tool !== 'select') return null;

  const items = project.items.filter(i => selectedIds.includes(i.id));
  const hasFurniture = project.items.some(i =>
    ['table', 'chair', 'counter', 'stove', 'sink', 'fridge', 'shelf'].includes(i.kind)
  );

  const placeBoundedOpeningOnWall = (proj: typeof project, wall: Item, kind: 'door' | 'window') => {
    const datum = surveyWall(proj, wall);
    const slotBounds = datum ? { min: datum.minOffset, maxEnd: datum.maxEnd } : undefined;
    const spanMin = slotBounds?.min ?? 50;
    const spanEnd = slotBounds?.maxEnd ?? wall.w - 50;
    const usable = spanEnd - spanMin;
    const spec = kind === 'door'
      ? (catalog.find(c => c.model === 'glass-double-door') ?? catalog.find(c => c.kind === 'door')!)
      : (catalog.find(c => c.model === 'storefront-window') ?? catalog.find(c => c.kind === 'window')!);
    const minW = kind === 'door' ? 900 : 800;
    const w = Math.min(spec.w, Math.max(minW, Math.round(usable * (kind === 'door' ? 0.28 : 0.35))));
    const sill = kind === 'door' ? 0 : (spec.model === 'storefront-window' ? 150 : 900);
    const h = Math.min(spec.h, wall.h - sill - 200);
    if (h < 100) return null;
    const candidate: Item = {
      id: crypto.randomUUID(),
      kind,
      model: spec.model,
      name: spec.name,
      w,
      d: wall.d,
      h,
      x: 0,
      y: 0,
      rotation: wall.rotation,
      wallId: wall.id,
      offset: spanMin,
      sill,
      color: spec.color,
      ...(kind === 'door' ? { flipped: true } : {}),
    };
    const offset = openingSlot(wall, candidate, proj.items, Math.round(spanMin + (usable - w) / 2), slotBounds);
    if (offset === undefined) return null;
    return { ...candidate, offset };
  };

  // 1. Empty / bare shell fast-build starter pill (auto-disappears once furniture is placed)
  if (!items.length) {
    if (hasFurniture) return null;
    const hasDoor = project.items.some(i => i.kind === 'door');
    const quickAddStorefrontDoor = () => {
      try {
        let proj = useStore.getState().project;
        let walls = proj.items.filter(i => i.kind === 'wall' && !i.locked && !i.hidden);
        if (!walls.length) {
          const built = buildPerimeterWalls(proj);
          if (!built.length) { notify('请先使用「画墙」绘制外墙'); return; }
          proj = { ...proj, items: [...proj.items, ...built] };
          walls = built;
        }
        // Pick front-most horizontal wall (highest Y) or longest wall
        const frontWall = [...walls].sort((a, b) => {
          const ay = a.y + a.d / 2, by = b.y + b.d / 2;
          if (Math.abs(by - ay) > 400) return by - ay;
          return b.w - a.w;
        })[0];
        const placedDoor = placeBoundedOpeningOnWall(proj, frontWall, 'door');
        if (!placedDoor) { notify('当前外墙没有足够长度放置大门，请手动选墙添加'); return; }
        const nextItems = [...proj.items, placedDoor];
        if (useStore.getState().commit({ ...proj, items: nextItems })) {
          useStore.getState().selectMany([placedDoor.id]);
          notify('已在临街外墙放置双开玻璃门（可拖动微调位置或翻转开向）');
        }
      } catch (e) {
        notify((e as Error).message);
      }
    };

    const quickWarm3D = () => {
      const p = useStore.getState().project;
      const oak = decorThemePresets[0];
      useStore.getState().commit({
        ...p,
        style: { ...resolveStyle(p), floorMaterial: oak.floorMaterial, wallMaterial: oak.wallMaterial, lightingPreset: oak.lightingPreset },
      });
      useWorkspace.getState().set({ view: 'split', focusMode: false });
      notify('已切换为原木暖调 2D + 3D 分屏预览');
    };

    return (
      <div className="plan-quick-bar is-starter" data-ui="true" role="toolbar" aria-label="快速建铺步骤">
        <span className="quick-bar-tag">快速起步</span>
        {!hasDoor && <button type="button" onClick={quickAddStorefrontDoor}><DoorOpen />放临街大门</button>}
        {onOpenConcept && <button type="button" className="is-accent" onClick={onOpenConcept}><Sparkles />一键分区摆桌</button>}
        <button type="button" onClick={quickWarm3D}><Sun />暖调 3D 分屏</button>
      </div>
    );
  }

  // 2. Zone quick bar: 1-click 3D fly-to + edit vertices
  if (items.length === 1 && items[0].kind === 'zone') {
    const zone = items[0];
    const flyToZone = () => {
      const ws = useWorkspace.getState();
      if (ws.view === '2d') ws.set({ view: 'split', focusMode: false });
      s.locate(zone.id);
    };
    return (
      <div className="plan-quick-bar" data-ui="true" role="toolbar" aria-label="功能区快捷操作">
        <span className="quick-bar-name">{zone.name}</span>
        <button type="button" className="is-accent" onClick={flyToZone}><Compass />3D 飞入此区</button>
        {isEditable(zone, project) && (
          <button type="button" onClick={() => s.setTool('zone-edit')}><LayoutGrid />调整顶点</button>
        )}
        {isEditable(zone, project) && (
          <button type="button" className="is-danger" title="删除分区" onClick={() => { s.removeMany([zone.id]); s.selectMany([]); }}><Trash2 />删除</button>
        )}
      </div>
    );
  }

  // 3. Single-wall direct quick actions: add door / window / surveyed corner tools right on the canvas
  if (items.length === 1 && items[0].kind === 'wall' && isEditable(items[0], project)) {
    const wall = items[0];
    const datum = surveyWall(project, wall);
    const spanM = ((datum ? datum.end - datum.start : wall.w) / 1000).toFixed(2);
    const addOnWall = (kind: 'door' | 'window') => {
      try {
        const placed = placeBoundedOpeningOnWall(project, wall, kind);
        if (!placed) { notify(`「${wall.name}」剩余净长不足以放置${kind === 'door' ? '门' : '窗'}，可在右侧精确量距放置`); return; }
        if (s.commit({ ...project, items: [...project.items, placed] })) {
          s.selectMany([placed.id]);
          notify(`已在「${wall.name}」添加${placed.name}（拖动可沿墙微调）`);
        }
      } catch (e) {
        notify((e as Error).message);
      }
    };
    return (
      <div className="plan-quick-bar" data-ui="true" role="toolbar" aria-label="墙体快捷操作">
        <span className="quick-bar-name">{wall.name} · {spanM}m</span>
        <button type="button" onClick={() => addOnWall('door')}><DoorOpen />加门</button>
        <button type="button" onClick={() => addOnWall('window')}><LayoutGrid />加窗</button>
        <button type="button" onClick={() => useWorkspace.getState().set({ propsOpen: true, focusMode: false })}><Ruler />量距放柱/水电</button>
        <button type="button" className="is-danger" title="删除墙体" onClick={() => { s.removeMany([wall.id]); s.selectMany([]); }}><Trash2 />删除</button>
      </div>
    );
  }

  // 4. Contextual Figma-style selection quick actions for furniture / openings / groups
  if (items.some(i => i.kind === 'zone' || i.measure || !isEditable(i, project))) return null;
  if (items.length === 1 && items[0].kind === 'partition') return null;

  const hasDoor = items.some(i => i.kind === 'door');
  const attachedOnly = items.every(isAttachedOpening);
  const detached = items.some(i => isAttachedOpening(i) && !selectedIds.includes(i.wallId!));
  const canRotate = !attachedOnly && !detached;
  const canDirectionalCopy = items.length > 1 && !detached;
  const group = project.groups?.find(g => g.members.length === items.length && g.members.every(id => selectedIds.includes(id)));
  const label = group?.name ?? (items.length === 1 ? items[0].name : `${items.length} 项`);

  const copyDir = (dxSign: -1 | 0 | 1, dySign: -1 | 0 | 1) => layoutAction(() => {
    const box = bounds(items);
    const gap = project.clearance ?? 900;
    const ids = movableSelection(project, selectedIds).map(i => i.id);
    const copy = duplicateItems(project, ids, dxSign * (box.w + gap), dySign * (box.h + gap));
    const added = new Set(copy.ids);
    if (copy.project.items.some(i => added.has(i.id) && !planningEditable(i, copy.project))) throw Error('该位置超出当前规划范围');
    const conflict = checkSpace(copy.project, null).find(v => v.type !== '参考净距' && v.ids.some(id => added.has(id)));
    if (conflict) throw Error('无法在此处复制：' + conflict.message);
    if (s.commit(copy.project)) s.selectMany(copy.ids);
  });

  const flipDoors = () => layoutAction(() => {
    s.updateMany(items.filter(i => i.kind === 'door' && isEditable(i, project)).map(i => ({ id: i.id, patch: { flipped: !i.flipped } })));
  });

  return (
    <div className="plan-quick-bar" data-ui="true" role="toolbar" aria-label="选中快捷操作">
      <span className="quick-bar-name">{label}</span>
      {canRotate && <>
        <button type="button" title="左转 90°（Shift+R）" onClick={() => layoutAction(() => rotateSelected(-90))}><RotateCcw />左转</button>
        <button type="button" title="右转 90°（R）" onClick={() => layoutAction(() => rotateSelected(90))}><RotateCw />右转</button>
      </>}
      {hasDoor && <button type="button" title="翻转门扇开向" onClick={flipDoors}><FlipHorizontal2 />翻开向</button>}
      {canDirectionalCopy && (
        <span className="quick-bar-dir" role="group" aria-label="按通道净距复制">
          <button type="button" title="按净距向左复制" aria-label="快捷向左复制" onClick={() => copyDir(-1, 0)}><ArrowLeft /></button>
          <button type="button" title="按净距向右复制" aria-label="快捷向右复制" onClick={() => copyDir(1, 0)}><ArrowRight /></button>
          <button type="button" title="按净距向上复制" aria-label="快捷向上复制" onClick={() => copyDir(0, -1)}><ArrowUp /></button>
          <button type="button" title="按净距向下复制" aria-label="快捷向下复制" onClick={() => copyDir(0, 1)}><ArrowDown /></button>
        </span>
      )}
      {!attachedOnly && <button type="button" title="复制副本（Ctrl+D）" onClick={() => layoutAction(() => s.duplicate(selectedIds))}><Copy />副本</button>}
      <button type="button" className="is-danger" title="删除（Delete）" onClick={() => { s.removeMany(selectedIds); s.selectMany([]); }}><Trash2 />删除</button>
    </div>
  );
}
