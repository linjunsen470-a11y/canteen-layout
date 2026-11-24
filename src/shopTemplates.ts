import { FloorMaterial, Item, LayoutGroup, LightingPreset, Point, Project, ProjectStyle, WallMaterial, projectIdentity, uid } from './model';
import { segmentPose, syncStructure, wallPoint } from './structure';
import { siteOutline } from './site';

export type ShopTemplateMeta = {
  id: string;
  name: string;
  tag: string;
  areaLabel: string;
  feature: string;
  summary: string;
  accent: string;
  build: (customName?: string) => Project;
};

type Builder = {
  items: Item[];
  groups: LayoutGroup[];
  add: (spec: Omit<Item, 'id'> & { id?: string }) => string;
  wall: (x1: number, y1: number, x2: number, y2: number, h: number, name: string, color?: string, thickness?: number) => string;
  opening: (wallId: string, spec: Omit<Item, 'id' | 'x' | 'y' | 'd' | 'rotation' | 'wallId'> & { offset: number; sill?: number }) => string;
  group: (name: string, members: string[], seats?: number) => void;
};

function createBuilder(): Builder {
  const items: Item[] = [];
  const groups: LayoutGroup[] = [];
  const add: Builder['add'] = spec => {
    const id = spec.id ?? uid();
    items.push({ ...spec, id });
    return id;
  };
  const wall: Builder['wall'] = (x1, y1, x2, y2, h, name, color = '#f0eae0', thickness = 200) => {
    const pose = segmentPose({ x: x1, y: y1 }, { x: x2, y: y2 }, thickness);
    return add({ kind: 'wall', model: 'wall', name, ...pose, d: thickness, h, color });
  };
  const opening: Builder['opening'] = (wallId, spec) => {
    const id = uid();
    items.push({ ...spec, id, wallId, freeStanding: false, x: 0, y: 0, d: 200, rotation: 0, sill: spec.kind === 'door' ? 0 : (spec.sill ?? 900) });
    return id;
  };
  const group: Builder['group'] = (name, members, seats) => {
    groups.push({ id: uid(), name, members, seats });
  };
  return { items, groups, add, wall, opening, group };
}

function addFourBooth(b: Builder, cx: number, cy: number, color = '#4f6d60', tableColor = '#bc8d5d', name = '四人卡座') {
  const t = b.add({ kind: 'table', model: 'booth-table', name: '四人卡座餐桌', x: cx - 600, y: cy - 375, w: 1200, d: 750, h: 750, rotation: 0, color: tableColor, seats: 0 });
  const s1 = b.add({ kind: 'chair', model: 'curved-booth', name: '软包靠背卡座', x: cx - 600, y: cy - 1030, w: 1200, d: 620, h: 1040, rotation: 0, color, seats: 2 });
  const s2 = b.add({ kind: 'chair', model: 'curved-booth', name: '软包靠背卡座', x: cx - 600, y: cy + 410, w: 1200, d: 620, h: 1040, rotation: 180, color, seats: 2 });
  b.group(name, [t, s1, s2], 4);
}

function addTwoCafeSet(b: Builder, cx: number, cy: number, chairColor = '#9b6b4a') {
  const t = b.add({ kind: 'table', model: 'marble-round-table', name: '大理石圆桌', x: cx - 425, y: cy - 425, w: 850, d: 850, h: 750, rotation: 0, color: '#e6e1d7', seats: 0 });
  const c1 = b.add({ kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx - 1010, y: cy - 260, w: 520, d: 520, h: 800, rotation: -90, color: chairColor, seats: 1 });
  const c2 = b.add({ kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx + 490, y: cy - 260, w: 520, d: 520, h: 800, rotation: 90, color: chairColor, seats: 1 });
  b.group('双人咖啡圆桌', [t, c1, c2], 2);
}

function addFourDiningSet(b: Builder, cx: number, cy: number, chairColor = '#7d8f88', tableColor = '#cfa97a', armchair = false) {
  const t = b.add({ kind: 'table', model: 'rect-table', name: '四人餐桌', x: cx - 600, y: cy - 400, w: 1200, d: 800, h: 750, rotation: 0, color: tableColor, seats: 0 });
  const m = armchair ? 'dining-armchair' as const : 'chair' as const;
  const cw = armchair ? 500 : 420, cd = armchair ? 500 : 450, ch = armchair ? 800 : 850;
  const members = [t];
  for (const sy of [-1, 1]) {
    for (const sx of [-1, 1]) {
      members.push(b.add({
        kind: 'chair', model: m, name: armchair ? '软包扶手餐椅' : '餐椅',
        x: cx + sx * 300 - cw / 2,
        y: cy + (sy < 0 ? -400 - cd - 70 : 400 + 70),
        w: cw, d: cd, h: ch, rotation: sy < 0 ? 0 : 180, color: chairColor, seats: 1,
      }));
    }
  }
  b.group('四人餐桌组', members, 4);
}

function addSixBenchSet(b: Builder, cx: number, cy: number) {
  const t = b.add({ kind: 'table', model: 'rect-table', name: '六人长桌', x: cx - 900, y: cy - 400, w: 1800, d: 800, h: 750, rotation: 0, color: '#d4b284', seats: 0 });
  const b1 = b.add({ kind: 'chair', model: 'bench', name: '长凳', x: cx - 800, y: cy - 860, w: 1600, d: 380, h: 450, rotation: 0, color: '#c49d6e', seats: 3 });
  const b2 = b.add({ kind: 'chair', model: 'bench', name: '长凳', x: cx - 800, y: cy + 480, w: 1600, d: 380, h: 450, rotation: 0, color: '#c49d6e', seats: 3 });
  b.group('六人食堂长桌组', [t, b1, b2], 6);
}

function addEightRoundSet(b: Builder, cx: number, cy: number, chairColor = '#8c5e42') {
  const t = b.add({ kind: 'table', model: 'round-table', name: '八人圆桌', x: cx - 900, y: cy - 900, w: 1800, d: 1800, h: 750, rotation: 0, color: '#b58454', seats: 0 });
  const members = [t];
  const radius = 1230;
  for (let n = 0; n < 8; n++) {
    const a = (n * Math.PI) / 4;
    const x = cx + Math.cos(a) * radius - 250;
    const y = cy + Math.sin(a) * radius - 250;
    const rot = (a * 180) / Math.PI + 90;
    members.push(b.add({ kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x, y, w: 500, d: 500, h: 800, rotation: rot, color: chairColor, seats: 1 }));
  }
  b.group('八人圆桌组', members, 8);
}

