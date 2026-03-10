import type { Document, EditorTab, WorkspaceState } from '@aidocplus/shared-types';
import { createEditorTab } from './useAppStore.tabs.helpers';

export interface WorkspacePersistenceStateSlice {
  currentProject: { id: string } | null;
  tabs: EditorTab[];
  documents: Document[];
  currentDocument: Document | null;
  activeTabId: string | null;
  sidebarOpen: boolean;
  chatOpen: boolean;
  sidebarWidth: number;
}

export function buildWorkspaceStateSnapshot(state: WorkspacePersistenceStateSlice): WorkspaceState {
  return {
    currentProjectId: state.currentProject?.id ?? null,
    openDocumentIds: state.tabs.map(tab => tab.documentId),
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
}

export function collectWorkspaceNeededProjectIds(
  tabStates: WorkspaceState['tabs'],
  currentDocuments: Document[]
): string[] {
  const loadedProjectIds = new Set(currentDocuments.map(doc => doc.projectId));
  const neededProjectIds = new Set<string>();

  for (const tab of tabStates) {
    if (tab.projectId && !loadedProjectIds.has(tab.projectId)) {
      neededProjectIds.add(tab.projectId);
    }
  }

  return [...neededProjectIds];
}

export function hasWorkspaceProjectIds(tabStates: WorkspaceState['tabs']): boolean {
  return tabStates.some(tab => !!tab.projectId);
}

export function collectWorkspaceTabDocumentIds(tabStates: WorkspaceState['tabs']): Set<string> {
  return new Set(tabStates.map(tab => tab.documentId));
}

export function markActiveWorkspaceTabs(tabs: EditorTab[], activeTabId: string | null): EditorTab[] {
  return tabs.map(tab => ({
    ...tab,
    isActive: tab.id === activeTabId,
  }));
}

export function createSingleRestoredTab(document: Document, chatOpen = true): EditorTab {
  return createEditorTab(document, {
    id: `tab-${Date.now()}`,
    order: 0,
    isActive: true,
    chatOpen,
  });
}

export function buildRestoredWorkspaceTabsState(
  tabs: EditorTab[],
  activeTabId: string | null,
  currentDocument: Document | null,
): {
  tabs: EditorTab[];
  activeTabId: string | null;
  currentDocument: Document | null;
} {
  return {
    tabs: markActiveWorkspaceTabs(tabs, activeTabId),
    activeTabId,
    currentDocument,
  };
}

export function resolveWorkspaceUiRestore(uiState?: WorkspaceState['uiState'] | null): {
  sidebarOpen: boolean;
  chatOpen: boolean;
  sidebarWidth?: number;
} {
  return {
    sidebarOpen: uiState?.sidebarOpen ?? true,
    chatOpen: uiState?.chatOpen ?? true,
    sidebarWidth: uiState?.sidebarWidth,
  };
}
