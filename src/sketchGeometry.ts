import { createSurveyShop, surveyWall, surveyWallInwardPoint, type SurveyLeg } from './interiorSurvey';
import { type Item, type Point, type Project, uid } from './model';
import { intersects } from './site';
import { contains, footprint, projectPoint } from './spatial';
import { openingSlot, projectOnWall, syncStructure } from './structure';
import { checkSpace } from './spaceChecks';

export function checkSketchEdge(corners: Point[], end: Point, closing: boolean) {
  const start = corners.at(-1);
  if (!start) return;
  const horizontal = start.y === end.y;
  if (horizontal === (start.x === end.x)) throw Error('请选择水平或垂直方向的另一个墙角');
  if (!closing && corners.length >= 64) throw Error('最多支持 64 个墙角');
  if (closing && corners.length < 4) throw Error('闭合轮廓至少需要四个墙角');
  const prev = corners.at(-2);
  if (prev && (prev.y === start.y) === horizontal) throw Error('请在墙角转向，或退回上一点更正墙长');
  for (let i = closing ? 1 : 0; i < corners.length - 2; i++) {
    if (intersects(start, end, corners[i], corners[i + 1])) throw Error('这段墙与已有墙段相交，请重新选择墙角');
  }
  const all = [...corners, end];
  for (const axis of ['x', 'y'] as const) {
    const values = all.map(p => p[axis]);
    if (Math.max(...values) - Math.min(...values) > 60000) throw Error('铺位净宽和净深各支持至 60 米');
  }
}

export function sketchShell(corners: Point[]) {
  if (corners.length < 4) throw Error('闭合轮廓至少需要四个墙角');
  corners.forEach((p, i) => checkSketchEdge(corners.slice(0, i), p, false));
  checkSketchEdge(corners, corners[0], true);
  const legs: SurveyLeg[] = corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length];
    return { direction: b.x > a.x ? 'right' : b.x < a.x ? 'left' : b.y > a.y ? 'down' : 'up',
      length: Math.abs(b.x - a.x) + Math.abs(b.y - a.y) };
  });
  const project = createSurveyShop('我的铺位', legs, 200, 3200);
  project.survey!.source = 'estimated';
  return project;
}

export const sketchFixtures = { column: '柱', shaft: '管井', room: '固定隔间', entrance: '入口' } as const;
export type SketchFixture = keyof typeof sketchFixtures;

export function placeSketchFixture(project: Project, kind: SketchFixture, point: Point, width: number, depth: number): Project {
  const label = sketchFixtures[kind];
  let item: Item = { id: uid(), name: label, kind: kind === 'column' ? 'column' : 'fixture',
    x: point.x - width / 2, y: point.y - depth / 2, w: width, d: depth, h: 3200, rotation: 0, color: '#83908a' };
  let added = [item];
  if (kind === 'entrance') {
    const walls = project.items.filter(i => i.kind === 'wall');
    const choices = walls.map(wall => {
      const datum = surveyWall(project, wall)!;
      const hit = projectPoint(point, datum.a, datum.b);
      return { wall, datum, distance: Math.hypot(point.x - hit.x, point.y - hit.y) };
    }).sort((a, b) => a.distance - b.distance);
    const { wall, datum, distance } = choices[0];
    if (distance > 500) throw Error('请点靠近入口的外墙');
    item = { ...item, kind: 'door', name: '入口门', w: 900, d: wall.d, h: 2100, wallId: wall.id, sill: 0,
      flipped: datum.inward.x * -datum.tangent.y + datum.inward.y * datum.tangent.x < 0 };
    const offset = openingSlot(wall, item, project.items, projectOnWall(wall, point).offset - item.w / 2, { min: datum.minOffset, maxEnd: datum.maxEnd });
    if (offset === undefined) throw Error('这段墙没有足够的开口净长');
    const along = offset - datum.start + item.w / 2 - 100;
    const marker = surveyWallInwardPoint(datum, along, 0, 200, 200, false);
    added = [{ ...item, offset }, { ...marker, id: uid(), name: '顾客入口', kind: 'utility', color: '#659e71', rotation: 0,
      w: 200, d: 200, h: 50, pointType: 'entrance', verification: 'pending' }];
  } else if (!(width >= 100 && depth >= 100) || !contains(project.survey!.corners, footprint(item))) {
    throw Error('固定构件必须完整位于铺位内，宽深至少 0.1 米');
  }
  const next = syncStructure({ ...project, items: [...project.items, ...added] });
  const conflict = checkSpace(next, null).find(i => i.type !== '参考净距' && i.ids.some(id => added.some(a => a.id === id)));
  if (conflict) throw Error(conflict.message);
  return next;
}
