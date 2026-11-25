import type { Project } from './model';
import { nearestTableGap } from './conceptPlanner';
import { seatSummary } from './layoutGroups';
import { planningArea, planningAreaLabel } from './site';
import { analyzeShop } from './shopAnalytics';
import { matchSameShop, type ShopMatch } from './sameShop';

export type PlanMetrics = {
  name: string;
  areaSqm: number;
  areaLabel: string;
  seats: number;
  unknownSeats: number;
  tables: number;
  diningRatioPct: number | null;
  kitchenRatioPct: number | null;
  tableGapMm: number | null;
  clearanceMm: number;
  budgetMin: number;
  budgetMax: number;
};

export type MetricWinner = 'a' | 'b' | 'tie' | null;

export type CompareMetrics = {
  a: PlanMetrics;
  b: PlanMetrics;
  match: ShopMatch;
  summary: string;
  winners: {
    seats: MetricWinner;
    tables: MetricWinner;
    ratio: MetricWinner;
    gap: MetricWinner;
    budget: MetricWinner;
  };
};

function collectPlanMetrics(project: Project): PlanMetrics {
  const insights = analyzeShop(project);
  const seats = seatSummary(project);
  const nearest = nearestTableGap(project);
  const tables = project.items.filter(i => i.kind === 'table' && !i.hidden).length;
  return {
    name: project.name,
    areaSqm: planningArea(project) / 1e6,
    areaLabel: planningAreaLabel(project),
    seats: seats.seats,
    unknownSeats: seats.unknown,
    tables,
    diningRatioPct: insights.diningRatioPct,
    kitchenRatioPct: insights.kitchenRatioPct,
    tableGapMm: nearest ? Math.floor(nearest.distance + 1e-6) : null,
    clearanceMm: project.clearance ?? 900,
    budgetMin: insights.budgetMin,
    budgetMax: insights.budgetMax,
  };
}

function higherWinner(a: number | null, b: number | null, threshold = 0): MetricWinner {
  if (a === null || b === null) return null;
  if (a - b > threshold) return 'a';
  if (b - a > threshold) return 'b';
  return 'tie';
}

function ratioDistanceToIdeal(kitchenPct: number | null): number | null {
  if (kitchenPct === null) return null;
  // Matches shopAnalytics.ts ideal kitchen ratio band (25%–35%).
  if (kitchenPct >= 25 && kitchenPct <= 35) return 0;
  return kitchenPct < 25 ? 25 - kitchenPct : kitchenPct - 35;
}

function budgetWinner(a: PlanMetrics, b: PlanMetrics): MetricWinner {
  const midA = (a.budgetMin + a.budgetMax) / 2;
  const midB = (b.budgetMin + b.budgetMax) / 2;
  if (midA <= 0 || midB <= 0) return null;
  if (Math.abs(midA - midB) < 500) return 'tie';
  return midA < midB ? 'a' : 'b';
}

export function formatBudgetRange(min: number, max: number): string {
  if (max <= 0) return '—';
  if (max >= 10000) return `¥${(min / 10000).toFixed(1)}–${(max / 10000).toFixed(1)}万`;
  return `¥${Math.round(min).toLocaleString('zh-CN')}–${Math.round(max).toLocaleString('zh-CN')}`;
}

export function formatRatio(m: PlanMetrics): string {
  if (m.diningRatioPct === null || m.kitchenRatioPct === null) return '未分区';
  return `餐 ${m.diningRatioPct}% : 厨 ${m.kitchenRatioPct}%`;
}

