/**
 * 插件注册表底层存储（零依赖，打破循环引用）
 *
 * registry.ts 和各插件 index.ts 都依赖此模块，
 * 但此模块不依赖任何其他插件模块。
 */
import type { DocumentPlugin } from './types';

/** 动态插件注册表（运行时由各插件自注册填充） */
export const PLUGIN_MAP = new Map<string, DocumentPlugin>();

/** 插件自注册 API — 每个插件的 index.ts 在 import 时调用 */
export function registerPlugin(plugin: DocumentPlugin): void {
  PLUGIN_MAP.set(plugin.id, plugin);
}
