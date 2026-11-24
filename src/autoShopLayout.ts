import {
  FloorMaterial, Item, LightingPreset, Point, Project, ProjectStyle, WallMaterial,
  projectIdentity, resolveStyle, uid,
} from './model';
import { segmentPose, syncStructure } from './structure';
import { siteOutline } from './site';
import { baseHeight, contains, doorSwings, footprint, polygonDistance, supportFor } from './spatial';
import { isAnnotation } from './annotations';
import { seatSummary } from './layoutGroups';

export type ShopBusinessType = 'bistro' | 'cafe' | 'restaurant' | 'canteen';
export type LayoutStrategy = 'balanced' | 'high-capacity' | 'comfort';
export type KitchenSide = 'rear' | 'left';

export type AutoShopSpec = {
  name: string;
  widthM: number;
  depthM: number;
  ceilingM: number;
  shape: 'rectangle' | 'l-shape';
  businessType: ShopBusinessType;
  strategy: LayoutStrategy;
  kitchenSide: KitchenSide;
  floorMaterial: FloorMaterial;
  wallMaterial: WallMaterial;
  lightingPreset: LightingPreset;
};

export const businessTypePresets: Record<ShopBusinessType, {
  label: string;
  subtitle: string;
  shopType: string;
  floor: FloorMaterial;
  wall: WallMaterial;
  lighting: LightingPreset;
  boothColor: string;
  chairColor: string;
  tableColor: string;
  barColor: string;
  signColor: string;
}> = {
  bistro: {
    label: '明档快餐 / 面馆',
    subtitle: '前厅客区 + 明档出餐窗 + 水吧收银',
    shopType: '商场明档快餐 / 面馆',
    floor: 'terrazzo',
    wall: 'warm-cream',
    lighting: 'warm-dining',
    boothColor: '#49685c',
    chairColor: '#8d6247',
    tableColor: '#cfa777',
    barColor: '#52685f',
    signColor: '#223e34',
  },
  cafe: {
    label: '精品咖啡 / 烘焙茶饮',
    subtitle: '高颜值咖啡甜品吧台 + 舒适社交散座',
    shopType: '精品咖啡 / 茶饮烘焙铺',
    floor: 'oak-wood',
    wall: 'warm-cream',
    lighting: 'warm-dining',
    boothColor: '#7a5a44',
    chairColor: '#9b6b4a',
    tableColor: '#e6e1d7',
    barColor: '#6d5543',
    signColor: '#2c3d34',
  },
  restaurant: {
    label: '精致中餐 / 主题小馆',
    subtitle: '半包卡座 + 聚餐圆桌 + 独立热厨动线',
    shopType: '商场精品中餐 / 主题小馆',
    floor: 'oak-wood',
    wall: 'wood-panel',
    lighting: 'evening',
    boothColor: '#5c4338',
    chairColor: '#8c5e42',
    tableColor: '#b58454',
    barColor: '#56453a',
    signColor: '#3a2922',
  },
  canteen: {
    label: '企业食堂 / 自助档口',
    subtitle: '高效自助取餐线 + 长桌批量客座 + 后厨洗消',
    shopType: '企业食堂 / 自助美食档口',
    floor: 'warm-tile',
    wall: 'plaster',
    lighting: 'daylight',
    boothColor: '#506b60',
    chairColor: '#c49d6e',
    tableColor: '#d4b284',
    barColor: '#5e736b',
    signColor: '#254238',
  },
};

export const strategyMeta: Record<LayoutStrategy, { label: string; badge: string; summary: string }> = {
  balanced: {
    label: '均衡经典摆法',
    badge: '推荐均衡',
    summary: '卡座 + 散台搭配，兼顾客座数量与进店呼吸感',
  },
  'high-capacity': {
    label: '高坪效翻台摆法',
    badge: '紧凑排布',
    summary: '紧凑 2/4 人散台阵列 + 临窗吧台，最大化坪效收益',
  },
  comfort: {
    label: '宽敞品质体验摆法',
    badge: '宽敞舒适',
    summary: '增加桌组间距并预留软装空间，更适合客单价较高的社交餐饮',
  },
};

function insetPolygon(pts: Point[], inset: number): Point[] {
  if (pts.length < 3) return pts;
  let area2 = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    area2 += a.x * b.y - b.x * a.y;
  }
  const orient = area2 >= 0 ? 1 : -1;
  const edgeDir = (a: Point, b: Point) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const tx = (b.x - a.x) / len, ty = (b.y - a.y) / len;
    return { tx, ty, nx: -orient * ty, ny: orient * tx };
  };
  return pts.map((curr, i) => {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const next = pts[(i + 1) % pts.length];
    const e1 = edgeDir(prev, curr), e2 = edgeDir(curr, next);
    const p1 = { x: curr.x + e1.nx * inset, y: curr.y + e1.ny * inset };
    const p2 = { x: curr.x + e2.nx * inset, y: curr.y + e2.ny * inset };
    const det = e1.tx * e2.ty - e1.ty * e2.tx;
    if (Math.abs(det) < 1e-4) return { x: Math.round(p2.x), y: Math.round(p2.y) };
    const s = ((p2.x - p1.x) * e2.ty - (p2.y - p1.y) * e2.tx) / det;
    const mx = p1.x + s * e1.tx, my = p1.y + s * e1.ty;
    if (Math.hypot(mx - curr.x, my - curr.y) > inset * 4) {
      const bx = e1.nx + e2.nx, by = e1.ny + e2.ny;
      const bl = Math.hypot(bx, by) || 1;
      return { x: Math.round(curr.x + (bx / bl) * inset), y: Math.round(curr.y + (by / bl) * inset) };
    }
    return { x: Math.round(mx), y: Math.round(my) };
  });
}

function makeBooth4(cx: number, cy: number, boothColor: string, tableColor: string): Item[] {
  return [
    { id: uid(), kind: 'table', model: 'booth-table', name: '四人卡座餐桌', x: cx - 600, y: cy - 375, w: 1200, d: 750, h: 750, rotation: 0, color: tableColor, seats: 0 },
    { id: uid(), kind: 'chair', model: 'curved-booth', name: '软包靠背卡座', x: cx - 600, y: cy - 1030, w: 1200, d: 620, h: 1040, rotation: 0, color: boothColor, seats: 2 },
    { id: uid(), kind: 'chair', model: 'curved-booth', name: '软包靠背卡座', x: cx - 600, y: cy + 410, w: 1200, d: 620, h: 1040, rotation: 180, color: boothColor, seats: 2 },
  ];
}

