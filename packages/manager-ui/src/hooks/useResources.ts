import { invoke } from '@tauri-apps/api/core';
import type {
  ResourceSummary,
  ManifestBase,
  ContentFileSpec,
  ResourceItem,
} from '@aidocplus/manager-shared';
import { useResourceStore } from '../stores/useResourceStore';

/**
 * 加载资源列表
 */
export async function loadResources(dataDir: string): Promise<void> {
  const store = useResourceStore.getState();
  store.setLoading(true);
  store.setError(null);
  try {
    const resources = await invoke<ResourceSummary[]>('cmd_scan_resources', {
      dataDir,
    });
    store.setResources(resources);
  } catch (e) {
    store.setError(String(e));
  } finally {
    store.setLoading(false);
  }
}

/**
 * 加载单个资源的完整数据（manifest + 内容文件）
 */
export async function loadResourceDetail(
  resourcePath: string,
  contentFileSpecs: ContentFileSpec[]
): Promise<ResourceItem> {
  const manifest = await invoke<ManifestBase>('cmd_read_manifest', {
    resourcePath,
  });

  const contentFiles: Record<string, string> = {};
  for (const spec of contentFileSpecs) {
    const filePath = `${resourcePath}/${spec.filename}`;
    try {
      const content = await invoke<string>('cmd_read_content_file', {
        filePath,
      });
      contentFiles[spec.filename] = content;
    } catch {
      contentFiles[spec.filename] = spec.defaultContent;
    }
  }

  return {
    id: manifest.id,
    path: resourcePath,
    manifest,
    contentFiles,
    isDirty: false,
  };
}

/**
 * 保存资源（manifest + 内容文件）
 */
export async function saveResource(resource: ResourceItem): Promise<void> {
  // 更新 updatedAt
  const manifest = {
    ...resource.manifest,
    updatedAt: new Date().toISOString(),
  };

  await invoke('cmd_save_manifest', {
    resourcePath: resource.path,
    manifest,
  });

  // 保存内容文件
  for (const [filename, content] of Object.entries(resource.contentFiles)) {
    const filePath = `${resource.path}/${filename}`;
    await invoke('cmd_save_content_file', { filePath, content });
  }
}

/**
 * 创建新资源
 */
export async function createResource(
  dataDir: string,
  category: string,
  id: string,
  manifest: Record<string, unknown>,
  contentFiles: Array<{ filename: string; content: string }>
): Promise<string> {
  return await invoke<string>('cmd_create_resource', {
    dataDir,
    category,
    id,
    manifest,
    contentFiles,
  });
}

/**
 * 删除资源
 */
export async function deleteResource(resourcePath: string): Promise<void> {
  await invoke('cmd_delete_resource', { resourcePath });
}

/**
 * 重新排序
 */
export async function reorderResources(
  idOrderPairs: Array<[string, number]>
): Promise<void> {
  await invoke('cmd_reorder_resources', { idOrderPairs });
}

/**
 * 批量启用/禁用
 */
export async function batchSetEnabled(
  resourcePaths: string[],
  enabled: boolean
): Promise<number> {
  return await invoke<number>('cmd_batch_set_enabled', {
    resourcePaths,
    enabled,
  });
}

/**
 * 批量移动分类
 */
export async function batchMoveCategory(
  resourcePaths: string[],
  newCategory: string
): Promise<number> {
  return await invoke<number>('cmd_batch_move_category', {
    resourcePaths,
    newCategory,
  });
}

/**
 * 执行构建脚本
 */
export async function runBuildScript(repoDir: string): Promise<string> {
  return await invoke<string>('cmd_run_build_script', { repoDir });
}

// ============================================================
// JSON 文件模式（提示词模板等使用）
// ============================================================

export interface JsonResourceDetail {
  id: string;
  name: string;
  description: string;
  content: string;
  variables: string[];
  order: number;
  categoryKey: string;
  categoryName: string;
  authorNotes: string;
  tags: string[];
  aiGeneratedContent: string;
  enabledPlugins: string[];
  pluginData?: Record<string, unknown> | null;
  includeContent: boolean;
  includeAiContent: boolean;
}

/**
 * JSON 模式：加载资源列表
 */
export async function loadJsonResources(dataDir: string): Promise<void> {
  const store = useResourceStore.getState();
  store.setLoading(true);
  store.setError(null);
  try {
    const resources = await invoke<ResourceSummary[]>('cmd_scan_json_resources', {
      dataDir,
    });
    store.setResources(resources);
  } catch (e) {
    store.setError(String(e));
  } finally {
    store.setLoading(false);
  }
}

/**
 * JSON 模式：加载单个模板的完整数据
 */
