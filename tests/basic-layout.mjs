import assert from 'node:assert/strict';

export async function testBasicLayout(load) {
  const { sketchShell, placeSketchFixture } = await load('sketchGeometry');
  const { generateBasicLayout } = await load('basicLayout');
  const { parseProject } = await load('projectIO');
  const { contains, footprint } = await load('spatial');
  const { checkSpace } = await load('spaceChecks');
  const { reachableFromEntry } = await load('entryAccess');
  const shape = points => sketchShell(points.map(([x,y]) => ({ x:x*1000, y:y*1000 })));
  const rect = (w,d) => [[0,0],[w,0],[w,d],[0,d]];
  assert.throws(() => shape([[0,0],[5,1],[5,5],[0,5]]));
  assert.throws(() => shape([[0,0],[6,0],[6,4],[2,4],[2,-1],[0,-1]]));
  assert.throws(() => shape(rect(61,2)));
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
  const placed = generate(fixture,'bistro').project;
  assert.ok(placed.groups.length && placed.items.some(i => i.kind === 'sink') && placed.items.some(i => i.model === 'cashier'));
  const reachable = reachableFromEntry(placed);
  assert.ok(placed.items.filter(i => i.kind === 'chair' || i.model === 'cashier').every(reachable));
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
  assert.match(small.warnings.join(' '), /未摆入/);
  const divided = placeSketchFixture(shape(rect(10,6)), 'entrance', {x:1500,y:200},0,0);
  const blocked = placeSketchFixture(divided,'room',{x:5200,y:3200},1000,6000);
  assert.ok(generate(blocked,'bistro').project.items.filter(i => ['chair','sink','counter','fridge','stove'].includes(i.kind)).every(i => i.x+i.w/2 < 5200));
  console.log('PASS 直角点角、自交、入口与障碍、四向 L 形、U/T 形、窄铺、60 米和空壳降级');
}
