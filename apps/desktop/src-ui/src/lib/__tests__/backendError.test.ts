/// <reference types="vitest/globals" />

// Mock i18n 模块
vi.mock('@/i18n', () => ({
  default: {
    t: (key: string) => key,
    exists: (key: string) => key.startsWith('errors.backend.'),
  },
}))

import { parseBackendError, formatBackendError } from '../backendError'
import type { ErrorCode } from '../backendError'

// ── parseBackendError ──

describe('parseBackendError', () => {
  it('解析结构化 Tauri 错误 { code, message }', () => {
    const err = { code: 'DocumentNotFound', message: '文档未找到: abc' }
    const result = parseBackendError(err)
    expect(result.code).toBe('DocumentNotFound')
    expect(result.message).toBe('文档未找到: abc')
  })

  it('解析所有 ErrorCode', () => {
    const codes: ErrorCode[] = [
      'IoError', 'SerializeError', 'ProjectNotFound', 'DocumentNotFound',
      'VersionNotFound', 'ValidationError', 'ExportFailed', 'ImportFailed',
      'AiError', 'SecurityError', 'ResourceError', 'ExternalToolError', 'Internal',
    ]
    for (const code of codes) {
      const result = parseBackendError({ code, message: 'test' })
      expect(result.code).toBe(code)
    }
  })

  it('解析字符串错误', () => {
    const result = parseBackendError('something went wrong')
    expect(result.code).toBeNull()
    expect(result.message).toBe('something went wrong')
  })

  it('解析 Error 实例', () => {
    const result = parseBackendError(new Error('network error'))
    expect(result.code).toBeNull()
    expect(result.message).toBe('network error')
  })

  it('解析带 message 的普通对象（无 code）', () => {
    const result = parseBackendError({ message: 'some error' })
    expect(result.code).toBeNull()
    expect(result.message).toBe('some error')
  })

  it('解析无 message 的对象 → JSON.stringify', () => {
    const result = parseBackendError({ foo: 'bar' })
    expect(result.code).toBeNull()
    expect(result.message).toBe('{"foo":"bar"}')
  })

  it('处理 null', () => {
    const result = parseBackendError(null)
    expect(result.code).toBeNull()
    expect(result.message).toBe('null')
  })

  it('处理 undefined', () => {
    const result = parseBackendError(undefined)
    expect(result.code).toBeNull()
    expect(result.message).toBe('undefined')
  })

  it('处理数字', () => {
    const result = parseBackendError(42)
    expect(result.code).toBeNull()
    expect(result.message).toBe('42')
  })
})

// ── formatBackendError ──

describe('formatBackendError', () => {
  it('有 code 时返回翻译 + 详细信息', () => {
    const err = { code: 'DocumentNotFound', message: '文档未找到: abc' }
    const result = formatBackendError(err)
    // mock i18n.t 返回 key 本身，exists 返回 true
    expect(result).toBe('errors.backend.DocumentNotFound：文档未找到: abc')
  })

  it('includeDetail=false 时只返回翻译', () => {
    const err = { code: 'ValidationError', message: '标题过长' }
    const result = formatBackendError(err, false)
    expect(result).toBe('errors.backend.ValidationError')
  })

  it('无 code 时返回原始 message', () => {
    const result = formatBackendError('plain error')
    expect(result).toBe('plain error')
  })

  it('空 message 返回 fallback', () => {
    const result = formatBackendError('')
    expect(result).toBe('errors.general')
  })
})
