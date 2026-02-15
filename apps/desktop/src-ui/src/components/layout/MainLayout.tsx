import { useState, useCallback } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useTranslation } from '@/i18n';
import { FileTree } from '../file-tree/FileTree';
import { TabArea } from '../tabs/TabArea';
import { SettingsPanel } from '../settings/SettingsPanel';
import { SearchPanel } from '../search/SearchPanel';
import { cn } from '@/lib/utils';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import { ResizableHandle } from '../ui/resizable-handle';

export function MainLayout() {
  const { t } = useTranslation();
  const { sidebarOpen, toggleSidebar, theme, sidebarWidth, setSidebarWidth } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

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
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Search Panel */}
      <SearchPanel />
    </div>
  );
}
