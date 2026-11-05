import { Item } from './model';
export const isAnnotation=(i:Pick<Item,'kind'>)=>['text','dimension','leader'].includes(i.kind);
