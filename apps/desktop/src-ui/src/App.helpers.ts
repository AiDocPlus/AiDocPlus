import type { UISettings } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';
import { registerFrontendStateProvider } from './api/ApiBridge';
import { useAppStore } from './stores/useAppStore';
import { getAIInvokeParams, useSettingsStore } from './stores/useSettingsStore';
import { useTemplatesStore } from './stores/useTemplatesStore';

type AppFrontendStateProvider = {
  getActiveDocument: () => { id: string; title: string; projectId: string; content: string } | null;
  getActiveProjectId: () => string | null;
  getAiConfig: () => ReturnType<typeof getAIInvokeParams>;
};

export async function loadAppBootstrapResources(): Promise<void> {
  // 关键路径：只加载插件注册表（影响 UI 渲染）
  await useAppStore.getState().loadPlugins();
}

/**
 * 延后加载非关键资源（模板数据），在 UI 可交互之后异步执行。
 * 这些数据仅在用户打开模板选择器 / 新建文档时才需要。
 */
export function loadDeferredResources(): void {
  Promise.all([
    useAppStore.getState().loadDocTemplates(),
    useAppStore.getState().loadDocTemplateCategories(),
    useTemplatesStore.getState().loadBuiltInTemplates(),
    useTemplatesStore.getState().loadBuiltInCategories(),
  ]).catch(e => {
    console.warn('[App] 延后资源加载失败:', e);
  });
}

export async function restoreAppBootstrapWorkspace(): Promise<void> {
  await useAppStore.getState().restoreWorkspace();
}

export async function fallbackLoadProjectsAfterBootstrapFailure(): Promise<void> {
  await useAppStore.getState().loadProjects();
}

export function createAppFrontendStateProvider(): AppFrontendStateProvider {
  return {
    getActiveDocument: () => {
      const { currentDocument } = useAppStore.getState();
      if (!currentDocument) return null;
      return {
        id: currentDocument.id,
        title: currentDocument.title,
        projectId: currentDocument.projectId || '',
        content: currentDocument.content || '',
      };
    },
    getActiveProjectId: () => {
      const { currentProject } = useAppStore.getState();
      return currentProject?.id ?? null;
    },
    getAiConfig: () => {
      return getAIInvokeParams();
    },
  };
}

export function registerAppFrontendStateProvider(): void {
  registerFrontendStateProvider(createAppFrontendStateProvider());
}

export function resolveEffectiveAppTheme(uiTheme: UISettings['theme'], prefersDark: boolean): 'light' | 'dark' {
  if (uiTheme === 'auto') {
    return prefersDark ? 'dark' : 'light';
  }
  return uiTheme;
}

export function applyAppThemeClass(root: HTMLElement, effectiveTheme: 'light' | 'dark'): void {
  if (effectiveTheme === 'dark') {
    root.classList.add('dark');
    return;
  }
  root.classList.remove('dark');
}

/**
 * 一次性迁移：将 settings 中的明文 API Key 迁移到 OS 密钥链。
 * 迁移成功后，将 apiKey 字段替换为占位符 '__KEYRING__'。
 * 此函数是幂等的，已迁移的服务（apiKey === '__KEYRING__' 或空）会被跳过。
 */
export function migrateAiKeysToKeyring(): void {
  const ai = useSettingsStore.getState().ai;
  const needMigrate = ai.services.filter(
    s => s.apiKey && s.apiKey !== '__KEYRING__'
  );
  if (needMigrate.length === 0) return;

  const migratePayload = needMigrate.map(s => ({
    serviceId: s.id,
    apiKey: s.apiKey,
  }));

  invoke<string[]>('migrate_ai_keys_to_keyring', { services: migratePayload })
    .then((migratedIds) => {
      if (migratedIds.length === 0) return;
      // 更新 store 中的 apiKey 为占位符
      const updatedServices = ai.services.map(s =>
        migratedIds.includes(s.id) ? { ...s, apiKey: '__KEYRING__' } : s
      );
      useSettingsStore.getState().updateAISettings({ services: updatedServices });
      console.info(`[Security] 已将 ${migratedIds.length} 个 AI API Key 迁移到系统密钥链`);
    })
    .catch((e) => {
      console.warn('[Security] API Key 迁移到密钥链失败（将在下次启动重试）:', e);
    });
}
