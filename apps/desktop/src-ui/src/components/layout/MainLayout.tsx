import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from '@/i18n';
import { useMenuEvents } from '@/hooks/useMenuEvents';
import { FileTree } from '../file-tree/FileTree';
import { TabArea } from '../tabs/TabArea';
import { SettingsPanel } from '../settings/SettingsPanel';
import { SearchPanel } from '../search/SearchPanel';
import { ProjectPickerDialog } from '../dialogs/ProjectPickerDialog';
import { ShortcutsDialog } from '../dialogs/ShortcutsDialog';
import { AboutDialog } from '../dialogs/AboutDialog';
import { FirstRunGuideDialog } from '../dialogs/FirstRunGuideDialog';
import { TemplatePickerDialog } from '../templates/TemplatePickerDialog';
import { SaveAsTemplateDialog } from '../templates/SaveAsTemplateDialog';
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
  const { ai } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<string | undefined>(undefined);
  const [docPickerMode, setDocPickerMode] = useState<'move' | 'copy' | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveAsTemplateOpen, setSaveAsTemplateOpen] = useState(false);

  // 首次启动引导对话框状态
  const [showFirstRunGuide, setShowFirstRunGuide] = useState(false);
  const [firstRunPaused, setFirstRunPaused] = useState(false);
  const [firstRunIsAuto, setFirstRunIsAuto] = useState(false);

  // 检测是否为新用户（无 AI 服务配置）
  useEffect(() => {
    if (ai.services.length === 0) {
      // 未配置 AI 服务时，清除旧标记并显示引导
      localStorage.removeItem('aidocplus-first-run-guide-shown');
      const timer = setTimeout(() => {
        setFirstRunIsAuto(true);
        setShowFirstRunGuide(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [ai.services.length]);

  const handleFirstRunGuideClose = () => {
    setShowFirstRunGuide(false);
    if (firstRunIsAuto) {
      // 只有用户已配置 AI 服务时才标记为已完成
      // 未配置时关闭引导，下次启动仍会弹出
      if (ai.services.length > 0) {
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

      {/* Settings Panel */}
      <SettingsPanel open={settingsOpen} defaultTab={settingsDefaultTab} onClose={() => {
        setSettingsOpen(false);
        setSettingsDefaultTab(undefined);
        if (firstRunPaused) {
          setFirstRunPaused(false);
          setFirstRunIsAuto(true);
          setShowFirstRunGuide(true);
        }
      }} />

      {/* Search Panel */}
      <SearchPanel />

      {/* 文档移动/复制对话框 */}
      <ProjectPickerDialog
        open={docPickerMode !== null}
        mode={docPickerMode || 'move'}
        onClose={() => setDocPickerMode(null)}
      />

      {/* 快捷键参考对话框 */}
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* 关于对话框 */}
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

      {/* 首次启动引导对话框 */}
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

      {/* 模板选择器 */}
      <TemplatePickerDialog
        open={templatePickerOpen}
        onOpenChange={setTemplatePickerOpen}
        projectId={useAppStore.getState().currentProject?.id || ''}
      />

      {/* 存为模板 */}
      {saveAsTemplateOpen && (() => {
        const { currentDocument } = useAppStore.getState();
        if (!currentDocument) return null;
        return (
          <SaveAsTemplateDialog
            open={saveAsTemplateOpen}
            onOpenChange={setSaveAsTemplateOpen}
            projectId={currentDocument.projectId}
            documentId={currentDocument.id}
            documentTitle={currentDocument.title}
          />
        );
      })()}

    </div>
  );
}
