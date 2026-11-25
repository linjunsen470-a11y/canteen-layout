import type { Item } from './model';

export const pointTypes = { entrance: '入口', exhaust: '排烟', water: '上水', drain: '下水', power: '电力' } as const;
export const pointGlyphs = { entrance: '→', exhaust: '↑', water: 'W', drain: 'D', power: 'E' } as const;
export const isSiteObject = (i: Pick<Item, 'kind'>) => ['column', 'fixture', 'utility'].includes(i.kind);
