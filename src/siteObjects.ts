import * as T from 'three';
import { Item } from './model';
export const pointTypes={entrance:'入口',exhaust:'排烟',water:'上水',drain:'下水',power:'电力'} as const;
export const pointGlyphs={entrance:'→',exhaust:'↑',water:'W',drain:'D',power:'E'} as const;
export const isSiteObject=(i:Pick<Item,'kind'>)=>['column','fixture','utility'].includes(i.kind);
export function siteObjectModel(i:Pick<Item,'kind'|'w'|'d'|'h'|'color'|'pointType'|'verification'>){
 const g=new T.Group(),height=Math.max(i.h,10)/1000,mat=new T.MeshStandardMaterial({color:i.color,roughness:.85});
 const box=new T.Mesh(new T.BoxGeometry(i.w/1000,height,i.d/1000),mat);box.position.y=height/2;box.castShadow=true;box.receiveShadow=true;g.add(box);
 if(i.kind==='utility'){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d')!;c.fillStyle=i.color;c.fillRect(0,0,128,128);c.strokeStyle='#ffffff';c.lineWidth=5;c.strokeRect(5,5,118,118);c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.font='bold 70px sans-serif';c.fillText(pointGlyphs[i.pointType??'power'],64,65);if(i.verification!=='confirmed'){c.fillStyle='#ffe1a4';c.font='bold 26px sans-serif';c.fillText('?',108,20)}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;g.userData.ownedTextures=[texture];const label=new T.Mesh(new T.PlaneGeometry(i.w/1000,i.d/1000),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide}));label.rotation.x=-Math.PI/2;label.position.y=height+.001;g.add(label);
 }
 return g;
}
