export type { DocumentStateSlice, ProjectStateSlice } from './useAppStore.document.helpers';

export {
  ensureDocumentConsistency,
  mergeDocumentsById,
  replaceDocumentsForProject,
  mergeDocumentsIntoState,
  applyDocumentUpdate,
  replaceDocumentInState,
  removeDocumentFromState,
  replaceProjectInState,
  removeProjectFromState,
} from './useAppStore.document.helpers';

export {
  createDefaultTabPanelState,
  createEditorTab,
  buildRestoredTabs,
  resolveActiveTabState,
  scheduleWorkspaceSave,
  appendActiveTab,
  resolveClosedTabState,
  resolveSwitchedTabState,
  reorderTabs,
  updateTabPanelStateInTabs,
  setTabDirtyState,
} from './useAppStore.tabs.helpers';
