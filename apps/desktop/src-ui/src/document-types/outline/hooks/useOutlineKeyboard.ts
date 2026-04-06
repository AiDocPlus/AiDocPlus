/**
 * 大纲快捷键 Hook
 *
 * 处理大纲编辑器的所有键盘快捷键
 */

import { useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { OutlineHeadingLevel } from '../types';

export interface OutlineKeyboardConfig {
  // 导航（焦点切换，不改变节点顺序）
  onNavigateUp?: () => boolean;
  onNavigateDown?: () => boolean;
  onMoveLeft?: () => boolean;
  onMoveRight?: () => boolean;

  // 节点移动（改变节点顺序）
  onMoveNodeUp?: () => boolean;
  onMoveNodeDown?: () => boolean;
  onMoveToTop?: () => boolean;
  onMoveToBottom?: () => boolean;

  // 编辑
  onAddSibling?: () => boolean;
  onAddChild?: () => boolean;
  onDeleteNode?: () => boolean;
  onDeleteIfEmpty?: () => boolean;
  onCloneNode?: () => boolean;
  onIndent?: () => boolean;
  onOutdent?: () => boolean;

  // 展开/折叠
  onToggleExpand?: () => boolean;
  onExpandAll?: () => boolean;
  onCollapseAll?: () => boolean;
  onCollapseToLevel?: (level: number) => boolean;

  // 格式化
  onToggleBold?: () => boolean;
  onToggleItalic?: () => boolean;
  onToggleUnderline?: () => boolean;
  onToggleStrike?: () => boolean;
  onCycleHighlight?: () => boolean;
  onSetHeading?: (level: OutlineHeadingLevel) => boolean;
  onClearFormat?: () => boolean;

  // 视图
  onEnterFocusMode?: () => boolean;
  onExitFocusMode?: () => boolean;
  onOpenSearch?: () => boolean;
  onCloseSearch?: () => boolean;
  onToggleMindMap?: () => boolean;

  // 历史
  onUndo?: () => boolean;
  onRedo?: () => boolean;

  // 多选
  onSelectAll?: () => boolean;
  onDeleteSelected?: () => boolean;

  // 导入导出
  onExport?: () => boolean;
  onImport?: () => boolean;

  // 备注
  onEditNote?: () => boolean;

  // 通用
  onEscape?: () => boolean;
}

export interface OutlineShortcuts {
  // 返回快捷键列表用于帮助提示
  getShortcutList: () => { key: string; action: string }[];
}

/**
 * 大纲快捷键 Hook
 */
/**
 * 焦点在节点正文编辑器内时，由 ProseMirrorNodeEditor → OutlineRow 处理 Enter/Tab 等；
 * window 层必须跳过，否则会与冒泡重复（同一键触发两次：编辑器内一次 + window 一次）。
 */
function isKeyEventFromOutlineNodeTextEditor(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!(
    target.closest('.prose-mirror-node-editor') ||
    target.closest('.ProseMirror') ||
    target.closest('.tiptap')
  );
}

export function useOutlineKeyboard(config: OutlineKeyboardConfig): OutlineShortcuts {
  const { t } = useTranslation();

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // IME 组字中禁止全局快捷键，避免拼音输入被打断
      if (e.isComposing || e.keyCode === 229) return;
      const config = configRef.current;
      const mod = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const fromNodeTextEditor = isKeyEventFromOutlineNodeTextEditor(e.target);

      // ==================== 导航 ====================

      if (e.key === 'ArrowUp' && !mod && !shift) {
        if (config.onNavigateUp?.()) {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'ArrowDown' && !mod && !shift) {
        if (config.onNavigateDown?.()) {
          e.preventDefault();
          return;
        }
      }

      // 左：折叠或移动到父节点
      if (e.key === 'ArrowLeft' && !mod && !shift) {
        if (config.onMoveLeft?.()) {
          e.preventDefault();
          return;
        }
      }

      // 右：展开或移动到第一个子节点
      if (e.key === 'ArrowRight' && !mod && !shift) {
        if (config.onMoveRight?.()) {
          e.preventDefault();
          return;
        }
      }

      // ==================== 编辑 ====================

      // Enter：新建同级节点
      if (e.key === 'Enter' && !mod && !shift && !alt) {
        if (fromNodeTextEditor) return;
        if (config.onAddSibling?.()) {
          e.preventDefault();
          return;
        }
      }

      // Tab：缩进
      if (e.key === 'Tab' && !mod && !shift) {
        if (fromNodeTextEditor) return;
        if (config.onIndent?.()) {
          e.preventDefault();
          return;
        }
      }

      // Shift+Tab：提升
      if (e.key === 'Tab' && !mod && shift) {
        if (fromNodeTextEditor) return;
        if (config.onOutdent?.()) {
          e.preventDefault();
          return;
        }
      }

      // Shift+Enter：编辑备注
      if (e.key === 'Enter' && shift && !mod) {
        if (fromNodeTextEditor) return;
        if (config.onEditNote?.()) {
          e.preventDefault();
          return;
        }
      }

      // Backspace（空内容时删除节点）- 仅在非编辑器焦点时处理
      if (e.key === 'Backspace' && !mod && !shift) {
        if (fromNodeTextEditor) return; // 编辑器内不拦截，由 ProseMirror 处理
        if (config.onDeleteIfEmpty?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+Backspace：强制删除节点
      if (e.key === 'Backspace' && mod && shift) {
        if (config.onDeleteNode?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+D：克隆节点
      if (e.key === 'd' && mod && !shift) {
        if (config.onCloneNode?.()) {
          e.preventDefault();
          return;
        }
      }

      // ==================== 移动节点 ====================

      // Ctrl+Shift+Up：上移节点
      if (e.key === 'ArrowUp' && mod && shift) {
        if (config.onMoveNodeUp?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+Down：下移节点
      if (e.key === 'ArrowDown' && mod && shift) {
        if (config.onMoveNodeDown?.()) {
          e.preventDefault();
          return;
        }
      }

      // ==================== 展开/折叠 ====================

      // Ctrl+.：切换展开
      if (e.key === '.' && mod && !shift) {
        if (config.onToggleExpand?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Alt+0：展开全部
      if (e.key === '0' && mod && alt && !shift) {
        if (config.onExpandAll?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Alt+1：折叠到第1层
      if (e.key === '1' && mod && alt && !shift) {
        if (config.onCollapseToLevel?.(1)) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Alt+2：折叠到第2层
      if (e.key === '2' && mod && alt && !shift) {
        if (config.onCollapseToLevel?.(2)) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Alt+3：折叠到第3层
      if (e.key === '3' && mod && alt && !shift) {
        if (config.onCollapseToLevel?.(3)) {
          e.preventDefault();
          return;
        }
      }

      // ==================== 格式化 ====================

      // Ctrl+B：加粗
      if (e.key === 'b' && mod && !shift) {
        if (config.onToggleBold?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+I：斜体
      if (e.key === 'i' && mod && !shift) {
        if (config.onToggleItalic?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+U：下划线
      if (e.key === 'u' && mod && !shift) {
        if (config.onToggleUnderline?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+S：删除线
      if (e.key === 's' && mod && shift) {
        if (config.onToggleStrike?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+H：切换高亮
      if (e.key === 'h' && mod && shift) {
        if (config.onCycleHighlight?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+1：设为标题1
      if (e.key === '1' && mod && shift) {
        if (config.onSetHeading?.(1)) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+2：设为标题2
      if (e.key === '2' && mod && shift) {
        if (config.onSetHeading?.(2)) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+3：设为标题3
      if (e.key === '3' && mod && shift) {
        if (config.onSetHeading?.(3)) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+0：清除标题
      if (e.key === '0' && mod && shift) {
        if (config.onSetHeading?.(0)) {
          e.preventDefault();
          return;
        }
      }

      // ==================== 视图 ====================

      // Ctrl+/：进入专注模式
      if (e.key === '/' && mod && !shift) {
        if (config.onEnterFocusMode?.()) {
          e.preventDefault();
          return;
        }
      }

      // Escape：退出专注模式/关闭搜索
      if (e.key === 'Escape') {
        if (config.onEscape?.() || config.onExitFocusMode?.() || config.onCloseSearch?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+F：打开搜索
      if (e.key === 'f' && mod && shift) {
        if (config.onOpenSearch?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+M：切换思维导图视图
      if (e.key === 'm' && mod && shift) {
        if (config.onToggleMindMap?.()) {
          e.preventDefault();
          return;
        }
      }

      // ==================== 历史 ====================

      // Ctrl+Z：撤销
      if (e.key === 'z' && mod && !shift) {
        if (config.onUndo?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+Z 或 Ctrl+Y：重做
      if ((e.key === 'z' && mod && shift) || (e.key === 'y' && mod && !shift)) {
        if (config.onRedo?.()) {
          e.preventDefault();
          return;
        }
      }

      // ==================== 多选 ====================

      // Ctrl+A：全选可见节点
      if (e.key === 'a' && mod && !shift) {
        if (config.onSelectAll?.()) {
          e.preventDefault();
          return;
        }
      }

      // Delete：删除选中节点
      if (e.key === 'Delete' && !mod && !shift) {
        if (config.onDeleteSelected?.()) {
          e.preventDefault();
          return;
        }
      }

      // ==================== 导入导出 ====================

      // Ctrl+Shift+E：导出
      if (e.key === 'e' && mod && shift) {
        if (config.onExport?.()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+Shift+I：导入
      if (e.key === 'i' && mod && shift) {
        if (config.onImport?.()) {
          e.preventDefault();
          return;
        }
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const getShortcutList = useCallback(
    () => [
      { key: '↑/↓', action: t('outline.shortcuts.navigate', { defaultValue: '上下移动' }) },
      { key: '←/→', action: t('outline.shortcuts.collapseExpand', { defaultValue: '折叠/展开' }) },
      { key: 'Enter', action: t('outline.shortcuts.addSibling', { defaultValue: '新建同级' }) },
      { key: 'Tab', action: t('outline.shortcuts.indent', { defaultValue: '缩进' }) },
      { key: 'Shift+Tab', action: t('outline.shortcuts.outdent', { defaultValue: '提升' }) },
      { key: 'Shift+Enter', action: t('outline.shortcuts.editNote', { defaultValue: '编辑备注' }) },
      { key: 'Backspace', action: t('outline.shortcuts.deleteEmpty', { defaultValue: '删除空节点' }) },
      { key: 'Ctrl+Shift+⌫', action: t('outline.shortcuts.deleteNode', { defaultValue: '强制删除' }) },
      { key: 'Ctrl+D', action: t('outline.shortcuts.clone', { defaultValue: '克隆节点' }) },
      { key: 'Ctrl+Shift+↑/↓', action: t('outline.shortcuts.moveNode', { defaultValue: '移动节点' }) },
      { key: 'Ctrl+.', action: t('outline.shortcuts.toggleExpand', { defaultValue: '切换展开' }) },
      { key: 'Ctrl+B', action: t('outline.shortcuts.bold', { defaultValue: '加粗' }) },
      { key: 'Ctrl+I', action: t('outline.shortcuts.italic', { defaultValue: '斜体' }) },
      { key: 'Ctrl+U', action: t('outline.shortcuts.underline', { defaultValue: '下划线' }) },
      { key: 'Ctrl+Shift+S', action: t('outline.shortcuts.strike', { defaultValue: '删除线' }) },
      { key: 'Ctrl+Shift+H', action: t('outline.shortcuts.highlight', { defaultValue: '高亮' }) },
      { key: 'Ctrl+Shift+1/2/3', action: t('outline.shortcuts.heading', { defaultValue: '标题级别' }) },
      { key: 'Ctrl+/', action: t('outline.shortcuts.focusMode', { defaultValue: '专注模式' }) },
      { key: 'Esc', action: t('outline.shortcuts.exitFocus', { defaultValue: '退出专注' }) },
      { key: 'Ctrl+Shift+F', action: t('outline.shortcuts.search', { defaultValue: '搜索' }) },
      { key: 'Ctrl+Z', action: t('outline.shortcuts.undo', { defaultValue: '撤销' }) },
      { key: 'Ctrl+Shift+Z', action: t('outline.shortcuts.redo', { defaultValue: '重做' }) },
      { key: 'Ctrl+A', action: t('outline.shortcuts.selectAll', { defaultValue: '全选' }) },
      { key: 'Ctrl+Shift+E', action: t('outline.shortcuts.export', { defaultValue: '导出' }) },
    ],
    [t]
  );

  return { getShortcutList };
}

export default useOutlineKeyboard;