// Template 1: Mall Fast-Casual / Noodle Bistro with Open Kitchen (110㎡, 12m × 9.2m)
export function createBistroNoodleTemplate(customName?: string): Project {
  const W = 12000, H = 9200, wallH = 3100;
  const b = createBuilder();

  // Zones
  b.add({ kind: 'zone', name: '前厅就餐区', x: 300, y: 3100, w: 11400, d: 5800, h: 0, rotation: 0, color: '#e6f0e6' });
  b.add({ kind: 'zone', name: '明档热厨区', x: 300, y: 300, w: 7400, d: 2700, h: 0, rotation: 0, color: '#f7ece0' });
  b.add({ kind: 'zone', name: '水吧收银区', x: 7800, y: 300, w: 3900, d: 2700, h: 0, rotation: 0, color: '#e7eef6' });

  // Perimeter walls (storefront is bottom wall y = H - 100)
  b.wall(100, 100, W - 100, 100, wallH, '后背墙');
  b.wall(100, 100, 100, H - 100, wallH, '左侧墙');
  b.wall(W - 100, 100, W - 100, H - 100, wallH, '右侧墙');
  const frontWall = b.wall(100, H - 100, W - 100, H - 100, wallH, '临街门头墙');
  b.opening(frontWall, { kind: 'window', model: 'storefront-window', name: '商场落地橱窗', w: 3800, h: 2450, offset: 450, sill: 150, color: '#455961' });
  b.opening(frontWall, { kind: 'door', model: 'glass-double-door', name: '商场双开玻璃门', w: 1900, h: 2400, offset: 4950, color: '#455961', flipped: true });
  b.opening(frontWall, { kind: 'window', model: 'storefront-window', name: '商场落地橱窗', w: 3800, h: 2450, offset: 7500, sill: 150, color: '#455961' });

  // Open kitchen partition wall with pass-through serving window + kitchen access door
  const kitchenWall = b.wall(100, 3050, 7700, 3050, wallH, '明档隔墙');
  b.opening(kitchenWall, { kind: 'window', model: 'serving-window', name: '明档出餐窗', w: 3000, h: 1150, offset: 900, sill: 950, color: '#6b7e86' });
  b.opening(kitchenWall, { kind: 'door', model: 'door', name: '后厨单开门', w: 900, h: 2150, offset: 6200, color: '#b5956c', flipped: false });
  b.wall(7700, 100, 7700, 3050, wallH, '厨吧分隔墙');

  // Storefront fascia signboard & interior branding (all inside site bounds)
  b.add({ kind: 'decor', model: 'shop-sign', name: '禾风面馆 · 轻食明档', x: 4300, y: H - 120, w: 3400, d: 180, h: 660, rotation: 0, elevation: 2450, color: '#244237' });
  b.add({ kind: 'decor', model: 'menu-board', name: '发光菜单灯箱', x: 8600, y: 220, w: 2400, d: 120, h: 720, rotation: 0, elevation: 2050, color: '#262e32' });
  b.add({ kind: 'decor', model: 'tv-screen', name: '叫号宣传屏', x: 4700, y: 3160, w: 1200, d: 80, h: 680, rotation: 0, elevation: 2150, color: '#1f252a' });
  // Wood feature wall flush against left wall (center x=245, y=6150, facing right into room via rotation -90)
  b.add({ kind: 'decor', model: 'wood-feature-wall', name: '木饰面造型墙', x: 245 - 1700, y: 6150 - 40, w: 3400, d: 80, h: 2900, rotation: -90, color: '#b78d5e' });
  // Framed botanical diptych flush against inside of right wall (center x=W-245, y=7000, facing left via rotation 90)
  b.add({ kind: 'decor', model: 'wall-art', name: '装饰挂画组合', x: W - 245 - 800, y: 7000 - 30, w: 1600, d: 60, h: 850, rotation: 90, elevation: 1380, color: '#c6845c' });

  // Open kitchen equipment line (along rear wall y = 260..1200)
  b.add({ kind: 'stove', model: 'noodle-cooker', name: '六孔煮面炉', x: 450, y: 280, w: 1000, d: 750, h: 900, rotation: 0, color: '#adbac0' });
  b.add({ kind: 'stove', model: 'stove', name: '双头炉灶', x: 1550, y: 280, w: 1300, d: 850, h: 850, rotation: 0, color: '#96a3aa' });
  b.add({ kind: 'stove', model: 'fryer', name: '双缸电炸炉', x: 2950, y: 280, w: 850, d: 750, h: 900, rotation: 0, color: '#a7b4bd' });
  b.add({ kind: 'stove', model: 'hood', name: '落地式排烟罩组件', x: 550, y: 240, w: 3200, d: 1050, h: 2500, rotation: 0, color: '#adb8bc' });
  b.add({ kind: 'fridge', model: 'upright-fridge', name: '立式双门冰箱', x: 4100, y: 280, w: 850, d: 760, h: 1980, rotation: 0, color: '#9bb4c2' });
  b.add({ kind: 'sink', model: 'triple-sink', name: '三槽洗涤池', x: 5100, y: 280, w: 1750, d: 680, h: 850, rotation: 0, color: '#a5b7c0' });
  b.add({ kind: 'sink', model: 'dishwasher', name: '揭盖式洗碗机', x: 6900, y: 280, w: 700, d: 780, h: 1450, rotation: 0, color: '#a2b4bd' });
  // Kitchen pass-through prep worktables
  b.add({ kind: 'counter', model: 'dish-pass', name: '备餐传菜台', x: 1150, y: 2150, w: 2600, d: 700, h: 1350, rotation: 180, color: '#a3aeb4' });
  b.add({ kind: 'fridge', model: 'undercounter-fridge', name: '冷藏操作台', x: 3900, y: 2150, w: 1800, d: 700, h: 820, rotation: 180, color: '#a4b8bf' });

  // Front-of-house Cashier & Drink Bar (right rear zone)
  b.add({ kind: 'counter', model: 'cashier', name: '收银点餐台', x: 7950, y: 2450, w: 1350, d: 680, h: 1100, rotation: 0, color: '#586c63' });
  b.add({ kind: 'counter', model: 'tea-bar', name: '饮品水吧台', x: 9350, y: 2450, w: 2250, d: 720, h: 960, rotation: 0, color: '#586c63' });
  b.add({ kind: 'counter', model: 'coffee-machine', name: '商用咖啡机', x: 9650, y: 2550, w: 680, d: 520, h: 580, rotation: 0, color: '#394c52' });
  b.add({ kind: 'fridge', model: 'glass-fridge', name: '玻璃门饮料柜', x: 10550, y: 280, w: 1100, d: 680, h: 2000, rotation: 0, color: '#516973' });
  b.add({ kind: 'sink', model: 'single-sink', name: '吧台水槽', x: 8050, y: 280, w: 800, d: 620, h: 850, rotation: 0, color: '#a5b7c0' });
  b.add({ kind: 'fridge', model: 'ice-maker', name: '商用制冰机', x: 9000, y: 280, w: 700, d: 680, h: 1180, rotation: 0, color: '#b0c1c6' });
  b.add({ kind: 'counter', model: 'return-counter', name: '餐具回收台', x: 4750, y: 3240, w: 1150, d: 620, h: 900, rotation: 0, color: '#9cadab' });

  // Dining hall: Left column 2x Four-Seat Booths (8 seats)
  addFourBooth(b, 1300, 4950, '#49685c', '#be8f5e', '卡座 1 号');
  addFourBooth(b, 1300, 7450, '#49685c', '#be8f5e', '卡座 2 号');
  // Center aisle dining sets (8 seats)
  addFourDiningSet(b, 4150, 5050, '#8d6247', '#d2ac7c', true);
  addFourDiningSet(b, 4150, 7200, '#8d6247', '#d2ac7c', true);
  // Right zone 4-seat booth + 2-seat bistro tables (8 seats)
  addFourBooth(b, 10550, 5200, '#8e5e44', '#be8f5e', '卡座 3 号');
  addTwoCafeSet(b, 7950, 5350, '#49685c');
  addTwoCafeSet(b, 7950, 7350, '#49685c');
  // Window bar seating (3 seats) -> Total 27 seats
  const barTable = b.add({ kind: 'table', model: 'bar-table', name: '靠窗吧台桌', x: 9100, y: 8420, w: 2200, d: 450, h: 1050, rotation: 0, color: '#b88c5c', seats: 0 });
  const barStools = [9400, 10050, 10700].map(sx => b.add({ kind: 'chair', model: 'stool', name: '吧台高脚凳', x: sx, y: 7900, w: 420, d: 420, h: 750, rotation: 0, color: '#5f5242', seats: 1 }));
  b.group('临窗吧台三座', [barTable, ...barStools], 3);

  // Decor, airy wood slat divider (length in w, thickness in d, rotated 90 deg!) & greenery
  b.add({ kind: 'decor', model: 'podium', name: '迎宾点餐台', x: 6950, y: 8250, w: 620, d: 480, h: 1150, rotation: 0, color: '#56473b' });
  b.add({ kind: 'partition', model: 'slat-partition', name: '木格栅隔断', x: 2620 - 1100, y: 6900 - 60, w: 2200, d: 120, h: 1950, rotation: 90, color: '#b38b59' });
  b.add({ kind: 'decor', model: 'planter-divider', name: '绿植花槽隔断', x: 6050, y: 6150, w: 1450, d: 380, h: 1120, rotation: 0, color: '#8a6b4d' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 320, y: 3220, w: 560, d: 560, h: 1700, rotation: 0, color: '#4c7a52' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 11100, y: 3350, w: 620, d: 620, h: 1700, rotation: 0, color: '#4c7a52' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 3600, y: 8250, w: 580, d: 580, h: 1550, rotation: 0, color: '#4c7a52' });

  // Warm commercial lighting plan
  for (const [lx, ly] of [[1300, 4950], [1300, 7450], [4150, 5050], [4150, 7200], [10550, 5200]]) {
    b.add({ kind: 'lighting', model: 'linear-light', name: '条形餐桌吊灯', x: lx - 600, y: ly - 70, w: 1200, d: 140, h: 520, rotation: 0, elevation: 2350, color: '#2f3538' });
  }
  for (const [lx, ly] of [[7950, 5350], [7950, 7350], [8600, 2750], [10200, 2750]]) {
    b.add({ kind: 'lighting', model: 'pendant-lamp', name: '暖光餐桌吊灯', x: lx - 210, y: ly - 210, w: 420, d: 420, h: 680, rotation: 0, elevation: 2180, color: '#d7a15a' });
  }
  b.add({ kind: 'lighting', model: 'track-light', name: '商用轨道射灯', x: 5200, y: 4100, w: 1800, d: 200, h: 240, rotation: 0, elevation: 2820, color: '#2d3236' });
  b.add({ kind: 'lighting', model: 'kitchen-panel-light', name: '厨房防油平板灯', x: 2400, y: 1450, w: 1200, d: 320, h: 80, rotation: 0, elevation: 2950, color: '#eef3f5' });
  b.add({ kind: 'lighting', model: 'kitchen-panel-light', name: '厨房防油平板灯', x: 5400, y: 1450, w: 1200, d: 320, h: 80, rotation: 0, elevation: 2950, color: '#eef3f5' });

  const style: ProjectStyle = {
    floorMaterial: 'terrazzo',
    wallMaterial: 'warm-cream',
    ceilingHeight: 3200,
    lightingPreset: 'warm-dining',
    showCeiling: false,
    wallCutaway: false,
    showZoneTint3D: false,
    showLightsIn2D: true,
    shopType: '商场明档快餐 / 面馆',
  };

  return syncStructure({
    ...projectIdentity(),
    name: customName || '商场明档快餐 · 面馆示范铺',
    width: W,
    height: H,
    style,
    items: b.items,
    groups: b.groups,
    metadata: { customer: '', site: '购物中心 B1 餐饮街区', purpose: '明档快餐 / 品牌面馆', notes: '明档热厨与独立水吧收银。' },
  });
}

