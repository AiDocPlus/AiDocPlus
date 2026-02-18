import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { getPluginsForDocument, getAllPlugins } from './registry';
import { useAppStore } from '@/stores/useAppStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from '@/i18n';
import { Settings2, Maximize2, Minimize2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Document } from '@aidocplus/shared-types';
import { PluginManagerPanel } from './PluginManagerPanel';
import { PluginHostContext, ThinkingContext, createPluginHostAPI } from './_framework/PluginHostAPI';
import type { CreatePluginHostAPIOptions } from './_framework/PluginHostAPI';

/**
 * 插件面板 ErrorBoundary：捕获 HMR 等场景下的渲染错误，避免白屏
 */
class PluginErrorBoundary extends React.Component<
  { children: React.ReactNode; pluginId: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; pluginId: string }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidUpdate(prevProps: { pluginId: string }) {
    if (prevProps.pluginId !== this.props.pluginId && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground p-4">
          <p className="text-sm">插件加载出错，请刷新页面</p>
          <button
            className="text-xs px-3 py-1 rounded border hover:bg-muted"
            onClick={() => this.setState({ hasError: false })}
          >重试</button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * 内部组件：为每个插件构造 PluginHostAPI 并通过 Context 注入
 */
function PluginHostProvider({
  pluginId,
  document,
  tabId,
  aiContent,
  isFunctional,
  i18nNamespace,
  handlePluginDataChange,
  handleRequestSave,
  activePlugin,
  children,
}: {
  pluginId: string;
  document: Document;
  tabId: string;
  aiContent: string;
  isFunctional: boolean;
  i18nNamespace?: string;
  handlePluginDataChange: (pluginId: string) => (data: unknown) => void;
  handleRequestSave: () => Promise<void>;
  activePlugin: { onActivate?: () => void; onDeactivate?: () => void; onDocumentChange?: () => void } | undefined;
  children: React.ReactNode;
}) {
  const { markTabAsDirty } = useAppStore();
  // showStatus 由 PluginHostAPI 提供给插件，插件自行管理状态显示
  // 此处仅作为默认实现（插件可通过 ToolPluginLayout 的 statusMsg 展示）
  const showStatus = useCallback((_msg: string, _isError?: boolean) => {
    // 插件自行管理状态消息，此处为空实现
  }, []);

  // AI 思考内容（由 SDK 自动过滤 <think> 标签后推送）
  const [thinkingContent, setThinkingContent] = useState('');

  // 生命周期 Hook：onActivate / onDeactivate
  useEffect(() => {
    // 插件面板挂载时调用 onActivate
    activePlugin?.onActivate?.();
    return () => {
      // 插件面板卸载时调用 onDeactivate
      activePlugin?.onDeactivate?.();
    };
  }, [activePlugin]);

  // 生命周期 Hook：onDocumentChange（文档 ID 变化时）
  const prevDocumentIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = document.id;
    if (prevDocumentIdRef.current !== null && prevDocumentIdRef.current !== currentId) {
      // 文档切换时调用 onDocumentChange
      activePlugin?.onDocumentChange?.();
    }
    prevDocumentIdRef.current = currentId;
  }, [document.id, activePlugin]);

  const hostAPI = useMemo(() => {
    const opts: CreatePluginHostAPIOptions = {
      pluginId,
      getDocument: () => document,
      getAIContent: () => aiContent,
      getComposedContent: () => document.composedContent || '',
      showStatus,
      getLocale: () => useSettingsStore.getState().ui?.language || 'zh',
      getTheme: () => (useSettingsStore.getState().ui?.theme === 'dark' ? 'dark' : 'light'),
      i18nNamespace,
      onThinkingUpdate: setThinkingContent,
    };
    // 内容生成类插件提供 docData 回调
    if (!isFunctional) {
      opts.docDataCallbacks = {
        getPluginData: () => document.pluginData?.[pluginId] ?? null,
        setPluginData: handlePluginDataChange(pluginId),
        markDirty: () => markTabAsDirty(tabId),
        requestSave: handleRequestSave,
      };
    }
    return createPluginHostAPI(opts);
  }, [pluginId, document, tabId, aiContent, isFunctional, i18nNamespace, handlePluginDataChange, handleRequestSave, showStatus, markTabAsDirty, setThinkingContent]);

  return (
    <PluginHostContext.Provider value={hostAPI}>
      <ThinkingContext.Provider value={thinkingContent}>
        {children}
      </ThinkingContext.Provider>
    </PluginHostContext.Provider>
  );
}

interface PluginToolAreaProps {
  document: Document;
  tabId: string;
  aiContent: string;
  isMaximized?: boolean;
  onMaximizeToggle?: () => void;
  /** 收起/展开左侧项目侧边栏 */
  onLeftSidebarToggle?: (open: boolean) => void;
  /** 收起/展开右侧 AI 助手侧边栏 */
  onRightSidebarToggle?: (open: boolean) => void;
  /** 左侧侧边栏当前是否打开 */
  leftSidebarOpen?: boolean;
  /** 右侧侧边栏当前是否打开 */
  rightSidebarOpen?: boolean;
  /** 过滤显示的插件大类，不传则显示全部 */
  filterCategory?: 'content-generation' | 'functional';
}

