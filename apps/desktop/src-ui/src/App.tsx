import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from './components/layout/MainLayout';
import { useAppStore } from './stores/useAppStore';
import { useSettingsStore } from './stores/useSettingsStore';
import { useWorkspaceAutosave } from './hooks/useWorkspaceAutosave';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './i18n'; // Initialize i18n

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
  const { loadProjects, restoreWorkspace } = useAppStore();
  const { ui } = useSettingsStore();
  const { setRestoring } = useWorkspaceAutosave();
  const [isInitialized, setIsInitialized] = useState(false);
  const initializingRef = useRef(false);

  useEffect(() => {
    // 确保只初始化一次
    if (initializingRef.current) return;
    initializingRef.current = true;

    const initializeApp = async () => {
      setRestoring(true);

      try {
        // Load plugins from backend
        await useAppStore.getState().loadPlugins();

        // Load templates and categories from backend
        await useAppStore.getState().loadTemplates();
        await useAppStore.getState().loadTemplateCategories();

        // Restore workspace state (includes loading projects)
        await restoreWorkspace();
      } catch (error) {
        console.error('[App] Failed to restore workspace, loading projects:', error);
        // Fallback to loading projects if restore fails
        await loadProjects();
      }

      setIsInitialized(true);
      setRestoring(false);
    };

    initializeApp();
  }, []);

  useEffect(() => {
    // Apply theme from settings
    const effectiveTheme = ui.theme === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : ui.theme;

    if (effectiveTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [ui.theme]);

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

  return <MainLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;
