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

  // Same-shop matching & A/B compare metrics unit checks
  const { matchSameShop, isSameShop } = await load('sameShop');
  const { computeCompareMetrics } = await load('makeCompareSheet');
  const { sketchShell, placeSketchFixture } = await load('sketchGeometry');
  const { dimensionedOutline } = await load('site');
  const { generateBasicLayoutCandidates } = await load('basicLayout');

  let baseShell = sketchShell(dimensionedOutline(8500, 6000, { width: 3000, depth: 2000, corner: 'top-left' }));
  baseShell = placeSketchFixture(baseShell, 'entrance', { x: 5200, y: 200 }, 0, 0);
  baseShell = placeSketchFixture(baseShell, 'column', { x: 6400, y: 3200 }, 500, 500);
  const cands = generateBasicLayoutCandidates(baseShell, 'bistro');
  assert.ok(cands.length >= 2, 'L-shape shell should yield >= 2 layout candidates');

  // 1. Same shop (different layout candidates of the same shell, plus translated copy)
  assert.deepEqual(matchSameShop(cands[0].project, cands[1].project), { same: true });
  const shifted = {
    ...cands[1].project,
    outline: cands[1].project.outline?.map(p => ({ x: p.x + 1200, y: p.y + 800 })),
    survey: cands[1].project.survey && {
      ...cands[1].project.survey,
      corners: cands[1].project.survey.corners.map(p => ({ x: p.x + 1200, y: p.y + 800 })),
    },
    items: cands[1].project.items.map(i => ({ ...i, x: i.x + 1200, y: i.y + 800 })),
  };
  assert.equal(isSameShop(cands[0].project, shifted), true, 'translated same-shop should match');

  // 2. Mirrored L-shape (identical 45 m^2 area, opposite notch)
  const mirrored = sketchShell(dimensionedOutline(8500, 6000, { width: 3000, depth: 2000, corner: 'top-right' }));
  assert.deepEqual(matchSameShop(cands[0].project, mirrored), { same: false, reason: 'outline' });

  // 3. Same area, different rectangle aspect (8x6 = 48 m^2 vs 12x4 = 48 m^2)
  const rectA = sketchShell(dimensionedOutline(8000, 6000));
  const rectB = sketchShell(dimensionedOutline(12000, 4000));
  assert.deepEqual(matchSameShop(rectA, rectB), { same: false, reason: 'outline' });

  // 4. Entrance moved (> 200 mm fails, < 200 mm passes)
  const movedEntranceFar = {
    ...cands[1].project,
    items: cands[1].project.items.map(i => i.pointType === 'entrance' ? { ...i, x: i.x + 350 } : i),
  };
  assert.deepEqual(matchSameShop(cands[0].project, movedEntranceFar), { same: false, reason: 'entrance' });
  const movedEntranceNear = {
    ...cands[1].project,
    items: cands[1].project.items.map(i => i.pointType === 'entrance' ? { ...i, x: i.x + 120 } : i),
  };
  assert.equal(isSameShop(cands[0].project, movedEntranceNear), true);

  // 5. Fixed fixture moved (> 10 mm) or removed
  const movedCol = {
    ...cands[1].project,
    items: cands[1].project.items.map(i => i.kind === 'column' ? { ...i, x: i.x + 50 } : i),
  };
  assert.deepEqual(matchSameShop(cands[0].project, movedCol), { same: false, reason: 'fixtures' });
  const rotatedFixture = rotation => ({
    ...rectA, items: [...rectA.items, { ...cands[0].project.items.find(i => i.kind === 'column'), w: 1800, d: 500, rotation }],
  });
  assert.deepEqual(matchSameShop(rotatedFixture(0), rotatedFixture(90)), { same: false, reason: 'fixtures' });
  assert.equal(isSameShop(rotatedFixture(0), rotatedFixture(180)), true);
  const droppedCol = {
    ...cands[1].project,
    items: cands[1].project.items.filter(i => i.kind !== 'column'),
  };
  assert.deepEqual(matchSameShop(cands[0].project, droppedCol), { same: false, reason: 'fixtures' });

  // A/B compare metrics match live seatSummary & nearestTableGap
  const compareMetrics = computeCompareMetrics(cands[0].project, cands[1].project);
  assert.equal(compareMetrics.match.same, true);
  assert.equal(compareMetrics.a.seats, cands[0].capacity.seats);
  assert.equal(compareMetrics.b.seats, cands[1].capacity.seats);
  assert.equal(compareMetrics.a.tables, cands[0].tables);
  assert.equal(compareMetrics.b.tables, cands[1].tables);
  assert.equal(compareMetrics.a.tableGapMm, cands[0].tableGapMm);
  assert.equal(compareMetrics.b.tableGapMm, cands[1].tableGapMm);
  assert.ok(compareMetrics.summary.length > 0);
  console.log('PASS 同铺判定（同铺/镜像/同面积异形/入口移动/固定构件移动）与 A/B 指标计算');

  // Step 1: default business style on untouched shell, custom style preservation, non-destructive quick switches, legacy packages
  const { activeQuickThemeId, applyQuickTheme, applyQuickLighting, quickThemePresets } = await server.ssrLoadModule('/src/StyleQuickBar.tsx');
  const { seatSummary } = await load('layoutGroups');

  const rawRect = sketchShell(dimensionedOutline(7000, 10000));
  const bistroDraft = generateBasicLayoutCandidates(rawRect, 'bistro', 1)[0].project;
  assert.equal(bistroDraft.style?.floorMaterial, 'oak-wood');
  assert.equal(bistroDraft.style?.wallMaterial, 'warm-cream');
  assert.equal(bistroDraft.style?.lightingPreset, 'warm-dining');
  assert.equal(activeQuickThemeId(bistroDraft), 'oak-bistro');

  const canteenDraft = generateBasicLayoutCandidates(rawRect, 'canteen', 1)[0].project;
  assert.equal(canteenDraft.style?.floorMaterial, 'warm-tile');
  assert.equal(canteenDraft.style?.wallMaterial, 'brick-white');
  assert.equal(canteenDraft.style?.lightingPreset, 'daylight');
  assert.equal(activeQuickThemeId(canteenDraft), 'bright-canteen');

  // Manually customized shell style must NOT be overwritten
  const customShell = { ...rawRect, style: { ...rawRect.style, floorMaterial: 'terrazzo', wallMaterial: 'wood-panel', lightingPreset: 'evening' } };
  const preservedDraft = generateBasicLayoutCandidates(customShell, 'bistro', 1)[0].project;
  assert.equal(preservedDraft.style?.floorMaterial, 'terrazzo');
  assert.equal(preservedDraft.style?.wallMaterial, 'wood-panel');
  assert.equal(preservedDraft.style?.lightingPreset, 'evening');

  // Quick theme & lighting helpers never touch items/groups/seats
  const eveningTheme = quickThemePresets.find(t => t.id === 'warm-restaurant');
  const styled = applyQuickTheme(bistroDraft, eveningTheme);
  assert.strictEqual(styled.items, bistroDraft.items);
  assert.strictEqual(styled.groups, bistroDraft.groups);
  assert.deepEqual(seatSummary(styled), seatSummary(bistroDraft));
  assert.equal(styled.style?.lightingPreset, 'evening');
  assert.equal(activeQuickThemeId(styled), 'warm-restaurant');

  const lit = applyQuickLighting(styled, 'daylight');
  assert.strictEqual(lit.items, styled.items);
  assert.equal(lit.style?.lightingPreset, 'daylight');
  assert.equal(activeQuickThemeId(lit), 'warm-restaurant');

  // Legacy project without style or with partial style loads cleanly without errors
  const legacyNoStyle = parseProject(JSON.parse(JSON.stringify({ ...bistroDraft, style: undefined })));
  assert.equal(activeQuickThemeId(legacyNoStyle), 'raw-concrete');
  const legacyPartial = parseProject(JSON.parse(JSON.stringify({ ...bistroDraft, style: { floorMaterial: 'concrete', wallMaterial: 'plaster' } })));
  assert.equal(activeQuickThemeId(legacyPartial), 'raw-concrete');
  console.log('PASS 首稿业态默认风格、手工材质保护、快捷切换零破坏与旧项目缺省样式回读');

  // Step 5: local drag clearance check (nearby groups, tight/ok/out-of-range, surveyWall, overlap, 300-item speed)
  const { computeDragClearance } = await load('spaceChecks');
  const dragShop = sketchShell(dimensionedOutline(10000, 8000));
  const t1 = { id: 'dt1', kind: 'table', model: 'rect-table', name: '桌1', x: 3000, y: 3000, w: 1200, d: 800, h: 750, rotation: 0, color: '#cfa777' };
  const c1 = { id: 'dc1', kind: 'chair', model: 'chair', name: '椅1', x: 3350, y: 2520, w: 450, d: 450, h: 820, rotation: 0, color: '#8d6247' };
  const t2 = { id: 'dt2', kind: 'table', model: 'rect-table', name: '桌2', x: 4800, y: 3000, w: 1200, d: 800, h: 750, rotation: 0, color: '#cfa777' };
  const baseDragProject = {
    ...dragShop,
    clearance: 900,
    items: [...dragShop.items, t1, c1, t2],
    groups: [{ id: 'dg1', name: '桌组1', members: ['dt1', 'dc1'], seats: 1 }],
  };

  // 600 mm gap between dt1 (right=4200) and dt2 (left=4800): ignores own chair dc1, flags tight (< 900 mm)
  const tightGap = computeDragClearance(baseDragProject, ['dt1', 'dc1']);
  assert.ok(tightGap, '应返回邻近桌组净距');
  assert.equal(tightGap.targetId, 'dt2');
  assert.equal(tightGap.targetKind, 'item');
  assert.ok(Math.abs(tightGap.distance - 600) < 0.5, `expected 600mm, got ${tightGap.distance}`);
  assert.equal(tightGap.tight, true);
  assert.equal(tightGap.overlapping, false);

  // 1100 mm gap (>= 900 mm, <= 900 + 600 mm): ok (not tight)
  const okProject = { ...baseDragProject, items: baseDragProject.items.map(i => i.id === 'dt2' ? { ...i, x: 5300 } : i) };
  const okGap = computeDragClearance(okProject, ['dt1', 'dc1']);
  assert.ok(okGap);
  assert.equal(okGap.targetId, 'dt2');
  assert.ok(Math.abs(okGap.distance - 1100) < 0.5);
  assert.equal(okGap.tight, false);

  // Far away (> clearance + 600 mm from all items and walls): null
  const farProject = { ...baseDragProject, items: baseDragProject.items.filter(i => i.id !== 'dt2') };
  assert.equal(computeDragClearance(farProject, ['dt1', 'dc1']), null);

  // Near surveyed inner wall (inner left wall is at x = survey.thickness = 200; placing dt1 at x = 650 => 450 mm)
  const wallGapProject = { ...farProject, items: farProject.items.map(i => i.id === 'dt1' ? { ...i, x: 650 } : i.id === 'dc1' ? { ...i, x: 1000 } : i) };
  const wallGap = computeDragClearance(wallGapProject, ['dt1', 'dc1']);
  assert.ok(wallGap);
  assert.equal(wallGap.targetKind, 'wall');
  assert.ok(Math.abs(wallGap.distance - 450) < 1, `expected ~450mm to surveyWall, got ${wallGap.distance}`);
  assert.equal(wallGap.tight, true);

  // Overlapping table => distance 0, overlapping true, tight true
  const overlapProject = { ...baseDragProject, items: baseDragProject.items.map(i => i.id === 'dt2' ? { ...i, x: 4000 } : i) };
  const overlapGap = computeDragClearance(overlapProject, ['dt1', 'dc1']);
  assert.ok(overlapGap && overlapGap.overlapping && overlapGap.tight && overlapGap.distance === 0);

  // 300-item synthetic scene micro-benchmark (must stay well below 2 ms per call)
  const items300 = Array.from({ length: 300 }, (_, n) => ({
    id: 'p-' + n, kind: 'table', model: 'rect-table', name: '桌' + n,
    x: 1000 + (n % 20) * 1800, y: 1000 + Math.floor(n / 20) * 1800,
    w: 1200, d: 800, h: 750, rotation: 0, color: '#cfa777',
  }));
  const proj300 = { ...dragShop, width: 40000, height: 30000, outline: undefined, survey: undefined, clearance: 900, items: items300 };
  const t0 = performance.now();
  for (let k = 0; k < 200; k++) computeDragClearance(proj300, ['p-0']);
  const avgMs = (performance.now() - t0) / 200;
  assert.ok(avgMs < 2, `300-item computeDragClearance avg ${avgMs.toFixed(3)} ms should be < 2 ms`);
  console.log(`PASS 拖拽实时净距计算（桌组/实测内墙/重叠/超距过滤与 300 物件均耗时 ${avgMs.toFixed(2)} ms）`);

  // Step 4: underlay quick-frame geometry & pixel-aligned shell builder
  const { initialUnderlayFrame, framePolygon, dragFrameCorner, dragFrameNotch, buildUnderlayFramedShell } = await load('underlayFrame');
  const { polygonArea } = await load('site');
  const calibratedShop = {
    ...dragShop,
    items: [],
    survey: undefined,
    outline: undefined,
    underlay: {
      assetId: 'asset-demo',
      name: 'floorplan.png',
      pixelWidth: 1000,
      pixelHeight: 800,
      x: 500,
      y: 400,
      mmPerPixel: 10,
      rotation: 0,
      opacity: 0.65,
      hidden: false,
      locked: true,
      calibration: { points: [{ x: 100, y: 100 }, { x: 600, y: 100 }], distance: 5000 },
    },
  };
  const rectFrame = initialUnderlayFrame(calibratedShop, 'rectangle');
  assert.equal(framePolygon(rectFrame).length, 4);
  const resizedRect = dragFrameCorner(rectFrame, 'bottom-right', { x: rectFrame.x + 8000, y: rectFrame.y + 6000 }, 50);
  assert.equal(resizedRect.width, 8000);
  assert.equal(resizedRect.depth, 6000);
  const rectShell = buildUnderlayFramedShell(calibratedShop, resizedRect);
  assert.equal(polygonArea(rectShell.survey.corners), 48000000);
  assert.equal(rectShell.items.filter(i => i.kind === 'wall').length, 4);
  const rectMinX = Math.min(...rectShell.survey.corners.map(p => p.x));
  const rectMinY = Math.min(...rectShell.survey.corners.map(p => p.y));
  assert.equal(rectShell.underlay.x, calibratedShop.underlay.x + (rectMinX - resizedRect.x));
  assert.equal(rectShell.underlay.y, calibratedShop.underlay.y + (rectMinY - resizedRect.y));

  const lFrame = initialUnderlayFrame(calibratedShop, 'l-shape');
  assert.equal(framePolygon(lFrame).length, 6);
  const draggedNotch = dragFrameNotch(
    { ...lFrame, x: 1000, y: 1000, width: 8500, depth: 6000, notchCorner: 'top-left', notchWidth: 2000, notchDepth: 1500 },
    { x: 4000, y: 3000 },
    50,
  );
  assert.equal(draggedNotch.notchWidth, 3000);
  assert.equal(draggedNotch.notchDepth, 2000);
  const lShell = buildUnderlayFramedShell(calibratedShop, draggedNotch);
  assert.equal(lShell.items.filter(i => i.kind === 'wall').length, 6);
  assert.equal(polygonArea(lShell.survey.corners), 45000000);
  console.log('PASS 户型底图快速套框几何（矩形/L 形初始化、角点与缺口拖拽及底图坐标对齐建壳）');
} finally {
  await server.close();
}