/**
 * 插件工具区：顶部插件标签栏 + 当前插件面板 / 管理面板
 */
export function PluginToolArea({ document, tabId, aiContent, isMaximized, onMaximizeToggle, onLeftSidebarToggle, onRightSidebarToggle, leftSidebarOpen, rightSidebarOpen, filterCategory }: PluginToolAreaProps) {
  // 记住最大化前的侧边栏状态，以便恢复
  const sidebarStateBeforeMaximize = useRef<{ left: boolean; right: boolean } | null>(null);
  const { t } = useTranslation('plugin-framework');
  const { updatePluginData, markTabAsDirty, updateDocumentEnabledPlugins, saveDocument, setTabPanelState, pluginManifests } = useAppStore();
  const savedActivePluginId = useAppStore(s => s.tabs.find(tab => tab.id === tabId)?.panelState?.activePluginId);
  const { incrementPluginUsage } = useSettingsStore();

  // 插件标签栏滚动
  const pluginTabsRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const checkPluginTabsScroll = useCallback(() => {
    const el = pluginTabsRef.current;
    if (el) {
      setShowLeftScroll(el.scrollLeft > 0);
      setShowRightScroll(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }
  }, []);

  const scrollTabsLeft = useCallback(() => {
    pluginTabsRef.current?.scrollBy({ left: -150, behavior: 'smooth' });
  }, []);

  const scrollTabsRight = useCallback(() => {
    pluginTabsRef.current?.scrollBy({ left: 150, behavior: 'smooth' });
  }, []);

  const allDocPlugins = useMemo(() => getPluginsForDocument(document), [document]);
  const docPlugins = useMemo(() => {
    if (!filterCategory) return allDocPlugins;
    return allDocPlugins.filter(p => {
      const m = pluginManifests.find(m => m.id === p.id);
      const cat = m?.majorCategory || p.majorCategory || 'content-generation';
      return cat === filterCategory;
    });
  }, [allDocPlugins, filterCategory, pluginManifests]);
  const allPlugins = useMemo(() => getAllPlugins(), []);

  // 标签数量变化时重新检查滚动状态
  useEffect(() => {
    checkPluginTabsScroll();
  }, [docPlugins.length, checkPluginTabsScroll]);

  const [activePluginId, setActivePluginIdLocal] = useState<string | null>(() => {
    // 优先恢复上次保存的活跃插件
    if (savedActivePluginId && docPlugins.some(p => p.id === savedActivePluginId)) {
      return savedActivePluginId;
    }
    return docPlugins.length > 0 ? docPlugins[0].id : null;
  });
  const [showManager, setShowManager] = useState(false);

  // 组件挂载时将当前活跃插件标签滚动到可视区域
  useEffect(() => {
    if (!activePluginId || !pluginTabsRef.current) return;
    const el = pluginTabsRef.current.querySelector(`[data-plugin-id="${activePluginId}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅挂载时执行一次

  // 包装 setActivePluginId，同时持久化到 tab panelState
  const setActivePluginId = useCallback((id: string | null) => {
    setActivePluginIdLocal(id);
    if (id) {
      setTabPanelState(tabId, 'activePluginId', id);
    }
  }, [tabId, setTabPanelState]);

  const activePlugin = docPlugins.find(p => p.id === activePluginId);

  // AI 生成完成后，插件调用此回调触发磁盘保存
  const handleRequestSave = useCallback(async () => {
    const latestDoc = useAppStore.getState().documents.find(d => d.id === document.id);
    if (latestDoc) {
      await saveDocument(latestDoc);
      // 保存成功后清除 dirty 标记，避免 EditorPanel 再次触发重复保存
      const { markTabAsClean, tabs } = useAppStore.getState();
      const tab = tabs.find(t => t.documentId === document.id);
      if (tab) markTabAsClean(tab.id);
    }
  }, [document.id, saveDocument]);

  const handlePluginDataChange = (pluginId: string) => (data: unknown) => {
    // 自动注入 _version 字段（插件数据版本约定）
    const versioned = (data != null && typeof data === 'object' && !Array.isArray(data))
      ? { _version: 1, ...(data as Record<string, unknown>) }
      : data;
    updatePluginData(document.id, pluginId, versioned);
    markTabAsDirty(tabId);
  };

  const handleTabClick = (pluginId: string) => {
    setActivePluginId(pluginId);
    incrementPluginUsage(pluginId);
  };

  const handleEnabledPluginsChange = (pluginIds: string[]) => {
    updateDocumentEnabledPlugins(document.id, pluginIds);
    markTabAsDirty(tabId);
    // 如果当前活跃插件被移除，切换到第一个
    if (activePluginId && !pluginIds.includes(activePluginId)) {
      setActivePluginId(pluginIds.length > 0 ? pluginIds[0] : null);
    }
  };

  // 最大化/还原时联动侧边栏
  const handleMaximizeToggle = useCallback(() => {
    if (!isMaximized) {
      // 即将最大化 → 记住当前侧边栏状态，然后收起
      sidebarStateBeforeMaximize.current = {
        left: leftSidebarOpen ?? true,
        right: rightSidebarOpen ?? true,
      };
      onLeftSidebarToggle?.(false);
      onRightSidebarToggle?.(false);
    } else {
      // 即将还原 → 恢复之前的侧边栏状态
      const prev = sidebarStateBeforeMaximize.current;
      if (prev) {
        onLeftSidebarToggle?.(prev.left);
        onRightSidebarToggle?.(prev.right);
        sidebarStateBeforeMaximize.current = null;
      } else {
        onLeftSidebarToggle?.(true);
        onRightSidebarToggle?.(true);
      }
    }
    onMaximizeToggle?.();
  }, [isMaximized, leftSidebarOpen, rightSidebarOpen, onLeftSidebarToggle, onRightSidebarToggle, onMaximizeToggle]);

  const visibleAllPlugins = useMemo(() => {
    if (!filterCategory) return allPlugins;
    return allPlugins.filter(p => {
      const m = pluginManifests.find(m => m.id === p.id);
      const cat = m?.majorCategory || p.majorCategory || 'content-generation';
      return cat === filterCategory;
    });
  }, [allPlugins, filterCategory, pluginManifests]);

  if (visibleAllPlugins.length === 0) return null;

  return (
    <div className="flex flex-col h-full border-t">
      {/* 插件标签栏：左侧可滚动标签 + 右侧固定按钮 */}
      <div className="flex items-center border-b bg-muted/30 flex-shrink-0">
        {/* 左滚动按钮 */}
        <button
          onClick={scrollTabsLeft}
          disabled={!showLeftScroll}
          className="flex items-center px-0.5 self-stretch border-r transition-colors hover:bg-accent disabled:opacity-30 disabled:pointer-events-none flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4 text-foreground/70" />
        </button>
        {/* 可滚动的插件标签区 */}
        <div
          ref={pluginTabsRef}
          className="flex-1 min-w-0 overflow-x-auto scrollbar-hide flex items-center gap-0.5 px-1.5 py-0.5"
          onScroll={checkPluginTabsScroll}
          onWheel={(e) => {
            if (pluginTabsRef.current && e.deltaY !== 0) {
              pluginTabsRef.current.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }}
        >
          {docPlugins.map(plugin => {
            const Icon = plugin.icon;
            const isActive = !showManager && activePluginId === plugin.id;
            const hasData = plugin.hasData(document);
            return (
              <button
                key={plugin.id}
                data-plugin-id={plugin.id}
                onClick={() => { setShowManager(false); handleTabClick(plugin.id); }}
                className={`
                  flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium
                  transition-colors whitespace-nowrap
                  ${isActive
                    ? 'bg-red-500/20 text-red-600 dark:text-red-400 shadow-sm border border-red-300 dark:border-red-500/40'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }
                `}
                title={plugin.description}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{plugin.name}</span>
                {hasData && (
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                )}
              </button>
            );
          })}
        </div>
        {/* 固定在右侧的操作按钮（含右滚动按钮） */}
        <div className="flex items-center flex-shrink-0 border-l bg-muted/30">
          <button
            onClick={scrollTabsRight}
            disabled={!showRightScroll}
            className="flex items-center px-0.5 self-stretch border-r transition-colors hover:bg-accent disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4 text-foreground/70" />
          </button>
          <div className="flex items-center gap-0.5 px-1 py-0.5">
          {onMaximizeToggle && (
            <button
              onClick={handleMaximizeToggle}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-background/50"
              title={isMaximized ? t('restore') : t('maximize')}
            >
              {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
          <button
            onClick={() => setShowManager(!showManager)}
            className={`
              flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-medium
              transition-colors whitespace-nowrap
              ${showManager
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              }
            `}
            title={t('manage')}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          </div>
        </div>
      </div>

      {/* 插件面板内容 / 管理面板 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {showManager ? (
          <PluginManagerPanel
            document={document}
            enabledPluginIds={document.enabledPlugins}
            onEnabledPluginsChange={handleEnabledPluginsChange}
            onClose={() => setShowManager(false)}
            filterCategory={filterCategory}
          />
        ) : activePlugin ? (
          <PluginErrorBoundary pluginId={activePlugin.id}>
            <PluginHostProvider
              pluginId={activePlugin.id}
              document={document}
              tabId={tabId}
              aiContent={aiContent}
              isFunctional={activePlugin.majorCategory === 'functional'}
              i18nNamespace={activePlugin.i18nNamespace}
              handlePluginDataChange={handlePluginDataChange}
              handleRequestSave={handleRequestSave}
              activePlugin={activePlugin}
            >
              <activePlugin.PanelComponent
                document={document}
                tabId={tabId}
                content={aiContent}
                pluginData={document.pluginData?.[activePlugin.id] ?? null}
                onPluginDataChange={handlePluginDataChange(activePlugin.id)}
                onRequestSave={handleRequestSave}
              />
            </PluginHostProvider>
          </PluginErrorBoundary>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            {docPlugins.length === 0
              ? t('noPluginsEnabled')
              : t('selectPlugin')}
          </div>
        )}
      </div>
    </div>
  );
}
