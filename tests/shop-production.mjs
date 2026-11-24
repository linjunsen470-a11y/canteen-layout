import { testEditableDraft } from './editable-draft.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';

const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  browser = await chromium.launch({
    channel: process.env.CI ? undefined : 'chrome',
    args: ['--enable-unsafe-swiftshader'],
  });
  await testEditableDraft(browser, 'http://127.0.0.1:' + server.httpServer.address().port);
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  page.setDefaultTimeout(45000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const button = name => page.getByRole('button', { name, exact: true });
  const download = async name => {
    const [file] = await Promise.all([page.waitForEvent('download'), button(name).click()]);
    return readFile(await file.path());
  };
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port);
  await button('已保存').waitFor();
  assert.match(await page.locator('.project-count').innerText(), /0 座/);
  await button('新建铺位').click();
  await button('按内墙净尺寸').click();
  await page.getByLabel('铺位名称').fill('经营测试店');
  await button('创建铺位').click();
  await page.locator('.shop-wizard-dialog').waitFor({ state: 'hidden' });
  const combo = page.locator('.combo-card').filter({ hasText: '双人咖啡圆桌组' });
  assert.equal(await combo.locator('svg.combo-plan polygon').count(), 3);
  assert.ok(await page.locator('.combo-card').evaluateAll(cards => cards.every(card => {
    const sidebar = card.closest('.library').getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    return rect.left >= sidebar.left && rect.right <= sidebar.right && card.scrollWidth <= card.clientWidth;
  })), '组合卡片及其内容应完整显示在素材库中');
  const plan = page.getByLabel('二维布局画布');
  const targetPosition = await plan.evaluate(svg => {
    const pt = new DOMPoint(2500, 3500).matrixTransform(svg.querySelector('[data-plan]').getScreenCTM());
    const rect = svg.getBoundingClientRect();
    return { x: pt.x - rect.left, y: pt.y - rect.top };
  });
  await combo.dragTo(plan, { targetPosition });
  const batch = page.locator('.batch-props');
  assert.match(await batch.locator('.batch-summary').innerText(), /2020 × 850 mm · 2 座/);
  const field = batch.getByLabel('左边缘 X（mm）');
  await field.fill('1000');
  await field.press('Enter');
  await batch.getByRole('button', { name: '右转 90°' }).click();
  assert.match(await batch.locator('.batch-summary').innerText(), /850 × 2020 mm/);
  await batch.getByLabel('边缘间距（mm）').fill('800');
  await batch.getByRole('button', { name: '向右复制' }).click();
  await batch.getByLabel('边缘间距（mm）').fill('20000');
  await batch.getByRole('button', { name: '向右复制' }).click();
  assert.match(await page.locator('.props [role="alert"]').innerText(), /无法在此处复制/);
  assert.match(await page.locator('.project-count').innerText(), /4 座/);
  await button('撤销').click();
  assert.match(await page.locator('.project-count').innerText(), /2 座/);
  await button('重做').click();
  await button('开店概览').click();
  const dialog = page.locator('.insights-dialog');
  assert.match(await dialog.innerText(), /4 座/);
  assert.equal(await dialog.locator('.insights-issues button').filter({ hasText: /物件重叠|门扇开启范围|固定障碍碰撞|场地越界/ }).count(), 0);
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await button('保存').click();
  await button('已保存').waitFor();
  await page.reload();
  await button('已保存').waitFor();
  assert.match(await page.locator('.project-count').innerText(), /4 座/);
  await button('导出与汇报').click();
  const project = JSON.parse(await download('JSON'));
  const tables = project.items.filter(i => i.kind === 'table');
  assert.equal(tables.length, 2);
  assert.equal(tables[0].rotation, 90);
  assert.equal(tables[1].x - tables[0].x, 1650);
  assert.equal(project.groups.length, 2);
  assert.notDeepEqual([tables[0].x, tables[0].y], [tables[1].x, tables[1].y]);
  await button('导出与汇报').click();
  assert.equal((await download('导出 2D 平面图 PNG')).readUInt32BE(0), 0x89504e47);
  await button('2D + 3D 分屏').click();
  await button('门头外观').click();
  await button('人视点进店').click();
  await button('导出与汇报').click();
  await button('客户成果').click();
  const html = (await download('下载展示页')).toString('utf8');
  const report = await browser.newPage();
  await report.setContent(html);
  const images = await report.locator('img').evaluateAll(async nodes => Promise.all(nodes.map(async image => {
    await image.decode();
    return image.naturalWidth;
  })));
  assert.equal(images.length, 4);
  assert.ok(images.every(w => w >= 500));
  assert.match(await report.locator('main').innerText(), /经营测试店/);
  assert.match(await report.locator('main').innerText(), /临街门头外观效果/);
  const birdseye = report.locator('.gallery-hero img');
  const reference = await birdseye.getAttribute('src');
  await button('关闭成果').click();
  await page.locator(`[data-item-id="${tables[0].id}"]`).first().click();
  await page.locator('.scene-more summary').click();
  await button('物体特写').click();
  const closeupCaption = await page.locator('.scene-caption b').innerText();
  await button('导出与汇报').click();
  await button('客户成果').click();
  const framed = page.frameLocator('iframe[title="客户方案预览"]');
  const image = framed.locator('.gallery-hero img');
  await image.waitFor();
  // Compare image contents so a valid PNG containing only one table fails.
  const difference = await image.evaluate(async (shot, src) => {
    const before = new Image();
    before.src = src;
    await Promise.all([shot.decode(), before.decode()]);
    const canvas = document.createElement('canvas');
    canvas.width = 96; canvas.height = 60;
    const ctx = canvas.getContext('2d');
    const sample = img => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    const a = sample(before), b = sample(shot);
    return a.reduce((sum, value, index) => sum + Math.abs(value - b[index]), 0) / a.length;
  }, reference);
  assert.ok(difference < 3, `物体特写导出的全景与整店快照偏差过大: ${difference}`);
  await button('关闭成果').click();
  assert.equal(await page.locator('.scene-caption b').innerText(), closeupCaption);
  assert.ok(await button('物体特写').evaluate(b => b.classList.contains('active')));
  await button('新建铺位').click();
  await button('从户型图描绘').click();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 100; canvas.height = 80;
    return canvas.toDataURL().split(',')[1];
  });
  await page.locator('input[name=image]').setInputFiles({ name: 'survey.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await button('导入并两点校准').click();
  const underlay = page.locator('[data-underlay]');
  await underlay.waitFor();
  for (const x of [1000, 6000]) {
    const point = await plan.evaluate((svg, x) => {
      const p = new DOMPoint(x, 3500).matrixTransform(svg.querySelector('[data-plan]').getScreenCTM());
      return { x: p.x, y: p.y };
    }, x);
    await page.mouse.click(point.x, point.y);
  }
  await button('应用校准').click();
  await page.getByText(/已校准 5000mm/).waitFor();
  await button('新建铺位').click();
  await button('按内墙净尺寸').click();
  await page.getByLabel('铺位名称').fill('净尺寸复核');
  await page.getByLabel('铺位轮廓').selectOption('chain');
  const legs = [['right',6000],['down',2500],['left',2000],['down',1500],['left',3960],['up',4000]];
  for (const [idx,[direction,length]] of legs.entries()) {
    await page.getByLabel('第 '+(idx+1)+' 段方向').selectOption(direction);
    const lengthInput = page.getByLabel('第 '+(idx+1)+' 段净长（mm）');
    await lengthInput.fill(String(length));
    if (idx+1<legs.length) await lengthInput.press('Enter');
  }
  assert.match(await page.locator('.survey-preview').innerText(),/横向差 40 mm/);
  await button('创建铺位').click();
  assert.match(await page.locator('.shop-wizard-dialog [role=alert]').innerText(),/横向差 40 mm/);
  await page.getByLabel('第 5 段净长（mm）').fill('4000');
  await button('创建铺位').click();
  await page.locator('.shop-wizard-dialog').waitFor({state:'hidden'});
  await button('2D 平面').click();
  await page.getByRole('tab',{name:'对象列表'}).click();
  await page.getByRole('checkbox',{name:'选择 外墙 1',exact:true}).check();
  assert.match(await page.locator('[data-survey-dimension]').textContent(),/内净长 6000 mm/);
  await page.getByText('按内墙角量距添加门窗',{exact:true}).click();
  const gap = page.getByLabel('内墙角到洞口近边（mm）');
  await gap.fill('850');
  await button('放置洞口').click();
  assert.match(await page.locator('[data-survey-dimension]').textContent(),/起角 850 mm/);
  await page.getByLabel('从内墙哪头量').selectOption('end');
  assert.equal(await gap.inputValue(),'4250');
  await gap.fill('4100');
  await gap.press('Enter');
  await gap.fill('4250');
  await gap.press('Enter');
  assert.match(await page.locator('[data-survey-dimension]').textContent(),/末角 4250 mm/);
  await button('保存').click();
  await button('已保存').waitFor();
  await page.reload();
  await button('已保存').waitFor();
  await button('开店概览').click();
  assert.match(await page.locator('.kpi-card').first().innerText(), /现场记录净面积[\s\S]*21.00 ㎡[\s\S]*外轮廓面积 25.16 ㎡/);
  await dialog.getByRole('button',{name:'关闭',exact:true}).click();
  await button('导出与汇报').click();
  const raw = await download('项目包');
  const saved = JSON.parse(raw).project;
  assert.equal(saved.items.find(i=>i.kind==='door').offset,950);
  assert.equal(saved.survey.wallIds.length,6);
  await button('导出与汇报').click();
  const choosing = page.waitForEvent('filechooser');
  await button('导入').click();
  await (await choosing).setFiles({name:'survey.canteen.json',mimeType:'application/json',buffer:raw});
  await page.getByText('方案已导入为独立项目',{exact:true}).waitFor();
  await button('导出与汇报').click();
  const restored = JSON.parse(await download('JSON'));
  assert.notEqual(restored.id,saved.id);
  assert.deepEqual(restored.survey,saved.survey);
  assert.deepEqual(restored.items,saved.items);
  await button('设备布置').click();
  await page.getByRole('tab',{name:'设备与素材'}).click();
  await page.locator('.combo-card').filter({hasText:'双人咖啡圆桌组'}).click();
  await page.locator('.combo-card').filter({hasText:'四人双面卡座组'}).click();
  assert.match(await page.locator('.project-count').innerText(), /6 座/);
  await button('导出与汇报').click();
  const furnishedPlan = await download('导出 2D 平面图 PNG');
  assert.equal(furnishedPlan.readUInt32BE(16),2220);
  assert.equal(furnishedPlan.readUInt32BE(20),1700);
  await button('导出与汇报').click();
  const furnished = JSON.parse(await download('JSON'));
  assert.equal(furnished.groups.length,2);
  await button('场地轮廓').click();
  const upload = page.getByLabel('导入底图',{exact:true});
  await upload.setInputFiles({name:'align.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await page.locator('[data-underlay]').waitFor();
  await button('两点校准').click();
  await page.getByLabel('校准基准').selectOption('0');
  for (const [x,y] of [[1000,1200],[1600,3000]]) {
    const point = await plan.evaluate((svg,{x,y})=>{
      const v=new DOMPoint(x,y).matrixTransform(svg.querySelector('[data-plan]').getScreenCTM());
      return {x:v.x,y:v.y};
    },{x,y});
    await page.mouse.click(point.x,point.y);
  }
  await button('应用校准').click();
  await page.getByText(/已校准 6000mm/).waitFor();
  await button('导出与汇报').click();
  const aligned = JSON.parse(await download('JSON'));
  assert.deepEqual(aligned.items,furnished.items);
  assert.deepEqual(aligned.outline,furnished.outline);
  assert.ok(Math.abs(aligned.underlay.rotation)>45);
  console.log('PASS 实测逐段录入、40 mm 闭合差修正、双端定位门洞、尺寸线、净面积、刷新与项目包往返');

  // Verify non-destructive smart concept zoning estimator on the surveyed L-shaped shop
  await button('智能分区估算').click();
  const conceptDialog = page.locator('.concept-dialog');
  await conceptDialog.waitFor({ state: 'visible' });
  await conceptDialog.getByRole('button', { name: '对比当前方案', exact: true }).click();
  assert.equal(await conceptDialog.locator('.concept-canvas-card').count(), 2);
  await conceptDialog.getByRole('button', { name: '应用到当前铺位（可撤销）', exact: true }).click();
  await conceptDialog.waitFor({ state: 'hidden' });
  await button('导出与汇报').click();
  const zoned = JSON.parse(await download('JSON'));
  assert.deepEqual(zoned.survey, aligned.survey);
  assert.deepEqual(zoned.outline, aligned.outline);
  assert.ok(zoned.items.some(i => i.kind === 'zone'), '智能分区应生成功能区');
  assert.ok(zoned.items.some(i => i.kind === 'door'), '智能分区应保留原实测门洞');
  await button('撤销').click();
  assert.match(await page.locator('.project-count').innerText(), /6 座/);

  // Verify template reference gallery is reachable in ShopWizardDialog
  await button('新建铺位').click();
  await button('示范案例参考').click();
  assert.equal(await page.locator('.template-card').count(), 4);
  await page.locator('.shop-wizard-dialog').getByRole('button', { name: '关闭', exact: true }).click();

  // A real project can have fixed objects assigned to a zone that the estimator replaces.
  const fixture = { ...aligned, name: '分区存档回归', underlay: undefined, groups: [],
    items: aligned.items.filter(i => ['wall', 'door'].includes(i.kind)) };
  const item = (id, kind, x, y, w, d, h) => ({ id, name: id, kind, x, y, w, d, h, rotation: 0, color: '#778877' });
  fixture.items.push(item('旧区', 'zone', 200, 200, 4000, 2800, 0),
    { ...item('柱', 'column', 350, 360, 450, 450, 3000), zoneId: '旧区' },
    item('玻璃隔断', 'partition', 500, 2400, 2000, 100, 1800));
  async function importFixture(project) {
    await button('导出与汇报').click();
    const input = page.waitForEvent('filechooser');
    await button('导入').click();
    await (await input).setFiles({ name: 'shop.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) });
    await page.getByText('方案已导入为独立项目', { exact: true }).waitFor();
  }
  async function exportSvgText() {
    // Inspect the exact SVG sent to the PNG rasterizer.
    await page.evaluate(() => {
      const serialize = XMLSerializer.prototype.serializeToString;
      XMLSerializer.prototype.serializeToString = function(node) {
        const xml = serialize.call(this, node);
        window.exportLabels = [...node.querySelectorAll('text')].map(t => t.textContent);
        XMLSerializer.prototype.serializeToString = serialize;
        return xml;
      };
    });
    await button('导出与汇报').click();
    assert.equal((await download('导出 2D 平面图 PNG')).readUInt32BE(0), 0x89504e47);
    return page.evaluate(() => window.exportLabels);
  }
  await importFixture(fixture);
  await button('2D 平面').click();
  assert.ok(!(await exportSvgText()).some(t => /主入口|^入口$/.test(t)));
  await button('智能分区估算').click();
  const ratio = conceptDialog.getByRole('slider');
  const previousKpi = await conceptDialog.locator('.concept-kpi strong').first().innerText();
  await ratio.focus();
  await page.keyboard.down('End');
  assert.equal(await ratio.inputValue(), '50');
  assert.equal(await conceptDialog.locator('.concept-kpi strong').first().innerText(), previousKpi);
  await page.keyboard.up('End');
  assert.notEqual(await conceptDialog.locator('.concept-kpi strong').first().innerText(), previousKpi);
  await button('应用到当前铺位（可撤销）').click();
  await button('保存').click();
  await button('已保存').waitFor();
  await page.reload();
  await button('已保存').waitFor();
  await button('导出与汇报').click();
  const reopened = JSON.parse(await download('JSON'));
  assert.equal(reopened.name, fixture.name);
  assert.equal(reopened.items.find(i => i.id === '柱').zoneId, undefined);
  assert.ok(reopened.items.some(i => i.id === '玻璃隔断'));
  await button('智能分区估算').click();
  await button('另存为对比方案').click();
  await conceptDialog.waitFor({ state: 'hidden' });
  await page.reload();
  await button('已保存').waitFor();
  await button('导出与汇报').click();
  const variant = JSON.parse(await download('JSON'));
  assert.notEqual(variant.id, reopened.id);
  assert.ok(variant.items.some(i => i.id === '柱'));

  fixture.items.push({ ...item('顾客入口点', 'utility', 1100, 320, 200, 200, 80), pointType: 'entrance' });
  await importFixture(fixture);
  await button('2D 平面').click();
  assert.ok((await exportSvgText()).includes('入口'));

  // Verify surveyed wall-corner column placement, 2D floating quick-bar, and 3D smart cutaway toggle
  await button('新建铺位').click();
  await button('按内墙净尺寸').click();
  await page.getByLabel('铺位名称').fill('快建交互验证');
  await button('创建铺位').click();
  await page.locator('.shop-wizard-dialog').waitFor({ state: 'hidden' });
  await page.locator('.plan-quick-bar.is-starter').waitFor({ state: 'visible' });
  await page.getByRole('tab', { name: '对象列表' }).click();
  await page.getByRole('checkbox', { name: '选择 外墙 1', exact: true }).check();
  await page.getByText('按内墙角量距添加柱子 / 水电入口', { exact: true }).click();
  await button('按量距放置构件').click();
  await page.locator('.plan-quick-bar').getByRole('button', { name: '右转', exact: true }).click();
  await button('2D + 3D 分屏').click();
  const smartWallBtn = button('智能透视墙');
  assert.equal(await smartWallBtn.getAttribute('aria-pressed'), 'true');
  await smartWallBtn.click();
  assert.equal(await smartWallBtn.getAttribute('aria-pressed'), 'false');
  await smartWallBtn.click();
  assert.equal(await smartWallBtn.getAttribute('aria-pressed'), 'true');

  // Verify P1 canvas-first studio flows: wall quick-bar add-door, progressive inspector, 3-step switcher, light click-through, footer KPI pill
  await page.locator('.object-select', { hasText: '外墙 3' }).click();
  await page.locator('.plan-quick-bar').getByRole('button', { name: '加门', exact: true }).click();
  assert.match(await page.locator('.props .panel-heading h3').innerText(), /对象属性/);
  await button('智能分区估算').click();
  await conceptDialog.waitFor({ state: 'visible' });
  await conceptDialog.getByRole('button', { name: '应用到当前铺位（可撤销）', exact: true }).click();
  await conceptDialog.waitFor({ state: 'hidden' });
  await button('2D 平面').click();
  const underLight = await page.evaluate(() => {
    const lights = [...document.querySelectorAll('[data-item-id]')].filter(el => el.querySelector('ellipse[fill="transparent"]'));
    const r = lights[0]?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  });
  assert.ok(underLight, 'concept layout should include overhead table lights');
  await page.mouse.click(underLight.x, underLight.y);
  assert.doesNotMatch(await page.locator('.quick-bar-name').innerText(), /吊灯|射灯/, 'clicking center of table under a pendant light must select the table, not the light');
  await page.locator('.stage-stepper button').nth(2).click();
  assert.equal(await page.locator('.stage-stepper button').nth(2).getAttribute('aria-pressed'), 'true');
  assert.equal(await button('3D 效果图').getAttribute('aria-pressed'), 'true');
  await page.locator('.footer-check-pill').click();
  await dialog.waitFor({ state: 'visible' });
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  console.log('PASS 试排应用、墙体快捷加门、吊灯点击穿透、三步导航、3D 悬浮胶囊与底部开店指标条');

  const atmosphere = page.locator('.scene-atmos-menu');
  for (const preset of ['自然光', '暖光营业']) {
    await atmosphere.locator('summary').click();
    await atmosphere.getByRole('button', { name: preset, exact: true }).click();
    assert.equal(await atmosphere.locator('summary').innerText(), preset);
    assert.equal(await atmosphere.getAttribute('open'), null);
  }

  await button('2D 平面').click();
  const wall = item('定位墙', 'wall', 1000, 1000, 6000, 200, 2800);
  const table = item('定位桌', 'table', 3000, 3000, 1200, 800, 750);
  await importFixture({
    ...fixture, name: '规划范围与离墙定位', survey: undefined, outline: undefined,
    width: 10000, height: 8000, items: [wall, table],
    planningAreas: [{ id: 'front', name: '前厅', color: '#347755', outline: [
      { x: 0, y: 0 }, { x: 8000, y: 0 }, { x: 8000, y: 2500 }, { x: 0, y: 2500 },
    ] }],
  });
  const scope = page.getByLabel('当前规划范围');
  const pill = page.locator('.footer-check-pill');
  async function checkScope(expected) {
    assert.equal(await pill.innerText(), expected ? `${expected} 处冲突` : '无冲突');
    await pill.click();
    const heading = dialog.getByRole('heading', { name: /空间碰撞与通道体检/ });
    assert.ok((await heading.innerText()).includes(`${expected} 项冲突`));
    assert.equal(await dialog.locator('.insights-issues .is-critical').count(), expected);
    await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  }
  await scope.selectOption('front');
  await checkScope(1);
  await scope.selectOption('');
  await checkScope(0);

  await page.getByRole('tab', { name: '对象列表' }).click();
  await page.locator('.object-select', { hasText: table.name }).click();
  await page.locator('.props-advanced > summary').click();
  await button('精确离墙定位').click();
  assert.equal(await page.getByLabel('Y 坐标（mm）', { exact: true }).isDisabled(), true);
  await page.getByLabel('参考墙面').selectOption(wall.id + '|1');
  await page.getByLabel('目标净距（mm）').fill('300');
  await button('预览移动').click();
  assert.match(await page.locator('.wall-placement-bar').innerText(), /预览 300 mm/);
  await button('确认落位').click();
  await page.locator('.wall-placement-bar').waitFor({ state: 'hidden' });
  const y = page.getByLabel('Y 坐标（mm）', { exact: true });
  assert.equal(Number(await y.inputValue()), wall.y + wall.d + 300);
  await scope.selectOption('front');
  await checkScope(0);
  await button('撤销').click();
  await checkScope(1);
  console.log('PASS 鼠标切换 3D 光照、精确离墙预览与确认、范围冲突数量随选择和撤销同步');

  assert.deepEqual(errors, []);
  console.log('PASS 实测建铺、底图两点校准、智能分区估算与同壳对比、示范案例参考、组合预览与拖放、整组四向复制与图文导出');
} finally {
  await browser?.close();
  await server.close();
}
