import type { UISettings } from '@aidocplus/shared-types';
import { registerFrontendStateProvider } from './api/ApiBridge';
import { useAppStore } from './stores/useAppStore';
import { getAIInvokeParams } from './stores/useSettingsStore';
import { useTemplatesStore } from './stores/useTemplatesStore';

type AppFrontendStateProvider = {
  getActiveDocument: () => { id: string; title: string; projectId: string; content: string } | null;
  getActiveProjectId: () => string | null;
  getAiConfig: () => ReturnType<typeof getAIInvokeParams>;
};

export async function loadAppBootstrapResources(): Promise<void> {
  await Promise.all([
    useAppStore.getState().loadPlugins(),
    useAppStore.getState().loadDocTemplates(),
    useAppStore.getState().loadDocTemplateCategories(),
    useTemplatesStore.getState().loadBuiltInTemplates(),
    useTemplatesStore.getState().loadBuiltInCategories(),
  ]);
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
