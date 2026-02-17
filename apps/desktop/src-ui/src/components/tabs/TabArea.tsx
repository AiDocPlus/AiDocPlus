import { useEffect } from 'react';
import { TabBar } from './TabBar';
import { EditorWorkspace } from './EditorWorkspace';
import { useAppStore } from '@/stores/useAppStore';
import { cn } from '@/lib/utils';
import { FileText, FolderOpen, Keyboard } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface TabAreaProps {
  onSettingsOpen: () => void;
}

export function TabArea({ onSettingsOpen }: TabAreaProps) {
  const { t } = useTranslation();
  const { tabs, activeTabId, currentProject, createDocument, openTab } = useAppStore();

  // 没有打开文档时，监听 Cmd+N 新建文档事件
  useEffect(() => {
    if (tabs.length > 0) return;
    const handler = async () => {
      const project = useAppStore.getState().currentProject;
      if (!project) return;
      try {
        const newDoc = await createDocument(project.id, t('editor.untitledDocument', { defaultValue: '未命名文档' }));
        if (newDoc) await openTab(newDoc.id);
      } catch (err) {
        console.error('Failed to create document:', err);
      }
    };
    window.addEventListener('editor-new-document', handler);
    return () => window.removeEventListener('editor-new-document', handler);
  }, [tabs.length, currentProject, createDocument, openTab, t]);

  if (tabs.length === 0) {
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = isMac ? '⌘' : 'Ctrl';
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <TabBar onSettingsOpen={onSettingsOpen} />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center space-y-6 max-w-sm">
            <FileText className="w-16 h-16 mx-auto opacity-30" />
            <div className="space-y-2">
              <p className="text-lg font-medium">{t('tabs.noOpenDocuments', { defaultValue: '没有打开的文档' })}</p>
              <p className="text-sm opacity-70">{t('tabs.selectDocumentHint', { defaultValue: '点击左侧文件树中的文档开始编辑' })}</p>
            </div>
            <div className="text-xs space-y-1.5 opacity-60">
              <div className="flex items-center justify-center gap-2">
                <FolderOpen className="w-3.5 h-3.5" />
                <span>{t('tabs.openDocInTree', { defaultValue: '在文件树中点击文档打开' })}</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Keyboard className="w-3.5 h-3.5" />
                <span>{t('tabs.commonShortcuts', { defaultValue: '{{mod}}+N 新建文档 · {{mod}}+S 保存 · {{mod}}+F 查找', mod })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <TabBar onSettingsOpen={onSettingsOpen} />
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            'flex-1 min-h-0',
            tab.id === activeTabId ? '' : 'hidden'
          )}
        >
          <EditorWorkspace tab={tab} />
        </div>
      ))}
    </div>
  );
}
