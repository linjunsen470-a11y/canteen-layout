import { Project, modelOf } from './model';
import { isBuilding } from './structure';
import { isAnnotation } from './annotations';
import { zoneArea } from './zones';
import { seatSummary } from './layoutGroups';
import { planningArea, planningAreaLabel, siteArea } from './site';

const quietModels = new Set(['wood-feature-wall', 'wall-art', 'tv-screen', 'shop-sign', 'menu-board', 'potted-plant', 'hood']);

export type CapturePlanOptions = { header?: boolean };

export function capturePlan(svg:SVGSVGElement,project:Project,options:CapturePlanOptions={}):Promise<string>{return new Promise((resolve,reject)=>{
    if(project.underlay&&!project.underlay.hidden&&!svg.querySelector('[data-underlay]')){reject(Error('底图未加载完成或资产缺失，请先恢复底图后导出'));return}
    const showHeader = options.header !== false;
    const clone=svg.cloneNode(true) as SVGSVGElement;
    const width=Math.max(1,Math.round(2000*project.width/Math.max(project.width,project.height))),height=Math.max(1,Math.round(2000*project.height/Math.max(project.width,project.height))),padding=110;
    const sheetWidth = Math.max(1060, width + padding * 2), header = showHeader ? 105 : 0, sheetHeight = height + padding * 2 + header;
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox','0 0 ' + sheetWidth + ' ' + sheetHeight);
    clone.setAttribute('width',String(sheetWidth)); clone.setAttribute('height',String(sheetHeight));
    clone.querySelectorAll('[data-ui]').forEach(n=>n.remove());
    const scene=clone.querySelector('[data-plan]')!;scene.setAttribute('transform',`translate(${(sheetWidth-width)/2},${padding+header}) scale(${width/project.width})`);
    const exportScale=width/project.width;
    clone.querySelectorAll('[stroke-width]').forEach(n=>n.setAttribute('stroke-width',String(1/exportScale)));
    clone.querySelectorAll('[stroke-dasharray]').forEach(n=>n.setAttribute('stroke-dasharray',`${5/exportScale} ${4/exportScale}`));
    const ns='http://www.w3.org/2000/svg';
    const el=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n};

    clone.setAttribute('font-family','system-ui, sans-serif');
    if (showHeader) {
      const heading = el('svg',{x:36,y:14,width:sheetWidth-72,height:48,overflow:'hidden'});
      heading.append(el('text',{x:0,y:36,fill:'#244b3c','font-size':32,'font-weight':650},project.name));
      const seats = seatSummary(project);
      const facts = [planningAreaLabel(project) + ' ' + (planningArea(project)/1e6).toFixed(2) + ' ㎡',
        seats.seats + ' 座' + (seats.unknown ? '（另有未标定座位）' : '')];
      if (project.survey) {
        const xs = project.survey.corners.map(p=>p.x), ys = project.survey.corners.map(p=>p.y);
        facts.splice(1,0,'外轮廓面积 ' + (siteArea(project)/1e6).toFixed(2) + ' ㎡');
        facts.unshift('内净范围 ' + (Math.max(...xs)-Math.min(...xs)) + ' × ' + (Math.max(...ys)-Math.min(...ys)) + ' mm');
      }
      clone.append(heading, el('text',{x:36,y:84,'font-size':20,fill:'#4e6255'},facts.join('   ·   ')),
        el('line',{x1:36,x2:sheetWidth-36,y1:header,y2:header,stroke:'#bdcabe'}));
    }
    clone.querySelectorAll<SVGGElement>('[data-item-id]').forEach(group=>{
      group.removeAttribute('opacity');const i=project.items.find(i=>i.id===group.dataset.itemId)!;if(isAnnotation(i))return;
      group.querySelectorAll('text, [data-zone-pill]').forEach(n=>n.remove());
      group.querySelectorAll('[stroke]').forEach(n=>{if(!n.closest('[data-equipment-symbol]'))n.setAttribute('stroke',i.kind==='zone'?'#acbcb3':'#5e7166')});
      group.querySelector('[data-symbol-detail]')?.setAttribute('visibility',Math.min(i.w,i.d)*exportScale<16?'hidden':'visible');
      if(i.kind==='chair')group.querySelector('[data-back-edge]')?.setAttribute('stroke-width',String(i.d*.13));
      group.querySelector('[data-operation-edge]')?.setAttribute('stroke-width',String(2/exportScale));
      const m=modelOf(i);
      if (i.kind === 'utility' && i.pointType === 'entrance') {
        group.append(el('text',{y:0,fill:'#244b3c','font-size':14/exportScale,'text-anchor':'middle','dominant-baseline':'middle'},'入口'));
        return;
      }
      if(i.kind==='zone'||isBuilding(i)||i.kind==='lighting'||i.kind==='chair'||quietModels.has(m)||i.w*exportScale<40)return;
      const normRot=((i.rotation%360)+360)%360, flip=normRot>90&&normRot<270;
      const ly=group.querySelector('[data-equipment-symbol]')?i.d/2+13/exportScale:0;
      const tableGroup = i.kind === 'table' ? project.groups?.find(g=>g.members.includes(i.id)) : undefined;
      const singleTable = tableGroup && !project.items.some(v=>v.kind==='table' && v.id!==i.id && tableGroup.members.includes(v.id));
      const label = singleTable && tableGroup.seats && !project.items.some(v=>v.hidden && tableGroup.members.includes(v.id))
        ? i.name + ' · ' + tableGroup.seats + ' 座' : i.name;
      const text=el('text',{y:ly,fill:'#273e31','font-size':Math.min(17/exportScale,i.w*.86/Math.max(4,label.length)),'text-anchor':'middle','dominant-baseline':'middle'},label);
      if(flip)text.setAttribute('transform',`rotate(180 0 ${ly})`);
      group.append(text);
    });

    // Crisp architectural exterior dimension lines, zone labels, and scale bar
    const dimOff=42/exportScale, tick=7/exportScale, fs=15/exportScale, sw=1.4/exportScale;
    const arch=el('g',{'pointer-events':'none'});
    for(const z of project.items.filter(i=>i.kind==='zone'&&!i.hidden)){
      const label=`${z.name} · ${(zoneArea(project,z)/1e6).toFixed(1)}㎡`;
      const pillW=(label.length*10.5+24)/exportScale, pillH=24/exportScale;
      const px=z.x+16/exportScale, py=z.y+z.d-34/exportScale;
      arch.append(el('rect',{x:px,y:py,width:pillW,height:pillH,rx:5/exportScale,fill:'#ffffff',opacity:0.92,stroke:'#d4cec2','stroke-width':1/exportScale}));
      arch.append(el('text',{x:px+11/exportScale,y:py+15/exportScale,fill:'#2c4237','font-size':13/exportScale,'font-weight':'600'},label));
    }
    const prefix = project.survey ? '外 ' : '';
    // Top dimension
    arch.append(el('line',{x1:0,y1:-dimOff,x2:project.width,y2:-dimOff,stroke:'#6f7f75','stroke-width':sw}));
    arch.append(el('line',{x1:0,y1:-dimOff-tick,x2:0,y2:-dimOff+tick,stroke:'#6f7f75','stroke-width':sw}));
    arch.append(el('line',{x1:project.width,y1:-dimOff-tick,x2:project.width,y2:-dimOff+tick,stroke:'#6f7f75','stroke-width':sw}));
    arch.append(el('rect',{x:project.width/2-52/exportScale,y:-dimOff-13/exportScale,width:104/exportScale,height:26/exportScale,rx:5/exportScale,fill:'#ffffff'}));
    arch.append(el('text',{x:project.width/2,y:-dimOff+1/exportScale,'font-size':fs,'font-weight':'600',fill:'#3a4c42','text-anchor':'middle','dominant-baseline':'middle'},prefix + `${(project.width/1000).toFixed(2)} m`));
    // Left dimension
    arch.append(el('line',{x1:-dimOff,y1:0,x2:-dimOff,y2:project.height,stroke:'#6f7f75','stroke-width':sw}));
    arch.append(el('line',{x1:-dimOff-tick,y1:0,x2:-dimOff+tick,y2:0,stroke:'#6f7f75','stroke-width':sw}));
    arch.append(el('line',{x1:-dimOff-tick,y1:project.height,x2:-dimOff+tick,y2:project.height,stroke:'#6f7f75','stroke-width':sw}));
    const leftG=el('g',{transform:`translate(${-dimOff},${project.height/2}) rotate(-90)`});
    leftG.append(el('rect',{x:-52/exportScale,y:-13/exportScale,width:104/exportScale,height:26/exportScale,rx:5/exportScale,fill:'#ffffff'}));
    leftG.append(el('text',{x:0,y:1/exportScale,'font-size':fs,'font-weight':'600',fill:'#3a4c42','text-anchor':'middle','dominant-baseline':'middle'},prefix + `${(project.height/1000).toFixed(2)} m`));
    arch.append(leftG);
    // Scale bar bottom-left
    const sbW=Math.min(project.width/2,project.width>=6000?2000:1000), sbY=project.height+38/exportScale;
    arch.append(el('rect',{x:0,y:sbY,width:sbW/2,height:6/exportScale,fill:'#364c40'}));
    arch.append(el('rect',{x:sbW/2,y:sbY,width:sbW/2,height:6/exportScale,fill:'#ffffff',stroke:'#364c40','stroke-width':sw}));
    arch.append(el('text',{x:0,y:sbY+20/exportScale,'font-size':12/exportScale,fill:'#58685d'},'0'));
    arch.append(el('text',{x:sbW/2,y:sbY+20/exportScale,'font-size':12/exportScale,fill:'#58685d','text-anchor':'middle'},`${sbW/2000}m`));
    arch.append(el('text',{x:sbW,y:sbY+20/exportScale,'font-size':12/exportScale,fill:'#58685d','text-anchor':'middle'},`${sbW/1000}m`));
    scene.append(arch);

    const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)],{type:'image/svg+xml'}));const image=new Image();image.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=sheetWidth;canvas.height=sheetHeight;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0);resolve(canvas.toDataURL('image/png'))}catch{reject(Error('平面图导出失败'))}finally{URL.revokeObjectURL(url)}};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('平面图导出失败'))};image.src=url;
})}
