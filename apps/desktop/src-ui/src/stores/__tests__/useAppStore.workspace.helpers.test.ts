import { describe, it, expect } from 'vitest'
import {
  buildWorkspaceStateSnapshot,
  collectWorkspaceNeededProjectIds,
  hasWorkspaceProjectIds,
  collectWorkspaceTabDocumentIds,
  markActiveWorkspaceTabs,
  resolveWorkspaceUiRestore,
  buildRestoredWorkspaceTabsState,
} from '../useAppStore.workspace.helpers'
import type { Document, EditorTab } from '@aidocplus/shared-types'

function makeDoc(id: string, projectId = 'proj-1'): Document {
  return { id, projectId, title: `Doc ${id}`, content: '', authorNotes: '' } as Document
}

function makeTab(id: string, documentId: string): EditorTab {
  return {
    id, documentId, title: `Tab ${id}`, order: 0, isActive: false, isDirty: false,
    panelState: { versionHistoryOpen: false, chatOpen: true, rightSidebarOpen: false, layoutMode: 'horizontal', splitRatio: 50, chatPanelWidth: 320 },
  } as unknown as EditorTab
}

// ── buildWorkspaceStateSnapshot ──

describe('buildWorkspaceStateSnapshot', () => {
  it('生成正确的 workspace 快照', () => {
    const doc = makeDoc('d1', 'proj-1')
    const tab = makeTab('t1', 'd1')
    const snapshot = buildWorkspaceStateSnapshot({
      currentProject: { id: 'proj-1' },
      tabs: [tab],
      documents: [doc],
      currentDocument: doc,
      activeTabId: 't1',
      sidebarOpen: true,
      chatOpen: false,
      sidebarWidth: 300,
    })
    expect(snapshot.currentProjectId).toBe('proj-1')
    expect(snapshot.openDocumentIds).toEqual(['d1'])
    expect(snapshot.currentDocumentId).toBe('d1')
    expect(snapshot.activeTabId).toBe('t1')
    expect(snapshot.uiState.sidebarOpen).toBe(true)
    expect(snapshot.uiState.chatOpen).toBe(false)
    expect(snapshot.uiState.sidebarWidth).toBe(300)
    expect(snapshot.tabs).toHaveLength(1)
    expect(snapshot.tabs[0].projectId).toBe('proj-1')
  })

  it('无项目时 currentProjectId 为 null', () => {
    const snapshot = buildWorkspaceStateSnapshot({
      currentProject: null,
      tabs: [],
      documents: [],
      currentDocument: null,
      activeTabId: null,
      sidebarOpen: true,
      chatOpen: true,
      sidebarWidth: 256,
    })
    expect(snapshot.currentProjectId).toBeNull()
    expect(snapshot.openDocumentIds).toEqual([])
  })
})

// ── collectWorkspaceNeededProjectIds ──

describe('collectWorkspaceNeededProjectIds', () => {
  it('收集尚未加载的项目 ID', () => {
    const tabStates = [
      { id: 't1', documentId: 'd1', projectId: 'proj-1', panelState: {} },
      { id: 't2', documentId: 'd2', projectId: 'proj-2', panelState: {} },
    ]
    const loadedDocs = [makeDoc('d1', 'proj-1')]
    const needed = collectWorkspaceNeededProjectIds(tabStates as any, loadedDocs)
    expect(needed).toEqual(['proj-2'])
  })

  it('所有项目已加载时返回空数组', () => {
    const tabStates = [
      { id: 't1', documentId: 'd1', projectId: 'proj-1', panelState: {} },
    ]
    const loadedDocs = [makeDoc('d1', 'proj-1')]
    expect(collectWorkspaceNeededProjectIds(tabStates as any, loadedDocs)).toEqual([])
  })
})

// ── hasWorkspaceProjectIds ──

describe('hasWorkspaceProjectIds', () => {
  it('有 projectId 时返回 true', () => {
    expect(hasWorkspaceProjectIds([
      { id: 't1', documentId: 'd1', projectId: 'proj-1', panelState: {} },
    ] as any)).toBe(true)
  })

  it('无 projectId 时返回 false', () => {
    expect(hasWorkspaceProjectIds([
      { id: 't1', documentId: 'd1', panelState: {} },
    ] as any)).toBe(false)
  })

  it('空数组返回 false', () => {
    expect(hasWorkspaceProjectIds([])).toBe(false)
  })
})

// ── collectWorkspaceTabDocumentIds ──

describe('collectWorkspaceTabDocumentIds', () => {
  it('收集所有 tab 的 documentId', () => {
    const tabs = [
      { id: 't1', documentId: 'd1', panelState: {} },
      { id: 't2', documentId: 'd2', panelState: {} },
    ]
    const ids = collectWorkspaceTabDocumentIds(tabs as any)
    expect(ids.size).toBe(2)
    expect(ids.has('d1')).toBe(true)
    expect(ids.has('d2')).toBe(true)
  })

  it('去重', () => {
    const tabs = [
      { id: 't1', documentId: 'd1', panelState: {} },
      { id: 't2', documentId: 'd1', panelState: {} },
    ]
    expect(collectWorkspaceTabDocumentIds(tabs as any).size).toBe(1)
  })
})

// ── markActiveWorkspaceTabs ──

describe('markActiveWorkspaceTabs', () => {
  it('标记活跃标签', () => {
    const tabs = [makeTab('t1', 'd1'), makeTab('t2', 'd2')]
    const marked = markActiveWorkspaceTabs(tabs, 't2')
    expect(marked[0].isActive).toBe(false)
    expect(marked[1].isActive).toBe(true)
  })

  it('null activeTabId 时全部不活跃', () => {
    const tabs = [makeTab('t1', 'd1')]
    const marked = markActiveWorkspaceTabs(tabs, null)
    expect(marked[0].isActive).toBe(false)
  })
})

// ── buildRestoredWorkspaceTabsState ──

describe('buildRestoredWorkspaceTabsState', () => {
  it('构建恢复后的标签页状态', () => {
    const doc = makeDoc('d1')
    const tabs = [makeTab('t1', 'd1'), makeTab('t2', 'd2')]
    const state = buildRestoredWorkspaceTabsState(tabs, 't1', doc)
    expect(state.tabs[0].isActive).toBe(true)
    expect(state.tabs[1].isActive).toBe(false)
    expect(state.activeTabId).toBe('t1')
    expect(state.currentDocument).toBe(doc)
  })
})

// ── resolveWorkspaceUiRestore ──

describe('resolveWorkspaceUiRestore', () => {
  it('从保存的 UI 状态恢复', () => {
    const result = resolveWorkspaceUiRestore({
      sidebarOpen: false,
      chatOpen: false,
      sidebarWidth: 400,
    })
    expect(result.sidebarOpen).toBe(false)
    expect(result.chatOpen).toBe(false)
    expect(result.sidebarWidth).toBe(400)
  })

  it('null 输入使用默认值', () => {
    const result = resolveWorkspaceUiRestore(null)
    expect(result.sidebarOpen).toBe(true)
    expect(result.chatOpen).toBe(true)
    expect(result.sidebarWidth).toBeUndefined()
  })

  it('undefined 输入使用默认值', () => {
    const result = resolveWorkspaceUiRestore(undefined)
    expect(result.sidebarOpen).toBe(true)
    expect(result.chatOpen).toBe(true)
  })
})
