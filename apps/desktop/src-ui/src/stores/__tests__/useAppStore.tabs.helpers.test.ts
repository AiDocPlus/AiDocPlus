/// <reference types="vitest/globals" />

import {
  createDefaultTabPanelState,
  createEditorTab,
  buildRestoredTabs,
  resolveActiveTabState,
  appendActiveTab,
  buildOpenedTabState,
  resolveClosedTabState,
  resolveSwitchedTabState,
  reorderTabs,
  updateTabPanelStateInTabs,
  setTabDirtyState,
} from '../useAppStore.tabs.helpers'
import type { Document, EditorTab } from '@aidocplus/shared-types'

function makeDoc(id: string, title = `Doc ${id}`): Document {
  return { id, title, content: '', projectId: 'p1' } as Document
}

function makeTab(id: string, docId: string, opts: Partial<EditorTab> = {}): EditorTab {
  return {
    id,
    documentId: docId,
    title: `Tab ${id}`,
    isDirty: false,
    isActive: false,
    order: 0,
    panelState: createDefaultTabPanelState(),
    ...opts,
  }
}

// ── createDefaultTabPanelState ──

describe('createDefaultTabPanelState', () => {
  it('默认 chatOpen 为 true', () => {
    const state = createDefaultTabPanelState()
    expect(state.chatOpen).toBe(true)
    expect(state.versionHistoryOpen).toBe(false)
  })

  it('可指定 chatOpen 为 false', () => {
    expect(createDefaultTabPanelState(false).chatOpen).toBe(false)
  })
})

// ── createEditorTab ──

describe('createEditorTab', () => {
  it('创建 tab 基本属性正确', () => {
    const doc = makeDoc('d1', '测试文档')
    const tab = createEditorTab(doc, { order: 3 })
    expect(tab.documentId).toBe('d1')
    expect(tab.title).toBe('测试文档')
    expect(tab.order).toBe(3)
    expect(tab.isActive).toBe(true) // 默认
    expect(tab.isDirty).toBe(false)
    expect(tab.id).toBeTruthy()
  })

  it('可指定自定义 id', () => {
    const doc = makeDoc('d1')
    const tab = createEditorTab(doc, { order: 0, id: 'custom-id' })
    expect(tab.id).toBe('custom-id')
  })

  it('panelState 可部分覆盖', () => {
    const doc = makeDoc('d1')
    const tab = createEditorTab(doc, { order: 0, panelState: { versionHistoryOpen: true } })
    expect(tab.panelState.versionHistoryOpen).toBe(true)
    expect(tab.panelState.chatOpen).toBe(true) // 默认保留
  })
})

// ── buildRestoredTabs ──

describe('buildRestoredTabs', () => {
  it('还原已有文档的 tabs', () => {
    const docs = [makeDoc('d1'), makeDoc('d2')]
    const tabStates = [
      makeTab('t1', 'd1'),
      makeTab('t2', 'd2'),
    ]
    const { restoredTabs, missingDocumentIds } = buildRestoredTabs(tabStates, docs)
    expect(restoredTabs).toHaveLength(2)
    expect(missingDocumentIds).toHaveLength(0)
    expect(restoredTabs[0].title).toBe('Doc d1')
    expect(restoredTabs[1].order).toBe(1)
  })

  it('缺失文档记入 missingDocumentIds', () => {
    const docs = [makeDoc('d1')]
    const tabStates = [makeTab('t1', 'd1'), makeTab('t2', 'd_missing')]
    const { restoredTabs, missingDocumentIds } = buildRestoredTabs(tabStates, docs)
    expect(restoredTabs).toHaveLength(1)
    expect(missingDocumentIds).toEqual(['d_missing'])
  })

  it('空 tabStates 返回空数组', () => {
    const { restoredTabs } = buildRestoredTabs([], [makeDoc('d1')])
    expect(restoredTabs).toHaveLength(0)
  })
})

// ── resolveActiveTabState ──

describe('resolveActiveTabState', () => {
  it('优先使用 preferredActiveTabId', () => {
    const docs = [makeDoc('d1'), makeDoc('d2')]
    const tabs = [makeTab('t1', 'd1'), makeTab('t2', 'd2')]
    const result = resolveActiveTabState(tabs, docs, 't2')
    expect(result.activeTabId).toBe('t2')
    expect(result.currentDocument?.id).toBe('d2')
  })

  it('无 preferred 则用第一个 tab', () => {
    const docs = [makeDoc('d1')]
    const tabs = [makeTab('t1', 'd1')]
    const result = resolveActiveTabState(tabs, docs, null)
    expect(result.activeTabId).toBe('t1')
  })

  it('空 tabs 返回 null', () => {
    const result = resolveActiveTabState([], [], null)
    expect(result.activeTabId).toBeNull()
    expect(result.currentDocument).toBeNull()
  })
})

// ── appendActiveTab ──

describe('appendActiveTab', () => {
  it('新 tab 追加到末尾，旧 tab 全部 deactivate', () => {
    const tabs = [makeTab('t1', 'd1', { isActive: true })]
    const newTab = makeTab('t2', 'd2', { isActive: true })
    const result = appendActiveTab(tabs, newTab)
    expect(result).toHaveLength(2)
    expect(result[0].isActive).toBe(false)
    expect(result[1].isActive).toBe(true)
    expect(result[1].id).toBe('t2')
  })
})

