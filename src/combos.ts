import { Item, Point, Project, uid } from './model';
import { siteOutline, sitePlacement } from './site';
import { baseHeight, bounds, contains, doorSwings, footprint } from './spatial';
import { polygonCoverage } from './polygonArea';
import { syncStructure } from './structure';
import { usePlanning } from './planning';
import { useStore } from './store';

export type ComboPreset = {
  id: string;
  name: string;
  category: '餐桌椅组合' | '明档与厨具组合';
  badge: string;
  sizeLabel: string;
  seats?: number;
  build: (cx: number, cy: number) => Item[];
};

export const comboPresets: ComboPreset[] = [
  {
    id: 'combo-cafe-2',
    name: '双人咖啡圆桌组',
    category: '餐桌椅组合',
    badge: '2 座',
    sizeLabel: '1.9m × 0.9m',
    seats: 2,
    build: (cx, cy) => [
      { id: uid(), kind: 'table', model: 'marble-round-table', name: '大理石圆桌', x: cx - 425, y: cy - 425, w: 850, d: 850, h: 750, rotation: 0, color: '#e6e1d7', seats: 0 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx - 1010, y: cy - 260, w: 520, d: 520, h: 800, rotation: -90, color: '#9b6b4a', seats: 1 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx + 490, y: cy - 260, w: 520, d: 520, h: 800, rotation: 90, color: '#9b6b4a', seats: 1 },
    ],
  },
  {
    id: 'combo-booth-4',
    name: '四人双面卡座组',
    category: '餐桌椅组合',
    badge: '4 座',
    sizeLabel: '1.2m × 2.1m',
    seats: 4,
    build: (cx, cy) => [
      { id: uid(), kind: 'table', model: 'booth-table', name: '四人卡座餐桌', x: cx - 600, y: cy - 375, w: 1200, d: 750, h: 750, rotation: 0, color: '#bc8d5d', seats: 0 },
      { id: uid(), kind: 'chair', model: 'curved-booth', name: '软包靠背卡座', x: cx - 600, y: cy - 1030, w: 1200, d: 620, h: 1040, rotation: 0, color: '#4f6d60', seats: 2 },
      { id: uid(), kind: 'chair', model: 'curved-booth', name: '软包靠背卡座', x: cx - 600, y: cy + 410, w: 1200, d: 620, h: 1040, rotation: 180, color: '#4f6d60', seats: 2 },
    ],
  },
  {
    id: 'combo-dining-4',
    name: '四人标准餐桌组',
    category: '餐桌椅组合',
    badge: '4 座',
    sizeLabel: '1.2m × 1.8m',
    seats: 4,
    build: (cx, cy) => [
      { id: uid(), kind: 'table', model: 'rect-table', name: '四人餐桌', x: cx - 600, y: cy - 400, w: 1200, d: 800, h: 750, rotation: 0, color: '#d4b082', seats: 0 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx - 550, y: cy - 960, w: 500, d: 500, h: 800, rotation: 0, color: '#8d6247', seats: 1 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx + 50, y: cy - 960, w: 500, d: 500, h: 800, rotation: 0, color: '#8d6247', seats: 1 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx - 550, y: cy + 460, w: 500, d: 500, h: 800, rotation: 180, color: '#8d6247', seats: 1 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx + 50, y: cy + 460, w: 500, d: 500, h: 800, rotation: 180, color: '#8d6247', seats: 1 },
    ],
  },
  {
    id: 'combo-hotpot-4',
    name: '四人火锅电磁桌组',
    category: '餐桌椅组合',
    badge: '4 座',
    sizeLabel: '1.3m × 1.9m',
    seats: 4,
    build: (cx, cy) => [
      { id: uid(), kind: 'table', model: 'hotpot-table', name: '四人电磁炉桌', x: cx - 650, y: cy - 440, w: 1300, d: 880, h: 750, rotation: 0, color: '#9b724d', seats: 0 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx - 570, y: cy - 1000, w: 500, d: 500, h: 800, rotation: 0, color: '#5c7166', seats: 1 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx + 70, y: cy - 1000, w: 500, d: 500, h: 800, rotation: 0, color: '#5c7166', seats: 1 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx - 570, y: cy + 500, w: 500, d: 500, h: 800, rotation: 180, color: '#5c7166', seats: 1 },
      { id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅', x: cx + 70, y: cy + 500, w: 500, d: 500, h: 800, rotation: 180, color: '#5c7166', seats: 1 },
    ],
  },
  {
    id: 'combo-canteen-6',
    name: '六人食堂长桌长凳',
    category: '餐桌椅组合',
    badge: '6 座',
    sizeLabel: '1.8m × 1.7m',
    seats: 6,
    build: (cx, cy) => [
      { id: uid(), kind: 'table', model: 'rect-table', name: '六人长桌', x: cx - 900, y: cy - 400, w: 1800, d: 800, h: 750, rotation: 0, color: '#d4b284', seats: 0 },
      { id: uid(), kind: 'chair', model: 'bench', name: '长凳', x: cx - 800, y: cy - 850, w: 1600, d: 380, h: 450, rotation: 0, color: '#c49d6e', seats: 3 },
      { id: uid(), kind: 'chair', model: 'bench', name: '长凳', x: cx - 800, y: cy + 470, w: 1600, d: 380, h: 450, rotation: 0, color: '#c49d6e', seats: 3 },
    ],
  },
  {
    id: 'combo-round-8',
    name: '八人圆桌雅座组',
    category: '餐桌椅组合',
    badge: '8 座',
    sizeLabel: '2.9m × 2.9m',
    seats: 8,
    build: (cx, cy) => {
      const items: Item[] = [
        { id: uid(), kind: 'table', model: 'round-table', name: '八人圆桌', x: cx - 900, y: cy - 900, w: 1800, d: 1800, h: 750, rotation: 0, color: '#b58454', seats: 0 },
      ];
      for (let n = 0; n < 8; n++) {
        const a = (n * Math.PI) / 4;
        items.push({
          id: uid(), kind: 'chair', model: 'dining-armchair', name: '软包扶手餐椅',
          x: cx + Math.cos(a) * 1230 - 250, y: cy + Math.sin(a) * 1230 - 250,
          w: 500, d: 500, h: 800, rotation: (a * 180) / Math.PI + 90, color: '#8c5e42', seats: 1,
        });
      }
      return items;
    },
  },
  {
    id: 'combo-bar-3',
    name: '靠窗吧台三座组',
    category: '餐桌椅组合',
    badge: '3 座',
    sizeLabel: '2.1m × 1.0m',
    seats: 3,
    build: (cx, cy) => [
      { id: uid(), kind: 'table', model: 'bar-table', name: '靠窗吧台桌', x: cx - 1050, y: cy - 225, w: 2100, d: 450, h: 1050, rotation: 0, color: '#b88c5c', seats: 0 },
      { id: uid(), kind: 'chair', model: 'stool', name: '吧台高脚凳', x: cx - 860, y: cy + 300, w: 420, d: 420, h: 750, rotation: 0, color: '#6b5944', seats: 1 },
      { id: uid(), kind: 'chair', model: 'stool', name: '吧台高脚凳', x: cx - 210, y: cy + 300, w: 420, d: 420, h: 750, rotation: 0, color: '#6b5944', seats: 1 },
      { id: uid(), kind: 'chair', model: 'stool', name: '吧台高脚凳', x: cx + 440, y: cy + 300, w: 420, d: 420, h: 750, rotation: 0, color: '#6b5944', seats: 1 },
    ],
  },
  {
    id: 'combo-hotline',
    name: '热厨炒煮排烟组',
    category: '明档与厨具组合',
    badge: '后厨核心',
    sizeLabel: '3.2m × 1.1m',
    build: (cx, cy) => [
      { id: uid(), kind: 'stove', model: 'noodle-cooker', name: '六孔煮面炉', x: cx - 1550, y: cy - 375, w: 950, d: 750, h: 900, rotation: 0, color: '#adbac0' },
      { id: uid(), kind: 'stove', model: 'stove', name: '双头炉灶', x: cx - 500, y: cy - 425, w: 1250, d: 850, h: 850, rotation: 0, color: '#93a0a8' },
      { id: uid(), kind: 'stove', model: 'fryer', name: '双缸电炸炉', x: cx + 850, y: cy - 375, w: 800, d: 750, h: 900, rotation: 0, color: '#a7b4bd' },
      { id: uid(), kind: 'stove', model: 'hood', name: '落地式排烟罩组件', x: cx - 1550, y: cy - 525, w: 3200, d: 1050, h: 2450, rotation: 0, color: '#aab5b8' },
    ],
  },
  {
    id: 'combo-coffee-bar',
    name: '水吧咖啡收银组',
    category: '明档与厨具组合',
    badge: '前厅吧台',
    sizeLabel: '3.8m × 0.8m',
    build: (cx, cy) => [
      { id: uid(), kind: 'counter', model: 'tea-bar', name: '饮品水吧台', x: cx - 1900, y: cy - 375, w: 2400, d: 750, h: 960, rotation: 0, color: '#546b62' },
      { id: uid(), kind: 'counter', model: 'coffee-machine', name: '商用咖啡机', x: cx - 1450, y: cy - 270, w: 700, d: 540, h: 600, rotation: 0, color: '#3b4a4e' },
      { id: uid(), kind: 'counter', model: 'cashier', name: '收银点餐台', x: cx + 600, y: cy - 340, w: 1300, d: 680, h: 1100, rotation: 0, color: '#546b62' },
    ],
  },
  {
    id: 'combo-wash-line',
    name: '洗消回收动线组',
    category: '明档与厨具组合',
    badge: '洗消标准',
    sizeLabel: '3.6m × 0.8m',
    build: (cx, cy) => [
      { id: uid(), kind: 'sink', model: 'triple-sink', name: '三槽洗涤池', x: cx - 1800, y: cy - 350, w: 1800, d: 700, h: 850, rotation: 0, color: '#a5b7c0' },
      { id: uid(), kind: 'sink', model: 'dishwasher', name: '揭盖式洗碗机', x: cx + 100, y: cy - 400, w: 750, d: 800, h: 1450, rotation: 0, color: '#a2b4bd' },
      { id: uid(), kind: 'shelf', model: 'sterilizer', name: '双门消毒柜', x: cx + 950, y: cy - 340, w: 1200, d: 660, h: 1800, rotation: 0, color: '#9cb0bb' },
    ],
  },
];

// Reserve the full set as one space, including room between its table and chairs.
export function fitCombo(project: Project, combo: ComboPreset, point: Point, search: boolean, area?: Point[]): Item[] {
  const items = combo.build(0, 0);
  const box = bounds(items);
  const site = siteOutline(project);
  const height = Math.max(...items.map(i => baseHeight({ ...project, items }, i) + i.h));
  const obstacles = project.items.filter(i => !i.hidden && !['zone','text','dimension','leader','utility'].includes(i.kind)
    && baseHeight(project, i) < height && !(i.wallId && project.items.find(w => w.id === i.wallId)?.hidden));
  const occupied = obstacles.flatMap(i => i.kind === 'door' ? [footprint(i), ...doorSwings(i)] : [footprint(i)]).map(poly => ({
    poly, left: Math.min(...poly.map(p => p.x)), right: Math.max(...poly.map(p => p.x)),
    top: Math.min(...poly.map(p => p.y)), bottom: Math.max(...poly.map(p => p.y)),
  }));
  const center = search ? sitePlacement(area ? { ...project, outline: area } : project, point) : point;
  const x0 = Math.round(center.x / 100) * 100, y0 = Math.round(center.y / 100) * 100;
  const gap = project.clearance ?? 900;
  const stepX = Math.ceil((box.w + gap) / 100) * 100, stepY = Math.ceil((box.h + gap) / 100) * 100;
  const candidates: Point[] = [{ x: x0, y: y0 }];
  if (search) {
    for (let row = -3; row <= 3; row++) for (let col = -3; col <= 3; col++) {
      if (col || row) candidates.push({ x: x0 + col * stepX, y: y0 + row * stepY });
    }
    candidates.sort((a, b) => Math.hypot(a.x - x0, a.y - y0) - Math.hypot(b.x - x0, b.y - y0));
  }
  for (const { x, y } of candidates) {
    const left = x + box.x, top = y + box.y, right = left + box.w, bottom = top + box.h;
    const rect = [{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
    if (!contains(site, rect) || (area && !contains(area, rect))) continue;
    const blocked = occupied.some(o => left < o.right && right > o.left && top < o.bottom && bottom > o.top
      && polygonCoverage(rect, [o.poly]).union > 1);
    if (!blocked) return items.map(i => ({ ...i, x: i.x + x, y: i.y + y }));
  }
  throw Error(search ? '附近没有足够空间，请将组合拖到其他空地。' : '此处空间不足或挡住门扇，请将组合拖到其他空地。');
}

export function placeCombo(combo: ComboPreset, point?: Point, search = true) {
  const s = useStore.getState();
  const p = s.project;
  const area = p.planningAreas?.find(a => a.id === usePlanning.getState().activeId);
  const items = fitCombo(p, combo, point ?? { x: p.width / 2, y: p.height / 2 }, search, area?.outline);
  const ids = items.map(i => i.id);
  const next: Project = syncStructure({
    ...p,
    items: [...p.items, ...items],
    groups: [...(p.groups ?? []), { id: uid(), name: combo.name, members: ids, seats: combo.seats }],
  });
  if (!s.commit(next)) throw Error(useStore.getState().error || '组合放置失败');
  s.selectMany(ids);
  s.setTool('select');
}
