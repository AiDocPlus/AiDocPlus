import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { EditorTab, Attachment, Document } from '@aidocplus/shared-types';
import { EditorPanel } from '../editor/EditorPanel';
import { ChatPanel } from '../chat/ChatPanel';
import { useAppStore } from '@/stores/useAppStore';
import { ResizableHandle } from '../ui/resizable-handle';
import type { DocumentPlugin } from '@/plugins/types';
import { PluginAssistantPanel } from '@/plugins/_framework/PluginAssistantPanel';
import { PluginHostContext, ThinkingContext, createPluginHostAPI, type CreatePluginHostAPIOptions } from '@/plugins/_framework/PluginHostAPI';
import { useSettingsStore } from '@/stores/useSettingsStore';


interface EditorWorkspaceProps {
  tab: EditorTab;
}

export function EditorWorkspace({ tab }: EditorWorkspaceProps) {
  const documents = useAppStore(s => s.documents);
  const setTabPanelState = useAppStore(s => s.setTabPanelState);
  const updateDocumentInMemory = useAppStore(s => s.updateDocumentInMemory);
  // 精确订阅当前文档的 aiGeneratedContent，避免其他文档变化触发重渲染
  const storeAiContent = useAppStore(s => {
    const doc = s.documents.find(d => d.id === tab.documentId);
    return doc?.aiGeneratedContent || '';
  });
  const [authorNotes, setAuthorNotes] = useState('');
  const [content, setContent] = useState('');
  const [aiContent, setAiContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [composedContent, setComposedContent] = useState('');
  const [activeView, setActiveView] = useState<'editor' | 'plugins' | 'composer' | 'functional' | 'coding'>('editor');
  const [activePlugin, setActivePlugin] = useState<DocumentPlugin | null>(null);

  // 插件区活跃插件变化回调
  const handleActivePluginChange = useCallback((plugin: DocumentPlugin | null) => {
    setActivePlugin(plugin);
  }, []);

  // 插件助手面板是否显示
  const isPluginView = activeView === 'plugins' || activeView === 'functional';
  const showPluginAssistant = isPluginView && activePlugin != null;

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
          onActivePluginChange={handleActivePluginChange}
        />
      </div>

      {/* 聊天面板拖拽手柄（编程区自带AI助手，不显示外部聊天面板） */}
      {tab.panelState.chatOpen && activeView !== 'coding' && (
        <ResizableHandle direction="horizontal" onResize={handleChatResize} />
      )}

      {/* 右侧面板：插件区显示插件 AI 助手，其他显示 ChatPanel，编程区自带不显示 */}
      {tab.panelState.chatOpen && activeView !== 'coding' && (
        <div
          className="flex-shrink-0 overflow-hidden h-full flex flex-col"
          style={{ width: tabChatPanelWidth }}
        >
          {showPluginAssistant ? (
            <PluginAssistantWrapper
              key={`plugin-assistant-${activePlugin!.id}`}
              plugin={activePlugin!}
              document={documents.find(d => d.id === tab.documentId)!}
              tabId={tab.id}
              aiContent={aiContent}
            />
          ) : (
            <ChatPanel
              key={`chat-${tab.id}-${activeView}`}
              tabId={activeView === 'editor' ? tab.id : `${tab.id}::${activeView}`}
              onClose={() => handlePanelToggle('chatOpen', false)}
              simpleMode={activeView === 'composer'}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 插件 AI 助手包装组件
 * 为 PluginAssistantPanel 提供 PluginHostContext，使其能使用 usePluginHost()
 */
function PluginAssistantWrapper({
  plugin,
  document: doc,
  tabId,
  aiContent,
}: {
  plugin: DocumentPlugin;
  document: Document;
  tabId: string;
  aiContent: string;
}) {
  // 使用 ref 持有最新值，避免 hostAPI 频繁重建导致 Context 消费者不必要重渲染
  const docRef = useRef(doc);
  const aiContentRef = useRef(aiContent);
  useEffect(() => { docRef.current = doc; }, [doc]);
  useEffect(() => { aiContentRef.current = aiContent; }, [aiContent]);

  // 思考内容状态（供 ThinkingContext 传递给子组件）
  const [thinkingContent, setThinkingContent] = useState('');
  const thinkingUpdateRef = useRef(setThinkingContent);
  thinkingUpdateRef.current = setThinkingContent;

  const { updatePluginData, markTabAsDirty, saveDocument } = useAppStore();

  const hostAPI = useMemo(() => {
    const isFunctional = plugin.majorCategory === 'functional';
    const opts: CreatePluginHostAPIOptions = {
      pluginId: plugin.id,
      getDocument: () => docRef.current,
      getAIContent: () => aiContentRef.current,
      getComposedContent: () => docRef.current.composedContent || '',
      showStatus: () => {},
      getLocale: () => useSettingsStore.getState().ui?.language || 'zh',
      getTheme: () => (useSettingsStore.getState().ui?.theme === 'dark' ? 'dark' : 'light'),
      i18nNamespace: plugin.i18nNamespace,
      onThinkingUpdate: (thinking: string) => thinkingUpdateRef.current(thinking),
    };
    // 内容生成类插件提供 docData 回调，使 host.docData 可用
    if (!isFunctional) {
      opts.docDataCallbacks = {
        getPluginData: () => docRef.current.pluginData?.[plugin.id] ?? null,
        setPluginData: (data: unknown) => {
          const versioned = (data != null && typeof data === 'object' && !Array.isArray(data))
            ? { _version: 1, ...(data as Record<string, unknown>) }
            : data;
          updatePluginData(docRef.current.id, plugin.id, versioned);
          markTabAsDirty(tabId);
        },
        markDirty: () => markTabAsDirty(tabId),
        requestSave: async () => {
          const latestDoc = useAppStore.getState().documents.find(d => d.id === docRef.current.id);
          if (latestDoc) {
            await saveDocument(latestDoc);
            const { markTabAsClean, tabs } = useAppStore.getState();
            const t = tabs.find(x => x.documentId === docRef.current.id);
            if (t) markTabAsClean(t.id);
          }
        },
      };
    }
    return createPluginHostAPI(opts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin.id, plugin.i18nNamespace, plugin.majorCategory, tabId, updatePluginData, markTabAsDirty, saveDocument]);

  // 插件提供了完全自定义的助手面板组件
  if (plugin.AssistantPanelComponent) {
    const CustomPanel = plugin.AssistantPanelComponent;
    return (
      <PluginHostContext.Provider value={hostAPI}>
        <ThinkingContext.Provider value={thinkingContent}>
          <CustomPanel
            pluginId={plugin.id}
            document={doc}
            pluginData={doc.pluginData?.[plugin.id] ?? null}
            aiContent={aiContent}
            tabId={tabId}
          />
        </ThinkingContext.Provider>
      </PluginHostContext.Provider>
    );
  }

  // 使用通用助手面板（配置式或默认）
  return (
    <PluginHostContext.Provider value={hostAPI}>
      <ThinkingContext.Provider value={thinkingContent}>
        <PluginAssistantPanel
          pluginId={plugin.id}
          pluginName={plugin.name}
          pluginDesc={plugin.description}
          assistantConfig={plugin.assistantConfig}
          document={doc}
          pluginData={doc.pluginData?.[plugin.id] ?? null}
          aiContent={aiContent}
          tabId={tabId}
        />
      </ThinkingContext.Provider>
    </PluginHostContext.Provider>
  );
}
