// Focused desktop acceptance. Pass an existing Playwright installation as argv[2].
// No test dependency is added to the application. All projects use an isolated browser context.
const { chromium } = require(process.argv[2] || 'playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root=path.resolve(__dirname,'..'),evidence=path.resolve(root,process.env.CANTEEN_EVIDENCE_DIR||'.local-checks/g2-evidence');
const port=5186,url=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,windowsHide:true,stdio:'pipe'});
const checks=[];let browser,page;
const ok=(condition,label)=>{assert.ok(condition,label);checks.push(label);console.log('PASS '+label)};
const state=()=>page.evaluate(async()=>{const s=(await import('/src/store.ts')).useStore.getState();return {project:s.project,ids:s.selectedIds,selected:s.selected,tool:s.tool,gesture:!!s.gesture,error:s.error,past:s.past.length}});
const item=(s,id)=>s.project.items.find(i=>i.id===id);
const settle=()=>page.waitForTimeout(180);
const row=id=>page.locator(`[data-object-id="${id}"] .object-select`);
async function dragItem(id,dx,dy,cancel=false){
  const r=await page.locator(`[data-item-id="${id}"]`).boundingBox();assert(r);
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();
  await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2+dy,{steps:8});
  if(cancel)assert.ok((await state()).gesture,'取消前必须已经开始拖动');
  if(cancel)await page.keyboard.press('Escape');
  await page.mouse.up();await settle();
}
(async()=>{
  await fs.mkdir(evidence,{recursive:true});
  for(let i=0;i<80;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,150))}
  browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});
  page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);await page.getByRole('button',{name:'已保存',exact:true}).waitFor();
  await page.getByRole('button',{name:'项目库',exact:true}).click();
  await page.getByRole('textbox',{name:'新项目或副本名称'}).fill('G2 合成验收场地');
  await page.getByRole('button',{name:'打开示例',exact:true}).click();
  await page.getByRole('button',{name:'关闭项目库'}).click();
  await page.getByRole('tab',{name:'对象列表'}).click();
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await page.setViewportSize({width,height});await settle();
    await row('t1').click();await row('t2').click({modifiers:['Shift']});
    ok((await state()).ids.length===2,`${width}: 对象列表 Shift 多选`);
    const length=width===1366?1600:1800;
    await page.getByLabel('统一长度（mm）').fill(String(length));await page.getByLabel('统一长度（mm）').press('Enter');
    let s=await state();ok(['t1','t2'].every(id=>item(s,id).w===length),`${width}: 共同尺寸应用两件对象`);
    const count=s.project.items.length;
    await page.getByLabel('统一长度（mm）').focus();await page.keyboard.press('Control+A');await page.keyboard.press('Delete');await page.keyboard.press('Escape');
    ok((await state()).project.items.length===count,`${width}: 输入 Delete 不删除对象`);
    const before=await state();await dragItem('t1',45,25,true);s=await state();
    ok(!s.gesture&&['t1','t2'].every(id=>item(s,id).x===item(before,id).x&&item(s,id).y===item(before,id).y),`${width}: Esc 取消组拖动`);
    await page.mouse.move(700,500);ok(!(await state()).gesture,`${width}: 取消后无残留拖动`);
    await dragItem('t1',45,25);s=await state();
    ok(item(s,'t1').x!==item(before,'t1').x&&item(s,'t1').x-item(before,'t1').x===item(s,'t2').x-item(before,'t2').x,`${width}: 实际组拖动保持相对位置`);
    await page.getByRole('button',{name:'撤销',exact:true}).click();s=await state();
    ok(item(s,'t1').x===item(before,'t1').x&&item(s,'t2').x===item(before,'t2').x,`${width}: 一次撤销整组移动`);
    await page.getByRole('button',{name:'3D 预览',exact:true}).click();await page.getByRole('button',{name:'俯视',exact:true}).click();
    await page.getByRole('button',{name:'2D 编辑',exact:true}).click();await page.getByRole('button',{name:'分屏',exact:true}).click();
    await page.getByRole('button',{name:'斜视',exact:true}).click();
    await row('t1').click();await row('t2').click({modifiers:['Shift']});await settle();
    const offscreen=await page.locator('.topbar button,.mode-tabs button,.tabs button').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.x<0||r.right>innerWidth||r.y<0||r.bottom>innerHeight)}).map(n=>n.textContent));
    ok(!offscreen.length,`${width}: 关键按钮可见，分屏切换可用`);
    await page.screenshot({path:path.join(evidence,`after-${width}.png`)});
  }
  // Overlap, visibility, locking and named search through real list controls.
  await page.evaluate(async()=>{const s=(await import('/src/store.ts')).useStore.getState();const t=s.project.items.find(i=>i.id==='t1');s.update('t3',{x:t.x,y:t.y})});
  await row('t3').click();ok((await state()).selected==='t3','重叠对象从列表准确选择');
  const focusedBefore=await state();await page.getByLabel('长度（mm）',{exact:true}).fill('1500');
  await dragItem('t3',30,20,true);
  ok(item(await state(),'t3').w===1500&&item(await state(),'t3').x===item(focusedBefore,'t3').x,'输入后直接拖动：先提交数值，Esc 仅回退拖动');
  await page.getByLabel('搜索对象').fill('t3');ok(await page.locator('[data-object-id]').count()===1,'对象 ID 搜索');
  await page.getByLabel('隐藏 四人餐桌',{exact:true}).click();ok(await page.locator('[data-item-id="t3"]').count()===0,'隐藏对象从 2D 消失');
  await page.getByLabel('显示 四人餐桌',{exact:true}).click();await page.getByLabel('锁定 四人餐桌',{exact:true}).click();
  let before=await state();await dragItem('t3',30,20);ok(item(await state(),'t3').x===item(before,'t3').x,'锁定对象不能拖动');
  await page.getByLabel('解锁 四人餐桌',{exact:true}).click();await page.getByLabel('定位 四人餐桌',{exact:true}).click();
  ok((await state()).selected==='t3','列表定位选中对象');await page.getByLabel('搜索对象').fill('');
  // 3D close-up centers the selected overlapping object; native mouse click and drag.
  await page.getByRole('button',{name:'3D 预览',exact:true}).click();await page.getByRole('button',{name:'移动已关闭',exact:true}).click();await page.getByRole('button',{name:'俯视',exact:true}).click();await settle();
  const canvas=await page.locator('.scene-shell canvas').boundingBox();const cx=canvas.x+canvas.width/2,cy=canvas.y+canvas.height/2;
  await page.mouse.click(cx,cy);ok((await state()).selected==='t3','3D 实际点击共用主选对象');
  before=await state();await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx+50,cy+20,{steps:8});assert.ok((await state()).gesture,'3D 实际命中物件开始拖动');assert.notEqual(item(await state(),'t3').x,item(before,'t3').x,'3D 实际移动后再取消');await page.keyboard.press('Escape');await page.mouse.up();
  ok(!(await state()).gesture&&item(await state(),'t3').x===item(before,'t3').x,'3D 拖动 Esc 恢复');
  await page.getByRole('button',{name:'复位',exact:true}).click();await page.getByRole('button',{name:'分屏',exact:true}).click();
  await page.getByTitle('适应整个场地',{exact:true}).click();
  // Temporary tools: cancellation never falls through into Delete / stale pointer movement.
  await page.getByRole('button',{name:'场地轮廓',exact:true}).click();await page.getByRole('button',{name:'绘制轮廓',exact:true}).click();
  const floor=await page.locator('[data-site-floor]').boundingBox();before=await state();
  await page.mouse.click(floor.x+30,floor.y+30);await page.mouse.click(floor.x+100,floor.y+30);await page.keyboard.press('Backspace');await page.keyboard.press('Delete');
  ok((await state()).project.items.length===before.project.items.length,'轮廓 Backspace/Delete 不删除设备');
  await page.keyboard.press('Escape');ok((await state()).tool==='select','Esc 退出轮廓绘制');
  await page.getByRole('button',{name:'调整轮廓',exact:true}).click();
  const vertex=await page.locator('.site-outline circle').last().boundingBox();before=await state();
  await page.mouse.move(vertex.x+vertex.width/2,vertex.y+vertex.height/2);await page.mouse.down();await page.mouse.move(vertex.x+25,vertex.y-25,{steps:5});assert.ok((await state()).gesture,'顶点拖动已开始');assert.notDeepEqual((await state()).project.outline,before.project.outline,'顶点实际移动');await page.keyboard.press('Escape');await page.mouse.up();
  ok(JSON.stringify((await state()).project.outline)===JSON.stringify(before.project.outline)&&!(await state()).gesture,'轮廓顶点取消恢复并释放指针');
  await page.getByRole('button',{name:'设备布置',exact:true}).click();await page.getByRole('button',{name:'区域',exact:true}).click();
  const draw=await page.locator('[data-site-floor]').boundingBox();before=await state();
  await page.mouse.move(draw.x+20,draw.y+20);await page.mouse.down();await page.mouse.move(draw.x+100,draw.y+80,{steps:5});await page.mouse.up();
  ok((await state()).project.items.length===before.project.items.length+1&&(await state()).tool==='select','画区域松开完成并退出工具');
  await page.getByRole('button',{name:'撤销',exact:true}).click();
  // Replaces the old prompt flow.
  await page.getByRole('tab',{name:'设备库'}).click();await page.getByRole('button',{name:'创建自定义物件',exact:true}).click();
  await page.getByLabel('物件名称',{exact:true}).fill('G2 验收工作台');await page.getByRole('button',{name:'加入我的物件',exact:true}).click();
  await page.getByLabel('搜索设备').fill('G2 验收工作台');ok(await page.locator('.catalog-entry>button').count()===1,'自定义表单创建且可复用');
  // Preference and data roundtrip, followed by G1 persistence regression in a separate context.
  await page.getByRole('tab',{name:'对象列表'}).click();await page.getByLabel('切换分屏方向').click();
  const divider=page.getByRole('separator',{name:'调整分屏比例'});await divider.focus();await page.keyboard.press('ArrowRight');
  await page.getByRole('button',{name:'收起属性面板',exact:true}).click();await page.getByRole('button',{name:'俯视',exact:true}).click();
  await page.getByRole('button',{name:'保存',exact:true}).click();await page.waitForTimeout(600);
  const preferences=await page.evaluate(()=>localStorage.getItem('canteen-workspace-v1'));await page.reload();await page.getByRole('button',{name:'已保存',exact:true}).waitFor();
  ok(await page.locator('.props').isHidden()&&await page.getByRole('tab',{name:'对象列表'}).getAttribute('aria-selected')==='true'&&await page.evaluate(()=>localStorage.getItem('canteen-workspace-v1'))===preferences,'刷新记住面板、视图、分屏比例与方向');
  ok(errors.length===0,'浏览器无未处理运行错误');
  const regression=await browser.newContext();const rp=await regression.newPage();await rp.goto(url);await rp.getByRole('button',{name:'已保存',exact:true}).waitFor();
  const g1=await rp.evaluate(async()=>await (await import('/tests/g1-storage.browser.js')).default());ok(g1.checks.length>25,'G1 持久化、失败恢复与 JSON 回归通过');
  const invariants=await rp.evaluate(async()=>await (await import('/tests/g2-invariants.browser.js')).default());ok(invariants.length>5,'墙窗从属、批量失败回退、显隐 JSON 回归通过');
  await fs.writeFile(path.join(evidence,'acceptance.json'),JSON.stringify({date:'2026-11-05',browser:await browser.version(),viewports:[[1366,768],[1920,1080]],checks,g1Checks:g1.checks,invariants,errors},null,2));
  console.log('G2 acceptance complete');
})().catch(async e=>{console.error(e);if(page)await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});process.exitCode=1}).finally(async()=>{await browser?.close();server.kill()});
