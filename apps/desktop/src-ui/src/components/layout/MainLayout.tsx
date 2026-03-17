import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from '@/i18n';
import { useMenuEvents } from '@/hooks/useMenuEvents';
import { FileTree } from '../file-tree/FileTree';
import { TabArea } from '../tabs/TabArea';

// 延迟加载按需组件，减少首屏 JS 包大小
const SettingsPanel = lazy(() => import('../settings/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const SearchPanel = lazy(() => import('../search/SearchPanel').then(m => ({ default: m.SearchPanel })));
const ProjectPickerDialog = lazy(() => import('../dialogs/ProjectPickerDialog').then(m => ({ default: m.ProjectPickerDialog })));
const ShortcutsDialog = lazy(() => import('../dialogs/ShortcutsDialog').then(m => ({ default: m.ShortcutsDialog })));
const AboutDialog = lazy(() => import('../dialogs/AboutDialog').then(m => ({ default: m.AboutDialog })));
const FirstRunGuideDialog = lazy(() => import('../dialogs/FirstRunGuideDialog').then(m => ({ default: m.FirstRunGuideDialog })));
const TemplatePickerDialog = lazy(() => import('../templates/TemplatePickerDialog').then(m => ({ default: m.TemplatePickerDialog })));
const SaveAsTemplateDialog = lazy(() => import('../templates/SaveAsTemplateDialog').then(m => ({ default: m.SaveAsTemplateDialog })));
const LockScreen = lazy(() => import('../settings/LockScreen').then(m => ({ default: m.LockScreen })));
import { cn } from '@/lib/utils';
import { logRender } from '@/lib/perfLog';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import { ResizableHandle } from '../ui/resizable-handle';

export function MainLayout() {
  logRender('MainLayout');
  const { t } = useTranslation();
  const sidebarOpen = useAppStore(s => s.sidebarOpen);
  const toggleSidebar = useAppStore(s => s.toggleSidebar);
  const theme = useAppStore(s => s.theme);
  const sidebarWidth = useAppStore(s => s.sidebarWidth);
  const setSidebarWidth = useAppStore(s => s.setSidebarWidth);
  const aiServicesCount = useSettingsStore(s => s.ai.services.length);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<string | undefined>(undefined);
  const [docPickerMode, setDocPickerMode] = useState<'move' | 'copy' | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);

  // 启动密码锁屏
  const securitySettings = useSettingsStore(s => s.security);
  const [isLocked, setIsLocked] = useState(() => {
    const sec = useSettingsStore.getState().security;
    return sec.passwordEnabled && !!sec.passwordHash;
  });

  // 首次启动引导对话框状态
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(false);
  const [firstRunPaused, setFirstRunPaused] = useState(false);
  const [firstRunIsAuto, setFirstRunIsAuto] = useState(false);

  // 检测是否为新用户（无 AI 服务配置）
  useEffect(() => {
    if (aiServicesCount === 0) {
      // 未配置 AI 服务时，清除旧标记并显示引导
      localStorage.removeItem('aidocplus-first-run-guide-shown');
      const timer = setTimeout(() => {
        setFirstRunIsAuto(true);
        setShowFirstRunGuide(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [aiServicesCount]);

  const handleFirstRunGuideClose = () => {
    setShowFirstRunGuide(false);
    if (firstRunIsAuto) {
      // 只有用户已配置 AI 服务时才标记为已完成
      // 未配置时关闭引导，下次启动仍会弹出
      if (aiServicesCount > 0) {
        localStorage.setItem('aidocplus-first-run-guide-shown', 'true');
      }
      setFirstRunIsAuto(false);
    }
  };

  // 监听原生系统菜单事件
  useMenuEvents(useCallback(() => setSettingsOpen(true), []));

  // 监听文档移动/复制和快捷键参考事件
  useEffect(() => {
    const onMoveTo = () => setDocPickerMode('move');
    const onCopyTo = () => setDocPickerMode('copy');
    const onShortcuts = () => setShortcutsOpen(true);
    const onAbout = () => setAboutOpen(true);
    const onNewFromTemplate = () => setTemplatePickerOpen(true);
    const onSaveAsTemplate = () => setSaveAsTemplateOpen(true);
    const onManageTemplates = () => {
      invoke('open_resource_manager', { managerName: '文档模板管理器' }).catch(err => {
        console.error('Failed to open resource manager:', err);
      });
    };
    const onFirstRunGuide = () => setShowFirstRunGuide(true);
    window.addEventListener('menu-doc-move-to', onMoveTo);
    window.addEventListener('menu-doc-copy-to', onCopyTo);
    window.addEventListener('menu-shortcuts-ref', onShortcuts);
    window.addEventListener('menu-about', onAbout);
    window.addEventListener('menu-new-from-template', onNewFromTemplate);
    window.addEventListener('menu-save-as-template', onSaveAsTemplate);
    window.addEventListener('menu-manage-templates', onManageTemplates);
    window.addEventListener('menu-first-run-guide', onFirstRunGuide);
    return () => {
      window.removeEventListener('menu-doc-move-to', onMoveTo);
      window.removeEventListener('menu-doc-copy-to', onCopyTo);
      window.removeEventListener('menu-shortcuts-ref', onShortcuts);
      window.removeEventListener('menu-about', onAbout);
      window.removeEventListener('menu-new-from-template', onNewFromTemplate);
      window.removeEventListener('menu-save-as-template', onSaveAsTemplate);
      window.removeEventListener('menu-manage-templates', onManageTemplates);
      window.removeEventListener('menu-first-run-guide', onFirstRunGuide);
    };
  }, []);

  const handleSidebarResize = useCallback((delta: number) => {
    const newWidth = Math.min(480, Math.max(180, sidebarWidth + delta));
    setSidebarWidth(newWidth);
  }, [sidebarWidth, setSidebarWidth]);

  // 锁屏状态：显示全屏密码验证
  if (isLocked) {
    return (
      <div className={cn(
        "h-screen w-full",
        theme === 'dark' && 'dark'
      )}>
        <Suspense fallback={null}>
          <LockScreen
            passwordHash={securitySettings.passwordHash}
            onUnlock={() => setIsLocked(false)}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex h-screen w-full overflow-hidden",
      theme === 'dark' && 'dark'
    )}>
      {/* Left Sidebar - File Tree */}
      <aside
        className={cn(
          "flex-shrink-0 border-r bg-card overflow-hidden",
          !sidebarOpen && "w-0"
        )}
        style={sidebarOpen ? { width: sidebarWidth } : undefined}
      >
        {sidebarOpen && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-sm">{t('fileTree.sidebarTitle')}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="h-8 w-8"
                title={t('shortcuts.toggleSidebar')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto">
              <FileTree sidebarOpen={sidebarOpen} />
            </div>
          </div>
        )}
      </aside>

      {/* Sidebar Resize Handle */}
      {sidebarOpen && (
        <ResizableHandle direction="horizontal" onResize={handleSidebarResize} />
      )}

      {/* Main Content - Tab Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Menu button for when sidebar is closed */}
        {!sidebarOpen && (
          <div className="flex items-center h-9 px-2 border-b bg-background flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-7 w-7"
              title={t('shortcuts.toggleSidebar')}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Tab Content Area */}
        <div className="flex-1 min-h-0 flex flex-col">
          <TabArea onSettingsOpen={() => setSettingsOpen(true)} />
        </div>
      </main>

      {/* Settings Panel（lazy：仅打开时加载） */}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel open={settingsOpen} defaultTab={settingsDefaultTab} onClose={() => {
            setSettingsOpen(false);
            setSettingsDefaultTab(undefined);
            if (firstRunPaused) {
              setFirstRunPaused(false);
              setFirstRunIsAuto(true);
              setShowFirstRunGuide(true);
            }
          }} />
        </Suspense>
      )}

      {/* Search Panel（lazy：仅打开时加载） */}
      <Suspense fallback={null}>
        <SearchPanel />
      </Suspense>

      {/* 文档移动/复制对话框（lazy） */}
      {docPickerMode !== null && (
        <Suspense fallback={null}>
          <ProjectPickerDialog
            open={docPickerMode !== null}
            mode={docPickerMode || 'move'}
            onClose={() => setDocPickerMode(null)}
          />
        </Suspense>
      )}

      {/* 快捷键参考对话框（lazy） */}
      {shortcutsOpen && (
        <Suspense fallback={null}>
          <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        </Suspense>
      )}

      {/* 关于对话框（lazy） */}
      {aboutOpen && (
        <Suspense fallback={null}>
          <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
        </Suspense>
      )}

      {/* 首次启动引导对话框（lazy） */}
      {showFirstRunGuide && (
        <Suspense fallback={null}>
          <FirstRunGuideDialog
            open={showFirstRunGuide}
            onClose={handleFirstRunGuideClose}
            onOpenSettings={() => {
              setShowFirstRunGuide(false);
              setFirstRunPaused(true);
              setSettingsDefaultTab('ai');
              setSettingsOpen(true);
            }}
          />
        </Suspense>
      )}

      {/* 模板选择器（lazy） */}
      {templatePickerOpen && (
        <Suspense fallback={null}>
          <TemplatePickerDialog
            open={templatePickerOpen}
            onOpenChange={setTemplatePickerOpen}
            projectId={useAppStore.getState().currentProject?.id || ''}
          />
        </Suspense>
      )}

      {/* 存为模板（lazy） */}
      {saveAsTemplateOpen && (() => {
        const { currentDocument } = useAppStore.getState();
        if (!currentDocument) return null;
        return (
          <Suspense fallback={null}>
            <SaveAsTemplateDialog
              open={saveAsTemplateOpen}
              onOpenChange={setSaveAsTemplateOpen}
              projectId={currentDocument.projectId}
              documentId={currentDocument.id}
              documentTitle={currentDocument.title}
            />
          </Suspense>
        );
      })()}

    </div>
  );
}
