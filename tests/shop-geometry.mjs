import assert from 'node:assert/strict';
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
  console.log('PASS 模板座位与碰撞、窄铺入口、重复围墙、组合摆放与边界');
} finally {
  await server.close();
}
