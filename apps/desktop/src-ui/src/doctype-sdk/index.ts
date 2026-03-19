/**
 * DocType SDK — 统一导出
 */

// 类型定义
export type {
  DocTypeDefinition,
  DocTypeCategory,
  DocTypeEditorProps,
  DocTypeAISidebarProps,
  DocTypeHostAPI,
  DocTypeAIAction,
  DocTypeExportFormat,
  ChatMessage,
  AIOptions,
  AIStreamOptions,
} from './types';

export { DOCTYPE_SDK_VERSION } from './types';

// 注册表
export {
  registerDocType,
  getDocType,
  getDocTypeOrDefault,
  listDocTypes,
  listDocTypesByCategory,
  hasDocType,
  unregisterDocType,
} from './registry';

// 宿主 API 工厂
export { createDocTypeHost } from './host';
export type { CreateDocTypeHostOptions } from './host';

// React Hooks
export { useDocTypeHost } from './hooks';
