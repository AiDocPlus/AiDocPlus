import { useState, useEffect, useCallback, useRef } from 'react';
import type { EditorTab, Attachment } from '@aidocplus/shared-types';
import { EditorPanel } from '../editor/EditorPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { useAppStore } from '@/stores/useAppStore';
import { ResizableHandle } from '../ui/resizable-handle';


interface EditorWorkspaceProps {
  tab: EditorTab;
}

export function EditorWorkspace({ tab }: EditorWorkspaceProps) {
  const { documents, setTabPanelState, updateDocumentInMemory } = useAppStore();
  const [authorNotes, setAuthorNotes] = useState('');
  const [content, setContent] = useState('');
  const [aiContent, setAiContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [composedContent, setComposedContent] = useState('');
  const [activeView, setActiveView] = useState<'editor' | 'plugins' | 'composer' | 'functional'>('editor');

  const tabLayoutMode = tab.panelState.layoutMode ?? 'vertical';
  const tabChatPanelWidth = tab.panelState.chatPanelWidth ?? 320;

  const handleChatResize = useCallback((delta: number) => {
    // delta为负表示向左拖（增大聊天面板），所以取反
    setTabPanelState(tab.id, 'chatPanelWidth', Math.min(600, Math.max(240, tabChatPanelWidth - delta)));
  }, [tabChatPanelWidth, tab.id, setTabPanelState]);

  // 获取文档内容（仅在文档ID变化时加载）
  useEffect(() => {
    const document = documents.find(d => d.id === tab.documentId);
    if (document) {
      setAuthorNotes(document.authorNotes || '');
      setContent(document.content || '');
      setAiContent(document.aiGeneratedContent || '');
      setAttachments(document.attachments || []);
      setComposedContent(document.composedContent || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.documentId]);

  // 版本恢复后同步编辑器内容
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId === tab.documentId && detail?.document) {
        const doc = detail.document;
        setAuthorNotes(doc.authorNotes || '');
        setContent(doc.content || '');
        setAiContent(doc.aiGeneratedContent || '');
        setAttachments(doc.attachments || []);
        setComposedContent(doc.composedContent || '');
      }
    };
    window.addEventListener('version-restored', handler);
    return () => window.removeEventListener('version-restored', handler);
  }, [tab.documentId]);

  // 编辑器内容变化时同步到 store（仅内存，不写磁盘），使 ChatPanel 能读到最新内容
  // 加 debounce 避免每次按键都触发 store 更新
  const contentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!tab.documentId) return;
    if (contentTimerRef.current) clearTimeout(contentTimerRef.current);
    contentTimerRef.current = setTimeout(() => {
      updateDocumentInMemory(tab.documentId, { content });
      contentTimerRef.current = null;
    }, 300);
    return () => { if (contentTimerRef.current) clearTimeout(contentTimerRef.current); };
  }, [content, tab.documentId, updateDocumentInMemory]);

  // composedContent 变化时同步到 store（仅内存，加 debounce）
  const composedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!tab.documentId) return;
    if (composedTimerRef.current) clearTimeout(composedTimerRef.current);
    composedTimerRef.current = setTimeout(() => {
      updateDocumentInMemory(tab.documentId, { composedContent: composedContent || undefined });
      composedTimerRef.current = null;
    }, 300);
    return () => { if (composedTimerRef.current) clearTimeout(composedTimerRef.current); };
  }, [composedContent, tab.documentId, updateDocumentInMemory]);

  // 监听 store 中 aiGeneratedContent 的外部变化（如 ChatPanel AI 生成），同步到本地 state
  const storeDoc = documents.find(d => d.id === tab.documentId);
  const storeAiContent = storeDoc?.aiGeneratedContent || '';
  useEffect(() => {
    setAiContent(storeAiContent);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeAiContent]);

  // 监听 ChatPanel "应用到文档" 事件，同步 content / authorNotes 到本地 state
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId !== tab.documentId) return;
      if (detail.field === 'content') setContent(detail.value);
      if (detail.field === 'authorNotes') setAuthorNotes(detail.value);
    };
    window.addEventListener('chat-apply-to-document', handler);
    return () => window.removeEventListener('chat-apply-to-document', handler);
  }, [tab.documentId]);

  // 附件变更时同步到 store
  const handleAttachmentsChange = useCallback((newAttachments: Attachment[]) => {
    setAttachments(newAttachments);
    if (tab.documentId) {
      updateDocumentInMemory(tab.documentId, { attachments: newAttachments });
    }
  }, [tab.documentId, updateDocumentInMemory]);

  // 处理面板状态变化
  const handlePanelToggle = (panel: 'versionHistoryOpen' | 'chatOpen' | 'rightSidebarOpen', open: boolean) => {
    setTabPanelState(tab.id, panel, open);
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* 主编辑区域 */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <EditorPanel
          key={`editor-${tab.id}`}
          tabId={tab.id}
          documentId={tab.documentId}
          authorNotes={authorNotes}
          content={content}
          aiContent={aiContent}
          layoutMode={tabLayoutMode}
          splitRatio={tab.panelState.splitRatio ?? (aiContent.trim() ? 60 : 40)}
          onSplitRatioChange={(ratio) => setTabPanelState(tab.id, 'splitRatio', ratio)}
          onContentChange={setContent}
          onAiContentChange={setAiContent}
          onLayoutModeChange={(mode) => setTabPanelState(tab.id, 'layoutMode', mode)}
          onVersionHistoryToggle={(open) => handlePanelToggle('versionHistoryOpen', open)}
          onChatToggle={() => handlePanelToggle('chatOpen', !tab.panelState.chatOpen)}
          chatOpen={tab.panelState.chatOpen}
          attachments={attachments}
          onAttachmentsChange={handleAttachmentsChange}
          composedContent={composedContent}
          onComposedContentChange={setComposedContent}
          onActiveViewChange={setActiveView}
        />
      </div>

      {/* 聊天面板拖拽手柄 */}
      {tab.panelState.chatOpen && (
        <ResizableHandle direction="horizontal" onResize={handleChatResize} />
      )}

      {/* 右侧聊天面板 */}
      {tab.panelState.chatOpen && (
        <div
          className="border-l flex-shrink-0 overflow-hidden h-full flex flex-col"
          style={{ width: tabChatPanelWidth }}
        >
          <ChatPanel
            key={`chat-${tab.id}-${activeView}`}
            tabId={activeView === 'editor' ? tab.id : `${tab.id}::${activeView}`}
            onClose={() => handlePanelToggle('chatOpen', false)}
            simpleMode={activeView === 'plugins' || activeView === 'composer' || activeView === 'functional'}
          />
        </div>
      )}
    </div>
  );
}