export function computeCompareMetrics(projectA: Project, projectB: Project): CompareMetrics {
  const a = collectPlanMetrics(projectA);
  const b = collectPlanMetrics(projectB);
  const match = matchSameShop(projectA, projectB);

  const distA = ratioDistanceToIdeal(a.kitchenRatioPct);
  const distB = ratioDistanceToIdeal(b.kitchenRatioPct);
  const ratioWinner: MetricWinner =
    distA === null || distB === null
      ? null
      : distA === distB
        ? 'tie'
        : distA < distB
          ? 'a'
          : 'b';

  const winners = {
    seats: higherWinner(a.seats, b.seats),
    tables: higherWinner(a.tables, b.tables),
    ratio: ratioWinner,
    gap: higherWinner(a.tableGapMm, b.tableGapMm, 19),
    budget: budgetWinner(a, b),
  };

  const parts: string[] = [];
  if (b.seats > a.seats) parts.push(`B 比 A 多 ${b.seats - a.seats} 座`);
  else if (a.seats > b.seats) parts.push(`A 比 B 多 ${a.seats - b.seats} 座`);
  else parts.push(`A 与 B 同为 ${a.seats} 座`);

  if (a.tableGapMm !== null && b.tableGapMm !== null) {
    const diff = b.tableGapMm - a.tableGapMm;
    if (diff >= 20) parts.push(`B 最窄间距宽 ${diff} mm`);
    else if (diff <= -20) parts.push(`A 最窄间距宽 ${-diff} mm`);
    else parts.push('桌组净距相近');
  } else if (b.tableGapMm !== null) {
    parts.push(`B 最窄间距 ${b.tableGapMm} mm`);
  } else if (a.tableGapMm !== null) {
    parts.push(`A 最窄间距 ${a.tableGapMm} mm`);
  }

  return { a, b, match, summary: parts.join('，'), winners };
}

export function formatExportDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export async function decodeCanvasImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

export function drawFramedPanel(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  title: string,
  x: number,
  y: number,
  w: number,
  h: number,
  padTop = 58,
) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#dce4dc';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#244b3c';
  ctx.font = '600 26px system-ui, sans-serif';
  ctx.fillText(title, x + 20, y + 36, w - 40);
  const padX = 16;
  const padBottom = 16;
  const availW = w - padX * 2;
  const availH = h - padTop - padBottom;
  const scale = Math.min(availW / image.width, availH / image.height);
  ctx.drawImage(
    image,
    x + padX + (availW - image.width * scale) / 2,
    y + padTop + (availH - image.height * scale) / 2,
    image.width * scale,
    image.height * scale,
  );
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  bg: string,
  fg: string,
  fontSize = 22,
  padX = 14,
  height = 36,
) {
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  const textW = ctx.measureText(text).width;
  const width = Math.ceil(textW + padX * 2);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + padX, y + height / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  return width;
}

