import { describe, it, expect } from 'vitest'
import {
  buildPromptTemplateCategoryMap,
  resolveRuntimePromptTemplateCategoryMap,
  createStoredPromptTemplate,
  exportCustomPromptTemplates,
  appendPromptTemplates,
  appendStoredPromptTemplate,
  updatePromptTemplateInList,
  removePromptTemplateFromList,
  removePromptTemplateState,
  exportSinglePromptTemplate,
  createImportedPromptTemplates,
  addPromptTemplateCategory,
  updatePromptTemplateCategory,
  removePromptTemplateCategory,
  resolvePromptTemplateCategories,
  getBuiltInPromptTemplates,
  getCustomPromptTemplates,
  getPromptTemplatesByCategory,
  findPromptTemplateById,
} from '../useTemplatesStore.helpers'
import type { PromptTemplate, TemplateCategoryInfo } from '@aidocplus/shared-types'
import type { RuntimePromptTemplateCategory } from '../useTemplatesStore.helpers'

// ── 测试数据工厂 ──

function makeTemplate(overrides: Partial<PromptTemplate> = {}): PromptTemplate {
  return {
    id: 'tpl-1',
    name: '测试模板',
    category: 'daily',
    content: '你好，{{name}}',
    isBuiltIn: true,
    ...overrides,
  }
}

function makeRuntimeCategory(overrides: Partial<RuntimePromptTemplateCategory> = {}): RuntimePromptTemplateCategory {
  return {
    key: 'daily',
    name: '日常',
    icon: '📝',
    isBuiltIn: true,
    ...overrides,
  }
}

// ── buildPromptTemplateCategoryMap ──

describe('buildPromptTemplateCategoryMap', () => {
  it('将运行时分类数组转为映射', () => {
    const categories = [
      makeRuntimeCategory({ key: 'daily', name: '日常', icon: '📝' }),
      makeRuntimeCategory({ key: 'tech', name: '技术', icon: '💻' }),
    ]
    const map = buildPromptTemplateCategoryMap(categories)
    expect(Object.keys(map)).toEqual(['daily', 'tech'])
    expect(map.daily.name).toBe('日常')
    expect(map.tech.icon).toBe('💻')
  })

  it('空数组返回空映射', () => {
    expect(buildPromptTemplateCategoryMap([])).toEqual({})
  })
})

// ── resolveRuntimePromptTemplateCategoryMap ──

describe('resolveRuntimePromptTemplateCategoryMap', () => {
  it('有数据时返回映射', () => {
    const categories = [makeRuntimeCategory()]
    const result = resolveRuntimePromptTemplateCategoryMap(categories)
    expect(result).not.toBeNull()
    expect(result!.daily).toBeDefined()
  })

  it('null 输入返回 null', () => {
    expect(resolveRuntimePromptTemplateCategoryMap(null)).toBeNull()
  })

  it('空数组返回 null', () => {
    expect(resolveRuntimePromptTemplateCategoryMap([])).toBeNull()
  })
})

// ── createStoredPromptTemplate ──

describe('createStoredPromptTemplate', () => {
  it('生成 custom 前缀 ID', () => {
    const tpl = createStoredPromptTemplate(
      { name: '新模板', category: 'daily', content: '内容' },
      'custom',
      1000,
    )
    expect(tpl.id).toMatch(/^custom-1000-/)
    expect(tpl.isBuiltIn).toBe(false)
    expect(tpl.createdAt).toBe(1000)
    expect(tpl.updatedAt).toBe(1000)
    expect(tpl.name).toBe('新模板')
  })

  it('生成 imported 前缀 ID', () => {
    const tpl = createStoredPromptTemplate(
      { name: '导入模板', category: 'tech', content: '内容' },
      'imported',
    )
    expect(tpl.id).toMatch(/^imported-/)
  })
})

// ── exportCustomPromptTemplates ──

describe('exportCustomPromptTemplates', () => {
  it('只导出自定义模板', () => {
    const templates = [
      makeTemplate({ id: 'b1', isBuiltIn: true }),
      makeTemplate({ id: 'c1', isBuiltIn: false }),
    ]
    const json = exportCustomPromptTemplates(templates)
    const parsed = JSON.parse(json)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe('c1')
  })

  it('全是内置模板时导出空数组', () => {
    const templates = [makeTemplate({ isBuiltIn: true })]
    expect(JSON.parse(exportCustomPromptTemplates(templates))).toEqual([])
  })
})

