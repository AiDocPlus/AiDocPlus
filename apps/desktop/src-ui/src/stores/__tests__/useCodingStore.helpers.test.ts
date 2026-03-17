import { describe, it, expect } from 'vitest'
import {
  parsePersistedCodingState,
  buildCodingStateSnapshot,
  ensureActiveItemId,
  removeItemWithActiveFallback,
  updateItemById,
  reorderItemsById,
  toggleStringInList,
  prependRecentFile,
  prependLimitedEntry,
  createRuntimeCheckFailure,
} from '../useCodingStore.helpers'

// ── 测试数据 ──

const DEFAULT_SETTINGS = { fontSize: 14, theme: 'dark' }

type Item = { id: string; name: string }
function makeItem(id: string, name = ''): Item {
  return { id, name: name || `item-${id}` }
}

// ── parsePersistedCodingState ──

describe('parsePersistedCodingState', () => {
  it('null 输入返回默认值', () => {
    const state = parsePersistedCodingState(null, DEFAULT_SETTINGS)
    expect(state.favorites).toEqual([])
    expect(state.settings).toEqual(DEFAULT_SETTINGS)
    expect(state.recentFiles).toEqual([])
    expect(state.pythonInfo).toBeNull()
    expect(state.nodeInfo).toBeNull()
    expect(state.activeTabId).toBe('')
    expect(state.openTabs).toEqual([])
  })

  it('无效 JSON 返回默认值', () => {
    const state = parsePersistedCodingState('not-json', DEFAULT_SETTINGS)
    expect(state.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('正确解析有效状态', () => {
    const json = JSON.stringify({
      favorites: ['/a.py', '/b.py'],
      settings: { fontSize: 18 },
      recentFiles: ['/c.py'],
      activeTabId: 'tab-1',
      openTabs: [{ id: 'tab-1', filePath: '/a.py' }],
    })
    const state = parsePersistedCodingState(json, DEFAULT_SETTINGS)
    expect(state.favorites).toEqual(['/a.py', '/b.py'])
    expect(state.settings).toEqual({ fontSize: 18, theme: 'dark' })
    expect(state.recentFiles).toEqual(['/c.py'])
    expect(state.activeTabId).toBe('tab-1')
    expect(state.openTabs).toHaveLength(1)
  })

  it('settings 与默认值合并（保留默认中缺失的字段）', () => {
    const json = JSON.stringify({ settings: { fontSize: 20 } })
    const state = parsePersistedCodingState(json, DEFAULT_SETTINGS)
    expect(state.settings.fontSize).toBe(20)
    expect(state.settings.theme).toBe('dark')
  })

  it('recentFiles 最多保留 20 条', () => {
    const files = Array.from({ length: 30 }, (_, i) => `/file-${i}.py`)
    const json = JSON.stringify({ recentFiles: files })
    const state = parsePersistedCodingState(json, DEFAULT_SETTINGS)
    expect(state.recentFiles).toHaveLength(20)
  })

  it('非数组字段回退为空数组', () => {
    const json = JSON.stringify({ favorites: 'not-array', openTabs: 123 })
    const state = parsePersistedCodingState(json, DEFAULT_SETTINGS)
    expect(state.favorites).toEqual([])
    expect(state.openTabs).toEqual([])
  })
})

// ── buildCodingStateSnapshot ──

describe('buildCodingStateSnapshot', () => {
  it('生成 JSON 字符串快照', () => {
    const snapshot = buildCodingStateSnapshot({
      tabs: [{ id: 't1', filePath: '/a.py', chatMessages: [] }],
      activeTabId: 't1',
      favorites: ['/a.py'],
      settings: DEFAULT_SETTINGS,
      recentFiles: [],
      pythonInfo: null,
      nodeInfo: null,
    })
    const parsed = JSON.parse(snapshot)
    expect(parsed.openTabs).toHaveLength(1)
    expect(parsed.openTabs[0].filePath).toBe('/a.py')
    expect(parsed.activeTabId).toBe('t1')
    expect(parsed.favorites).toEqual(['/a.py'])
  })

  it('tab 无 chatMessages 时默认空数组', () => {
    const snapshot = buildCodingStateSnapshot({
      tabs: [{ id: 't1', filePath: '/a.py' }],
      activeTabId: 't1',
      favorites: [],
      settings: {},
      recentFiles: [],
      pythonInfo: null,
      nodeInfo: null,
    })
    const parsed = JSON.parse(snapshot)
    expect(parsed.openTabs[0].chatMessages).toEqual([])
  })
})

// ── ensureActiveItemId ──

describe('ensureActiveItemId', () => {
  it('activeId 存在于列表中时保持不变', () => {
    const items = [makeItem('a'), makeItem('b')]
    expect(ensureActiveItemId(items, 'b')).toBe('b')
  })

  it('activeId 不在列表中时回退到第一个', () => {
    const items = [makeItem('a'), makeItem('b')]
    expect(ensureActiveItemId(items, 'nonexistent')).toBe('a')
  })

  it('空 activeId 回退到第一个', () => {
    const items = [makeItem('a')]
    expect(ensureActiveItemId(items, '')).toBe('a')
  })

  it('空列表返回空字符串', () => {
    expect(ensureActiveItemId([], 'x')).toBe('')
  })
})

// ── removeItemWithActiveFallback ──

describe('removeItemWithActiveFallback', () => {
  it('移除非活跃项时 activeId 不变', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')]
    const result = removeItemWithActiveFallback(items, 'a', 'b')
    expect(result.items).toHaveLength(2)
    expect(result.activeId).toBe('a')
  })

  it('移除活跃项时回退到相邻项', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')]
    const result = removeItemWithActiveFallback(items, 'b', 'b')
    expect(result.items).toHaveLength(2)
    expect(result.activeId).toBe('c')
  })

  it('移除最后一个活跃项时回退到前一个', () => {
    const items = [makeItem('a'), makeItem('b')]
    const result = removeItemWithActiveFallback(items, 'b', 'b')
    expect(result.activeId).toBe('a')
  })

  it('移除唯一项时 activeId 为空', () => {
    const items = [makeItem('a')]
    const result = removeItemWithActiveFallback(items, 'a', 'a')
    expect(result.items).toHaveLength(0)
    expect(result.activeId).toBe('')
  })
})

// ── updateItemById ──

describe('updateItemById', () => {
  it('更新指定 item 的字段', () => {
    const items = [makeItem('a', 'old'), makeItem('b')]
    const updated = updateItemById(items, 'a', { name: 'new' })
    expect(updated[0].name).toBe('new')
    expect(updated[1].name).toBe('item-b')
  })

  it('ID 不存在时列表不变', () => {
    const items = [makeItem('a')]
    const updated = updateItemById(items, 'x', { name: 'new' })
    expect(updated[0].name).toBe('item-a')
  })
})

// ── reorderItemsById ──

describe('reorderItemsById', () => {
  it('将 from 移动到 to 的位置', () => {
    const items = [makeItem('a'), makeItem('b'), makeItem('c')]
    const reordered = reorderItemsById(items, 'a', 'c')
    expect(reordered.map(i => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('ID 不存在时返回原列表', () => {
    const items = [makeItem('a'), makeItem('b')]
    const reordered = reorderItemsById(items, 'x', 'a')
    expect(reordered).toBe(items)
  })
})

// ── toggleStringInList ──

describe('toggleStringInList', () => {
  it('不存在时添加', () => {
    expect(toggleStringInList(['a'], 'b')).toEqual(['a', 'b'])
  })

  it('已存在时移除', () => {
    expect(toggleStringInList(['a', 'b'], 'a')).toEqual(['b'])
  })

  it('空列表时添加', () => {
    expect(toggleStringInList([], 'x')).toEqual(['x'])
  })
})

// ── prependRecentFile ──

describe('prependRecentFile', () => {
  it('新文件插到最前', () => {
    expect(prependRecentFile(['/b.py'], '/a.py')).toEqual(['/a.py', '/b.py'])
  })

  it('已存在的文件去重并移到最前', () => {
    expect(prependRecentFile(['/a.py', '/b.py'], '/b.py')).toEqual(['/b.py', '/a.py'])
  })

  it('超过 limit 时截断', () => {
    const files = Array.from({ length: 5 }, (_, i) => `/f${i}.py`)
    const result = prependRecentFile(files, '/new.py', 3)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('/new.py')
  })
})

// ── prependLimitedEntry ──

describe('prependLimitedEntry', () => {
  it('插到最前并限制长度', () => {
    const result = prependLimitedEntry([1, 2, 3], 0, 3)
    expect(result).toEqual([0, 1, 2])
  })
})

// ── createRuntimeCheckFailure ──

describe('createRuntimeCheckFailure', () => {
  it('生成失败结果对象', () => {
    const result = createRuntimeCheckFailure(new Error('not found'))
    expect(result.available).toBe(false)
    expect(result.version).toBeNull()
    expect(result.path).toBeNull()
    expect(result.error).toContain('not found')
  })

  it('字符串错误也能处理', () => {
    const result = createRuntimeCheckFailure('timeout')
    expect(result.error).toBe('timeout')
  })
})
