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
  await button('开店模板 / 建铺').click();
  assert.match(await page.locator('.template-card').filter({ hasText: '企业员工食堂' }).innerText(), /48 座/);
  await page.getByRole('tab', { name: '按实测尺寸新建铺位' }).click();
  await page.getByLabel('铺位 / 门店名称').fill('经营测试店');
  await button('立即生成铺位框架').click();
  await page.locator('.shop-wizard-dialog').waitFor({ state: 'hidden' });
  const combo = page.locator('.combo-card').filter({ hasText: '双人咖啡圆桌组' });
  await combo.click();
  await combo.click();
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
  assert.notDeepEqual([tables[0].x, tables[0].y], [tables[1].x, tables[1].y]);
  await button('导出与汇报').click();
  assert.equal((await download('导出 2D 平面图 PNG')).readUInt32BE(0), 0x89504e47);
  await button('门头外观').click();
  await button('人视点进店').click();
  await button('换一种摆法').click();
  assert.equal(await page.locator('.compare-card').count(), 3);
  await page.locator('.compare-dialog').getByRole('button', { name: '关闭', exact: true }).click();
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
  assert.deepEqual(errors, []);
  console.log('PASS 生产版建铺、连续摆放、保存恢复、门头外观、三摆法对比、平面 PNG 与四图合伙人方案书');
} finally {
  await browser?.close();
  await server.close();
}
