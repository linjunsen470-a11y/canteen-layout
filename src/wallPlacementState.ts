import { create } from 'zustand';

// UI-only state. Kept independent of store.ts so edit commands can guard a preview.
export type WallPlacementSession={itemId:string;wallId:string|null;side:1|-1;target:number|null;picking:boolean};
export const useWallPlacement=create<{session:WallPlacementSession|null;error:string|null}>(()=>({session:null,error:null}));
export function cancelWallPlacement(){useWallPlacement.setState({session:null,error:null})}
export const placementEditMessage='离墙定位进行中，请先确认落位或取消定位，再编辑其他内容';
