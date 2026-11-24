import {
  FloorMaterial, Item, LayoutGroup, LightingPreset, Point, Project, WallMaterial,
  resolveStyle, uid,
} from './model';
import { polygonArea, siteOutline, validateSite } from './site';
import { contains, doorSwings, footprint, polygonDistance } from './spatial';
import { parseProject } from './projectIO';
import { isAnnotation } from './annotations';
import { surveyWall } from './interiorSurvey';
import { openingSlot, wallPoint } from './structure';
import { analyzeShop } from './shopAnalytics';
import { checkSpace } from './spaceChecks';
import { polygonPatch } from './zones';

export type ConceptBusinessType = 'bistro' | 'cafe' | 'restaurant' | 'canteen';
export type ConceptKitchenSide = 'rear' | 'left' | 'right' | 'none';
export type ConceptSeatingStyle = 'balanced' | 'compact' | 'comfort' | 'canteen-bench';
export type ConceptThemeId = 'keep' | 'oak-bistro' | 'cream-cafe' | 'warm-restaurant' | 'bright-canteen' | 'raw-concrete';

export type ConceptPlannerOptions = {
  businessType: ConceptBusinessType;
  kitchenSide: ConceptKitchenSide;
  kitchenRatioPct: number; // 20..50 (ignored when kitchenSide === 'none')
  seatingStyle: ConceptSeatingStyle;
  aisleMm: number; // e.g., 800 | 950 | 1100
  includeKitchenEquip: boolean;
  includeLights: boolean;
  includePartition?: boolean;
  includeStorefront?: boolean;
  themeId: ConceptThemeId;
};

export type DecorThemePreset = {
  id: Exclude<ConceptThemeId, 'keep'>;
  label: string;
  subtitle: string;
  floorMaterial: FloorMaterial;
  wallMaterial: WallMaterial;
  lightingPreset: LightingPreset;
};

export const decorThemePresets: DecorThemePreset[] = [
  { id: 'oak-bistro', label: '原木暖调', subtitle: '面馆 / 轻食 / 社区小店', floorMaterial: 'oak-wood', wallMaterial: 'warm-cream', lightingPreset: 'warm-dining' },
  { id: 'cream-cafe', label: '水磨石咖啡', subtitle: '精品咖啡 / 烘焙茶饮', floorMaterial: 'terrazzo', wallMaterial: 'warm-cream', lightingPreset: 'warm-dining' },
  { id: 'warm-restaurant', label: '晚市小馆', subtitle: '精致中餐 / 聚餐氛围', floorMaterial: 'oak-wood', wallMaterial: 'wood-panel', lightingPreset: 'evening' },
  { id: 'bright-canteen', label: '明亮快餐', subtitle: '高翻台快餐 / 企业食堂', floorMaterial: 'warm-tile', wallMaterial: 'brick-white', lightingPreset: 'daylight' },
  { id: 'raw-concrete', label: '毛坯实测', subtitle: '素水泥白墙 · 方案推演', floorMaterial: 'concrete', wallMaterial: 'plaster', lightingPreset: 'daylight' },
];

export const businessTypeDefaults: Record<ConceptBusinessType, {
  label: string;
  subtitle: string;
  defaultKitchenPct: number;
  defaultSeating: ConceptSeatingStyle;
  defaultTheme: Exclude<ConceptThemeId, 'keep'>;
  boothColor: string;
  chairColor: string;
  tableColor: string;
  barColor: string;
}> = {
  bistro: {
    label: '明档快餐 / 面馆',
    subtitle: '后厨热菜煮面 + 前厅翻台客座',
    defaultKitchenPct: 32,
    defaultSeating: 'balanced',
    defaultTheme: 'oak-bistro',
    boothColor: '#49685c',
    chairColor: '#8d6247',
    tableColor: '#cfa777',
    barColor: '#52685f',
  },
  cafe: {
    label: '咖啡 / 茶饮烘焙',
    subtitle: '精简水吧操作区 + 大面积社交客座',
    defaultKitchenPct: 24,
    defaultSeating: 'comfort',
    defaultTheme: 'cream-cafe',
    boothColor: '#7a5a44',
    chairColor: '#9b6b4a',
    tableColor: '#e6e1d7',
    barColor: '#6d5543',
  },
  restaurant: {
    label: '精致中餐 / 聚餐小馆',
    subtitle: '独立后厨 + 卡座与聚餐桌组合',
    defaultKitchenPct: 36,
    defaultSeating: 'comfort',
    defaultTheme: 'warm-restaurant',
    boothColor: '#5c4338',
    chairColor: '#8c5e42',
    tableColor: '#b58454',
    barColor: '#56453a',
  },
  canteen: {
    label: '企业食堂 / 高效快餐',
    subtitle: '高承载长桌排布 + 明厨出餐动线',
    defaultKitchenPct: 35,
    defaultSeating: 'canteen-bench',
    defaultTheme: 'bright-canteen',
    boothColor: '#4c665a',
    chairColor: '#8f6c4a',
    tableColor: '#d4b284',
    barColor: '#6d7f78',
  },
};

export function defaultConceptOptions(businessType: ConceptBusinessType = 'bistro'): ConceptPlannerOptions {
  const d = businessTypeDefaults[businessType];
  return {
    businessType,
    kitchenSide: 'rear',
    kitchenRatioPct: d.defaultKitchenPct,
    seatingStyle: d.defaultSeating,
    aisleMm: 950,
    includeKitchenEquip: true,
    includeLights: true,
    themeId: d.defaultTheme,
  };
}

export type ConceptEstimate = {
  totalAreaSqm: number;
  kitchenAreaSqm: number;
  diningAreaSqm: number;
  kitchenPct: number;
  diningPct: number;
  tableGroups: number;
  seats: number;
  sqmPerSeat: number | null;
  seatBreakdown: string;
  estimatedPowerKw: number;
  budgetMin: number;
  budgetMax: number;
  comfortLabel: string;
  criticalConflicts: number;
  replacementNames: string[];
  nearestTables: ReturnType<typeof polygonDistance> | null;
  warnings: string[];
};