// Template 2: Boutique Cafe & Bakery Shop (80㎡, 10m × 8m)
export function createCafeBakeryTemplate(customName?: string): Project {
  const W = 10000, H = 8000, wallH = 3100;
  const b = createBuilder();

  b.add({ kind: 'zone', name: '客座品饮区', x: 300, y: 2600, w: 9400, d: 5100, h: 0, rotation: 0, color: '#f3ece0' });
  b.add({ kind: 'zone', name: '咖啡烘焙吧台', x: 300, y: 300, w: 6200, d: 2200, h: 0, rotation: 0, color: '#e8efe8' });
  b.add({ kind: 'zone', name: '后场备料洗消', x: 6700, y: 300, w: 3000, d: 2200, h: 0, rotation: 0, color: '#ebf0f5' });

  // Perimeter walls
  b.wall(100, 100, W - 100, 100, wallH, '后背墙', '#f3ede3');
  b.wall(100, 100, 100, H - 100, wallH, '左侧墙', '#f3ede3');
  b.wall(W - 100, 100, W - 100, H - 100, wallH, '右侧墙', '#f3ede3');
  const frontWall = b.wall(100, H - 100, W - 100, H - 100, wallH, '临街橱窗墙', '#f3ede3');
  b.opening(frontWall, { kind: 'window', model: 'storefront-window', name: '商场落地橱窗', w: 3600, h: 2450, offset: 400, sill: 150, color: '#46585e' });
  b.opening(frontWall, { kind: 'door', model: 'glass-double-door', name: '商场双开玻璃门', w: 1800, h: 2400, offset: 4400, color: '#46585e', flipped: true });
  b.opening(frontWall, { kind: 'window', model: 'storefront-window', name: '商场落地橱窗', w: 2800, h: 2450, offset: 6600, sill: 150, color: '#46585e' });

  // Back room wall
  const backWall = b.wall(6650, 100, 6650, 2600, wallH, '后场隔墙', '#f3ede3');
  b.opening(backWall, { kind: 'door', model: 'door', name: '后场门', w: 850, h: 2150, offset: 1450, color: '#b49269', flipped: false });
  b.wall(6650, 2600, W - 100, 2600, wallH, '后场前墙', '#f3ede3');

  // Branding & wall decor
  b.add({ kind: 'decor', model: 'shop-sign', name: 'MORNING · 精品咖啡烘焙', x: 3500, y: H - 120, w: 3200, d: 180, h: 660, rotation: 0, elevation: 2450, color: '#2b443a' });
  b.add({ kind: 'decor', model: 'menu-board', name: '发光菜单灯箱', x: 1800, y: 220, w: 2400, d: 120, h: 720, rotation: 0, elevation: 1950, color: '#2a3034' });
  b.add({ kind: 'decor', model: 'wood-feature-wall', name: '木饰面造型墙', x: 245 - 1600, y: 5150 - 40, w: 3200, d: 80, h: 2900, rotation: -90, color: '#bd9260' });
  b.add({ kind: 'decor', model: 'wall-art', name: '装饰挂画组合', x: 7400, y: 2710, w: 1600, d: 60, h: 850, rotation: 0, elevation: 1380, color: '#c6845c' });

  // Front coffee bar + pastry display + cashier
  b.add({ kind: 'counter', model: 'tea-bar', name: '精品咖啡吧台', x: 600, y: 1750, w: 2800, d: 750, h: 960, rotation: 0, color: '#4d6459' });
  b.add({ kind: 'counter', model: 'coffee-machine', name: '双头意式咖啡机', x: 1100, y: 1860, w: 760, d: 540, h: 600, rotation: 0, color: '#3b4a4e' });
  b.add({ kind: 'counter', model: 'display-counter', name: '烘焙甜品展示柜', x: 3450, y: 1750, w: 1550, d: 720, h: 1260, rotation: 0, color: '#8d9d97' });
  b.add({ kind: 'counter', model: 'cashier', name: '收银点单台', x: 5080, y: 2700, w: 1200, d: 680, h: 1100, rotation: 0, color: '#4d6459' });
  b.add({ kind: 'fridge', model: 'undercounter-fridge', name: '吧台冷藏操作台', x: 600, y: 260, w: 1900, d: 700, h: 820, rotation: 0, color: '#9fb3ba' });
  b.add({ kind: 'sink', model: 'single-sink', name: '吧台洗杯池', x: 2600, y: 260, w: 750, d: 650, h: 850, rotation: 0, color: '#a5b7c0' });
  b.add({ kind: 'fridge', model: 'ice-maker', name: '商用制冰机', x: 3500, y: 260, w: 700, d: 680, h: 1150, rotation: 0, color: '#b0c1c6' });
  b.add({ kind: 'shelf', model: 'cabinet', name: '原料储物柜', x: 4400, y: 260, w: 1400, d: 580, h: 1800, rotation: 0, color: '#9ea898' });

  // Back wash & bake room
  b.add({ kind: 'stove', model: 'oven', name: '双层烘焙烤箱', x: 6900, y: 260, w: 1200, d: 820, h: 1350, rotation: 0, color: '#99a9b3' });
  b.add({ kind: 'fridge', model: 'upright-fridge', name: '立式冷藏柜', x: 8300, y: 260, w: 800, d: 750, h: 1950, rotation: 0, color: '#9db7c5' });
  b.add({ kind: 'sink', model: 'sink', name: '双槽洗涤池', x: 8400, y: 1750, w: 1250, d: 650, h: 850, rotation: 180, color: '#a5b7c0' });

  // Seating: Cozy booth on left wall + generously spaced round marble bistro tables + window bar
  addFourBooth(b, 1280, 5200, '#5a7265', '#c59969', '靠墙卡座');
  addTwoCafeSet(b, 4300, 4200, '#9c6c4a');
  addTwoCafeSet(b, 7750, 4200, '#5a7265');
  addFourDiningSet(b, 7850, 6250, '#9c6c4a', '#c9a072', true);

  // Window coffee bar (4 seats) -> Total 16 seats
  const bar = b.add({ kind: 'table', model: 'bar-table', name: '临街落地窗吧台', x: 950, y: 7260, w: 2800, d: 450, h: 1050, rotation: 0, color: '#bc905e', seats: 0 });
  const stools = [1180, 1820, 2460, 3100].map(sx => b.add({ kind: 'chair', model: 'stool', name: '吧台高脚凳', x: sx, y: 6720, w: 420, d: 420, h: 750, rotation: 0, color: '#6b5944', seats: 1 }));
  b.group('临窗咖啡吧台', [bar, ...stools], 4);

  // Lush greenery
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 320, y: 2950, w: 620, d: 620, h: 1750, rotation: 0, color: '#4c7a52' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 9050, y: 7050, w: 620, d: 620, h: 1650, rotation: 0, color: '#4c7a52' });
  b.add({ kind: 'decor', model: 'planter-divider', name: '绿植花槽隔断', x: 2550 - 700, y: 5450 - 190, w: 1400, d: 380, h: 1100, rotation: 90, color: '#8d6e4f' });

  // Warm café lighting
  b.add({ kind: 'lighting', model: 'chandelier', name: '环形主吊灯', x: 5450, y: 4850, w: 950, d: 950, h: 650, rotation: 0, elevation: 2350, color: '#cfa058' });
  for (const [lx, ly] of [[1550, 2100], [3200, 2100], [5100, 2100], [1280, 5200], [4300, 4200], [7750, 4200], [7850, 6250]]) {
    b.add({ kind: 'lighting', model: 'pendant-lamp', name: '暖光餐桌吊灯', x: lx - 200, y: ly - 200, w: 400, d: 400, h: 680, rotation: 0, elevation: 2160, color: '#d8a25e' });
  }
  b.add({ kind: 'lighting', model: 'wall-sconce', name: '氛围壁灯', x: 340, y: 4950, w: 240, d: 180, h: 360, rotation: 90, elevation: 1850, color: '#c99556' });
  b.add({ kind: 'lighting', model: 'track-light', name: '商用轨道射灯', x: 1400, y: 6950, w: 1800, d: 200, h: 240, rotation: 0, elevation: 2820, color: '#2f3438' });

  return syncStructure({
    ...projectIdentity(),
    name: customName || '精品咖啡 · 轻食烘焙铺',
    width: W,
    height: H,
    style: {
      floorMaterial: 'oak-wood',
      wallMaterial: 'warm-cream',
      ceilingHeight: 3200,
      lightingPreset: 'warm-dining',
      showCeiling: false,
      wallCutaway: false,
      showZoneTint3D: false,
      showLightsIn2D: true,
      shopType: '精品咖啡 / 茶饮烘焙',
    },
    items: b.items,
    groups: b.groups,
    metadata: { customer: '', site: '购物中心 1F 临街铺位', purpose: '咖啡茶饮与轻食烘焙', notes: '暖橡木地板 + 奶油墙面 + 临窗吧台 + 烘焙展示柜，16 座宽敞客区。' },
  });
}

