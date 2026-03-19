/**
 * DocumentWorkspace — 文档类型路由层
 *
 * 根据文档的 documentType 从注册表查找编辑器组件：
 * - normal（或无 documentType）：直接使用现有 EditorWorkspace（100% 保留现有功能）
 * - 其他类型：根据 layoutMode 渲染注册表中的编辑器
 *   - layoutMode='full'：编辑器自己管理整个工作区
 *   - layoutMode='standard'：编辑器 + 平台右侧面板
 */
import { memo, Suspense, lazy } from 'react';
import type { EditorTab } from '@aidocplus/shared-types';
import { useAppStore } from '@/stores/useAppStore';
import { getDocTypeOrDefault } from '@/doctype-sdk/registry';
import { useDocTypeHost } from '@/doctype-sdk/hooks';
import { EditorWorkspace } from './EditorWorkspace';
import { logRender } from '@/lib/perfLog';
import { ResizableHandle } from '../ui/resizable-handle';
import { useTranslation } from '@/i18n';

const ChatPanel = lazy(() => import('../chat/ChatPanel').then(m => ({ default: m.ChatPanel })));

interface DocumentWorkspaceProps {
  tab: EditorTab;
}

export const DocumentWorkspace = memo(function DocumentWorkspace({ tab }: DocumentWorkspaceProps) {
  logRender(`DocumentWorkspace[${tab.id.slice(-6)}]`);
  const currentDoc = useAppStore(s => s.documents.find(d => d.id === tab.documentId));
  const { t } = useTranslation();

  const docType = currentDoc?.documentType || 'normal';
  const typeDef = getDocTypeOrDefault(docType);

  // Hook 必须在所有条件返回之前调用（React hooks 规则）
  const host = useDocTypeHost(typeDef.id, tab.documentId, tab.id);

  // ═══ normal 类型（或未注册的类型）：直接使用现有 EditorWorkspace ═══
  if (typeDef.id === 'normal') {
    return <EditorWorkspace tab={tab} />;
  }

  // ═══ 其他类型：从注册表加载编辑器 ═══
  const Editor = typeDef.EditorComponent;

  if (!currentDoc) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        {t('common.loading', { defaultValue: '加载中...' })}
      </div>
    );
  }

  // layoutMode='full'：编辑器自己管理整个工作区
  if (typeDef.layoutMode === 'full') {
    return (
      <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">{t('common.loading', { defaultValue: '加载中...' })}</div>}>
        <Editor documentId={currentDoc.id} document={currentDoc} tabId={tab.id} host={host} />
      </Suspense>
    );
  }

  // layoutMode='standard'：编辑器 + 平台右侧面板
  const AISidebar = typeDef.AISidebarComponent;
  const chatWidth = tab.panelState.chatPanelWidth ?? 320;

  return (
    <div className="h-full flex overflow-hidden">
      {/* 主编辑器 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">{t('common.loading', { defaultValue: '加载中...' })}</div>}>
          <Editor documentId={currentDoc.id} document={currentDoc} tabId={tab.id} host={host} />
        </Suspense>
      </div>

      {/* 右侧面板 */}
      {tab.panelState.chatOpen && (
        <>
          <ResizableHandle direction="horizontal" onResize={() => {}} />
          <div className="flex-shrink-0 overflow-hidden h-full" style={{ width: chatWidth }}>
            <Suspense fallback={<div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">{t('common.loading', { defaultValue: '加载中...' })}</div>}>
              {AISidebar ? (
                <AISidebar
                  documentId={currentDoc.id}
                  document={currentDoc}
                  tabId={tab.id}
                  host={host}
                  onClose={() => useAppStore.getState().setTabPanelState(tab.id, 'chatOpen', false)}
                />
              ) : (
                <ChatPanel
                  tabId={tab.id}
                  onClose={() => useAppStore.getState().setTabPanelState(tab.id, 'chatOpen', false)}
                />
              )}
            </Suspense>
          </div>
        </>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.tab.id === next.tab.id
    && prev.tab.documentId === next.tab.documentId
    && prev.tab.panelState === next.tab.panelState;
});
