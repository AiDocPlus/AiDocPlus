import { create } from 'zustand';
import type { Project, Document, DocumentVersion, AIMessage, ChatContextMode, WorkspaceState, EditorTab, PluginManifest, TemplateManifest, TemplateCategory } from '@aidocplus/shared-types';
import { getActiveRole } from '@aidocplus/shared-types';
import { buildPluginList, setPlugins } from '@/plugins/registry';
import { syncManifestsToBackend } from '@/plugins/loader';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore, getAIInvokeParamsForService } from './useSettingsStore';
import { isTauri } from '@/lib/isTauri';
import i18n from '@/i18n';

// Markdown 格式约束提示词：从设置中读取（用户可编辑）
function getMarkdownModePrompt(): string {
  const ai = useSettingsStore.getState().ai;
  return ai.markdownModePrompt || '';
}

// 角色 System Prompt：从当前激活角色获取
function getRoleSystemPrompt(): string {
  const role = useSettingsStore.getState().role;
  const activeRole = getActiveRole(role);
  return activeRole?.systemPrompt?.trim() || '';
}

// 标签页面板状态类型
type TabPanelKey = 'versionHistoryOpen' | 'chatOpen' | 'rightSidebarOpen' | 'layoutMode' | 'splitRatio' | 'chatPanelWidth' | 'activePluginId';

// 流式状态（按标签页隔离）
interface StreamState {
  unlistenFn: (() => void) | null;
  aborted: boolean;
  sessionId: number;
  requestId: string | null;
}

// 状态一致性辅助函数
function ensureDocumentConsistency(
  documents: Document[],
  currentDocument: Document | null
): { documents: Document[]; currentDocument: Document | null } {
  // 如果 currentDocument 不为空，确保它在 documents 列表中存在
  if (currentDocument) {
    const existsInList = documents.some(d => d.id === currentDocument.id);
    if (!existsInList) {
      // currentDocument 不在列表中，重置为 null
      console.warn('[Consistency] currentDocument not found in documents list, resetting to null');
      return { documents, currentDocument: null };
    }
    // 确保 currentDocument 与列表中的版本同步（引用比较即可，因为更新时已创建新对象）
    const syncedDoc = documents.find(d => d.id === currentDocument.id);
    if (syncedDoc && syncedDoc !== currentDocument) {
      return { documents, currentDocument: syncedDoc };
    }
  }
  return { documents, currentDocument };
}

interface AppState {
  // Projects
  projects: Project[];
  currentProject: Project | null;

  // Documents
  documents: Document[];
  currentDocument: Document | null;

  // 标签页系统
  tabs: EditorTab[];
  activeTabId: string | null;

  // UI State
  sidebarOpen: boolean;
  chatOpen: boolean;
  sidebarWidth: number;
  theme: 'light' | 'dark' | 'auto';

  // Loading states
  isLoading: boolean;
  error: string | null;

  // AI State (per-tab messages)
  aiMessagesByTab: Record<string, AIMessage[]>;
  isAiStreaming: boolean;
  aiStreamingTabId: string | null;

  // 流式状态（按标签页隔离，替代模块级变量）
  streamStateByTab: Record<string, StreamState>;

  // Actions
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setDocuments: (documents: Document[]) => void;
  setCurrentDocument: (document: Document | null) => void;
  toggleSidebar: () => void;
  toggleChat: () => void;
  setSidebarOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // AI Actions
  getAiMessages: (tabId: string) => AIMessage[];
  setAiMessages: (tabId: string, messages: AIMessage[]) => void;
  addAiMessage: (tabId: string, message: AIMessage) => void;
  updateLastAiMessage: (tabId: string, fields: Partial<AIMessage>) => void;
  clearAiMessages: (tabId: string) => void;
  setAiStreaming: (streaming: boolean, tabId?: string) => void;
  stopAiStreaming: () => void;
  sendChatMessage: (tabId: string, content: string, enableWebSearch?: boolean, contextInfo?: { mode: ChatContextMode; content: string }, enableTools?: boolean) => Promise<string>;
  generateContent: (authorNotes: string, currentContent: string) => Promise<string>;
  generateContentStream: (authorNotes: string, currentContent: string, onChunk: (chunk: string) => void, conversationHistory?: AIMessage[], enableWebSearch?: boolean) => Promise<string>;

  // Plugin Actions
  updatePluginData: (documentId: string, pluginId: string, data: unknown) => void;
  updateDocumentEnabledPlugins: (documentId: string, pluginIds: string[]) => void;
  loadPlugins: () => Promise<PluginManifest[]>;
  pluginManifests: PluginManifest[];

  // Template Actions
  templates: TemplateManifest[];
  templateCategories: TemplateCategory[];
  loadTemplates: () => Promise<TemplateManifest[]>;
  loadTemplateCategories: () => Promise<TemplateCategory[]>;
  createDocumentFromTemplate: (projectId: string, templateId: string, title: string, author?: string) => Promise<Document>;
  saveAsTemplate: (projectId: string, documentId: string, name: string, description: string, category: string, includeContent: boolean, includeAiContent: boolean, includePluginData: boolean) => Promise<TemplateManifest>;
  deleteTemplate: (templateId: string) => Promise<void>;
  duplicateTemplate: (templateId: string, newName: string) => Promise<TemplateManifest>;
  updateTemplate: (templateId: string, fields: { name?: string; description?: string; category?: string; icon?: string; tags?: string[] }) => Promise<TemplateManifest>;
  createTemplateCategory: (key: string, label: string) => Promise<TemplateCategory[]>;
  updateTemplateCategory: (key: string, label?: string, newKey?: string) => Promise<TemplateCategory[]>;
  deleteTemplateCategory: (key: string) => Promise<TemplateCategory[]>;
  reorderTemplateCategories: (orderedKeys: string[]) => Promise<TemplateCategory[]>;

  // API Actions
  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  openProject: (projectId: string) => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;

  loadDocuments: (projectId: string) => Promise<void>;
  createDocument: (projectId: string, title: string, author?: string) => Promise<Document>;
  saveDocument: (document: Document) => Promise<void>;
  deleteDocument: (projectId: string, documentId: string) => Promise<void>;
  renameDocument: (projectId: string, documentId: string, newTitle: string) => Promise<void>;

  // 项目导入/导出/备份
  exportProjectZip: (projectId: string, outputPath: string) => Promise<string>;
  importProjectZip: (zipPath: string) => Promise<Project>;

  // 文档跨项目移动/复制
  moveDocumentToProject: (documentId: string, fromProjectId: string, toProjectId: string) => Promise<Document>;
  copyDocumentToProject: (documentId: string, fromProjectId: string, toProjectId: string) => Promise<Document>;

  loadVersions: (projectId: string, documentId: string) => Promise<DocumentVersion[]>;
  createVersion: (projectId: string, documentId: string, content: string, authorNotes: string, aiGeneratedContent: string, createdBy: string, changeDescription?: string, pluginData?: Record<string, unknown>, enabledPlugins?: string[], composedContent?: string) => Promise<string>;
  restoreVersion: (projectId: string, documentId: string, versionId: string, createBackup: boolean) => Promise<Document>;

