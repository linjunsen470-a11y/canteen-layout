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

  // Verify parametric auto-layout engine & 3-variant comparison across formats & shapes
  const { buildAutoShopPlan, buildShopVariants, inferAutoSpecFromProject } = await load('autoShopLayout');
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
  const base = variants[0].spec;
  const conflicts = p => checkSpace(p, null).filter(issue => issue.type !== '参考净距');
  for (const [widthM, depthM, shape, kitchenSide] of [
    [5, 4.5, 'l-shape', 'rear'], [6, 5, 'l-shape', 'rear'], [8, 5, 'l-shape', 'rear'],
    [8.2, 4.5, 'rectangle', 'left'],
  ]) {
    const p = parseProject(buildAutoShopPlan({ ...base, widthM, depthM, shape, kitchenSide }));
    assert.deepEqual(conflicts(p), [], `${widthM} × ${depthM} ${shape}/${kitchenSide}`);
    assert.ok(p.items.some(i => i.name === '后厨单开门'));
    assert.ok(p.items.some(i => i.model === 'hood'));
  }

  // The original kitchen, calibrated image and surveyed fixtures survive a round trip.
  const surveyed = createCustomShopShell({ ...spec, widthM: 40, depthM: 8, shape: 'l-shape' });
  surveyed.underlay = { assetId: 'survey', name: '实测底图', pixelWidth: 1000, pixelHeight: 200,
    x: 0, y: 0, mmPerPixel: 40, rotation: 0, opacity: 0.5, hidden: false, locked: true };
  const column = { id: 'pillar', kind: 'column', name: '承重柱', x: 5800, y: 5250,
    w: 600, d: 600, h: 3000, color: '#aaaaaa', rotation: 0, locked: true, verification: 'confirmed' };
  surveyed.items.push(column);
  const original = structuredClone(surveyed);
  for (const option of buildShopVariants(inferAutoSpecFromProject(surveyed), surveyed)) {
    const variant = parseProject(option.project);
    assert.deepEqual([variant.width, variant.height], [40000, 8000]);
    assert.deepEqual(variant.outline, surveyed.outline);
    assert.deepEqual(variant.underlay, surveyed.underlay);
    assert.deepEqual(variant.items.filter(i => surveyed.items.some(s => i.id === s.id)), parseProject(surveyed).items);
    assert.ok(analyzeShop(variant).seats > 0);
    assert.deepEqual(conflicts(variant), []);
  }
  assert.deepEqual(surveyed, original);

  // Highest-capacity labels follow the actual results, including ties.
  const ranked = buildShopVariants({ ...base, widthM: 12, depthM: 9 });
  const counts = ranked.map(v => analyzeShop(v.project).seats);
  assert.ok(counts[2] > counts[1]);
  assert.equal(ranked[2].badge, '座位最多');
  assert.doesNotMatch(ranked[1].badge, /最多/);

  const furniture = (id, kind, x, y, w, d) => ({ id, name: id, kind, x, y, w, d, rotation: 0, h: 800, color: '#aa8866' });
  const aisle = { ...project, clearance: 800, items: [
    furniture('t1', 'table', 1700, 2000, 1200, 800), furniture('c1', 'chair', 2950, 2175, 450, 450),
    furniture('c2', 'chair', 4000, 2175, 450, 450), furniture('t2', 'table', 4500, 2000, 1200, 800),
  ], groups: [{ id: 'g1', name: 'A', members: ['t1', 'c1'] }, { id: 'g2', name: 'B', members: ['t2', 'c2'] }] };
  const fixedSeats = { ...aisle, width: 6000, height: 3000,
    items: aisle.items.map(i => ({ ...i, locked: i.kind === 'table', seats: i.kind === 'chair' ? 1 : 0 })) };
  const tied = buildShopVariants(inferAutoSpecFromProject(fixedSeats), fixedSeats);
  for (const v of tied) {
    assert.deepEqual(v.project.groups, fixedSeats.groups);
    assert.equal(analyzeShop(v.project).seats, 2);
    assert.equal(v.badge, '并列座位最多');
  }

  const { issues, clearances } = inspectSpace(aisle, null, true);
  assert.deepEqual(clearances.map(gap => gap.distance), [600]);
  assert.ok(issues.some(i => i.message.includes('600mm，小于参考 800mm')));
  console.log('PASS 窄铺后厨、同铺实测条件、实排座位排名与椅背净距');

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
