/// <reference types="vitest/globals" />

import {
  deepMergeDefaults,
  setPluginEnabledState,
  incrementPluginUsageState,
  addPluginCategoryState,
  deletePluginCategoryState,
  renamePluginCategoryState,
  reorderPluginCategoriesState,
  setPluginOrderState,
  resolvePluginsSettings,
  resolveCustomCategories,
  pickSettingsSnapshot,
  mergeSettingsSnapshot,
  mergeSettingsSectionState,
  exportSettingsSnapshot,
  resolveAIInvokeParams,
  DEFAULT_PLUGINS_SETTINGS,
} from '../useSettingsStore.helpers'
import { DEFAULT_AI_SETTINGS } from '@aidocplus/shared-types'
import type { AppSettings } from '@aidocplus/shared-types'

// ── deepMergeDefaults ──

describe('deepMergeDefaults', () => {
  it('空 saved 返回 defaults', () => {
    const defaults = { a: 1, b: 'hello', c: { x: 10 } }
    expect(deepMergeDefaults(defaults, {})).toEqual(defaults)
  })

  it('覆盖基本类型', () => {
    const defaults = { a: 1, b: 'hello' }
    expect(deepMergeDefaults(defaults, { a: 42 })).toEqual({ a: 42, b: 'hello' })
  })

  it('递归合并嵌套对象', () => {
    const defaults = { nested: { x: 1, y: 2 }, top: 'ok' }
    const saved = { nested: { x: 99 } } as any
    expect(deepMergeDefaults(defaults, saved)).toEqual({ nested: { x: 99, y: 2 }, top: 'ok' })
  })

  it('数组直接覆盖（不合并）', () => {
    const defaults = { arr: [1, 2, 3] }
    const saved = { arr: [4, 5] }
    expect(deepMergeDefaults(defaults, saved)).toEqual({ arr: [4, 5] })
  })

  it('null/undefined 值不覆盖默认值', () => {
    const defaults = { a: 1, b: 'hello' }
    expect(deepMergeDefaults(defaults, { a: null as any })).toEqual({ a: 1, b: 'hello' })
    expect(deepMergeDefaults(defaults, { a: undefined })).toEqual({ a: 1, b: 'hello' })
  })
})

// ── resolvePluginsSettings ──

describe('resolvePluginsSettings', () => {
  it('undefined 返回默认值', () => {
    expect(resolvePluginsSettings(undefined)).toEqual(DEFAULT_PLUGINS_SETTINGS)
  })

  it('有值则原样返回', () => {
    const plugins = { enabled: { foo: true }, usageCount: { foo: 3 } }
    expect(resolvePluginsSettings(plugins)).toBe(plugins)
  })
})

// ── resolveCustomCategories ──

describe('resolveCustomCategories', () => {
  it('undefined 返回空分类', () => {
    const result = resolveCustomCategories(undefined)
    expect(result.majors).toEqual([])
    expect(result.subs).toEqual({})
  })

  it('有 customCategories 则返回它', () => {
    const cat = { majors: [{ key: 'a', label: 'A', order: 0 }], subs: {} }
    const plugins = { enabled: {}, usageCount: {}, customCategories: cat }
    expect(resolveCustomCategories(plugins)).toBe(cat)
  })
})

// ── setPluginEnabledState ──

describe('setPluginEnabledState', () => {
  it('从 undefined 创建', () => {
    const result = setPluginEnabledState(undefined, 'plugin-a', true)
    expect(result.enabled['plugin-a']).toBe(true)
  })

  it('启用/禁用', () => {
    const base = { enabled: { p1: true }, usageCount: {} }
    expect(setPluginEnabledState(base, 'p1', false).enabled['p1']).toBe(false)
    expect(setPluginEnabledState(base, 'p2', true).enabled['p2']).toBe(true)
  })

  it('不影响其他插件', () => {
    const base = { enabled: { p1: true, p2: false }, usageCount: {} }
    const result = setPluginEnabledState(base, 'p1', false)
    expect(result.enabled['p2']).toBe(false)
  })
})

// ── incrementPluginUsageState ──

describe('incrementPluginUsageState', () => {
  it('从 0 开始计数', () => {
    const result = incrementPluginUsageState(undefined, 'foo')
    expect(result.usageCount['foo']).toBe(1)
  })

  it('递增已有计数', () => {
    const base = { enabled: {}, usageCount: { foo: 5 } }
    expect(incrementPluginUsageState(base, 'foo').usageCount['foo']).toBe(6)
  })
})