// ── appendPromptTemplates ──

describe('appendPromptTemplates', () => {
  it('合并两个数组', () => {
    const a = [makeTemplate({ id: 'a' })]
    const b = [makeTemplate({ id: 'b' })]
    const result = appendPromptTemplates(a, b)
    expect(result).toHaveLength(2)
    expect(result.map(t => t.id)).toEqual(['a', 'b'])
  })
})

// ── appendStoredPromptTemplate ──

describe('appendStoredPromptTemplate', () => {
  it('追加新模板并返回创建的模板', () => {
    const existing = [makeTemplate({ id: 'old' })]
    const { templates, createdTemplate } = appendStoredPromptTemplate(
      existing,
      { name: '新', category: 'daily', content: '内容' },
      'custom',
    )
    expect(templates).toHaveLength(2)
    expect(createdTemplate.id).toMatch(/^custom-/)
    expect(templates[1].id).toBe(createdTemplate.id)
  })
})

// ── updatePromptTemplateInList ──

describe('updatePromptTemplateInList', () => {
  it('更新指定模板字段', () => {
    const list = [makeTemplate({ id: 't1', name: '旧名' })]
    const updated = updatePromptTemplateInList(list, 't1', { name: '新名' }, 2000)
    expect(updated[0].name).toBe('新名')
    expect(updated[0].updatedAt).toBe(2000)
  })

  it('ID 不存在时不变', () => {
    const list = [makeTemplate({ id: 't1', name: '名' })]
    const updated = updatePromptTemplateInList(list, 'nonexistent', { name: '新' })
    expect(updated[0].name).toBe('名')
  })
})

// ── removePromptTemplateFromList ──

describe('removePromptTemplateFromList', () => {
  it('移除指定模板', () => {
    const list = [makeTemplate({ id: 't1' }), makeTemplate({ id: 't2' })]
    expect(removePromptTemplateFromList(list, 't1')).toHaveLength(1)
  })
})

// ── removePromptTemplateState ──

describe('removePromptTemplateState', () => {
  it('删除选中模板时清空 selectedTemplateId', () => {
    const list = [makeTemplate({ id: 't1' }), makeTemplate({ id: 't2' })]
    const state = removePromptTemplateState(list, 't1', 't1')
    expect(state.templates).toHaveLength(1)
    expect(state.selectedTemplateId).toBeNull()
  })

  it('删除非选中模板时保留 selectedTemplateId', () => {
    const list = [makeTemplate({ id: 't1' }), makeTemplate({ id: 't2' })]
    const state = removePromptTemplateState(list, 't1', 't2')
    expect(state.selectedTemplateId).toBe('t1')
  })
})

// ── exportSinglePromptTemplate ──

describe('exportSinglePromptTemplate', () => {
  it('导出单个模板为 JSON', () => {
    const tpl = makeTemplate({ id: 'x', name: '导出测试' })
    const json = exportSinglePromptTemplate(tpl)
    const parsed = JSON.parse(json)
    expect(parsed.id).toBe('x')
    expect(parsed.name).toBe('导出测试')
  })
})

// ── createImportedPromptTemplates ──

describe('createImportedPromptTemplates', () => {
  it('导入单个模板', () => {
    const json = JSON.stringify({ name: '导入', category: 'tech', content: '内容' })
    const result = createImportedPromptTemplates(json)
    expect(result).toHaveLength(1)
    expect(result[0].id).toMatch(/^imported-/)
    expect(result[0].isBuiltIn).toBe(false)
  })

  it('导入模板数组', () => {
    const json = JSON.stringify([
      { name: '模板A', category: 'daily', content: 'a' },
      { name: '模板B', category: 'tech', content: 'b' },
    ])
    const result = createImportedPromptTemplates(json)
    expect(result).toHaveLength(2)
  })
})

// ── 分类操作 ──

describe('addPromptTemplateCategory', () => {
  it('添加新分类', () => {
    const cats: Record<string, TemplateCategoryInfo> = { daily: { name: '日常', icon: '📝', isBuiltIn: true } }
    const updated = addPromptTemplateCategory(cats, 'tech', { name: '技术', icon: '💻', isBuiltIn: false })
    expect(Object.keys(updated)).toEqual(['daily', 'tech'])
    expect(updated.tech.name).toBe('技术')
  })
})

