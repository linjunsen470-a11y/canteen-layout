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

  const { createSurveyShop, rectangleLegs, surveyWall, cornerDistance, openingOffset } = await load('interiorSurvey');
  const { siteArea, planningArea } = await load('site');
  const { wallPoint } = await load('structure');
  const { alignUnderlay, imageToWorld } = await load('siteExtras');
  const { bomCSV } = await load('shopAnalytics');
  const { wallProfiles } = await load('wallJoints');
  const rect = parseProject(createSurveyShop('现场矩形', rectangleLegs(6000,4000), 200, 3200));
  assert.deepEqual([rect.width,rect.height,siteArea(rect),planningArea(rect)], [6400,4400,28160000,24000000]);
  assert.equal(analyzeShop(rect).areaSqm, 24);
  assert.match(bomCSV(rect,analyzeShop(rect)), /现场记录净面积 24.00㎡.*外轮廓面积 28.16㎡/);
  const lLegs = [['right',6000],['down',2500],['left',2000],['down',1500],['left',4000],['up',4000]]
    .map(([direction,length])=>({direction,length}));
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
      const offset=openingOffset(face,100,250,false);
      assert.equal(openingOffset(face,face.end-face.start-350,250,true),offset);
    });
  }
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
  console.log('PASS 内净尺寸、反向与奇数墙厚、渲染墙面、闭合差、净面积、双端洞口及底图配准');
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
