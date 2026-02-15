import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PromptTemplate, PromptTemplateCategory, TemplateCategoryInfo } from '@aidocplus/shared-types';
import { BUILT_IN_TEMPLATES, TEMPLATE_CATEGORIES } from '@aidocplus/shared-types';

// 类型守卫函数：验证从 localStorage 恢复的数据
function isValidTemplate(obj: unknown): obj is PromptTemplate {
  if (!obj || typeof obj !== 'object') return false;
  const template = obj as Record<string, unknown>;

  // 检查必需字段
  if (typeof template.id !== 'string') return false;
  if (typeof template.name !== 'string') return false;
  if (typeof template.content !== 'string') return false;
  if (typeof template.category !== 'string') return false;

  // 检查可选字段的类型（如果存在）
  if (template.description !== undefined && typeof template.description !== 'string') return false;
  if (template.isBuiltIn !== undefined && typeof template.isBuiltIn !== 'boolean') return false;
  if (template.createdAt !== undefined && typeof template.createdAt !== 'number') return false;
  if (template.updatedAt !== undefined && typeof template.updatedAt !== 'number') return false;

  // 检查 variables 数组（如果存在）
  if (template.variables !== undefined) {
    if (!Array.isArray(template.variables)) return false;
    for (const v of template.variables) {
      if (typeof v !== 'string') return false;
    }
  }

  return true;
}

function isValidCategoryInfo(obj: unknown): obj is TemplateCategoryInfo {
  if (!obj || typeof obj !== 'object') return false;
  const info = obj as Record<string, unknown>;

  if (typeof info.name !== 'string') return false;
  if (info.description !== undefined && typeof info.description !== 'string') return false;
  if (info.icon !== undefined && typeof info.icon !== 'string') return false;

  return true;
}

// 验证并清理从 localStorage 恢复的模板数据
function validatePersistedTemplates(templates: unknown): PromptTemplate[] {
  if (!Array.isArray(templates)) return [];

  return templates.filter(isValidTemplate).map(template => ({
    ...template,
    // 确保所有字段都有有效值
    isBuiltIn: template.isBuiltIn ?? false,
    createdAt: template.createdAt ?? Date.now(),
    updatedAt: template.updatedAt ?? Date.now(),
  }));
}

// 验证并清理从 localStorage 恢复的分类数据
function validatePersistedCategories(categories: unknown): Record<string, TemplateCategoryInfo> {
  if (!categories || typeof categories !== 'object') return {};

  const result: Record<string, TemplateCategoryInfo> = {};
  const cats = categories as Record<string, unknown>;

  for (const [key, value] of Object.entries(cats)) {
    if (isValidCategoryInfo(value)) {
      result[key] = value;
    }
  }

  return result;
}

interface TemplatesState {
  templates: PromptTemplate[];
  customCategories: Record<string, TemplateCategoryInfo>;
  selectedTemplateId: string | null;

  // Actions
  setTemplates: (templates: PromptTemplate[]) => void;
  addTemplate: (template: Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>) => void;
  updateTemplate: (id: string, updates: Partial<PromptTemplate>) => void;
  deleteTemplate: (id: string) => void;
  setSelectedTemplate: (id: string | null) => void;
  importTemplate: (template: PromptTemplate) => void;
  exportTemplates: () => string;
  exportTemplate: (id: string) => string;
  importTemplates: (json: string) => void;
  resetTemplates: () => void;

  // Category actions
  addCategory: (key: string, info: TemplateCategoryInfo) => void;
  updateCategory: (key: string, info: Partial<TemplateCategoryInfo>) => void;
  deleteCategory: (key: string) => void;
  getAllCategories: () => Record<string, TemplateCategoryInfo>;

  // Getters
  getBuiltInTemplates: () => PromptTemplate[];
  getCustomTemplates: () => PromptTemplate[];
  getTemplatesByCategory: (category: PromptTemplateCategory) => PromptTemplate[];
  getTemplateById: (id: string) => PromptTemplate | undefined;
}