export type ConceptPlanResult = {
  project: Project;
  estimate: ConceptEstimate;
};

// --- Orthogonal polygon utilities ---

function isOrthogonalPolygon(pts: Point[]): boolean {
  if (pts.length < 4) return false;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    if (Math.abs(a.x - b.x) > 1e-6 && Math.abs(a.y - b.y) > 1e-6) return false;
  }
  return true;
}

function offsetOrthogonalInward(points: Point[], distance: number): Point[] {
  const area2 = points.reduce((sum, p, i) => {
    const n = points[(i + 1) % points.length];
    return sum + p.x * n.y - n.x * p.y;
  }, 0);
  const shift = -Math.sign(area2) * distance;
  return points.map((p, i) => {
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    return {
      x: Math.round(p.x + shift * (Math.sign(p.y - prev.y) + Math.sign(next.y - p.y))),
      y: Math.round(p.y - shift * (Math.sign(p.x - prev.x) + Math.sign(next.x - p.x))),
    };
  });
}

type StripRect = { x0: number; x1: number; y0: number; y1: number };

// Decompose any simple orthogonal polygon into exact horizontal non-overlapping rectangles.
function orthogonalStrips(poly: Point[]): StripRect[] {
  const ys = [...new Set(poly.map(p => p.y))].sort((a, b) => a - b);
  const rects: StripRect[] = [];
  for (let i = 0; i < ys.length - 1; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    if (y1 - y0 < 1) continue;
    const ym = (y0 + y1) / 2;
    const xs: number[] = [];
    for (let j = 0; j < poly.length; j++) {
      const a = poly[j], b = poly[(j + 1) % poly.length];
      if ((a.y <= ym && b.y > ym) || (b.y <= ym && a.y > ym)) {
        const t = (ym - a.y) / (b.y - a.y);
        xs.push(a.x + t * (b.x - a.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1] - xs[k] >= 1) rects.push({ x0: xs[k], x1: xs[k + 1], y0, y1 });
    }
  }
  return rects;
}

type HalfPlane = { axis: 'x' | 'y'; keepLess: boolean; value: number };

function clipRectHalfPlane(r: StripRect, hp: HalfPlane): StripRect | null {
  if (hp.axis === 'x') {
    const x0 = hp.keepLess ? r.x0 : Math.max(r.x0, hp.value);
    const x1 = hp.keepLess ? Math.min(r.x1, hp.value) : r.x1;
    return x1 - x0 >= 1 ? { x0, x1, y0: r.y0, y1: r.y1 } : null;
  }
  const y0 = hp.keepLess ? r.y0 : Math.max(r.y0, hp.value);
  const y1 = hp.keepLess ? Math.min(r.y1, hp.value) : r.y1;
  return y1 - y0 >= 1 ? { x0: r.x0, x1: r.x1, y0, y1 } : null;
}

function rectsArea(rects: StripRect[]): number {
  return rects.reduce((s, r) => s + (r.x1 - r.x0) * (r.y1 - r.y0), 0);
}

function clipPolygonHalfPlane(poly: Point[], hp: HalfPlane): Point[] {
  const inside = (p: Point) => hp.axis === 'x'
    ? (hp.keepLess ? p.x <= hp.value + 1e-6 : p.x >= hp.value - 1e-6)
    : (hp.keepLess ? p.y <= hp.value + 1e-6 : p.y >= hp.value - 1e-6);
  const intersect = (a: Point, b: Point): Point => {
    if (hp.axis === 'x') {
      const t = Math.abs(b.x - a.x) < 1e-9 ? 0 : (hp.value - a.x) / (b.x - a.x);
      return { x: hp.value, y: a.y + t * (b.y - a.y) };
    }
    const t = Math.abs(b.y - a.y) < 1e-9 ? 0 : (hp.value - a.y) / (b.y - a.y);
    return { x: a.x + t * (b.x - a.x), y: hp.value };
  };
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i], prev = poly[(i + poly.length - 1) % poly.length];
    const curIn = inside(cur), prevIn = inside(prev);
    if (curIn) {
      if (!prevIn) out.push(intersect(prev, cur));
      out.push(cur);
    } else if (prevIn) {
      out.push(intersect(prev, cur));
    }
  }
  // Deduplicate consecutive coincident and collinear vertices
  const dedup: Point[] = [];
  for (const p of out) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.5) dedup.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }
  if (dedup.length > 1 && Math.hypot(dedup[0].x - dedup[dedup.length - 1].x, dedup[0].y - dedup[dedup.length - 1].y) <= 0.5) {
    dedup.pop();
  }
  const clean: Point[] = [];
  for (let i = 0; i < dedup.length; i++) {
    const prev = dedup[(i + dedup.length - 1) % dedup.length];
    const cur = dedup[i];
    const next = dedup[(i + 1) % dedup.length];
    const cross = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
    if (Math.abs(cross) > 1) clean.push(cur);
  }
  return clean;
}

