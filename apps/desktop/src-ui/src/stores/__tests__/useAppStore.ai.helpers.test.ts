/// <reference types="vitest/globals" />

import {
  createDefaultStreamState,
  getStreamState,
  setAiMessagesForTab,
  appendAiMessageToTab,
  updateLastAiMessageInMap,
  clearAiMessagesForTab,
  removeAiMessagesTab,
  startTabStreamState,
  createNextTabStreamRequest,
  isMatchingStreamChunk,
  attachTabStreamListener,
  abortTabStreamState,
  clearTabStreamRuntime,
  buildAiStreamingStartState,
  buildAiStreamingStopState,
} from '../useAppStore.ai.helpers'
import type { AIMessage } from '@aidocplus/shared-types'

function makeMsg(role: string, content: string): AIMessage {
  return { role, content } as AIMessage
}

// ── createDefaultStreamState ──

describe('createDefaultStreamState', () => {
  it('返回初始状态', () => {
    const s = createDefaultStreamState()
    expect(s.unlistenFn).toBeNull()
    expect(s.aborted).toBe(false)
    expect(s.sessionId).toBe(0)
    expect(s.requestId).toBeNull()
  })
})

// ── getStreamState ──

describe('getStreamState', () => {
  it('已有 tab 返回对应状态', () => {
    const state = { tab1: { unlistenFn: null, aborted: false, sessionId: 5, requestId: 'r1' } }
    expect(getStreamState(state, 'tab1').sessionId).toBe(5)
  })

  it('不存在的 tab 返回默认状态', () => {
    expect(getStreamState({}, 'missing').sessionId).toBe(0)
  })
})

// ── AI Messages CRUD ──

describe('AI messages operations', () => {
  const msg1 = makeMsg('user', 'hello')
  const msg2 = makeMsg('assistant', 'hi')

  it('setAiMessagesForTab 设置消息', () => {
    const result = setAiMessagesForTab({}, 'tab1', [msg1])
    expect(result['tab1']).toHaveLength(1)
    expect(result['tab1'][0].content).toBe('hello')
  })

  it('appendAiMessageToTab 追加消息', () => {
    const base = { tab1: [msg1] }
    const result = appendAiMessageToTab(base, 'tab1', msg2)
    expect(result['tab1']).toHaveLength(2)
    expect(result['tab1'][1].content).toBe('hi')
  })

  it('appendAiMessageToTab 新 tab 自动初始化', () => {
    const result = appendAiMessageToTab({}, 'new_tab', msg1)
    expect(result['new_tab']).toHaveLength(1)
  })

  it('updateLastAiMessageInMap 更新最后一条', () => {
    const base = { tab1: [msg1, msg2] }
    const result = updateLastAiMessageInMap(base, 'tab1', { content: 'updated' })
    expect(result['tab1'][1].content).toBe('updated')
    expect(result['tab1'][0].content).toBe('hello') // 不影响第一条
  })

  it('updateLastAiMessageInMap 空消息不变', () => {
    const base = { tab1: [] as AIMessage[] }
    const result = updateLastAiMessageInMap(base, 'tab1', { content: 'x' })
    expect(result).toBe(base)
  })

  it('clearAiMessagesForTab 清空消息', () => {
    const base = { tab1: [msg1, msg2] }
    const result = clearAiMessagesForTab(base, 'tab1')
    expect(result['tab1']).toHaveLength(0)
  })

  it('removeAiMessagesTab 删除整个 tab', () => {
    const base = { tab1: [msg1], tab2: [msg2] }
    const result = removeAiMessagesTab(base, 'tab1')
    expect(result['tab1']).toBeUndefined()
    expect(result['tab2']).toHaveLength(1)
  })
})

// ── Stream State ──

