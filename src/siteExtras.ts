import { Project, Underlay, Point } from './model';
import { validateSite, pointInSite, siteOutline } from './site';
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function imageToWorld(u:Underlay,p:Point):Point{const a=u.rotation*Math.PI/180;return {x:u.x+(p.x*Math.cos(a)-p.y*Math.sin(a))*u.mmPerPixel,y:u.y+(p.x*Math.sin(a)+p.y*Math.cos(a))*u.mmPerPixel}}
export function worldToImage(u:Underlay,p:Point):Point{const a=u.rotation*Math.PI/180,x=(p.x-u.x)/u.mmPerPixel,y=(p.y-u.y)/u.mmPerPixel;return{x:x*Math.cos(a)+y*Math.sin(a),y:-x*Math.sin(a)+y*Math.cos(a)}}
export function calibrate(u:Underlay,points:[Point,Point],distance:number):Underlay{
 const pixels=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
 if(!finite(distance)||distance<=0||pixels<1)throw Error('请选择至少相隔 1 像素的两点，并输入正的已知距离');
 const anchor=imageToWorld(u,points[0]),next={...u,mmPerPixel:distance/pixels,calibration:{points,distance}},newAnchor=imageToWorld(next,points[0]);
 return {...next,x:u.x+anchor.x-newAnchor.x,y:u.y+anchor.y-newAnchor.y};
}
export function validateSiteExtras(p:Project){
 const u=p.underlay;
 if(u){
  if(typeof u.assetId!=='string'||!u.assetId||typeof u.name!=='string'||![u.pixelWidth,u.pixelHeight,u.x,u.y,u.mmPerPixel,u.rotation,u.opacity].every(finite)||u.pixelWidth<=0||u.pixelHeight<=0||u.pixelWidth*u.pixelHeight>32000000||u.mmPerPixel<=0||u.mmPerPixel>1e6||u.opacity<0||u.opacity>1||typeof u.hidden!=='boolean'||typeof u.locked!=='boolean')throw Error('底图位置、尺寸或显示设置无效');
  if(u.calibration&&(!Array.isArray(u.calibration.points)||u.calibration.points.length!==2||!finite(u.calibration.distance)||u.calibration.distance<=0||u.calibration.points.some(v=>!v||!finite(v.x)||!finite(v.y)||v.x<0||v.y<0||v.x>u.pixelWidth||v.y>u.pixelHeight)))throw Error('底图校准信息无效');
 }
 if(p.planningAreas!==undefined){
  if(!Array.isArray(p.planningAreas)||p.planningAreas.length>50)throw Error('规划范围最多 50 个');
  const ids=new Set<string>();for(const a of p.planningAreas){if(!a||typeof a.id!=='string'||!a.id||ids.has(a.id)||typeof a.name!=='string'||!/^#[0-9a-f]{6}$/i.test(a.color))throw Error('规划范围名称、颜色或 ID 无效');ids.add(a.id);validateSite({...p,outline:a.outline});if(!a.outline)throw Error('规划范围缺少轮廓');if(!outlineWithinSite(p,a.outline))throw Error('规划范围必须完整位于整场地内，请先调整规划边界')}
 }
}

// Split each edge at all site-boundary intersections, including concave corners.
function outlineWithinSite(p:Project,outline:Point[]){
 const site=siteOutline(p),cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
 return outline.every((a,i)=>{if(!pointInSite(p,a))return false;const b=outline[(i+1)%outline.length],r={x:b.x-a.x,y:b.y-a.y},cuts=[0,1];
  site.forEach((c,j)=>{const d=site[(j+1)%site.length],v={x:d.x-c.x,y:d.y-c.y},q={x:c.x-a.x,y:c.y-a.y},den=cross(r,v);if(Math.abs(den)>1e-8){const t=cross(q,v)/den,u=cross(q,r)/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t)}else if(Math.abs(cross(q,r))<.001){const length=r.x*r.x+r.y*r.y;for(const e of [c,d]){const t=((e.x-a.x)*r.x+(e.y-a.y)*r.y)/length;if(t>0&&t<1)cuts.push(t)}}});
  cuts.sort((a,b)=>a-b);return cuts.slice(1).every((v,j)=>{const t=(v+cuts[j])/2;return pointInSite(p,{x:a.x+t*r.x,y:a.y+t*r.y})});
 });
}
