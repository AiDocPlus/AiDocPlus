import { describe, it, expect } from 'vitest'
import {
  generateConversationId,
  getConversationGroup,
  generateConversationTitle,
  createConversationRecord,
  createConversationState,
  updateConversationInList,
  removeConversationFromList,
  deleteConversationState,
  appendMessageToConversationList,
  sortConversationsWithPinnedFirst,
  togglePinnedConversationInList,
  filterConversations,
  findConversationById,
  filterConversationsByDocument,
  findConversationForDocument,
} from '../useConversationsStore.helpers'
import type { Conversation, AIMessage } from '@aidocplus/shared-types'

// ── 测试数据工厂 ──

function makeMessage(role: 'user' | 'assistant', content: string): AIMessage {
  return { role, content }
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    documentId: 'doc-1',
    title: 'Test Conversation',
    messages: [],
    createdAt: 1000,
    updatedAt: 1000,
    isPinned: false,
    ...overrides,
  }
}

// ── generateConversationId ──

describe('generateConversationId', () => {
  it('生成带 conv- 前缀的 ID', () => {
    const id = generateConversationId(1000, 0.5)
    expect(id).toMatch(/^conv-1000-/)
  })

  it('不同随机值生成不同 ID', () => {
    const a = generateConversationId(1000, 0.1)
    const b = generateConversationId(1000, 0.9)
    expect(a).not.toBe(b)
  })
})

// ── getConversationGroup ──

describe('getConversationGroup', () => {
  it('今天的时间戳归为 today', () => {
    expect(getConversationGroup(Date.now())).toBe('today')
  })

  it('昨天的时间戳归为 yesterday', () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000
    expect(getConversationGroup(yesterday)).toBe('yesterday')
  })

  it('3 天前归为 lastWeek', () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
    expect(getConversationGroup(threeDaysAgo)).toBe('lastWeek')
  })

  it('15 天前归为 lastMonth', () => {
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000
    expect(getConversationGroup(fifteenDaysAgo)).toBe('lastMonth')
  })

  it('60 天前归为 older', () => {
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
    expect(getConversationGroup(sixtyDaysAgo)).toBe('older')
  })
})

// ── generateConversationTitle ──

describe('generateConversationTitle', () => {
  it('空消息返回 New Conversation', () => {
    expect(generateConversationTitle([])).toBe('New Conversation')
  })

  it('截取第一条用户消息前 50 字符', () => {
    const msg = makeMessage('user', '这是一条短消息')
    expect(generateConversationTitle([msg])).toBe('这是一条短消息')
  })

  it('超过 50 字符时截断并加省略号', () => {
    const longContent = 'a'.repeat(100)
    const msg = makeMessage('user', longContent)
    const title = generateConversationTitle([msg])
    expect(title).toBe('a'.repeat(50) + '...')
  })

  it('跳过 assistant 消息，使用第一条 user 消息', () => {
    const messages = [
      makeMessage('assistant', '你好'),
      makeMessage('user', '我的问题'),
    ]
    expect(generateConversationTitle(messages)).toBe('我的问题')
  })

  it('没有 user 消息时返回 New Conversation', () => {
    const messages = [makeMessage('assistant', '你好')]
    expect(generateConversationTitle(messages)).toBe('New Conversation')
  })
})

// ── createConversationRecord ──

describe('createConversationRecord', () => {
  it('创建基本对话记录', () => {
    const record = createConversationRecord('doc-1', undefined, 1000000)
    expect(record.documentId).toBe('doc-1')
    expect(record.id).toMatch(/^conv-/)
    expect(record.messages).toEqual([])
    expect(record.title).toBe('New Conversation')
    expect(record.isPinned).toBe(false)
    expect(record.createdAt).toBe(1000)
    expect(record.updatedAt).toBe(1000)
  })

  it('创建时带首条消息', () => {
    const msg = makeMessage('user', '你好')
    const record = createConversationRecord('doc-1', msg, 2000000)
    expect(record.messages).toEqual([msg])
  })
})

