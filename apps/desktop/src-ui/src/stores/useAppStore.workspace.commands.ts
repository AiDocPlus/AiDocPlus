import type { WorkspaceState } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/lib/isTauri';

export async function saveWorkspaceCommand(workspaceState: WorkspaceState): Promise<void> {
  await invoke('save_workspace', {
    currentProjectId: workspaceState.currentProjectId,
    openDocumentIds: workspaceState.openDocumentIds,
    currentDocumentId: workspaceState.currentDocumentId,
    tabs: workspaceState.tabs,
    activeTabId: workspaceState.activeTabId,
    uiState: workspaceState.uiState,
  });
}

export async function loadWorkspaceCommand(): Promise<WorkspaceState | null> {
  return invoke<WorkspaceState | null>('load_workspace');
}

export async function clearWorkspaceCommand(): Promise<void> {
  await invoke('clear_workspace');
}

export async function saveWorkspaceViaTauri(workspaceState: WorkspaceState): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    await saveWorkspaceCommand(workspaceState);
  } catch (error) {
    console.error('[Workspace] Failed to save via Tauri:', error);
  }
}

export async function loadWorkspaceViaTauri(): Promise<WorkspaceState | null> {
  if (!isTauri()) {
    return null;
  }
  try {
    return await loadWorkspaceCommand();
  } catch (error) {
    console.error('[Workspace] Failed to load from Tauri:', error);
    return null;
  }
}

export async function clearWorkspaceViaTauri(): Promise<void> {
  if (!isTauri()) {
    return;
  }
  try {
    await clearWorkspaceCommand();
  } catch (error) {
    console.error('[Workspace] Failed to clear via Tauri:', error);
  }
}
