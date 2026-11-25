import { create } from 'zustand';
import type { UnderlayFrame } from './underlayFrame';

type UnderlayFrameStore = {
  projectId: string | null;
  frame: UnderlayFrame | null;
  start: (projectId: string, frame: UnderlayFrame) => void;
  update: (frame: UnderlayFrame) => void;
  clear: () => void;
};

export const useUnderlayFrame = create<UnderlayFrameStore>(set => ({
  projectId: null,
  frame: null,
  start: (projectId, frame) => set({ projectId, frame }),
  update: frame => set(state => (state.frame ? { frame } : state)),
  clear: () => set({ projectId: null, frame: null }),
}));
