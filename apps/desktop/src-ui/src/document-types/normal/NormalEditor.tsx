/**
 * NormalEditor — 通用文档编辑器（薄包装层）
 * 直接渲染现有的 EditorPanel，100% 保留现有功能。
 */
import type { DocTypeEditorProps } from '@/doctype-sdk/types';

export default function NormalEditor(_props: DocTypeEditorProps) {
  // 通过 CustomEvent 通知上层 DocumentWorkspace 使用原有 EditorWorkspace 渲染
  // NormalEditor 本身不渲染任何内容——它作为 layoutMode='standard' 类型，
  // 由 DocumentWorkspace 的标准布局路径处理（EditorPanel + ChatPanel）
  //
  // 这个组件是一个占位符，实际渲染逻辑在 DocumentWorkspace 中：
  // 当 layoutMode='standard' 且 supportsPlugins=true 时，
  // DocumentWorkspace 直接使用现有的 EditorWorkspace 组件。
  return null;
}
