import assert from 'node:assert/strict';
import { testBasicLayout } from './basic-layout.mjs';
import fs from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false, server: { middlewareMode: true }, appType: 'custom',
  optimizeDeps: { noDiscovery: true },
});
try {
  const load = name => server.ssrLoadModule('/src/' + name + '.ts');
  await testBasicLayout(load, () => server.ssrLoadModule('/src/SceneCapture.tsx'));
  const { shopTemplates, createCustomShopShell, buildPerimeterWalls } = await load('shopTemplates');
  const { analyzeShop } = await load('shopAnalytics');
  const { parseProject } = await load('projectIO');
  const { checkSpace, inspectSpace } = await load('spaceChecks');
  const { fitCombo, comboPresets } = await load('combos');
  const { checkSketchEdge } = await load('sketchGeometry');
  for (const lastX of [-2000, 2000]) {
    const path = [[0, 0], [4000, 0], [4000, 3000], [lastX, 3000], [lastX, 0]].map(([x, y]) => ({ x, y }));
    assert.throws(() => checkSketchEdge(path, path[0], true), /末段墙与首段墙共线/);
  }
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

  const { createSurveyShop, rectangleLegs, autoCloseLegs, surveyWall, cornerDistance, openingOffset } = await load('interiorSurvey');
  const { siteArea, planningArea } = await load('site');
  const { wallPoint, syncStructure } = await load('structure');
  const { alignUnderlay, imageToWorld } = await load('siteExtras');
  const { bomCSV } = await load('shopAnalytics');
  const { wallProfiles } = await load('wallJoints');
  const rect = parseProject(createSurveyShop('现场矩形', rectangleLegs(6000,4000), 200, 3200));
  assert.deepEqual([rect.width,rect.height,siteArea(rect),planningArea(rect)], [6400,4400,28160000,24000000]);
  assert.equal(analyzeShop(rect).areaSqm, 24);
  assert.match(bomCSV(rect,analyzeShop(rect)), /现场记录净面积 24.00㎡.*外轮廓面积 28.16㎡/);
  const lLegs = [['right',6000],['down',2500],['left',2000],['down',1500],['left',4000],['up',4000]]
    .map(([direction,length])=>({direction,length}));
  // Auto-close should complete the last 2 legs of an L-shape cleanly
  assert.deepEqual(autoCloseLegs(lLegs.slice(0, 4)), lLegs);
  const lShop = createSurveyShop('现场凹角',lLegs,201,3200);
  const ccw = createSurveyShop('反向',lLegs.toReversed().map(leg=>({
    ...leg,direction:({left:'right',right:'left',up:'down',down:'up'})[leg.direction]})),201,3200);
  for (const p of [rect,lShop,ccw]) {
    assert.deepEqual(buildPerimeterWalls(p), []);
    assert.deepEqual(checkSpace(p,null).filter(i=>i.type!=='参考净距'), []);
    const profiles = wallProfiles(p);
    p.items.forEach((wall,i)=>{
      const face=surveyWall(p,wall), a=p.survey.corners[i], b=p.survey.corners[(i+1)%p.items.length];
      assert.equal(face.end-face.start,Math.hypot(b.x-a.x,b.y-a.y));
      // Independent oracle: both surveyed corners must appear on the rendered mitered wall.
      const axis=wall.rotation*Math.PI/180;
      const vertices=profiles.get(wall.id).map(v=>({x:wall.x+wall.w/2+v.x*Math.cos(axis)-v.y*Math.sin(axis),
        y:wall.y+wall.d/2+v.x*Math.sin(axis)+v.y*Math.cos(axis)}));
      for(const pt of [a,b]) assert.ok(vertices.some(v=>Math.hypot(v.x-pt.x,v.y-pt.y)<1e-6));
      const safeGap = Math.max(100, face.minStartGap);
      const offset=openingOffset(face,safeGap,250,false);
      assert.equal(openingOffset(face,face.end-face.start-safeGap-250,250,true),offset);
      // Every offset returned by openingOffset MUST be accepted by syncStructure()
      const withDoor = syncStructure({ ...p, items: [...p.items, { id: 'test-door-' + i, kind: 'door', model: 'door', name: '测试门', w: 250, d: wall.d, h: 2100, x: 0, y: 0, rotation: wall.rotation, wallId: wall.id, offset, sill: 0, color: '#aa8866' }] });
      assert.equal(withDoor.items.find(x => x.id === 'test-door-' + i).offset, offset);
    });
  }
  // PR #4 concave-corner regression: 100mm from concave corner on 200mm wall must be rejected cleanly by openingOffset before syncStructure
  const l200 = createSurveyShop('L200', lLegs, 200, 3200);
  const concaveWall = l200.items[2];
  const concaveFace = surveyWall(l200, concaveWall);
  assert.ok(concaveFace.minEndGap >= 150, `expected minEndGap>=150, got ${concaveFace.minEndGap}`);
  assert.throws(() => openingOffset(concaveFace, 100, 900, true), /墙角结构限制/);
  const validConcaveOffset = openingOffset(concaveFace, concaveFace.minEndGap, 900, true);
  assert.doesNotThrow(() => syncStructure({ ...l200, items: [...l200.items, { id: 'concave-door', kind: 'door', model: 'door', name: '凹角旁门', w: 900, d: 200, h: 2100, x: 0, y: 0, rotation: concaveWall.rotation, wallId: concaveWall.id, offset: validConcaveOffset, sill: 0, color: '#aa8866' }] }));

  const recesses = [['right',6000],['down',4000],['left',1800],['up',500],['left',800],
    ['down',500],['left',1000],['up',700],['left',900],['down',700],['left',1500],['up',4000]]
    .map(([direction,length])=>({direction,length}));
  const stepped = createSurveyShop('双凹位',recesses,200,3200);
  assert.equal(planningArea(stepped),22970000);
  assert.throws(()=>createSurveyShop('凹位宽度不足',recesses,450,3200),/相交|凹位|重叠|重合/);
  assert.equal(planningArea(lShop),21000000);
  assert.equal(planningArea(ccw),21000000);
  assert.throws(()=>createSurveyShop('未闭合',lLegs.map((l,i)=>i===4?{...l,length:3960}:l),200,3200), /横向差 40 mm/);
  const wall=rect.items[0], face=surveyWall(rect,wall);
  const offset=openingOffset(face,850,900,false);
  assert.equal(openingOffset(face,4250,900,true),offset);
  assert.equal(cornerDistance(face,offset,900,false),850);
  assert.equal(wallPoint(wall,offset).x-face.a.x,850);
  assert.throws(()=>openingOffset(face,5800,900,false),/洞口超出/);
  assert.equal(surveyWall({...rect,items:rect.items.map((w,i)=>i===1?{...w,d:250}:w)},wall),undefined);
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(rect))).survey,rect.survey);
  assert.throws(()=>parseProject({...rect,survey:{...rect.survey,wallIds:[]}}),/测量记录/);
  const aligned=alignUnderlay({x:280,y:400,rotation:90,mmPerPixel:10},[{x:10,y:20},{x:10,y:80}],face.a,face.b);
  for (const [pixel,pt] of [[{x:10,y:20},face.a],[{x:10,y:80},face.b]]) {
    const actual=imageToWorld(aligned,pixel);
    assert.ok(Math.hypot(pt.x-actual.x,pt.y-actual.y)<1e-6);
  }
  console.log('PASS 内净尺寸、反向与奇数墙厚、凹角门洞一致校验、自动闭合、净面积、双端洞口及底图配准');
  const furniture = (id, kind, x, y, w, d) => ({ id, name: id, kind, x, y, w, d, rotation: 0, h: 800, color: '#aa8866' });
  const aisle = { ...project, clearance: 800, items: [
    furniture('t1', 'table', 1700, 2000, 1200, 800), furniture('c1', 'chair', 2950, 2175, 450, 450),
    furniture('c2', 'chair', 4000, 2175, 450, 450), furniture('t2', 'table', 4500, 2000, 1200, 800),
  ], groups: [{ id: 'g1', name: 'A', members: ['t1', 'c1'] }, { id: 'g2', name: 'B', members: ['t2', 'c2'] }] };
  const { issues, clearances } = inspectSpace(aisle, null, true);
  assert.deepEqual(clearances.map(gap => gap.distance), [600]);
  assert.ok(issues.some(i => i.message.includes('600mm，小于参考 800mm')));
  console.log('PASS 实测 L 形缺口与椅背净距');

  // Verify non-destructive parametric concept planner on arbitrary surveyed rectangular & L-shaped shops
  const { generateConceptLayout, defaultConceptOptions } = await load('conceptPlanner');
  const arbitraryShells = [
    createSurveyShop('宽面铺', rectangleLegs(11400, 6800), 200, 3400),
    createSurveyShop('深窄铺', rectangleLegs(6200, 10800), 200, 3200),
    createSurveyShop('社区小铺', rectangleLegs(7200, 5600), 200, 3200),
    createSurveyShop('实测L铺', [['right',11000],['down',4500],['left',3500],['down',3500],['left',7500],['up',8000]].map(([direction,length])=>({direction,length})), 200, 3400),
  ];
  for (const shell of arbitraryShells) {
    // Add an existing column & exterior door to verify strict shell preservation
    const frontWall = shell.items.find(w => w.kind === 'wall' && Math.abs(w.y - (shell.height - 200)) < 300) ?? shell.items[0];
    const withObstacles = syncStructure({
      ...shell,
      items: [
        ...shell.items,
        { id: 'orig-door', kind: 'door', model: 'glass-double-door', name: '原有大门', w: 1400, d: frontWall.d, h: 2200, x: 0, y: 0, rotation: frontWall.rotation, wallId: frontWall.id, offset: Math.round((frontWall.w - 1400) / 2), sill: 0, color: '#455961', flipped: true },
        { id: 'orig-col', kind: 'column', model: 'column', name: '原有承重柱', w: 500, d: 500, h: 3200, x: 2600, y: 3600, rotation: 0, color: '#8a8d89' },
      ],
    });
    for (const side of ['rear', 'left', 'right', 'none']) {
      const opts = { ...defaultConceptOptions('bistro'), kitchenSide: side, kitchenRatioPct: 32 };
      const { project: out, estimate } = generateConceptLayout(withObstacles, opts);
      assert.deepEqual(out.survey, withObstacles.survey, `${shell.name}/${side} survey preserved`);
      assert.deepEqual(out.outline, withObstacles.outline, `${shell.name}/${side} outline preserved`);
      assert.ok(out.items.some(i => i.id === 'orig-door'), `${shell.name}/${side} door preserved`);
      assert.ok(out.items.some(i => i.id === 'orig-col'), `${shell.name}/${side} column preserved`);
      assert.equal(estimate.criticalConflicts, 0, `${shell.name}/${side} zero conflicts`);
      assert.ok(estimate.seats >= 4, `${shell.name}/${side} placed seats=${estimate.seats}`);
      if (side !== 'none') {
        assert.ok(Math.abs(estimate.kitchenPct - 32) <= 6, `${shell.name}/${side} kitchenPct=${estimate.kitchenPct}`);
      } else {
        assert.equal(estimate.kitchenAreaSqm, 0);
      }
    }
  }
  console.log('PASS 任意直角实测铺位（矩形/深窄/L形）智能分区估算与原壳体零破坏');

  const { footprint, polygonDistance } = await load('spatial');
  const makeShop = (width, depth) => createSurveyShop('试排验收', rectangleLegs(width, depth), 200, 3200);
  const estimate = (p, options = {}) => generateConceptLayout(p, { ...defaultConceptOptions(), ...options });
  const shell = makeShop(6200, 5000);
  const originalZone = { ...furniture('旧分区', 'zone', 200, 200, 4200, 3200), h: 0 };
  const pillar = { ...furniture('挡住厨具起点的柱子', 'column', 350, 360, 450, 450), zoneId: originalZone.id };
  const innerWall = furniture('内墙', 'wall', 900, 3200, 3300, 200);
  const partition = furniture('隔断', 'partition', 1000, 4200, 2200, 100);
  const source = parseProject({ ...shell, items: [...shell.items, originalZone, pillar, innerWall, partition] });
  const before = JSON.stringify(source);
  const planned = estimate(source);
  assert.equal(JSON.stringify(source), before, '预览不得修改原项目');
  const reopened = parseProject(JSON.parse(JSON.stringify(planned.project)));
  assert.equal(reopened.items.find(i => i.id === pillar.id).zoneId, undefined);
  for (const id of [innerWall.id, partition.id]) {
    assert.deepEqual(reopened.items.find(i => i.id === id), source.items.find(i => i.id === id));
  }
  assert.deepEqual(planned.estimate.replacementNames, [originalZone.name]);
  assert.equal(planned.estimate.criticalConflicts, 0);
  for (const kind of ['sink', 'fridge', 'stove']) {
    assert.ok(reopened.items.some(i => i.kind === kind && i.model !== 'hood'), kind);
  }
  const tight = estimate(makeShop(2400, 3000), { kitchenRatioPct: 20 });
  assert.ok(tight.estimate.warnings.some(w => w.includes('未摆入') && w.includes('炉')));

  for (const side of ['left', 'right']) {
    const r = estimate(makeShop(4000, 7000), { kitchenRatioPct: 20, kitchenSide: side });
    assert.equal(r.estimate.kitchenPct, 20);
    assert.equal(r.estimate.kitchenAreaSqm, 5.6);
  }
  const slanted = parseProject({ ...shell, survey: undefined, items: [], outline: [
    { x: 0, y: 0 }, { x: 6000, y: 0 }, { x: 4000, y: 5000 }, { x: 0, y: 5000 },
  ] });
  assert.throws(() => estimate(slanted), /斜边/);

  for (const [aisleMm, seatingStyle] of [[800, 'balanced'], [950, 'canteen-bench'], [1100, 'compact']]) {
    const { project, estimate: facts } = estimate(makeShop(10000, 8000), { aisleMm, seatingStyle, kitchenSide: 'none' });
    const groups = project.groups.map(g => g.members.map(id => footprint(project.items.find(i => i.id === id))));
    assert.ok(groups.length >= 2);
    let measured = Infinity;
    for (let i = 0; i < groups.length; i++) {
      for (const other of groups.slice(0, i)) {
        for (const a of groups[i]) for (const b of other) measured = Math.min(measured, polygonDistance(a, b).distance);
      }
    }
    assert.ok(measured >= aisleMm - 1e-6);
    assert.ok(Math.abs(facts.nearestTables.distance - measured) < 1e-6);
  }
  console.log('PASS 分区引用往返、固定隔断、带柱排厨与缺件、左右分区对称、斜边拦截及桌组实测净距');

  // Verify surveyed inner-corner placement for columns & utilities (CW + CCW)
  const { surveyWallInwardPoint } = await load('interiorSurvey');
  for (const p of [rect, lShop, ccw]) {
    const w0 = p.items[0];
    const d0 = surveyWall(p, w0);
    const flushPos = surveyWallInwardPoint(d0, 1000, 0, 500, 500, false);
    const midPos = surveyWallInwardPoint(d0, 1000, 1200, 500, 500, true);
    for (const pos of [flushPos, midPos]) {
      const col = { id: 'col-check', kind: 'column', model: 'column', name: '柱', x: pos.x, y: pos.y, w: 500, d: 500, h: 3200, rotation: 0, color: '#8a8d89' };
      assert.deepEqual(checkSpace({ ...p, items: [...p.items, col] }, null).filter(i => i.type !== '参考净距'), [], `${p.name} column placement`);
    }
    assert.throws(() => surveyWallInwardPoint(d0, d0.end - d0.start, 0, 500, 500, false), /超出本段内净长/);
  }

  // Verify 3D smart front-facing wall cutaway detection & birdseye decor hiding
  const { computeFrontFacingWallIds, computeBirdseyeHiddenItemIds } = await load('wallVisibility3D');
  const frontRight = computeFrontFacingWallIds(rect, { x: 12, z: 10 });
  assert.ok(frontRight.has(rect.items[1].id) && frontRight.has(rect.items[2].id), 'front-right camera should cutaway right & bottom walls');
  assert.ok(!frontRight.has(rect.items[0].id) && !frontRight.has(rect.items[3].id), 'front-right camera should keep top & left walls full height');
  const backLeft = computeFrontFacingWallIds(rect, { x: -6, z: -6 });
  assert.ok(backLeft.has(rect.items[0].id) && backLeft.has(rect.items[3].id), 'back-left camera should cutaway top & left walls');
  const noodle = shopTemplates[0].build();
  const birdHidden = computeBirdseyeHiddenItemIds(noodle, { x: 18, z: 16 });
  const frontSign = noodle.items.find(i => i.model === 'shop-sign');
  const rightArt = noodle.items.find(i => i.model === 'wall-art');
  const rearMenu = noodle.items.find(i => i.model === 'menu-board');
  assert.ok(frontSign && birdHidden.has(frontSign.id), 'birdseye capture must hide storefront sign along hidden front wall');
  assert.ok(rightArt && birdHidden.has(rightArt.id), 'birdseye capture must hide wall art along hidden right wall');
  assert.ok(rearMenu && !birdHidden.has(rearMenu.id), 'birdseye capture must keep rear wall menu board visible');

  // Verify concept planner optional open-kitchen partition & schematic storefront openings
  const bareShell = makeShop(9600, 7200);
  const fullSchematic = estimate(bareShell, { includePartition: true, includeStorefront: true });
  const parsedSchematic = parseProject(JSON.parse(JSON.stringify(fullSchematic.project)));
  assert.equal(fullSchematic.estimate.criticalConflicts, 0);
  assert.ok(parsedSchematic.items.some(i => i.kind === 'partition'), 'should add open-kitchen partition');
  assert.ok(parsedSchematic.items.some(i => i.kind === 'door'), 'should add schematic storefront door when none exists');
  // When a door already exists, includeStorefront must NOT add extra doors
  const alreadyHasDoor = estimate(parsedSchematic, { includeStorefront: true });
  assert.equal(alreadyHasDoor.project.items.filter(i => i.kind === 'door').length, parsedSchematic.items.filter(i => i.kind === 'door').length);
  // Schematic items are regenerated, not frozen as obstacles: re-running without the options removes them…
  assert.ok(parsedSchematic.items.filter(i => i.kind === 'partition' || i.kind === 'door').every(i => i.generated === 'concept'), 'schematic items carry generated flag through parseProject');
  const rerunPlain = estimate(parsedSchematic, {});
  assert.ok(!rerunPlain.project.items.some(i => i.generated === 'concept'), 're-run without options should drop schematic partition/door/window');
  // …but once the owner locks them they are kept as real fixed items.
  const lockedSchematic = { ...parsedSchematic, items: parsedSchematic.items.map(i => i.generated === 'concept' ? { ...i, locked: true } : i) };
  const rerunLocked = estimate(lockedSchematic, {});
  assert.equal(rerunLocked.project.items.filter(i => i.generated === 'concept').length, lockedSchematic.items.filter(i => i.generated === 'concept').length, 'locked schematic items survive re-run');
  // openingSlot must honour surveyed inner-corner bounds
  const { openingSlot } = await load('structure');
  const slotWall = { id: 'sw', kind: 'wall', name: '墙', x: 0, y: 0, w: 6200, d: 200, h: 3000, rotation: 0, color: '#fff' };
  const slotWin = { id: 'sw-win', kind: 'window', name: '窗', x: 0, y: 0, w: 4475, d: 200, h: 2000, rotation: 0, color: '#fff', wallId: 'sw', offset: 1625, sill: 150 };
  const slotDoor = { id: 'sw-door', kind: 'door', name: '门', x: 0, y: 0, w: 1500, d: 200, h: 2100, rotation: 0, color: '#fff', wallId: 'sw', offset: 50, sill: 0 };
  const boundedOffset = openingSlot(slotWall, slotDoor, [slotWall, slotWin], 2350, { min: 100, maxEnd: 6100 });
  assert.ok(boundedOffset === undefined || (boundedOffset >= 100 && boundedOffset + slotDoor.w <= 6100), `bounded door offset ${boundedOffset}`);
  console.log('PASS 实测墙角放柱/点位、3D 近侧智能透视墙判断及明档隔断/门头快建（示意构件可重排）');

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
