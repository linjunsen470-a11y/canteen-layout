import { useMemo, useRef, useState } from 'react';
import type { Project } from './model';
import { planningArea, planningAreaLabel } from './site';
import { seatSummary } from './layoutGroups';
import { parseProject } from './projectIO';
import { useProjectSession } from './projectSession';
import { matchSameShop, type ShopMatch } from './sameShop';
import {
  decodeCanvasImage,
  drawFramedPanel,
  formatBudgetRange,
  formatExportDate,
  formatRatio,
  makeCompareSheet,
  type CompareMetrics,
} from './makeCompareSheet';
import { ImageDown } from 'lucide-react';

const formats = {
  sheet: '平面与立体合图',
  compare: 'A/B 对比图',
  plan: '平面图',
  bird: '鸟瞰图',
  inside: '室内视角',
  current: '当前三维视角',
};
type Format = keyof typeof formats;

async function makeSheet(project: Project, plan: string, bird: string, inside: string) {
  const images = await Promise.all([plan, bird, inside].map(decodeCanvasImage));
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('浏览器无法生成合图');
  ctx.fillStyle = '#faf9f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const seats = seatSummary(project);
  ctx.fillStyle = '#244b3c';
  ctx.font = '600 54px system-ui';
  ctx.fillText(project.name, 40, 74, 1300);
  ctx.font = '36px system-ui';
  ctx.fillStyle = '#486054';
  ctx.textAlign = 'right';
  const capacity = seats.seats + ' 座' + (seats.unknown ? '（另有未标定座位）' : '');
  ctx.fillText(planningAreaLabel(project) + ' ' + (planningArea(project) / 1e6).toFixed(2) + ' ㎡  ·  ' + capacity, 2360, 74, 960);
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#d7e0d8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 102);
  ctx.lineTo(2360, 102);
  ctx.stroke();
  drawFramedPanel(ctx, images[0], '平面布置', 40, 124, 1230, 1336);
  drawFramedPanel(ctx, images[1], '整店鸟瞰', 1300, 124, 1060, 654);
  drawFramedPanel(ctx, images[2], '室内视角', 1300, 806, 1060, 654);
  return canvas.toDataURL('image/png');
}

type CandidateEntry = {
  id: string;
  project: Project;
  match: ShopMatch;
};

type ImageCache = {
  planBare?: string;
  plan?: string;
  bird?: string;
  inside?: string;
  sheet?: string;
  current?: string;
  compares: Map<string, { dataUrl: string; metrics: CompareMetrics }>;
};

type Props = {
  project: Project;
  capture: () => Promise<{ planBare: string; bird: string; inside: string }>;
  flat: () => Promise<string>;
  current: () => string;
  hasCurrent: boolean;
  onOpenCompareDrafts?: () => void;
};

