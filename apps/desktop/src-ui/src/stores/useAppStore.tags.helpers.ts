import type { Document } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';

export async function updateDocumentTagsCommand(
  projectId: string,
  documentId: string,
  tags: string[],
): Promise<Document> {
  return invoke<Document>('update_document_tags', { projectId, documentId, tags });
}

export async function toggleDocumentStarredCommand(
  projectId: string,
  documentId: string,
): Promise<Document> {
  return invoke<Document>('toggle_document_starred', { projectId, documentId });
}

export async function listAllTagsCommand(projectId?: string): Promise<string[]> {
  return invoke<string[]>('list_all_tags', { projectId: projectId ?? null });
}

export function filterVisibleTags(tags: string[]): string[] {
  return tags.filter(tag => !tag.startsWith('_'));
}

export function areTagsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}