// Template 3: Modern Enterprise Canteen / Food Hall (240㎡, 20m × 12m)
export function createEnterpriseCanteenTemplate(customName?: string): Project {
  const W = 20000, H = 12000, wallH = 3400;
  const b = createBuilder();

  b.add({ kind: 'zone', name: '员工就餐大厅', x: 300, y: 300, w: 11800, d: 11400, h: 0, rotation: 0, color: '#e6f1e6' });
  b.add({ kind: 'zone', name: '自助取餐与结算区', x: 12300, y: 6900, w: 7400, d: 4800, h: 0, rotation: 0, color: '#e6eef7' });
  b.add({ kind: 'zone', name: '热厨加工与洗消区', x: 12300, y: 300, w: 7400, d: 6300, h: 0, rotation: 0, color: '#f8ede0' });

  // Perimeter walls
  const north = b.wall(100, 100, W - 100, 100, wallH, '北侧外墙');
  b.opening(north, { kind: 'window', model: 'fixed-window', name: '采光高窗', w: 2800, h: 1400, offset: 1400, sill: 1100, color: '#6b8590' });
  b.opening(north, { kind: 'window', model: 'fixed-window', name: '采光高窗', w: 2800, h: 1400, offset: 6400, sill: 1100, color: '#6b8590' });
  b.wall(100, 100, 100, H - 100, wallH, '西侧外墙');
  b.wall(W - 100, 100, W - 100, H - 100, wallH, '东侧外墙');
  const south = b.wall(100, H - 100, W - 100, H - 100, wallH, '南侧主入口墙');
  b.opening(south, { kind: 'window', model: 'storefront-window', name: '落地采光窗', w: 3600, h: 2500, offset: 700, sill: 150, color: '#4f636b' });
  b.opening(south, { kind: 'door', model: 'glass-double-door', name: '食堂主入口双开门', w: 2200, h: 2450, offset: 5200, color: '#4f636b', flipped: true });
  b.opening(south, { kind: 'window', model: 'storefront-window', name: '落地采光窗', w: 3600, h: 2500, offset: 8300, sill: 150, color: '#4f636b' });

  // Kitchen partition wall
  const kWall = b.wall(12200, 100, 12200, 6650, wallH, '后厨隔断墙');
  b.opening(kWall, { kind: 'window', model: 'serving-window', name: '明档备餐窗', w: 2600, h: 1100, offset: 2200, sill: 950, color: '#6b7e86' });
  const kSouth = b.wall(12200, 6650, W - 100, 6650, wallH, '取餐隔墙');
  b.opening(kSouth, { kind: 'door', model: 'double-door', name: '传菜双开门', w: 1600, h: 2200, offset: 5400, color: '#b09169', flipped: false });

  // Each row has two six-seat bench sets and one four-seat table.
  for (const cy of [2200, 5200, 8200]) {
    addSixBenchSet(b, 2100, cy);
    addSixBenchSet(b, 5500, cy);
    addFourDiningSet(b, 9200, cy, '#768d85', '#d5b384', false);
  }
  // Greenery dividers & signage
  b.add({ kind: 'decor', model: 'shop-sign', name: '悦食企业员工餐厅', x: 4600, y: H - 120, w: 3600, d: 180, h: 700, rotation: 0, elevation: 2550, color: '#24453a' });
  b.add({ kind: 'decor', model: 'menu-board', name: '今日餐牌灯箱', x: 13200, y: 6780, w: 2800, d: 120, h: 720, rotation: 0, elevation: 2150, color: '#263034' });
  b.add({ kind: 'decor', model: 'planter-divider', name: '绿植花槽隔断', x: 11400 - 900, y: 3600 - 200, w: 1800, d: 400, h: 1150, rotation: 90, color: '#8a6d4f' });
  b.add({ kind: 'decor', model: 'planter-divider', name: '绿植花槽隔断', x: 11400 - 900, y: 7400 - 200, w: 1800, d: 400, h: 1150, rotation: 90, color: '#8a6d4f' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 450, y: 10700, w: 680, d: 680, h: 1750, rotation: 0, color: '#4c7a52' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 11100, y: 10700, w: 680, d: 680, h: 1750, rotation: 0, color: '#4c7a52' });

  // Self-service Buffet & Pickup Line
  b.add({ kind: 'shelf', model: 'tray-rack', name: '托盘餐具架', x: 12650, y: 8400, w: 900, d: 550, h: 1400, rotation: 0, color: '#b2bebf' });
  b.add({ kind: 'counter', model: 'buffet', name: '热菜自助取餐台 1', x: 13750, y: 8300, w: 2400, d: 780, h: 900, rotation: 0, color: '#6b887e' });
  b.add({ kind: 'counter', model: 'buffet', name: '热菜自助取餐台 2', x: 16250, y: 8300, w: 2400, d: 780, h: 900, rotation: 0, color: '#6b887e' });
  b.add({ kind: 'counter', model: 'cashier', name: '智能结算台', x: 18600, y: 9800, w: 1100, d: 680, h: 1100, rotation: 90, color: '#6b887e' });
  b.add({ kind: 'counter', model: 'return-counter', name: '餐具集中回收台', x: 12600, y: 10600, w: 2200, d: 750, h: 900, rotation: 180, color: '#99acab' });
  b.add({ kind: 'sink', model: 'handwash', name: '就餐洗手盆', x: 11100, y: 9500, w: 550, d: 480, h: 850, rotation: 0, color: '#cad6d4' });

  // Hot Kitchen & Dishwashing Zone
  b.add({ kind: 'stove', model: 'wok', name: '单头大锅灶', x: 12800, y: 320, w: 1100, d: 1100, h: 1000, rotation: 0, color: '#9ba9b0' });
  b.add({ kind: 'stove', model: 'stove', name: '双头燃气炉灶', x: 14050, y: 320, w: 1400, d: 950, h: 850, rotation: 0, color: '#8f9da5' });
  b.add({ kind: 'stove', model: 'steamer', name: '双门蒸饭柜', x: 15600, y: 320, w: 1400, d: 820, h: 1650, rotation: 0, color: '#b4c0c6' });
  b.add({ kind: 'stove', model: 'hood', name: '大型排烟罩组', x: 12800, y: 260, w: 4200, d: 1150, h: 2600, rotation: 0, color: '#a8b5b9' });
  b.add({ kind: 'fridge', model: 'upright-fridge', name: '双门冷库冰箱 1', x: 17500, y: 320, w: 850, d: 780, h: 2000, rotation: 0, color: '#9ab4c2' });
  b.add({ kind: 'fridge', model: 'upright-fridge', name: '双门冷库冰箱 2', x: 18500, y: 320, w: 850, d: 780, h: 2000, rotation: 0, color: '#9ab4c2' });
  // Kitchen center prep island
  b.add({ kind: 'counter', model: 'worktable', name: '中央备菜工作台 1', x: 13400, y: 2700, w: 2200, d: 800, h: 850, rotation: 0, color: '#a6aeb7' });
  b.add({ kind: 'counter', model: 'worktable', name: '中央备菜工作台 2', x: 15800, y: 2700, w: 2200, d: 800, h: 850, rotation: 0, color: '#a6aeb7' });
  // Wash & sterilize wall
  b.add({ kind: 'sink', model: 'triple-sink', name: '三槽粗洗池', x: 12800, y: 5400, w: 1900, d: 700, h: 850, rotation: 180, color: '#a4b7c0' });
  b.add({ kind: 'sink', model: 'dishwasher', name: '商用洗碗机', x: 14900, y: 5350, w: 800, d: 800, h: 1450, rotation: 180, color: '#a2b4bd' });
  b.add({ kind: 'shelf', model: 'sterilizer', name: '双门餐具消毒柜', x: 15900, y: 5450, w: 1300, d: 680, h: 1850, rotation: 180, color: '#9cb0bb' });
  b.add({ kind: 'shelf', model: 'shelf', name: '干货储物货架', x: 19250 - 900, y: 3100 - 250, w: 1800, d: 500, h: 1850, rotation: 90, color: '#baa68d' });

  // Lighting grid across dining hall + kitchen panels
  for (const cx of [2100, 5500, 9200]) {
    for (const cy of [2200, 5200, 8200]) {
      b.add({ kind: 'lighting', model: 'linear-light', name: '餐区条形吊灯', x: cx - 750, y: cy - 70, w: 1500, d: 140, h: 520, rotation: 0, elevation: 2550, color: '#343a3e' });
    }
  }
  b.add({ kind: 'lighting', model: 'track-light', name: '取餐区射灯', x: 14800, y: 8500, w: 2200, d: 200, h: 240, rotation: 0, elevation: 3050, color: '#2f3438' });
  b.add({ kind: 'lighting', model: 'kitchen-panel-light', name: '厨房平板灯 1', x: 14200, y: 2000, w: 1400, d: 340, h: 80, rotation: 0, elevation: 3200, color: '#eef3f5' });
  b.add({ kind: 'lighting', model: 'kitchen-panel-light', name: '厨房平板灯 2', x: 16800, y: 4200, w: 1400, d: 340, h: 80, rotation: 0, elevation: 3200, color: '#eef3f5' });

  return syncStructure({
    ...projectIdentity(),
    name: customName || '企业员工食堂 · 标准示范方案',
    width: W,
    height: H,
    style: {
      floorMaterial: 'warm-tile',
      wallMaterial: 'plaster',
      ceilingHeight: 3400,
      lightingPreset: 'daylight',
      showCeiling: false,
      wallCutaway: false,
      showZoneTint3D: false,
      showLightsIn2D: true,
      shopType: '企业食堂 / 美食广场',
    },
    items: b.items,
    groups: b.groups,
    metadata: { customer: '', site: '产业园 1F 员工食堂', purpose: '企业食堂与自助取餐', notes: '双取餐档口与独立热厨、洗消区。' },
  });
}

