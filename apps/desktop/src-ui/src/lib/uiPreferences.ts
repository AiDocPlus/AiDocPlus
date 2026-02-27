/**
 * UI 偏好设置持久化工具
 * 通过 Tauri 后端读写 ~/AiDocPlus/ui-preferences.json
 * Tauri 不可用时 fallback 到 localStorage
 */
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from './isTauri';

interface UIPreferences {
  projectOrder?: string[];
  docOrders?: Record<string, string[]>;
}

let cachedPrefs: UIPreferences | null = null;

/** 加载 UI 偏好设置 */
export async function loadUIPreferences(): Promise<UIPreferences> {
  if (cachedPrefs) return cachedPrefs;

  if (isTauri()) {
    try {
      const json = await invoke<string | null>('load_ui_preferences');
      if (json) {
        cachedPrefs = JSON.parse(json);
        // 清理 localStorage 残留
        localStorage.removeItem('aidoc-project-order');
        localStorage.removeItem('aidoc-doc-orders');
        return cachedPrefs!;
      }
    } catch { /* fallback */ }
  }

  // 从 localStorage 迁移
  const prefs: UIPreferences = {};
  try {
    const projectOrder = localStorage.getItem('aidoc-project-order');
    if (projectOrder) prefs.projectOrder = JSON.parse(projectOrder);
    const docOrders = localStorage.getItem('aidoc-doc-orders');
    if (docOrders) prefs.docOrders = JSON.parse(docOrders);
  } catch { /* ignore */ }

  // 迁移到 Tauri
  if (isTauri() && (prefs.projectOrder || prefs.docOrders)) {
    try {
      await invoke('save_ui_preferences', { json: JSON.stringify(prefs) });
      localStorage.removeItem('aidoc-project-order');
      localStorage.removeItem('aidoc-doc-orders');
    } catch { /* ignore */ }
  }

  cachedPrefs = prefs;
  return prefs;
}

/** 保存 UI 偏好设置 */
export async function saveUIPreferences(prefs: UIPreferences): Promise<void> {
  cachedPrefs = prefs;

  if (isTauri()) {
    try {
      await invoke('save_ui_preferences', { json: JSON.stringify(prefs) });
      return;
    } catch { /* fallback */ }
  }

  // fallback 到 localStorage
  if (prefs.projectOrder) {
    localStorage.setItem('aidoc-project-order', JSON.stringify(prefs.projectOrder));
  }
  if (prefs.docOrders) {
    localStorage.setItem('aidoc-doc-orders', JSON.stringify(prefs.docOrders));
  }
}

/** 更新项目排序 */
export async function saveProjectOrder(order: string[]): Promise<void> {
  const prefs = await loadUIPreferences();
  prefs.projectOrder = order;
  await saveUIPreferences(prefs);
}

/** 更新文档排序 */
export async function saveDocOrders(docOrders: Record<string, string[]>): Promise<void> {
  const prefs = await loadUIPreferences();
  prefs.docOrders = docOrders;
  await saveUIPreferences(prefs);
}
