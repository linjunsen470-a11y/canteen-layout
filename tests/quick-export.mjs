import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

export async function testQuickExport(browser, url) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read','clipboard-write'] });
  const page = await context.newPage();
  const button = name => page.getByRole('button', { name, exact: true });
  try {
    await page.goto(url);
    await button('输入铺位尺寸，生成第一稿').waitFor();
    assert.equal(await page.locator('.plan-quick-bar.is-starter').count(), 0);
    await button('输入铺位尺寸，生成第一稿').click();
    await button('L 形 8 × 12 m').click();
    await page.getByLabel('缺口宽度（米）').fill('4.5');
    await page.getByLabel('缺口深度（米）').fill('5.5');
    await button('L 形 8 × 12 m').click();
    assert.equal(await page.getByLabel('缺口宽度（米）').inputValue(), '3');
    assert.equal(await page.getByLabel('缺口深度（米）').inputValue(), '4');
    await page.getByLabel('铺位净宽（米）').fill('8.5');
    await page.getByLabel('铺位净深（米）').fill('6');
    await page.getByLabel('缺口深度（米）').fill('2');
    await button('直接生成草稿').click();
    await page.locator('.basic-draft-bar').waitFor();
    assert.match(await page.locator('.project-count').innerText(), /45.00 ㎡/);
    assert.equal(
      await page.locator('.basic-draft-bar').getByRole('button', { name: '原木暖调', exact: true }).getAttribute('aria-pressed'),
      'true',
      '面馆首稿应自动套用原木暖调而非素水泥白模',
    );
    await page.evaluate(() => {
      window.planHeaders = [];
      const serialize = XMLSerializer.prototype.serializeToString;
      XMLSerializer.prototype.serializeToString = function (node) {
        if (node instanceof SVGSVGElement && node.querySelector('[data-plan]')) {
          window.planHeaders.push(!!node.querySelector(':scope > svg'));
        }
        return serialize.call(this, node);
      };
    });
    await button('导出图片').click();
    const dialog = page.getByRole('dialog',{name:'导出图片'});
    await dialog.getByAltText('平面与立体合图预览').waitFor();
    assert.deepEqual(await page.evaluate(() => window.planHeaders), [false], '合图只栅格化一次无页眉平面');
    const sheetBeforeStyle = await dialog.getByAltText('平面与立体合图预览').getAttribute('src');
    const result = page.waitForEvent('download');
    await dialog.getByRole('link',{name:'下载 PNG'}).click();
    const png = await readFile(await (await result).path());
    assert.equal(png.readUInt32BE(0),0x89504e47);
    assert.deepEqual([png.readUInt32BE(16),png.readUInt32BE(20)],[2400,1500]);
    await button('复制图片').click();
    await dialog.getByText('已复制图片，可以粘贴到聊天中').waitFor();
    assert.ok(await page.evaluate(async () => (await navigator.clipboard.read()).some(item => item.types.includes('image/png'))));
    let birdBeforeStyle = '';
    for (const label of ['室内视角','鸟瞰图','平面图','当前三维视角']) {
      await button(label).click();
      await dialog.getByAltText(label + '预览').waitFor();
      if (label === '鸟瞰图') birdBeforeStyle = await dialog.getByAltText('鸟瞰图预览').getAttribute('src');
    }
    assert.deepEqual(await page.evaluate(() => window.planHeaders), [false,true], '单独查看平面时才生成带页眉版本');

    // Switch decor style inside ImageExport: composite sheet & birdseye re-render without re-rasterizing 2D plan,
    // seat count stays identical, and a single undo restores the previous style.
    const seatsBeforeStyle = await page.locator('.project-count').innerText();
    await dialog.getByRole('button', { name: '平面与立体合图', exact: true }).click();
    await dialog.getByAltText('平面与立体合图预览').waitFor();
    await dialog.getByRole('button', { name: '晚市小馆', exact: true }).click();
    await page.waitForFunction(prev => {
      const img = document.querySelector('dialog.image-export img[alt="平面与立体合图预览"]');
      return !!img && img.getAttribute('src') && img.getAttribute('src') !== prev;
    }, sheetBeforeStyle);
    assert.deepEqual(await page.evaluate(() => window.planHeaders), [false, true], '切换风格不得重复栅格化平面图');
    await dialog.getByRole('button', { name: '鸟瞰图', exact: true }).click();
    await dialog.getByAltText('鸟瞰图预览').waitFor();
    const birdAfterStyle = await dialog.getByAltText('鸟瞰图预览').getAttribute('src');
    assert.notEqual(birdAfterStyle, birdBeforeStyle, '切换风格后鸟瞰图 PNG 像素内容应变化');
    await dialog.getByRole('button', { name: '关闭' }).click();
    assert.equal(await page.locator('.project-count').innerText(), seatsBeforeStyle, '切换风格不得改动座位数');
    await button('撤销').click();
    assert.equal(
      await page.locator('.basic-draft-bar').getByRole('button', { name: '原木暖调', exact: true }).getAttribute('aria-pressed'),
      'true',
      '一次撤销应恢复切换前的装修风格',
    );
    await page.locator('.focus-toggle').click();
    await page.locator('.app.is-focused').waitFor();
    await button('导出图片').click();
    await dialog.getByAltText('平面与立体合图预览').waitFor();

    // A/B compare: before saving a second same-shop draft, show empty-state hint and jump directly to 比较摆法.
    await button('A/B 对比图').click();
    await dialog.getByText(/项目库中暂无同铺方案/).waitFor();
    await dialog.getByRole('button', { name: '去比较摆法' }).click();
    await dialog.waitFor({ state: 'hidden' });

    const compareDialog = page.getByRole('dialog', { name: '比较摆法' });
    await compareDialog.locator('.draft-choice-grid > button').nth(1).waitFor();
    const planASeats = Number((await page.locator('.project-count').innerText()).match(/(\d+)\s*座/)?.[1]);
    await compareDialog.locator('.draft-choice-grid > button').nth(1).click();
    await compareDialog.getByRole('button', { name: '另存为新稿' }).click();
    await compareDialog.waitFor({ state: 'hidden' });
    await button('已保存').waitFor();
    const planBName = await page.getByLabel('项目名称', { exact: true }).inputValue();
    const planBSeats = Number((await page.locator('.project-count').innerText()).match(/(\d+)\s*座/)?.[1]);

    // Switch back to Plan A (excluding the initial 0-item blank project that shares the default name).
    await button('项目库').click();
    await page.locator('.project-list article')
      .filter({ has: page.getByText('我的铺位', { exact: true }) })
      .filter({ hasNotText: '0 个对象' })
      .first()
      .getByRole('button', { name: '打开 / 重命名' }).click();
    await button('关闭项目库').click();
    await button('已保存').waitFor();

    const readDbTimestamps = () => page.evaluate(() => new Promise((resolve, reject) => {
      const req = indexedDB.open('canteen-layout-library', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('projects', 'readonly');
        const all = tx.objectStore('projects').getAll();
        all.onerror = () => reject(all.error);
        all.onsuccess = () => resolve(Object.fromEntries(all.result.map(r => [r.id, { name: r.project.name, updatedAt: r.project.updatedAt }])));
      };
    }));

    // Create an undo entry on Plan A so we verify undo history & active state stay intact after A/B export.
    const titleInput = page.getByLabel('项目名称', { exact: true });
    await titleInput.fill('我的铺位A');
    await button('已保存').waitFor();
    const undoDisabledBefore = await button('撤销').isDisabled();
    const redoDisabledBefore = await button('重做').isDisabled();
    const splitPressedBefore = await button('2D + 3D 分屏').getAttribute('aria-pressed');
    const dbBefore = await readDbTimestamps();
    assert.equal(undoDisabledBefore, false, '修改项目名后撤销应可用');
    const planBEntryBefore = Object.values(dbBefore).find(r => r.name === planBName);
    assert.ok(planBEntryBefore, '方案 B 应已存入 IndexedDB');

    await button('导出图片').click();
    await dialog.getByAltText('平面与立体合图预览').waitFor();
    await button('A/B 对比图').click();
    await dialog.getByAltText('A/B 对比图预览').waitFor();
    assert.equal(await dialog.getByLabel('对比方案 B').locator('option:checked').innerText(), planBName);
    const stripText = await dialog.locator('.compare-metrics-strip').innerText();
    assert.match(stripText, new RegExp(`A：${planASeats}\\s*座`));
    assert.match(stripText, new RegExp(`B：${planBSeats}\\s*座`));

    const compareDownloadPromise = page.waitForEvent('download');
    await dialog.getByRole('link', { name: '下载 PNG' }).click();
    const compareDownload = await compareDownloadPromise;
    assert.match(compareDownload.suggestedFilename(), /-AB对比-\d{8}\.png$/);
    const comparePng = await readFile(await compareDownload.path());
    assert.equal(comparePng.readUInt32BE(0), 0x89504e47);
    assert.deepEqual([comparePng.readUInt32BE(16), comparePng.readUInt32BE(20)], [2400, 1500]);

    await button('复制图片').click();
    await dialog.getByText('已复制图片，可以粘贴到聊天中').waitFor();
    assert.ok(await page.evaluate(async () => (await navigator.clipboard.read()).some(item => item.types.includes('image/png'))));

    await dialog.getByRole('button',{name:'关闭'}).click();
    await page.waitForTimeout(250);
    assert.equal(await titleInput.inputValue(), '我的铺位A');
    assert.equal(await button('撤销').isDisabled(), undoDisabledBefore);
    assert.equal(await button('重做').isDisabled(), redoDisabledBefore);
    assert.equal(await button('2D + 3D 分屏').getAttribute('aria-pressed'), splitPressedBefore);
    const dbAfter = await readDbTimestamps();
    assert.deepEqual(dbAfter, dbBefore, '导出 A/B 对比图不得改动当前方案或方案 B 的 IndexedDB updatedAt');
    assert.equal(await page.locator('[data-offscreen-stage]').count(), 0, '离屏 3D 舞台应已释放');

    await button('2D 平面').click();
    await button('导出图片').click();
    await dialog.getByAltText('平面图预览').waitFor();
    await page.evaluate(() => Object.defineProperty(navigator.clipboard,'write',{value:async () => { throw new DOMException('Denied','NotAllowedError'); }}));
    await button('复制图片').click();
    await dialog.getByText('当前浏览器未允许复制图片，可下载 PNG').waitFor();
    assert.ok(await dialog.getByRole('link',{name:'下载 PNG'}).isVisible());
    await dialog.getByRole('button',{name:'关闭'}).click();
    assert.equal(await button('2D 平面').getAttribute('aria-pressed'),'true');
    await page.setViewportSize({width:1100,height:800});
    assert.match(await page.locator('.footer-check-pill').innerText(), /体检与预算/);
    await page.locator('.footer-check-pill').click();
    await page.locator('.insights-dialog[open]').waitFor();
    console.log('PASS 空白铺位、预设修改、直出分屏、三视图合图、A/B 对比图、单图切换、PNG 下载与剪贴板');
  } finally { await context.close(); }
}