// Template 4: Mall Featured Restaurant / Hotpot & Private Dining (140㎡, 14m × 10m)
export function createFeaturedRestaurantTemplate(customName?: string): Project {
  const W = 14000, H = 10000, wallH = 3200;
  const b = createBuilder();

  b.add({ kind: 'zone', name: '主客座与卡座区', x: 300, y: 3300, w: 9200, d: 6400, h: 0, rotation: 0, color: '#f2ebe2' });
  b.add({ kind: 'zone', name: '半私密圆桌雅座', x: 9600, y: 3300, w: 4100, d: 6400, h: 0, rotation: 0, color: '#e9efe8' });
  b.add({ kind: 'zone', name: '后厨与传菜间', x: 300, y: 300, w: 13400, d: 2800, h: 0, rotation: 0, color: '#f7ece1' });

  // Perimeter walls
  b.wall(100, 100, W - 100, 100, wallH, '后背墙', '#eee7dc');
  b.wall(100, 100, 100, H - 100, wallH, '左侧墙', '#eee7dc');
  const rightWall = b.wall(W - 100, 100, W - 100, H - 100, wallH, '右侧转角落地窗墙', '#eee7dc');
  b.opening(rightWall, { kind: 'window', model: 'storefront-window', name: '转角落地橱窗', w: 4400, h: 2500, offset: 4100, sill: 150, color: '#455961' });
  const frontWall = b.wall(100, H - 100, W - 100, H - 100, wallH, '临街门头墙', '#eee7dc');
  b.opening(frontWall, { kind: 'window', model: 'storefront-window', name: '商场落地橱窗', w: 4200, h: 2500, offset: 500, sill: 150, color: '#455961' });
  b.opening(frontWall, { kind: 'door', model: 'glass-double-door', name: '双开玻璃大门', w: 2000, h: 2450, offset: 5400, color: '#455961', flipped: true });
  b.opening(frontWall, { kind: 'window', model: 'storefront-window', name: '商场落地橱窗', w: 4800, h: 2500, offset: 8200, sill: 150, color: '#455961' });

  // Kitchen dividing wall
  const kitchenWall = b.wall(100, 3200, W - 100, 3200, wallH, '后厨隔墙', '#eee7dc');
  b.opening(kitchenWall, { kind: 'window', model: 'serving-window', name: '传菜明窗', w: 2400, h: 1100, offset: 3200, sill: 950, color: '#6b7e86' });
  b.opening(kitchenWall, { kind: 'door', model: 'door', name: '传菜通道门', w: 1000, h: 2150, offset: 7200, color: '#b49269', flipped: false });

  // Branding & reception
  b.add({ kind: 'decor', model: 'shop-sign', name: '山海小馆 · 精品中餐', x: 4700, y: H - 120, w: 3600, d: 180, h: 720, rotation: 0, elevation: 2450, color: '#274238' });
  b.add({ kind: 'decor', model: 'podium', name: '迎宾接待台', x: 7550, y: 8900, w: 680, d: 520, h: 1150, rotation: 0, color: '#55463a' });
  b.add({ kind: 'chair', model: 'waiting-bench', name: '候餐排椅', x: 3200, y: 9050, w: 1800, d: 580, h: 850, rotation: 180, color: '#6a7d75', seats: 3 });
  b.add({ kind: 'counter', model: 'cashier', name: '前厅吧台收银', x: 8600, y: 3450, w: 1400, d: 680, h: 1100, rotation: 0, color: '#52655c' });
  b.add({ kind: 'counter', model: 'sushi-display', name: '明档鲜切食材展示柜', x: 3400, y: 3450, w: 2200, d: 780, h: 1260, rotation: 0, color: '#788d94' });

  // Main booths & hotpot/dining tables
  addFourBooth(b, 1400, 5200, '#5a6f62', '#a87c50', '雅致卡座 1');
  addFourBooth(b, 1400, 7750, '#5a6f62', '#a87c50', '雅致卡座 2');
  addFourDiningSet(b, 4650, 5600, '#8d5f43', '#ab7e52', true);
  addFourDiningSet(b, 4650, 7700, '#8d5f43', '#ab7e52', true);
  addFourDiningSet(b, 7450, 5800, '#8d5f43', '#ab7e52', true);

  // Semi-private round banquet table alcove separated by airy wood slat partition (rotated properly!)
  b.add({ kind: 'partition', model: 'slat-partition', name: '木格栅半包隔断', x: 9320 - 1300, y: 6500 - 60, w: 2600, d: 120, h: 2200, rotation: 90, color: '#a87e4d' });
  addEightRoundSet(b, 11550, 6750, '#8c5e42');

  // Back kitchen line
  b.add({ kind: 'stove', model: 'wok', name: '大锅炒灶 1', x: 600, y: 300, w: 1100, d: 1100, h: 1000, rotation: 0, color: '#9ba9b0' });
  b.add({ kind: 'stove', model: 'stove', name: '双头燃气炉灶', x: 1850, y: 300, w: 1350, d: 920, h: 850, rotation: 0, color: '#8f9da5' });
  b.add({ kind: 'stove', model: 'steamer', name: '海鲜蒸柜', x: 3350, y: 300, w: 1350, d: 800, h: 1650, rotation: 0, color: '#b4c0c6' });
  b.add({ kind: 'stove', model: 'hood', name: '排烟罩组', x: 600, y: 260, w: 4100, d: 1120, h: 2550, rotation: 0, color: '#a8b5b9' });
  b.add({ kind: 'counter', model: 'dish-pass', name: '备餐传菜台', x: 3250, y: 2200, w: 2500, d: 720, h: 1350, rotation: 180, color: '#a2adb3' });
  b.add({ kind: 'counter', model: 'worktable', name: '切配工作台', x: 6200, y: 300, w: 2000, d: 750, h: 850, rotation: 0, color: '#a6aeb7' });
  b.add({ kind: 'fridge', model: 'upright-fridge', name: '立式双门冰箱', x: 8500, y: 300, w: 850, d: 780, h: 2000, rotation: 0, color: '#9ab4c2' });
  b.add({ kind: 'sink', model: 'triple-sink', name: '三槽洗消池', x: 9700, y: 300, w: 1850, d: 700, h: 850, rotation: 0, color: '#a4b7c0' });
  b.add({ kind: 'sink', model: 'dishwasher', name: '商用洗碗机', x: 11750, y: 300, w: 780, d: 800, h: 1450, rotation: 0, color: '#a2b4bd' });
  b.add({ kind: 'shelf', model: 'sterilizer', name: '双门消毒柜', x: 11600, y: 2250, w: 1200, d: 660, h: 1850, rotation: 180, color: '#9cb0bb' });

  // Decor & ambient evening lighting
  b.add({ kind: 'decor', model: 'wood-feature-wall', name: '木饰面造型墙', x: 245 - 2100, y: 6500 - 40, w: 4200, d: 80, h: 2950, rotation: -90, color: '#b18454' });
  b.add({ kind: 'decor', model: 'wall-art', name: '装饰挂画组合', x: 10800, y: 3320, w: 1800, d: 60, h: 900, rotation: 0, elevation: 1400, color: '#c6845c' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 360, y: 3450, w: 650, d: 650, h: 1800, rotation: 0, color: '#4c7a52' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 12950, y: 3500, w: 650, d: 650, h: 1800, rotation: 0, color: '#4c7a52' });
  b.add({ kind: 'decor', model: 'potted-plant', name: '大型绿植盆栽', x: 12950, y: 8950, w: 650, d: 650, h: 1700, rotation: 0, color: '#4c7a52' });

  b.add({ kind: 'lighting', model: 'chandelier', name: '包厢环形主吊灯', x: 11075, y: 6275, w: 950, d: 950, h: 680, rotation: 0, elevation: 2350, color: '#d4a254' });
  b.add({ kind: 'lighting', model: 'chandelier', name: '大厅环形主吊灯', x: 4175, y: 6175, w: 950, d: 950, h: 680, rotation: 0, elevation: 2400, color: '#d4a254' });
  for (const [lx, ly] of [[1400, 5200], [1400, 7750], [7450, 5800], [9300, 3800]]) {
    b.add({ kind: 'lighting', model: 'pendant-lamp', name: '暖光吊灯', x: lx - 210, y: ly - 210, w: 420, d: 420, h: 680, rotation: 0, elevation: 2180, color: '#d8a25e' });
  }
  b.add({ kind: 'lighting', model: 'wall-sconce', name: '氛围壁灯', x: 330, y: 5200, w: 240, d: 180, h: 360, rotation: 90, elevation: 1850, color: '#c99556' });
  b.add({ kind: 'lighting', model: 'wall-sconce', name: '氛围壁灯', x: 330, y: 7750, w: 240, d: 180, h: 360, rotation: 90, elevation: 1850, color: '#c99556' });
  b.add({ kind: 'lighting', model: 'kitchen-panel-light', name: '后厨平板灯', x: 6400, y: 1500, w: 1400, d: 340, h: 80, rotation: 0, elevation: 3000, color: '#eef3f5' });

  return syncStructure({
    ...projectIdentity(),
    name: customName || '商场精品中餐 · 主题小馆',
    width: W,
    height: H,
    style: {
      floorMaterial: 'oak-wood',
      wallMaterial: 'warm-cream',
      ceilingHeight: 3200,
      lightingPreset: 'evening',
      showCeiling: false,
      wallCutaway: false,
      showZoneTint3D: false,
      showLightsIn2D: true,
      shopType: '精品中餐 / 主题小馆',
    },
    items: b.items,
    groups: b.groups,
    metadata: { customer: '', site: '购物中心 3F 转角铺位', purpose: '精品中餐与宴请聚餐', notes: '31 座（含 8 人圆桌雅座）+ 转角落地橱窗 + 晚间暖光氛围。' },
  });
}

