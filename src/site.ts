import { Project } from './model';

export type SitePoint = { x: number; y: number };
export const floorColors = ['#e7e8e0', '#dbe0d6'];
export const siteOutline = (p: Project): SitePoint[] => p.outline ?? [{ x: 0, y: 0 }, { x: p.width, y: 0 }, { x: p.width, y: p.height }, { x: 0, y: p.height }];
export const polygonArea = (points: SitePoint[]) => Math.abs(points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
export const siteArea = (p: Project) => polygonArea(siteOutline(p));
const cross = (a: SitePoint, b: SitePoint, c: SitePoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
export function pointInSite(p: Project, point: SitePoint) {
  const points=siteOutline(p);let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
    const a=points[j],b=points[i];
    if(Math.abs(cross(a,b,point))<.001&&point.x>=Math.min(a.x,b.x)&&point.x<=Math.max(a.x,b.x)&&point.y>=Math.min(a.y,b.y)&&point.y<=Math.max(a.y,b.y))return true;
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
// A bounding-box centre can lie in a concave cutout; use an interior horizontal span instead.
export function sitePlacement(p: Project, preferred: SitePoint): SitePoint {
  if(pointInSite(p,preferred))return preferred;
  const points=siteOutline(p),y=(Math.min(...points.map(v=>v.y))+Math.max(...points.map(v=>v.y)))/2;
  const xs=points.flatMap((a,i)=>{const b=points[(i+1)%points.length];return (a.y>y)!==(b.y>y)?[a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y)]:[]}).sort((a,b)=>a-b);
  let start=xs[0],end=xs[1];for(let i=2;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>end-start){start=xs[i];end=xs[i+1]}
  return {x:(start+end)/2,y};
}
function intersects(a: SitePoint, b: SitePoint, c: SitePoint, d: SitePoint) {
  if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x) || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) return false;
  return cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
}
export function validateSite(p: Project) {
  if (p.outline === undefined) return;
  const points = p.outline;
  if (!Array.isArray(points) || points.length < 3 || points.length > 64) throw Error('场地轮廓需要 3–64 个顶点');
  if (points.some(v => !v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || v.x < 0 || v.y < 0 || v.x > p.width || v.y > p.height)) throw Error('轮廓顶点必须位于场地长宽范围内');
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], prev = points[(i + points.length - 1) % points.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1) throw Error('轮廓顶点不能重合');
    if (Math.abs(cross(prev, a, b)) < .001 && (prev.x - a.x) * (b.x - a.x) + (prev.y - a.y) * (b.y - a.y) > 0) throw Error('轮廓边不能折返重叠');
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      if (intersects(a, b, points[j], points[(j + 1) % points.length])) throw Error('轮廓边不能相交，请调整顶点位置');
    }
  }
  if (polygonArea(points) < 10000) throw Error('场地面积至少为 0.01 ㎡');
}
