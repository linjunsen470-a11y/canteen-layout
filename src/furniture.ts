import { isSiteObject, siteObjectModel } from './siteObjects';
import * as T from 'three';
import { createBuildingModel } from './buildingModels';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Item, Point, modelOf } from './model';
export type FurnitureSpec = Pick<Item,'kind'|'name'|'model'|'w'|'d'|'h'|'color'|'flipped'|'pointType'|'verification'>;

// One generated grain texture shared across models, with no network assets.
let grain: T.CanvasTexture | undefined;
function woodTexture() {
  if (grain) return grain;
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#eee3cf';ctx.fillRect(0,0,512,256);
  for(let y=0;y<256;y++) {const v=Math.sin(y*1.91)*.5+.5;ctx.strokeStyle=`rgba(95,64,29,${.04+v*.12})`;ctx.lineWidth=.5+v;ctx.beginPath();for(let x=0;x<=512;x+=8){const py=y+Math.sin(x/90+y*.08)*2+Math.sin(x/34+y)*.4;x?ctx.lineTo(x,py):ctx.moveTo(x,py)}ctx.stroke()}
  grain=new T.CanvasTexture(canvas);grain.colorSpace=T.SRGBColorSpace;grain.wrapS=grain.wrapT=T.RepeatWrapping;grain.anisotropy=4;return grain;
}
export function studioEnvironment(renderer:T.WebGLRenderer) {
  const room=new RoomEnvironment();const generator=new T.PMREMGenerator(renderer);
  const target=generator.fromScene(room,.04);room.dispose();generator.dispose();return target;
}
export function disposeFurniture(group:T.Object3D) {
  for(const texture of group.userData.ownedTextures??[])texture.dispose();
  const materials=new Set<T.Material>();
  group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))}});
  materials.forEach(m=>m.dispose());
}