// ── buildOpenedTabState ──

describe('buildOpenedTabState', () => {
  it('打开新文档创建 active tab', () => {
    const tabs = [makeTab('t1', 'd1', { isActive: true })]
    const doc = makeDoc('d2', '新文档')
    const result = buildOpenedTabState(tabs, doc)
    expect(result.tabs).toHaveLength(2)
    expect(result.currentDocument.id).toBe('d2')
    expect(result.activeTabId).toBeTruthy()
    expect(result.tabs[0].isActive).toBe(false) // 旧 tab deactivated
  })
})

// ── resolveClosedTabState ──

describe('resolveClosedTabState', () => {
  const docs = [makeDoc('d1'), makeDoc('d2'), makeDoc('d3')]

  it('关闭非活跃 tab 不影响 activeTabId', () => {
    const tabs = [makeTab('t1', 'd1'), makeTab('t2', 'd2')]
    const result = resolveClosedTabState(tabs, 't1', docs[0], docs, 't2')
    expect(result.tabs).toHaveLength(1)
    expect(result.activeTabId).toBe('t1')
  })

  it('关闭活跃 tab 自动切换到下一个', () => {
    const tabs = [makeTab('t1', 'd1'), makeTab('t2', 'd2'), makeTab('t3', 'd3')]
    const result = resolveClosedTabState(tabs, 't2', docs[1], docs, 't2')
    expect(result.tabs).toHaveLength(2)
    expect(result.activeTabId).not.toBe('t2')
  })

  it('关闭最后一个 tab 返回 null', () => {
    const tabs = [makeTab('t1', 'd1')]
    const result = resolveClosedTabState(tabs, 't1', docs[0], docs, 't1')
    expect(result.tabs).toHaveLength(0)
    expect(result.activeTabId).toBeNull()
    expect(result.currentDocument).toBeNull()
  })

  it('关闭不存在的 tab 不变', () => {
    const tabs = [makeTab('t1', 'd1')]
    const result = resolveClosedTabState(tabs, 't1', docs[0], docs, 'nonexist')
    expect(result.tabs).toHaveLength(1)
  })
})

// ── resolveSwitchedTabState ──

describe('resolveSwitchedTabState', () => {
  it('切换到已有 tab', () => {
    const docs = [makeDoc('d1'), makeDoc('d2')]
    const tabs = [makeTab('t1', 'd1', { isActive: true }), makeTab('t2', 'd2')]
    const result = resolveSwitchedTabState(tabs, docs, 't2')
    expect(result).not.toBeNull()
    expect(result!.activeTabId).toBe('t2')
    expect(result!.tabs.find(t => t.id === 't2')!.isActive).toBe(true)
    expect(result!.tabs.find(t => t.id === 't1')!.isActive).toBe(false)
  })

  it('切换到不存在的 tab 返回 null', () => {
    const result = resolveSwitchedTabState([makeTab('t1', 'd1')], [], 'nonexist')
    expect(result).toBeNull()
  })
})

// ── reorderTabs ──

describe('reorderTabs', () => {
  it('移动 tab 并更新 order', () => {
    const tabs = [
      makeTab('t1', 'd1', { order: 0 }),
      makeTab('t2', 'd2', { order: 1 }),
      makeTab('t3', 'd3', { order: 2 }),
    ]
    const result = reorderTabs(tabs, 0, 2) // t1 移到末尾
    expect(result[0].id).toBe('t2')
    expect(result[1].id).toBe('t3')
    expect(result[2].id).toBe('t1')
    expect(result[0].order).toBe(0)
    expect(result[1].order).toBe(1)
    expect(result[2].order).toBe(2)
  })
})

// ── updateTabPanelStateInTabs ──

describe('updateTabPanelStateInTabs', () => {
  it('更新指定 tab 的 panel 状态', () => {
    const tabs = [makeTab('t1', 'd1')]
    const result = updateTabPanelStateInTabs(tabs, 't1', 'chatOpen', false)
    expect(result[0].panelState.chatOpen).toBe(false)
  })

  it('不影响其他 tab', () => {
    const tabs = [makeTab('t1', 'd1'), makeTab('t2', 'd2')]
    const result = updateTabPanelStateInTabs(tabs, 't1', 'versionHistoryOpen', true)
    expect(result[0].panelState.versionHistoryOpen).toBe(true)
    expect(result[1].panelState.versionHistoryOpen).toBe(false)
  })
})

// ── setTabDirtyState ──

describe('setTabDirtyState', () => {
  it('标记 tab 为 dirty', () => {
    const tabs = [makeTab('t1', 'd1')]
    const result = setTabDirtyState(tabs, 't1', true)
    expect(result[0].isDirty).toBe(true)
  })

  it('清除 dirty 状态', () => {
    const tabs = [makeTab('t1', 'd1', { isDirty: true })]
    const result = setTabDirtyState(tabs, 't1', false)
    expect(result[0].isDirty).toBe(false)
  })
})
