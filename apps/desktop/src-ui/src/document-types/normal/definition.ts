/**
 * normal 文档类型定义 — 通用文档（默认类型）
 * 100% 保留现有功能：EditorPanel + ChatPanel + 插件系统
 */
import { lazy } from 'react';
import { FileText } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

export const normalDocType: DocTypeDefinition = {
  id: 'normal',
  version: '1.0.0',
  labelKey: 'docType.normal',
  descriptionKey: 'docType.normalDesc',
  icon: FileText,
  category: 'writing',

  EditorComponent: lazy(() => import('./NormalEditor')),
  layoutMode: 'standard',
  supportsPlugins: true,

  createEmptyContent: () => '',
  extractPlainText: (content) => content,
};
