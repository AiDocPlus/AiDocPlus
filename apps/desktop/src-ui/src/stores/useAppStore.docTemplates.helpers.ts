import type { DocTemplateCategory, DocTemplateManifest } from '@aidocplus/shared-types';
import { invoke } from '@tauri-apps/api/core';

export async function fetchDocTemplates(): Promise<DocTemplateManifest[]> {
  return invoke<DocTemplateManifest[]>('list_doc_templates');
}

export async function refreshDocTemplates(
  onLoaded: (templates: DocTemplateManifest[]) => void,
): Promise<DocTemplateManifest[]> {
  const templates = await fetchDocTemplates();
  onLoaded(templates);
  return templates;
}

export async function runDocTemplateMutation<T>(
  command: () => Promise<T>,
  onLoaded: (templates: DocTemplateManifest[]) => void,
): Promise<T> {
  const result = await command();
  await refreshDocTemplates(onLoaded);
  return result;
}

export async function fetchDocTemplateCategories(): Promise<DocTemplateCategory[]> {
  return invoke<DocTemplateCategory[]>('list_doc_template_categories');
}

export async function refreshDocTemplateCategories(
  onLoaded: (categories: DocTemplateCategory[]) => void,
): Promise<DocTemplateCategory[]> {
  const categories = await fetchDocTemplateCategories();
  onLoaded(categories);
  return categories;
}

export async function runDocTemplateCategoryMutation(
  command: () => Promise<DocTemplateCategory[]>,
  onLoaded: (categories: DocTemplateCategory[]) => void,
): Promise<DocTemplateCategory[]> {
  const categories = await command();
  onLoaded(categories);
  return categories;
}

export async function saveDocTemplateFromDocumentCommand(args: {
  projectId: string;
  documentId: string;
  name: string;
  description?: string;
  category?: string;
  includeContent: boolean;
  includeAiContent: boolean;
  includePluginData: boolean;
}): Promise<DocTemplateManifest> {
  return invoke<DocTemplateManifest>('save_doc_template_from_document', {
    projectId: args.projectId,
    documentId: args.documentId,
    templateName: args.name,
    templateDescription: args.description,
    templateCategory: args.category,
    includeContent: args.includeContent,
    includeAiContent: args.includeAiContent,
    includePluginData: args.includePluginData,
  });
}

export async function deleteDocTemplateCommand(templateId: string): Promise<void> {
  await invoke('delete_doc_template', { templateId });
}

export async function duplicateDocTemplateCommand(templateId: string, newName: string): Promise<DocTemplateManifest> {
  return invoke<DocTemplateManifest>('duplicate_doc_template', { templateId, newName });
}

export async function updateDocTemplateCommand(
  templateId: string,
  fields: Partial<Pick<DocTemplateManifest, 'name' | 'description' | 'category' | 'icon' | 'tags'>>,
): Promise<DocTemplateManifest> {
  return invoke<DocTemplateManifest>('update_doc_template', {
    templateId,
    name: fields.name ?? null,
    description: fields.description ?? null,
    category: fields.category ?? null,
    icon: fields.icon ?? null,
    tags: fields.tags ?? null,
    content: null,
  });
}

export async function createDocTemplateCategoryCommand(key: string, label: string): Promise<DocTemplateCategory[]> {
  return invoke<DocTemplateCategory[]>('create_doc_template_category', { key, label });
}

export async function updateDocTemplateCategoryCommand(
  key: string,
  label?: string,
  newKey?: string,
): Promise<DocTemplateCategory[]> {
  return invoke<DocTemplateCategory[]>('update_doc_template_category', {
    key,
    label: label ?? null,
    newKey: newKey ?? null,
  });
}

export async function deleteDocTemplateCategoryCommand(key: string): Promise<DocTemplateCategory[]> {
  return invoke<DocTemplateCategory[]>('delete_doc_template_category', { key });
}

export async function reorderDocTemplateCategoriesCommand(orderedKeys: string[]): Promise<DocTemplateCategory[]> {
  return invoke<DocTemplateCategory[]>('reorder_doc_template_categories', { orderedKeys });
}