export default function ImageExport({ project, capture, flat, current, hasCurrent, onOpenCompareDrafts }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cache = useRef<ImageCache>({ compares: new Map() });
  const reqId = useRef(0);
  const [open, setOpen] = useState(false);
  const rows = useProjectSession(s => s.rows);

  const [format, setFormat] = useState<Format>('sheet');
  const [compareId, setCompareId] = useState('');
  const [compareMetrics, setCompareMetrics] = useState<CompareMetrics | null>(null);
  const [src, setSrc] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { sameShopCandidates, otherCandidates, byId } = useMemo(() => {
    const same: CandidateEntry[] = [];
    const other: CandidateEntry[] = [];
    const map = new Map<string, CandidateEntry>();
    for (const row of open ? rows : []) {
      if (row.deletedAt || row.id === project.id) continue;
      let parsed: Project;
      try { parsed = parseProject(row.project); } catch { continue; }
      const entry: CandidateEntry = { id: row.id, project: parsed, match: matchSameShop(project, parsed) };
      map.set(row.id, entry);
      if (entry.match.same) same.push(entry);
      else other.push(entry);
    }
    return { sameShopCandidates: same, otherCandidates: other, byId: map };
  }, [open, rows, project]);

  async function ensurePlanACapture() {
    const images = cache.current;
    if (images.planBare && images.bird && images.inside) {
      return { planBare: images.planBare, bird: images.bird, inside: images.inside };
    }
    const shot = await capture();
    images.planBare = shot.planBare;
    images.bird = shot.bird;
    images.inside = shot.inside;
    return shot;
  }

  async function select(next: Format, overrideCompareId?: string) {
    const seq = ++reqId.current;
    setFormat(next);
    setMessage('');
    setError('');
    setSrc('');
    setCompareMetrics(null);

    if (next === 'compare') {
      const resolvedId = overrideCompareId !== undefined
        ? overrideCompareId
        : (compareId && byId.has(compareId) ? compareId : sameShopCandidates[0]?.id ?? '');
      setCompareId(resolvedId);
      const target = resolvedId ? byId.get(resolvedId) : undefined;
      if (!target) {
        setBusy(false);
        return;
      }
      setBusy(true);
      try {
        const key = `${target.id}:${target.project.updatedAt}`;
        let entry = cache.current.compares.get(key);
        if (!entry) {
          const planA = await ensurePlanACapture();
          if (seq !== reqId.current) return;
          const [{ withOffscreenStage }, { capturePlanFromProject }] = await Promise.all([
            import('./OffscreenStage'),
            import('./offscreenPlan'),
          ]);
          const planBareB = await capturePlanFromProject(target.project, { header: false });
          if (seq !== reqId.current) return;
          const birdB = await withOffscreenStage(target.project, stage => stage.captureShot('birdseye'));
          if (seq !== reqId.current) return;
          entry = await makeCompareSheet(
            project,
            { planBare: planA.planBare, bird: planA.bird },
            target.project,
            { planBare: planBareB, bird: birdB },
          );
          cache.current.compares.set(key, entry);
        }
        if (seq !== reqId.current) return;
        setSrc(entry.dataUrl);
        setCompareMetrics(entry.metrics);
      } catch (e) {
        if (seq === reqId.current) setError((e as Error).message || '生成对比图失败，请重试');
      } finally {
        if (seq === reqId.current) setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const images = cache.current;
      if (!images[next]) {
        if (next === 'plan') images.plan = await flat();
        else if (next === 'current') images.current = current();
        else {
          const { planBare, bird, inside } = await ensurePlanACapture();
          if (seq !== reqId.current) return;
          if (!images.sheet) images.sheet = await makeSheet(project, planBare, bird, inside);
        }
      }
      if (seq !== reqId.current) return;
      setSrc(images[next]!);
    } catch (e) {
      if (seq === reqId.current) setError((e as Error).message);
    } finally {
      if (seq === reqId.current) setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': fetch(src).then(r => r.blob()) })]);
      setMessage('已复制图片，可以粘贴到聊天中');
    } catch { setMessage('当前浏览器未允许复制图片，可下载 PNG'); }
  }

  const selectedCompare = compareId ? byId.get(compareId) : undefined;
  const downloadName = format === 'compare'
    ? `${project.name}-AB对比-${formatExportDate()}.png`
    : `${project.name}-${formats[format]}.png`;

  return <>
    <button className="primary" onClick={() => {
      cache.current = { compares: new Map() };
      setCompareId('');
      setCompareMetrics(null);
      setOpen(true);
      dialog.current!.showModal();
      void select(hasCurrent ? 'sheet' : 'plan');
    }}><ImageDown />导出图片</button>
    <dialog
      ref={dialog}
      className="image-export"
      aria-label="导出图片"
      onClose={() => { reqId.current++; setOpen(false); }}
      onCancel={e => { if (busy) e.preventDefault(); }}
    >
      <header><h2>导出图片</h2><button disabled={busy} onClick={() => dialog.current!.close()}>关闭</button></header>
      <div className="image-formats">
        {(Object.keys(formats) as Format[]).filter(k => k !== 'current' || hasCurrent).map(k => (
          <button key={k} disabled={busy} aria-pressed={format === k} onClick={() => void select(k)}>{formats[k]}</button>
        ))}
      </div>
      {format === 'compare' && (
        <div className="image-compare-bar">
          {sameShopCandidates.length === 0 && (
            <div className="compare-empty-hint" role="note">
              <span>项目库中暂无同铺方案，可先在「比较摆法」中另存一稿。</span>
              {onOpenCompareDrafts && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    dialog.current!.close();
                    onOpenCompareDrafts();
                  }}
                >
                  去比较摆法
                </button>
              )}
            </div>
          )}
          {(sameShopCandidates.length > 0 || otherCandidates.length > 0) && (
            <label className="compare-picker">
              <span>对比方案 B</span>
              <select
                aria-label="对比方案 B"
                disabled={busy}
                value={compareId}
                onChange={e => void select('compare', e.target.value)}
              >
                {sameShopCandidates.length === 0 && <option value="">选择其他铺位（轮廓不同，仅供参考）</option>}
                {sameShopCandidates.length > 0 && (
                  <optgroup label="同铺方案">
                    {sameShopCandidates.map(c => (
                      <option key={c.id} value={c.id}>{c.project.name}</option>
                    ))}
                  </optgroup>
                )}
                {otherCandidates.length > 0 && (
                  <optgroup label="其他铺位（轮廓不同，仅供参考）">
                    {otherCandidates.map(c => (
                      <option key={c.id} value={c.id}>{c.project.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
              {selectedCompare && !selectedCompare.match.same && (
                <span className="compare-mismatch-badge">轮廓不同，仅供参考</span>
              )}
            </label>
          )}
          {compareMetrics && (
            <div className="compare-metrics-strip" aria-label="双方案对比指标">
              <strong>{compareMetrics.summary}</strong>
              <span>A：{compareMetrics.a.seats} 座 / {compareMetrics.a.tables} 桌 / {formatRatio(compareMetrics.a)} / 净距 {compareMetrics.a.tableGapMm !== null ? `${compareMetrics.a.tableGapMm} mm` : '—'} / {formatBudgetRange(compareMetrics.a.budgetMin, compareMetrics.a.budgetMax)}</span>
              <span>B：{compareMetrics.b.seats} 座 / {compareMetrics.b.tables} 桌 / {formatRatio(compareMetrics.b)} / 净距 {compareMetrics.b.tableGapMm !== null ? `${compareMetrics.b.tableGapMm} mm` : '—'} / {formatBudgetRange(compareMetrics.b.budgetMin, compareMetrics.b.budgetMax)}</span>
            </div>
          )}
        </div>
      )}
      <div className="image-proof" aria-busy={busy}>
        {src
          ? <img src={src} alt={formats[format] + '预览'} />
          : busy
            ? '正在准备图片…'
            : error
              ? <div className="image-proof-error" role="alert">
                  <span>{error}</span>
                  <button type="button" onClick={() => void select(format, format === 'compare' ? compareId : undefined)}>重试</button>
                </div>
              : format === 'compare' && !selectedCompare
                ? '请选择要对比的方案 B，或先在「比较摆法」中另存一稿'
                : '图片尚未生成'}
      </div>
      <footer>
        <span role="status">{message || (!src ? '' : error)}</span>
        <button disabled={!src || busy} onClick={copy}>复制图片</button>
        <a className="btn primary" hidden={!src} href={src || undefined} download={downloadName}>下载 PNG</a>
      </footer>
    </dialog>
  </>;
}
