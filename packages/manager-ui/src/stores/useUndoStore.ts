import { create } from 'zustand';
import type { ResourceItem } from '@aidocplus/manager-shared';

const MAX_STACK_SIZE = 50;

interface UndoStoreState {
  undoStack: ResourceItem[];
  redoStack: ResourceItem[];
  canUndo: () => boolean;
  canRedo: () => boolean;
  pushUndo: (snapshot: ResourceItem) => void;
  undo: () => ResourceItem | null;
  redo: () => ResourceItem | null;
  clearStacks: () => void;
}

export const useUndoStore = create<UndoStoreState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  pushUndo: (snapshot) =>
    set((state) => {
      const stack = [...state.undoStack, snapshot];
      if (stack.length > MAX_STACK_SIZE) stack.shift();
      return { undoStack: stack, redoStack: [] };
    }),

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const snapshot = undoStack[undoStack.length - 1];
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, snapshot],
    }));
    return snapshot;
  },

  redo: () => {
    const { redoStack } = get();
    if (redoStack.length === 0) return null;
    const snapshot = redoStack[redoStack.length - 1];
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, snapshot],
    }));
    return snapshot;
  },

  clearStacks: () => set({ undoStack: [], redoStack: [] }),
}));