function makeZoneItemsFromRegion(
  poly: Point[],
  rects: StripRect[],
  hp: HalfPlane | null,
  name: string,
  color: string,
): Item[] {
  if (!rects.length) return [];
  const candidate = hp ? clipPolygonHalfPlane(poly, hp) : poly;
  if (candidate.length >= 3) {
    try {
      const patch = polygonPatch(candidate);
      const item: Item = {
        id: uid(), kind: 'zone', name, color, h: 0, ...patch,
      };
      // Verify it passes validateSite cleanly (catches disconnected/pinched U-shapes)
      validateSite({ width: item.w, height: item.d, outline: item.polygon!.map(p => ({ x: p.x * item.w, y: p.y * item.d })) });
      if (Math.abs(polygonArea(candidate) - rectsArea(rects)) < 1) {
        // Simplify pure rectangle zones to no polygon property
        if (candidate.length === 4 && Math.abs(polygonArea(candidate) - item.w * item.d) < 1) {
          return [{ id: item.id, kind: 'zone', name, color, x: item.x, y: item.y, w: item.w, d: item.d, h: 0, rotation: 0 }];
        }
        return [item];
      }
    } catch {
      // Fall through to clean rectangle strips for pinched concave shapes
    }
  }
  // Merge vertically adjacent strips with identical X spans
  const sorted = [...rects].sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
  const merged: StripRect[] = [];
  for (const r of sorted) {
    const prev = merged[merged.length - 1];
    if (prev && Math.abs(prev.x0 - r.x0) < 2 && Math.abs(prev.x1 - r.x1) < 2 && Math.abs(prev.y1 - r.y0) < 2) {
      prev.y1 = r.y1;
    } else {
      merged.push({ ...r });
    }
  }
  return merged.map((r, idx) => ({
    id: uid(), kind: 'zone' as const, name: merged.length > 1 ? `${name} ${idx + 1}` : name,
    color, x: Math.round(r.x0), y: Math.round(r.y0), w: Math.round(r.x1 - r.x0), d: Math.round(r.y1 - r.y0), h: 0, rotation: 0,
  }));
}

function pointInRects(pt: Point, rects: StripRect[]): boolean {
  return rects.some(r => pt.x >= r.x0 - 1 && pt.x <= r.x1 + 1 && pt.y >= r.y0 - 1 && pt.y <= r.y1 + 1);
}

function polyInsideRects(poly: Point[], rects: StripRect[]): boolean {
  if (!poly.every(p => pointInRects(p, rects))) return false;
  // Also check edge midpoints and centroid so concave notches aren't bridged
  let cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    cx += a.x; cy += a.y;
    if (!pointInRects({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, rects)) return false;
  }
  return pointInRects({ x: cx / poly.length, y: cy / poly.length }, rects);
}

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isPerimeterWall(wall: Item, outline: Point[]): boolean {
  const center = { x: wall.x + wall.w / 2, y: wall.y + wall.d / 2 };
  const tol = Math.max(wall.d, 260);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if (pointToSegmentDist(center, a, b) <= tol) return true;
  }
  return false;
}

function extractInteriorPolygon(project: Project): Point[] {
  if (project.survey) {
    const walls = project.items.filter(i => project.survey!.wallIds.includes(i.id));
    if (walls.length !== project.survey.wallIds.length || walls.some(w => !surveyWall(project, w))) {
      throw Error('实测外墙已调整，请先复核墙段后再试排');
    }
    return project.survey.corners;
  }
  const outline = siteOutline(project);
  const perimeter = project.items.filter(i => i.kind === 'wall' && isPerimeterWall(i, outline));
  if (perimeter.length) {
    const thickness = Math.max(...perimeter.map(w => w.d));
    const inset = offsetOrthogonalInward(outline, thickness);
    try {
      validateSite({ width: project.width, height: project.height, outline: inset });
      if (polygonArea(inset) > 100000) return inset;
    } catch {
      // Fallback to outline if inset self-intersects on ultra-narrow shell
    }
  }
  return outline;
}

// --- Seating & equipment builders ---

function makeBooth4(cx: number, cy: number, boothColor: string, tableColor: string): Item[] {
  return [
    { id: uid(), kind: 'table', model: 'booth-table', name: '四人卡座餐桌', x: Math.round(cx - 600), y: Math.round(cy - 375), w: 1200, d: 750, h: 750, rotation: 0, color: tableColor, seats: 0 },
    { id: uid(), kind: 'chair', model: 'curved-booth', name: '软包靠背卡座', x: Math.round(cx - 600), y: Math.round(cy - 1030), w: 1200, d: 620, h: 1040, rotation: 0, color: boothColor, seats: 2 },
    { id: uid(), kind: 'chair', model: 'curved-booth', name: '软包靠背卡座', x: Math.round(cx - 600), y: Math.round(cy + 410), w: 1200, d: 620, h: 1040, rotation: 180, color: boothColor, seats: 2 },
  ];
}

function makeDining4(cx: number, cy: number, chairColor: string, tableColor: string, compact = false): Item[] {
  const tw = compact ? 1100 : 1200, td = compact ? 750 : 800;
  const cw = compact ? 440 : 480, cd = cw;
  const m = compact ? 'chair' as const : 'dining-armchair' as const;
  const label = compact ? '餐椅' : '软包扶手餐椅';
  const items: Item[] = [
    { id: uid(), kind: 'table', model: 'rect-table', name: '四人餐桌', x: Math.round(cx - tw / 2), y: Math.round(cy - td / 2), w: tw, d: td, h: 750, rotation: 0, color: tableColor, seats: 0 },
  ];
  for (const sy of [-1, 1]) {
    for (const sx of [-1, 1]) {
      items.push({
        id: uid(), kind: 'chair', model: m, name: label,
        x: Math.round(cx + sx * (tw * 0.24) - cw / 2),
        y: Math.round(cy + (sy < 0 ? -td / 2 - cd - 55 : td / 2 + 55)),
        w: cw, d: cd, h: 800, rotation: sy < 0 ? 0 : 180, color: chairColor, seats: 1,
      });
    }
  }
  return items;
}

