import { memo } from 'react';
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

export default memo(function EditorToolbar({grid,snap,onGrid,onSnap}: {grid:boolean;snap:boolean;onGrid:()=>void;onSnap:()=>void}) {
  const project=useStore(s=>s.gesture??s.project),ids=useStore(s=>s.selectedIds),activeMode=useStore(s=>s.mode),activeTool=useStore(s=>s.tool),hasPlacement=useStore(s=>!!s.placement);
  const prefs=useWorkspace(),session=useWallPlacement(v=>v.session),clipboard=useEditorClipboard();
  const items=project.items.filter(i=>ids.includes(i.id)),locked=items.length>0&&items.every(i=>i.locked);
  const tool=(value:EditorTool)=>useStore.getState().setTool(value);
  return <div className="drawing-toolbar">
    <div className="mode-tabs" aria-label="编辑模式">{(['layout','structure','site'] as const).map(mode=><button key={mode} aria-pressed={activeMode===mode} onClick={()=>{useStore.getState().setMode(mode);if(mode==='site')prefs.set({propsOpen:true})}}>{modeLabels[mode]}</button>)}</div>
    <nav className="drawing-actions" aria-label="编辑操作" inert={!!session}>
      {activeMode==='structure'&&<><button aria-pressed={activeTool==='wall'} onClick={()=>tool('wall')}>画墙</button><button aria-pressed={activeTool==='partition'} onClick={()=>tool('partition')}>隔断</button></>}
      {activeMode==='layout'&&<ToolMenu label="分区与标注"><div className="menu-action-list" onClick={e=>{if((e.target as HTMLElement).closest('button'))closeToolMenu(e.currentTarget)}}>
        <button onClick={()=>tool('zone')}>区域</button><button onClick={()=>tool('zone-draw')}>多边形分区</button>
        <button onClick={()=>tool('text')}>文字标注</button><button onClick={()=>tool('dimension')}>尺寸标注</button><button onClick={()=>tool('leader')}>引线标注</button>
      </div></ToolMenu>}
      {activeMode==='site'&&<><button aria-pressed={activeTool==='outline-edit'} onClick={()=>tool('outline-edit')}>调整轮廓</button><button aria-pressed={activeTool==='outline-draw'} onClick={()=>tool('outline-draw')}>绘制轮廓</button></>}
      {ids.length>0&&<ToolMenu label={`选中操作 · ${ids.length}`}><div className="menu-action-list" onClick={e=>{if((e.target as HTMLElement).closest('button:not(:disabled)'))closeToolMenu(e.currentTarget)}}>
        <button aria-label="复制" disabled={hasPlacement} onClick={()=>layoutAction(copySelection)}><Copy/>复制 <kbd>Ctrl C</kbd></button>
        <button aria-label="副本" disabled={hasPlacement} onClick={()=>useStore.getState().duplicate(ids)}>副本 <kbd>Ctrl D</kbd></button>
        <button disabled={hasPlacement} onClick={()=>useStore.getState().setFlags(ids,{locked:!locked})}>{locked?<LockOpen/>:<LockKeyhole/>}{ids.length>1?(locked?'全部解锁':'全部锁定'):(locked?'解锁':'锁定')}</button>
        {ids.length>1&&<button onClick={()=>layoutAction(()=>{const s=useStore.getState();s.updateMany(alignChanges(s.project,ids))})}>左对齐</button>}
        {ids.length>2&&<button onClick={()=>layoutAction(()=>{const s=useStore.getState();s.updateMany(alignChanges(s.project,ids,true))})}>水平等距</button>}
        {items.some(i=>i.kind==='door')&&<button disabled={hasPlacement} onClick={()=>layoutAction(()=>{const s=useStore.getState();s.updateMany(items.filter(i=>i.kind==='door'&&isEditable(i,s.project)).map(i=>({id:i.id,patch:{flipped:!i.flipped}})))})}>翻转门开向</button>}
        <button aria-label="删除" disabled={hasPlacement} onClick={()=>{const s=useStore.getState();s.removeMany(ids);s.selectMany([])}}><Trash2/>删除 <kbd>Delete</kbd></button>
      </div></ToolMenu>}
      {clipboard.clip&&<button disabled={hasPlacement} onClick={()=>layoutAction(pasteSelection)}>粘贴</button>}
      <LayoutTools/>
    </nav>
    <ToolMenu label="画布设置"><div className="canvas-options"><button aria-pressed={grid} onClick={onGrid}>网格</button><button aria-pressed={snap} onClick={onSnap}>吸附 · {prefs.snapSize}mm</button><GridSettings/></div></ToolMenu>
  </div>;
});
