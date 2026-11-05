import { Point } from './model';
type Edge={a:Point;b:Point};
const edges=(p:Point[]):Edge[]=>p.map((a,i)=>({a,b:p[(i+1)%p.length]}));
function spans(p:Point[],x:number){
 const ys=edges(p).filter(({a,b})=>(a.x>x)!==(b.x>x)).map(({a,b})=>a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x)).sort((a,b)=>a-b);
 return ys.filter((_,i)=>i%2===0).map((y,i)=>[y,ys[i*2+1]]);
}
// Between vertices and edge intersections, all vertical interval endpoints are linear.
// Midpoint integration is exact for these slabs, including concave/disconnected overlaps.
export function polygonCoverage(site:Point[],polygons:Point[][]){
 const all=[site,...polygons],segments=all.flatMap(edges),xs=all.flat().map(p=>p.x);
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
  const {a,b}=segments[i],{a:c,b:d}=segments[j];
  if(Math.max(a.x,b.x)<Math.min(c.x,d.x)||Math.max(c.x,d.x)<Math.min(a.x,b.x)||Math.max(a.y,b.y)<Math.min(c.y,d.y)||Math.max(c.y,d.y)<Math.min(a.y,b.y))continue;
  const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,den=rx*sy-ry*sx;if(Math.abs(den)<1e-9)continue;
  const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/den,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/den;
  if(t>0&&t<1&&u>0&&u<1)xs.push(a.x+t*rx);
 }
 xs.sort((a,b)=>a-b);let union=0,overlap=0,sum=0;
 for(let i=1;i<xs.length;i++){
  const width=xs[i]-xs[i-1];if(width<1e-7)continue;const x=(xs[i]+xs[i-1])/2,events:{y:number;delta:number}[]=[];
  for(const poly of polygons)for(const [a,b] of spans(poly,x))for(const [c,d] of spans(site,x)){
   const lo=Math.max(a,c),hi=Math.min(b,d);if(hi>lo)events.push({y:lo,delta:1},{y:hi,delta:-1});
  }
  events.sort((a,b)=>a.y-b.y);let count=0,previous=0;
  for(const e of events){const area=(e.y-previous)*width;if(count>0)union+=area;if(count>1)overlap+=area;sum+=area*count;count+=e.delta;previous=e.y}
 }
 return {union,overlap,sum};
}
