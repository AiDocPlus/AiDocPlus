import type { Document, Project } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';

export async function listProjectsCommand(): Promise<Project[]> {
  return invoke<Project[]>('list_projects');
}

export async function createProjectCommand(name: string, description?: string): Promise<Project> {
  return invoke<Project>('create_project', { name, description });
}

export async function openProjectCommand(projectId: string): Promise<Project> {
  return invoke<Project>('open_project', { projectId });
}

export async function saveProjectCommand(project: Project): Promise<Project> {
  return invoke<Project>('save_project', { project });
}

export async function renameProjectCommand(projectId: string, newName: string): Promise<Project> {
  return invoke<Project>('rename_project', { projectId, newName });
}

export async function deleteProjectCommand(projectId: string): Promise<void> {
  await invoke('delete_project', { projectId });
}

export async function listDocumentsCommand(projectId: string): Promise<Document[]> {
  return invoke<Document[]>('list_documents', { projectId });
}

export async function listWorkspaceDocumentsCommand(projectId: string): Promise<Document[]> {
  try {
    return await listDocumentsCommand(projectId);
  } catch (error) {
    console.error('[Workspace] Failed to load documents for project:', projectId, error);
    return [];
  }
}

export async function createDocumentCommand(projectId: string, title: string, author: string): Promise<Document> {
  return invoke<Document>('create_document', { projectId, title, author });
}

export async function saveDocumentCommand(document: Document): Promise<Document> {
  return invoke<Document>('save_document', {
    payload: {
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
      aiServiceId: document.aiServiceId || undefined,
    },
  });
}

export async function deleteDocumentCommand(projectId: string, documentId: string): Promise<void> {
  await invoke('delete_document', { projectId, documentId });
}

export async function renameDocumentCommand(
  projectId: string,
  documentId: string,
  newTitle: string,
): Promise<Document> {
  return invoke<Document>('rename_document', { projectId, documentId, newTitle });
}

export async function exportProjectZipCommand(projectId: string, outputPath: string): Promise<string> {
  return invoke<string>('export_project_zip', { projectId, outputPath });
}

export async function importProjectZipCommand(zipPath: string): Promise<Project> {
  return invoke<Project>('import_project_zip', { zipPath });
}

export async function moveDocumentCommand(
  documentId: string,
  fromProjectId: string,
  toProjectId: string,
): Promise<Document> {
  return invoke<Document>('move_document', { documentId, fromProjectId, toProjectId });
}

export async function copyDocumentCommand(
  documentId: string,
  fromProjectId: string,
  toProjectId: string,
): Promise<Document> {
  return invoke<Document>('copy_document', { documentId, fromProjectId, toProjectId });
}

export async function createDocumentFromTemplateCommand(
  projectId: string,
  templateId: string,
  title: string,
  author: string,
): Promise<Document> {
  return invoke<Document>('create_document_from_doc_template', {
    projectId,
    templateId,
    title,
    author,
  });
}
