import { Item, Point, Project } from './model';
import { surveyWall } from './interiorSurvey';
import { wallPoint } from './structure';
export function nearestWallEnd(project:Project,p:Point,tolerance:number,exclude?:string){
 let result:Point|undefined,distance=tolerance;
 for(const wall of project.items.filter(i=>i.kind==='wall'&&!i.hidden&&i.id!==exclude))for(const q of [wallPoint(wall,0),wallPoint(wall,wall.w)]){const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<distance){distance=d;result=q}}
 return result;
}
const local=(w:Item,p:Point):Point=>{const a=w.rotation*Math.PI/180,x=p.x-w.x-w.w/2,y=p.y-w.y-w.d/2;return{x:x*Math.cos(a)+y*Math.sin(a),y:-x*Math.sin(a)+y*Math.cos(a)}};
export const plainWallProfile=(w:Item):Point[]=>[{x:-w.w/2,y:-w.d/2},{x:-w.w/2,y:w.d/2},{x:w.w/2,y:w.d/2},{x:w.w/2,y:-w.d/2}];
type WallProfileCacheEntry = {
  survey: Project['survey'];
  walls: Item[];
  openings: Item[];
  profiles: Map<string, Point[]>;
};
const wallProfileCache = new Map<string, WallProfileCacheEntry>();
const MAX_WALL_PROFILE_CACHE = 8;

// Derived miter profiles only: wall centre lines, lengths and opening offsets stay unchanged.
// Two visible walls, equal heights, non-collinear directions, bounded miter and clear end solids.
export function wallProfiles(project:Project){
 const cached = wallProfileCache.get(project.id);
 if (cached && cached.survey === project.survey) {
  let wIdx = 0, oIdx = 0, match = true;
  for (let idx = 0; idx < project.items.length; idx++) {
   const i = project.items[idx];
   if (i.kind === 'wall' && !i.hidden) {
    if (cached.walls[wIdx++] !== i) { match = false; break; }
   }
   if (i.wallId !== undefined) {
    if (cached.openings[oIdx++] !== i) { match = false; break; }
   }
  }
  if (match && wIdx === cached.walls.length && oIdx === cached.openings.length) return cached.profiles;
 }
 const walls: Item[] = [];
 const openings: Item[] = [];
 const openingsByWall = new Map<string, Item[]>();
 for (const i of project.items) {
  if (i.kind === 'wall' && !i.hidden) walls.push(i);
  if (i.wallId !== undefined) {
   openings.push(i);
   const list = openingsByWall.get(i.wallId);
   if (list) list.push(i);
   else openingsByWall.set(i.wallId, [i]);
  }
 }
 const profiles=new Map(walls.map(w=>[w.id,plainWallProfile(w)]));
 const ends=walls.flatMap(w=>[0,1].map(end=>{const a=(w.rotation+(end?180:0))*Math.PI/180;return{w,end,p:wallPoint(w,end?w.w:0),dir:{x:Math.cos(a),y:Math.sin(a)}}}));
 for(let i=0;i<ends.length;i++){
  const a=ends[i],matches=ends.filter(b=>b.w.id!==a.w.id&&Math.hypot(a.p.x-b.p.x,a.p.y-b.p.y)<.5);if(matches.length!==1)continue;
  const b=matches[0];if(a.w.id>b.w.id||Math.abs(a.w.h-b.w.h)>.1)continue;
  const den=a.dir.x*b.dir.y-a.dir.y*b.dir.x;if(Math.abs(den)<.05)continue;
  const corners=[1,-1].map(sign=>{
   const p={x:a.p.x-a.dir.y*a.w.d/2*sign,y:a.p.y+a.dir.x*a.w.d/2*sign},q={x:b.p.x+b.dir.y*b.w.d/2*sign,y:b.p.y-b.dir.x*b.w.d/2*sign};
   const t=((q.x-p.x)*b.dir.y-(q.y-p.y)*b.dir.x)/den;return{x:p.x+a.dir.x*t,y:p.y+a.dir.y*t};
  });
  if(corners.some(p=>Math.hypot(p.x-a.p.x,p.y-a.p.y)>Math.max(a.w.d,b.w.d)*4))continue;
  const safe = (e: typeof a) => {
    // Surveyed orthogonal miters already have a validated, non-crossing outer perimeter.
    const surveyed = project.survey && surveyWall(project,e.w);
    const wallOpenings = openingsByWall.get(e.w.id) ?? [];
    const limit = Math.min(surveyed ? Infinity : e.w.w*.45, ...wallOpenings.map(o=>e.end ? e.w.w-o.offset!-o.w : o.offset!));
    return corners.every(p=>{
      const v=local(e.w,p), along=e.end ? e.w.w/2-v.x : v.x+e.w.w/2;
      return surveyed ? along <= limit + .001 : along < limit - .1;
    });
  };
  if(!safe(a)||!safe(b))continue;
  for(const e of [a,b]){const points=corners.map(p=>local(e.w,p)).sort((x,y)=>x.y-y.y),profile=profiles.get(e.w.id)!;if(e.end){profile[3]=points[0];profile[2]=points[1]}else{profile[0]=points[0];profile[1]=points[1]}}
 }
 wallProfileCache.delete(project.id);
 wallProfileCache.set(project.id, { survey: project.survey, walls, openings, profiles });
 if (wallProfileCache.size > MAX_WALL_PROFILE_CACHE) {
  const oldest = wallProfileCache.keys().next().value;
  if (oldest !== undefined) wallProfileCache.delete(oldest);
 }
 return profiles;
}
