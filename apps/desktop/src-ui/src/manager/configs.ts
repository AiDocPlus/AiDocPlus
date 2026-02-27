import type { ResourceTypeConfig } from '@aidocplus/manager-shared';
import type { ComponentType } from 'react';
import type { EditorPanelProps } from '@aidocplus/manager-shared';
import { PromptTemplateEditor } from './panels/PromptTemplateEditor';
import { DocTemplateEditor } from './panels/DocTemplateEditor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isDevMode = !!(import.meta as any).env?.DEV;

// ============================================================
// 资源类型标识
// ============================================================

export type ResourceTypeKey =
  | 'prompt-templates'
  | 'doc-templates'
;

// ============================================================
// 资源类型元信息（用于切换栏显示）
// ============================================================

export interface ResourceTypeMeta {
  key: ResourceTypeKey;
  label: string;
  icon: string;
  config: ResourceTypeConfig<ComponentType<EditorPanelProps>>;
  /** 默认数据目录子路径（相对于 ~/AiDocPlus/），null 表示需要外部传入 */
  dataDirSuffix: string | null;
}

// ============================================================
// 资源类型配置
// ============================================================

const promptTemplatesConfig: ResourceTypeConfig<ComponentType<EditorPanelProps>> = {
  appTitle: '提示词模板管理器',
  resourceType: 'prompt-template',
  resourceLabel: '提示词模板',
  defaultDataDir: isDevMode ? '/Users/jdh/Code/AiDocPlus-PromptTemplates/data' : '',
  repoDir: isDevMode ? '/Users/jdh/Code/AiDocPlus-PromptTemplates' : undefined,
  dataMode: 'json-file',
  contentFiles: [
    { filename: 'content.md', type: 'markdown', label: '提示词内容', defaultContent: '# 提示词模板\n\n请在此输入提示词内容...' },
  ],
  extraManifestFields: [],
  CustomEditorPanel: PromptTemplateEditor,
  defaultManifest: { resourceType: 'prompt-template', version: '1.0.0', author: 'AiDocPlus', enabled: true, source: isDevMode ? 'builtin' : 'custom', tags: [], order: 0 },
  aiGenerate: {
    systemPromptTemplate: `你是一个提示词模板创建专家。用户会描述他们想要的提示词模板，你需要生成完整的资源。
每个提示词模板包含一个 manifest（元数据）和一个 content.md（提示词正文，Markdown 格式）。
content.md 应包含详细的提示词模板内容，结构清晰，可直接使用。`,
    outputFiles: ['manifest.json', 'content.md'],
    exampleResources: ['academic-abstract', 'code-review'],
  },
};

const docTemplatesConfig: ResourceTypeConfig<ComponentType<EditorPanelProps>> = {
  appTitle: '文档模板管理器',
  resourceType: 'doc-template',
  resourceLabel: '文档模板',
  defaultDataDir: isDevMode ? '/Users/jdh/Code/AiDocPlus-DocTemplates/dist/json' : '',
  repoDir: isDevMode ? '/Users/jdh/Code/AiDocPlus-DocTemplates' : undefined,
  dataMode: 'json-file',
  contentFiles: [
    { filename: 'content.json', type: 'json', label: '模板内容', defaultContent: JSON.stringify({ authorNotes: '', content: '' }, null, 2) },
  ],
  extraManifestFields: [],
  CustomEditorPanel: DocTemplateEditor,
  defaultManifest: { resourceType: 'doc-template', version: '1.0.0', author: 'AiDocPlus', enabled: true, source: isDevMode ? 'builtin' : 'custom', tags: [], order: 0 },
  aiGenerate: {
    systemPromptTemplate: `你是一个文档模板/PPT主题创建专家。用户会描述他们想要的模板或主题，你需要生成完整的资源。
每个文档模板包含一个 manifest（元数据）和一个 content.json（模板内容）。
对于文档模板：content.json 格式为 { "authorNotes": "作者备注", "content": "模板正文内容" }，majorCategory 可选：report/article/email-draft/meeting/creative/technical/general。
对于 PPT 主题：content.json 格式为 { "primaryColor": "#hex", "fontFamily": "字体名" }，majorCategory 为 "ppt-theme"。
manifest 中应包含 i18n 字段提供英文翻译。`,
    outputFiles: ['manifest.json', 'content.json'],
    exampleResources: ['doc-work-summary', 'business-blue'],
  },
};


// ============================================================
// 所有资源类型列表（用于切换栏）
// ============================================================

export const ALL_RESOURCE_TYPES: ResourceTypeMeta[] = [
  { key: 'prompt-templates',   label: '提示词模板', icon: '📝', config: promptTemplatesConfig,  dataDirSuffix: null },
  { key: 'doc-templates',      label: '文档模板',   icon: '📑', config: docTemplatesConfig,     dataDirSuffix: 'DocTemplates' },
];

export function getResourceTypeMeta(key: string): ResourceTypeMeta | undefined {
  return ALL_RESOURCE_TYPES.find((t) => t.key === key);
}
