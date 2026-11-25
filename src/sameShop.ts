import type { Item, Point, Project } from './model';
import { polygonCoverage } from './polygonArea';
import { polygonArea, siteOutline } from './site';

export type ShopMatch = {
  same: boolean;
  reason?: 'outline' | 'entrance' | 'fixtures';
};

const STRUCTURAL_FIXTURE_KINDS = new Set<Item['kind']>(['column', 'fixture', 'stairs']);

function normalizePolygon(points: Point[]) {
  if (!points.length) return { origin: { x: 0, y: 0 }, points: [] as Point[] };
  const minX = Math.min(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  return {
    origin: { x: minX, y: minY },
    points: points.map(p => ({ x: p.x - minX, y: p.y - minY })),
  };
}

function sameCornerLoop(a: Point[], b: Point[], toleranceMm = 10): boolean {
  const n = a.length;
  if (n < 3 || b.length !== n) return false;
  for (let shift = 0; shift < n; shift++) {
    let forward = true;
    let reverse = true;
    for (let i = 0; i < n; i++) {
      const pa = a[i];
      if (forward) {
        const pb = b[(i + shift) % n];
        if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > toleranceMm) forward = false;
      }
      if (reverse) {
        const pb = b[(shift - i + n) % n];
        if (Math.hypot(pa.x - pb.x, pa.y - pb.y) > toleranceMm) reverse = false;
      }
      if (!forward && !reverse) break;
    }
    if (forward || reverse) return true;
  }
  return false;
}

function sameOutlineByIoU(a: Point[], b: Point[]): boolean {
  if (a.length < 3 || b.length < 3) return false;
  const areaA = polygonArea(a);
  const areaB = polygonArea(b);
  if (areaA <= 0 || areaB <= 0) return false;
  if (Math.abs(areaA - areaB) / Math.max(areaA, areaB) >= 0.005) return false;
  const inter = polygonCoverage(a, [b]).union;
  const union = areaA + areaB - inter;
  return union > 0 && inter / union > 0.98;
}

function matchPointsWithin(a: Point[], b: Point[], maxDistMm: number): boolean {
  if (a.length !== b.length) return false;
  const used = new Array<boolean>(b.length).fill(false);
  function dfs(index: number): boolean {
    if (index === a.length) return true;
    for (let j = 0; j < b.length; j++) {
      if (used[j]) continue;
      if (Math.hypot(a[index].x - b[j].x, a[index].y - b[j].y) < maxDistMm) {
        used[j] = true;
        if (dfs(index + 1)) return true;
        used[j] = false;
      }
    }
    return false;
  }
  return dfs(0);
}

function isFixedFixture(item: Item): boolean {
  if (item.hidden) return false;
  if (item.kind === 'utility' && item.pointType === 'entrance') return false;
  if (item.verification) return true;
  if (item.generated === 'concept') return false;
  return STRUCTURAL_FIXTURE_KINDS.has(item.kind) || !!item.locked;
}

function centerOf(item: Item, origin: Point): Point {
  return { x: item.x + item.w / 2 - origin.x, y: item.y + item.d / 2 - origin.y };
}

// Determines whether two projects share the same physical shop shell (outline, entrance, fixed fixtures).
export function matchSameShop(a: Project, b: Project): ShopMatch {
  const outerA = normalizePolygon(siteOutline(a));
  const outerB = normalizePolygon(siteOutline(b));

  const hasSurvey = (a.survey?.corners.length ?? 0) >= 3 && (b.survey?.corners.length ?? 0) >= 3;
  const refA = hasSurvey ? normalizePolygon(a.survey!.corners) : outerA;
  const refB = hasSurvey ? normalizePolygon(b.survey!.corners) : outerB;

  const outlineMatches = hasSurvey
    ? sameCornerLoop(refA.points, refB.points, 10) || (sameOutlineByIoU(refA.points, refB.points) && sameOutlineByIoU(outerA.points, outerB.points))
    : sameCornerLoop(outerA.points, outerB.points, 10) || sameOutlineByIoU(outerA.points, outerB.points);

  if (!outlineMatches) return { same: false, reason: 'outline' };

  const entrancesA = a.items.filter(i => !i.hidden && i.kind === 'utility' && i.pointType === 'entrance').map(i => centerOf(i, refA.origin));
  const entrancesB = b.items.filter(i => !i.hidden && i.kind === 'utility' && i.pointType === 'entrance').map(i => centerOf(i, refB.origin));
  if (!matchPointsWithin(entrancesA, entrancesB, 200)) return { same: false, reason: 'entrance' };

  const fixedA = new Map(a.items.filter(isFixedFixture).map(i => [i.id, i]));
  const fixedB = new Map(b.items.filter(isFixedFixture).map(i => [i.id, i]));
  if (fixedA.size !== fixedB.size) return { same: false, reason: 'fixtures' };
  for (const [id, itemA] of fixedA) {
    const itemB = fixedB.get(id);
    if (!itemB) return { same: false, reason: 'fixtures' };
    const ca = centerOf(itemA, refA.origin);
    const cb = centerOf(itemB, refB.origin);
    if (Math.hypot(ca.x - cb.x, ca.y - cb.y) >= 10 || Math.abs(itemA.w - itemB.w) >= 10 || Math.abs(itemA.d - itemB.d) >= 10) {
      return { same: false, reason: 'fixtures' };
    }
  }

  return { same: true };
}

export const isSameShop = (a: Project, b: Project): boolean => matchSameShop(a, b).same;
