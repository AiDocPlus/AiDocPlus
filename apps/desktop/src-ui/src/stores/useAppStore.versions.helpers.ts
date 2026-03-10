import type { Document, DocumentVersion } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';

export async function loadDocumentVersions(projectId: string, documentId: string): Promise<DocumentVersion[]> {
  return invoke<DocumentVersion[]>('list_versions', { projectId, documentId });
}

export async function createDocumentVersion(args: {
  projectId: string;
  documentId: string;
  content: string;
  authorNotes: string;
  aiGeneratedContent: string;
  createdBy: string;
  changeDescription?: string;
  pluginData?: Record<string, unknown>;
  enabledPlugins?: string[];
  composedContent?: string;
}): Promise<string> {
  return invoke<string>('create_version', {
    projectId: args.projectId,
    documentId: args.documentId,
    content: args.content,
    authorNotes: args.authorNotes,
    aiGeneratedContent: args.aiGeneratedContent,
    createdBy: args.createdBy,
    changeDescription: args.changeDescription,
    pluginData: args.pluginData || undefined,
    enabledPlugins: args.enabledPlugins || undefined,
    composedContent: args.composedContent || undefined,
  });
}

export async function fetchDocumentById(projectId: string, documentId: string): Promise<Document> {
  return invoke<Document>('get_document', { projectId, documentId });
}

export async function restoreDocumentVersion(
  projectId: string,
  documentId: string,
  versionId: string,
  createBackup: boolean,
): Promise<Document> {
  return invoke<Document>('restore_version', {
    projectId,
    documentId,
    versionId,
    createBackup,
  });
}

export async function deleteDocumentVersion(
  projectId: string,
  documentId: string,
  versionId: string,
): Promise<void> {
  await invoke('delete_version', { projectId, documentId, versionId });
}

export async function deleteAllDocumentVersions(projectId: string, documentId: string): Promise<void> {
  await invoke('delete_all_versions', { projectId, documentId });
}
