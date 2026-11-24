import { blankProject, uid } from './model';
import type { InteriorSurvey, Item, Point, Project } from './model';
import { projectOnWall, segmentPose, wallPoint } from './structure';
import { validateSite } from './site';

export const directions = { right: '右', down: '下', left: '左', up: '上' } as const;
export type SurveyLeg = { direction: keyof typeof directions; length: number };
const vectors = { right: [1, 0], down: [0, 1], left: [-1, 0], up: [0, -1] } as const;

export function rectangleLegs(width: number, depth: number): SurveyLeg[] {
  return [{ direction: 'right', length: width }, { direction: 'down', length: depth },
    { direction: 'left', length: width }, { direction: 'up', length: depth }];
}

export function traceLegs(legs: SurveyLeg[]) {
  const path = [{ x: 0, y: 0 }];
  for (const { direction, length } of legs) {
    const [dx, dy] = vectors[direction];
    const last = path[path.length - 1];
    path.push({ x: last.x + dx * length, y: last.y + dy * length });
  }
  return path;
}

export function closureMessage(end: Point) {
  return [end.x && '横向差 ' + Math.abs(end.x) + ' mm（偏' + (end.x > 0 ? '右' : '左') + '）',
    end.y && '纵向差 ' + Math.abs(end.y) + ' mm（偏' + (end.y > 0 ? '下' : '上') + '）'].filter(Boolean).join('，');
}

// At a right-angle vertex the two outward unit normals give the exact miter.
function offsetCorners(points: Point[], distance: number) {
  const area2 = points.reduce((area, p, i) => {
    const next = points[(i + 1) % points.length];
    return area + p.x * next.y - p.y * next.x;
  }, 0);
  const shift = Math.sign(area2) * distance;
  return points.map((p, i) => {
    const prev = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
    return { x: p.x + shift * (Math.sign(p.y - prev.y) + Math.sign(next.y - p.y)),
      y: p.y - shift * (Math.sign(p.x - prev.x) + Math.sign(next.x - p.x)) };
  });
}

function validateCorners(corners: Point[]) {
  // Original survey coordinates live independently of subsequent site edits.
  validateSite({ outline: corners, width: 62000, height: 62000 });
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length], c = corners[(i + 2) % corners.length];
    if (![a.x, a.y].every(Number.isInteger) || (a.x !== b.x && a.y !== b.y))
      throw Error('墙段须为整数毫米的水平或垂直边');
    if ((a.x === b.x) === (b.x === c.x)) throw Error('相邻同向边请合并为一段，并在墙角转向');
  }
}

export function validateSurvey(s: InteriorSurvey) {
  if (!s || !Array.isArray(s.corners) || !Array.isArray(s.wallIds) || s.wallIds.length !== s.corners.length
    || s.wallIds.some(id => typeof id !== 'string' || !id) || new Set(s.wallIds).size !== s.wallIds.length)
    throw Error('现场测量记录的墙段无效');
  if (s.source !== undefined && s.source !== 'estimated') throw Error('铺位尺寸来源无效');
  if (!Number.isInteger(s.thickness) || s.thickness < 50 || s.thickness > 1000) throw Error('墙厚须为 50–1000 mm');
  validateCorners(s.corners);
}