function makeDining2(cx: number, cy: number, chairColor: string, tableColor: string, round = false): Item[] {
  const t: Item = round
    ? { id: uid(), kind: 'table', model: 'marble-round-table', name: '双人圆桌', x: Math.round(cx - 380), y: Math.round(cy - 380), w: 760, d: 760, h: 750, rotation: 0, color: '#e6e1d7', seats: 0 }
    : { id: uid(), kind: 'table', model: 'rect-table', name: '双人餐桌', x: Math.round(cx - 375), y: Math.round(cy - 350), w: 750, d: 700, h: 750, rotation: 0, color: tableColor, seats: 0 };
  const half = t.w / 2;
  return [
    t,
    { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: Math.round(cx - half - 510), y: Math.round(cy - 230), w: 460, d: 460, h: 800, rotation: -90, color: chairColor, seats: 1 },
    { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: Math.round(cx + half + 50), y: Math.round(cy - 230), w: 460, d: 460, h: 800, rotation: 90, color: chairColor, seats: 1 },
  ];
}

function makeCanteen6(cx: number, cy: number): Item[] {
  return [
    { id: uid(), kind: 'table', model: 'rect-table', name: '六人长桌', x: Math.round(cx - 900), y: Math.round(cy - 400), w: 1800, d: 800, h: 750, rotation: 0, color: '#d4b284', seats: 0 },
    { id: uid(), kind: 'chair', model: 'bench', name: '长凳', x: Math.round(cx - 800), y: Math.round(cy - 840), w: 1600, d: 380, h: 450, rotation: 0, color: '#c49d6e', seats: 3 },
    { id: uid(), kind: 'chair', model: 'bench', name: '长凳', x: Math.round(cx - 800), y: Math.round(cy + 460), w: 1600, d: 380, h: 450, rotation: 0, color: '#c49d6e', seats: 3 },
  ];
}

function makeRound6(cx: number, cy: number, chairColor: string, tableColor: string): Item[] {
  const items: Item[] = [
    { id: uid(), kind: 'table', model: 'round-table', name: '六人圆桌', x: Math.round(cx - 725), y: Math.round(cy - 725), w: 1450, d: 1450, h: 750, rotation: 0, color: tableColor, seats: 0 },
  ];
  for (let n = 0; n < 6; n++) {
    const a = (n * Math.PI) / 3;
    items.push({
      id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅',
      x: Math.round(cx + Math.cos(a) * 1010 - 230), y: Math.round(cy + Math.sin(a) * 1010 - 230),
      w: 460, d: 460, h: 800, rotation: Math.round((a * 180) / Math.PI + 90), color: chairColor, seats: 1,
    });
  }
  return items;
}

function isSeatFurniture(i: Item) { return i.kind === 'table' || i.kind === 'chair'; }