  // 文档标签管理
  updateDocumentTags: (projectId: string, documentId: string, tags: string[]) => Promise<Document>;
  loadAllTags: (projectId?: string) => Promise<string[]>;
  allTags: string[];
  toggleDocumentStarred: (projectId: string, documentId: string) => Promise<Document>;

  // 文档排序与筛选
  documentSortBy: 'updatedAt' | 'createdAt' | 'title' | 'wordCount';
  documentSortOrder: 'asc' | 'desc';
  documentFilterTag: string | null;
  setDocumentSort: (sortBy: 'updatedAt' | 'createdAt' | 'title' | 'wordCount', sortOrder?: 'asc' | 'desc') => void;
  setDocumentFilterTag: (tag: string | null) => void;

  // Convenience methods
  updateDocumentInMemory: (documentId: string, fields: Partial<Document>) => void;
  updateAiGeneratedContent: (aiContent: string, originalContent?: string) => Promise<void>;

  // 标签页操作方法
  openTab: (documentId: string) => Promise<void>;
  closeTab: (tabId: string, saveBeforeClose?: boolean) => Promise<void>;
  closeOtherTabs: (keepTabId: string) => Promise<void>;
  closeAllTabs: () => Promise<void>;
  switchTab: (tabId: string) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  setTabPanelState: (tabId: string, panel: TabPanelKey, value: boolean | number | string) => void;
  checkUnsavedChanges: (tabId: string) => boolean;
  markTabAsDirty: (tabId: string) => void;
  markTabAsClean: (tabId: string) => void;
  getActiveTab: () => EditorTab | null;
  getTabByDocumentId: (documentId: string) => EditorTab | undefined;

  // Workspace persistence methods
  saveWorkspaceState: () => Promise<void>;
  loadWorkspaceState: () => Promise<WorkspaceState | null>;
  restoreWorkspace: () => Promise<void>;
  clearWorkspaceState: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  projects: [],
  currentProject: null,
  documents: [],
  currentDocument: null,
  tabs: [],
  activeTabId: null,
  sidebarOpen: true,
  chatOpen: true,
  sidebarWidth: 256,
  theme: 'light',
  isLoading: false,
  error: null,
  aiMessagesByTab: {},
  isAiStreaming: false,
  aiStreamingTabId: null,
  streamStateByTab: {},
  pluginManifests: [],
  templates: [],
  templateCategories: [],
  allTags: [],
  documentSortBy: 'updatedAt' as const,
  documentSortOrder: 'desc' as const,
  documentFilterTag: null,