export function createSurveyShop(name: string, legs: SurveyLeg[], thickness: number, ceiling: number): Project {
  if (legs.length < 4 || legs.length > 64) throw Error('请录入 4–64 段直角内墙');
  if (legs.some(leg => !Number.isInteger(leg.length) || leg.length < 1 || leg.length > 60000)) throw Error('每段净长须为 1–60000 mm 的整数');
  if (!Number.isInteger(ceiling) || ceiling < 2400 || ceiling > 6000) throw Error('层高须为 2400–6000 mm');
  const path = traceLegs(legs), end = path.pop()!;
  if (end.x || end.y) throw Error('尚未闭合：' + closureMessage(end));
  const minX = Math.min(...path.map(p => p.x)), minY = Math.min(...path.map(p => p.y));
  const corners = path.map(p => ({ x: p.x - minX + thickness, y: p.y - minY + thickness }));
  const survey = { corners, thickness, wallIds: legs.map(() => uid()) };
  validateSurvey(survey);
  const outline = offsetCorners(corners, thickness), centers = offsetCorners(corners, thickness / 2);
  const width = Math.max(...outline.map(p => p.x)), height = Math.max(...outline.map(p => p.y));
  if (width - 2 * thickness > 60000 || height - 2 * thickness > 60000) throw Error('铺位内净宽、深均不可超过 60 m');
  validateSite({ outline, width, height });
  const walls: Item[] = centers.map((a, i) => {
    const n = (i + 1) % centers.length, [dx, dy] = vectors[legs[i].direction];
    if ((outline[n].x - outline[i].x) * dx + (outline[n].y - outline[i].y) * dy <= 0)
      throw Error('第 ' + (i + 1) + ' 段凹位过窄，外墙会交叠');
    const pose = segmentPose(a, centers[n], thickness);
    if (pose.w < 100) throw Error('第 ' + (i + 1) + ' 段生成的墙体不足 100 mm');
    return { id: survey.wallIds[i], name: '外墙 ' + (i + 1), kind: 'wall', model: 'wall',
      ...pose, d: thickness, h: ceiling, color: '#eee8de' };
  });
  const project = blankProject(name);
  return { ...project, width, height, outline, items: walls, survey,
    style: { ...project.style, ceilingHeight: ceiling, floorMaterial: 'concrete', wallMaterial: 'plaster', lightingPreset: 'daylight' } };
}

export function autoCloseLegs(legs: SurveyLeg[]): SurveyLeg[] {
  const valid = legs.filter(l => Number.isInteger(l.length) && l.length > 0);
  if (valid.length < 2) throw Error('请先录入至少 2 段有效墙长再自动闭合');
  const path = traceLegs(valid);
  const end = path[path.length - 1];
  if (!end.x && !end.y) return valid;
  const horiz = (d: SurveyLeg['direction']) => d === 'left' || d === 'right';
  const hLeg: SurveyLeg | null = end.x ? { direction: end.x > 0 ? 'left' : 'right', length: Math.abs(end.x) } : null;
  const vLeg: SurveyLeg | null = end.y ? { direction: end.y > 0 ? 'up' : 'down', length: Math.abs(end.y) } : null;
  const candidates: SurveyLeg[][] = [];
  if (hLeg && vLeg) {
    candidates.push([...valid, vLeg, hLeg], [...valid, hLeg, vLeg]);
  } else if (hLeg) {
    candidates.push([...valid, hLeg]);
  } else if (vLeg) {
    candidates.push([...valid, vLeg]);
  }
  const chosen = candidates.find(list => {
    if (list.length < 4 || list.length > 64) return false;
    const prev = list[valid.length - 1], firstAdded = list[valid.length], lastAdded = list[list.length - 1], first = list[0];
    if (horiz(prev.direction) === horiz(firstAdded.direction)) return false;
    if (horiz(lastAdded.direction) === horiz(first.direction)) return false;
    const pts = traceLegs(list);
    pts.pop();
    try { validateCorners(pts); return true; } catch { return false; }
  });
  if (!chosen) throw Error('当前折线无法直接用 1–2 段直角闭合，请微调最后一段方向或长度');
  return chosen;
}

