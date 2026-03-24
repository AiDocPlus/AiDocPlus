/**
 * useEssaySelection.ts — 散文选中文本管理 Hook
 *
 * Phase 6: 选中文本浮动工具栏
 * - 监听编辑器选中文本
 * - 计算选区位置
 * - 管理浮动工具栏显示
 * - 处理选中文本操作
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { MaterialType, ParagraphRole } from './types';

interface SelectionRange {
  start: number;
  end: number;
  text: string;
  paragraphId?: string;
}

interface SelectionPosition {
  x: number;
  y: number;
}

export interface EssaySelectionActions {
  onAnalyzeSelection: (text: string) => void;
  onAddMaterial: (text: string, type: MaterialType) => void;
  onAnnotateRhetoric: (range: { start: number; end: number }, type: string) => void;
  onMarkParagraphRole: (paragraphId: string, role: ParagraphRole) => void;
  onFormatText: (range: { start: number; end: number }, format: string) => void;
  onSearchSimilar: (text: string) => void;
}

export function useEssaySelection(actions: EssaySelectionActions) {
  const [selection, setSelection] = useState<SelectionRange | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<SelectionPosition | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const editorRef = useRef<HTMLElement | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 设置编辑器引用
  const setEditorRef = useCallback((element: HTMLElement | null) => {
    editorRef.current = element;
  }, []);

  // 获取选中文本信息
  const getSelectionInfo = useCallback((): SelectionRange | null => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const text = range.toString().trim();
    
    if (!text) return null;

    // 获取选区在文档中的位置
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    // 尝试获取段落ID（如果选区在段落内）
    let paragraphId: string | undefined;
    let container: Node | null = range.startContainer;
    
    while (container && container !== editorRef.current) {
      if (container instanceof HTMLElement && container.dataset.paragraphId) {
        paragraphId = container.dataset.paragraphId;
        break;
      }
      container = container.parentElement;
    }

    return {
      start: startOffset,
      end: endOffset,
      text,
      paragraphId,
    };
  }, []);

  // 计算工具栏位置
  const calculateToolbarPosition = useCallback((range: Range): SelectionPosition => {
    const rect = range.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // 默认位置：选区上方
    let x = rect.left + scrollX;
    let y = rect.top + scrollY - 50; // 工具栏高度约40px，留10px间距

    // 如果选区在视窗顶部，工具栏显示在下方
    if (rect.top < 60) {
      y = rect.bottom + scrollY + 10;
    }

    // 水平居中
    x = x + rect.width / 2 - 200; // 工具栏宽度约400px

    return { x, y };
  }, []);

  // 处理选中文本变化
  const handleSelectionChange = useCallback(() => {
    // 清除之前的隐藏定时器
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    const selectionInfo = getSelectionInfo();
    
    if (selectionInfo) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const position = calculateToolbarPosition(range);
        
        setSelection(selectionInfo);
        setToolbarPosition(position);
        setShowToolbar(true);
      }
    } else {
      // 延迟隐藏，避免闪烁
      hideTimeoutRef.current = setTimeout(() => {
        setShowToolbar(false);
        setSelection(null);
        setToolbarPosition(null);
      }, 100);
    }
  }, [getSelectionInfo, calculateToolbarPosition]);

  // 监听选中文本事件
  useEffect(() => {
    const handleMouseUp = () => {
      // 延迟处理，确保选区稳定
      setTimeout(handleSelectionChange, 10);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // 处理键盘选区
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
          e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
          (e.shiftKey && (e.key === 'Home' || e.key === 'End'))) {
        setTimeout(handleSelectionChange, 10);
      }
    };

    const handleClick = () => {
      // 点击时隐藏工具栏
      setTimeout(() => {
        const selectionInfo = getSelectionInfo();
        if (!selectionInfo) {
          setShowToolbar(false);
          setSelection(null);
          setToolbarPosition(null);
        }
      }, 10);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClick);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('selectionchange', handleSelectionChange);
      
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [handleSelectionChange, getSelectionInfo]);

  // 工具栏操作处理
  const handleAnalyzeSelection = useCallback((text: string) => {
    actions.onAnalyzeSelection(text);
  }, [actions]);

  const handleAddMaterial = useCallback((text: string, type: MaterialType) => {
    actions.onAddMaterial(text, type);
  }, [actions]);

  const handleAnnotateRhetoric = useCallback((range: { start: number; end: number }, type: string) => {
    actions.onAnnotateRhetoric(range, type);
  }, [actions]);

  const handleMarkParagraphRole = useCallback((paragraphId: string, role: ParagraphRole) => {
    actions.onMarkParagraphRole(paragraphId, role);
  }, [actions]);

  const handleFormatText = useCallback((range: { start: number; end: number }, format: string) => {
    actions.onFormatText(range, format);
  }, [actions]);

  const handleSearchSimilar = useCallback((text: string) => {
    actions.onSearchSimilar(text);
  }, [actions]);

  // 关闭工具栏
  const closeToolbar = useCallback(() => {
    setShowToolbar(false);
    setSelection(null);
    setToolbarPosition(null);
  }, []);

  // 清除选区
  const clearSelection = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    closeToolbar();
  }, [closeToolbar]);

  return {
    // 状态
    selection,
    toolbarPosition,
    showToolbar,
    
    // 方法
    setEditorRef,
    closeToolbar,
    clearSelection,
    
    // 操作处理
    handleAnalyzeSelection,
    handleAddMaterial,
    handleAnnotateRhetoric,
    handleMarkParagraphRole,
    handleFormatText,
    handleSearchSimilar,
  };
}