  // Setters
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (project) => set({ currentProject: project }),
  setDocuments: (documents) => {
    // 更新 documents 时确保一致性
    const { currentDocument } = get();
    const { documents: newDocs, currentDocument: newCurrentDoc } = ensureDocumentConsistency(
      documents,
      currentDocument
    );
    set({ documents: newDocs, currentDocument: newCurrentDoc });
  },
  setCurrentDocument: (document) => {
    // 设置 currentDocument 时确保一致性
    const { documents } = get();
    if (document) {
      const existsInList = documents.some(d => d.id === document.id);
      if (!existsInList) {
        console.warn('[Consistency] Attempted to set currentDocument that does not exist in documents list');
        // 将文档添加到列表中
        set({ currentDocument: document, documents: [...documents, document] });
        return;
      }
    }
    set({ currentDocument: document ?? null });
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleChat: () => set((state) => ({ chatOpen: !state.chatOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setChatOpen: (open) => set({ chatOpen: open }),
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  setTheme: (theme) => set({ theme }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Project API
  loadProjects: async () => {
    // 在非 Tauri 环境中直接返回
    if (!isTauri()) {
      set({ projects: [] });
      return;
    }

    try {
      set({ isLoading: true, error: null });
      const projects = await invoke<Project[]>('list_projects');
      set({ projects });

      // 加载所有项目的文档，以便文件树正确显示文档数
      const allDocs: Document[] = [];
      for (const p of projects) {
        try {
          const docs = await invoke<Document[]>('list_documents', { projectId: p.id });
          allDocs.push(...docs);
        } catch (e) {
          console.error('[loadProjects] Failed to load documents for project:', p.id, e);
        }
      }
      set({ documents: allDocs });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load projects' });
    } finally {
      set({ isLoading: false });
    }
  },

  createProject: async (name, description) => {
    try {
      set({ isLoading: true, error: null });
      const project = await invoke<Project>('create_project', {
        name,
        description
      });
      set((state) => ({ projects: [...state.projects, project] }));
      return project;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create project';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  openProject: async (projectId) => {
    try {
      set({ isLoading: true, error: null });
      const project = await invoke<Project>('open_project', { projectId });
      set({ currentProject: project });

      // Load documents for this project and merge with existing documents
      const newDocuments = await invoke<Document[]>('list_documents', { projectId });
      set((state) => {
        // Remove old documents for this project and add new ones
        const otherDocuments = state.documents.filter(d => d.projectId !== projectId);
        return { documents: [...otherDocuments, ...newDocuments] };
      });
    } catch (error) {
      console.error('Failed to open project:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ error: `Failed to open project: ${errorMsg}` });
    } finally {
      set({ isLoading: false });
    }
  },

  saveProject: async (project) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await invoke<Project>('save_project', { project });
      set((state) => ({
        projects: state.projects.map(p => p.id === updated.id ? updated : p),
        currentProject: state.currentProject?.id === updated.id ? updated : state.currentProject
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save project' });
    } finally {
      set({ isLoading: false });
    }
  },

  renameProject: async (projectId, newName) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await invoke<Project>('rename_project', { projectId, newName });
      set((state) => ({
        projects: state.projects.map(p => p.id === updated.id ? updated : p),
        currentProject: state.currentProject?.id === updated.id ? updated : state.currentProject
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename project' });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteProject: async (projectId) => {
    try {
      set({ isLoading: true, error: null });
      await invoke('delete_project', { projectId });
      set((state) => ({
        projects: state.projects.filter(p => p.id !== projectId),
        currentProject: state.currentProject?.id === projectId ? null : state.currentProject
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete project' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Document API
  loadDocuments: async (projectId) => {
    try {
      set({ isLoading: true, error: null });
      const documents = await invoke<Document[]>('list_documents', { projectId });
      set({ documents });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load documents' });
    } finally {
      set({ isLoading: false });
    }
  },

  createDocument: async (projectId, title, author = 'User') => {
    try {
      set({ isLoading: true, error: null });
      const document = await invoke<Document>('create_document', {
        projectId,
        title,
        author
      });
      set((state) => ({
        documents: [...state.documents, document],
        currentDocument: document
      }));
      return document;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create document';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  saveDocument: async (document) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await invoke<Document>('save_document', {
        documentId: document.id,
        projectId: document.projectId,
        title: document.title,
        content: document.content,
        authorNotes: document.authorNotes,
        aiGeneratedContent: document.aiGeneratedContent,
        attachments: document.attachments || undefined,
        pluginData: document.pluginData || undefined,
        enabledPlugins: document.enabledPlugins || undefined,
        composedContent: document.composedContent || undefined,
        aiServiceId: document.aiServiceId || undefined
      });
      set((state) => ({
        documents: state.documents.map(d => d.id === updated.id ? updated : d),
        currentDocument: state.currentDocument?.id === updated.id ? updated : state.currentDocument
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save document' });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteDocument: async (projectId, documentId) => {
    try {
      set({ isLoading: true, error: null });
      await invoke('delete_document', { projectId, documentId });
      set((state) => ({
        documents: state.documents.filter(d => d.id !== documentId),
        currentDocument: state.currentDocument?.id === documentId ? null : state.currentDocument
      }));
      // 关闭引用该文档的标签（不保存）
      const { tabs, closeTab } = get();
      const tabsToClose = tabs.filter(t => t.documentId === documentId);
      for (const tab of tabsToClose) {
        await closeTab(tab.id, false);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete document' });
    } finally {
      set({ isLoading: false });
    }
  },

  renameDocument: async (projectId, documentId, newTitle) => {
    try {
      set({ isLoading: true, error: null });
      const updated = await invoke<Document>('rename_document', {
        projectId,
        documentId,
        newTitle
      });
      set((state) => ({
        documents: state.documents.map(d => d.id === updated.id ? updated : d),
        currentDocument: state.currentDocument?.id === updated.id ? updated : state.currentDocument,
        tabs: state.tabs.map(tab =>
          tab.documentId === updated.id ? { ...tab, title: updated.title } : tab
        ),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to rename document' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 项目导出为 ZIP
  exportProjectZip: async (projectId, outputPath) => {
    try {
      const result = await invoke<string>('export_project_zip', { projectId, outputPath });
      return result;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : i18n.t('store.exportProjectFailed') });
      throw error;
    }
  },

  // 从 ZIP 导入项目
  importProjectZip: async (zipPath) => {
    try {
      set({ isLoading: true, error: null });
      const project = await invoke<Project>('import_project_zip', { zipPath });
      // 刷新项目列表
      const projects = await invoke<Project[]>('list_projects');
      set({ projects, isLoading: false });
      return project;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : i18n.t('store.importProjectFailed'), isLoading: false });
      throw error;
    }
  },

  // 移动文档到另一个项目
  moveDocumentToProject: async (documentId, fromProjectId, toProjectId) => {
    try {
      set({ isLoading: true, error: null });
      const movedDoc = await invoke<Document>('move_document', { documentId, fromProjectId, toProjectId });

      // 关闭该文档的标签页（因为 projectId 已变）
      const { tabs, closeTab } = get();
      const tab = tabs.find(t => t.documentId === documentId);
      if (tab) {
        await closeTab(tab.id, false);
      }

      // 刷新两个项目的文档列表
      const fromDocs = await invoke<Document[]>('list_documents', { projectId: fromProjectId });
      const toDocs = await invoke<Document[]>('list_documents', { projectId: toProjectId });
      set((state) => {
        const otherDocs = state.documents.filter(d => d.projectId !== fromProjectId && d.projectId !== toProjectId);
        return { documents: [...otherDocs, ...fromDocs, ...toDocs], isLoading: false };
      });
      return movedDoc;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : i18n.t('store.moveDocFailed'), isLoading: false });
      throw error;
    }
  },

  // 复制文档到另一个项目
  copyDocumentToProject: async (documentId, fromProjectId, toProjectId) => {
    try {
      set({ isLoading: true, error: null });
      const newDoc = await invoke<Document>('copy_document', { documentId, fromProjectId, toProjectId });

      // 刷新目标项目的文档列表
      const toDocs = await invoke<Document[]>('list_documents', { projectId: toProjectId });
      set((state) => {
        const otherDocs = state.documents.filter(d => d.projectId !== toProjectId);
        return { documents: [...otherDocs, ...toDocs], isLoading: false };
      });
      return newDoc;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : i18n.t('store.copyDocFailed'), isLoading: false });
      throw error;
    }
  },

  // Version API
  loadVersions: async (projectId, documentId) => {
    try {
      set({ isLoading: true, error: null });
      const versions = await invoke<DocumentVersion[]>('list_versions', {
        projectId,
        documentId
      });
      return versions;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load versions' });
      return [];
    } finally {
      set({ isLoading: false });
    }
  },

  createVersion: async (projectId, documentId, content, authorNotes, aiGeneratedContent, createdBy, changeDescription, pluginData, enabledPlugins, composedContent) => {
    try {
      set({ isLoading: true, error: null });
      const versionId = await invoke<string>('create_version', {
        projectId,
        documentId,
        content,
        authorNotes,
        aiGeneratedContent,
        createdBy,
        changeDescription,
        pluginData: pluginData || undefined,
        enabledPlugins: enabledPlugins || undefined,
        composedContent: composedContent || undefined
      });

      // Reload document to get updated versions
      const document = await invoke<Document>('get_document', {
        projectId,
        documentId
      });
      set((state) => ({
        documents: state.documents.map(d => d.id === document.id ? document : d),
        currentDocument: state.currentDocument?.id === document.id ? document : state.currentDocument
      }));

      return versionId;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create version' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  restoreVersion: async (projectId, documentId, versionId, createBackup) => {
    try {
      set({ isLoading: true, error: null });

      const restored = await invoke<Document>('restore_version', {
        projectId,
        documentId,
        versionId,
        createBackup
      });

      set((state) => ({
        documents: state.documents.map(d => d.id === restored.id ? restored : d),
        currentDocument: state.currentDocument?.id === restored.id ? restored : state.currentDocument
      }));

      // 通知编辑器刷新内容
      window.dispatchEvent(new CustomEvent('version-restored', { detail: { documentId, document: restored } }));

      return restored;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to restore version' });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // 文档标签管理
  updateDocumentTags: async (projectId, documentId, tags) => {
    try {
      const updated = await invoke<Document>('update_document_tags', { projectId, documentId, tags });
      set((state) => ({
        documents: state.documents.map(d => d.id === updated.id ? updated : d),
        currentDocument: state.currentDocument?.id === updated.id ? updated : state.currentDocument
      }));
      return updated;
    } catch (error) {
      console.error('Failed to update document tags:', error);
      throw error;
    }
  },

  loadAllTags: async (projectId) => {
    try {
      const tags = await invoke<string[]>('list_all_tags', { projectId: projectId ?? null });
      // 过滤掉内部标签（以 _ 开头）
      const visibleTags = tags.filter(t => !t.startsWith('_'));
      set({ allTags: visibleTags });
      return visibleTags;
    } catch (error) {
      console.error('Failed to load all tags:', error);
      return [];
    }
  },

  toggleDocumentStarred: async (projectId, documentId) => {
    try {
      const updated = await invoke<Document>('toggle_document_starred', { projectId, documentId });
      set((state) => ({
        documents: state.documents.map(d => d.id === updated.id ? updated : d),
        currentDocument: state.currentDocument?.id === updated.id ? updated : state.currentDocument
      }));
      return updated;
    } catch (error) {
      console.error('Failed to toggle document starred:', error);
      throw error;
    }
  },

  // 文档排序与筛选
  setDocumentSort: (sortBy, sortOrder) => {
    set((state) => ({
      documentSortBy: sortBy,
      documentSortOrder: sortOrder ?? (state.documentSortBy === sortBy ? (state.documentSortOrder === 'asc' ? 'desc' : 'asc') : 'desc'),
    }));
  },

  setDocumentFilterTag: (tag) => set({ documentFilterTag: tag }),

  // AI Setters
  getAiMessages: (tabId) => get().aiMessagesByTab[tabId] || [],
  setAiMessages: (tabId, messages) => set((state) => ({
    aiMessagesByTab: { ...state.aiMessagesByTab, [tabId]: messages }
  })),
  addAiMessage: (tabId, message) => set((state) => ({
    aiMessagesByTab: { ...state.aiMessagesByTab, [tabId]: [...(state.aiMessagesByTab[tabId] || []), message] }
  })),
  updateLastAiMessage: (tabId, fields) => set((state) => {
    const msgs = state.aiMessagesByTab[tabId] || [];
    if (msgs.length === 0) return state;
    const updated = [...msgs];
    updated[updated.length - 1] = { ...updated[updated.length - 1], ...fields };
    return { aiMessagesByTab: { ...state.aiMessagesByTab, [tabId]: updated } };
  }),
  clearAiMessages: (tabId) => set((state) => ({
    aiMessagesByTab: { ...state.aiMessagesByTab, [tabId]: [] }
  })),
  setAiStreaming: (isAiStreaming, tabId) => set({ isAiStreaming, aiStreamingTabId: isAiStreaming ? (tabId ?? null) : null }),
  stopAiStreaming: () => {
    const { aiStreamingTabId, streamStateByTab } = get();

    // 停止当前活动流的监听器
    if (aiStreamingTabId) {
      const streamState = streamStateByTab[aiStreamingTabId];
      if (streamState?.unlistenFn) {
        streamState.unlistenFn();
      }

      // 更新该标签页的流状态
      set((state) => ({
        streamStateByTab: {
          ...state.streamStateByTab,
          [aiStreamingTabId]: {
            unlistenFn: null,
            aborted: true,
            sessionId: (state.streamStateByTab[aiStreamingTabId]?.sessionId ?? 0) + 1,
            requestId: null,
          }
        }
      }));

      // 通知后端中断 HTTP 流
      if (streamStateByTab[aiStreamingTabId]?.requestId) {
        invoke('stop_ai_stream', { requestId: streamStateByTab[aiStreamingTabId].requestId }).catch(() => {});
      }
    }

    // 也调用无参数版本以兼容旧的后端
    invoke('stop_ai_stream').catch(() => {});
    set({ isAiStreaming: false, aiStreamingTabId: null });
  },
  // AI Actions（流式聊天，支持停止）
  sendChatMessage: async (tabId, content, enableWebSearch, contextInfo, enableTools) => {
    // 获取当前标签页的流状态
    const currentStreamState = get().streamStateByTab[tabId] || {
      unlistenFn: null,
      aborted: false,
      sessionId: 0,
      requestId: null,
    };

    // 清理上一次可能残留的监听器
    if (currentStreamState.unlistenFn) {
      currentStreamState.unlistenFn();
    }

    // 初始化新的流状态
    const newSessionId = currentStreamState.sessionId + 1;
    const requestId = `chat_${Date.now()}_${newSessionId}`;

    set((state) => ({
      streamStateByTab: {
        ...state.streamStateByTab,
        [tabId]: {
          unlistenFn: null,
          aborted: false,
          sessionId: newSessionId,
          requestId,
        }
      }
    }));

    let unlisten: (() => void) | null = null;
    // 提前声明，供 try/catch 共用
    let accumulatedContent = '';
    let chatThrottleTimer: ReturnType<typeof setTimeout> | null = null;
    const flushChatChunk = () => {
      chatThrottleTimer = null;
      const msgs = get().aiMessagesByTab[tabId] || [];
      if (msgs.length === 0) return;
      const updated = [...msgs];
      updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulatedContent };
      set((state) => ({
        aiMessagesByTab: { ...state.aiMessagesByTab, [tabId]: updated }
      }));
    };

    try {
      set({ isAiStreaming: true, aiStreamingTabId: tabId, error: null });

      // Add user message
      const userMessage: AIMessage = {
        role: 'user',
        content,
        timestamp: Date.now() / 1000
      };
      get().addAiMessage(tabId, userMessage);

      // Get conversation history and AI settings
      const tabMessages = get().aiMessagesByTab[tabId] || [];
      const aiSettings = useSettingsStore.getState().ai;

      // 构建消息列表，包含可选的 角色prompt + 用户prompt + markdownMode 格式约束
      const messages: { role: string; content: string }[] = [];
      const rolePrompt = getRoleSystemPrompt();
      const userSystemPrompt = aiSettings.systemPrompt?.trim() || '';
      const mdPrompt = aiSettings.markdownMode ? getMarkdownModePrompt() : '';
      const combinedSystemPrompt = [rolePrompt, userSystemPrompt, mdPrompt].filter(Boolean).join('\n\n');
      if (combinedSystemPrompt) {
        messages.push({ role: 'system', content: combinedSystemPrompt });
      }
      // 注入聊天上下文（素材/提示词/正文）
      if (contextInfo && contextInfo.mode !== 'none' && contextInfo.content?.trim()) {
        const contextLabels: Record<string, string> = {
          material: i18n.t('store.contextMaterial'),
          prompt: i18n.t('store.contextPrompt'),
          generated: i18n.t('store.contextGenerated'),
        };
        const label = contextLabels[contextInfo.mode] || i18n.t('store.contextDefault');
        messages.push({
          role: 'system',
          content: i18n.t('store.contextUserLabel', { label }) + `\n\n${contextInfo.content}`,
        });
      }
      messages.push(...tabMessages.map((m: AIMessage) => ({
        role: m.role,
        content: m.content
      })));

      const assistantContextMode = contextInfo?.mode && contextInfo.mode !== 'none' ? contextInfo.mode : undefined;

      // 添加一条占位 assistant 消息，后续流式更新
      const placeholderMessage: AIMessage = {
        role: 'assistant',
        content: '',
        timestamp: Date.now() / 1000,
        contextMode: assistantContextMode,
      };
      get().addAiMessage(tabId, placeholderMessage);

      // 设置流式事件监听（节流：批量累积 chunk，~80ms 刷新一次 store）
      unlisten = await listen<{ request_id: string; content: string }>('ai:stream:chunk', (event) => {
        const streamState = get().streamStateByTab[tabId];
        if (!streamState || streamState.aborted || streamState.sessionId !== newSessionId) return;
        if (event.payload.request_id !== requestId) return;
        accumulatedContent += event.payload.content;
        // 节流更新 store
        if (!chatThrottleTimer) {
          chatThrottleTimer = setTimeout(flushChatChunk, 80);
        }
      });

      // 更新流状态中的 unlisten 函数
      set((state) => ({
        streamStateByTab: {
          ...state.streamStateByTab,
          [tabId]: {
            ...state.streamStateByTab[tabId],
            unlistenFn: unlisten,
          }
        }
      }));

      // 获取文档级 AI 服务绑定
      const chatTab = get().tabs.find(t => t.id === tabId);
      const chatDoc = chatTab ? get().documents.find(d => d.id === chatTab.documentId) : null;
      const aiParams = getAIInvokeParamsForService(chatDoc?.aiServiceId);
      await invoke<string>('chat_stream', {
        messages,
        ...aiParams,
        enableWebSearch: enableWebSearch || undefined,
        enableThinking: aiSettings.enableThinking || undefined,
        enableTools: enableTools || undefined,
        requestId
      });

      // 刷新残余的节流 chunk
      if (chatThrottleTimer) { clearTimeout(chatThrottleTimer); flushChatChunk(); }

      set({ isAiStreaming: false, aiStreamingTabId: null });
      return accumulatedContent;
    } catch (error) {
      // 刷新残余的节流 chunk
      if (chatThrottleTimer) { clearTimeout(chatThrottleTimer); flushChatChunk(); }
      set({ isAiStreaming: false, aiStreamingTabId: null });
      // 如果是被用户主动停止的，不抛错
      const streamState = get().streamStateByTab[tabId];
      if (streamState?.aborted) return '';
      const errorMsg = error instanceof Error ? error.message : 'Failed to send message';
      set({ error: errorMsg });
      throw error;
    } finally {
      if (unlisten) {
        unlisten();
      }
      // 清理流状态中的 unlisten 函数
      set((state) => ({
        streamStateByTab: {
          ...state.streamStateByTab,
          [tabId]: {
            ...state.streamStateByTab[tabId],
            unlistenFn: null,
            requestId: null,
          }
        }
      }));
    }
  },

  generateContent: async (authorNotes, currentContent) => {
    try {
      set({ isAiStreaming: true, error: null });
      // 注意：非流式模式下 aiStreamingTabId 由 ChatPanel 在调用前设置

      // 获取文档级 AI 服务绑定
      const genTab = get().tabs.find(t => t.id === get().aiStreamingTabId);
      const genDoc = genTab ? get().documents.find(d => d.id === genTab.documentId) : null;
      const aiParams = getAIInvokeParamsForService(genDoc?.aiServiceId);
      const generated = await invoke<string>('generate_content', {
        authorNotes,
        currentContent,
        ...aiParams,
      });

      return generated;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to generate content';
      set({ error: errorMsg });
      throw error;
    } finally {
      set({ isAiStreaming: false, aiStreamingTabId: null });
    }
  },

  generateContentStream: async (authorNotes, currentContent, onChunk, conversationHistory, enableWebSearch) => {
    const { aiStreamingTabId } = get();
    const tabId = aiStreamingTabId || 'default';

    // 获取当前标签页的流状态
    const currentStreamState = get().streamStateByTab[tabId] || {
      unlistenFn: null,
      aborted: false,
      sessionId: 0,
      requestId: null,
    };

    // 清理上一次可能残留的监听器
    if (currentStreamState.unlistenFn) {
      currentStreamState.unlistenFn();
    }

    // 初始化新的流状态
    const newSessionId = currentStreamState.sessionId + 1;
    const requestId = `req_${Date.now()}_${newSessionId}`;

    set((state) => ({
      streamStateByTab: {
        ...state.streamStateByTab,
        [tabId]: {
          unlistenFn: null,
          aborted: false,
          sessionId: newSessionId,
          requestId,
        }
      }
    }));

    let unlisten: (() => void) | null = null;

    try {
      set({ isAiStreaming: true, error: null });

      // Get AI settings from useSettingsStore
      const aiSettings = useSettingsStore.getState().ai;

      // Set up event listener for streaming chunks
      // 使用 requestId 确保只处理当前流的事件，彻底忽略旧后端流的残留
      unlisten = await listen<{ request_id: string; content: string }>('ai:stream:chunk', (event) => {
        const streamState = get().streamStateByTab[tabId];
        if (!streamState || streamState.aborted || streamState.sessionId !== newSessionId) return;
        // 只接受匹配当前 requestId 的事件
        if (event.payload.request_id !== requestId) return;
        onChunk(event.payload.content);
      });

      // 更新流状态中的 unlisten 函数
      set((state) => ({
        streamStateByTab: {
          ...state.streamStateByTab,
          [tabId]: {
            ...state.streamStateByTab[tabId],
            unlistenFn: unlisten,
          }
        }
      }));

      // Convert conversation history to backend format
      const historyForBackend = conversationHistory?.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // 获取文档级 AI 服务绑定
      const streamTab = get().tabs.find(t => t.id === tabId);
      const streamDoc = streamTab ? get().documents.find(d => d.id === streamTab.documentId) : null;
      const aiParams = getAIInvokeParamsForService(streamDoc?.aiServiceId);
      const invokeParams = {
        authorNotes,
        currentContent,
        ...aiParams,
        conversationHistory: historyForBackend || undefined,
        systemPrompt: (() => {
          const roleSp = getRoleSystemPrompt();
          const userSp = aiSettings.systemPrompt?.trim() || '';
          const mdSp = aiSettings.markdownMode ? getMarkdownModePrompt() : '';
          const combined = [roleSp, userSp, mdSp].filter(Boolean).join('\n\n');
          return combined || undefined;
        })(),
        enableWebSearch: enableWebSearch || undefined,
        enableThinking: aiSettings.enableThinking || undefined,
        requestId
      };

      // Invoke the streaming command with conversation history
      await invoke<string>('generate_content_stream', invokeParams);

      set({ isAiStreaming: false, aiStreamingTabId: null });
      return '';
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to generate content', isAiStreaming: false, aiStreamingTabId: null });
      throw error;
    } finally {
      // 无论成功、失败还是中断，都确保清理监听器
      if (unlisten) {
        unlisten();
      }
      // 清理流状态中的 unlisten 函数
      set((state) => ({
        streamStateByTab: {
          ...state.streamStateByTab,
          [tabId]: {
            ...state.streamStateByTab[tabId],
            unlistenFn: null,
            requestId: null,
          }
        }
      }));
    }
  },

  // Update document fields in memory only (no disk write), so ChatPanel can read latest content
  updateDocumentInMemory: (documentId, fields) => {
    set((state) => {
      // 原子更新 documents 和 currentDocument
      const updatedDocuments = state.documents.map(d =>
        d.id === documentId ? { ...d, ...fields } : d
      );

      // 如果正在更新当前文档，同步更新 currentDocument
      let updatedCurrentDocument = state.currentDocument;
      if (state.currentDocument?.id === documentId) {
        const updatedDoc = updatedDocuments.find(d => d.id === documentId);
        if (updatedDoc) {
          updatedCurrentDocument = updatedDoc;
        }
      }

      // 确保一致性
      const { documents, currentDocument } = ensureDocumentConsistency(
        updatedDocuments,
        updatedCurrentDocument
      );

      return { documents, currentDocument };
    });
  },

  // Convenience method to update AI generated content without overwriting other fields
  updateAiGeneratedContent: async (aiContent, originalContent) => {
    const { currentDocument, saveDocument } = get();
    if (!currentDocument) return;

    await saveDocument({
      ...currentDocument,
      content: originalContent ?? currentDocument.content,
      aiGeneratedContent: aiContent
    });
  },

  // Plugin: update document's enabled plugins list
  updateDocumentEnabledPlugins: (documentId, pluginIds) => {
    set((state) => {
      const updateDoc = (doc: Document): Document => ({
        ...doc,
        enabledPlugins: pluginIds,
      });
      return {
        documents: state.documents.map(d =>
          d.id === documentId ? updateDoc(d) : d
        ),
        currentDocument: state.currentDocument?.id === documentId
          ? updateDoc(state.currentDocument)
          : state.currentDocument
      };
    });
  },

  // Plugin: update plugin data in memory (generic for all plugins)
  updatePluginData: (documentId, pluginId, data) => {
    set((state) => {
      const updateDoc = (doc: Document): Document => {
        const existing = doc.pluginData || {};
        const updated = data != null
          ? { ...existing, [pluginId]: data }
          : (() => { const { [pluginId]: _, ...rest } = existing; return Object.keys(rest).length > 0 ? rest : undefined; })();
        return { ...doc, pluginData: updated };
      };
      return {
        documents: state.documents.map(d =>
          d.id === documentId ? updateDoc(d) : d
        ),
        currentDocument: state.currentDocument?.id === documentId
          ? updateDoc(state.currentDocument)
          : state.currentDocument
      };
    });
  },

  // Load plugin manifests from backend
  loadPlugins: async () => {
    try {
      // 先将前端发现的 manifest 同步到后端磁盘
      await syncManifestsToBackend();
      const manifests = await invoke<PluginManifest[]>('list_plugins');
      set({ pluginManifests: manifests });
      const plugins = buildPluginList(manifests);
      setPlugins(plugins);
      return manifests;
    } catch (error) {
      console.error('Failed to load plugins:', error);
      return [];
    }
  },

  // Template methods
  loadTemplates: async () => {
    try {
      const templates = await invoke<TemplateManifest[]>('list_templates');
      set({ templates });
      return templates;
    } catch (error) {
      console.error('Failed to load templates:', error);
      return [];
    }
  },

  createDocumentFromTemplate: async (projectId, templateId, title, author = 'User') => {
    try {
      set({ isLoading: true, error: null });
      const document = await invoke<Document>('create_document_from_template', {
        projectId, templateId, title, author,
      });
      // 重新加载文档列表
      const documents = await invoke<Document[]>('list_documents', { projectId });
      set({ documents, isLoading: false });
      return document;
    } catch (error) {
      set({ isLoading: false, error: String(error) });
      throw error;
    }
  },

  saveAsTemplate: async (projectId, documentId, name, description, category, includeContent, includeAiContent, includePluginData) => {
    try {
      const template = await invoke<TemplateManifest>('save_template_from_document', {
        projectId, documentId,
        templateName: name,
        templateDescription: description,
        templateCategory: category,
        includeContent, includeAiContent, includePluginData,
      });
      // 刷新模板列表
      const templates = await invoke<TemplateManifest[]>('list_templates');
      set({ templates });
      return template;
    } catch (error) {
      console.error('Failed to save as template:', error);
      throw error;
    }
  },

  deleteTemplate: async (templateId) => {
    try {
      await invoke('delete_template', { templateId });
      const templates = await invoke<TemplateManifest[]>('list_templates');
      set({ templates });
    } catch (error) {
      console.error('Failed to delete template:', error);
      throw error;
    }
  },

  duplicateTemplate: async (templateId, newName) => {
    try {
      const template = await invoke<TemplateManifest>('duplicate_template', { templateId, newName });
      const templates = await invoke<TemplateManifest[]>('list_templates');
      set({ templates });
      return template;
    } catch (error) {
      console.error('Failed to duplicate template:', error);
      throw error;
    }
  },

  updateTemplate: async (templateId, fields) => {
    try {
      const template = await invoke<TemplateManifest>('update_template', {
        templateId,
        name: fields.name ?? null,
        description: fields.description ?? null,
        category: fields.category ?? null,
        icon: fields.icon ?? null,
        tags: fields.tags ?? null,
        content: null,
      });
      const templates = await invoke<TemplateManifest[]>('list_templates');
      set({ templates });
      return template;
    } catch (error) {
      console.error('Failed to update template:', error);
      throw error;
    }
  },

  // Template category methods
  loadTemplateCategories: async () => {
    try {
      const templateCategories = await invoke<TemplateCategory[]>('list_template_categories');
      set({ templateCategories });
      return templateCategories;
    } catch (error) {
      console.error('Failed to load template categories:', error);
      return [];
    }
  },

  createTemplateCategory: async (key, label) => {
    const templateCategories = await invoke<TemplateCategory[]>('create_template_category', { key, label });
    set({ templateCategories });
    return templateCategories;
  },

  updateTemplateCategory: async (key, label, newKey) => {
    const templateCategories = await invoke<TemplateCategory[]>('update_template_category', {
      key, label: label ?? null, newKey: newKey ?? null,
    });
    set({ templateCategories });
    return templateCategories;
  },

  deleteTemplateCategory: async (key) => {
    const templateCategories = await invoke<TemplateCategory[]>('delete_template_category', { key });
    set({ templateCategories });
    return templateCategories;
  },

  reorderTemplateCategories: async (orderedKeys) => {
    const templateCategories = await invoke<TemplateCategory[]>('reorder_template_categories', { orderedKeys });
    set({ templateCategories });
    return templateCategories;
  },

  // Workspace persistence methods
  saveWorkspaceState: async () => {
    const state = get();

    // 只有在有项目打开时才保存状态
    if (!state.currentProject) {
      return;
    }

    const workspaceState: WorkspaceState = {
      currentProjectId: state.currentProject?.id ?? null,
      openDocumentIds: state.tabs.map(t => t.documentId),
      currentDocumentId: state.currentDocument?.id ?? null,
      tabs: state.tabs.map(({ id, documentId, panelState }) => {
        const doc = state.documents.find(d => d.id === documentId);
        return { id, documentId, projectId: doc?.projectId, panelState };
      }),
      activeTabId: state.activeTabId,
      uiState: {
        sidebarOpen: state.sidebarOpen,
        chatOpen: state.chatOpen,
        sidebarWidth: state.sidebarWidth,
      },
      lastSavedAt: Date.now(),
    };

    // 始终保存到 localStorage 作为备用
    try {
      localStorage.setItem('aidocplus-workspace', JSON.stringify(workspaceState));
    } catch (e) {
      console.error('[Workspace] Failed to save to localStorage:', e);
    }

    // Tauri 环境额外保存到后端
    if (isTauri()) {
      try {
        await invoke('save_workspace', {
          currentProjectId: workspaceState.currentProjectId,
          openDocumentIds: workspaceState.openDocumentIds,
          currentDocumentId: workspaceState.currentDocumentId,
          tabs: workspaceState.tabs,
          activeTabId: workspaceState.activeTabId,
          uiState: workspaceState.uiState,
        });
      } catch (e) {
        console.error('[Workspace] Failed to save via Tauri:', e);
      }
    }
  },

  loadWorkspaceState: async () => {
    // 优先从 Tauri 后端加载
    if (isTauri()) {
      try {
        const state = await invoke<WorkspaceState | null>('load_workspace');
        if (state) {
          return state;
        }
      } catch (error) {
        console.error('[Workspace] Failed to load from Tauri:', error);
      }
    }

    // 备用：从 localStorage 加载
    try {
      const saved = localStorage.getItem('aidocplus-workspace');
      if (saved) {
        return JSON.parse(saved) as WorkspaceState;
      }
    } catch (error) {
      console.error('[Workspace] Failed to load from localStorage:', error);
    }

    return null;
  },

  restoreWorkspace: async () => {
    const { loadProjects, openProject, setSidebarOpen, setChatOpen } = get();

    try {
      await loadProjects();

      // 首次运行：没有任何项目时，创建默认项目和试验文档
      if (get().projects.length === 0) {
        try {
          const { createProject, openProject: openProj, createDocument, saveDocument: savDoc, openTab } = get();
          const project = await createProject('初始印象', '这是系统自动创建的默认项目，您可以在此体验 AiDocPlus 的功能。');
          await openProj(project.id);

          const sampleContent = [
            '# 欢迎使用 AiDocPlus',
            '',
            '这是一篇示例文档，帮助您快速了解 AiDocPlus 的核心功能。',
            '',
            '## 什么是 AiDocPlus？',
            '',
            'AiDocPlus 是一款 AI 辅助文档创作工具。您可以在左侧的**素材内容**区域撰写文稿，然后通过 AI 助手对内容进行润色、扩写、翻译等操作，AI 生成的结果会显示在**正文内容**区域。',
            '',
            '## 快速开始',
            '',
            '1. 在下方的**素材内容**编辑器中编写或修改文字',
            '2. 点击右上角的 💬 按钮打开 **AI 助手**面板',
            '3. 在 AI 助手中输入指令，例如"帮我润色这段文字"',
            '4. AI 生成的内容会出现在上方的 **正文内容**区域',
            '5. 如果满意，可以点击"采纳"将 AI 内容替换或追加到素材内容',
            '',
            '## 使用前准备',
            '',
            '请先在**设置**中配置您的 AI 服务 API：',
            '',
            '- 点击右上角的 ⚙️ 设置按钮',
            '- 在 **AI 设置**中填入 API 地址和密钥',
            '- 选择合适的模型',
            '',
            '配置完成后，回到本文档即可开始体验！',
            '',
            '---',
            '',
            '以下是一段示例文字，您可以让 AI 对其进行润色：',
            '',
            '> 今天天气很好，我去公园散步了。公园里有很多花，红的黄的紫的，很漂亮。还看到几个小朋友在放风筝，风筝飞得很高。我在长椅上坐了一会儿，感觉很放松。',
          ].join('\n');

          const authorNotes = [
            '请对上面引用的段落进行文学润色，要求：',
            '1. 使用更优美的词汇和修辞手法',
            '2. 增加细节描写，让画面更生动',
            '3. 保持第一人称视角',
            '4. 字数扩展到 200 字左右',
          ].join('\n');

          // 创建试验文档并写入初始内容
          const doc = await createDocument(project.id, '快速入门指南');
          await savDoc({
            ...doc,
            content: sampleContent,
            authorNotes: authorNotes,
          });
          await openTab(doc.id);
          return;
        } catch (err) {
          console.error('[Workspace] Failed to create default project:', err);
        }
      }

      const state = await get().loadWorkspaceState();
      if (!state) {
        return;
      }

      // Restore current project
      if (state.currentProjectId) {
        const allProjects = get().projects;
        const project = allProjects.find(p => p.id === state.currentProjectId);

        if (project) {
          await openProject(project.id);

          // 收集所有标签涉及的项目 ID，精准加载跨项目文档
          if (state.tabs && state.tabs.length > 0) {
            const currentDocs = get().documents;
            const loadedProjectIds = new Set(currentDocs.map(d => d.projectId));

            // 从 tab 的 projectId 精准确定需要加载的其他项目（避免遍历所有项目）
            const neededProjectIds = new Set<string>();
            for (const tab of state.tabs) {
              if (tab.projectId && !loadedProjectIds.has(tab.projectId)) {
                neededProjectIds.add(tab.projectId);
              }
            }

            // 并行加载所需的跨项目文档
            if (neededProjectIds.size > 0) {
              const loadPromises = [...neededProjectIds].map(async (pid) => {
                try {
                  return await invoke<Document[]>('list_documents', { projectId: pid });
                } catch (e) {
                  console.error('[Workspace] Failed to load documents for project:', pid, e);
                  return [];
                }
              });
              const results = await Promise.all(loadPromises);
              const newDocs = results.flat();
              if (newDocs.length > 0) {
                set((s) => ({ documents: [...s.documents, ...newDocs] }));
              }
            } else if (!state.tabs.some(t => t.projectId)) {
              // 兼容旧版 workspace 数据（没有 projectId），回退到遍历所有项目
              const tabDocIds = new Set(state.tabs.map(t => t.documentId));
              for (const p of allProjects) {
                if (!loadedProjectIds.has(p.id)) {
                  try {
                    const docs = await invoke<Document[]>('list_documents', { projectId: p.id });
                    if (docs.some(d => tabDocIds.has(d.id))) {
                      set((s) => ({ documents: [...s.documents, ...docs] }));
                    }
                  } catch (e) {
                    console.error('[Workspace] Failed to load documents for project:', p.id, e);
                  }
                }
              }
            }

            const allDocuments = get().documents;

            const restoredTabs: EditorTab[] = [];

            for (const tabState of state.tabs) {
              const doc = allDocuments.find(d => d.id === tabState.documentId);
              if (doc) {
                restoredTabs.push({
                  ...tabState,
                  title: doc.title,
                  isDirty: false,
                  isActive: false,
                  order: restoredTabs.length
                });
              } else {
                console.warn('[Workspace] Document not found for tab:', tabState.documentId);
              }
            }

            // 设置活动标签
            const activeTabId = state.activeTabId || restoredTabs[0]?.id || null;
            const activeDocument = allDocuments.find(d => d.id === restoredTabs.find(t => t.id === activeTabId)?.documentId) || null;

            set({
              tabs: restoredTabs.map(t => ({
                ...t,
                isActive: t.id === activeTabId
              })),
              activeTabId,
              currentDocument: activeDocument
            });

          } else if (state.currentDocumentId) {
            const allDocuments = get().documents;
            const currentDoc = allDocuments.find(d => d.id === state.currentDocumentId);

            if (currentDoc) {

              // 创建单个标签
              const newTab: EditorTab = {
                id: `tab-${Date.now()}`,
                documentId: currentDoc.id,
                title: currentDoc.title,
                isDirty: false,
                isActive: true,
                order: 0,
                panelState: {
                  versionHistoryOpen: false,
                  chatOpen: state.uiState.chatOpen,
                  rightSidebarOpen: false
                }
              };

              set({
                tabs: [newTab],
                activeTabId: newTab.id,
                currentDocument: currentDoc
              });

            }
          }

        } else {
          await get().clearWorkspaceState();
        }
      }

      // Restore UI state（无论项目是否存在都恢复布局状态）
      if (state.uiState) {
        setSidebarOpen(state.uiState.sidebarOpen ?? true);
        setChatOpen(state.uiState.chatOpen ?? true);
        if (state.uiState.sidebarWidth) {
          get().setSidebarWidth(state.uiState.sidebarWidth);
        }
        // 窗口大小和位置由 tauri-plugin-window-state 自动管理
      }
    } catch (error) {
      console.error('[Workspace] Failed to restore workspace:', error);
    }
  },

  clearWorkspaceState: async () => {
    // 清理 localStorage
    try {
      localStorage.removeItem('aidocplus-workspace');
    } catch (e) {
      console.error('[Workspace] Failed to clear localStorage:', e);
    }

    // Tauri 环境额外清理后端
    if (isTauri()) {
      try {
        await invoke('clear_workspace');
      } catch (error) {
        console.error('[Workspace] Failed to clear via Tauri:', error);
      }
    }
  },

  // 标签页操作方法
  openTab: async (documentId) => {
    const { documents, tabs } = get();

    // 检查标签是否已存在
    const existingTab = tabs.find(t => t.documentId === documentId);
    if (existingTab) {
      // 标签已存在，切换到该标签
      get().switchTab(existingTab.id);
      return;
    }

    // 查找文档
    const document = documents.find(d => d.id === documentId);
    if (!document) {
      console.error('[Tabs] Document not found:', documentId);
      return;
    }

    // 创建新标签
    const newTab: EditorTab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      documentId: document.id,
      title: document.title,
      isDirty: false,
      isActive: true,
      order: tabs.length,
      panelState: {
        versionHistoryOpen: false,
        chatOpen: true,
        rightSidebarOpen: false
      }
    };

    // 更新状态：其他标签设为非活动，添加新标签，设置为活动标签
    set((state) => ({
      tabs: [
        ...state.tabs.map(t => ({ ...t, isActive: false })),
        newTab
      ],
      activeTabId: newTab.id,
      currentDocument: document
    }));

    // 自动保存工作区状态
    setTimeout(() => {
      get().saveWorkspaceState();
    }, 100);
  },

  closeTab: async (tabId, saveBeforeClose = true) => {
    const { tabs, activeTabId, documents, saveDocument } = get();

    const tabIndex = tabs.findIndex(t => t.id === tabId);
    if (tabIndex === -1) return;

    const tab = tabs[tabIndex];

    // 如果有未保存更改且要求保存，则保存
    if (tab.isDirty && saveBeforeClose) {
      const document = documents.find(d => d.id === tab.documentId);
      if (document) {
        await saveDocument(document);
      }
    }
    // 注意：saveBeforeClose=false 时直接关闭不保存

    // 移除标签
    const newTabs = tabs.filter(t => t.id !== tabId);

    // 如果关闭的是活动标签，需要切换到其他标签
    let newActiveTabId = activeTabId;
    let newCurrentDocument = get().currentDocument;

    if (activeTabId === tabId) {
      if (newTabs.length > 0) {
        // 优先选择右侧标签，如果没有则选择左侧标签
        const newIndex = Math.min(tabIndex, newTabs.length - 1);
        const newActiveTab = newTabs[newIndex];
        newActiveTabId = newActiveTab.id;
        newCurrentDocument = documents.find(d => d.id === newActiveTab.documentId) || null;
      } else {
        newActiveTabId = null;
        newCurrentDocument = null;
      }
    }

    // 清理该标签页的聊天记录
    const { aiMessagesByTab } = get();
    const newMessagesByTab = { ...aiMessagesByTab };
    delete newMessagesByTab[tabId];

    set({
      tabs: newTabs,
      activeTabId: newActiveTabId,
      currentDocument: newCurrentDocument,
      aiMessagesByTab: newMessagesByTab
    });

    // 自动保存工作区状态
    setTimeout(() => {
      get().saveWorkspaceState();
    }, 100);
  },

  closeOtherTabs: async (keepTabId) => {
    const { tabs, closeTab } = get();
    const otherTabs = tabs.filter(t => t.id !== keepTabId);

    // 关闭其他所有标签
    for (const tab of otherTabs) {
      await closeTab(tab.id, true);
    }
  },

  closeAllTabs: async () => {
    const { tabs, closeTab } = get();

    // 从右到左关闭所有标签（避免索引问题）
    for (let i = tabs.length - 1; i >= 0; i--) {
      await closeTab(tabs[i].id, true);
    }
  },

  switchTab: (tabId) => {
    const { tabs, documents } = get();
    const tab = tabs.find(t => t.id === tabId);

    if (!tab) {
      console.error('[Tabs] Tab not found:', tabId);
      return;
    }

    const document = documents.find(d => d.id === tab.documentId);

    // 更新标签活动状态
    set((state) => ({
      tabs: state.tabs.map(t => ({
        ...t,
        isActive: t.id === tabId
      })),
      activeTabId: tabId,
      currentDocument: document || null
    }));

    // 保存工作区状态
    setTimeout(() => { get().saveWorkspaceState(); }, 100);
  },

  moveTab: (fromIndex, toIndex) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);

      // 更新所有标签的 order 属性
      return {
        tabs: newTabs.map((tab, index) => ({
          ...tab,
          order: index
        }))
      };
    });

    // 保存工作区状态
    setTimeout(() => { get().saveWorkspaceState(); }, 100);
  },

  setTabPanelState: (tabId, panel, value) => {
    set((state) => ({
      tabs: state.tabs.map(t =>
        t.id === tabId
          ? { ...t, panelState: { ...t.panelState, [panel]: value } }
          : t
      )
    }));

    // 保存工作区状态
    setTimeout(() => { get().saveWorkspaceState(); }, 100);
  },

  checkUnsavedChanges: (tabId) => {
    const { tabs } = get();
    const tab = tabs.find(t => t.id === tabId);
    return tab?.isDirty || false;
  },

  markTabAsDirty: (tabId) => {
    const { tabs } = get();
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.isDirty) return; // 已经是 dirty，跳过不必要的 store 更新
    set((state) => ({
      tabs: state.tabs.map(t =>
        t.id === tabId ? { ...t, isDirty: true } : t
      )
    }));
  },

  markTabAsClean: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map(t =>
        t.id === tabId ? { ...t, isDirty: false } : t
      )
    }));
  },

  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId) || null;
  },

  getTabByDocumentId: (documentId) => {
    const { tabs } = get();
    return tabs.find(t => t.documentId === documentId);
  }
}));