// ── addPluginCategoryState ──

describe('addPluginCategoryState', () => {
  it('添加主分类', () => {
    const result = addPluginCategoryState(undefined, 'major', null, 'cat1', '分类一')
    expect(result).not.toBeNull()
    expect(result!.customCategories!.majors).toHaveLength(1)
    expect(result!.customCategories!.majors[0]).toEqual({ key: 'cat1', label: '分类一', order: 1 })
  })

  it('添加子分类', () => {
    const result = addPluginCategoryState(undefined, 'sub', 'major1', 'sub1', '子分类')
    expect(result).not.toBeNull()
    expect(result!.customCategories!.subs['major1']).toHaveLength(1)
    expect(result!.customCategories!.subs['major1'][0].key).toBe('sub1')
  })

  it('子分类无 majorKey 返回 null', () => {
    expect(addPluginCategoryState(undefined, 'sub', null, 'sub1', '子分类')).toBeNull()
  })

  it('order 自增', () => {
    const base = {
      enabled: {},
      usageCount: {},
      customCategories: {
        majors: [{ key: 'a', label: 'A', order: 3 }],
        subs: {},
      },
    }
    const result = addPluginCategoryState(base, 'major', null, 'b', 'B')
    expect(result!.customCategories!.majors[1].order).toBe(4)
  })
})

// ── renamePluginCategoryState ──

describe('renamePluginCategoryState', () => {
  it('重命名主分类', () => {
    const base = {
      enabled: {},
      usageCount: {},
      customCategories: {
        majors: [{ key: 'a', label: 'Old', order: 0 }],
        subs: {},
      },
    }
    const result = renamePluginCategoryState(base, 'major', null, 'a', 'New')
    expect(result!.customCategories!.majors[0].label).toBe('New')
  })

  it('重命名子分类', () => {
    const base = {
      enabled: {},
      usageCount: {},
      customCategories: {
        majors: [],
        subs: { m1: [{ key: 's1', label: 'Old', order: 0 }] },
      },
    }
    const result = renamePluginCategoryState(base, 'sub', 'm1', 's1', 'New')
    expect(result!.customCategories!.subs['m1'][0].label).toBe('New')
  })
})

// ── deletePluginCategoryState ──

describe('deletePluginCategoryState', () => {
  it('删除主分类及其子分类', () => {
    const base = {
      enabled: {},
      usageCount: {},
      customCategories: {
        majors: [{ key: 'a', label: 'A', order: 0 }, { key: 'b', label: 'B', order: 1 }],
        subs: { a: [{ key: 's1', label: 'S1', order: 0 }], b: [] },
      },
    }
    const result = deletePluginCategoryState(base, 'major', null, 'a')
    expect(result!.customCategories!.majors).toHaveLength(1)
    expect(result!.customCategories!.majors[0].key).toBe('b')
    expect(result!.customCategories!.subs['a']).toBeUndefined()
  })

  it('删除子分类', () => {
    const base = {
      enabled: {},
      usageCount: {},
      customCategories: {
        majors: [],
        subs: { m1: [{ key: 's1', label: 'S1', order: 0 }, { key: 's2', label: 'S2', order: 1 }] },
      },
    }
    const result = deletePluginCategoryState(base, 'sub', 'm1', 's1')
    expect(result!.customCategories!.subs['m1']).toHaveLength(1)
    expect(result!.customCategories!.subs['m1'][0].key).toBe('s2')
  })
})

// ── reorderPluginCategoriesState ──

describe('reorderPluginCategoriesState', () => {
  it('重排主分类', () => {
    const base = {
      enabled: {},
      usageCount: {},
      customCategories: {
        majors: [
          { key: 'a', label: 'A', order: 0 },
          { key: 'b', label: 'B', order: 1 },
          { key: 'c', label: 'C', order: 2 },
        ],
        subs: {},
      },
    }
    const result = reorderPluginCategoriesState(base, 'major', null, ['c', 'a', 'b'])
    const majors = result!.customCategories!.majors
    expect(majors.find(m => m.key === 'c')!.order).toBe(0)
    expect(majors.find(m => m.key === 'a')!.order).toBe(1)
    expect(majors.find(m => m.key === 'b')!.order).toBe(2)
  })
})

// ── setPluginOrderState ──