export const shopTemplates: ShopTemplateMeta[] = [
  {
    id: 'bistro-noodle',
    name: '商场明档快餐 / 面馆',
    tag: '最受欢迎 · 110㎡',
    areaLabel: '12m × 9.2m',
    feature: '明档热厨',
    summary: '含临街落地玻璃橱窗、发光门头、明档出餐窗、完整热厨与水吧收银，可直接微调落地。',
    accent: '#2f5e4b',
    build: createBistroNoodleTemplate,
  },
  {
    id: 'cafe-bakery',
    name: '精品咖啡 / 茶饮烘焙铺',
    tag: '轻餐饮 · 80㎡',
    areaLabel: '10m × 8m',
    feature: '暖橡木风格',
    summary: '暖橡木地板、临窗吧台、甜品展示柜、意式咖啡吧台与后场烘焙洗消间，氛围感拉满。',
    accent: '#9d6b3f',
    build: createCafeBakeryTemplate,
  },
  {
    id: 'enterprise-canteen',
    name: '企业员工食堂 / 美食档口',
    tag: '大空间 · 240㎡',
    areaLabel: '20m × 12m',
    feature: '双取餐线',
    summary: '宽敞员工就餐大厅、双自助取餐线、智能结算、独立热厨大锅灶/蒸饭柜与集中洗消间。',
    accent: '#3e6a73',
    build: createEnterpriseCanteenTemplate,
  },
  {
    id: 'featured-restaurant',
    name: '商场精品中餐 / 主题小馆',
    tag: '正餐转角铺 · 140㎡',
    areaLabel: '14m × 10m',
    feature: '含圆桌雅座',
    summary: '双面落地转角橱窗、软包卡座、木格栅半包圆桌雅座、明档食材柜与晚间灯光氛围。',
    accent: '#7d4c3b',
    build: createFeaturedRestaurantTemplate,
  },
];

