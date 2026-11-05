// Run this async function in a fresh, isolated browser context on the Vite development URL.
// Uses real IndexedDB and editor actions; never run against a user's project library.
export default async function runG1StorageChecks() {
  const session = await import('/src/projectSession.ts');
  const db = await import('/src/projectLibrary.ts');
  const { useStore } = await import('/src/store.ts');
  const { parseProject } = await import('/src/projectIO.ts');
  const { siteArea } = await import('/src/site.ts');
  const checks = [];
  const assert = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const state = () => useStore.getState();
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  await session.startProjectSession();
  assert(await session.createProject('客户 A'), '创建 A');
  const a = state().project.id;
  assert(state().project.items.length === 0, '新项目为空白');
  const item = state().addItem({kind:'table',name:'验收桌',x:1000,y:1200,w:1200,d:800,h:750,rotation:30,color:'#d9b98c'});
  state().commit({...state().project,metadata:{customer:'客户 A',site:'一号档口',purpose:'新铺布置',notes:'需保留通道'}});
  await session.saveProject();
  assert(await session.createProject('客户 B'), '创建 B');
  const b = state().project.id;
  assert(await session.createProject('客户 C'), '创建 C');
  const c = state().project.id;
  for (const id of [a,b,c,a]) assert(await session.openProject(id), '切换 '+id);
  assert(state().project.items[0].w===1200&&state().project.metadata.site==='一号档口', '尺寸和客户资料保留');
  assert(await session.copyProject('A · 方案副本'), '命名副本');
  const copy=state().project.id;
  state().update(item,{w:1800});await session.saveProject();
  assert((await db.readProject(a)).project.items[0].w===1200, '副本修改不影响原件');
  const before=await db.readProject(copy);
  state().beginMove();state().move(item,{x:3100});await pause(650);
  assert((await db.readProject(copy)).revision===before.revision, '拖动中不写盘');
  state().endMove();await pause(650);
  assert((await db.readProject(copy)).project.items[0].x===3100, '拖动结束自动保存');
  state().undo();await session.saveProject();
  assert(state().project.items[0].x===1000, '拖动撤销');
  state().redo();await session.saveProject();
  assert(state().project.items[0].x===3100, '拖动重做');
  state().beginMove();state().move(item,{x:5500});state().cancelMove();await session.saveProject();
  assert((await db.readProject(copy)).project.items[0].x===3100, '取消拖动保持成功记录');
  const stable=await db.readProject(copy),put=IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put=function(...args){ if(this.name==='projects'){this.transaction.abort();throw new DOMException('验收模拟空间不足','QuotaExceededError')}return put.apply(this,args); };
  try {
    state().update(item,{x:4200});
    assert(!(await session.saveProject()), '写入失败不返回成功');
    assert(session.useProjectSession.getState().status==='failed', '失败状态可见');
    assert(state().project.items[0].x===4200, '失败保留工作内存');
    assert((await db.readProject(copy)).revision===stable.revision, '失败保留上一份成功记录');
    assert(!(await session.openProject(b))&&state().project.id===copy, '失败阻止切换丢失修改');
  } finally { IDBObjectStore.prototype.put=put; }
  assert(await session.saveProject(), '重试保存成功');
  const recovered=await db.readProject(copy);
  assert(recovered.recovery.items[0].x===3100, '保留本地恢复副本');
  assert(await session.copyProject('从恢复记录找回',recovered.recovery), '恢复记录另存为新项目');
  assert(state().project.items[0].x===3100&&(await db.readProject(copy)).project.items[0].x===4200,'恢复不覆盖工作草稿');
  assert(await session.deleteProject(await db.readProject(c),true), '删除进入回收站');
  assert(!!(await db.readProject(c)).deletedAt, '删除记录仍保留');
  assert(await session.deleteProject(await db.readProject(c),false), '从回收站恢复');
  assert(!(await db.readProject(c)).deletedAt, '项目恢复可打开');
  const legacy={name:'旧矩形',width:9000,height:6000,items:[]};
  const rect=parseProject(legacy);
  assert(rect.width===9000&&rect.height===6000&&rect.schemaVersion===6,'旧矩形 JSON 升级保留尺寸');
  const l=parseProject({...legacy,name:'旧 L 形',outline:[{x:0,y:0},{x:9000,y:0},{x:9000,y:3000},{x:4000,y:3000},{x:4000,y:6000},{x:0,y:6000}]});
  assert(siteArea(l)===39000000&&JSON.stringify(parseProject(JSON.parse(JSON.stringify(l))))===JSON.stringify(l),'凹多边形 JSON 往返保持轮廓与面积');
  let refused=false;try{parseProject({...l,schemaVersion:99})}catch(e){refused=e.message.includes('版本')}
  assert(refused,'拒绝未知未来文件版本');
  await db.migrateLegacy(rect);await db.migrateLegacy(l);
  assert(await db.legacyMigrationId()===rect.id&&!(await db.readProject(l.id)),'迁移标记与项目原子写入，只迁移一次');
  const concurrent=await db.readProject(a);
  const outcomes=await Promise.allSettled([db.writeProject({...concurrent.project,name:'并发 1'},concurrent.revision),db.writeProject({...concurrent.project,name:'并发 2'},concurrent.revision)]);
  assert(outcomes.filter(r=>r.status==='fulfilled').length===1&&outcomes.some(r=>r.status==='rejected'&&r.reason instanceof db.RevisionConflict),'相同修订并发写入仅一个成功');
  await session.openProject(b);
  return {checks,refreshProjectId:b};
}
