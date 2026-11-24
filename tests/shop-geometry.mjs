import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false, server: { middlewareMode: true }, appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const load = name => server.ssrLoadModule('/src/' + name + '.ts');
  const { shopTemplates, createCustomShopShell, buildPerimeterWalls } = await load('shopTemplates');
  const { analyzeShop } = await load('shopAnalytics');
  const { parseProject } = await load('projectIO');
  const { checkSpace } = await load('spaceChecks');
  const { fitCombo, comboPresets } = await load('combos');
  const expectedSeats = [27, 16, 48, 31];
  for (const [index, template] of shopTemplates.entries()) {
    const project = parseProject(JSON.parse(JSON.stringify(template.build())));
    assert.equal(analyzeShop(project).seats, expectedSeats[index], template.name);
    assert.deepEqual(checkSpace(project, null).filter(i => i.type !== '参考净距'), [], template.name);
  }
  const spec = {
    name: '实测铺位', widthM: 10, depthM: 8, ceilingM: 3.2, shape: 'rectangle',
    floorMaterial: 'oak-wood', wallMaterial: 'warm-cream', lightingPreset: 'warm-dining',
    addWalls: true, addStorefront: true, addZones: true,
  };
  for (const widthM of [4, 4.5, 10, 60]) {
    for (const shape of ['rectangle', 'l-shape']) {
      const shell = parseProject(createCustomShopShell({ ...spec, widthM, shape }));
      assert.equal(shell.items.filter(i => i.kind === 'door').length, 1);
      assert.deepEqual(buildPerimeterWalls(shell), []);
      const missing = shell.items.find(i => i.kind === 'wall' && !shell.items.some(o => o.wallId === i.id));
      assert.equal(buildPerimeterWalls({ ...shell, items: shell.items.filter(i => i !== missing) }).length, 1);
    }
  }
  const project = createCustomShopShell(spec);
  const combo = comboPresets[0], center = { x: 5000, y: 4000 };
  const first = fitCombo(project, combo, center, true);
  const occupied = { ...project, items: [...project.items, ...first] };
  assert.throws(() => fitCombo(occupied, combo, center, false), /空间不足/);
  const second = fitCombo(occupied, combo, center, true);
  assert.notDeepEqual([first[0].x, first[0].y], [second[0].x, second[0].y]);
  assert.deepEqual(checkSpace({ ...occupied, items: [...occupied.items, ...second] }, null)
    .filter(i => i.type !== '参考净距'), []);
  assert.throws(() => fitCombo(project, combo, { x: 0, y: 0 }, false), /空间不足/);

  // Verify parametric auto-layout engine & 3-variant comparison across formats & shapes
  const { buildAutoShopPlan, buildShopVariants } = await load('autoShopLayout');
  for (const businessType of ['bistro', 'cafe', 'restaurant', 'canteen']) {
    for (const shape of ['rectangle', 'l-shape']) {
      const autoProj = parseProject(buildAutoShopPlan({
        name: `自动生成-${businessType}`,
        widthM: 10.8, depthM: 7.8, ceilingM: 3.2, shape,
        businessType, strategy: 'balanced', kitchenSide: 'rear',
        floorMaterial: 'terrazzo', wallMaterial: 'warm-cream', lightingPreset: 'warm-dining',
      }));
      const stats = analyzeShop(autoProj);
      assert.ok(stats.seats >= 8, `${businessType}/${shape} seats=${stats.seats}`);
      assert.ok(stats.estimatedPowerKw > 0, `${businessType}/${shape} powerKw`);
      assert.deepEqual(checkSpace(autoProj, null).filter(i => i.type !== '参考净距'), [], `${businessType}/${shape} collision-free`);
    }
  }
  const variants = buildShopVariants({
    name: '松间手作面馆', widthM: 10.8, depthM: 7.8, ceilingM: 3.2, shape: 'rectangle',
    businessType: 'bistro', strategy: 'balanced', kitchenSide: 'rear',
    floorMaterial: 'terrazzo', wallMaterial: 'warm-cream', lightingPreset: 'warm-dining',
  });
  assert.equal(variants.length, 3);
  for (const v of variants) {
    assert.ok(analyzeShop(v.project).seats >= 12, v.title);
    assert.deepEqual(checkSpace(v.project, null).filter(i => i.type !== '参考净距'), [], v.title);
  }
  const examplePkg = JSON.parse(fs.readFileSync(new URL('../examples/songjian-noodle-bistro.canteen.json', import.meta.url), 'utf8'));
  assert.equal(examplePkg.format, 'canteen-layout-package');
  assert.equal(examplePkg.version, 1);
  const exampleProject = parseProject(examplePkg.project);
  assert.equal(exampleProject.name, '松间手作面馆');
  const exampleStats = analyzeShop(exampleProject);
  assert.ok(exampleStats.seats >= 18, `example seats=${exampleStats.seats}`);
  assert.ok(exampleStats.estimatedPowerKw >= 15, `example power=${exampleStats.estimatedPowerKw}`);
  assert.deepEqual(checkSpace(exampleProject, null).filter(i => i.type !== '参考净距'), [], 'flagship example');
  console.log('PASS 模板座位与碰撞、窄铺入口、重复围墙、组合摆放、参数化自动生成、三摆法对比与旗舰示范包');
} finally {
  await server.close();
}