export type CustomShopSpec = {
  name: string;
  widthM: number;
  depthM: number;
  ceilingM: number;
  shape: 'rectangle' | 'l-shape';
  floorMaterial: FloorMaterial;
  wallMaterial: WallMaterial;
  lightingPreset: LightingPreset;
  notchWidthM?: number;
  notchDepthM?: number;
  addWalls: boolean;
  addStorefront: boolean;
  addZones: boolean;
};

export function createCustomShopShell(spec: CustomShopSpec): Project {
  const minExtent = spec.addZones || spec.addStorefront ? 4000 : 1000;
  const W = Math.max(minExtent, Math.min(60000, Math.round(spec.widthM * 1000)));
  const H = Math.max(minExtent, Math.min(60000, Math.round(spec.depthM * 1000)));
  const wallH = Math.max(2400, Math.min(6000, Math.round(spec.ceilingM * 1000)));
  const b = createBuilder();

  let outline: Point[] | undefined;
  const innerX = W - Math.round((spec.notchWidthM ?? W * 0.38 / 1000) * 1000);
  const innerY = H - Math.round((spec.notchDepthM ?? H * 0.45 / 1000) * 1000);
  if (spec.shape === 'l-shape') {
    if (!(innerX > 0 && innerY > 0 && innerX < W && innerY < H)) throw Error('缺口宽度和深度必须分别小于开间和进深');
    if (spec.addWalls && Math.min(innerX - 200, innerY - 200, W - innerX, H - innerY) < 300) throw Error('外墙中心线最短需 300 mm。请核对缺口尺寸，或取消围墙后手动画墙');
    outline = [
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: W, y: innerY },
      { x: innerX, y: innerY },
      { x: innerX, y: H },
      { x: 0, y: H },
    ];
  }

  if (spec.addZones) {
    const kitchenH = Math.round(H * 0.32);
    b.add({ kind: 'zone', name: '后厨 / 操作区', x: 300, y: 300, w: W - 600, d: kitchenH - 400, h: 0, rotation: 0, color: '#f7ece0' });
    b.add({ kind: 'zone', name: '前厅就餐区', x: 300, y: kitchenH + 100, w: (spec.shape === 'l-shape' ? innerX : W) - 600, d: H - kitchenH - 400, h: 0, rotation: 0, color: '#e6f0e6' });
  }

  if (spec.addWalls) {
    const pts = outline ?? [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    const inset = 100;
    const clamped = insetPolygon(pts, inset);
    let frontWallId = '';
    let frontLen = 0;
    let frontMidX = W / 2;
    for (let i = 0; i < clamped.length; i++) {
      const p1 = clamped[i], p2 = clamped[(i + 1) % clamped.length];
      const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (len < 300) continue;
      const id = b.wall(p1.x, p1.y, p2.x, p2.y, wallH, `外墙 ${i + 1}`);
      // Identify the bottom-most horizontal wall as storefront
      if (Math.abs(p1.y - (H - inset)) < 20 && Math.abs(p2.y - (H - inset)) < 20 && len > frontLen) {
        frontWallId = id;
        frontLen = len;
        frontMidX = (p1.x + p2.x) / 2;
      }
    }
    if (spec.addStorefront && frontWallId) {
      const singleDoor = frontLen < 4000;
      const doorW = singleDoor ? 900 : Math.min(1800, Math.max(1400, Math.round(frontLen * 0.28)));
      const doorH = Math.min(2350, wallH - 250);
      const doorOffset = Math.round((frontLen - doorW) / 2);
      b.opening(frontWallId, { kind: 'door', model: singleDoor ? 'door' : 'glass-double-door', name: singleDoor ? '临街单开门' : '商场双开玻璃门', w: doorW, h: doorH, offset: doorOffset, color: '#46585e', flipped: true });
      const leftSpace = doorOffset - 300;
      if (leftSpace >= 1000) {
        const winW = Math.min(3600, Math.round(leftSpace - 100));
        b.opening(frontWallId, { kind: 'window', model: 'storefront-window', name: '临街落地橱窗', w: winW, h: Math.min(2400, wallH - 350), offset: Math.max(120, Math.round((doorOffset - winW) / 2)), sill: 150, color: '#46585e' });
      }
      const rightStart = doorOffset + doorW + 150;
      const rightSpace = frontLen - rightStart - 150;
      if (rightSpace >= 1000) {
        const winW = Math.min(3600, Math.round(rightSpace - 100));
        b.opening(frontWallId, { kind: 'window', model: 'storefront-window', name: '临街落地橱窗', w: winW, h: Math.min(2400, wallH - 350), offset: rightStart + Math.round((rightSpace - winW) / 2), sill: 150, color: '#46585e' });
      }
      const signW = Math.min(3200, Math.round(frontLen * 0.45));
      b.add({ kind: 'decor', model: 'shop-sign', name: spec.name || '我的新店招牌', x: frontMidX - signW / 2, y: H - 120, w: signW, d: 180, h: 660, rotation: 0, elevation: Math.min(wallH - 650, 2400), color: '#274238' });
    }
  }

  return syncStructure({
    ...projectIdentity(),
    name: spec.name.trim() || '新建租赁铺位方案',
    width: W,
    height: H,
    outline,
    style: {
      floorMaterial: spec.floorMaterial,
      wallMaterial: spec.wallMaterial,
      ceilingHeight: wallH,
      lightingPreset: spec.lightingPreset,
      showCeiling: false,
      wallCutaway: false,
      showZoneTint3D: true,
      showLightsIn2D: true,
      shopType: '自定义租赁铺位',
    },
    items: b.items,
    groups: b.groups,
    metadata: { customer: '', site: `${spec.widthM}m × ${spec.depthM}m 租赁铺位`, purpose: '自主开店空间规划', notes: '' },
  });
}

