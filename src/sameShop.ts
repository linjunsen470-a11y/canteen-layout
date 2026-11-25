import type { Item, Point, Project } from './model';
import { footprint, subtract } from './spatial';
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

function matchBipartite<A, B>(as: A[], bs: B[], matches: (a: A, b: B) => boolean): boolean {
  if (as.length !== bs.length) return false;
  if (as.length === 0) return true;
  const adj = as.map(a => {
    const list: number[] = [];
    for (let j = 0; j < bs.length; j++) if (matches(a, bs[j])) list.push(j);
    return list;
  });
  if (adj.some(list => list.length === 0)) return false;
  const matchB = new Array<number>(bs.length).fill(-1);
  const augment = (u: number, visited: Uint8Array): boolean => {
    for (const v of adj[u]) {
      if (visited[v]) continue;
      visited[v] = 1;
      if (matchB[v] === -1 || augment(matchB[v], visited)) {
        matchB[v] = u;
        return true;
      }
    }
    return false;
  };
  for (let u = 0; u < as.length; u++) {
    if (!augment(u, new Uint8Array(bs.length))) return false;
  }
  return true;
}

function matchPointsWithin(a: Point[], b: Point[], maxDistMm: number): boolean {
  return matchBipartite(a, b, (pa, pb) => Math.hypot(pa.x - pb.x, pa.y - pb.y) < maxDistMm);
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

type FixtureSignature = {
  item: Item;
  center: Point;
  corners: Point[];
};

function fixtureSignature(item: Item, origin: Point): FixtureSignature {
  return {
    item,
    center: centerOf(item, origin),
    corners: footprint(item).map(p => subtract(p, origin)),
  };
}

function fixtureMatches(a: FixtureSignature, b: FixtureSignature): boolean {
  if (a.item.kind !== b.item.kind || a.item.pointType !== b.item.pointType) return false;
  if (Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y) >= 10) return false;
  const sameDims = Math.abs(a.item.w - b.item.w) < 10 && Math.abs(a.item.d - b.item.d) < 10;
  const swappedDims = Math.abs(a.item.w - b.item.d) < 10 && Math.abs(a.item.d - b.item.w) < 10;
  if (!sameDims && !swappedDims) return false;
  return sameCornerLoop(a.corners, b.corners, 10);
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

  const fixedA = a.items.filter(isFixedFixture).map(i => fixtureSignature(i, refA.origin));
  const fixedB = b.items.filter(isFixedFixture).map(i => fixtureSignature(i, refB.origin));
  if (fixedA.length !== fixedB.length) return { same: false, reason: 'fixtures' };

  // Fast path: pair identical IDs that still match geometrically, then fall back to geometric matching
  // for separately imported or redrawn shells whose fixture IDs differ.
  const bById = new Map(fixedB.map((entry, idx) => [entry.item.id, idx]));
  const matchedB = new Uint8Array(fixedB.length);
  const remA: FixtureSignature[] = [];
  for (const fa of fixedA) {
    const idx = bById.get(fa.item.id);
    if (idx !== undefined && !matchedB[idx] && fixtureMatches(fa, fixedB[idx])) {
      matchedB[idx] = 1;
    } else {
      remA.push(fa);
    }
  }
  if (remA.length > 0) {
    const remB = fixedB.filter((_, idx) => !matchedB[idx]);
    if (!matchBipartite(remA, remB, fixtureMatches)) return { same: false, reason: 'fixtures' };
  }

  return { same: true };
}

export const isSameShop = (a: Project, b: Project): boolean => matchSameShop(a, b).same;
