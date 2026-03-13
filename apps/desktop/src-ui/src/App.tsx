import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { MainLayout } from './components/layout/MainLayout';
import { useSettingsStore } from './stores/useSettingsStore';
import { useWorkspaceAutosave } from './hooks/useWorkspaceAutosave';
import { UpdateChecker } from './components/settings/UpdateChecker';
import './i18n'; // Initialize i18n
import {
  loadAppBootstrapResources,
  loadDeferredResources,
  restoreAppBootstrapWorkspace,
  fallbackLoadProjectsAfterBootstrapFailure,
  registerAppFrontendStateProvider,
  resolveEffectiveAppTheme,
  applyAppThemeClass,
  migrateAiKeysToKeyring,
} from './App.helpers';
import { loadConversationsFromDB } from './stores/useConversationsStore';


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
        // 启动时静默清理旧临时文件（不阻塞）
        invoke('cleanup_temp_files').catch(() => {});

        // 一次性迁移：将明文 API Key 迁移到 OS 密钥链
        migrateAiKeysToKeyring();

        // 第一批：互不依赖的操作并行执行
        const batch1Start = performance.now();
        await Promise.all([
          loadAppBootstrapResources(),
          loadConversationsFromDB(),
        ]);
        console.log(`[Perf] 第一批并行总耗时: ${(performance.now() - batch1Start).toFixed(0)}ms`);

        // 第二批：依赖第一批完成
        const batch2Start = performance.now();
        await restoreAppBootstrapWorkspace();
        console.log(`[Perf] restoreWorkspace: ${(performance.now() - batch2Start).toFixed(0)}ms`);
      } catch (error) {
        console.error('[App] Failed to restore workspace, loading projects:', error);
        await fallbackLoadProjectsAfterBootstrapFailure();
      }

      console.log(`[Perf] 启动总耗时: ${(performance.now() - t0).toFixed(0)}ms`);

      // 注册前端状态提供者，让 API Bridge 能查询 UI 状态
      registerAppFrontendStateProvider();

      setIsInitialized(true);
      setRestoring(false);

      // UI 可交互后，延后加载非关键资源（模板数据等）
      loadDeferredResources();
    };

    initializeApp();
  }, []);

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyAppThemeClass(document.documentElement, resolveEffectiveAppTheme(uiTheme, prefersDark));
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
  return <AppContent />;
}

export default App;