export const useTemplatesStore = create<TemplatesState>()(
  persist(
    (set, get) => ({
      templates: [...BUILT_IN_TEMPLATES],
      customCategories: {},
      selectedTemplateId: null,

      setTemplates: (templates) => set({ templates }),

      addTemplate: (templateData) => {
        const newTemplate: PromptTemplate = {
          ...templateData,
          id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isBuiltIn: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        set((state) => ({
          templates: [...state.templates, newTemplate]
        }));
      },

      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map(t =>
            t.id === id
              ? { ...t, ...updates, updatedAt: Date.now() }
              : t
          )
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter(t => t.id !== id),
          selectedTemplateId: state.selectedTemplateId === id ? null : state.selectedTemplateId
        }));
      },

      setSelectedTemplate: (id) => set({ selectedTemplateId: id }),

      importTemplate: (template) => {
        const newTemplate = {
          ...template,
          id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isBuiltIn: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        set((state) => ({
          templates: [...state.templates, newTemplate]
        }));
      },

      exportTemplates: () => {
        const { templates } = get();
        const customTemplates = templates.filter(t => !t.isBuiltIn);
        return JSON.stringify(customTemplates, null, 2);
      },

      exportTemplate: (id) => {
        const template = get().templates.find(t => t.id === id);
        if (!template) {
          throw new Error('Template not found');
        }
        return JSON.stringify(template, null, 2);
      },

      importTemplates: (json) => {
        try {
          const imported = JSON.parse(json);
          const templates = Array.isArray(imported) ? imported : [imported];

          const newTemplates = templates.map(t => ({
            ...t,
            id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            isBuiltIn: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

          set((state) => ({
            templates: [...state.templates, ...newTemplates]
          }));
        } catch (error) {
          console.error('Failed to import templates:', error);
          throw error;
        }
      },

      resetTemplates: () => {
        set({
          templates: [...BUILT_IN_TEMPLATES]
        });
      },

      // Category actions
      addCategory: (key, info) => {
        set((state) => ({
          customCategories: { ...state.customCategories, [key]: info }
        }));
      },

      updateCategory: (key, info) => {
        set((state) => {
          const existing = state.customCategories[key];
          if (!existing) return state;
          return {
            customCategories: { ...state.customCategories, [key]: { ...existing, ...info } }
          };
        });
      },

      deleteCategory: (key) => {
        set((state) => {
          const { [key]: _, ...rest } = state.customCategories;
          return { customCategories: rest };
        });
      },

      getAllCategories: () => {
        return { ...TEMPLATE_CATEGORIES, ...get().customCategories };
      },

      getBuiltInTemplates: () => {
        return get().templates.filter(t => t.isBuiltIn);
      },

      getCustomTemplates: () => {
        return get().templates.filter(t => !t.isBuiltIn);
      },

      getTemplatesByCategory: (category) => {
        return get().templates.filter(t => t.category === category);
      },

      getTemplateById: (id) => {
        return get().templates.find(t => t.id === id);
      }
    }),
    {
      name: 'aidocplus-templates',
      partialize: (state) => ({
        templates: state.templates.filter(t => !t.isBuiltIn),
        customCategories: state.customCategories
      }),
      merge: (persistedState: unknown, currentState) => {
        // 类型安全的合并
        const persisted = persistedState as Record<string, unknown> | null | undefined;

        // 验证并清理从 localStorage 恢复的数据
        const validatedTemplates = validatePersistedTemplates(persisted?.templates);
        const validatedCategories = validatePersistedCategories(persisted?.customCategories);

        return {
          ...currentState,
          templates: [
            ...BUILT_IN_TEMPLATES,
            ...validatedTemplates.filter(t => !t.isBuiltIn)
          ],
          customCategories: validatedCategories
        };
      }
    }
  )
);

// Helper function to apply template variables
export function applyTemplate(template: PromptTemplate, variables: Record<string, string>): string {
  let content = template.content;

  if (template.variables) {
    for (const variable of template.variables) {
      const value = variables[variable] || `{${variable}}`;
      content = content.replace(new RegExp(`\\{${variable}\\}`, 'g'), value);
    }
  }

  return content;
}
