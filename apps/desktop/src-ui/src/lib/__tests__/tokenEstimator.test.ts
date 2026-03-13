/// <reference types="vitest/globals" />

import {
  estimateTokens,
  estimateMessagesTokens,
  getModelContextWindow,
  formatTokenCount,
  truncateMessages,
} from '../tokenEstimator'

// ── estimateTokens ──

describe('estimateTokens', () => {
  it('空字符串返回 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('纯英文按约 4 chars/token 估算', () => {
    // "hello world" = 11 chars, ceil(11/4) = 3
    expect(estimateTokens('hello world')).toBe(3)
  })

  it('纯中文按约 1.5 chars/token 估算', () => {
    // "你好世界" = 4 chars CJK, ceil(4/1.5) = 3
    expect(estimateTokens('你好世界')).toBe(3)
  })

  it('中英混合', () => {
    const text = 'Hello你好' // 5 non-CJK + 2 CJK
    const result = estimateTokens(text)
    expect(result).toBeGreaterThan(0)
    // ceil(5/4) + ceil(2/1.5) = 2 + 2 = 4
    expect(result).toBe(4)
  })

  it('null/undefined 返回 0', () => {
    expect(estimateTokens(null as unknown as string)).toBe(0)
    expect(estimateTokens(undefined as unknown as string)).toBe(0)
  })
})

// ── estimateMessagesTokens ──

describe('estimateMessagesTokens', () => {
  it('空数组返回 3（对话级开销）', () => {
    expect(estimateMessagesTokens([])).toBe(3)
  })

  it('单条消息 = 文本token + 4(消息开销) + 3(对话开销)', () => {
    const msgs = [{ role: 'user', content: 'hello world' }]
    // estimateTokens("hello world") = 3, + 4 + 3 = 10
    expect(estimateMessagesTokens(msgs)).toBe(10)
  })

  it('多条消息累加', () => {
    const msgs = [
      { role: 'system', content: 'You are an assistant' },
      { role: 'user', content: 'Hi' },
    ]
    const result = estimateMessagesTokens(msgs)
    expect(result).toBeGreaterThan(3) // 至少比空数组大
  })
})

// ── getModelContextWindow ──

describe('getModelContextWindow', () => {
  it('精确匹配已知模型', () => {
    expect(getModelContextWindow('gpt-4o')).toBe(128000)
    expect(getModelContextWindow('claude-3-5-sonnet')).toBe(200000)
  })

  it('前缀匹配（带日期后缀的模型名）', () => {
    expect(getModelContextWindow('claude-3-5-sonnet-20241022')).toBe(200000)
  })

  it('provider 回退', () => {
    expect(getModelContextWindow('unknown-model', 'anthropic')).toBe(200000)
  })

  it('未知模型和 provider 返回默认值', () => {
    expect(getModelContextWindow('totally-unknown')).toBe(128000)
  })

  it('无参数返回默认值', () => {
    expect(getModelContextWindow()).toBe(128000)
  })
})

// ── formatTokenCount ──

describe('formatTokenCount', () => {
  it('小于 1000 直接返回数字', () => {
    expect(formatTokenCount(500)).toBe('500')
    expect(formatTokenCount(0)).toBe('0')
  })

  it('千级别格式化为 K', () => {
    expect(formatTokenCount(1000)).toBe('1K')
    expect(formatTokenCount(1234)).toBe('1.2K')
    expect(formatTokenCount(128000)).toBe('128K')
  })

  it('百万级别格式化为 M', () => {
    expect(formatTokenCount(1000000)).toBe('1M')
    expect(formatTokenCount(1048576)).toBe('1.0M')
    expect(formatTokenCount(2097152)).toBe('2.1M')
  })
})

// ── truncateMessages ──

describe('truncateMessages', () => {
  it('短对话不截断', () => {
    const msgs = [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello!' },
    ]
    const result = truncateMessages(msgs, { model: 'gpt-4o' })
    expect(result.truncatedCount).toBe(0)
    expect(result.messages).toHaveLength(3)
  })

  it('system 消息始终保留', () => {
    const msgs = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'A'.repeat(10000) },
      { role: 'assistant', content: 'B'.repeat(10000) },
      { role: 'user', content: 'Latest question' },
    ]
    const result = truncateMessages(msgs, { maxContextTokens: 100, reserveForResponse: 10 })
    // system 消息始终在
    expect(result.messages[0].role).toBe('system')
    expect(result.messages[0].content).toBe('System prompt')
  })

  it('截断后最新消息优先保留', () => {
    const msgs: Array<{ role: string; content: string }> = [
      { role: 'system', content: 'sys' },
    ]
    // 添加大量旧消息
    for (let i = 0; i < 50; i++) {
      msgs.push({ role: 'user', content: `message ${i} ${'x'.repeat(200)}` })
    }
    msgs.push({ role: 'user', content: 'LATEST' })

    const result = truncateMessages(msgs, { maxContextTokens: 500, reserveForResponse: 50 })
    // 最新消息应该被保留
    const lastMsg = result.messages[result.messages.length - 1]
    expect(lastMsg.content).toBe('LATEST')
    expect(result.truncatedCount).toBeGreaterThan(0)
  })
})