describe('stream state operations', () => {
  it('startTabStreamState 初始化流', () => {
    const result = startTabStreamState({}, 'tab1', 1, 'req_1')
    expect(result['tab1'].sessionId).toBe(1)
    expect(result['tab1'].requestId).toBe('req_1')
    expect(result['tab1'].aborted).toBe(false)
  })

  it('createNextTabStreamRequest 递增 sessionId', () => {
    const base = { tab1: { unlistenFn: null, aborted: false, sessionId: 3, requestId: 'r3' } }
    const result = createNextTabStreamRequest(base, 'tab1', 'chat', 1000)
    expect(result.sessionId).toBe(4)
    expect(result.requestId).toBe('chat_1000_4')
    expect(result.streamStateByTab['tab1'].sessionId).toBe(4)
  })

  it('createNextTabStreamRequest 新 tab 从 1 开始', () => {
    const result = createNextTabStreamRequest({}, 'new_tab', 'gen', 2000)
    expect(result.sessionId).toBe(1)
    expect(result.requestId).toBe('gen_2000_1')
  })

  it('isMatchingStreamChunk 匹配正确的流', () => {
    const state = { unlistenFn: null, aborted: false, sessionId: 5, requestId: 'r5' }
    expect(isMatchingStreamChunk(state, 5, 'r5', 'r5')).toBe(true)
  })

  it('isMatchingStreamChunk 已中止返回 false', () => {
    const state = { unlistenFn: null, aborted: true, sessionId: 5, requestId: 'r5' }
    expect(isMatchingStreamChunk(state, 5, 'r5', 'r5')).toBe(false)
  })

  it('isMatchingStreamChunk sessionId 不匹配返回 false', () => {
    const state = { unlistenFn: null, aborted: false, sessionId: 5, requestId: 'r5' }
    expect(isMatchingStreamChunk(state, 4, 'r5', 'r5')).toBe(false)
  })

  it('isMatchingStreamChunk requestId 不匹配返回 false', () => {
    const state = { unlistenFn: null, aborted: false, sessionId: 5, requestId: 'r5' }
    expect(isMatchingStreamChunk(state, 5, 'r5', 'r_other')).toBe(false)
  })

  it('isMatchingStreamChunk undefined state 返回 false', () => {
    expect(isMatchingStreamChunk(undefined, 1, 'r1', 'r1')).toBe(false)
  })

  it('attachTabStreamListener 挂载监听器', () => {
    const fn = () => {}
    const result = attachTabStreamListener({}, 'tab1', fn)
    expect(result['tab1'].unlistenFn).toBe(fn)
  })

  it('abortTabStreamState 中止流', () => {
    const base = { tab1: { unlistenFn: null, aborted: false, sessionId: 3, requestId: 'r3' } }
    const result = abortTabStreamState(base, 'tab1')
    expect(result['tab1'].aborted).toBe(true)
    expect(result['tab1'].sessionId).toBe(4) // 递增
    expect(result['tab1'].requestId).toBeNull()
  })

  it('clearTabStreamRuntime 清理运行时', () => {
    const fn = () => {}
    const base = { tab1: { unlistenFn: fn, aborted: false, sessionId: 3, requestId: 'r3' } }
    const result = clearTabStreamRuntime(base, 'tab1')
    expect(result['tab1'].unlistenFn).toBeNull()
    expect(result['tab1'].requestId).toBeNull()
    expect(result['tab1'].sessionId).toBe(3) // 不变
  })
})

// ── buildAiStreamingStartState / StopState ──

describe('buildAiStreamingStartState / StopState', () => {
  it('start 带 tabId', () => {
    const s = buildAiStreamingStartState('tab1')
    expect(s.isAiStreaming).toBe(true)
    expect(s.error).toBeNull()
    expect(s.aiStreamingTabId).toBe('tab1')
  })

  it('start 不带 tabId', () => {
    const s = buildAiStreamingStartState()
    expect(s.isAiStreaming).toBe(true)
    expect(s.aiStreamingTabId).toBeUndefined()
  })

  it('stop 重置状态', () => {
    const s = buildAiStreamingStopState()
    expect(s.isAiStreaming).toBe(false)
    expect(s.aiStreamingTabId).toBeNull()
  })
})