function makeDining4(cx: number, cy: number, chairColor: string, tableColor: string, compact = false): Item[] {
  const tw = compact ? 1100 : 1200, td = compact ? 750 : 800;
  const cw = compact ? 440 : 500, cd = compact ? 450 : 500, ch = compact ? 820 : 800;
  const m = compact ? 'chair' as const : 'dining-armchair' as const;
  const label = compact ? '餐椅' : '软包扶手餐椅';
  const items: Item[] = [
    { id: uid(), kind: 'table', model: 'rect-table', name: '四人餐桌', x: cx - tw / 2, y: cy - td / 2, w: tw, d: td, h: 750, rotation: 0, color: tableColor, seats: 0 },
  ];
  for (const sy of [-1, 1]) {
    for (const sx of [-1, 1]) {
      items.push({
        id: uid(), kind: 'chair', model: m, name: label,
        x: cx + sx * (tw * 0.24) - cw / 2,
        y: cy + (sy < 0 ? -td / 2 - cd - 60 : td / 2 + 60),
        w: cw, d: cd, h: ch, rotation: sy < 0 ? 0 : 180, color: chairColor, seats: 1,
      });
    }
  }
  return items;
}

function makeCafe2(cx: number, cy: number, chairColor: string, round = true): Item[] {
  const t: Item = round
    ? { id: uid(), kind: 'table', model: 'marble-round-table', name: '大理石圆桌', x: cx - 400, y: cy - 400, w: 800, d: 800, h: 750, rotation: 0, color: '#e6e1d7', seats: 0 }
    : { id: uid(), kind: 'table', model: 'rect-table', name: '双人餐桌', x: cx - 375, y: cy - 350, w: 750, d: 700, h: 750, rotation: 0, color: '#d4b082', seats: 0 };
  const half = t.w / 2;
  return [
    t,
    { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx - half - 540, y: cy - 250, w: 500, d: 500, h: 800, rotation: -90, color: chairColor, seats: 1 },
    { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx + half + 40, y: cy - 250, w: 500, d: 500, h: 800, rotation: 90, color: chairColor, seats: 1 },
  ];
}

function makeCanteen6(cx: number, cy: number): Item[] {
  return [
    { id: uid(), kind: 'table', model: 'rect-table', name: '六人长桌', x: cx - 900, y: cy - 400, w: 1800, d: 800, h: 750, rotation: 0, color: '#d4b284', seats: 0 },
    { id: uid(), kind: 'chair', model: 'bench', name: '长凳', x: cx - 800, y: cy - 850, w: 1600, d: 380, h: 450, rotation: 0, color: '#c49d6e', seats: 3 },
    { id: uid(), kind: 'chair', model: 'bench', name: '长凳', x: cx - 800, y: cy + 470, w: 1600, d: 380, h: 450, rotation: 0, color: '#c49d6e', seats: 3 },
  ];
}

function makeRound8(cx: number, cy: number, chairColor: string): Item[] {
  const items: Item[] = [
    { id: uid(), kind: 'table', model: 'round-table', name: '八人圆桌', x: cx - 850, y: cy - 850, w: 1700, d: 1700, h: 750, rotation: 0, color: '#b58454', seats: 0 },
  ];
  for (let n = 0; n < 8; n++) {
    const a = (n * Math.PI) / 4;
    items.push({
      id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅',
      x: cx + Math.cos(a) * 1160 - 240, y: cy + Math.sin(a) * 1160 - 240,
      w: 480, d: 480, h: 800, rotation: (a * 180) / Math.PI + 90, color: chairColor, seats: 1,
    });
  }
  return items;
}

