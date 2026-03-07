import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from './components/layout/MainLayout';
import { useAppStore } from './stores/useAppStore';
import { useSettingsStore, getAIInvokeParams } from './stores/useSettingsStore';
import { useTemplatesStore } from './stores/useTemplatesStore';
import { useWorkspaceAutosave } from './hooks/useWorkspaceAutosave';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UpdateChecker } from './components/settings/UpdateChecker';
import './i18n'; // Initialize i18n
import { registerFrontendStateProvider } from './api/ApiBridge';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { t } = useTranslation();
  const uiTheme = useSettingsStore(s => s.ui.theme);
  const { setRestoring } = useWorkspaceAutosave();
  const [isInitialized, setIsInitialized] = useState(false);
  const initializingRef = useRef(false);

  useEffect(() => {
    // 确保只初始化一次
    if (initializingRef.current) return;
    initializingRef.current = true;

    const initializeApp = async () => {
      setRestoring(true);
      const t0 = performance.now();

      try {
        // 第一批：互不依赖的操作并行执行（分别计时）
        const batch1Start = performance.now();
        const [, , , ,] = await Promise.all([
          (async () => { const s = performance.now(); await useAppStore.getState().loadPlugins(); console.log(`[Perf] loadPlugins: ${(performance.now() - s).toFixed(0)}ms`); })(),
          (async () => { const s = performance.now(); await useAppStore.getState().loadDocTemplates(); console.log(`[Perf] loadDocTemplates: ${(performance.now() - s).toFixed(0)}ms`); })(),
          (async () => { const s = performance.now(); await useAppStore.getState().loadDocTemplateCategories(); console.log(`[Perf] loadDocTemplateCategories: ${(performance.now() - s).toFixed(0)}ms`); })(),
          (async () => { const s = performance.now(); await useTemplatesStore.getState().loadBuiltInTemplates(); console.log(`[Perf] loadBuiltInTemplates: ${(performance.now() - s).toFixed(0)}ms`); })(),
          (async () => { const s = performance.now(); await useTemplatesStore.getState().loadBuiltInCategories(); console.log(`[Perf] loadBuiltInCategories: ${(performance.now() - s).toFixed(0)}ms`); })(),
        ]);
        console.log(`[Perf] 第一批并行总耗时: ${(performance.now() - batch1Start).toFixed(0)}ms`);

        // 第二批：依赖第一批完成
        const batch2Start = performance.now();
        await useAppStore.getState().restoreWorkspace();
        console.log(`[Perf] restoreWorkspace: ${(performance.now() - batch2Start).toFixed(0)}ms`);
      } catch (error) {
        console.error('[App] Failed to restore workspace, loading projects:', error);
        // Fallback to loading projects if restore fails
        await useAppStore.getState().loadProjects();
      }

      console.log(`[Perf] 启动总耗时: ${(performance.now() - t0).toFixed(0)}ms`);

      // 注册前端状态提供者，让 API Bridge 能查询 UI 状态
      registerFrontendStateProvider({
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
      });

      setIsInitialized(true);
      setRestoring(false);
    };

    initializeApp();
  }, []);

  useEffect(() => {
    // Apply theme from settings
    const effectiveTheme = uiTheme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : uiTheme;

    if (effectiveTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [uiTheme]);

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-screen bg-background text-foreground">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">{t('common.loading', { defaultValue: '加载中...' })}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <MainLayout />
      <UpdateChecker />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
