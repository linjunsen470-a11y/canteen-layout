import type { Item, Project } from './model';
import { pointInSite } from './site';
import { bounds } from './spatial';

// Visit adjoining 200 mm cells with space for a 500 mm wide square.
// Bounding rotated furniture conservatively is appropriate for a first draft.
export function reachableFromEntry(project: Project) {
  const entrances = project.items.filter(i => i.pointType === 'entrance' && !i.hidden);
  if (!entrances.length) return;
  const step = 200, halfWidth = 250, cols = Math.ceil(project.width / step), rows = Math.ceil(project.height / step);
  const cells = new Uint8Array(cols * rows);
  const queue: number[] = [];
  const interior = project.survey ? { ...project, outline: project.survey.corners } : project;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!pointInSite(interior, { x: (x + .5) * step, y: (y + .5) * step })) cells[y * cols + x] = 1;
  }
  const boxes = new Map<string, ReturnType<typeof bounds>>();
  const obstacles = project.items.filter(i => !i.hidden && !['door','window','zone','utility','lighting','dimension','leader','text'].includes(i.kind) && i.model !== 'hood' && (i.elevation ?? 0) < 1900);
  function range(start: number, extent: number, limit: number, margin: number) {
    return [Math.max(0, Math.ceil((start - margin) / step - .5)), Math.min(limit - 1, Math.floor((start + extent + margin) / step - .5))];
  }
  for (const item of obstacles) {
    const b = bounds([item]);
    boxes.set(item.id, b);
    const [x0,x1] = range(b.x, b.w, cols, halfWidth), [y0,y1] = range(b.y, b.h, rows, halfWidth);
    for (let y = y0; y <= y1; y++) cells.fill(1, y * cols + x0, y * cols + x1 + 1);
  }
  const visit = (n: number) => { if (cells[n] === 0) { cells[n] = 2; queue.push(n); } };
  for (const e of entrances) {
    const cx = e.x + e.w / 2, cy = e.y + e.d / 2;
    const [x0,x1] = range(cx, 0, cols, 400), [y0,y1] = range(cy, 0, rows, 400);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (Math.hypot((x+.5)*step-cx, (y+.5)*step-cy) <= 400) visit(y * cols + x);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const n = queue[i];
    if (n % cols) visit(n - 1);
    if (n % cols < cols - 1) visit(n + 1);
    if (n >= cols) visit(n - cols);
    if (n < cells.length - cols) visit(n + cols);
  }
  return (item: Item) => {
    const b = boxes.get(item.id);
    if (!b) return true;
    const [x0,x1] = range(b.x, b.w, cols, halfWidth + step), [y0,y1] = range(b.y, b.h, rows, halfWidth + step);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const cx = (x+.5)*step, cy = (y+.5)*step;
      if (cells[y * cols + x] === 2 && ((cx >= b.x && cx <= b.x+b.w) || (cy >= b.y && cy <= b.y+b.h))) return true;
    }
    return false;
  };
}
