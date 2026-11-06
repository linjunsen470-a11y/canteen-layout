import { Item } from './model';

// One leaf definition drives the plan symbol, 3D pivots and swing checks.
export function doorLeaves(item: Pick<Item, 'w' | 'model' | 'hingeRight'>) {
  if (item.model === 'double-door') return [
    { hinge: -item.w / 2, direction: 1, width: item.w / 2 },
    { hinge: item.w / 2, direction: -1, width: item.w / 2 },
  ];
  return [{ hinge: item.hingeRight ? item.w / 2 : -item.w / 2, direction: item.hingeRight ? -1 : 1, width: item.w }];
}
