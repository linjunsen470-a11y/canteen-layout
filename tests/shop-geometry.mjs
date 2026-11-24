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
  const { checkSpace, inspectSpace } = await load('spaceChecks');
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

  const measured = parseProject(createCustomShopShell({ ...spec, shape: 'l-shape', notchWidthM: 2.15, notchDepthM: 1.76, addZones: false, addStorefront: false }));
  assert.deepEqual(measured.outline[3], { x: 7850, y: 6240 });
  assert.deepEqual(measured.items.map(i => i.kind), Array(6).fill('wall'));
  assert.deepEqual(checkSpace(measured, null).filter(i => i.type !== '参考净距'), []);
  assert.throws(() => createCustomShopShell({ ...spec, shape: 'l-shape', notchWidthM: 11 }), /缺口/);

  const furniture = (id, kind, x, y, w, d) => ({ id, name: id, kind, x, y, w, d, rotation: 0, h: 800, color: '#aa8866' });
  const aisle = { ...project, clearance: 800, items: [
    furniture('t1', 'table', 1700, 2000, 1200, 800), furniture('c1', 'chair', 2950, 2175, 450, 450),
    furniture('c2', 'chair', 4000, 2175, 450, 450), furniture('t2', 'table', 4500, 2000, 1200, 800),
  ], groups: [{ id: 'g1', name: 'A', members: ['t1', 'c1'] }, { id: 'g2', name: 'B', members: ['t2', 'c2'] }] };
  const { issues, clearances } = inspectSpace(aisle, null, true);
  assert.deepEqual(clearances.map(gap => gap.distance), [600]);
  assert.ok(issues.some(i => i.message.includes('600mm，小于参考 800mm')));
  console.log('PASS 实测 L 形缺口与椅背净距');

  const examplePkg = JSON.parse(fs.readFileSync(new URL('../examples/songjian-noodle-bistro.canteen.json', import.meta.url), 'utf8'));
  assert.equal(examplePkg.format, 'canteen-layout-package');
  assert.equal(examplePkg.version, 1);
  const exampleProject = parseProject(examplePkg.project);
  assert.equal(exampleProject.name, '松间手作面馆');
  const exampleStats = analyzeShop(exampleProject);
  assert.ok(exampleStats.seats >= 18, `example seats=${exampleStats.seats}`);
  assert.ok(exampleStats.estimatedPowerKw >= 15, `example power=${exampleStats.estimatedPowerKw}`);
  assert.deepEqual(checkSpace(exampleProject, null).filter(i => i.type !== '参考净距'), [], 'flagship example');
  console.log('PASS 模板座位与碰撞、窄铺入口、重复围墙、组合摆放与旗舰示范包');
} finally {
  await server.close();
}
