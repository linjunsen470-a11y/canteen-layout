import type { Point, Project } from './model';
import { dimensionedOutline, type NotchCorner } from './site';
import { imageToWorld } from './siteExtras';
import { sketchShell } from './sketchGeometry';

export type UnderlayFrame = {
  shape: 'rectangle' | 'l-shape';
  x: number;
  y: number;
  width: number;
  depth: number;
  notchCorner: NotchCorner;
  notchWidth: number;
  notchDepth: number;
};

export type FrameCornerHandle = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

const MIN_SPAN = 1000;
const MAX_SPAN = 60000;
const MIN_NOTCH = 500;
const MIN_ARM = 500;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const roundTo = (value: number, step: number) => Math.round(value / step) * step;

export function normalizeFrame(frame: UnderlayFrame): UnderlayFrame {
  const width = clamp(Math.round(frame.width), MIN_SPAN, MAX_SPAN);
  const depth = clamp(Math.round(frame.depth), MIN_SPAN, MAX_SPAN);
  const maxNotchW = Math.max(MIN_NOTCH, width - MIN_ARM);
  const maxNotchD = Math.max(MIN_NOTCH, depth - MIN_ARM);
  const notchWidth = clamp(Math.round(frame.notchWidth), MIN_NOTCH, maxNotchW);
  const notchDepth = clamp(Math.round(frame.notchDepth), MIN_NOTCH, maxNotchD);
  return {
    ...frame,
    x: Math.round(frame.x),
    y: Math.round(frame.y),
    width,
    depth,
    notchWidth,
    notchDepth,
  };
}

// Seeds a rectangle or L-shape frame centered over the calibrated underlay bounds.
export function initialUnderlayFrame(project: Project, shape: 'rectangle' | 'l-shape'): UnderlayFrame {
  const u = project.underlay;
  if (!u) {
    return normalizeFrame({
      shape,
      x: Math.round(project.width * 0.15),
      y: Math.round(project.height * 0.15),
      width: Math.round(project.width * 0.7),
      depth: Math.round(project.height * 0.7),
      notchCorner: 'bottom-right',
      notchWidth: Math.round(project.width * 0.25),
      notchDepth: Math.round(project.height * 0.25),
    });
  }
  const corners = [
    imageToWorld(u, { x: 0, y: 0 }),
    imageToWorld(u, { x: u.pixelWidth, y: 0 }),
    imageToWorld(u, { x: u.pixelWidth, y: u.pixelHeight }),
    imageToWorld(u, { x: 0, y: u.pixelHeight }),
  ];
  const minX = Math.min(...corners.map(c => c.x));
  const maxX = Math.max(...corners.map(c => c.x));
  const minY = Math.min(...corners.map(c => c.y));
  const maxY = Math.max(...corners.map(c => c.y));
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const width = clamp(roundTo(spanX * 0.72, 100), 2000, MAX_SPAN);
  const depth = clamp(roundTo(spanY * 0.72, 100), 2000, MAX_SPAN);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return normalizeFrame({
    shape,
    x: roundTo(cx - width / 2, 50),
    y: roundTo(cy - depth / 2, 50),
    width,
    depth,
    notchCorner: 'bottom-right',
    notchWidth: Math.max(MIN_NOTCH, roundTo(width * 0.35, 100)),
    notchDepth: Math.max(MIN_NOTCH, roundTo(depth * 0.35, 100)),
  });
}

export function frameLocalOutline(frame: UnderlayFrame): Point[] {
  const f = normalizeFrame(frame);
  const notch = f.shape === 'l-shape'
    ? { width: f.notchWidth, depth: f.notchDepth, corner: f.notchCorner }
    : undefined;
  return dimensionedOutline(f.width, f.depth, notch);
}

export function framePolygon(frame: UnderlayFrame): Point[] {
  const f = normalizeFrame(frame);
  return frameLocalOutline(f).map(p => ({ x: p.x + f.x, y: p.y + f.y }));
}