export async function makeCompareSheet(
  projectA: Project,
  imagesA: { planBare: string; bird: string },
  projectB: Project,
  imagesB: { planBare: string; bird: string },
): Promise<{ dataUrl: string; metrics: CompareMetrics }> {
  const [planA, birdA, planB, birdB] = await Promise.all([
    decodeCanvasImage(imagesA.planBare),
    decodeCanvasImage(imagesA.bird),
    decodeCanvasImage(imagesB.planBare),
    decodeCanvasImage(imagesB.bird),
  ]);

  const metrics = computeCompareMetrics(projectA, projectB);
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('浏览器无法生成对比图');

  // Background
  ctx.fillStyle = '#faf9f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Top header (118 px)
  const heading = metrics.match.same
    ? `${projectA.name}  ·  ${metrics.a.areaLabel} ${metrics.a.areaSqm.toFixed(2)} ㎡`
    : `${projectA.name} vs ${projectB.name}`;
  ctx.fillStyle = '#244b3c';
  ctx.font = '600 44px system-ui, sans-serif';
  ctx.fillText(heading, 40, 62, 1140);

  if (!metrics.match.same) {
    drawPill(ctx, '轮廓不同，仅供参考', 40, 74, '#f8e6d0', '#8f4714', 20, 12, 32);
    ctx.fillStyle = '#5a6e63';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText(`A ${metrics.a.areaSqm.toFixed(2)} ㎡  /  B ${metrics.b.areaSqm.toFixed(2)} ㎡`, 246, 98, 860);
  } else {
    ctx.fillStyle = '#5a6e63';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('同铺 A/B 双方案对比', 40, 98, 900);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#1f5e41';
  ctx.font = '600 32px system-ui, sans-serif';
  ctx.fillText(metrics.summary, 2360, 62, 1120);
  ctx.fillStyle = '#5a6e63';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`对比结论 · ${formatExportDate()}`, 2360, 98, 600);
  ctx.textAlign = 'left';

  ctx.strokeStyle = '#d7e0d8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 118);
  ctx.lineTo(2360, 118);
  ctx.stroke();

  // Left (A) & Right (B) columns: 1140 px each
  const columns = [
    { x: 40, badge: '方案 A', bg: '#244b3c', name: projectA.name, plan: planA, bird: birdA },
    { x: 1220, badge: '方案 B', bg: '#2c5b6e', name: projectB.name, plan: planB, bird: birdB },
  ];
  for (const col of columns) {
    const pillW = drawPill(ctx, col.badge, col.x, 134, col.bg, '#ffffff', 22, 16, 38);
    ctx.fillStyle = '#243b30';
    ctx.font = '600 28px system-ui, sans-serif';
    ctx.fillText(col.name, col.x + pillW + 14, 162, 1140 - pillW - 14);
    drawFramedPanel(ctx, col.plan, '平面布置', col.x, 184, 1140, 546, 52);
    drawFramedPanel(ctx, col.bird, '整店鸟瞰', col.x, 744, 1140, 474, 52);
  }

  // Bottom comparison table (y = 1236 .. 1464, 2320 × 228)
  const barX = 40;
  const barY = 1236;
  const barW = 2320;
  const barH = 228;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.strokeStyle = '#d4ded6';
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);

  const metricRows: Array<{
    label: string;
    aVal: string;
    bVal: string;
    winner: MetricWinner;
    aAlert?: boolean;
    bAlert?: boolean;
  }> = [
    {
      label: '座位数',
      aVal: `${metrics.a.seats} 座${metrics.a.unknownSeats ? '+' : ''}`,
      bVal: `${metrics.b.seats} 座${metrics.b.unknownSeats ? '+' : ''}`,
      winner: metrics.winners.seats,
    },
    {
      label: '桌数',
      aVal: `${metrics.a.tables} 桌`,
      bVal: `${metrics.b.tables} 桌`,
      winner: metrics.winners.tables,
    },
    {
      label: '餐厨面积比',
      aVal: formatRatio(metrics.a),
      bVal: formatRatio(metrics.b),
      winner: metrics.winners.ratio,
    },
    {
      label: '最窄桌组间距',
      aVal: metrics.a.tableGapMm !== null ? `${metrics.a.tableGapMm} mm` : '—',
      bVal: metrics.b.tableGapMm !== null ? `${metrics.b.tableGapMm} mm` : '—',
      winner: metrics.winners.gap,
      aAlert: metrics.a.tableGapMm !== null && metrics.a.tableGapMm < metrics.a.clearanceMm,
      bAlert: metrics.b.tableGapMm !== null && metrics.b.tableGapMm < metrics.b.clearanceMm,
    },
    {
      label: '预估设备预算',
      aVal: formatBudgetRange(metrics.a.budgetMin, metrics.a.budgetMax),
      bVal: formatBudgetRange(metrics.b.budgetMin, metrics.b.budgetMax),
      winner: metrics.winners.budget,
    },
  ];

  const colW = barW / metricRows.length;
  metricRows.forEach((row, index) => {
    const cx = barX + index * colW;
    if (index > 0) {
      ctx.strokeStyle = '#e5ece7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, barY + 18);
      ctx.lineTo(cx, barY + barH - 18);
      ctx.stroke();
    }
    ctx.fillStyle = '#51665b';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText(row.label, cx + 26, barY + 46, colW - 44);

    // Row A
    drawPill(ctx, 'A', cx + 26, barY + 72, '#244b3c', '#ffffff', 18, 10, 30);
    ctx.fillStyle = row.aAlert ? '#a83b1e' : row.winner === 'a' ? '#1b6d43' : '#243b30';
    ctx.font = `${row.winner === 'a' ? '700' : '500'} 28px system-ui, sans-serif`;
    ctx.fillText(row.aVal, cx + 74, barY + 97, colW - 96);

    // Row B
    drawPill(ctx, 'B', cx + 26, barY + 144, '#2c5b6e', '#ffffff', 18, 10, 30);
    ctx.fillStyle = row.bAlert ? '#a83b1e' : row.winner === 'b' ? '#1b6d43' : '#243b30';
    ctx.font = `${row.winner === 'b' ? '700' : '500'} 28px system-ui, sans-serif`;
    ctx.fillText(row.bVal, cx + 74, barY + 169, colW - 96);
  });

  return { dataUrl: canvas.toDataURL('image/png'), metrics };
}
