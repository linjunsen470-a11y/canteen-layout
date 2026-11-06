import { Item, ModelVariant, Point } from './model';

// Frozen v1 convention, independent of mutable catalog names/defaults.
// Plan +Y = model +Z. Both views rotate around the footprint centre.
export const facingModels = new Set<ModelVariant>(['stove','sink','single-sink','triple-sink','upright-fridge','steamer','sterilizer','worktable','buffet','chair']);
export const ordinaryEquipment = (i: Pick<Item,'kind'>) => ['table','chair','counter','sink','fridge','stove','shelf'].includes(i.kind);
export function operationFace(i: Pick<Item,'model'|'operationFace'>): 'positive-y'|'none' {
  return i.operationFace ?? (i.model && facingModels.has(i.model) ? 'positive-y' : 'none');
}
export function localPoint(i: Item, p: Point): Point {
  const a=i.rotation*Math.PI/180;
  return {x:i.x+i.w/2+p.x*Math.cos(a)-p.y*Math.sin(a),y:i.y+i.d/2+p.x*Math.sin(a)+p.y*Math.cos(a)};
}
export function frontEdge(i: Item) {
  return operationFace(i)==='none' ? null : [localPoint(i,{x:-i.w/2,y:i.d/2}),localPoint(i,{x:i.w/2,y:i.d/2})];
}
export function canvasDirection(vector:Point){
  const directions=['右侧','右下侧','下侧','左下侧','左侧','左上侧','上侧','右上侧'];
  return `画布${directions[(Math.round(Math.atan2(vector.y,vector.x)*4/Math.PI)+8)%8]}`;
}
export function facingDirection(i:Pick<Item,'rotation'|'model'|'operationFace'>){
  if(operationFace(i)==='none')return '未声明操作面';
  const a=i.rotation*Math.PI/180;
  return `操作侧朝${canvasDirection({x:-Math.sin(a),y:Math.cos(a)})}`;
}