// Build in a unit envelope then scale to the exact user dimensions. All details stay within it.
export function createFurniture(item:FurnitureSpec,openings:Item[]=[],profile?:Point[]) {
  if(isSiteObject(item))return siteObjectModel(item);
  if(['wall','door','window'].includes(item.kind))return createBuildingModel(item,openings,profile);
  const root=new T.Group();const type=modelOf(item);
  const material=(color:string,metalness=0,roughness=.5)=>new T.MeshStandardMaterial({color,metalness,roughness});
  const steel=material('#b9c5ca',.82,.29), dark=material('#252c30',.55,.37), rubber=material('#202426',0,.85);
  const paint=material(item.color,.15,.36), wood=material(item.color,0,.42);wood.map=woodTexture();
  if(['sink','worktable','stove','shelf'].includes(type))steel.color.lerp(new T.Color(item.color),.24);
  const black=material('#11191c',.22,.24), inside=material('#7c8d96',.8,.3);
  const glass=new T.MeshPhysicalMaterial({color:'#d4eeeb',metalness:0,roughness:.1,transparent:true,opacity:.22,depthWrite:false,side:T.DoubleSide});
  function mesh(geometry:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number){const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=mat!==glass;m.receiveShadow=true;root.add(m);return m}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material=steel,round=false){return mesh(round?new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.16):new T.BoxGeometry(w,h,d),mat,x,y,z)}
  function cylinder(x:number,y:number,z:number,r:number,h:number,mat:T.Material=steel){return mesh(new T.CylinderGeometry(r,r,h,64),mat,x,y,z)}
  function feet(top=.9,spread=.42,thickness=.035){for(const x of [-spread,spread])for(const z of [-.4,.4]){box(x,top/2+.025,z,thickness,top-.05,thickness);box(x,.025,z,thickness*1.15,.05,thickness*1.15,rubber,true)}}
  function handle(x:number,y:number,z=.493,h=.18){box(x,y,z,.014,h,.014,dark,true);box(x,y-h/2,z-.014,.014,.014,.03);box(x,y+h/2,z-.014,.014,.014,.03)}
  function basin(x:number,y:number,z:number,w:number,d:number,depth=.08){
    box(x,y-depth+.005,z,w,.014,d,inside,true);
    box(x-w/2,y-depth/2,z,.012,depth,d);box(x+w/2,y-depth/2,z,.012,depth,d);
    box(x,y-depth/2,z-d/2,w,depth,.012);box(x,y-depth/2,z+d/2,w,depth,.012);
    cylinder(x,y-depth+.014,z,.022,.003,black);cylinder(x,y-depth+.016,z,.012,.003,steel);
  }
  switch(type){
    case 'stairs': {
      const count=Math.max(3,Math.min(40,Math.round(item.h/160)));
      for(let step=0;step<count;step++){const h=(step+1)/count;box(0,h/2,.5-(step+.5)/count,1,h,1/count,paint)}
      break;
    }
    case 'rect-table':
    case 'round-table': {
      if(type==='round-table'){
        cylinder(0,.972,0,.5,.056,wood);cylinder(0,.47,0,.055,.91,dark);cylinder(0,.028,0,.30,.056,dark);
      }else{box(0,.97,0,1,.06,1,wood,true);feet(.92,.41,.045);box(0,.87,-.4,.86,.10,.035,dark);box(0,.87,.4,.86,.10,.035,dark);box(-.41,.87,0,.035,.10,.8,dark);box(.41,.87,0,.035,.10,.8,dark)}
      break;
    }
    case 'chair': {
      feet(.50,.38,.05);box(0,.52,.015,.98,.075,.88,paint,true);
      for(const x of [-.39,.39])box(x,.73,-.435,.045,.50,.045,dark,true);
      box(0,.83,-.433,.98,.34,.10,paint,true);box(0,.18,.36,.78,.025,.025,dark);break;
    }
    case 'bench': feet(.88,.40,.045);box(0,.94,0,1,.12,1,wood,true);box(0,.35,0,.83,.08,.055,dark);break;
    case 'worktable': feet(.93);box(0,.97,0,1,.06,1,steel,true);box(0,.2,0,.89,.035,.86);box(0,.89,-.43,.88,.1,.025);box(0,.89,.43,.88,.1,.025);break;
    case 'buffet': {
      feet(.14,.43,.04);box(0,.37,0,.96,.52,.92,paint,true);box(0,.71,-.42,1,.045,.16,steel,true);box(0,.71,.42,1,.045,.16,steel,true);for(const x of [-.48,-.155,.155,.48])box(x,.71,0,.035,.045,.68,steel,true);
      for(const x of [-.31,0,.31]){basin(x,.746,0,.235,.53);box(x,.685,0,.20,.008,.45,inside)}
      for(const x of [-.46,.46]){box(x,.85,-.35,.018,.28,.018,steel);box(x,.85,.35,.018,.28,.018,steel)}
      box(0,.984,0,.98,.018,.85,glass);box(0,.88,-.36,.94,.19,.009,glass);
      for(const x of [-.24,.24]){box(x,.41,.469,.46,.49,.012,paint,true);handle(x+.14,.48,.49,.12)}break;
    }
    case 'sink': {
      feet(.70);box(0,.18,0,.88,.025,.80);
      // Open worktop: strips around real recessed bowls, not a solid slab over them.
      box(0,.76,-.39,1,.045,.22);box(0,.76,.39,1,.045,.22);
      for(const x of [-.475,0,.475])box(x,.76,0,x===0?.08:.05,.045,.56);
      for(const x of [-.24,.24])basin(x,.775,0,.38,.54,.20);
      box(0,.82,-.48,1,.14,.025);
      cylinder(0,.89,-.36,.018,.18);
      const curve=new T.CatmullRomCurve3([new T.Vector3(0,.95,-.36),new T.Vector3(0,.984,-.29),new T.Vector3(0,.97,-.12),new T.Vector3(0,.91,-.10)]);
      mesh(new T.TubeGeometry(curve,18,.014,8,false),steel,0,0,0);box(.075,.80,-.36,.10,.016,.022,dark,true);break;
    }
    case 'upright-fridge': {
      feet(.08,.4,.05);box(0,.535,0,1,.93,.94,steel,true);
      for(const x of [-.242,.242]){box(x,.58,.477,.475,.80,.035,paint,true);handle(x+(x<0?.16:-.16),.60,.492,.19)}
      box(0,.125,.48,.88,.07,.022,dark);
      for(let n=0;n<6;n++)box(0,.099+n*.011,.495,.83,.004,.004,steel);
      box(.30,.945,.495,.12,.027,.006,black);box(.30,.945,.499,.065,.009,.002,material('#70c9b6',0,.4));break;
    }
    case 'chest-freezer': {
      feet(.08);box(0,.49,0,1,.82,.98,paint,true);box(0,.92,0,.99,.045,.97,rubber,true);box(0,.965,0,1,.07,1,steel,true);box(0,.88,.493,.22,.035,.014,dark,true);
      for(let n=0;n<6;n++)box(.32,.21+n*.025,.493,.22,.008,.006,dark);
      box(-.36,.27,.494,.09,.09,.008,black);cylinder(-.36,.27,.494,.02,.01);break;
    }
    case 'stove': {
      feet(.24);box(0,.52,0,.97,.57,.92,steel,true);box(0,.81,0,1,.045,1,steel,true);
      box(0,.92,-.475,1,.16,.05);box(0,.75,.471,.94,.1,.035,paint,true);
      for(const x of [-.25,.25]){cylinder(x,.86,0,.18,.04,black);cylinder(x,.883,0,.10,.008,steel);cylinder(x,.89,0,.065,.014,dark);for(const a of [0,Math.PI/2]){const grate=box(x,.915,0,.39,.035,.028,dark,true);grate.rotation.y=a}const knob=cylinder(x,.75,.493,.032,.014,dark);knob.rotation.x=Math.PI/2}
      box(0,.48,.476,.83,.31,.012,dark,true);box(0,.48,.486,.73,.23,.008,black);box(0,.66,.49,.65,.022,.018,steel,true);break;
    }
    case 'shelf': {
      feet(1,.46,.035);
      for(const y of [.08,.36,.64,.96]){box(0,y,0,1,.035,1,steel,true);box(0,y-.035,.48,.95,.04,.025,paint);box(0,y-.035,-.48,.95,.04,.025,paint)}
      // Back cross brace and adjustment holes.
      for(const sign of [-1,1]){const brace=box(0,.53,-.43,.018,1.18,.018,steel);brace.rotation.z=sign*.73}
      for(const x of [-.46,.46])for(let n=1;n<15;n++)box(x,n*.063,.421,.012,.012,.002,black);break;
    }
    case 'partition':
    case 'glass-partition':
    case 'slat-partition': {
      for(const x of [-.48,.48])box(x,.5,0,.04,1,1,steel,true);
      box(0,.98,0,.96,.04,1,steel);box(0,.035,0,.96,.07,1,steel);
      if(type==='glass-partition')box(0,.51,0,.92,.90,.12,glass);
      else if(type==='slat-partition'){for(let n=0;n<15;n++)box(-.435+n*.062,.51,0,.035,.90,.65,wood,true)}
      else box(0,.51,0,.92,.90,.60,paint,true);
      break;
    }
    case 'bar-table': feet(.94,.43,.045);box(0,.97,0,1,.06,1,wood,true);box(0,.3,0,.88,.035,.045,dark);break;
    case 'fold-table': {
      box(0,.97,0,1,.06,1,wood,true);
      for(const z of [-.37,.37])for(const sign of [-1,1]){const leg=box(sign*.15,.47,z,.04,.98,.04,dark,true);leg.rotation.z=sign*.48}break;
    }
    case 'stool': cylinder(0,.95,0,.5,.10,wood);feet(.89,.30,.055);box(0,.3,.3,.64,.03,.035,dark);box(0,.3,-.3,.64,.03,.035,dark);break;
    case 'sofa': {
      feet(.13,.42,.065);box(0,.29,0,1,.32,1,paint,true);box(0,.74,-.39,1,.52,.22,paint,true);
      for(const x of [-.24,.24])box(x,.49,.06,.46,.18,.74,paint,true);
      for(const x of [-.46,.46])box(x,.56,.02,.08,.28,.93,paint,true);break;
    }
    case 'waiting-bench': {
      feet(.5,.42,.035);box(0,.45,0,.9,.08,.06,dark);
      for(const x of [-.33,0,.33]){box(x,.53,.06,.30,.065,.85,paint,true);box(x,.82,-.4,.30,.36,.09,paint,true);box(x,.70,-.43,.025,.55,.025,steel)}break;
    }
    case 'cashier': {
      box(0,.37,0,1,.74,1,paint,true);box(0,.77,0,1,.06,1,wood,true);box(-.2,.82,-.32,.6,.1,.3,wood,true);
      box(.2,.85,0,.05,.12,.05,dark);const display=box(.2,.95,0,.3,.18,.03,black,true);display.rotation.x=-.15;box(.2,.81,.18,.25,.015,.17,dark);break;
    }
    case 'return-counter': {
      feet(.12);box(0,.53,0,.97,.82,.96,paint,true);box(0,.965,0,1,.07,1,steel,true);
      for(const x of [-.25,.25]){const rim=cylinder(x,1,0,.18,.02,dark);rim.scale.z=1.1;box(x,.4,.486,.45,.45,.02,paint,true);handle(x,.48,.499,.1)}break;
    }
    case 'tray-rack':
    case 'tray-cart':
    case 'cart':
    case 'wall-shelf': {
      const cart=type==='cart'||type==='tray-cart';feet(.95,.45,.035);
      const levels=type==='tray-cart'?10:type==='cart'?3:type==='tray-rack'?5:2;
      for(let n=0;n<levels;n++){const y=.12+n*.82/(levels-1);box(0,y,0,.94,.025,.9,steel,true);box(0,y+.025,-.44,.93,.035,.02,steel);if(type==='tray-rack')box(0,y+.04,0,.75,.02,.65,paint,true)}
      if(cart){for(const x of [-.42,.42])for(const z of [-.37,.37]){const wheel=cylinder(x,.05,z,.055,.045,rubber);wheel.rotation.z=Math.PI/2}box(-.47,.94,0,.025,.025,.85,dark)}break;
    }
    case 'display-counter':
    case 'salad-counter': {
      feet(.08);box(0,.25,0,1,.42,.95,paint,true);box(0,.49,0,1,.04,1,steel,true);
      for(const x of [-.47,.47])for(const z of [-.45,.45])box(x,.74,z,.025,.5,.025,steel);
      box(0,.99,0,1,.02,1,glass);box(0,.74,-.46,.95,.48,.012,glass);box(-.48,.74,0,.012,.48,.9,glass);box(.48,.74,0,.012,.48,.9,glass);
      if(type==='display-counter'){box(0,.72,0,.91,.015,.88,glass);for(const x of [-.3,0,.3])box(x,.53,0,.25,.015,.55,steel,true)}
      else for(const x of [-.33,0,.33])basin(x,.52,0,.27,.65,.1);break;
    }
    case 'beverage': {
      box(0,.14,0,1,.28,1,paint,true);for(const x of [-.25,.25]){cylinder(x,.57,0,.23,.58,glass);cylinder(x,.46,0,.21,.35,material(x<0?'#d8a235':'#ac5b3b',0,.5));cylinder(x,.89,0,.24,.06,black);box(x,.32,.4,.07,.1,.1,dark);box(x,.1,.42,.35,.02,.13,steel)}break;
    }
    case 'steamer':
    case 'oven':
    case 'sterilizer':
    case 'cabinet':
    case 'locker':
    case 'glass-fridge':
    case 'undercounter-fridge': {
      feet(.07);box(0,.535,-.035,1,.93,.90,steel,true);
      const cols=type==='oven'?1:type==='locker'?3:2,rows=type==='oven'||type==='locker'?2:1;
      for(let col=0;col<cols;col++)for(let row=0;row<rows;row++){
        const x=-.48+(col+.5)*.96/cols,y=.14+(row+.5)*.80/rows,cw=.94/cols,ch=.77/rows;
        if(type==='glass-fridge'||type==='sterilizer'||type==='oven'){box(x,y,.42,cw,ch,.03,dark,true);box(x,y,.444,cw*.8,ch*.72,.012,black);for(let k=0;k<4;k++)box(x,y-ch*.3+k*ch*.2,.453,cw*.78,.008,.004,steel);box(x,y,.461,cw*.82,ch*.74,.008,glass)}
        else box(x,y,.442,cw,ch,.035,paint,true);
        if(type==='oven')box(x,y+ch*.4,.48,cw*.65,.018,.03,steel,true);else handle(x+cw*.30,y,.48,ch*.3);
      }
      if(type==='steamer'){for(const x of [-.24,.24]){cylinder(x,.96,.03,.04,.06,black);box(x,.88,.49,.08,.035,.006,black)}}
      if(type==='locker')for(const x of [-.32,0,.32])for(const y of [.3,.7])for(let n=0;n<3;n++)box(x,y+n*.018,.463,.18,.005,.003,dark);
      if(type==='glass-fridge')for(let n=0;n<5;n++)box(0,.09+n*.01,.475,.85,.004,.006,dark);
      if(type==='undercounter-fridge')box(0,.98,0,1,.04,1,steel,true);break;
    }
    case 'ice-maker': {
      feet(.07);box(0,.53,0,1,.94,1,paint,true);box(0,.68,.49,.9,.45,.02,steel,true);box(0,.47,.495,.6,.025,.016,dark);
      for(let n=0;n<7;n++)box(0,.13+n*.025,.495,.8,.008,.006,dark);box(.30,.94,.495,.14,.04,.006,black);break;
    }
    case 'fryer':
    case 'griddle':
    case 'noodle-cooker':
    case 'induction':
    case 'wok': {
      feet(.18);box(0,.47,0,.97,.61,.92,paint,true);box(0,.79,0,1,.04,1,steel,true);box(0,.93,-.47,1,.14,.06,steel);
      if(type==='griddle')box(0,.82,0,.91,.025,.82,dark,true);
      if(type==='induction')for(const x of [-.25,.25]){box(x,.821,0,.43,.018,.85,black,true);const ring=mesh(new T.TorusGeometry(.15,.008,6,40),steel,x,.834,0);ring.rotation.x=Math.PI/2}
      if(type==='wok'){const bowl=mesh(new T.SphereGeometry(.42,32,16,0,Math.PI*2,Math.PI/2,Math.PI/2),dark,0,.95,0);bowl.scale.y=.4;const rim=mesh(new T.TorusGeometry(.42,.015,8,40),steel,0,.95,0);rim.rotation.x=Math.PI/2}
      if(type==='noodle-cooker')for(const x of [-.3,0,.3])for(const z of [-.22,.22]){cylinder(x,.826,z,.12,.012,black);const ring=mesh(new T.TorusGeometry(.12,.012,6,24),steel,x,.837,z);ring.rotation.x=Math.PI/2;box(x,.86,z+.14,.025,.025,.16,dark)}
      if(type==='fryer')for(const x of [-.24,.24]){box(x,.824,0,.40,.02,.72,dark);box(x,.85,0,.34,.035,.56,steel);for(let n=0;n<8;n++)box(x-.15+n*.043,.872,0,.008,.006,.54,dark);box(x,.89,.35,.04,.04,.22,dark)}
      for(const x of [-.25,.25]){const knob=cylinder(x,.72,.48,.03,.025,dark);knob.rotation.x=Math.PI/2}break;
    }
    case 'hood': {
      for(const x of [-.46,.46])box(x,.45,-.43,.025,.9,.03,steel);
      box(0,.86,0,1,.22,1,steel,true);box(0,.98,-.1,.5,.04,.5,steel);box(0,.745,0,.91,.012,.9,dark);
      for(let n=0;n<10;n++)box(-.43+n*.095,.735,0,.015,.018,.85,steel);break;
    }
    case 'single-sink':
    case 'triple-sink':
    case 'handwash': {
      const count=type==='triple-sink'?3:1;if(type==='handwash')box(0,.35,0,.35,.7,.4,paint,true);else{feet(.72);box(0,.18,0,.88,.025,.8,steel)}
      box(0,.76,-.40,1,.04,.20,steel);box(0,.76,.40,1,.04,.20,steel);
      for(let n=0;n<=count;n++)box(-.48+n*.96/count,.76,0,.04,.04,.60,steel);
      for(let n=0;n<count;n++)basin(-.48+(n+.5)*.96/count,.78,0,.96/count-.06,.57,.20);
      box(0,.82,-.48,1,.14,.025,steel);cylinder(0,.88,-.36,.018,.2);
      const curve=new T.CatmullRomCurve3([new T.Vector3(0,.96,-.36),new T.Vector3(0,.99,-.28),new T.Vector3(0,.97,-.13),new T.Vector3(0,.90,-.1)]);mesh(new T.TubeGeometry(curve,16,.014,8,false),steel,0,0,0);break;
    }
    case 'dishwasher': {
      feet(.09);box(0,.29,0,1,.43,.94,paint,true);box(0,.75,0,.98,.5,.98,steel,true);box(0,.51,0,1,.03,1,dark);
      for(const x of [-.49,.49])box(x,.65,.47,.022,.30,.025,steel);box(0,.80,.49,.95,.025,.025,dark);box(.3,.42,.48,.14,.035,.009,black);break;
    }
    case 'bin': {
      box(0,.46,0,.93,.88,.93,paint,true);box(0,.94,0,1,.08,1,dark,true);box(0,.99,0,.95,.02,.95,paint,true);box(0,.05,.48,.4,.035,.06,dark);break;
    }
    case 'water-boiler': {
      box(0,.5,0,1,1,1,paint,true);box(0,.76,.48,.85,.38,.025,dark,true);box(.2,.87,.498,.25,.06,.005,black);
      for(const x of [-.22,.22]){box(x,.62,.47,.05,.06,.06,steel);box(x,.58,.49,.03,.06,.02,dark)}box(0,.49,.4,.9,.03,.20,steel);break;
    }
    case 'coffee-machine': {
      box(0,.43,-.05,1,.86,.9,paint,true);box(0,.85,0,1,.08,1,steel,true);box(0,.36,.47,.85,.50,.02,black);box(0,.13,.36,1,.04,.28,steel);
      for(const x of [-.25,.25]){cylinder(x,.60,.4,.09,.12,steel);box(x,.56,.47,.05,.025,.10,dark);cylinder(x,.24,.35,.09,.16,material('#e9e5d9',0,.4))}box(0,.72,.48,.25,.06,.012,black);break;
    }
    case 'microwave': {
      box(0,.5,0,1,1,1,paint,true);box(-.08,.5,.48,.73,.78,.025,dark,true);box(-.08,.5,.497,.60,.60,.008,black);handle(.24,.5,.50,.48);box(.39,.72,.495,.12,.15,.008,black);
      const dial=cylinder(.39,.3,.495,.055,.015,steel);dial.rotation.x=Math.PI/2;break;
    }
    case 'rice-cooker': {
      cylinder(0,.44,0,.44,.75,paint);cylinder(0,.84,0,.47,.06,dark);cylinder(0,.89,0,.46,.05,steel);box(0,.95,0,.3,.08,.13,dark,true);
      for(const x of [-.47,.47])box(x,.55,0,.06,.08,.30,dark,true);box(0,.25,.43,.25,.16,.04,black,true);break;
    }

  }
  // Dispose unused materials too (each model owns its materials).
  const used=new Set<T.Material>();root.traverse(o=>{if(o instanceof T.Mesh)used.add(o.material as T.Material)});
  [steel,dark,rubber,paint,wood,black,inside,glass].forEach(m=>{if(!used.has(m))m.dispose()});
  const bounds=new T.Box3().setFromObject(root),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
  root.children.forEach(child=>{child.position.x-=center.x;child.position.y-=bounds.min.y;child.position.z-=center.z});
  root.scale.set(item.w/1000/size.x,item.h/1000/size.y,item.d/1000/size.z);return root;
}

// Models own their materials; fade each shared material only once.
export function fadeFurniture(model:T.Object3D){const materials=new Set<T.Material>();model.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=false;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)}});for(const m of materials){m.transparent=true;m.opacity*=.25;m.depthWrite=false}}
