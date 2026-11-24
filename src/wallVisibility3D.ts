import { Item, Point, Project } from './model';
import { pointInSite, siteOutline } from './site';
import { surveyWall } from './interiorSurvey';

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function isExteriorWall(wall: Item, project: Project, outline: Point[]): boolean {
  if (project.survey?.wallIds.includes(wall.id)) return true;
  const center = { x: wall.x + wall.w / 2, y: wall.y + wall.d / 2 };
  const tol = Math.max(wall.d, 260);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length];
    if (pointToSegmentDist(center, a, b) <= tol) return true;
  }
  return false;
}

function outwardNormal(wall: Item, project: Project): Point | null {
  const datum = surveyWall(project, wall);
  if (datum) return { x: -datum.inward.x, y: -datum.inward.y };
  const rad = (wall.rotation * Math.PI) / 180;
  const nx = -Math.sin(rad), ny = Math.cos(rad);
  const cx = wall.x + wall.w / 2, cy = wall.y + wall.d / 2;
  const probe = Math.max(wall.d, 220) + 120;
  const inPos = pointInSite(project, { x: cx + nx * probe, y: cy + ny * probe });
  const inNeg = pointInSite(project, { x: cx - nx * probe, y: cy - ny * probe });
  if (inPos === inNeg) return null;
  return inPos ? { x: -nx, y: -ny } : { x: nx, y: ny };
}

/**
 * Returns IDs of exterior perimeter walls sitting between the 3D oblique camera
 * and the interior floor so they can auto-cutaway without blocking dining views
 * (Blueprint3D camera-facing wall auto-hiding pattern).
 */
export function computeFrontFacingWallIds(project: Project, cameraXZ: { x: number; z: number }): Set<string> {
  const outline = siteOutline(project);
  const result = new Set<string>();
  for (const wall of project.items) {
    if (wall.kind !== 'wall' || wall.hidden) continue;
    if (!isExteriorWall(wall, project, outline)) continue;
    const normal = outwardNormal(wall, project);
    if (!normal) continue;
    const wx = (wall.x + wall.w / 2) / 1000;
    const wz = (wall.y + wall.d / 2) / 1000;
    const vx = cameraXZ.x - wx;
    const vz = cameraXZ.z - wz;
    const dist = Math.hypot(vx, vz);
    if (dist < 0.05) continue;
    const dot = (normal.x * vx + normal.y * vz) / dist;
    if (dot > 0.18) result.add(wall.id);
  }
  return result;
}
