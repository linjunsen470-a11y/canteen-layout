import { useRef, useState } from 'react';
import type { Project } from './model';
import { planningArea, planningAreaLabel } from './site';
import { seatSummary } from './layoutGroups';
import { ImageDown } from 'lucide-react';

const formats = { sheet: '平面与立体合图', plan: '平面图', bird: '鸟瞰图', inside: '室内视角', current: '当前三维视角' };
type Format = keyof typeof formats;

async function makeSheet(project: Project, plan: string, bird: string, inside: string) {
  const images = await Promise.all([plan, bird, inside].map(async src => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return img;
  }));
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 1500;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('浏览器无法生成合图');
  ctx.fillStyle = '#faf9f6';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const seats = seatSummary(project);
  ctx.fillStyle = '#244b3c';
  ctx.font = '600 56px system-ui';
  ctx.fillText(project.name, 40, 76, 1300);
  ctx.font = '38px system-ui';
  ctx.textAlign = 'right';
  const capacity = seats.seats + ' 座' + (seats.unknown ? '（另有未标定座位）' : '');
  ctx.fillText(planningAreaLabel(project) + ' ' + (planningArea(project)/1e6).toFixed(2) + ' ㎡  ·  ' + capacity, 2360, 76);
  ctx.textAlign = 'left';
  function panel(image: HTMLImageElement, title: string, x: number, y: number, w: number, h: number) {
    const scale = Math.min(w / image.width, (h - 54) / image.height);
    ctx!.fillStyle = '#244b3c';
    ctx!.font = '600 30px system-ui';
    ctx!.fillText(title, x, y + 32);
    ctx!.drawImage(image, x + (w - image.width * scale) / 2, y + 54 + (h - 54 - image.height * scale) / 2, image.width * scale, image.height * scale);
  }
  panel(images[0], '平面布置', 40, 120, 1230, 1340);
  panel(images[1], '整店鸟瞰', 1310, 120, 1050, 660);
  panel(images[2], '室内视角', 1310, 804, 1050, 660);
  return canvas.toDataURL('image/png');
}

type Props = {
  project: Project;
  capture: () => Promise<{ plan: string; bird: string; inside: string }>;
  flat: () => Promise<string>;
  current: () => string;
  hasCurrent: boolean;
};

export default function ImageExport({ project, capture, flat, current, hasCurrent }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cache = useRef<Partial<Record<Format,string>>>({});
  const [format, setFormat] = useState<Format>('sheet');
  const [src, setSrc] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function select(next: Format) {
    setFormat(next); setMessage(''); setSrc(''); setBusy(true);
    try {
      const images = cache.current;
      if (!images[next]) {
        if (next === 'plan') images.plan = await flat();
        else if (next === 'current') images.current = current();
        else {
          const result = await capture();
          Object.assign(images, result);
          images.sheet = await makeSheet(project, result.plan, result.bird, result.inside);
        }
      }
      setSrc(images[next]!);
    } catch (e) { setMessage((e as Error).message); }
    finally { setBusy(false); }
  }

  async function copy() {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': fetch(src).then(r => r.blob()) })]);
      setMessage('已复制图片，可以粘贴到聊天中');
    } catch { setMessage('当前浏览器未允许复制图片，可下载 PNG'); }
  }
  return <>
    <button className="primary" onClick={() => {
      cache.current = {};
      dialog.current!.showModal();
      void select(hasCurrent ? 'sheet' : 'plan');
    }}><ImageDown/>导出图片</button>
    <dialog ref={dialog} className="image-export" aria-label="导出图片" onCancel={e => { if (busy) e.preventDefault(); }}>
      <header><h2>导出图片</h2><button disabled={busy} onClick={() => dialog.current!.close()}>关闭</button></header>
      <div className="image-formats">{(Object.keys(formats) as Format[]).filter(k => k !== 'current' || hasCurrent).map(k =>
        <button key={k} disabled={busy} aria-pressed={format === k} onClick={() => void select(k)}>{formats[k]}</button>)}</div>
      <div className="image-proof" aria-busy={busy}>{src ? <img src={src} alt={formats[format] + '预览'}/> : busy ? '正在准备图片…' : '图片尚未生成'}</div>
      <footer><span role="status">{message}</span><button disabled={!src} onClick={copy}>复制图片</button>
        <a className="btn primary" hidden={!src} href={src || undefined} download={project.name + '-' + formats[format] + '.png'}>下载 PNG</a></footer>
    </dialog>
  </>;
}