export function notchInnerCorner(frame: UnderlayFrame): Point | null {
  if (frame.shape !== 'l-shape') return null;
  const f = normalizeFrame(frame);
  const x = f.notchCorner.endsWith('left') ? f.x + f.notchWidth : f.x + f.width - f.notchWidth;
  const y = f.notchCorner.startsWith('top') ? f.y + f.notchDepth : f.y + f.depth - f.notchDepth;
  return { x, y };
}

export function dragFrameCorner(
  origin: UnderlayFrame,
  handle: FrameCornerHandle,
  worldPoint: Point,
  step = 50,
): UnderlayFrame {
  const qx = step > 0 ? roundTo(worldPoint.x, step) : Math.round(worldPoint.x);
  const qy = step > 0 ? roundTo(worldPoint.y, step) : Math.round(worldPoint.y);
  let left = origin.x;
  let right = origin.x + origin.width;
  let top = origin.y;
  let bottom = origin.y + origin.depth;

  const minW = origin.shape === 'l-shape' ? Math.max(MIN_SPAN, origin.notchWidth + MIN_ARM) : MIN_SPAN;
  const minD = origin.shape === 'l-shape' ? Math.max(MIN_SPAN, origin.notchDepth + MIN_ARM) : MIN_SPAN;

  if (handle.endsWith('left')) left = clamp(qx, right - MAX_SPAN, right - minW);
  else right = clamp(qx, left + minW, left + MAX_SPAN);

  if (handle.startsWith('top')) top = clamp(qy, bottom - MAX_SPAN, bottom - minD);
  else bottom = clamp(qy, top + minD, top + MAX_SPAN);

  return normalizeFrame({
    ...origin,
    x: left,
    y: top,
    width: right - left,
    depth: bottom - top,
  });
}

export function dragFrameNotch(
  origin: UnderlayFrame,
  worldPoint: Point,
  step = 50,
): UnderlayFrame {
  if (origin.shape !== 'l-shape') return origin;
  const qx = step > 0 ? roundTo(worldPoint.x, step) : Math.round(worldPoint.x);
  const qy = step > 0 ? roundTo(worldPoint.y, step) : Math.round(worldPoint.y);
  const rawW = origin.notchCorner.endsWith('left')
    ? qx - origin.x
    : origin.x + origin.width - qx;
  const rawD = origin.notchCorner.startsWith('top')
    ? qy - origin.y
    : origin.y + origin.depth - qy;
  return normalizeFrame({
    ...origin,
    notchWidth: clamp(rawW, MIN_NOTCH, origin.width - MIN_ARM),
    notchDepth: clamp(rawD, MIN_NOTCH, origin.depth - MIN_ARM),
  });
}

// Builds a surveyed shop shell from the quick frame while shifting the calibrated underlay
// so the traced floorplan stays aligned pixel-for-pixel with the generated inner walls.
export function buildUnderlayFramedShell(source: Project, frame: UnderlayFrame): Project {
  const f = normalizeFrame(frame);
  const local = frameLocalOutline(f);
  const shell = sketchShell(local);
  const corners = shell.survey!.corners;
  const shellOriginX = Math.min(...corners.map(p => p.x));
  const shellOriginY = Math.min(...corners.map(p => p.y));
  const dx = shellOriginX - f.x;
  const dy = shellOriginY - f.y;
  const underlay = source.underlay
    ? { ...source.underlay, x: source.underlay.x + dx, y: source.underlay.y + dy }
    : undefined;
  return {
    ...shell,
    style: { ...shell.style, ...source.style },
    items: shell.items.map(wall => ({ ...wall, h: source.style?.ceilingHeight ?? wall.h })),
    id: source.id,
    createdAt: source.createdAt,
    metadata: source.metadata,
    name: source.name,
    underlay,
  };
}
