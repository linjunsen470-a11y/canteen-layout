// One focused G3 browser workflow; isolated local storage, no application test dependency.
const {chromium}=require(process.argv[2]);
const {spawn}=require('node:child_process'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,process.env.CANTEEN_EVIDENCE_DIR||'.local-checks/g3-evidence'),url='http://127.0.0.1:5189';
const server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5189','--strictPort'],{cwd:root,windowsHide:true,stdio:'pipe'});
let browser,page;const checks=[],errors=[];
const ok=(v,label)=>{assert.ok(v,label);checks.push(label);console.log('PASS '+label)};
const state=()=>page.evaluate(async()=>{const s=(await import('/src/store.ts')).useStore.getState();return {project:s.project,tool:s.tool,error:s.error,gesture:!!s.gesture}});
const button=name=>page.getByRole('button',{name,exact:true});
async function number(label,value){const field=page.getByLabel(label,{exact:true});await field.fill(String(value));await field.press('Enter')}
async function screen(x,y){return page.locator('[data-plan]').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return{x:q.x,y:q.y}},{x,y})}
async function clickWorld(x,y){const q=await screen(x,y);await page.mouse.click(q.x,q.y)}
async function draw(points){for(const p of points)await clickWorld(...p);await button('闭合轮廓').click()}
async function drag(x,y,dx,dy,cancel=false){const a=await screen(x,y),b=await screen(x+dx,y+dy);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});if(cancel)await page.keyboard.press('Escape');await page.mouse.up()}
async function download(name,file){const wait=page.waitForEvent('download');await button(name).click();await (await wait).saveAs(path.join(out,file))}
(async()=>{
 await fs.mkdir(out,{recursive:true});for(let i=0;i<80;i++){try{if((await fetch(url)).ok)break}catch{}await new Promise(r=>setTimeout(r,150))}
 browser=await chromium.launch({channel:'chrome',headless:true});let context=await browser.newContext({viewport:{width:1366,height:768},deviceScaleFactor:1});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await button('已保存').waitFor();await page.getByLabel('项目名称',{exact:true}).fill('G3 合成现场');await button('2D 编辑').click();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1000;c.height=600;const g=c.getContext('2d');g.fillStyle='#fff8e9';g.fillRect(0,0,1000,600);g.strokeStyle='#35677d';g.lineWidth=4;g.strokeRect(40,40,920,520);g.beginPath();g.moveTo(100,100);g.lineTo(600,100);g.stroke();for(const x of [100,600]){g.beginPath();g.moveTo(x,80);g.lineTo(x,120);g.stroke()}g.fillStyle='#254c5f';g.font='24px sans-serif';g.fillText('5000 mm — SYNTHETIC SITE',100,75);g.fillText('G3 calibration fixture',100,500);return c.toDataURL('image/png').split(',')[1]});
 await fs.writeFile(path.join(out,'synthetic-5000mm.png'),Buffer.from(png,'base64'));
 await button('场地设置').click();await page.locator('.site-data summary').filter({hasText:'现场底图'}).click();await page.getByLabel('导入底图',{exact:true}).setInputFiles(path.join(out,'synthetic-5000mm.png'));await page.locator('[data-underlay]').waitFor();
 await button('两点校准').click();await clickWorld(2000,2000);await clickWorld(12000,2000);await button('应用校准').click();let s=await state(),u=s.project.underlay;
 ok(Math.abs(u.mmPerPixel-10)<.01&&Math.abs(u.x-1000)<1&&u.calibration.distance===5000,'实际点选两点校准 5000mm，第一点保持原世界坐标');
 await button('解锁底图').click();await number('底图旋转（°）',15);await number('底图旋转（°）',0);await button('拖动底图').click();await drag(4000,4000,1000,500,true);ok(Math.abs((await state()).project.underlay.x-u.x)<1,'底图拖动 Esc 取消恢复原位');
 await button('拖动底图').click();await drag(4000,4000,1000,500);ok((await state()).project.underlay.x>u.x+900,'底图实际拖动生效');await button('撤销').click();await button('锁定底图').click();
 await button('隐藏底图').click();ok(await page.locator('[data-underlay]').count()===0,'隐藏底图生效');await button('显示底图').click();
 await button('L 形起步').click();await button('完成编辑').click();const whole=(await state()).project.outline;
 // Place two real catalog objects, one in each future work area.
 await page.getByLabel('搜索设备').fill('四人餐桌');
 const addTable=()=>page.locator('.catalog-entry>button').filter({hasText:'四人餐桌'}).click();
 await addTable();await number('X 坐标（mm）',3000);await number('Y 坐标（mm）',3000);const inside=(await state()).project.items.at(-1).id;
 await addTable();await number('X 坐标（mm）',3000);await number('Y 坐标（mm）',9000);const outside=(await state()).project.items.at(-1).id;
 const itemsBefore=JSON.stringify((await state()).project.items);
 await button('场地资料 / 范围').click();await button('绘制新规划范围').click();await draw([[1000,1000],[9000,1000],[9000,5000],[1000,5000]]);await page.getByLabel('规划范围名称').fill('经营区 A');
 await button('绘制新规划范围').click();await draw([[1000,7000],[9000,7000],[9000,11000],[1000,11000]]);await page.getByLabel('规划范围名称').fill('经营区 B');
 const areas=(await state()).project.planningAreas;await page.getByLabel('当前规划范围').selectOption(areas[0].id);s=await state();
 ok(JSON.stringify(s.project.outline)===JSON.stringify(whole)&&JSON.stringify(s.project.items)===itemsBefore&&areas.length===2,'创建/切换两个规划范围，L 形整场地和设备坐标保持不变');
 await drag(3600,9400,1000,0);ok((await state()).project.items.find(i=>i.id===outside).x===3000&&await page.getByLabel('X 坐标（mm）',{exact:true}).isDisabled(),'区外物件不可拖动，属性编辑禁用');
 await button('复制').click();ok((await state()).project.items.length===2,'区外物件不能复制');await button('删除').click();ok((await state()).project.items.length===2,'区外物件不能删除');
 await drag(3600,3400,1000,0);ok((await state()).project.items.find(i=>i.id===inside).x===4000,'区内物件可实际拖动');await button('撤销').click();
 await clickWorld(3600,3400);await number('X 坐标（mm）',8500);ok((await state()).project.items.find(i=>i.id===inside).x===3000,'完整外包越过边界的属性修改被拒绝');
 await button('场地资料 / 范围').click();await page.getByLabel('当前规划范围').selectOption(areas[0].id);await button('分屏').click();await page.waitForTimeout(1200);await page.screenshot({path:path.join(out,'workbench-1366.png')});
 const offscreen=await page.locator('.topbar button,.planning-bar button,.tabs button').evaluateAll(nodes=>nodes.filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&(r.x<0||r.right>innerWidth||r.y<0||r.bottom>innerHeight)}).map(n=>n.textContent));ok(!offscreen.length,'1366×768 主要操作入口可见');
 await download('三维截图','scene.png');await download('PNG','plan.png');await download('项目包','portable.canteen.json');await download('JSON','geometry.json');
 await button('保存').click();await button('已保存').waitFor();const saved=(await state()).project;await page.reload();await page.locator('[data-underlay]').waitFor();s=await state();ok(s.project.underlay.assetId===saved.underlay.assetId&&s.project.planningAreas.length===2,'刷新恢复底图资产和独立规划范围');
 // A fresh browser context has no asset store shared with the source project.
 context=await browser.newContext({viewport:{width:1366,height:768}});page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await button('已保存').waitFor();await page.locator('.topbar input[type=file]').setInputFiles(path.join(out,'portable.canteen.json'));await page.locator('[data-underlay]').waitFor();s=await state();
 assert.deepEqual(JSON.parse(JSON.stringify(s.project.items)),JSON.parse(JSON.stringify(saved.items)));assert.deepEqual(s.project.planningAreas,saved.planningAreas);
 ok(s.project.id!==saved.id&&s.project.underlay.assetId!==saved.underlay.assetId&&s.project.underlay.mmPerPixel===saved.underlay.mmPerPixel,'独立浏览器存储导入项目包，图片、校准、范围与物件完整保留');
 await page.getByLabel('当前规划范围').selectOption(areas[0].id);await button('场地资料 / 范围').click();await page.waitForTimeout(1000);await page.screenshot({path:path.join(out,'portable-restored.png')});
 context=await browser.newContext();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await button('已保存').waitFor();await page.locator('.topbar input[type=file]').setInputFiles(path.join(out,'geometry.json'));await page.waitForFunction(async()=>!!(await import('/src/store.ts')).useStore.getState().project.underlay);await button('场地设置').click();await page.getByText('底图资产缺失，请导入含图片的项目包，或重新导入底图',{exact:true}).waitFor();ok(await page.locator('[data-underlay]').count()===0,'普通 JSON 跨浏览器导入明确提示图片缺失，几何仍可使用');
 ok(errors.length===0,'本次操作无页面运行时异常');await fs.writeFile(path.join(out,'results.json'),JSON.stringify({date:'2026-11-05',browser:await browser.version(),viewport:'1366×768',checks,errors},null,2));
})().catch(async e=>{console.error(e);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1}).finally(async()=>{await browser?.close();server.kill()});