// The recorded corners are usable as a datum only while both adjoining
// junctions still match the surveyed walls. Deleted wall IDs remain historical.
export function surveyWall(project: Project, wall: Item) {
  const s = project.survey;
  if (!s) return;
  const i = s.wallIds.indexOf(wall.id), count = s.corners.length;
  if (i < 0) return;
  const centers = offsetCorners(s.corners, s.thickness / 2);
  for (const j of [(i + count - 1) % count, i, (i + 1) % count]) {
    const w = project.items.find(item => item.id === s.wallIds[j]);
    if (!w || w.kind !== 'wall' || w.d !== s.thickness) return;
    const next = centers[(j + 1) % count], start = wallPoint(w, 0), end = wallPoint(w, w.w);
    if (Math.hypot(start.x - centers[j].x, start.y - centers[j].y) > 0.01 || Math.hypot(end.x - next.x, end.y - next.y) > 0.01) return;
  }
  const area2 = s.corners.reduce((area, p, idx) => {
    const next = s.corners[(idx + 1) % count];
    return area + p.x * next.y - p.y * next.x;
  }, 0);
  const a = s.corners[i], b = s.corners[(i + 1) % count];
  const edgeLen = Math.hypot(b.x - a.x, b.y - a.y);
  const tx = edgeLen > 0 ? (b.x - a.x) / edgeLen : 1;
  const ty = edgeLen > 0 ? (b.y - a.y) / edgeLen : 0;
  const sign = Math.sign(area2) || 1;
  const inward = { x: -sign * ty, y: sign * tx };
  const start = Math.round(projectOnWall(wall, a).offset * 1000) / 1000;
  const end = Math.round(projectOnWall(wall, b).offset * 1000) / 1000;
  // Reconcile inner-face span with structural openingError() 50mm centerline bounds
  // so concave interior corners never accept an offset that syncStructure() rejects.
  const minOffset = Math.max(start, 50);
  const maxEnd = Math.min(end, wall.w - 50);
  const minStartGap = Math.max(0, Math.ceil(minOffset - start));
  const minEndGap = Math.max(0, Math.ceil(end - maxEnd));
  return { a, b, start, end, minOffset, maxEnd, minStartGap, minEndGap, index: i, tangent: { x: tx, y: ty }, inward };
}

type WallDatum = NonNullable<ReturnType<typeof surveyWall>>;
export function cornerDistance(datum: WallDatum, offset: number, width: number, fromEnd: boolean) {
  return fromEnd ? datum.end - offset - width : offset - datum.start;
}
export function openingOffset(datum: WallDatum, distance: number, width: number, fromEnd: boolean) {
  if (!Number.isFinite(distance) || !Number.isFinite(width) || width < 100) throw Error('请填写有效距离，洞口宽度至少 100 mm');
  if (distance < 0 || distance + width > datum.end - datum.start) throw Error('洞口超出内墙净长');
  const offset = fromEnd ? datum.end - distance - width : datum.start + distance;
  if (offset < datum.minOffset - 1e-6) {
    const need = Math.ceil(datum.minOffset - datum.start);
    throw Error(`受墙角结构限制，距起角至少需留 ${need} mm（避免切入相邻墙体）`);
  }
  if (offset + width > datum.maxEnd + 1e-6) {
    const need = Math.ceil(datum.end - datum.maxEnd);
    throw Error(`受墙角结构限制，距末角至少需留 ${need} mm（避免切入相邻墙体）`);
  }
  return offset;
}

export function surveyWallInwardPoint(
  datum: WallDatum,
  alongDistance: number,
  insetDistance: number,
  w: number,
  d: number,
  fromEnd: boolean,
): Point {
  if (!Number.isFinite(alongDistance) || !Number.isFinite(insetDistance) || alongDistance < 0 || insetDistance < 0) {
    throw Error('沿墙距离与离墙净距须为非负有效数值');
  }
  if (!Number.isFinite(w) || !Number.isFinite(d) || w <= 0 || d <= 0) {
    throw Error('构件尺寸须大于 0 mm');
  }
  const edgeLen = datum.end - datum.start;
  const horizontal = Math.abs(datum.tangent.x) > 0.5;
  const spanAlong = horizontal ? w : d;
  const spanInward = horizontal ? d : w;
  if (alongDistance + spanAlong > edgeLen + 0.01) {
    throw Error(`构件沿墙位置超出本段内净长（${Math.round(edgeLen)} mm）`);
  }
  const alongStart = fromEnd ? edgeLen - alongDistance - spanAlong : alongDistance;
  const alongCenter = alongStart + spanAlong / 2;
  const inwardCenter = insetDistance + spanInward / 2;
  const cx = datum.a.x + datum.tangent.x * alongCenter + datum.inward.x * inwardCenter;
  const cy = datum.a.y + datum.tangent.y * alongCenter + datum.inward.y * inwardCenter;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - d / 2) };
}
