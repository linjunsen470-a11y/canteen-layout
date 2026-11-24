import assert from 'node:assert/strict';

export async function testBasicLayout(load, loadScene) {
  const { sketchShell, placeSketchFixture } = await load('sketchGeometry');
  const { generateBasicLayout, generateBasicLayoutCandidates } = await load('basicLayout');
  const { parseProject } = await load('projectIO');
  const { contains, footprint, inPolygon } = await load('spatial');
  const { checkSpace } = await load('spaceChecks');
  const { entryRoutes } = await load('entryAccess');
  const shape = points => sketchShell(points.map(([x,y]) => ({ x:x*1000, y:y*1000 })));
  const { dimensionedOutline, polygonArea } = await load('site');
  assert.equal(polygonArea(dimensionedOutline(60000,2400)),144000000);
  for (const corner of ['top-left','top-right','bottom-left','bottom-right']) {
    const points = dimensionedOutline(8500,6000,{ width:3000, depth:2000, corner });
    assert.equal(polygonArea(points),45000000);
    const cutout = { x: corner.endsWith('left') ? 500 : 8000, y: corner.startsWith('top') ? 500 : 5500 };
    assert.equal(inPolygon(cutout,points),false);
    assert.equal(sketchShell(points).items.length,6);
  }
  const rect = (w,d) => [[0,0],[w,0],[w,d],[0,d]];
  assert.throws(() => shape([[0,0],[5,1],[5,5],[0,5]]));
  assert.throws(() => shape([[0,0],[6,0],[6,4],[2,4],[2,-1],[0,-1]]));
  assert.throws(() => shape(rect(61,2)));
  const stairs = [[0,0],[32,0]];
  for (let level = 0; level < 31; level++) stairs.push([32-level,level+1], [level === 30 ? 0 : 31-level,level+1]);
  assert.equal(shape(stairs).survey.corners.length,64);
  assert.throws(() => shape([...stairs.slice(0,-1),[1,31],[1,32],[0,32]]), /64/);
  const thinNotch = shape([[0,0],[8,0],[8,6],[5,6],[5,4],[4.8,4],[4.8,6],[0,6]]);
  assert.equal(thinNotch.survey.thickness, 50);
  function generate(shell, business) {
    const { project, warnings } = generateBasicLayout(shell, business);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)));
    const added = parsed.items.filter(i => !shell.items.some(s => s.id === i.id));
    shell.items.forEach(i => assert.ok(parsed.items.some(s => s.id === i.id && s.x === i.x && s.y === i.y), i.name));
    assert.deepEqual(checkSpace(parsed,null).filter(i => i.type !== '参考净距'), []);
    added.forEach(i => assert.ok(contains(shell.survey.corners, footprint(i)), i.name));
    return { project:parsed, warnings };
  }
  const l = [[0,0],[10,0],[10,4],[6,4],[6,7],[0,7]];
  let fixture = shape(l);
  fixture = placeSketchFixture(fixture,'entrance',{x:2400,y:200},0,0);
  fixture = placeSketchFixture(fixture,'column',{x:6600,y:3000},600,600);
  fixture = placeSketchFixture(fixture,'shaft',{x:4500,y:5500},800,600);
  fixture = placeSketchFixture(fixture,'room',{x:2600,y:5500},2000,1200);
  assert.throws(() => placeSketchFixture(fixture,'column',{x:8800,y:6000},500,500));
  const { nearestTableGap } = await load('conceptPlanner');
  const { seatSummary } = await load('layoutGroups');
  for (const shop of [shape(rect(7,10)), sketchShell(dimensionedOutline(8500,6000,{width:3000,depth:2000,corner:'top-left'})), fixture]) {
    const alternatives = generateBasicLayoutCandidates(shop,'bistro');
    assert.ok(alternatives.length >= 2 && alternatives.length <= 3);
    assert.equal(new Set(alternatives.map(a => a.label)).size, alternatives.length);
    const arrangements = new Set();
    for (const a of alternatives) {
      const parsed = parseProject(JSON.parse(JSON.stringify(a.project)));
      assert.deepEqual(a.capacity, seatSummary(parsed));
      assert.deepEqual(a.tableGapMm, Math.floor(nearestTableGap(parsed).distance + 1e-6));
      const tables = parsed.items.filter(i => i.kind === 'table');
      assert.equal(a.tables, tables.length);
      arrangements.add(JSON.stringify(tables.map(i => [i.x,i.y,i.w,i.d]).sort()));
      assert.deepEqual(checkSpace(parsed,null).filter(i => i.type !== '参考净距'), []);
      const fixed = new Map(shop.items.map(i=>[i.id,i]));
      for (const original of fixed.values()) {
        const item = parsed.items.find(i => i.id === original.id);
        assert.deepEqual([item.x,item.y,item.rotation],[original.x,original.y,original.rotation]);
      }
      for (const item of parsed.items.filter(i => !fixed.has(i.id))) assert.ok(contains(shop.survey.corners, footprint(item)));
      const routes = entryRoutes(parsed,parsed.items.filter(i => i.kind === 'zone' && i.name.startsWith('后厨')));
      if (routes) assert.ok(parsed.items.filter(i => i.kind === 'chair').every(routes.customer));
    }
    assert.equal(arrangements.size,alternatives.length);
    const first = generateBasicLayoutCandidates(shop,'bistro',1);
    assert.equal(first.length,1);
    assert.equal(first[0].label,alternatives[0].label);
    assert.deepEqual(first[0].capacity,alternatives[0].capacity);
  }
  assert.equal(generateBasicLayoutCandidates(shape(rect(.6,.6)), 'restaurant').length,1);
  const placed = generate(fixture,'bistro').project;
  assert.ok(placed.groups.length && placed.items.some(i => i.kind === 'sink') && placed.items.some(i => i.model === 'cashier'));
  const { computeInteriorShot, computeStorefrontShot, computeEyeView } = await loadScene();
  const inside = computeInteriorShot(placed), outside = computeStorefrontShot(placed);
  assert.ok(inside.pos.z < 1 && inside.target.z > inside.pos.z, 'north-side entrance looks inward');
  assert.ok(outside.pos.z < 0 && outside.target.z > outside.pos.z, 'storefront follows the marked entrance');
  const courtyard = shape([[0,0],[10,0],[10,8],[7,8],[7,3],[3,3],[3,8],[0,8]]);
  const innerDoor = placeSketchFixture(courtyard,'entrance',{x:3200,y:5500},0,0);
  const facing = computeStorefrontShot(innerDoor);
  assert.ok(facing.pos.x > 3.2 && facing.pos.x < 7.2 && facing.target.x < facing.pos.x, 'camera stays in the courtyard');
  for (const idx of [1,2]) {
    const shot = computeEyeView(shape(l),idx);
    assert.ok(inPolygon({x:shot.pos.x*1000,y:shot.pos.z*1000},shape(l).survey.corners));
  }
  const measured = { ...placed, basicDraft:undefined, survey:{ ...placed.survey, source:undefined } };
  assert.ok(computeStorefrontShot(measured).pos.equals(outside.pos));
  const kitchen = placed.items.filter(i => i.kind === 'zone' && i.name.startsWith('后厨'));
  const entry = placed.items.find(i => i.pointType === 'entrance');
  assert.ok(kitchen.every(z => !inPolygon({x:entry.x+entry.w/2,y:entry.y+entry.d/2}, footprint(z))));
  const routes = entryRoutes(placed,kitchen);
  assert.ok(placed.items.filter(i => i.kind === 'chair').every(routes.customer));
  assert.ok(placed.items.filter(i => i.kind === 'chair' || i.model === 'cashier').every(routes.staff));
  let rotated = l;
  const counts = [];
  for (let n=0;n<4;n++) {
    const draft = generate(shape(rotated),'canteen').project;
    counts.push(draft.items.filter(i => i.kind === 'chair').reduce((sum,i) => sum+i.seats,0));
    rotated = rotated.map(([x,y]) => [-y,x]);
  }
  assert.ok(counts[0] > 0);
  assert.equal(new Set(counts).size, 1, 'rotated L shells get equivalent capacity');
  for (const points of [
    [[0,0],[10,0],[10,8],[7,8],[7,3],[3,3],[3,8],[0,8]],
    [[0,0],[12,0],[12,3],[8,3],[8,8],[4,8],[4,3],[0,3]],
    l.map(([x,y]) => [-x,y]), rect(3.1,14), rect(60,60),
  ]) assert.ok(generate(shape(points),'cafe').project.groups.length);
  const compact = placeSketchFixture(shape(rect(4,4)), 'entrance', {x:1250,y:200},0,0);
  const dineIn = generate(compact,'bistro').project;
  assert.ok(dineIn.groups.length && dineIn.items.some(i => i.kind === 'sink') && dineIn.items.some(i => i.model === 'noodle-cooker'),
    'a usable compact dining room takes priority over an equipment-only kitchen');
  const small = generate(shape(rect(1,1)),'restaurant');
  assert.equal(small.project.groups.length,0);
  assert.ok(small.project.items.some(i => i.kind === 'fridge'));
  const empty = generate(shape(rect(.6,.6)), 'restaurant');
  assert.ok(empty.project.items.every(i => i.kind === 'wall'));
  assert.deepEqual(small.project.basicDraft,{business:'restaurant',warnings:small.warnings});
  assert.match(small.warnings.join(' '), /未摆入/);
  const divided = placeSketchFixture(shape(rect(10,6)), 'entrance', {x:1500,y:200},0,0);
  const blocked = placeSketchFixture(divided,'room',{x:5200,y:3200},1000,6000);
  assert.ok(generate(blocked,'bistro').project.items.filter(i => ['chair','sink','counter','fridge','stove'].includes(i.kind)).every(i => i.x+i.w/2 < 5200));
  console.log('PASS 直角点角、自交、入口与障碍、四向 L 形、U/T 形、窄铺、60 米和空壳降级');
}