function bounded(points: Point[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { points, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
type BoundedFootprint = ReturnType<typeof bounded>;

// A gap between bounding boxes is a lower bound on the exact polygon distance.
function boxGap(a: StripRect, b: StripRect) {
  return Math.max(0, a.x0 - b.x1, b.x0 - a.x1, a.y0 - b.y1, b.y0 - a.y1);
}
function closerThan(a: BoundedFootprint, b: BoundedFootprint, gap: number) {
  return boxGap(a, b) < gap && polygonDistance(a.points, b.points).distance < gap;
}

function nearestTableGap(project: Project) {
  const group = new Map(project.groups?.flatMap(g => g.members.map(id => [id, g.id] as const)));
  const bodies = project.items.filter(i => !i.hidden && isSeatFurniture(i))
    .map(i => ({ group: group.get(i.id) ?? i.id, shape: bounded(footprint(i)) }));
  let nearest: ReturnType<typeof polygonDistance> | null = null;
  for (let n = 0; n < bodies.length; n++) {
    const a = bodies[n];
    for (let m = 0; m < n; m++) {
      const b = bodies[m];
      if (a.group === b.group || (nearest && boxGap(a.shape, b.shape) >= nearest.distance)) continue;
      const gap = polygonDistance(a.shape.points, b.shape.points);
      if (!nearest || gap.distance < nearest.distance) nearest = gap;
    }
  }
  return nearest;
}

export function generateConceptLayout(baseProject: Project, rawOptions: ConceptPlannerOptions): ConceptPlanResult {
  const options: ConceptPlannerOptions = {
    ...rawOptions,
    kitchenRatioPct: Math.max(20, Math.min(50, Math.round(rawOptions.kitchenRatioPct))),
    aisleMm: Math.max(650, Math.min(1600, Math.round(rawOptions.aisleMm))),
  };
  const preset = businessTypeDefaults[options.businessType];
  const outline = siteOutline(baseProject);
  const warnings: string[] = [];

  if (!isOrthogonalPolygon(outline)) throw Error('试排仅支持直角铺位，当前外轮廓含斜边');
  const fixedKinds = new Set<Item['kind']>(['wall', 'partition', 'door', 'window', 'column', 'stairs', 'fixture', 'utility']);
  // Schematic items the planner itself generated (storefront door/window, open-kitchen partition) are
  // regenerated on every run instead of becoming permanent obstacles — unless the owner locked them.
  const isRegenerable = (i: Item) => i.generated === 'concept' && !i.locked;
  const preservedIds = new Set(baseProject.items.filter(i => !isRegenerable(i) && (i.locked || fixedKinds.has(i.kind) || isAnnotation(i))).map(i => i.id));
  // Keep the objects that a retained measurement or supported item refers to.
  for (const i of baseProject.items) {
    if (preservedIds.has(i.id) && i.measure) {
      preservedIds.add(i.measure.a);
      preservedIds.add(i.measure.b);
    }
  }
  for (const i of baseProject.items) {
    if (preservedIds.has(i.id) && i.supportId) preservedIds.add(i.supportId);
  }
  const preservedItems = baseProject.items.filter(i => preservedIds.has(i.id))
    .map(i => i.zoneId && !preservedIds.has(i.zoneId) ? { ...i, zoneId: undefined } : i);
  const preservedGroups = (baseProject.groups ?? []).filter(g => g.members.every(id => preservedIds.has(id)));
  const replacementNames = baseProject.items.filter(i => !preservedIds.has(i.id)).map(i => i.name);

  const interiorPoly = extractInteriorPolygon(baseProject);
  const interiorStrips = orthogonalStrips(interiorPoly);
  const totalNetAreaMm2 = rectsArea(interiorStrips);
  if (!totalNetAreaMm2) throw Error('室内轮廓没有可用面积');

  // 2. Exact half-plane split of the real orthogonal interior polygon
  let kitchenStrips: StripRect[] = [];
  let diningStrips: StripRect[] = interiorStrips;
  let kitchenHp: HalfPlane | null = null;
  let diningHp: HalfPlane | null = null;
  if (options.kitchenSide !== 'none') {
    const targetArea = options.kitchenRatioPct / 100 * totalNetAreaMm2;
    const axis = options.kitchenSide === 'rear' ? 'y' : 'x';
    const keepLess = options.kitchenSide !== 'right';
    const coordinates = interiorPoly.map(p => p[axis]);
    let lo = Math.min(...coordinates), hi = Math.max(...coordinates);
    while (hi - lo > 0.25) {
      const value = (lo + hi) / 2;
      const clipped = interiorStrips.map(r => clipRectHalfPlane(r, { axis, keepLess, value }));
      const area = rectsArea(clipped.filter((r): r is StripRect => !!r));
      if ((area < targetArea) === keepLess) lo = value;
      else hi = value;
    }
    kitchenHp = { axis, keepLess, value: Math.round((lo + hi) / 2) };
    diningHp = { ...kitchenHp, keepLess: !keepLess };
    kitchenStrips = interiorStrips.map(r => clipRectHalfPlane(r, kitchenHp!)).filter((r): r is StripRect => !!r);
    diningStrips = interiorStrips.map(r => clipRectHalfPlane(r, diningHp!)).filter((r): r is StripRect => !!r);
  }

  const kitchenAreaMm2 = rectsArea(kitchenStrips);
  const diningAreaMm2 = rectsArea(diningStrips);

  // Build exact non-overlapping zone polygons
  const zoneItems: Item[] = [];
  if (kitchenStrips.length > 0) {
    const kName = options.businessType === 'cafe' ? '水吧操作与备餐区' : '后厨与明档区';
    zoneItems.push(...makeZoneItemsFromRegion(interiorPoly, kitchenStrips, kitchenHp, kName, '#f7ece0'));
  }
  if (diningStrips.length > 0) {
    zoneItems.push(...makeZoneItemsFromRegion(interiorPoly, diningStrips, diningHp, '前厅就餐区', '#e6f0e6'));
  }

  // 3. Collision & obstacle engine respecting EVERY preserved wall, door swing, column, fixture, utility
  const placedInterior: Item[] = [];
  const placedPolys: BoundedFootprint[] = [];
  const newGroups: LayoutGroup[] = [];
  const tableCenters: { x: number; y: number; linear: boolean }[] = [];
  const seatMix = new Map<string, { count: number; seats: number }>();

  // Optional: when the shell has zero doors yet, place a schematic storefront door & window on the front-most wall
  // before seating placement so door swings are strictly respected.
  const existingDoorsInit = preservedItems.filter(i => i.kind === 'door');
  if (options.includeStorefront && existingDoorsInit.length === 0) {
    const frontWalls = preservedItems
      .filter(i => i.kind === 'wall' && !i.locked && !i.hidden && i.w >= 1600)
      .sort((a, b) => {
        const ay = a.y + a.d / 2, by = b.y + b.d / 2;
        if (Math.abs(by - ay) > 400) return by - ay;
        return b.w - a.w;
      });
    const fw = frontWalls[0];
    if (fw) {
      const datum = surveyWall(baseProject, fw);
      const minOff = datum ? datum.minOffset : 50;
      const maxEnd = datum ? datum.maxEnd : fw.w - 50;
      const usableSpan = maxEnd - minOff;
      const doorW = Math.min(1800, Math.max(1000, Math.round(usableSpan * 0.22)));
      const doorH = Math.min(2300, Math.max(1900, fw.h - 220));
      if (usableSpan >= doorW + 100 && doorH >= 1800) {
        const doorCand: Item = {
          id: uid(), kind: 'door', model: 'glass-double-door', name: '临街双开玻璃门',
          w: doorW, d: fw.d, h: doorH, x: 0, y: 0, rotation: fw.rotation,
          wallId: fw.id, offset: 50, sill: 0, color: '#455961', flipped: true, generated: 'concept',
        };
        const preferred = Math.round(minOff + (usableSpan - doorW) / 2);
        const offset = openingSlot(fw, doorCand, preservedItems, preferred, { min: minOff, maxEnd });
        if (offset !== undefined && offset >= minOff - 0.1 && offset + doorW <= maxEnd + 0.1) {
          const center = wallPoint(fw, offset + doorW / 2);
          const placedDoor: Item = { ...doorCand, offset, x: center.x - doorW / 2, y: center.y - fw.d / 2 };
          placedInterior.push(placedDoor);
          // Add flanking storefront window if plenty of front facade remains
          const winW = Math.min(2600, Math.round((offset - minOff) - 240));
          const winH = Math.min(2200, fw.h - 360);
          if (winW >= 1000 && winH >= 900) {
            const winCand: Item = {
              id: uid(), kind: 'window', model: 'storefront-window', name: '临街落地橱窗',
              w: winW, d: fw.d, h: winH, x: 0, y: 0, rotation: fw.rotation,
              wallId: fw.id, offset: 50, sill: 150, color: '#455961', generated: 'concept',
            };
            const winOff = openingSlot(fw, winCand, [...preservedItems, placedDoor], Math.round(minOff + 120), { min: minOff, maxEnd });
            if (winOff !== undefined && winOff >= minOff - 0.1 && winOff + winW <= maxEnd + 0.1) {
              const wc = wallPoint(fw, winOff + winW / 2);
              placedInterior.push({ ...winCand, offset: winOff, x: wc.x - winW / 2, y: wc.y - fw.d / 2 });
            }
          }
        }
      }
    }
  }

  const hardObstacles = preservedItems.filter(i => !isAnnotation(i) && i.kind !== 'zone' && i.kind !== 'door' && i.kind !== 'window' && i.kind !== 'lighting');
  const hardPolys = hardObstacles.map(i => ({ shape: bounded(footprint(i)), seating: isSeatFurniture(i) }));
  const existingDoors = [...existingDoorsInit, ...placedInterior.filter(i => i.kind === 'door')];
  const swingPolys = existingDoors.flatMap(doorSwings).map(bounded);
  if (!existingDoors.length) warnings.push('尚未放置门，试排未预留门扇开启空间');
  if (!preservedItems.some(i => i.kind === 'utility' && i.pointType === 'entrance' && !i.hidden)) {
    warnings.push('尚未标明顾客入口，可添加入口点位后复核进店路线');
  }

  const fitsInRegion = (
    cand: Item[],
    region: StripRect[],
    wallGap: number,
    otherGap: number,
    doorGap = 120,
  ): boolean => {
    for (const item of cand) {
      const fp = footprint(item);
      const shape = bounded(fp);
      if (!contains(outline, fp)) return false;
      if (!polyInsideRects(fp, region)) return false;
      for (const sw of swingPolys) {
        if (closerThan(shape, sw, doorGap)) return false;
      }
      for (const hp of hardPolys) {
        const gap = hp.seating && isSeatFurniture(item) ? options.aisleMm : wallGap;
        if (closerThan(shape, hp.shape, gap)) return false;
      }
      for (const pp of placedPolys) {
        if (closerThan(shape, pp, otherGap)) return false;
      }
    }
    return true;
  };

  const commitPlaced = (items: Item[]) => {
    for (const item of items) {
      placedInterior.push(item);
      placedPolys.push(bounded(footprint(item)));
    }
  };

  // 4. Smart Kitchen & Bar Equipment Placement inside kitchenStrips (WallFloorItem pattern)
  if (options.includeKitchenEquip && kitchenStrips.length > 0) {
    const kMinX = Math.min(...kitchenStrips.map(r => r.x0));
    const kMaxX = Math.max(...kitchenStrips.map(r => r.x1));
    const kMinY = Math.min(...kitchenStrips.map(r => r.y0));
    const kMaxY = Math.max(...kitchenStrips.map(r => r.y1));

    type EquipSpec = Omit<Item, 'id' | 'x' | 'y' | 'rotation'> & { isCooking?: boolean };
    const cooklineSpecs: EquipSpec[] = options.businessType === 'cafe'
      ? [
        { kind: 'counter', model: 'tea-bar', name: '精品咖啡水吧台', w: 2200, d: 720, h: 1050, color: preset.barColor },
        { kind: 'sink', model: 'sink', name: '吧台洗涤池', w: 900, d: 640, h: 850, color: '#a5b7c0' },
        { kind: 'fridge', model: 'upright-fridge', name: '立式双门冰箱', w: 820, d: 720, h: 1960, color: '#9bb4c2' },
      ]
      : [
        { kind: 'stove', model: options.businessType === 'bistro' ? 'noodle-cooker' : 'stove', name: options.businessType === 'bistro' ? '六孔煮面炉' : '双头炉灶', w: 1100, d: 780, h: 860, color: '#adbac0', isCooking: true },
        { kind: 'stove', model: 'stove', name: '双头炉灶', w: 1200, d: 800, h: 850, color: '#96a3aa', isCooking: true },
        { kind: 'sink', model: 'sink', name: '双槽洗涤池', w: 1200, d: 660, h: 850, color: '#a5b7c0' },
        { kind: 'fridge', model: 'upright-fridge', name: '立式双门冰箱', w: 820, d: 740, h: 1960, color: '#9bb4c2' },
      ];

    const rear = options.kitchenSide === 'rear', right = options.kitchenSide === 'right';
    const alongMin = rear ? kMinX : kMinY, alongMax = rear ? kMaxX : kMaxY;
    const depth = rear ? kMaxY - kMinY : kMaxX - kMinX;
    const missing: string[] = [];

    // The same wall-relative coordinates work for all three kitchen orientations.
    function atWall(spec: Omit<Item, 'id' | 'x' | 'y' | 'rotation'>, along: number, inset: number): Item {
      const cx = rear ? along + spec.w / 2 : right ? kMaxX - inset - spec.d / 2 : kMinX + inset + spec.d / 2;
      const cy = rear ? kMinY + inset + spec.d / 2 : along + spec.w / 2;
      return { ...spec, id: uid(), x: cx - spec.w / 2, y: cy - spec.d / 2, rotation: rear ? 0 : right ? 90 : -90 };
    }

    function placeAlongWall(spec: Omit<Item, 'id' | 'x' | 'y' | 'rotation'>, inset: number, reverse = false) {
      const first = alongMin + 60, last = alongMax - spec.w - 60;
      for (let step = 0; step <= Math.ceil((last - first) / 100) && first <= last; step++) {
        const along = reverse ? Math.max(first, last - step * 100) : Math.min(last, first + step * 100);
        const item = atWall(spec, along, inset);
        if (fitsInRegion([item], kitchenStrips, 20, reverse ? 260 : 40)) {
          commitPlaced([item]);
          return along;
        }
      }
      missing.push(spec.name);
    }

    for (const { isCooking, ...spec } of cooklineSpecs) {
      const along = placeAlongWall(spec, 60);
      if (isCooking && along !== undefined) {
        const hood = atWall({ kind: 'stove', model: 'hood', name: '排烟罩', w: spec.w, d: 920, h: 2450, color: '#adb8bc' }, along, 40);
        // Overhead hoods share the stove footprint. Only the fixed obstacles constrain them.
        if (fitsInRegion([hood], kitchenStrips, 20, 0)) placedInterior.push(hood);
        else missing.push(hood.name);
      }
    }
    if (cooklineSpecs.some(spec => spec.isCooking) && !placedInterior.some(i => i.model === 'hood') && !missing.includes('排烟罩')) {
      missing.push('排烟罩');
    }
    const barW = Math.min(1800, Math.max(1100, Math.round((alongMax - alongMin) * 0.28)));
    placeAlongWall({ kind: 'counter', model: 'cashier', name: '收银出餐台', w: barW, d: 660, h: 1080, color: preset.barColor }, depth - 760, true);

    // Optional open-kitchen low partition along the remaining seam leaving wide pass-through circulation
    if (options.includePartition && !preservedItems.some(i => i.kind === 'partition') && depth >= 1600) {
      const partW = Math.min(3200, Math.round((alongMax - alongMin) * 0.44));
      if (partW >= 1000) {
        const partItem = atWall({ kind: 'partition', model: 'partition', name: '明档半高隔断', w: partW, d: 120, h: 1180, color: '#e6dfd3' }, alongMin + 80, depth - 180);
        partItem.generated = 'concept';
        if (fitsInRegion([partItem], kitchenStrips, 40, 120, 180)) {
          commitPlaced([partItem]);
        }
      }
    }

    if (missing.length) warnings.push('未摆入的厨具设备：' + missing.join('、'));
  }

  // 5. Smart Collision-Free Dining Seating Packing inside diningStrips
  if (diningStrips.length > 0) {
    const dMinX = Math.min(...diningStrips.map(r => r.x0));
    const dMaxX = Math.max(...diningStrips.map(r => r.x1));
    const dMinY = Math.min(...diningStrips.map(r => r.y0));
    const dMaxY = Math.max(...diningStrips.map(r => r.y1));

    // Keep an inviting path right inside existing exterior doors
    const doorEntries = existingDoors.map(d => ({
      x: d.x + d.w / 2,
      y: d.y + d.d / 2,
      halfSpan: Math.max(600, d.w * 0.45),
    }));
    const blocksEntryCorridor = (cx: number, cy: number) => doorEntries.some(e => Math.hypot(cx - e.x, cy - e.y) < e.halfSpan + 750);

    const recordGroup = (label: string, groupType: string, items: Item[], seats: number, center: { x: number; y: number }, linear: boolean) => {
      commitPlaced(items);
      newGroups.push({ id: uid(), name: label, members: items.map(i => i.id), seats });
      tableCenters.push({ ...center, linear });
      const cur = seatMix.get(groupType) ?? { count: 0, seats: 0 };
      seatMix.set(groupType, { count: cur.count + 1, seats: cur.seats + seats });
    };

    const aisle = options.aisleMm;
    const diningSpanX = dMaxX - dMinX;

    // Step 5a: Wall-hugging booth column(s) for balanced / comfort styles (WallFloorItem pattern)
    const tryBoothColumn = (colX: number, prefix: string) => {
      const stepY = options.seatingStyle === 'comfort' ? 2550 : 2300;
      let idx = 1;
      for (let cy = dMinY + 1120; cy <= dMaxY - 1080;) {
        if (!blocksEntryCorridor(colX, cy)) {
          const cand = makeBooth4(colX, cy, preset.boothColor, preset.tableColor);
          if (fitsInRegion(cand, diningStrips, 40, aisle, 180)) {
            recordGroup(`${prefix} ${idx++}`, '四人卡座', cand, 4, { x: colX, y: cy }, true);
            cy += stepY;
            continue;
          }
        }
        cy += 450;
      }
    };

    if ((options.seatingStyle === 'balanced' || options.seatingStyle === 'comfort') && diningSpanX >= 4600) {
      if (options.kitchenSide !== 'left') tryBoothColumn(dMinX + 680, '靠墙卡座');
      if (options.kitchenSide !== 'right' && diningSpanX >= 7400) tryBoothColumn(dMaxX - 680, '雅致卡座');
    }

    // Step 5b: Adaptive 2D floor grid packing inside the remaining dining strips
    const isBench = options.seatingStyle === 'canteen-bench';
    const isCompact = options.seatingStyle === 'compact';
    const isComfort = options.seatingStyle === 'comfort';
    const xStep = isBench
      ? 1800 + Math.max(750, aisle)
      : isComfort && options.businessType === 'restaurant'
        ? 2350 + Math.max(800, aisle)
        : isCompact
          ? 1150 + Math.max(700, aisle)
          : 1220 + Math.max(750, aisle);
    const yStep = isBench
      ? 1720 + Math.max(700, aisle)
      : isComfort && options.businessType === 'restaurant'
        ? 2350 + Math.max(800, aisle)
        : isCompact
          ? 1780 + aisle
          : 1920 + Math.max(720, aisle);

    const startX = dMinX + (isBench ? 960 : 720);
    const startY = dMinY + (isBench ? 900 : 960);
    let tableIdx = 1;

    for (let cy = startY; cy <= dMaxY - 680;) {
      const beforeRow = tableIdx;
      for (let cx = startX; cx <= dMaxX - 640;) {
        if (blocksEntryCorridor(cx, cy)) { cx += 450; continue; }
        let placedThisSpot = false;
        if (isBench) {
          const c6 = makeCanteen6(cx, cy);
          if (fitsInRegion(c6, diningStrips, 120, aisle, 180)) {
            recordGroup(`六人长桌 ${tableIdx++}`, '六人长桌', c6, 6, { x: cx, y: cy }, true);
            placedThisSpot = true;
          } else {
            const c4 = makeDining4(cx, cy, preset.chairColor, preset.tableColor, true);
            if (fitsInRegion(c4, diningStrips, 120, aisle, 180)) {
              recordGroup(`四人餐桌 ${tableIdx++}`, '四人桌', c4, 4, { x: cx, y: cy }, true);
              placedThisSpot = true;
            }
          }
        } else if (isComfort && options.businessType === 'restaurant') {
          const r6 = makeRound6(cx, cy, preset.chairColor, preset.tableColor);
          if (fitsInRegion(r6, diningStrips, 140, aisle, 180)) {
            recordGroup(`六人圆桌 ${tableIdx++}`, '六人圆桌', r6, 6, { x: cx, y: cy }, false);
            placedThisSpot = true;
          } else {
            const c4 = makeDining4(cx, cy, preset.chairColor, preset.tableColor, false);
            if (fitsInRegion(c4, diningStrips, 120, aisle, 180)) {
              recordGroup(`四人餐桌 ${tableIdx++}`, '四人桌', c4, 4, { x: cx, y: cy }, true);
              placedThisSpot = true;
            }
          }
        } else if (options.businessType === 'cafe') {
          const useFour = tableIdx % 3 === 0 && !isCompact;
          const cand = useFour
            ? makeDining4(cx, cy, preset.chairColor, '#cfa97a', false)
            : makeDining2(cx, cy, preset.chairColor, preset.tableColor, true);
          if (fitsInRegion(cand, diningStrips, 100, aisle, 180)) {
            recordGroup(useFour ? `四人咖啡桌 ${tableIdx++}` : `双人圆桌 ${tableIdx++}`, useFour ? '四人桌' : '双人桌', cand, useFour ? 4 : 2, { x: cx, y: cy }, useFour);
            placedThisSpot = true;
          }
        } else {
          const c4 = makeDining4(cx, cy, preset.chairColor, preset.tableColor, isCompact);
          if (fitsInRegion(c4, diningStrips, 100, aisle, 180)) {
            recordGroup(`四人餐桌 ${tableIdx++}`, '四人桌', c4, 4, { x: cx, y: cy }, true);
            placedThisSpot = true;
          } else {
            const c2 = makeDining2(cx, cy, preset.chairColor, preset.tableColor, false);
            if (fitsInRegion(c2, diningStrips, 90, aisle, 180)) {
              recordGroup(`双人餐桌 ${tableIdx++}`, '双人桌', c2, 2, { x: cx, y: cy }, false);
              placedThisSpot = true;
            }
          }
        }
        cx += placedThisSpot ? xStep : 420;
      }
      cy += tableIdx > beforeRow ? yStep : 450;
    }
  }

  // 6. Optional subtle dining pendant lights over placed table groups
  const style = resolveStyle(baseProject);
  const chosenTheme = options.themeId === 'keep' ? null : decorThemePresets.find(t => t.id === options.themeId) ?? null;
  const nextStyle = chosenTheme
    ? { ...style, floorMaterial: chosenTheme.floorMaterial, wallMaterial: chosenTheme.wallMaterial, lightingPreset: chosenTheme.lightingPreset }
    : style;

  if (options.includeLights) {
    const lightElev = Math.max(1900, nextStyle.ceilingHeight - 920);
    for (const tc of tableCenters.slice(0, 12)) {
      const lamp: Item = tc.linear
        ? { id: uid(), kind: 'lighting', model: 'linear-light', name: '条形餐桌吊灯', x: Math.round(tc.x - 520), y: Math.round(tc.y - 70), w: 1040, d: 140, h: 480, rotation: 0, elevation: lightElev, color: '#2f3538' }
        : { id: uid(), kind: 'lighting', model: 'pendant-lamp', name: '暖光餐桌吊灯', x: Math.round(tc.x - 200), y: Math.round(tc.y - 200), w: 400, d: 400, h: 620, rotation: 0, elevation: lightElev, color: '#d7a15a' };
      if (contains(outline, footprint(lamp))) {
        placedInterior.push(lamp);
      }
    }
  }

  // Applying and saving a variant must both produce a project the reader can open.
  const candidate = parseProject({
    ...baseProject,
    clearance: options.aisleMm,
    style: nextStyle,
    items: [...zoneItems, ...preservedItems, ...placedInterior],
    groups: [...preservedGroups, ...newGroups],
  });

  const insights = analyzeShop(candidate);
  const criticalConflicts = checkSpace(candidate, null).filter(i => i.type !== '参考净距').length;
  const totalAreaSqm = totalNetAreaMm2 / 1e6;
  const kitchenAreaSqm = kitchenAreaMm2 / 1e6;
  const diningAreaSqm = diningAreaMm2 / 1e6;
  const kitchenPct = totalAreaSqm > 0 ? Math.round((kitchenAreaSqm / totalAreaSqm) * 100) : 0;
  const diningPct = totalAreaSqm > 0 ? Math.max(0, 100 - kitchenPct) : 0;

  const breakdownParts = [...seatMix.entries()].map(([name, v]) => `${name} ${v.count} 组（${v.seats} 座）`);
  const seatBreakdown = breakdownParts.length ? breakdownParts.join(' + ') : '空间较紧凑，暂未摆入标准桌椅组';
  if (newGroups.length === 0) {
    warnings.push('当前就餐区净尺寸或过道设置偏紧，建议调低后厨占比或将过道净距调整至 800 mm');
  }

  const nearestTables = nearestTableGap(candidate);
  if (nearestTables && nearestTables.distance < options.aisleMm - 0.01) {
    warnings.push('已有桌椅间距小于所选净距，请复核保留的桌椅位置');
  }

  return {
    project: candidate,
    estimate: {
      totalAreaSqm,
      kitchenAreaSqm,
      diningAreaSqm,
      kitchenPct,
      diningPct,
      tableGroups: newGroups.length,
      seats: insights.seats,
      sqmPerSeat: insights.sqmPerSeat,
      seatBreakdown,
      estimatedPowerKw: insights.estimatedPowerKw,
      budgetMin: insights.budgetMin,
      budgetMax: insights.budgetMax,
      comfortLabel: insights.comfortLabel,
      criticalConflicts,
      replacementNames,
      nearestTables,
      warnings,
    },
  };
}
