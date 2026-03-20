/**
 * 小说文档类型 — 共享常量
 *
 * 消除多个组件中重复定义的常量和接口
 */

import type { NovelChapter, NovelSceneType } from './types';

/** 对话框/弹窗统一样式 */
export const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

/** 统一 Storage 接口（host.storage 的抽象） */
export interface StorageLike {
  get<T>(key: string): T | null | undefined;
  set(key: string, value: unknown): void;
}

/** 章节状态选项 */
export const STATUS_OPTIONS: { value: NovelChapter['status']; label: string; color: string }[] = [
  { value: 'draft', label: '草稿', color: 'text-yellow-600' },
  { value: 'revised', label: '修订', color: 'text-blue-600' },
  { value: 'done', label: '完成', color: 'text-green-600' },
];

/** 颜色标签预设 */
export const COLOR_PRESETS = [
  { color: '#ef4444', label: '红' },
  { color: '#f97316', label: '橙' },
  { color: '#eab308', label: '黄' },
  { color: '#22c55e', label: '绿' },
  { color: '#3b82f6', label: '蓝' },
  { color: '#8b5cf6', label: '紫' },
  { color: '#ec4899', label: '粉' },
  { color: '#6b7280', label: '灰' },
];

/** 场景类型选项 */
export const SCENE_TYPES: { value: NovelSceneType; label: string }[] = [
  { value: 'action', label: '动作' },
  { value: 'dialogue', label: '对话' },
  { value: 'description', label: '描写' },
  { value: 'transition', label: '过渡' },
  { value: 'flashback', label: '闪回' },
];

/** 场景类型标签映射（用于显示） */
export const SCENE_TYPE_LABELS: Record<string, string> = {
  action: '动作', dialogue: '对话', description: '描写', transition: '过渡', flashback: '闪回',
};
