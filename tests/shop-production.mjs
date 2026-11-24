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
  await button('发给合伙人').click();
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
  assert.deepEqual(errors, []);
  console.log('PASS 实测建铺、底图两点校准、组合预览与拖放、整组定位旋转、按间距复制与越界拦截、撤销重做、保存恢复及图文导出');
} finally {
  await browser?.close();
  await server.close();
}
