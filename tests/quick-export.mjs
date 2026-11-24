import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function testQuickExport(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read','clipboard-write'] });
  const page = await context.newPage();
  const button = name => page.getByRole('button', { name, exact: true });
  try {
    await page.goto(url);
    await button('输入铺位尺寸，生成第一稿').click();
    await button('L 形 8 × 12 m').click();
    await page.getByLabel('铺位净宽（米）').fill('8.5');
    await page.getByLabel('铺位净深（米）').fill('6');
    await page.getByLabel('缺口深度（米）').fill('2');
    await button('直接生成草稿').click();
    await page.locator('.basic-draft-bar').waitFor();
    assert.match(await page.locator('.project-count').innerText(), /45.00 ㎡/);
    await button('导出图片').click();
    const dialog = page.getByRole('dialog',{name:'导出图片'});
    await dialog.getByAltText('平面与立体合图预览').waitFor();
    const result = page.waitForEvent('download');
    await dialog.getByRole('link',{name:'下载 PNG'}).click();
    const png = await readFile(await (await result).path());
    assert.equal(png.readUInt32BE(0),0x89504e47);
    assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[2400,1500]);
    await button('复制图片').click();
    await dialog.getByText('已复制图片，可以粘贴到聊天中').waitFor();
    assert.ok(await page.evaluate(async () => (await navigator.clipboard.read()).some(item => item.types.includes('image/png'))));
    for (const label of ['进店视角','鸟瞰图','平面图','当前三维视角']) {
      await button(label).click();
      await dialog.getByAltText(label + '预览').waitFor();
    }
    await dialog.getByRole('button',{name:'关闭'}).click();
    await button('2D 平面').click();
    await button('导出图片').click();
    await dialog.getByAltText('平面图预览').waitFor();
    await dialog.getByRole('button',{name:'关闭'}).click();
    assert.equal(await button('2D 平面').getAttribute('aria-pressed'),'true');
    console.log('PASS 空白铺位、预设修改、直出分屏、三视图合图、单图切换、PNG 下载与剪贴板');
  } finally { await context.close(); }
}
