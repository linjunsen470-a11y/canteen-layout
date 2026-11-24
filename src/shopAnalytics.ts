import { Item, Project, modelOf } from './model';
import { isAnnotation } from './annotations';
import { isVisible } from './editorInteraction';
import { siteArea } from './site';
import { zoneArea } from './zones';
import { seatSummary } from './layoutGroups';
import { isBuilding } from './structure';

export type BomRow = {
  category: string;
  name: string;
  spec: string;
  count: number;
  unitPriceMin: number;
  unitPriceMax: number;
};

export type ReadinessItem = {
  label: string;
  ok: boolean;
  detail: string;
};

export type ShopInsights = {
  areaSqm: number;
  seats: number;
  unknownSeats: number;
  sqmPerSeat: number | null;
  comfortLabel: string;
  diningSqm: number;
  kitchenSqm: number;
  serviceSqm: number;
  diningRatioPct: number | null;
  kitchenRatioPct: number | null;
  ratioAdvice: string;
  totalItems: number;
  lightingCount: number;
  decorCount: number;
  kitchenEquipCount: number;
  bom: BomRow[];
  budgetMin: number;
  budgetMax: number;
  readiness: ReadinessItem[];
};

function estimateUnitPrice(item: Item): [number, number] {
  const m = modelOf(item);
  switch (m) {
    case 'rect-table': case 'booth-table': case 'fold-table': return [650, 1400];
    case 'round-table': return [900, 2200];
    case 'marble-round-table': return [780, 1600];
    case 'hotpot-table': return [1500, 3200];
    case 'bar-table': return [850, 1800];
    case 'chair': case 'stool': return [180, 420];
    case 'dining-armchair': return [360, 780];
    case 'bench': return [420, 900];
    case 'sofa': case 'curved-booth': return [1400, 2800];
    case 'waiting-bench': return [850, 1800];
    case 'stove': case 'wok': case 'induction': return [2600, 6200];
    case 'noodle-cooker': case 'fryer': case 'griddle': return [1800, 4500];
    case 'steamer': case 'oven': return [4200, 9800];
    case 'hood': return [3500, 8500];
    case 'upright-fridge': case 'glass-fridge': return [3200, 7200];
    case 'undercounter-fridge': case 'chest-freezer': case 'salad-counter': return [2600, 5800];
    case 'ice-maker': return [2800, 6000];
    case 'sink': case 'single-sink': case 'triple-sink': case 'handwash': return [700, 2200];
    case 'dishwasher': return [9500, 22000];
    case 'sterilizer': return [2400, 5200];
    case 'buffet': case 'display-counter': case 'sushi-display': return [4500, 11000];
    case 'tea-bar': case 'cashier': return [2800, 6800];
    case 'worktable': case 'return-counter': case 'dish-pass': return [900, 2600];
    case 'coffee-machine': return [12000, 32000];
    case 'water-boiler': case 'beverage': case 'microwave': case 'rice-cooker': return [650, 2400];
    case 'shelf': case 'cabinet': case 'locker': case 'tray-rack': case 'cart': case 'tray-cart': case 'wall-shelf': return [450, 1600];
    case 'bin': return [120, 280];
    case 'pendant-lamp': case 'wall-sconce': return [180, 520];
    case 'linear-light': case 'track-light': return [320, 850];
    case 'chandelier': return [750, 2200];
    case 'kitchen-panel-light': return [120, 260];
    case 'potted-plant': return [260, 750];
    case 'planter-divider': return [950, 2200];
    case 'wall-art': return [350, 950];
    case 'menu-board': case 'tv-screen': return [1200, 2800];
    case 'shop-sign': return [3500, 9500];
    case 'wood-feature-wall': return [1600, 3800];
    case 'podium': return [900, 2200];
    case 'storefront-window': return [2800, 6500];
    case 'glass-double-door': return [3200, 7500];
    case 'serving-window': return [1800, 4200];
    case 'door': case 'double-door': case 'window': case 'fixed-window': return [900, 2600];
    case 'slat-partition': case 'glass-partition': case 'partition': return [900, 2600];
    default: return [0, 0];
  }
}

function bomCategory(item: Item): string {
  if (item.kind === 'table' || item.kind === 'chair') return '餐桌椅与卡座';
  if (['stove', 'fridge', 'sink'].includes(item.kind)) return '后厨与洗消设备';
  if (item.kind === 'counter' || item.kind === 'shelf') return '吧台与服务收纳';
  if (item.kind === 'lighting') return '商业照明灯具';
  if (item.kind === 'decor') return '软装绿植与门头';
  if (isBuilding(item) || item.kind === 'stairs') return '墙窗隔断构件';
  return '现场设施';
}