// Parametric collision-free shop generator sized to ANY leased space dimensions & strategy.
export function buildAutoShopPlan(rawSpec: AutoShopSpec): Project {
  const W = Math.max(5000, Math.min(30000, Math.round(rawSpec.widthM * 1000)));
  const H = Math.max(4500, Math.min(24000, Math.round(rawSpec.depthM * 1000)));
  const wallH = Math.max(2600, Math.min(5500, Math.round(rawSpec.ceilingM * 1000)));
  const theme = businessTypePresets[rawSpec.businessType];
  const isL = rawSpec.shape === 'l-shape';
  const lCutX = Math.round(W * 0.62);
  const lCutY = Math.round(H * 0.54);

  const outline: Point[] | undefined = isL
    ? [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: lCutY },
      { x: lCutX, y: lCutY },
      { x: lCutX, y: H },
      { x: 0, y: H },
    ]
    : undefined;

  const poly = outline ?? [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  const items: Item[] = [];
  const add = (spec: Omit<Item, 'id'> & { id?: string }) => {
    const id = spec.id ?? uid();
    items.push({ ...spec, id });
    return id;
  };
  const addWall = (x1: number, y1: number, x2: number, y2: number, name: string, color = '#efe9df') => {
    const pose = segmentPose({ x: x1, y: y1 }, { x: x2, y: y2 }, 200);
    return add({ kind: 'wall', model: 'wall', name, ...pose, d: 200, h: wallH, color });
  };
  const addOpening = (wallId: string, spec: Omit<Item, 'id' | 'x' | 'y' | 'd' | 'rotation' | 'wallId'> & { offset: number; sill?: number }) => {
    return add({ ...spec, wallId, freeStanding: false, x: 0, y: 0, d: 200, rotation: 0, sill: spec.kind === 'door' ? 0 : (spec.sill ?? 900) });
  };

  // 1. Perimeter walls inset 100mm cleanly inside site outline
  const inset = 100;
  const wallPts = insetPolygon(poly, inset);
  let frontWallId = '';
  let frontLen = 0;
  let frontX0 = inset;
  let frontX1 = (isL ? lCutX : W) - inset;
  for (let i = 0; i < wallPts.length; i++) {
    const a = wallPts[i], b = wallPts[(i + 1) % wallPts.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 300) continue;
    const isBottom = Math.abs(a.y - (H - inset)) < 30 && Math.abs(b.y - (H - inset)) < 30;
    const isTop = Math.abs(a.y - inset) < 30 && Math.abs(b.y - inset) < 30;
    const isLeft = Math.abs(a.x - inset) < 30 && Math.abs(b.x - inset) < 30;
    const label = isBottom ? '临街门头墙' : isTop ? '后背墙' : isLeft ? '左侧墙' : `外墙 ${i + 1}`;
    const id = addWall(a.x, a.y, b.x, b.y, label);
    if (isBottom && len > frontLen) {
      frontWallId = id;
      frontLen = len;
      frontX0 = Math.min(a.x, b.x);
      frontX1 = Math.max(a.x, b.x);
    }
  }

  // 2. Storefront glass double-door, flanking windows & glowing brand signboard
  let doorCenterX = (frontX0 + frontX1) / 2;
  if (frontWallId && frontLen >= 2200) {
    const doorW = Math.min(1900, Math.max(1200, Math.round(frontLen * 0.22)));
    const doorH = Math.min(2380, wallH - 280);
    // Notice bottom wall runs right->left in CW polygon: offset is measured from start point (frontX1 -> frontX0)
    const doorOffset = Math.round((frontLen - doorW) / 2);
    addOpening(frontWallId, {
      kind: 'door', model: 'glass-double-door', name: '商场双开玻璃门',
      w: doorW, h: doorH, offset: doorOffset, color: '#455961', flipped: true,
    });
    doorCenterX = frontX1 - (doorOffset + doorW / 2);
    const leftSideSpace = doorOffset - 260;
    if (leftSideSpace >= 1000) {
      const winW = Math.min(3600, Math.round(leftSideSpace - 140));
      addOpening(frontWallId, {
        kind: 'window', model: 'storefront-window', name: '临街落地橱窗',
        w: winW, h: Math.min(2420, wallH - 360), offset: Math.max(160, Math.round((doorOffset - winW) / 2)),
        sill: 150, color: '#455961',
      });
    }
    const rightStart = doorOffset + doorW + 140;
    const rightSideSpace = frontLen - rightStart - 160;
    if (rightSideSpace >= 1000) {
      const winW = Math.min(3600, Math.round(rightSideSpace - 120));
      addOpening(frontWallId, {
        kind: 'window', model: 'storefront-window', name: '临街落地橱窗',
        w: winW, h: Math.min(2420, wallH - 360), offset: rightStart + Math.round((rightSideSpace - winW) / 2),
        sill: 150, color: '#455961',
      });
    }
    const signW = Math.min(3600, Math.max(1800, Math.round(frontLen * 0.44)));
    add({
      kind: 'decor', model: 'shop-sign', name: rawSpec.name.trim() || theme.label,
      x: Math.round(doorCenterX - signW / 2), y: H - 120,
      w: signW, d: 180, h: Math.min(660, Math.max(460, wallH - 2350)),
      rotation: 0, elevation: Math.min(wallH - 640, 2440), color: theme.signColor,
    });
  }

  // 3. Kitchen + Cashier / Bar Layout (rear vs left side)
  const useLeftKitchen = rawSpec.kitchenSide === 'left' && W >= 7800;
  const kitchenDepth = rawSpec.businessType === 'cafe'
    ? Math.max(2100, Math.min(2700, Math.round(H * 0.28)))
    : Math.max(2450, Math.min(3300, Math.round(H * 0.31)));
  const leftKitchenW = Math.max(2550, Math.min(3300, Math.round(W * 0.30)));

  // Keep track of dining bounding region(s)
  let diningMinX = 280;
  let diningMinY = 280;
  const counterAnchors: { x: number; y: number }[] = [];

  if (!useLeftKitchen) {
    // REAR KITCHEN + RIGHT CASHIER/BAR
    const kWallY = kitchenDepth;
    const barShare = rawSpec.businessType === 'cafe' ? 0.54 : rawSpec.businessType === 'canteen' ? 0.25 : 0.35;
    // Where the kitchen reaches the notch, keep both partition faces inside the remaining wing.
    const kitchenLimit = isL && kWallY + 320 > lCutY ? lCutX - 320 : W - 2200;
    const kitchenSplitX = Math.min(kitchenLimit, Math.max(3200, Math.round(W * (1 - barShare))));

    // Zones
    add({ kind: 'zone', name: rawSpec.businessType === 'cafe' ? '后场烘焙洗消区' : '明档热厨区', x: 240, y: 240, w: kitchenSplitX - 300, d: kWallY - 300, h: 0, rotation: 0, color: '#f7ece0' });
    add({ kind: 'zone', name: rawSpec.businessType === 'cafe' ? '咖啡烘焙吧台区' : '水吧收银区', x: kitchenSplitX + 120, y: 240, w: W - kitchenSplitX - 360, d: Math.min(kWallY, isL ? lCutY - 200 : H) - 300, h: 0, rotation: 0, color: '#e7eef6' });
    add({
      kind: 'zone', name: '前厅就餐区',
      x: 240, y: kWallY + 140,
      w: (isL ? lCutX : W) - 480, d: H - kWallY - 380,
      h: 0, rotation: 0, color: '#e6f0e6',
    });

    // Partition wall separating kitchen & hall
    const kWall = addWall(inset, kWallY, kitchenSplitX, kWallY, '明档隔墙');
    addWall(kitchenSplitX, inset, kitchenSplitX, kWallY, '厨吧分隔墙');
    const kSpan = kitchenSplitX - inset;
    if (kSpan >= 2000) {
      if (kSpan >= 2800 && rawSpec.businessType !== 'cafe') {
        const winW = Math.min(2800, Math.max(1200, Math.round(kSpan * 0.42)));
        addOpening(kWall, { kind: 'window', model: 'serving-window', name: '明档出餐窗', w: winW, h: 1120, offset: Math.round(kSpan * 0.14), sill: 950, color: '#6b7e86' });
      }
      addOpening(kWall, { kind: 'door', model: 'door', name: '后厨单开门', w: 900, h: 2120, offset: Math.max(200, kSpan - 1150), color: '#b5956c', flipped: true });
    }

    // Populate back kitchen equipment line along y = 260
    let kx = 340;
    const kLimit = kitchenSplitX - 180;
    const placeBack = (spec: Omit<Item, 'id' | 'x' | 'y' | 'rotation'>) => {
      if (kx + spec.w > kLimit) return false;
      add({ ...spec, x: kx, y: 260, rotation: 0 });
      kx += spec.w + 90;
      return true;
    };

    if (rawSpec.businessType === 'cafe') {
      placeBack({ kind: 'stove', model: 'oven', name: '商用烘焙烤箱', w: 950, d: 780, h: 1380, color: '#78848c' });
      placeBack({ kind: 'fridge', model: 'upright-fridge', name: '立式冷藏柜', w: 850, d: 740, h: 1960, color: '#9bb4c2' });
      placeBack({ kind: 'sink', model: 'sink', name: '双槽洗涤池', w: 1200, d: 660, h: 850, color: '#a5b7c0' });
      placeBack({ kind: 'counter', model: 'worktable', name: '备料操作台', w: 1200, d: 680, h: 850, color: '#a3aeb4' });
    } else if (rawSpec.businessType === 'canteen') {
      const stoveStart = kx;
      placeBack({ kind: 'stove', model: 'wok', name: '大锅炒灶', w: 1200, d: 950, h: 880, color: '#93a0a7' });
      placeBack({ kind: 'stove', model: 'stove', name: '双头燃气炉灶', w: 1300, d: 850, h: 850, color: '#96a3aa' });
      placeBack({ kind: 'stove', model: 'steamer', name: '商用蒸饭柜', w: 720, d: 720, h: 1580, color: '#aab5bc' });
      if (kx > stoveStart + 1000) {
        add({ kind: 'stove', model: 'hood', name: '排烟罩组件', x: stoveStart, y: 230, w: Math.min(kLimit - stoveStart, kx - stoveStart), d: 1050, h: 2450, rotation: 0, color: '#adb8bc' });
      }
      placeBack({ kind: 'fridge', model: 'upright-fridge', name: '立式双门冰箱', w: 850, d: 760, h: 1980, color: '#9bb4c2' });
      placeBack({ kind: 'sink', model: 'triple-sink', name: '三槽洗涤池', w: 1600, d: 680, h: 850, color: '#a5b7c0' });
    } else {
      const stoveStart = kx;
      placeBack({ kind: 'stove', model: rawSpec.businessType === 'bistro' ? 'noodle-cooker' : 'wok', name: rawSpec.businessType === 'bistro' ? '六孔煮面炉' : '中式猛火炒灶', w: 1000, d: 780, h: 880, color: '#adbac0' });
      placeBack({ kind: 'stove', model: 'stove', name: '双头炉灶', w: 1250, d: 820, h: 850, color: '#96a3aa' });
      if (kLimit - kx > 2600) {
        placeBack({ kind: 'stove', model: 'fryer', name: '双缸电炸炉', w: 800, d: 740, h: 880, color: '#a7b4bd' });
      }
      const hoodW = Math.min(kLimit - stoveStart, kx - stoveStart - 40);
      if (hoodW >= 1000) {
        add({ kind: 'stove', model: 'hood', name: '排烟罩组件', x: stoveStart, y: 230, w: hoodW, d: 1020, h: 2450, rotation: 0, color: '#adb8bc' });
      }
      placeBack({ kind: 'fridge', model: 'upright-fridge', name: '立式双门冰箱', w: 820, d: 740, h: 1960, color: '#9bb4c2' });
      placeBack({ kind: 'sink', model: 'triple-sink', name: '三槽洗涤池', w: 1500, d: 660, h: 850, color: '#a5b7c0' });
      placeBack({ kind: 'sink', model: 'dishwasher', name: '揭盖式洗碗机', w: 700, d: 740, h: 1420, color: '#a2b4bd' });
    }

    // Pass-through prep counter inside kitchen if depth permits
    if (kWallY >= 2600 && kitchenSplitX >= 4200) {
      const passW = Math.min(2400, kitchenSplitX - 1800);
      add({ kind: 'counter', model: 'dish-pass', name: '备餐传菜台', x: 900, y: kWallY - 900, w: passW, d: 680, h: 1320, rotation: 180, color: '#a3aeb4' });
    }

    // Right Bar / Cashier Zone
    const barLeft = kitchenSplitX + 220;
    const barRight = W - 260;
    const barSpan = barRight - barLeft;
    if (barSpan >= 1600) {
      const cashierW = Math.min(1300, Math.round(barSpan * 0.42));
      const barY = Math.min(Math.max(1650, kWallY - 580), (isL ? lCutY : H) - 940);
      add({ kind: 'counter', model: 'cashier', name: '收银点餐台', x: barLeft, y: barY, w: cashierW, d: 660, h: 1080, rotation: 0, color: theme.barColor });
      counterAnchors.push({ x: barLeft + cashierW / 2, y: barY + 330 });
      const restBarW = barRight - (barLeft + cashierW + 80);
      if (restBarW >= 1100) {
        const model = rawSpec.businessType === 'cafe' ? 'display-counter' as const : 'tea-bar' as const;
        const barName = rawSpec.businessType === 'cafe' ? '甜品烘焙展示柜' : '饮品水吧台';
        add({ kind: 'counter', model, name: barName, x: barLeft + cashierW + 80, y: barY, w: Math.min(2400, restBarW), d: 700, h: 1060, rotation: 0, color: theme.barColor });
        counterAnchors.push({ x: barLeft + cashierW + 80 + Math.min(2400, restBarW) / 2, y: barY + 350 });
        if (rawSpec.businessType === 'cafe' || restBarW >= 1500) {
          add({ kind: 'counter', model: 'coffee-machine', name: '意式咖啡机', x: barLeft + cashierW + 240, y: barY + 90, w: 660, d: 500, h: 560, rotation: 0, color: '#394c52' });
        }
      }
      // Back-bar equipment along rear wall y=260
      add({ kind: 'sink', model: 'single-sink', name: '吧台水槽', x: barLeft + 80, y: 260, w: 720, d: 600, h: 850, rotation: 0, color: '#a5b7c0' });
      if (barSpan >= 2400) {
        add({ kind: 'fridge', model: 'glass-fridge', name: '玻璃门饮料柜', x: barRight - 980, y: 260, w: 920, d: 660, h: 1960, rotation: 0, color: '#516973' });
      }
      const menuW = Math.min(2200, Math.max(1200, barSpan - 400));
      add({ kind: 'decor', model: 'menu-board', name: '发光菜单灯箱', x: Math.round(barLeft + (barSpan - menuW) / 2), y: 220, w: menuW, d: 110, h: 680, rotation: 0, elevation: 2060, color: '#262e32' });
    }

    // Canteen buffet line in front of kitchen wall
    if (rawSpec.businessType === 'canteen' && W >= 9000) {
      const compactBuffet = isL || H < 8600;
      const buffetW = Math.min(compactBuffet ? 2400 : 3400, Math.round(kSpan * (compactBuffet ? 0.52 : 0.65)));
      const buffetD = compactBuffet ? 720 : 820;
      const buffetY = kWallY + (compactBuffet ? 150 : 320);
      add({ kind: 'counter', model: 'buffet', name: '自助取餐保温台', x: 860, y: buffetY, w: buffetW, d: buffetD, h: 900, rotation: 0, color: '#7e908a' });
      diningMinY = buffetY + buffetD + 220;
    } else {
      diningMinY = kWallY + 360;
    }

    // Kitchen ceiling panel lights
    add({ kind: 'lighting', model: 'kitchen-panel-light', name: '厨房防油平板灯', x: Math.round(kitchenSplitX * 0.42) - 550, y: Math.round(kWallY * 0.5) - 160, w: 1100, d: 320, h: 80, rotation: 0, elevation: wallH - 220, color: '#eef3f5' });
  } else {
    // LEFT SIDE OPEN KITCHEN (ideal for deep or corridor-like shops!)
    const kWallX = leftKitchenW;
    const kEndY = Math.min(H - 1600, Math.round(H * 0.68));
    add({ kind: 'zone', name: '侧置明档热厨区', x: 240, y: 240, w: kWallX - 300, d: kEndY - 300, h: 0, rotation: 0, color: '#f7ece0' });
    add({ kind: 'zone', name: '前厅就餐区', x: kWallX + 160, y: 240, w: (isL ? lCutX : W) - kWallX - 400, d: H - 480, h: 0, rotation: 0, color: '#e6f0e6' });

    const sideWall = addWall(kWallX, inset, kWallX, kEndY, '侧置明档隔墙');
    addWall(inset, kEndY, kWallX, kEndY, '厨区南侧墙');
    const sideLen = kEndY - inset;
    if (sideLen >= 2600) {
      addOpening(sideWall, { kind: 'window', model: 'serving-window', name: '侧向明档出餐窗', w: Math.min(2200, Math.round(sideLen * 0.44)), h: 1100, offset: Math.round(sideLen * 0.14), sill: 950, color: '#6b7e86' });
      addOpening(sideWall, { kind: 'door', model: 'door', name: '后厨单开门', w: 900, h: 2120, offset: Math.max(200, sideLen - 1100), color: '#b5956c', flipped: true });
    }

    // Back equipment inside left kitchen (along left wall x = 280, rotated -90 so front faces +X)
    let ky = 480;
    const placeLeftEquip = (spec: Omit<Item, 'id' | 'x' | 'y' | 'rotation'>) => {
      if (ky + spec.w > kEndY - 220) return;
      add({ ...spec, x: 280 + (spec.d - spec.w) / 2, y: ky + (spec.w - spec.d) / 2, rotation: -90 });
      ky += spec.w + 120;
    };
    placeLeftEquip({ kind: 'stove', model: 'noodle-cooker', name: '煮面炉灶', w: 1000, d: 750, h: 880, color: '#adbac0' });
    placeLeftEquip({ kind: 'stove', model: 'stove', name: '双头炉灶', w: 1200, d: 800, h: 850, color: '#96a3aa' });
    const hoodWidth = ky - 120 - 480; // End of the last stove that fit in this run.
    placeLeftEquip({ kind: 'sink', model: 'sink', name: '双槽洗涤池', w: 1100, d: 650, h: 850, color: '#a5b7c0' });
    placeLeftEquip({ kind: 'fridge', model: 'upright-fridge', name: '立式双门冰箱', w: 820, d: 740, h: 1960, color: '#9bb4c2' });
    if (hoodWidth > 0) add({ kind: 'stove', model: 'hood', name: '排烟罩组件', x: 260 + (950 - hoodWidth) / 2, y: 480 + (hoodWidth - 950) / 2, w: hoodWidth, d: 950, h: 2450, rotation: -90, color: '#adb8bc' });
    add({ kind: 'lighting', model: 'kitchen-panel-light', name: '厨房防油平板灯', x: Math.round(kWallX / 2) - 160, y: Math.round(kEndY / 2) - 550, w: 320, d: 1100, h: 80, rotation: 0, elevation: wallH - 220, color: '#eef3f5' });

    // Cashier counter on rear right of dining hall
    const barW = Math.min(2000, Math.max(1200, Math.round((W - kWallX) * 0.34)));
    add({ kind: 'counter', model: 'cashier', name: '收银水吧台', x: kWallX + 360, y: 380, w: barW, d: 680, h: 1080, rotation: 0, color: theme.barColor });
    add({ kind: 'decor', model: 'menu-board', name: '发光菜单灯箱', x: kWallX + 420, y: 220, w: Math.min(1800, barW), d: 110, h: 680, rotation: 0, elevation: 2060, color: '#262e32' });
    counterAnchors.push({ x: kWallX + 360 + barW / 2, y: 720 });

    diningMinX = kWallX + 360;
    diningMinY = 420;
  }

  const style: ProjectStyle = {
    floorMaterial: rawSpec.floorMaterial,
    wallMaterial: rawSpec.wallMaterial,
    ceilingHeight: wallH,
    lightingPreset: rawSpec.lightingPreset,
    showCeiling: false,
    wallCutaway: false,
    showZoneTint3D: false,
    showLightsIn2D: true,
    shopType: theme.shopType,
  };

  // Sync openings so doorSwings() returns exact world-space polygons for collision avoidance!
  const shellProject = syncStructure({
    ...projectIdentity(),
    name: rawSpec.name.trim() || `${theme.label}方案`,
    width: W, height: H, outline, items, style,
    metadata: {
      customer: '',
      site: `${(W / 1000).toFixed(1)}m × ${(H / 1000).toFixed(1)}m ${isL ? 'L 形转角铺位' : '标准矩形铺位'}`,
      purpose: `${theme.label} · ${strategyMeta[rawSpec.strategy].label}`,
      notes: `基于实测尺寸自动生成（${strategyMeta[rawSpec.strategy].summary}），可直接在 2D/3D 中微调并与合伙人对比不同摆法。`,
    },
  });
  return furnishDining(shellProject, rawSpec, { diningMinX, diningMinY, useLeftKitchen, frontX1, doorCenterX }, counterAnchors);
}