// ── createConversationState ──

describe('createConversationState', () => {
  it('将新对话插到列表最前面', () => {
    const existing = [makeConversation({ id: 'old' })]
    const state = createConversationState(existing, 'doc-2', undefined, 5000000)
    expect(state.conversations).toHaveLength(2)
    expect(state.conversations[0].id).toBe(state.currentConversationId)
    expect(state.conversations[1].id).toBe('old')
  })
})

// ── updateConversationInList ──

describe('updateConversationInList', () => {
  it('更新指定对话的字段', () => {
    const list = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })]
    const updated = updateConversationInList(list, 'c1', { title: '新标题' }, 2000000)
    expect(updated[0].title).toBe('新标题')
    expect(updated[0].updatedAt).toBe(2000)
    expect(updated[1].title).toBe('Test Conversation')
  })

  it('ID 不存在时列表不变', () => {
    const list = [makeConversation({ id: 'c1' })]
    const updated = updateConversationInList(list, 'nonexistent', { title: 'x' })
    expect(updated[0].title).toBe('Test Conversation')
  })
})

// ── removeConversationFromList ──

describe('removeConversationFromList', () => {
  it('移除指定对话', () => {
    const list = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })]
    expect(removeConversationFromList(list, 'c1')).toHaveLength(1)
    expect(removeConversationFromList(list, 'c1')[0].id).toBe('c2')
  })

  it('ID 不存在时列表不变', () => {
    const list = [makeConversation({ id: 'c1' })]
    expect(removeConversationFromList(list, 'x')).toHaveLength(1)
  })
})

// ── deleteConversationState ──

describe('deleteConversationState', () => {
  it('删除当前对话时清空 currentConversationId', () => {
    const list = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })]
    const state = deleteConversationState(list, 'c1', 'c1')
    expect(state.conversations).toHaveLength(1)
    expect(state.currentConversationId).toBeNull()
  })

  it('删除非当前对话时保留 currentConversationId', () => {
    const list = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })]
    const state = deleteConversationState(list, 'c1', 'c2')
    expect(state.conversations).toHaveLength(1)
    expect(state.currentConversationId).toBe('c1')
  })
})

// ── appendMessageToConversationList ──

describe('appendMessageToConversationList', () => {
  it('追加消息到指定对话', () => {
    const list = [makeConversation({ id: 'c1', messages: [] })]
    const msg = makeMessage('user', '新消息')
    const updated = appendMessageToConversationList(list, 'c1', msg, 3000000)
    expect(updated[0].messages).toHaveLength(1)
    expect(updated[0].messages[0].content).toBe('新消息')
    expect(updated[0].updatedAt).toBe(3000)
  })

  it('首条用户消息会自动更新 title', () => {
    const list = [makeConversation({ id: 'c1', title: 'New Conversation', messages: [] })]
    const msg = makeMessage('user', '请帮我写一篇文章')
    const updated = appendMessageToConversationList(list, 'c1', msg)
    expect(updated[0].title).toBe('请帮我写一篇文章')
  })

  it('已有自定义 title 时不覆盖', () => {
    const list = [makeConversation({ id: 'c1', title: '我的对话', messages: [] })]
    const msg = makeMessage('user', '新消息')
    const updated = appendMessageToConversationList(list, 'c1', msg)
    expect(updated[0].title).toBe('我的对话')
  })
})

// ── sortConversationsWithPinnedFirst ──

describe('sortConversationsWithPinnedFirst', () => {
  it('置顶对话排在最前', () => {
    const list = [
      makeConversation({ id: 'c1', isPinned: false, updatedAt: 3000 }),
      makeConversation({ id: 'c2', isPinned: true, updatedAt: 1000 }),
      makeConversation({ id: 'c3', isPinned: false, updatedAt: 2000 }),
    ]
    const sorted = sortConversationsWithPinnedFirst(list)
    expect(sorted[0].id).toBe('c2')
    expect(sorted[1].id).toBe('c1')
    expect(sorted[2].id).toBe('c3')
  })
})