export function analyzeShop(project: Project): ShopInsights {
  const areaSqm = siteArea(project) / 1e6;
  const visible = project.items.filter(i => i.kind !== 'zone' && !isAnnotation(i) && isVisible(i, project));
  const zones = project.items.filter(i => i.kind === 'zone' && !i.hidden);
  const { seats, unknown: unknownSeats } = seatSummary(project);

  let diningSqm = 0, kitchenSqm = 0, serviceSqm = 0;
  for (const z of zones) {
    const a = zoneArea(project, z) / 1e6;
    const n = z.name;
    if (/厨|灶|洗|备|后场/.test(n)) kitchenSqm += a;
    else if (/吧|收银|取餐|服务/.test(n)) serviceSqm += a;
    else diningSqm += a;
  }

  const labeledTotal = diningSqm + kitchenSqm + serviceSqm;
  const diningRatioPct = labeledTotal > 0.5 ? Math.round(((diningSqm + serviceSqm * 0.5) / labeledTotal) * 100) : null;
  const kitchenRatioPct = diningRatioPct !== null ? Math.max(0, 100 - diningRatioPct) : null;

  let ratioAdvice = '建议添加「前厅就餐区」与「后厨区」分区以分析餐厨面积配比。';
  if (diningRatioPct !== null && kitchenRatioPct !== null) {
    if (kitchenRatioPct < 20) ratioAdvice = `后厨占比偏低 (${kitchenRatioPct}%)，建议预留 25%–35% 给操作与洗消动线。`;
    else if (kitchenRatioPct > 42) ratioAdvice = `后厨占比较高 (${kitchenRatioPct}%)，可评估紧凑排布以释放更多客座面积。`;
    else ratioAdvice = `餐厨配比均衡 (${diningRatioPct}% : ${kitchenRatioPct}%)，符合主流商业餐饮坪效标准。`;
  }

  const diningRefArea = diningSqm > 1 ? diningSqm : areaSqm * 0.65;
  const sqmPerSeat = seats > 0 ? diningRefArea / seats : null;
  let comfortLabel = '待布置座椅';
  if (sqmPerSeat !== null) {
    if (sqmPerSeat < 1.35) comfortLabel = '高密度快餐型';
    else if (sqmPerSeat <= 2.3) comfortLabel = '舒适标准餐饮';
    else comfortLabel = '宽敞品质体验型';
  }

  const map = new Map<string, BomRow>();
  let budgetMin = 0, budgetMax = 0;
  for (const item of visible) {
    if (item.kind === 'wall' || item.kind === 'column' || item.kind === 'utility') continue;
    const [uMin, uMax] = estimateUnitPrice(item);
    const category = bomCategory(item);
    const spec = `${item.w} × ${item.d} × ${item.h} mm`;
    const key = `${category}|${item.name}|${spec}`;
    const existing = map.get(key);
    if (existing) existing.count += 1;
    else map.set(key, { category, name: item.name, spec, count: 1, unitPriceMin: uMin, unitPriceMax: uMax });
    budgetMin += uMin;
    budgetMax += uMax;
  }

  const order = ['餐桌椅与卡座', '后厨与洗消设备', '吧台与服务收纳', '商业照明灯具', '软装绿植与门头', '墙窗隔断构件', '现场设施'];
  const bom = [...map.values()].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || b.count - a.count);

  const hasEntrance = visible.some(i => i.kind === 'door');
  const hasCashier = visible.some(i => ['cashier', 'tea-bar', 'buffet', 'podium'].includes(modelOf(i)));
  const hasWash = visible.some(i => i.kind === 'sink');
  const hasCooking = visible.some(i => i.kind === 'stove');
  const hasHood = visible.some(i => modelOf(i) === 'hood');
  const lightingCount = visible.filter(i => i.kind === 'lighting').length;
  const decorCount = visible.filter(i => i.kind === 'decor').length;
  const kitchenEquipCount = visible.filter(i => ['stove', 'fridge', 'sink'].includes(i.kind)).length;

  const readiness: ReadinessItem[] = [
    { label: '出入口门窗', ok: hasEntrance, detail: hasEntrance ? '已配置店门出入口' : '尚未放置店铺入口门，建议在临街墙体添加玻璃门' },
    { label: '客座接待规模', ok: seats >= 4, detail: seats >= 4 ? `已规划 ${seats} 个明确客座` : '客座数量较少，可从左侧「成套组合」快速布置桌椅' },
    { label: '收银 / 水吧 / 取餐台', ok: hasCashier, detail: hasCashier ? '已配置前厅接待或出餐台位' : '缺少收银台或饮品水吧台' },
    { label: '上下水洗消区', ok: hasWash, detail: hasWash ? '已配置洗涤池或洗碗机' : '尚未布置洗涤池/洗手盆，请结合给排水点位补充' },
    { label: '热厨排烟配套', ok: !hasCooking || hasHood, detail: !hasCooking ? '无明火热厨设备（轻食/饮品类）' : hasHood ? '热厨区已配套排烟罩' : '已放置炉灶但尚未配置排烟罩组件' },
    { label: '商业灯光与氛围软装', ok: lightingCount >= 2 && decorCount >= 1, detail: lightingCount >= 2 && decorCount >= 1 ? `已布置 ${lightingCount} 盏灯具、${decorCount} 件软装门头` : '添加吊灯、轨道灯、绿植与门头招牌可大幅提升 3D 效果图质感' },
  ];

  return {
    areaSqm,
    seats,
    unknownSeats,
    sqmPerSeat,
    comfortLabel,
    diningSqm,
    kitchenSqm,
    serviceSqm,
    diningRatioPct,
    kitchenRatioPct,
    ratioAdvice,
    totalItems: visible.length,
    lightingCount,
    decorCount,
    kitchenEquipCount,
    bom,
    budgetMin,
    budgetMax,
    readiness,
  };
}

export function bomCSV(project: Project, insights: ShopInsights): string {
  const esc = (v: string | number) => {
    const raw = String(v);
    const safe = typeof v === 'string' && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = [
    ['分类', '名称', '规格尺寸', '数量', '参考单价低(元)', '参考单价高(元)', '参考小计低(元)', '参考小计高(元)'].map(esc).join(','),
    ...insights.bom.map(r => [r.category, r.name, r.spec, r.count, r.unitPriceMin, r.unitPriceMax, r.unitPriceMin * r.count, r.unitPriceMax * r.count].map(esc).join(',')),
    ['汇总', project.name, `实用面积 ${insights.areaSqm.toFixed(2)}㎡ / ${insights.seats}座`, insights.bom.reduce((s, r) => s + r.count, 0), '', '', insights.budgetMin, insights.budgetMax].map(esc).join(','),
  ];
  return '\ufeff' + lines.join('\n');
}
