/**
 * 大纲状态管理 Hook
 * 
 * 基于 Reducer 模式的工作区状态管理
 */

import { useReducer, useCallback } from 'react';
import type {
  OutlineDocumentContent,
  Outline,
  FilterState,
  TagIndex,
  OutlineNode,
} from '../types';
import {
  buildTagIndex,
  extractAllNodes,
  createEmptyOutline,
  generateId,
} from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// 状态定义
// ═══════════════════════════════════════════════════════════════════════════════

export interface OutlineWorkspaceState {
  // 数据
  data: OutlineDocumentContent;
  activeOutlineId: string;

  // 视图
  viewMode: 'outline' | 'mindmap';
  isFocusMode: boolean;
  focusNodeId: string | null;

  // 选择
  selectedNodeIds: Set<string>;
  activeNodeId: string | null;

  // 过滤
  filterState: FilterState;
  tagIndex: TagIndex;

  // 搜索
  searchQuery: string;
  searchMatches: Set<string>;

  // UI
  isLeftSidebarOpen: boolean;
  isAISidebarOpen: boolean;

  // 历史
  undoStack: OutlineDocumentContent[];
  redoStack: OutlineDocumentContent[];
  canUndo: boolean;
  canRedo: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Action 定义
// ═══════════════════════════════════════════════════════════════════════════════

type OutlineWorkspaceAction =
  // 数据操作
  | { type: 'SET_DATA'; payload: OutlineDocumentContent }
  | { type: 'UPDATE_OUTLINE'; payload: { outlineId: string; updater: (outline: Outline) => Outline } }
  | { type: 'SWITCH_OUTLINE'; payload: string }
  | { type: 'CREATE_OUTLINE'; payload?: string }
  | { type: 'DELETE_OUTLINE'; payload: string }
  | { type: 'RENAME_OUTLINE'; payload: { outlineId: string; title: string } }

  // 节点选择
  | { type: 'SELECT_NODE'; payload: { nodeId: string; multi: boolean } }
  | { type: 'ACTIVATE_NODE'; payload: string | null }
  | { type: 'CLEAR_SELECTION' }

  // 过滤
  | { type: 'SET_FILTER'; payload: Partial<FilterState> }
  | { type: 'CLEAR_FILTERS' }

  // 视图
  | { type: 'SET_VIEW_MODE'; payload: 'outline' | 'mindmap' }
  | { type: 'ENTER_FOCUS_MODE'; payload: string }
  | { type: 'EXIT_FOCUS_MODE' }
  | { type: 'TOGGLE_LEFT_SIDEBAR' }
  | { type: 'TOGGLE_AI_SIDEBAR' }

  // 历史
  | { type: 'UNDO' }
  | { type: 'REDO' }

  // 搜索
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'CLEAR_SEARCH' };

// ═══════════════════════════════════════════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_HISTORY = 50;

function buildTagIndexFromData(data: OutlineDocumentContent): TagIndex {
  const allNodes = data.outlines.flatMap((o) => extractAllNodes(o.nodes));
  return buildTagIndex(allNodes);
}