// ── togglePinnedConversationInList ──

describe('togglePinnedConversationInList', () => {
  it('切换置顶状态', () => {
    const list = [makeConversation({ id: 'c1', isPinned: false })]
    const toggled = togglePinnedConversationInList(list, 'c1')
    expect(toggled[0].isPinned).toBe(true)
  })
})

// ── filterConversations ──

describe('filterConversations', () => {
  it('空搜索词返回全部', () => {
    const list = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })]
    expect(filterConversations(list, '')).toHaveLength(2)
    expect(filterConversations(list, '  ')).toHaveLength(2)
  })

  it('按标题搜索', () => {
    const list = [
      makeConversation({ id: 'c1', title: 'AI 写作助手' }),
      makeConversation({ id: 'c2', title: '代码审查' }),
    ]
    expect(filterConversations(list, 'AI')).toHaveLength(1)
    expect(filterConversations(list, 'AI')[0].id).toBe('c1')
  })

  it('按消息内容搜索', () => {
    const list = [
      makeConversation({ id: 'c1', title: 'A', messages: [makeMessage('user', '写一首诗')] }),
      makeConversation({ id: 'c2', title: 'B', messages: [makeMessage('user', '翻译英文')] }),
    ]
    expect(filterConversations(list, '诗')).toHaveLength(1)
    expect(filterConversations(list, '诗')[0].id).toBe('c1')
  })

  it('搜索不区分大小写', () => {
    const list = [makeConversation({ id: 'c1', title: 'Hello World' })]
    expect(filterConversations(list, 'hello')).toHaveLength(1)
  })
})

// ── findConversationById ──

describe('findConversationById', () => {
  it('找到匹配的对话', () => {
    const list = [makeConversation({ id: 'c1' }), makeConversation({ id: 'c2' })]
    expect(findConversationById(list, 'c2')?.id).toBe('c2')
  })

  it('null ID 返回 undefined', () => {
    expect(findConversationById([], null)).toBeUndefined()
  })

  it('不存在的 ID 返回 undefined', () => {
    expect(findConversationById([makeConversation()], 'nonexistent')).toBeUndefined()
  })
})

// ── filterConversationsByDocument ──

describe('filterConversationsByDocument', () => {
  it('按文档 ID 过滤', () => {
    const list = [
      makeConversation({ id: 'c1', documentId: 'doc-1' }),
      makeConversation({ id: 'c2', documentId: 'doc-2' }),
      makeConversation({ id: 'c3', documentId: 'doc-1' }),
    ]
    const filtered = filterConversationsByDocument(list, 'doc-1')
    expect(filtered).toHaveLength(2)
    expect(filtered.map(c => c.id)).toEqual(['c1', 'c3'])
  })
})

// ── findConversationForDocument ──

describe('findConversationForDocument', () => {
  it('当前对话匹配文档时直接返回', () => {
    const list = [
      makeConversation({ id: 'c1', documentId: 'doc-1' }),
      makeConversation({ id: 'c2', documentId: 'doc-1' }),
    ]
    expect(findConversationForDocument(list, 'doc-1', 'c2')?.id).toBe('c2')
  })

  it('当前对话不匹配时回退到文档的第一个对话', () => {
    const list = [
      makeConversation({ id: 'c1', documentId: 'doc-1' }),
      makeConversation({ id: 'c2', documentId: 'doc-2' }),
    ]
    expect(findConversationForDocument(list, 'doc-1', 'c2')?.id).toBe('c1')
  })

  it('文档无对话时返回 undefined', () => {
    const list = [makeConversation({ id: 'c1', documentId: 'doc-2' })]
    expect(findConversationForDocument(list, 'doc-1', null)).toBeUndefined()
  })
})
