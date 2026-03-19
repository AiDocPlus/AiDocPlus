/**
 * DocType Registry — 文档类型注册表
 *
 * 管理所有已注册的文档类型定义。
 * 平台启动时注册内置类型，未来支持动态加载外部类型。
 */
import type { DocTypeDefinition } from './types';

/** 注册表存储 */
const registry = new Map<string, DocTypeDefinition>();

/**
 * 注册一个文档类型
 * @throws 如果 ID 已存在
 */
export function registerDocType(def: DocTypeDefinition): void {
  if (registry.has(def.id)) {
    console.warn(`[DocType Registry] Type "${def.id}" already registered, overwriting.`);
  }
  registry.set(def.id, def);
}

/**
 * 获取文档类型定义
 * @returns 定义对象，未找到时返回 undefined
 */
export function getDocType(id: string): DocTypeDefinition | undefined {
  return registry.get(id);
}

/**
 * 获取文档类型定义，未找到时回退到 'normal'
 */
export function getDocTypeOrDefault(id: string | undefined): DocTypeDefinition {
  const def = id ? registry.get(id) : undefined;
  if (def) return def;
  const normal = registry.get('normal');
  if (normal) return normal;
  throw new Error('[DocType Registry] "normal" type not registered');
}

/**
 * 列出所有已注册的文档类型
 */
export function listDocTypes(): DocTypeDefinition[] {
  return Array.from(registry.values());
}

/**
 * 列出指定分类的文档类型
 */
export function listDocTypesByCategory(category: string): DocTypeDefinition[] {
  return Array.from(registry.values()).filter(d => d.category === category);
}

/**
 * 检查文档类型是否已注册
 */
export function hasDocType(id: string): boolean {
  return registry.has(id);
}

/**
 * 注销文档类型（用于动态卸载）
 */
export function unregisterDocType(id: string): boolean {
  return registry.delete(id);
}
