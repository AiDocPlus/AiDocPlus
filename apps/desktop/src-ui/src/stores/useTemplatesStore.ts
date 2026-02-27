import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { PromptTemplate, PromptTemplateCategory, TemplateCategoryInfo } from '@aidocplus/shared-types';
import { TEMPLATE_CATEGORIES } from '@aidocplus/shared-types';

interface TemplatesState {
  templates: PromptTemplate[];
  customCategories: Record<string, TemplateCategoryInfo>;
  builtInCategories: Record<string, TemplateCategoryInfo>;
  selectedTemplateId: string | null;

  // Runtime loading
  loadBuiltInTemplates: () => Promise<void>;
  loadBuiltInCategories: () => Promise<void>;

  // Actions
  setTemplates: (templates: PromptTemplate[]) => void;
  addTemplate: (template: Omit<PromptTemplate, 'id' | 'isBuiltIn' | 'createdAt' | 'updatedAt'>) => void;
  updateTemplate: (id: string, updates: Partial<PromptTemplate>) => void;
  deleteTemplate: (id: string) => void;
  setSelectedTemplate: (id: string | null) => void;
  importTemplate: (template: PromptTemplate) => void;
  exportTemplates: () => string;
  exportTemplate: (id: string) => string;
  importTemplates: (json: string) => Promise<void>;
  resetTemplates: () => Promise<void>;

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

/// 保存自定义模板到 Rust 后端（~/AiDocPlus/PromptTemplates/）
async function saveTemplateToBackend(template: PromptTemplate): Promise<void> {
  try {
    await invoke('save_custom_prompt_template', {
      template: {
        id: template.id,
        name: template.name,
        category: template.category,
        content: template.content,
        description: template.description || null,
        variables: template.variables || [],
      }
    });
  } catch (e) {
    console.error('[TemplatesStore] 保存模板到后端失败:', e);
  }
}

/// 从 Rust 后端删除自定义模板
async function deleteTemplateFromBackend(id: string): Promise<void> {
  try {
    await invoke('delete_custom_prompt_template', { id });
  } catch (e) {
    console.error('[TemplatesStore] 从后端删除模板失败:', e);
  }
}

export const useTemplatesStore = create<TemplatesState>()(
  (set, get) => ({
    templates: [],
    customCategories: {},
    builtInCategories: {},
    selectedTemplateId: null,

    loadBuiltInTemplates: async () => {
      try {
        // list_prompt_templates 已合并内置 + 用户自定义模板
        const allTemplates = await invoke<PromptTemplate[]>('list_prompt_templates');
        if (allTemplates && allTemplates.length > 0) {
          set({ templates: allTemplates });
          return;
        }
      } catch (error) {
        console.warn('[TemplatesStore] Runtime load failed, using static fallback:', error);
      }
      // Fallback: 动态加载静态数据（避免启动时同步加载 2.4MB 文件）
      try {
        const { BUILT_IN_TEMPLATES } = await import('@aidocplus/shared-types');
        set({ templates: [...BUILT_IN_TEMPLATES] });
      } catch (e) {
        console.error('[TemplatesStore] Static fallback also failed:', e);
      }
    },

    loadBuiltInCategories: async () => {
      try {
        const cats = await invoke<Array<{ key: string; name: string; icon: string; isBuiltIn: boolean }>>('list_prompt_template_categories');
        if (cats && cats.length > 0) {
          const catMap: Record<string, TemplateCategoryInfo> = {};
          for (const cat of cats) {
            catMap[cat.key] = { name: cat.name, icon: cat.icon, isBuiltIn: true };
          }
          set({ builtInCategories: catMap });
        }
      } catch (error) {
        console.warn('[TemplatesStore] Failed to load runtime categories, using static fallback:', error);
      }
    },

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

      // 异步保存到 Rust 后端
      saveTemplateToBackend(newTemplate);
    },

    updateTemplate: (id, updates) => {
      set((state) => ({
        templates: state.templates.map(t =>
          t.id === id
            ? { ...t, ...updates, updatedAt: Date.now() }
            : t
        )
      }));

      // 如果是自定义模板，异步保存到后端
      const updated = get().templates.find(t => t.id === id);
      if (updated && !updated.isBuiltIn) {
        saveTemplateToBackend(updated);
      }
    },

    deleteTemplate: (id) => {
      const template = get().templates.find(t => t.id === id);
      set((state) => ({
        templates: state.templates.filter(t => t.id !== id),
        selectedTemplateId: state.selectedTemplateId === id ? null : state.selectedTemplateId
      }));

      // 如果是自定义模板，从后端删除
      if (template && !template.isBuiltIn) {
        deleteTemplateFromBackend(id);
      }
    },

    setSelectedTemplate: (id) => set({ selectedTemplateId: id }),

    importTemplate: (template) => {
      const newTemplate: PromptTemplate = {
        ...template,
        id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        isBuiltIn: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      set((state) => ({
        templates: [...state.templates, newTemplate]
      }));

      saveTemplateToBackend(newTemplate);
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

    importTemplates: async (json) => {
      try {
        const imported = JSON.parse(json);
        const templates = Array.isArray(imported) ? imported : [imported];

        const newTemplates: PromptTemplate[] = templates.map(t => ({
          ...t,
          id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          isBuiltIn: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }));

        set((state) => ({
          templates: [...state.templates, ...newTemplates]
        }));

        // 批量保存到后端
        for (const t of newTemplates) {
          await saveTemplateToBackend(t);
        }
      } catch (error) {
        console.error('Failed to import templates:', error);
        throw error;
      }
    },

    resetTemplates: async () => {
      try {
        const allTemplates = await invoke<PromptTemplate[]>('list_prompt_templates');
        if (allTemplates && allTemplates.length > 0) {
          set({ templates: allTemplates });
          return;
        }
      } catch { /* fallback */ }
      try {
        const { BUILT_IN_TEMPLATES } = await import('@aidocplus/shared-types');
        set({ templates: [...BUILT_IN_TEMPLATES] });
      } catch (e) {
        console.error('[TemplatesStore] Reset failed:', e);
      }
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
      const { builtInCategories, customCategories } = get();
      const base = Object.keys(builtInCategories).length > 0 ? builtInCategories : TEMPLATE_CATEGORIES;
      return { ...base, ...customCategories };
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
  })
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
