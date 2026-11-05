import { Project } from './model';
import { isBuilding } from './structure';
import { isAnnotation } from './annotations';
import { zoneArea } from './zones';
export function capturePlan(svg:SVGSVGElement,project:Project):Promise<string>{return new Promise((resolve,reject)=>{
    if(project.underlay&&!project.underlay.hidden&&!svg.querySelector('[data-underlay]')){reject(Error('底图未加载完成或资产缺失，请先恢复底图后导出'));return}
    const clone=svg.cloneNode(true) as SVGSVGElement;
    const width=Math.max(1,Math.round(2000*project.width/Math.max(project.width,project.height))),height=Math.max(1,Math.round(2000*project.height/Math.max(project.width,project.height))),padding=60;
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('viewBox',`0 0 ${width+padding*2} ${height+padding*2}`);clone.setAttribute('width',String(width+padding*2));clone.setAttribute('height',String(height+padding*2));
    clone.querySelectorAll('[data-ui]').forEach(n=>n.remove());const scene=clone.querySelector('[data-plan]')!;scene.setAttribute('transform',`translate(${padding},${padding}) scale(${width/project.width})`);
    const exportScale=width/project.width;
    clone.querySelectorAll('[stroke-width]').forEach(n=>n.setAttribute('stroke-width',String(1/exportScale)));
    clone.querySelectorAll('[stroke-dasharray]').forEach(n=>n.setAttribute('stroke-dasharray',`${5/exportScale} ${4/exportScale}`));
    clone.querySelectorAll<SVGGElement>('[data-item-id]').forEach(group=>{
      group.removeAttribute('opacity');const i=project.items.find(i=>i.id===group.dataset.itemId)!;if(isAnnotation(i))return;
      group.querySelectorAll('text').forEach(n=>n.remove());
      group.querySelectorAll('[stroke]').forEach(n=>n.setAttribute('stroke',i.kind==='zone'?'#acbcb3':'#5e7166'));
      if(isBuilding(i)||(i.kind!=='zone'&&i.w*exportScale<28))return;
      const text=document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('fill',i.kind==='zone'?'#6c7d73':'#273e31');
      text.setAttribute('font-size',String(i.kind==='zone'?12/exportScale:Math.min(11/exportScale,i.w/Math.max(4,i.name.length))));
      if(i.kind==='zone'){text.setAttribute('x',String(i.x+10/exportScale));text.setAttribute('y',String(i.y+20/exportScale));text.textContent=`${i.name} · ${(zoneArea(project,i)/1e6).toFixed(1)}㎡`}
      else{text.setAttribute('text-anchor','middle');text.setAttribute('dominant-baseline','middle');text.textContent=i.name}
      group.append(text);
    });
    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));const image=new Image();image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=width+padding*2;canvas.height=height+padding*2;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);resolve(canvas.toDataURL('image/png'))}catch{reject(Error('平面图导出失败'))}finally{URL.revokeObjectURL(url)}};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('平面图导出失败'))};image.src=url;
})}
