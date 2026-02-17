import { useState } from 'react';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { Button } from '../ui/button';
import { VersionHistoryPanel } from '../version/VersionHistoryPanel';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

interface RightSidebarProps {
  tabId: string;
  documentId: string;
}

export function RightSidebar({ tabId, documentId }: RightSidebarProps) {
  const { t } = useTranslation();
  const { tabs, documents, setTabPanelState } = useAppStore();
  const tab = tabs.find(t => t.id === tabId);
  const document = documents.find(d => d.id === documentId);
  const [isCollapsed, setIsCollapsed] = useState(!tab?.panelState.rightSidebarOpen);

  if (!tab || !document) return null;

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
  };

  return (
    <div
      className={cn(
        'border-l bg-background flex transition-all duration-300',
        isCollapsed ? 'w-10' : 'w-72'
      )}
    >
      {/* 折叠按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-6 p-0 rounded-r-md rounded-l-none bg-background border border-l-0',
          isCollapsed ? 'translate-x-4' : '-translate-x-3'
        )}
        onClick={toggleCollapse}
      >
        {isCollapsed ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </Button>

      {/* 面板内容 */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* 版本历史 */}
          {tab.panelState.versionHistoryOpen && (
            <div className="flex-1 flex flex-col border-b">
              <div className="flex items-center gap-2 px-4 py-2 border-b">
                <History className="h-4 w-4" />
                <span className="text-sm font-medium">{t('tabs.versionHistory', { defaultValue: '版本历史' })}</span>
              </div>
              <div className="flex-1 overflow-auto">
                <VersionHistoryPanel
                  open={true}
                  onClose={() => setTabPanelState(tabId, 'versionHistoryOpen', false)}
                  projectId={document.projectId}
                  documentId={documentId}
                />
              </div>
            </div>
          )}

          {/* 预留扩展空间 */}
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            {t('tabs.moreFeaturesComing', { defaultValue: '更多功能开发中...' })}
          </div>
        </div>
      )}
    </div>
  );
}
