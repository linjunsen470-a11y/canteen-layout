import { Copy, Trash2, LockKeyhole, LockOpen } from 'lucide-react';
import ToolMenu, { closeToolMenu } from './ToolMenu';
import LayoutTools from './LayoutTools';
import GridSettings from './GridSettings';
import { useStore } from './store';
import { useWorkspace } from './workspace';
import { useWallPlacement } from './wallPlacementState';
import { copySelection, pasteSelection, useEditorClipboard } from './editorClipboard';
import { EditorTool, isEditable, modeLabels } from './editorInteraction';
import { layoutAction } from './layoutCommands';
import { alignChanges } from './layoutGroups';

export default function EditorToolbar({grid,snap,onGrid,onSnap}: {grid:boolean;snap:boolean;onGrid:()=>void;onSnap:()=>void}) {
  const s=useStore(),prefs=useWorkspace(),session=useWallPlacement(v=>v.session),clipboard=useEditorClipboard();
  const ids=s.selectedIds,items=s.project.items.filter(i=>ids.includes(i.id)),locked=items.length>0&&items.every(i=>i.locked);
  const tool=(value:EditorTool)=>s.setTool(value);
  return <div className="drawing-toolbar">
    <div className="mode-tabs" aria-label="编辑模式">{(['layout','structure','site'] as const).map(mode=><button key={mode} aria-pressed={s.mode===mode} onClick={()=>{s.setMode(mode);if(mode==='site')prefs.set({propsOpen:true})}}>{modeLabels[mode]}</button>)}</div>
    <nav className="drawing-actions" aria-label="编辑操作" inert={!!session}>
      {s.mode==='structure'&&<><button aria-pressed={s.tool==='wall'} onClick={()=>tool('wall')}>画墙</button><button aria-pressed={s.tool==='partition'} onClick={()=>tool('partition')}>隔断</button></>}
      {s.mode==='layout'&&<ToolMenu label="分区与标注"><div className="menu-action-list" onClick={e=>{if((e.target as HTMLElement).closest('button'))closeToolMenu(e.currentTarget)}}>
        <button onClick={()=>tool('zone')}>区域</button><button onClick={()=>tool('zone-draw')}>多边形分区</button>
        <button onClick={()=>tool('text')}>文字标注</button><button onClick={()=>tool('dimension')}>尺寸标注</button><button onClick={()=>tool('leader')}>引线标注</button>
      </div></ToolMenu>}
      {s.mode==='site'&&<><button aria-pressed={s.tool==='outline-edit'} onClick={()=>tool('outline-edit')}>调整轮廓</button><button aria-pressed={s.tool==='outline-draw'} onClick={()=>tool('outline-draw')}>绘制轮廓</button></>}
      {ids.length>0&&<ToolMenu label={`选中操作 · ${ids.length}`}><div className="menu-action-list" onClick={e=>{if((e.target as HTMLElement).closest('button:not(:disabled)'))closeToolMenu(e.currentTarget)}}>
        <button aria-label="复制" disabled={!!s.placement} onClick={()=>layoutAction(copySelection)}><Copy/>复制 <kbd>Ctrl C</kbd></button>
        <button aria-label="副本" disabled={!!s.placement} onClick={()=>s.duplicate(ids)}>副本 <kbd>Ctrl D</kbd></button>
        <button disabled={!!s.placement} onClick={()=>s.setFlags(ids,{locked:!locked})}>{locked?<LockOpen/>:<LockKeyhole/>}{ids.length>1?(locked?'全部解锁':'全部锁定'):(locked?'解锁':'锁定')}</button>
        {ids.length>1&&<button onClick={()=>layoutAction(()=>s.updateMany(alignChanges(s.project,ids)))}>左对齐</button>}
        {ids.length>2&&<button onClick={()=>layoutAction(()=>s.updateMany(alignChanges(s.project,ids,true)))}>水平等距</button>}
        {items.some(i=>i.kind==='door')&&<button disabled={!!s.placement} onClick={()=>layoutAction(()=>s.updateMany(items.filter(i=>i.kind==='door'&&isEditable(i,s.project)).map(i=>({id:i.id,patch:{flipped:!i.flipped}}))))}>翻转门开向</button>}
        <button aria-label="删除" disabled={!!s.placement} onClick={()=>{s.removeMany(ids);s.selectMany([])}}><Trash2/>删除 <kbd>Delete</kbd></button>
      </div></ToolMenu>}
      {clipboard.clip&&<button disabled={!!s.placement} onClick={()=>layoutAction(pasteSelection)}>粘贴</button>}
      <LayoutTools/>
    </nav>
    <ToolMenu label="画布设置"><div className="canvas-options"><button aria-pressed={grid} onClick={onGrid}>网格</button><button aria-pressed={snap} onClick={onSnap}>吸附 · {prefs.snapSize}mm</button><GridSettings/></div></ToolMenu>
  </div>;
}
