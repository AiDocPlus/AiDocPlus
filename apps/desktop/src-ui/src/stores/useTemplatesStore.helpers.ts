import { invoke } from '@tauri-apps/api/core';
import { TEMPLATE_CATEGORIES } from '@aidocplus/shared-types';
import type { PromptTemplate, TemplateCategoryInfo } from '@aidocplus/shared-types';

export interface RuntimePromptTemplateCategory {
  key: string;
  name: string;
  icon: string;
  isBuiltIn: boolean;
}

export async function saveCustomPromptTemplateCommand(template: PromptTemplate): Promise<void> {
  await invoke('save_custom_prompt_template', {
    template: {
      id: template.id,
      name: template.name,
      category: template.category,
      content: template.content,
      description: template.description || null,
      variables: template.variables || [],
    },
  });
}

export async function deleteCustomPromptTemplateCommand(id: string): Promise<void> {
  await invoke('delete_custom_prompt_template', { id });
}

export async function listPromptTemplatesCommand(): Promise<PromptTemplate[]> {
  return invoke<PromptTemplate[]>('list_prompt_templates');
}

export async function listPromptTemplateCategoriesCommand(): Promise<RuntimePromptTemplateCategory[]> {
  return invoke<RuntimePromptTemplateCategory[]>('list_prompt_template_categories');
}

export function buildPromptTemplateCategoryMap(
  categories: RuntimePromptTemplateCategory[],
): Record<string, TemplateCategoryInfo> {
  const categoryMap: Record<string, TemplateCategoryInfo> = {};
  for (const category of categories) {
    categoryMap[category.key] = {
      name: category.name,
      icon: category.icon,
      isBuiltIn: true,
    };
  }
  return categoryMap;
}

export function resolveRuntimePromptTemplateCategoryMap(
  categories: RuntimePromptTemplateCategory[] | null | undefined,
): Record<string, TemplateCategoryInfo> | null {
  if (!categories || categories.length === 0) {
    return null;
  }
  return buildPromptTemplateCategoryMap(categories);
}

export function createStoredPromptTemplate(
  template: Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>,
  prefix: 'custom' | 'imported',
  now = Date.now(),
): PromptTemplate {
  return {
    ...template,
    id: `${prefix}-${now}-${Math.random().toString(36).substr(2, 9)}`,
    isBuiltIn: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function exportCustomPromptTemplates(templates: PromptTemplate[]): string {
  return JSON.stringify(templates.filter(template => !template.isBuiltIn), null, 2);
}

export async function loadBuiltInPromptTemplatesFallback(): Promise<PromptTemplate[]> {
  const { BUILT_IN_TEMPLATES } = await import('@aidocplus/shared-types');
  return [...BUILT_IN_TEMPLATES];
}

export async function loadPromptTemplatesWithFallback(): Promise<PromptTemplate[]> {
  try {
    const allTemplates = await listPromptTemplatesCommand();
    if (allTemplates && allTemplates.length > 0) {
      return allTemplates;
    }
  } catch {
  }
  return loadBuiltInPromptTemplatesFallback();
}

export function appendPromptTemplates(
  templates: PromptTemplate[],
  newTemplates: PromptTemplate[],
): PromptTemplate[] {
  return [...templates, ...newTemplates];
}

export function appendStoredPromptTemplate(
  templates: PromptTemplate[],
  template: Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>,
  prefix: 'custom' | 'imported',
): { templates: PromptTemplate[]; createdTemplate: PromptTemplate } {
  const createdTemplate = createStoredPromptTemplate(template, prefix);
  return {
    templates: appendPromptTemplates(templates, [createdTemplate]),
    createdTemplate,
  };
}

export function updatePromptTemplateInList(
  templates: PromptTemplate[],
  id: string,
  updates: Partial<PromptTemplate>,
  now = Date.now(),
): PromptTemplate[] {
  return templates.map(template =>
    template.id === id
      ? { ...template, ...updates, updatedAt: now }
      : template,
  );
}

export function removePromptTemplateFromList(
  templates: PromptTemplate[],
  id: string,
): PromptTemplate[] {
  return templates.filter(template => template.id !== id);
}

export function removePromptTemplateState(
  templates: PromptTemplate[],
  selectedTemplateId: string | null,
  id: string,
): { templates: PromptTemplate[]; selectedTemplateId: string | null } {
  return {
    templates: removePromptTemplateFromList(templates, id),
    selectedTemplateId: selectedTemplateId === id ? null : selectedTemplateId,
  };
}

export function exportSinglePromptTemplate(template: PromptTemplate): string {
  return JSON.stringify(template, null, 2);
}

export function createImportedPromptTemplates(json: string): PromptTemplate[] {
  const imported = JSON.parse(json);
  const templates = Array.isArray(imported) ? imported : [imported];
  return templates.map(template => createStoredPromptTemplate(template, 'imported'));
}

export function addPromptTemplateCategory(
  categories: Record<string, TemplateCategoryInfo>,
  key: string,
  info: TemplateCategoryInfo,
): Record<string, TemplateCategoryInfo> {
  return { ...categories, [key]: info };
}

export function updatePromptTemplateCategory(
  categories: Record<string, TemplateCategoryInfo>,
  key: string,
  info: Partial<TemplateCategoryInfo>,
): Record<string, TemplateCategoryInfo> {
  const existing = categories[key];
  if (!existing) {
    return categories;
  }
  return {
    ...categories,
    [key]: { ...existing, ...info },
  };
}

export function removePromptTemplateCategory(
  categories: Record<string, TemplateCategoryInfo>,
  key: string,
): Record<string, TemplateCategoryInfo> {
  const { [key]: _removed, ...rest } = categories;
  return rest;
}

export function resolvePromptTemplateCategories(
  builtInCategories: Record<string, TemplateCategoryInfo>,
  customCategories: Record<string, TemplateCategoryInfo>,
): Record<string, TemplateCategoryInfo> {
  const base = Object.keys(builtInCategories).length > 0 ? builtInCategories : TEMPLATE_CATEGORIES;
  return { ...base, ...customCategories };
}

export function getBuiltInPromptTemplates(templates: PromptTemplate[]): PromptTemplate[] {
  return templates.filter(template => template.isBuiltIn);
}

export function getCustomPromptTemplates(templates: PromptTemplate[]): PromptTemplate[] {
  return templates.filter(template => !template.isBuiltIn);
}

export function getPromptTemplatesByCategory(
  templates: PromptTemplate[],
  category: PromptTemplate['category'],
): PromptTemplate[] {
  return templates.filter(template => template.category === category);
}

export function findPromptTemplateById(
  templates: PromptTemplate[],
  id: string,
): PromptTemplate | undefined {
  return templates.find(template => template.id === id);
}