export async function loadJsonResourceDetail(
  dataDir: string,
  categoryKey: string,
  templateId: string,
  contentFileSpecs: ContentFileSpec[]
): Promise<ResourceItem> {
  const detail = await invoke<JsonResourceDetail>('cmd_read_json_template', {
    dataDir,
    categoryKey,
    templateId,
  });

  // 适配为 ResourceItem 格式
  const manifest: ManifestBase & Record<string, unknown> = {
    id: detail.id,
    name: detail.name,
    description: detail.description,
    icon: '',
    version: '1.0.0',
    author: 'AiDocPlus',
    resourceType: 'prompt-template',
    majorCategory: detail.categoryKey,
    subCategory: '',
    tags: detail.tags || [],
    order: detail.order,
    enabled: true,
    source: 'builtin',
    createdAt: '',
    updatedAt: '',
    enabledPlugins: detail.enabledPlugins || [],
    pluginData: detail.pluginData || null,
    includeContent: detail.includeContent || false,
    includeAiContent: detail.includeAiContent || false,
  };

  const contentFiles: Record<string, string> = {};
  if (contentFileSpecs.length > 0) {
    const spec = contentFileSpecs[0];
    if (spec.filename === 'content.json') {
      // 文档模板：将所有内容字段组装为 JSON 对象
      contentFiles[spec.filename] = JSON.stringify({
        authorNotes: detail.authorNotes || '',
        content: detail.content || '',
        aiGeneratedContent: detail.aiGeneratedContent || '',
        pluginData: detail.pluginData || null,
      }, null, 2);
    } else {
      contentFiles[spec.filename] = detail.content;
    }
  }

  return {
    id: detail.id,
    path: `${detail.categoryKey}::${detail.id}`,
    manifest,
    contentFiles,
    isDirty: false,
  };
}

/**
 * JSON 模式：保存资源
 */
export async function saveJsonResource(
  dataDir: string,
  resource: ResourceItem,
  contentFileSpecs: ContentFileSpec[]
): Promise<void> {
  const categoryKey = resource.manifest.majorCategory;
  const m = resource.manifest as Record<string, unknown>;
  const spec = contentFileSpecs.length > 0 ? contentFileSpecs[0] : null;
  const rawContent = spec ? (resource.contentFiles[spec.filename] || '') : '';

  let content = rawContent;
  let authorNotes: string | null = null;
  let aiGeneratedContent: string | null = null;
  let pluginData: Record<string, unknown> | null = null;

  // 文档模板：从 content.json 中提取所有字段
  if (spec?.filename === 'content.json') {
    try {
      const parsed = JSON.parse(rawContent);
      content = parsed.content || '';
      authorNotes = parsed.authorNotes || '';
      aiGeneratedContent = parsed.aiGeneratedContent || '';
      pluginData = parsed.pluginData || null;
    } catch {
      // 解析失败时保持原样
    }
  }

  await invoke('cmd_save_json_template', {
    dataDir,
    categoryKey,
    templateId: resource.id,
    name: resource.manifest.name,
    description: resource.manifest.description || '',
    content,
    variables: m.variables || [],
    authorNotes,
    aiGeneratedContent,
    enabledPlugins: m.enabledPlugins || null,
    pluginData,
    includeContent: m.includeContent ?? null,
    includeAiContent: m.includeAiContent ?? null,
  });
}

/**
 * JSON 模式：创建新资源
 */
export async function createJsonResource(
  dataDir: string,
  category: string,
  id: string,
  manifest: Record<string, unknown>,
  contentFiles: Array<{ filename: string; content: string }>
): Promise<string> {
  const file = contentFiles.length > 0 ? contentFiles[0] : null;
  let content = file?.content || '';
  let authorNotes: string | null = null;
  let aiGeneratedContent: string | null = null;
  let pluginData: Record<string, unknown> | null = null;

  // 文档模板：从 content.json 中提取
  if (file?.filename === 'content.json') {
    try {
      const parsed = JSON.parse(content);
      content = parsed.content || '';
      authorNotes = parsed.authorNotes || '';
      aiGeneratedContent = parsed.aiGeneratedContent || '';
      pluginData = parsed.pluginData || null;
    } catch {
      // ignore
    }
  }

  return await invoke<string>('cmd_create_json_template', {
    dataDir,
    categoryKey: category,
    id,
    name: (manifest.name as string) || '',
    description: (manifest.description as string) || '',
    content,
    variables: (manifest.variables as string[]) || [],
    authorNotes,
    aiGeneratedContent,
    enabledPlugins: (manifest.enabledPlugins as string[]) || null,
    pluginData,
    includeContent: manifest.includeContent ?? null,
    includeAiContent: manifest.includeAiContent ?? null,
  });
}

/**
 * JSON 模式：删除资源
 */
export async function deleteJsonResource(dataDir: string, resourcePath: string): Promise<void> {
  const parts = resourcePath.split('::');
  if (parts.length !== 2) {
    throw new Error('无效的资源路径: ' + resourcePath);
  }
  await invoke('cmd_delete_json_template', {
    dataDir,
    categoryKey: parts[0],
    templateId: parts[1],
  });
}

/**
 * JSON 模式：批量删除
 */
export async function batchDeleteJsonResources(
  dataDir: string,
  paths: string[]
): Promise<number> {
  return await invoke<number>('cmd_batch_delete_json_templates', {
    dataDir,
    paths,
  });
}

/**
 * JSON 模式：批量移动分类
 */
export async function batchMoveJsonCategory(
  dataDir: string,
  resourcePaths: string[],
  newCategory: string
): Promise<number> {
  let count = 0;
  for (const path of resourcePaths) {
    const parts = path.split('::');
    if (parts.length !== 2) continue;
    await invoke('cmd_move_json_template', {
      dataDir,
      fromCategory: parts[0],
      templateId: parts[1],
      toCategory: newCategory,
    });
    count++;
  }
  return count;
}
