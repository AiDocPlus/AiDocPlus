import { invoke } from '@tauri-apps/api/core';
import type { MetaConfig, CategoryDefinition } from '@aidocplus/manager-shared';
import { useResourceStore } from '../stores/useResourceStore';

/**
 * 加载分类（目录模式：从 _meta.json）
 */
export async function loadCategories(dataDir: string): Promise<void> {
  const store = useResourceStore.getState();
  try {
    const meta = await invoke<MetaConfig>('cmd_read_meta', { dataDir });
    store.setCategories(meta.categories);
  } catch (e) {
    console.error('加载分类失败:', e);
  }
}

/**
 * 保存分类（目录模式）
 */
export async function saveCategories(
  dataDir: string,
  meta: MetaConfig
): Promise<void> {
  await invoke('cmd_save_meta', { dataDir, meta });
  // 重新加载
  await loadCategories(dataDir);
}

/**
 * 加载分类（JSON 文件模式：从各 *.json 文件头部提取）
 */
export async function loadJsonCategories(dataDir: string): Promise<void> {
  const store = useResourceStore.getState();
  try {
    const categories = await invoke<CategoryDefinition[]>('cmd_read_json_categories', { dataDir });
    store.setCategories(categories);
  } catch (e) {
    console.error('加载 JSON 分类失败:', e);
  }
}

/**
 * 保存分类排序（JSON 文件模式：逐个更新各 .json 文件的 order 字段）
 */
export async function saveJsonCategories(
  dataDir: string,
  categories: CategoryDefinition[]
): Promise<void> {
  for (const cat of categories) {
    await invoke('cmd_save_json_category', {
      dataDir,
      categoryKey: cat.key,
      name: cat.name,
      icon: cat.icon ?? '📋',
      order: cat.order,
    });
  }
  // 重新加载
  await loadJsonCategories(dataDir);
}
