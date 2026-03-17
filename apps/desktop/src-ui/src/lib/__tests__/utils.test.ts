import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('合并多个 class 名', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1')
  })

  it('条件 class', () => {
    const isActive = true
    expect(cn('base', isActive && 'active')).toBe('base active')
  })

  it('false 值被过滤', () => {
    expect(cn('base', false, null, undefined, 'end')).toBe('base end')
  })

  it('Tailwind 冲突自动合并（后者胜出）', () => {
    const result = cn('px-2 py-1', 'px-4')
    expect(result).toBe('py-1 px-4')
  })

  it('空输入返回空字符串', () => {
    expect(cn()).toBe('')
  })
})