describe('setPluginOrderState', () => {
  it('设置插件排序', () => {
    const result = setPluginOrderState(undefined, ['p3', 'p1', 'p2'])
    expect(result.pluginOrder).toEqual(['p3', 'p1', 'p2'])
  })
})

// ── pickSettingsSnapshot / mergeSettingsSnapshot ──

describe('pickSettingsSnapshot & mergeSettingsSnapshot', () => {
  const snapshot = {
    editor: { fontSize: 16 } as any,
    ui: { theme: 'dark' } as any,
    file: {} as any,
    ai: { temperature: 0.7 } as any,
    email: {} as any,
    shortcuts: {} as any,
  }

  it('pickSettingsSnapshot 提取快照', () => {
    const result = pickSettingsSnapshot(snapshot)
    expect(result.editor).toBe(snapshot.editor)
    expect(result.ai).toBe(snapshot.ai)
  })

  it('mergeSettingsSnapshot 用 patch 覆盖', () => {
    const patch = { editor: { fontSize: 20 } as any }
    const result = mergeSettingsSnapshot(snapshot, patch)
    expect(result.editor.fontSize).toBe(20)
    expect(result.ai).toBe(snapshot.ai) // 未 patch 的保持不变
  })
})

// ── mergeSettingsSectionState ──

describe('mergeSettingsSectionState', () => {
  it('合并单个 section', () => {
    const state = {
      editor: { fontSize: 14, lineHeight: 1.5 } as any,
      ui: {} as any,
      file: {} as any,
      ai: {} as any,
      email: {} as any,
    }
    const result = mergeSettingsSectionState(state, 'editor', { fontSize: 18 } as any)
    expect(result.editor.fontSize).toBe(18)
    expect(result.editor.lineHeight).toBe(1.5)
  })
})

// ── exportSettingsSnapshot ──

describe('exportSettingsSnapshot', () => {
  it('导出为格式化 JSON', () => {
    const snapshot = {
      editor: { fontSize: 16 } as any,
      ui: {} as any,
      file: {} as any,
      ai: {} as any,
      email: {} as any,
      shortcuts: {} as any,
    }
    const json = exportSettingsSnapshot(snapshot)
    expect(JSON.parse(json)).toEqual(snapshot)
    expect(json).toContain('\n') // 格式化的
  })
})

// ── resolveAIInvokeParams ──

describe('resolveAIInvokeParams', () => {
  const baseAI: AppSettings['ai'] = {
    ...DEFAULT_AI_SETTINGS,
    services: [
      {
        id: 'svc1',
        name: 'Test GLM',
        provider: 'glm',
        apiKey: 'sk-test',
        model: 'glm-4-flash',
        baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
        enabled: true,
      },
      {
        id: 'svc2',
        name: 'Disabled',
        provider: 'openai',
        apiKey: 'sk-disabled',
        model: 'gpt-4o',
        baseUrl: '',
        enabled: false,
      },
    ],
    activeServiceId: 'svc1',
  }

  it('返回活跃服务参数', () => {
    const result = resolveAIInvokeParams(baseAI)
    expect(result.provider).toBe('glm')
    expect(result.apiKey).toBe('sk-test')
    expect(result.model).toBe('glm-4-flash')
    expect(result.serviceId).toBe('svc1')
  })

  it('指定 serviceId 查找对应服务', () => {
    const ai = { ...baseAI, services: baseAI.services.map(s => ({ ...s, enabled: true })) }
    const result = resolveAIInvokeParams(ai, 'svc2')
    expect(result.provider).toBe('openai')
    expect(result.serviceId).toBe('svc2')
  })

  it('指定的 serviceId 被禁用时回退到活跃服务', () => {
    const result = resolveAIInvokeParams(baseAI, 'svc2') // svc2 disabled
    expect(result.serviceId).toBe('svc1') // fallback
  })

  it('无服务时返回全部 undefined', () => {
    const emptyAI = { ...DEFAULT_AI_SETTINGS, services: [], activeServiceId: '' }
    const result = resolveAIInvokeParams(emptyAI)
    expect(result.provider).toBeUndefined()
    expect(result.apiKey).toBeUndefined()
  })

  it('代理和超时设置从 ai 全局读取', () => {
    const ai = { ...baseAI, proxyUrl: 'http://127.0.0.1:7890', connectTimeoutSecs: 30 }
    const result = resolveAIInvokeParams(ai)
    expect(result.proxyUrl).toBe('http://127.0.0.1:7890')
    expect(result.connectTimeoutSecs).toBe(30)
  })
})