export function outlineWorkspaceReducer(
  state: OutlineWorkspaceState,
  action: OutlineWorkspaceAction
): OutlineWorkspaceState {
  switch (action.type) {
    case 'SET_DATA': {
      return {
        ...state,
        data: action.payload,
        tagIndex: buildTagIndexFromData(action.payload),
      };
    }

    case 'UPDATE_OUTLINE': {
      const newData = {
        ...state.data,
        outlines: state.data.outlines.map((o) =>
          o.id === action.payload.outlineId
            ? action.payload.updater(o)
            : o
        ),
        updatedAt: new Date().toISOString(),
      };

      // 更新历史栈
      const newUndoStack = state.canUndo
        ? [...state.undoStack, state.data].slice(-MAX_HISTORY)
        : [...state.undoStack.slice(1), state.data].slice(-MAX_HISTORY);

      return {
        ...state,
        data: newData,
        tagIndex: buildTagIndexFromData(newData),
        undoStack: newUndoStack,
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    }

    case 'SWITCH_OUTLINE': {
      return {
        ...state,
        data: {
          ...state.data,
          activeOutlineId: action.payload,
        },
        selectedNodeIds: new Set(),
        activeNodeId: null,
        searchMatches: new Set(),
      };
    }

    case 'CREATE_OUTLINE': {
      const newOutline = createEmptyOutline(action.payload);
      const newData = {
        ...state.data,
        outlines: [...state.data.outlines, newOutline],
        activeOutlineId: newOutline.id,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...state,
        data: newData,
        selectedNodeIds: new Set(),
        activeNodeId: null,
        tagIndex: buildTagIndexFromData(newData),
      };
    }

    case 'DELETE_OUTLINE': {
      if (state.data.outlines.length <= 1) {
        return state; // 不能删除最后一个大纲
      }

      const newOutlines = state.data.outlines.filter(
        (o) => o.id !== action.payload
      );
      const newData = {
        ...state.data,
        outlines: newOutlines,
        activeOutlineId:
          state.data.activeOutlineId === action.payload
            ? newOutlines[0]?.id
            : state.data.activeOutlineId,
        updatedAt: new Date().toISOString(),
      };

      return {
        ...state,
        data: newData,
        tagIndex: buildTagIndexFromData(newData),
      };
    }

    case 'RENAME_OUTLINE': {
      const newData = {
        ...state.data,
        outlines: state.data.outlines.map((o) =>
          o.id === action.payload.outlineId
            ? { ...o, title: action.payload.title }
            : o
        ),
        updatedAt: new Date().toISOString(),
      };

      return {
        ...state,
        data: newData,
      };
    }

    case 'SELECT_NODE': {
      const { nodeId, multi } = action.payload;
      if (multi) {
        const newSelected = new Set(state.selectedNodeIds);
        if (newSelected.has(nodeId)) {
          newSelected.delete(nodeId);
        } else {
          newSelected.add(nodeId);
        }
        return {
          ...state,
          selectedNodeIds: newSelected,
        };
      }
      return {
        ...state,
        selectedNodeIds: new Set([nodeId]),
        activeNodeId: nodeId,
      };
    }

    case 'ACTIVATE_NODE': {
      return {
        ...state,
        activeNodeId: action.payload,
      };
    }

    case 'CLEAR_SELECTION': {
      return {
        ...state,
        selectedNodeIds: new Set(),
      };
    }

    case 'SET_FILTER': {
      return {
        ...state,
        filterState: { ...state.filterState, ...action.payload },
      };
    }

    case 'CLEAR_FILTERS': {
      return {
        ...state,
        filterState: {
          selectedTags: new Set(),
          selectedMentions: new Set(),
          searchQuery: '',
        },
        searchQuery: '',
        searchMatches: new Set(),
      };
    }

    case 'SET_VIEW_MODE': {
      return {
        ...state,
        viewMode: action.payload,
      };
    }

    case 'ENTER_FOCUS_MODE': {
      return {
        ...state,
        isFocusMode: true,
        focusNodeId: action.payload,
        selectedNodeIds: new Set(),
      };
    }

    case 'EXIT_FOCUS_MODE': {
      return {
        ...state,
        isFocusMode: false,
        focusNodeId: null,
      };
    }

    case 'TOGGLE_LEFT_SIDEBAR': {
      return {
        ...state,
        isLeftSidebarOpen: !state.isLeftSidebarOpen,
      };
    }

    case 'TOGGLE_AI_SIDEBAR': {
      return {
        ...state,
        isAISidebarOpen: !state.isAISidebarOpen,
      };
    }

    case 'UNDO': {
      if (state.undoStack.length === 0) return state;
      const prevData = state.undoStack[state.undoStack.length - 1];
      return {
        ...state,
        data: prevData,
        tagIndex: buildTagIndexFromData(prevData),
        undoStack: state.undoStack.slice(0, -1),
        redoStack: [state.data, ...state.redoStack],
        canUndo: state.undoStack.length > 1,
        canRedo: true,
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) return state;
      const nextData = state.redoStack[0];
      return {
        ...state,
        data: nextData,
        tagIndex: buildTagIndexFromData(nextData),
        undoStack: [...state.undoStack, state.data],
        redoStack: state.redoStack.slice(1),
        canUndo: true,
        canRedo: state.redoStack.length > 1,
      };
    }

    case 'SET_SEARCH_QUERY': {
      return {
        ...state,
        searchQuery: action.payload,
      };
    }

    case 'CLEAR_SEARCH': {
      return {
        ...state,
        searchQuery: '',
        searchMatches: new Set(),
      };
    }

    default:
      return state;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

export function useOutlineReducer(initialData: OutlineDocumentContent) {
  const initialState: OutlineWorkspaceState = {
    data: initialData,
    activeOutlineId: initialData.activeOutlineId,
    viewMode: 'outline',
    isFocusMode: false,
    focusNodeId: null,
    selectedNodeIds: new Set(),
    activeNodeId: null,
    filterState: {
      selectedTags: new Set(),
      selectedMentions: new Set(),
      searchQuery: '',
    },
    tagIndex: buildTagIndexFromData(initialData),
    searchQuery: '',
    searchMatches: new Set(),
    isLeftSidebarOpen: true,
    isAISidebarOpen: false,
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  };

  const [state, dispatch] = useReducer(outlineWorkspaceReducer, initialState);

  // 动作创建器
  const actions = {
    setData: useCallback(
      (data: OutlineDocumentContent) => dispatch({ type: 'SET_DATA', payload: data }),
      []
    ),

    updateOutline: useCallback(
      (outlineId: string, updater: (outline: Outline) => Outline) =>
        dispatch({ type: 'UPDATE_OUTLINE', payload: { outlineId, updater } }),
      []
    ),

    switchOutline: useCallback(
      (outlineId: string) => dispatch({ type: 'SWITCH_OUTLINE', payload: outlineId }),
      []
    ),

    createOutline: useCallback(
      (title?: string) => dispatch({ type: 'CREATE_OUTLINE', payload: title }),
      []
    ),

    deleteOutline: useCallback(
      (outlineId: string) => dispatch({ type: 'DELETE_OUTLINE', payload: outlineId }),
      []
    ),

    renameOutline: useCallback(
      (outlineId: string, title: string) =>
        dispatch({ type: 'RENAME_OUTLINE', payload: { outlineId, title } }),
      []
    ),

    selectNode: useCallback(
      (nodeId: string, multi: boolean) =>
        dispatch({ type: 'SELECT_NODE', payload: { nodeId, multi } }),
      []
    ),

    activateNode: useCallback(
      (nodeId: string | null) => dispatch({ type: 'ACTIVATE_NODE', payload: nodeId }),
      []
    ),

    clearSelection: useCallback(
      () => dispatch({ type: 'CLEAR_SELECTION' }),
      []
    ),

    setFilter: useCallback(
      (filter: Partial<FilterState>) => dispatch({ type: 'SET_FILTER', payload: filter }),
      []
    ),

    clearFilters: useCallback(
      () => dispatch({ type: 'CLEAR_FILTERS' }),
      []
    ),

    setViewMode: useCallback(
      (mode: 'outline' | 'mindmap') => dispatch({ type: 'SET_VIEW_MODE', payload: mode }),
      []
    ),

    enterFocusMode: useCallback(
      (nodeId: string) => dispatch({ type: 'ENTER_FOCUS_MODE', payload: nodeId }),
      []
    ),

    exitFocusMode: useCallback(
      () => dispatch({ type: 'EXIT_FOCUS_MODE' }),
      []
    ),

    toggleLeftSidebar: useCallback(
      () => dispatch({ type: 'TOGGLE_LEFT_SIDEBAR' }),
      []
    ),

    toggleAISidebar: useCallback(
      () => dispatch({ type: 'TOGGLE_AI_SIDEBAR' }),
      []
    ),

    undo: useCallback(
      () => dispatch({ type: 'UNDO' }),
      []
    ),

    redo: useCallback(
      () => dispatch({ type: 'REDO' }),
      []
    ),

    setSearchQuery: useCallback(
      (query: string) => dispatch({ type: 'SET_SEARCH_QUERY', payload: query }),
      []
    ),

    clearSearch: useCallback(
      () => dispatch({ type: 'CLEAR_SEARCH' }),
      []
    ),
  };

  return { state, dispatch, actions };
}