describe('updatePromptTemplateCategory', () => {
  it('更新已有分类', () => {
    const cats: Record<string, TemplateCategoryInfo> = { daily: { name: '日常', icon: '📝', isBuiltIn: true } }
    const updated = updatePromptTemplateCategory(cats, 'daily', { name: '日常生活' })
    expect(updated.daily.name).toBe('日常生活')
    expect(updated.daily.icon).toBe('📝')
  })

  it('不存在的 key 不变', () => {
    const cats: Record<string, TemplateCategoryInfo> = { daily: { name: '日常', icon: '📝', isBuiltIn: true } }
    const updated = updatePromptTemplateCategory(cats, 'nonexistent', { name: 'x' })
    expect(updated).toEqual(cats)
  })
})

describe('removePromptTemplateCategory', () => {
  it('移除指定分类', () => {
    const cats: Record<string, TemplateCategoryInfo> = {
      daily: { name: '日常', icon: '📝', isBuiltIn: true },
      tech: { name: '技术', icon: '💻', isBuiltIn: false },
    }
    const updated = removePromptTemplateCategory(cats, 'tech')
    expect(Object.keys(updated)).toEqual(['daily'])
  })
})

describe('resolvePromptTemplateCategories', () => {
  it('合并内置和自定义分类', () => {
    const builtIn: Record<string, TemplateCategoryInfo> = { daily: { name: '日常', icon: '📝', isBuiltIn: true } }
    const custom: Record<string, TemplateCategoryInfo> = { mycat: { name: '我的', icon: '⭐', isBuiltIn: false } }
    const merged = resolvePromptTemplateCategories(builtIn, custom)
    expect(merged.daily).toBeDefined()
    expect(merged.mycat).toBeDefined()
  })

  it('自定义分类覆盖同名内置分类', () => {
    const builtIn: Record<string, TemplateCategoryInfo> = { daily: { name: '日常', icon: '📝', isBuiltIn: true } }
    const custom: Record<string, TemplateCategoryInfo> = { daily: { name: '日常（自定义）', icon: '🔥', isBuiltIn: false } }
    const merged = resolvePromptTemplateCategories(builtIn, custom)
    expect(merged.daily.name).toBe('日常（自定义）')
  })
})

// ── 过滤和查找 ──

describe('getBuiltInPromptTemplates', () => {
  it('只返回内置模板', () => {
    const list = [
      makeTemplate({ id: 'b1', isBuiltIn: true }),
      makeTemplate({ id: 'c1', isBuiltIn: false }),
    ]
    expect(getBuiltInPromptTemplates(list)).toHaveLength(1)
    expect(getBuiltInPromptTemplates(list)[0].id).toBe('b1')
  })
})

describe('getCustomPromptTemplates', () => {
  it('只返回自定义模板', () => {
    const list = [
      makeTemplate({ id: 'b1', isBuiltIn: true }),
      makeTemplate({ id: 'c1', isBuiltIn: false }),
    ]
    expect(getCustomPromptTemplates(list)).toHaveLength(1)
    expect(getCustomPromptTemplates(list)[0].id).toBe('c1')
  })
})

describe('getPromptTemplatesByCategory', () => {
  it('按分类过滤', () => {
    const list = [
      makeTemplate({ id: 't1', category: 'daily' }),
      makeTemplate({ id: 't2', category: 'tech' }),
      makeTemplate({ id: 't3', category: 'daily' }),
    ]
    expect(getPromptTemplatesByCategory(list, 'daily')).toHaveLength(2)
    expect(getPromptTemplatesByCategory(list, 'tech')).toHaveLength(1)
    expect(getPromptTemplatesByCategory(list, 'nonexistent')).toHaveLength(0)
  })
})

describe('findPromptTemplateById', () => {
  it('找到匹配模板', () => {
    const list = [makeTemplate({ id: 't1' }), makeTemplate({ id: 't2' })]
    expect(findPromptTemplateById(list, 't2')?.id).toBe('t2')
  })

  it('不存在时返回 undefined', () => {
    expect(findPromptTemplateById([], 'x')).toBeUndefined()
  })
})
