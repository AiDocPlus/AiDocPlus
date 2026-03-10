import type { Document, EditorTab, WorkspaceState } from '@aidocplus/shared-types';

export function createDefaultTabPanelState(chatOpen = true): EditorTab['panelState'] {
  return {
    versionHistoryOpen: false,
    chatOpen,
    rightSidebarOpen: false,
  };
}

export function createEditorTab(
  document: Document,
  options: {
    order: number;
    id?: string;
    isActive?: boolean;
    chatOpen?: boolean;
    panelState?: Partial<EditorTab['panelState']>;
  }
): EditorTab {
  return {
    id: options.id ?? `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    documentId: document.id,
    title: document.title,
    isDirty: false,
    isActive: options.isActive ?? true,
    order: options.order,
    panelState: {
      ...createDefaultTabPanelState(options.chatOpen ?? true),
      ...options.panelState,
    },
  };
}

export function buildRestoredTabs(
  tabStates: WorkspaceState['tabs'],
  documents: Document[]
): { restoredTabs: EditorTab[]; missingDocumentIds: string[] } {
  const restoredTabs: EditorTab[] = [];
  const missingDocumentIds: string[] = [];

  for (const tabState of tabStates) {
    const document = documents.find(d => d.id === tabState.documentId);
    if (!document) {
      missingDocumentIds.push(tabState.documentId);
      continue;
    }

    restoredTabs.push({
      ...tabState,
      title: document.title,
      isDirty: false,
      isActive: false,
      order: restoredTabs.length,
    });
  }

  return { restoredTabs, missingDocumentIds };
}

export function resolveActiveTabState(
  tabs: EditorTab[],
  documents: Document[],
  preferredActiveTabId: string | null
): { activeTabId: string | null; currentDocument: Document | null } {
  const activeTabId = preferredActiveTabId || tabs[0]?.id || null;
  const activeDocument = documents.find(
    d => d.id === tabs.find(t => t.id === activeTabId)?.documentId
  ) || null;

  return { activeTabId, currentDocument: activeDocument };
}

export function scheduleWorkspaceSave(saveWorkspaceState: () => Promise<void>): void {
  setTimeout(() => {
    void saveWorkspaceState();
  }, 100);
}

export function appendActiveTab(tabs: EditorTab[], newTab: EditorTab): EditorTab[] {
  return [
    ...tabs.map(tab => ({ ...tab, isActive: false })),
    newTab,
  ];
}

export function buildTabsPatchState(tabs: EditorTab[]): { tabs: EditorTab[] } {
  return { tabs };
}

export function buildOpenedTabState(
  tabs: EditorTab[],
  document: Document,
  chatOpen = true,
): { tabs: EditorTab[]; activeTabId: string; currentDocument: Document } {
  const newTab = createEditorTab(document, {
    order: tabs.length,
    isActive: true,
    chatOpen,
  });

  return {
    tabs: appendActiveTab(tabs, newTab),
    activeTabId: newTab.id,
    currentDocument: document,
  };
}

export function resolveClosedTabState(
  tabs: EditorTab[],
  activeTabId: string | null,
  currentDocument: Document | null,
  documents: Document[],
  closingTabId: string,
): { tabs: EditorTab[]; activeTabId: string | null; currentDocument: Document | null } {
  const closingIndex = tabs.findIndex(tab => tab.id === closingTabId);
  if (closingIndex === -1) {
    return { tabs, activeTabId, currentDocument };
  }

  const nextTabs = tabs.filter(tab => tab.id !== closingTabId);
  if (activeTabId !== closingTabId) {
    return { tabs: nextTabs, activeTabId, currentDocument };
  }

  if (nextTabs.length === 0) {
    return {
      tabs: nextTabs,
      activeTabId: null,
      currentDocument: null,
    };
  }

  const nextIndex = Math.min(closingIndex, nextTabs.length - 1);
  const nextActiveTab = nextTabs[nextIndex];
  return {
    tabs: nextTabs,
    activeTabId: nextActiveTab.id,
    currentDocument: documents.find(d => d.id === nextActiveTab.documentId) || null,
  };
}

export function resolveSwitchedTabState(
  tabs: EditorTab[],
  documents: Document[],
  nextTabId: string,
): { tabs: EditorTab[]; activeTabId: string; currentDocument: Document | null } | null {
  const nextTab = tabs.find(tab => tab.id === nextTabId);
  if (!nextTab) return null;

  return {
    tabs: tabs.map(tab => ({
      ...tab,
      isActive: tab.id === nextTabId,
    })),
    activeTabId: nextTabId,
    currentDocument: documents.find(d => d.id === nextTab.documentId) || null,
  };
}

export function reorderTabs(tabs: EditorTab[], fromIndex: number, toIndex: number): EditorTab[] {
  const nextTabs = [...tabs];
  const [movedTab] = nextTabs.splice(fromIndex, 1);
  nextTabs.splice(toIndex, 0, movedTab);

  return nextTabs.map((tab, index) => ({
    ...tab,
    order: index,
  }));
}

export function updateTabPanelStateInTabs(
  tabs: EditorTab[],
  tabId: string,
  panel: keyof EditorTab['panelState'],
  value: boolean | number | string,
): EditorTab[] {
  return tabs.map(tab =>
    tab.id === tabId
      ? { ...tab, panelState: { ...tab.panelState, [panel]: value } }
      : tab
  );
}

export function setTabDirtyState(tabs: EditorTab[], tabId: string, isDirty: boolean): EditorTab[] {
  return tabs.map(tab =>
    tab.id === tabId ? { ...tab, isDirty } : tab
  );
}