// Cache each footprint once. Most pairs in a large shop are already far apart on one axis.
function boundedPolygon(points: Point[]) {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { points, left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

type BoundedPolygon = ReturnType<typeof boundedPolygon>;

function closerThan(a: BoundedPolygon, b: BoundedPolygon, gap: number) {
  if (a.left - b.right >= gap || b.left - a.right >= gap || a.top - b.bottom >= gap || b.top - a.bottom >= gap) return false;
  return polygonDistance(a.points, b.points).distance < gap;
}

function furnishDining(shellProject: Project, rawSpec: AutoShopSpec, layout: {
  diningMinX: number; diningMinY: number; useLeftKitchen: boolean; frontX1: number; doorCenterX: number;
}, counterAnchors?: Point[]): Project {
  const { diningMinX, diningMinY, useLeftKitchen, frontX1, doorCenterX } = layout;
  const { width: W, height: H } = shellProject;
  const poly = siteOutline(shellProject), isL = poly.length > 4;
  const diningMaxX = W - 280, diningMaxY = H - 300;
  const wallH = resolveStyle(shellProject).ceilingHeight;
  const theme = businessTypePresets[rawSpec.businessType];
  const syncedItems = [...shellProject.items];
  const groups = [...(shellProject.groups ?? [])];
  // Attached openings share the wall footprint. Keep their swing arcs clear as well.
  const fixedObstacles = shellProject.items.filter(i => {
    if (isAnnotation(i) || i.kind === 'utility') return false;
    if (i.kind === 'zone') return !counterAnchors && /厨|灶|洗|备|后场|吧|收银|取餐|服务/.test(i.name);
    if (i.wallId) return false;
    return baseHeight(shellProject, i) < 1200;
  }).map(item => ({ item, polygon: boundedPolygon(footprint(item)) }));
  const doorSwingPolys = syncedItems.filter(i => i.kind === 'door').flatMap(d => doorSwings(d)).map(boundedPolygon);

  // Helper to verify a candidate group fits cleanly inside siteOutline with zero overlaps & healthy clearance
  const minAisle = rawSpec.strategy === 'high-capacity' ? 720 : rawSpec.strategy === 'comfort' ? 1050 : 860;
  const placedDining: BoundedPolygon[] = [];
  const tableCenters: { x: number; y: number; linear: boolean }[] = [];

  const canPlaceGroup = (cand: Item[], wallGap = 140, groupGap = minAisle): boolean => {
    for (const item of cand) {
      const shape = boundedPolygon(footprint(item));
      if (!contains(poly, shape.points)) return false;
      if (doorSwingPolys.some(swing => closerThan(shape, swing, 120))) return false;
      for (const obstacle of fixedObstacles) {
        const kind = obstacle.item.kind;
        const reqGap = kind === 'wall' ? wallGap : kind === 'counter' ? 620 : Math.min(groupGap, 550);
        if (closerThan(shape, obstacle.polygon, reqGap)) return false;
      }
      if (placedDining.some(prev => closerThan(shape, prev, groupGap))) return false;
    }
    return true;
  };

  const commitGroup = (name: string, cand: Item[], seats: number, center: { x: number; y: number }, linear = false) => {
    syncedItems.push(...cand);
    placedDining.push(...cand.map(i => boundedPolygon(footprint(i))));
    groups.push({ id: uid(), name, members: cand.map(c => c.id), seats });
    tableCenters.push({ ...center, linear });
  };

  // Reserve a welcoming entrance corridor straight inside the glass double-door
  const corridorHalf = rawSpec.strategy === 'high-capacity' ? 560 : 680;
  const inEntranceCorridor = (cx: number, cy: number, halfW: number) =>
    cy > H - 2000 && Math.abs(cx - doorCenterX) < corridorHalf + halfW * 0.45;

  // 4. Smart Seating Layout by Business Type & Strategy
  const tryBoothColumn = (colX: number, labelPrefix: string) => {
    const stepY = rawSpec.strategy === 'comfort' ? 2750 : 2420;
    let idx = 1;
    for (let cy = diningMinY + 920; cy <= diningMaxY - 980; cy += stepY) {
      if (inEntranceCorridor(colX, cy, 600)) continue;
      const cand = makeBooth4(colX, cy, theme.boothColor, theme.tableColor);
      if (canPlaceGroup(cand, 90, Math.max(700, minAisle - 120))) {
        commitGroup(`${labelPrefix} ${idx++} 号`, cand, 4, { x: colX, y: cy }, true);
      }
    }
  };

  // Left wall booth column for balanced / comfort bistro & restaurant
  if (rawSpec.businessType !== 'canteen' && rawSpec.strategy !== 'high-capacity' && !useLeftKitchen && W >= 7200) {
    tryBoothColumn(960, '四人卡座');
  }

  // Right wall booth column for larger balanced/comfort shops
  if ((rawSpec.businessType === 'restaurant' || rawSpec.businessType === 'bistro') && rawSpec.strategy !== 'high-capacity' && !isL && W >= 10200) {
    tryBoothColumn(W - 960, '雅致卡座');
  }

  // Primary floor grid seating — fine-grained scan so medium shops (8–12m) pack balanced rows cleanly
  const xStart = useLeftKitchen
    ? diningMinX + (rawSpec.businessType === 'canteen' ? 1150 : 820)
    : rawSpec.businessType === 'canteen'
      ? diningMinX + 1150
      : (rawSpec.strategy !== 'high-capacity' && W >= 7200 ? 2950 : diningMinX + 850);
  const xStep = rawSpec.businessType === 'canteen'
    ? 2480
    : rawSpec.businessType === 'restaurant' && rawSpec.strategy === 'comfort'
      ? 3400
      : rawSpec.strategy === 'high-capacity'
        ? 1920
        : rawSpec.businessType === 'cafe'
          ? 2300
          : 2200;
  const yStep = rawSpec.businessType === 'canteen'
    ? 2350
    : rawSpec.businessType === 'restaurant' && rawSpec.strategy === 'comfort'
      ? 3300
      : rawSpec.strategy === 'high-capacity'
        ? 2320
        : rawSpec.businessType === 'cafe'
          ? 1950
          : 2450;

  let tableIdx = 1;
  for (let cy = diningMinY + 950; cy <= diningMaxY - 820;) {
    const beforeRow = tableIdx;
    for (let cx = xStart; cx <= diningMaxX - 780; cx += xStep) {
      if (inEntranceCorridor(cx, cy, 550)) continue;
      if (rawSpec.businessType === 'canteen') {
        const cand = makeCanteen6(cx, cy);
        if (canPlaceGroup(cand, 200, Math.max(680, minAisle - 60))) {
          commitGroup(`六人长桌 ${tableIdx++}`, cand, 6, { x: cx, y: cy }, true);
        } else {
          const fallback = makeDining4(cx, cy, theme.chairColor, '#d4b284', true);
          if (canPlaceGroup(fallback, 180, Math.max(660, minAisle - 80))) {
            commitGroup(`四人餐桌 ${tableIdx++}`, fallback, 4, { x: cx, y: cy }, true);
          }
        }
      } else if (rawSpec.businessType === 'restaurant' && rawSpec.strategy === 'comfort') {
        const cand = makeRound8(cx, cy, theme.chairColor);
        if (canPlaceGroup(cand, 240, minAisle)) {
          commitGroup(`八人圆桌雅座 ${tableIdx++}`, cand, 8, { x: cx, y: cy }, false);
          continue;
        }
        const fallback = makeDining4(cx, cy, theme.chairColor, theme.tableColor, false);
        if (canPlaceGroup(fallback, 180, minAisle)) {
          commitGroup(`四人餐桌 ${tableIdx++}`, fallback, 4, { x: cx, y: cy }, true);
        }
      } else if (rawSpec.businessType === 'cafe') {
        const useFour = tableIdx % 3 === 0 && rawSpec.strategy !== 'high-capacity';
        const cand = useFour
          ? makeDining4(cx, cy, theme.chairColor, '#cfa97a', false)
          : makeCafe2(cx, cy, theme.chairColor, true);
        if (canPlaceGroup(cand, 180, minAisle)) {
          commitGroup(useFour ? `四人咖啡桌 ${tableIdx++}` : `双人圆桌 ${tableIdx++}`, cand, useFour ? 4 : 2, { x: cx, y: cy }, useFour);
        }
      } else {
        const compact = rawSpec.strategy === 'high-capacity';
        const cand = makeDining4(cx, cy, theme.chairColor, theme.tableColor, compact);
        if (canPlaceGroup(cand, 180, minAisle)) {
          commitGroup(`四人餐桌 ${tableIdx++}`, cand, 4, { x: cx, y: cy }, true);
        } else {
          const small = makeCafe2(cx, cy, theme.chairColor, false);
          if (canPlaceGroup(small, 160, Math.max(680, minAisle - 120))) {
            commitGroup(`双人餐桌 ${tableIdx++}`, small, 2, { x: cx, y: cy }, false);
          }
        }
      }
    }
    cy += tableIdx > beforeRow ? yStep : 550;
  }

  // Optional window bar seating along the right-front storefront window
  const frontBarX = frontX1 - 1500;
  if (frontBarX > doorCenterX + 1000 && frontX1 - (doorCenterX + 950) >= 2100) {
    const barW = 1950;
    const barY = H - 700;
    const bx = Math.round(frontX1 - barW - 240);
    const barGroup: Item[] = [
      { id: uid(), kind: 'table', model: 'bar-table', name: '靠窗吧台桌', x: bx, y: barY, w: barW, d: 440, h: 1050, rotation: 0, color: '#b88c5c', seats: 0 },
      ...[0.18, 0.5, 0.82].map(f => ({
        id: uid(), kind: 'chair' as const, model: 'stool' as const, name: '吧台高脚凳',
        x: Math.round(bx + barW * f - 200), y: barY - 480, w: 400, d: 400, h: 750, rotation: 0, color: '#5f5242', seats: 1,
      })),
    ];
    if (canPlaceGroup(barGroup, 120, 620)) {
      commitGroup('临窗吧台三座', barGroup, 3, { x: bx + barW / 2, y: barY }, false);
    }
  }

  // Variants keep the shop's installed lighting, kitchen and decor.
  if (!counterAnchors) return syncStructure({ ...shellProject, items: syncedItems, groups });

  // 5. Architectural Lighting & Sculptural Decor
  for (const tc of tableCenters.slice(0, 10)) {
    if (rawSpec.businessType === 'restaurant' && !tc.linear) {
      syncedItems.push({
        id: uid(), kind: 'lighting', model: 'chandelier', name: '黄铜环形吊灯',
        x: Math.round(tc.x - 420), y: Math.round(tc.y - 420), w: 840, d: 840, h: 760,
        rotation: 0, elevation: wallH - 960, color: '#d4a155',
      });
    } else if (tc.linear) {
      syncedItems.push({
        id: uid(), kind: 'lighting', model: 'linear-light', name: '条形餐桌吊灯',
        x: Math.round(tc.x - 560), y: Math.round(tc.y - 70), w: 1120, d: 140, h: 520,
        rotation: 0, elevation: wallH - 860, color: '#2f3538',
      });
    } else {
      syncedItems.push({
        id: uid(), kind: 'lighting', model: 'pendant-lamp', name: '暖光餐桌吊灯',
        x: Math.round(tc.x - 210), y: Math.round(tc.y - 210), w: 420, d: 420, h: 660,
        rotation: 0, elevation: wallH - 960, color: '#d7a15a',
      });
    }
  }
  for (const ca of counterAnchors) {
    syncedItems.push({
      id: uid(), kind: 'lighting', model: 'pendant-lamp', name: '吧台暖光吊灯',
      x: Math.round(ca.x - 200), y: Math.round(ca.y - 200), w: 400, d: 400, h: 640,
      rotation: 0, elevation: wallH - 940, color: '#d7a15a',
    });
  }

  // Wood feature wall on left dining wall (if rear kitchen) + framed wall art
  if (!useLeftKitchen && H - diningMinY >= 3400) {
    const fwLen = Math.min(3200, Math.round((H - diningMinY) * 0.52));
    const fwY = Math.round((diningMinY + diningMaxY) / 2);
    syncedItems.push({
      id: uid(), kind: 'decor', model: 'wood-feature-wall', name: '木饰面造型墙',
      x: Math.round(245 - fwLen / 2), y: Math.round(fwY - 40),
      w: fwLen, d: 80, h: Math.min(2850, wallH - 200), rotation: -90, color: '#b78d5e',
    });
  }
  if (!isL && H - diningMinY >= 2600) {
    const artY = Math.round((diningMinY + diningMaxY) / 2);
    syncedItems.push({
      id: uid(), kind: 'decor', model: 'wall-art', name: '装饰挂画组合',
      x: Math.round(W - 245 - 750), y: Math.round(artY - 30),
      w: 1500, d: 60, h: 820, rotation: 90, elevation: 1380, color: '#c6845c',
    });
  }

  // Try placing sculptural potted plants in clean corners
  const plantSpots = [
    { x: diningMinX + 40, y: diningMinY + 60 },
    { x: Math.min(frontX1 - 720, doorCenterX + 1120), y: H - 820 },
    { x: Math.max(diningMinX + 40, doorCenterX - 1650), y: H - 820 },
  ];
  for (const sp of plantSpots) {
    const plant: Item = {
      id: uid(), kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽',
      x: Math.round(sp.x), y: Math.round(sp.y), w: 560, d: 560, h: 1680, rotation: 0, color: '#4c7a52',
    };
    if (canPlaceGroup([plant], 120, 320)) {
      syncedItems.push(plant);
      placedDining.push(boundedPolygon(footprint(plant)));
    }
  }

  return syncStructure({ ...shellProject, items: syncedItems, groups });
}

export function inferAutoSpecFromProject(project: Project): AutoShopSpec {
  const style = resolveStyle(project);
  const label = `${style.shopType ?? ''} ${project.name} ${project.metadata.purpose}`.toLowerCase();
  const businessType: ShopBusinessType = /咖啡|烘焙|茶饮|甜品|cafe/.test(label)
    ? 'cafe'
    : /食堂|档口|员工|canteen/.test(label)
      ? 'canteen'
      : /中餐|小馆|酒楼|火锅|正餐/.test(label)
        ? 'restaurant'
        : 'bistro';
  const outline = siteOutline(project);
  const shape: 'rectangle' | 'l-shape' = outline.length >= 6 ? 'l-shape' : 'rectangle';
  return {
    name: project.name.replace(/\s*·\s*(均衡经典版|高坪效翻台版|宽敞体验版|侧置明档版)$/, '') || '我的新店',
    widthM: project.width / 1000,
    depthM: project.height / 1000,
    ceilingM: Number(((style.ceilingHeight || 3200) / 1000).toFixed(1)),
    shape,
    businessType,
    strategy: 'balanced',
    kitchenSide: 'rear',
    floorMaterial: style.floorMaterial,
    wallMaterial: style.wallMaterial,
    lightingPreset: style.lightingPreset,
  };
}

export type ShopVariantOption = {
  id: string;
  title: string;
  badge: string;
  summary: string;
  spec: AutoShopSpec;
  project: Project;
};

// Only loose, unreferenced seating can be replaced without changing the measured shop.
function comparisonShell(source: Project): Project {
  const removable = new Set(source.items.filter(i =>
    (i.kind === 'table' || i.kind === 'chair') && !i.locked && !i.hidden && i.verification !== 'confirmed'
  ).map(i => i.id));
  for (const i of source.items) {
    const support = supportFor(source, i);
    if (support) removable.delete(support.id);
    if (i.measure) { removable.delete(i.measure.a); removable.delete(i.measure.b); }
  }
  for (const g of source.groups ?? []) {
    if (g.members.some(id => !removable.has(id))) g.members.forEach(id => removable.delete(id));
  }
  return { ...source, items: source.items.filter(i => !removable.has(i.id)),
    groups: source.groups?.filter(g => !removable.has(g.members[0])) };
}

export function buildShopVariants(baseSpec: AutoShopSpec, source?: Project): ShopVariantOption[] {
  const baseName = baseSpec.name.trim() || '我的铺位';
  const shell = source && comparisonShell(source);
  const sideKitchen = !source && baseSpec.widthM >= 8.2;
  const configs: { id: string; title: string; badge: string; summary: string; patch: Partial<AutoShopSpec> }[] = [
    {
      id: 'balanced',
      title: '方案 A · 均衡经典摆法',
      badge: '推荐均衡',
      summary: '卡座 + 散台均衡组合，主通道顺畅，适合大多数社区与商场铺位',
      patch: { strategy: 'balanced', kitchenSide: 'rear', name: `${baseName} · 均衡经典版` },
    },
    {
      id: 'high-capacity',
      title: '方案 B · 高坪效翻台摆法',
      badge: '紧凑排布',
      summary: '紧凑散台 + 临窗吧台阵列，同等面积下释放更高高峰接待能力',
      patch: { strategy: 'high-capacity', kitchenSide: 'rear', name: `${baseName} · 高坪效翻台版` },
    },
    {
      id: 'comfort-or-side',
      title: sideKitchen ? '方案 C · 侧置明档宽敞版' : '方案 C · 宽敞品质体验版',
      badge: sideKitchen ? '侧厨新动线' : '宽敞排布',
      summary: sideKitchen
        ? '厨房改至左侧纵深排布，前厅从门头一直通透到底，适合做视觉明档'
        : '增加桌组间距并预留软装空间，适合高客单价社交餐饮',
      patch: sideKitchen
        ? { strategy: 'balanced', kitchenSide: 'left', name: `${baseName} · 侧置明档版` }
        : { strategy: 'comfort', kitchenSide: 'rear', name: `${baseName} · 宽敞体验版` },
    },
  ];
  const frontDoor = shell?.items.filter(i => i.kind === 'door' && !i.hidden).sort((a, b) => b.y + b.d / 2 - a.y - a.d / 2)[0];
  const options = configs.map(cfg => {
    const spec: AutoShopSpec = { ...baseSpec, ...cfg.patch };
    return {
      id: cfg.id,
      title: cfg.title,
      badge: cfg.badge,
      summary: cfg.summary,
      spec,
      project: shell ? furnishDining({ ...shell, name: spec.name }, spec, {
        diningMinX: 280, diningMinY: 280, useLeftKitchen: false, frontX1: shell.width - 100,
        doorCenterX: frontDoor ? frontDoor.x + frontDoor.w / 2 : shell.width / 2,
      }) : buildAutoShopPlan(spec),
    };
  });
  const seats = options.map(v => seatSummary(v.project).seats);
  const max = Math.max(...seats);
  const tied = seats.filter(n => n === max).length > 1;
  return options.map((v, i) => max > 0 && seats[i] === max
    ? { ...v, badge: tied ? '并列座位最多' : '座位最多' }
    : v);
}
