import assert from 'node:assert/strict';
import { createServer } from 'vite';

export async function testOffscreenRender(browser) {
  const devServer = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'silent',
  });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  try {
    await devServer.listen();
    const { port } = devServer.httpServer.address();
    const url = `http://127.0.0.1:${port}/`;
    const button = name => page.getByRole('button', { name, exact: true });

    await page.goto(url);
    await button('已保存').waitFor();

    // Open the first demo shop template so live Scene3D & PlanEditor render it in split view.
    await button('新建铺位').click();
    await button('示范案例参考').click();
    await page.locator('.template-card').first().click();
    await page.locator('.shop-wizard-dialog').waitFor({ state: 'hidden' });
    await button('已保存').waitFor();

    // 1. Capture live birdseye & 2D plan PNG via the existing ImageExport flow.
    await button('导出图片').click();
    const dialog = page.getByRole('dialog', { name: '导出图片' });
    await dialog.getByAltText('平面与立体合图预览').waitFor();
    await button('鸟瞰图').click();
    const liveBirdseye = await dialog.getByAltText('鸟瞰图预览').getAttribute('src');
    await button('平面图').click();
    const livePlan = await dialog.getByAltText('平面图预览').getAttribute('src');
    await dialog.getByRole('button', { name: '关闭' }).click();
    assert.ok(liveBirdseye?.startsWith('data:image/png;base64,'));
    assert.ok(livePlan?.startsWith('data:image/png;base64,'));

    // 2. Compare live vs offscreen birdseye & 2D plan on the same active demo shop.
    const comparison = await page.evaluate(async ({ liveBird, liveFlat }) => {
      const [{ useStore }, { withOffscreenStage }, { capturePlanFromProject }] = await Promise.all([
        import('/src/store.ts'),
        import('/src/OffscreenStage.tsx'),
        import('/src/offscreenPlan.tsx'),
      ]);

      async function metrics(dataUrl, fixedWhiteBg) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('PNG 解码失败'));
          img.src = dataUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const bgR = fixedWhiteBg ? 255 : data[0];
        const bgG = fixedWhiteBg ? 255 : data[1];
        const bgB = fixedWhiteBg ? 255 : data[2];
        let nonBlank = 0;
        const total = canvas.width * canvas.height;
        for (let i = 0; i < data.length; i += 4) {
          if (Math.abs(data[i] - bgR) + Math.abs(data[i + 1] - bgG) + Math.abs(data[i + 2] - bgB) > 18) {
            nonBlank++;
          }
        }
        return { width: canvas.width, height: canvas.height, ratio: nonBlank / total };
      }

      const project = useStore.getState().project;
      const offBird = await withOffscreenStage(project, stage => stage.captureShot('birdseye'));
      const offFlat = await capturePlanFromProject(project, { header: true });

      return {
        liveBird: await metrics(liveBird, false),
        offBird: await metrics(offBird, false),
        liveFlat: await metrics(liveFlat, true),
        offFlat: await metrics(offFlat, true),
        leftoverStages: document.querySelectorAll('[data-offscreen-stage]').length,
      };
    }, { liveBird: liveBirdseye, liveFlat: livePlan });

    assert.equal(comparison.leftoverStages, 0, '离屏 3D 舞台使用后应完全卸载');
    assert.deepEqual(
      [comparison.offBird.width, comparison.offBird.height],
      [comparison.liveBird.width, comparison.liveBird.height],
      '离屏鸟瞰与实时鸟瞰 PNG 尺寸应一致',
    );
    assert.ok(
      comparison.offBird.ratio > 0.05 && Math.abs(comparison.offBird.ratio - comparison.liveBird.ratio) < 0.02,
      `离屏鸟瞰与实时鸟瞰非空白像素比例差应 < 2% (live=${comparison.liveBird.ratio.toFixed(4)}, off=${comparison.offBird.ratio.toFixed(4)})`,
    );
    assert.deepEqual(
      [comparison.offFlat.width, comparison.offFlat.height],
      [comparison.liveFlat.width, comparison.liveFlat.height],
      '离屏平面与实时平面 PNG 尺寸应一致',
    );
    assert.ok(
      comparison.offFlat.ratio > 0.05 && Math.abs(comparison.offFlat.ratio - comparison.liveFlat.ratio) < 0.02,
      `离屏平面与实时平面非空白像素比例差应 < 2% (live=${comparison.liveFlat.ratio.toFixed(4)}, off=${comparison.offFlat.ratio.toFixed(4)})`,
    );

    // 3. Verify read-only isolation (store, undo/redo stacks, selection, IndexedDB updatedAt)
    //    when rendering a completely different project B, plus underlay asset validation.
    const isolation = await page.evaluate(async () => {
      const [
        { useStore },
        { saveProject },
        { listProjects, writeAssets },
        { shopTemplates },
        { withOffscreenStage },
        { capturePlanFromProject },
      ] = await Promise.all([
        import('/src/store.ts'),
        import('/src/projectSession.ts'),
        import('/src/projectLibrary.ts'),
        import('/src/shopTemplates.ts'),
        import('/src/OffscreenStage.tsx'),
        import('/src/offscreenPlan.tsx'),
      ]);

      // Seed active store with non-empty undo history & selection, and flush save to IndexedDB.
      const s = useStore.getState();
      const firstTable = s.project.items.find(i => i.kind === 'table');
      s.selectMany(firstTable ? [firstTable.id] : []);
      s.commit({ ...s.project, name: s.project.name + ' · 活跃编辑中' });
      await saveProject();

      const snapshotStore = () => {
        const cur = useStore.getState();
        return {
          project: JSON.stringify(cur.project),
          pastLen: cur.past.length,
          futureLen: cur.future.length,
          selected: cur.selected,
          selectedIds: [...cur.selectedIds],
        };
      };
      const snapshotDb = async () => {
        const rows = await listProjects();
        return Object.fromEntries(rows.map(r => [r.project.id, r.project.updatedAt]));
      };

      const beforeStore = snapshotStore();
      const beforeDb = await snapshotDb();

      // Render a distinct project B offscreen (3D birdseye + interior + 2D bare plan).
      const projectB = shopTemplates[1].build();
      const shotsB = await withOffscreenStage(projectB, stage => ({
        birdseye: stage.captureShot('birdseye'),
        interior: stage.captureShot('interior'),
      }));
      const planB = await capturePlanFromProject(projectB, { header: false });

      // Wait briefly to make sure no delayed autosave was triggered.
      await new Promise(resolve => setTimeout(resolve, 250));
      const afterStore = snapshotStore();
      const afterDb = await snapshotDb();

      // Underlay missing asset must reject with the same user-facing error on both 3D & 2D.
      const missingUnderlay = {
        ...projectB,
        underlay: {
          assetId: 'missing-asset-id',
          name: 'missing.png',
          pixelWidth: 8,
          pixelHeight: 8,
          x: 0,
          y: 0,
          mmPerPixel: 100,
          rotation: 0,
          opacity: 0.5,
          hidden: false,
          locked: false,
        },
      };
      let err3d = '';
      try { await withOffscreenStage(missingUnderlay, stage => stage.captureShot('birdseye')); }
      catch (e) { err3d = e instanceof Error ? e.message : String(e); }

      let err2d = '';
      try { await capturePlanFromProject(missingUnderlay); }
      catch (e) { err2d = e instanceof Error ? e.message : String(e); }

      // Hidden missing underlay should succeed on both 3D & 2D.
      const hiddenUnderlay = { ...missingUnderlay, underlay: { ...missingUnderlay.underlay, hidden: true } };
      const hidden3d = await withOffscreenStage(hiddenUnderlay, stage => stage.captureShot('birdseye'));
      const hidden2d = await capturePlanFromProject(hiddenUnderlay, { header: false });

      // Valid underlay stored in IndexedDB should load & render cleanly on both 3D & 2D.
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#c84b31';
      ctx.fillRect(0, 0, 8, 8);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const assetId = 'offscreen-underlay-test-asset';
      await writeAssets([{ id: assetId, name: 'test-underlay.png', blob }]);
      const validUnderlay = { ...missingUnderlay, underlay: { ...missingUnderlay.underlay, assetId } };
      const valid3d = await withOffscreenStage(validUnderlay, stage => stage.captureShot('birdseye'));
      const valid2d = await capturePlanFromProject(validUnderlay, { header: false });

      return {
        beforeStore,
        afterStore,
        beforeDb,
        afterDb,
        shotsBOk: shotsB.birdseye.startsWith('data:image/png;base64,') && shotsB.interior.startsWith('data:image/png;base64,'),
        planBOk: planB.startsWith('data:image/png;base64,'),
        err3d,
        err2d,
        hiddenOk: hidden3d.startsWith('data:image/png;base64,') && hidden2d.startsWith('data:image/png;base64,'),
        validOk: valid3d.startsWith('data:image/png;base64,') && valid2d.startsWith('data:image/png;base64,'),
        leftoverStages: document.querySelectorAll('[data-offscreen-stage]').length,
      };
    });

    assert.ok(isolation.shotsBOk, '离屏应成功拍摄项目 B 的鸟瞰与室内图');
    assert.ok(isolation.planBOk, '离屏应成功生成项目 B 的无页眉平面图');
    assert.ok(isolation.beforeStore.pastLen >= 1, '测试前置应包含非空撤销栈');
    assert.ok(isolation.beforeStore.selectedIds.length >= 1, '测试前置应包含非空选区');
    assert.deepEqual(isolation.afterStore, isolation.beforeStore, '离屏渲染不得修改活动项目、撤销栈或选区');
    assert.deepEqual(isolation.afterDb, isolation.beforeDb, '离屏渲染不得触发保存或改变 IndexedDB 中的 updatedAt');
    assert.match(isolation.err3d, /底图未加载完成或资产缺失/);
    assert.match(isolation.err2d, /底图未加载完成或资产缺失/);
    assert.ok(isolation.hiddenOk, '隐藏底图时离屏 3D/2D 应正常出图');
    assert.ok(isolation.validOk, '资产库中存在底图时离屏 3D/2D 应正常出图');
    assert.equal(isolation.leftoverStages, 0, '异常与正常路径后均不得残留离屏 Canvas');
    assert.deepEqual(errors, [], '离屏渲染过程不得产生未捕获页面错误');

    console.log('PASS 只读离屏 3D/2D 渲染像素一致性、状态隔离、IndexedDB 不变与底图资产校验');
  } finally {
    await context.close();
    await devServer.close();
  }
}