// Offset a simple closed polygon inward by `inset` mm so 200mm perimeter walls stay flush inside the site outline.
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

// One-click helper to wrap perimeter walls cleanly inside the current project's site outline.
export function buildPerimeterWalls(project: Project): Item[] {
  const thickness = 200;
  const pts = insetPolygon(siteOutline(project), thickness / 2);
  const wallH = project.style?.ceilingHeight ?? 3100;
  const walls: Item[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 250) continue;
    const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
    const along = (p: Point) => (p.x - a.x) * dx + (p.y - a.y) * dy;
    const across = (p: Point) => (p.y - a.y) * dx - (p.x - a.x) * dy;
    const covered = project.items.filter(w => w.kind === 'wall').flatMap(w => {
      const from = wallPoint(w, 0), to = wallPoint(w, w.w);
      if (Math.abs(across(from)) > 1 || Math.abs(across(to)) > 1) return [];
      const start = Math.max(0, Math.min(along(from), along(to)));
      const end = Math.min(length, Math.max(along(from), along(to)));
      return end > start ? [{ start, end }] : [];
    }).sort((u, v) => u.start - v.start);
    const at = (n: number) => ({ x: a.x + dx * n, y: a.y + dy * n });
    let cursor = 0;
    for (const span of [...covered, { start: length, end: length }]) {
      if (span.start - cursor >= 250) {
        const pose = segmentPose(at(cursor), at(span.start), thickness);
        walls.push({ id: uid(), kind: 'wall', model: 'wall', name: `外围墙 ${i + 1}`, ...pose, d: thickness, h: wallH, color: '#efe9df' });
      }
      cursor = Math.max(cursor, span.end);
    }
  }
  return walls;
}
