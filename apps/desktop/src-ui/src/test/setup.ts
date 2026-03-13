/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest'

// Mock @tauri-apps/api/core 以便在非 Tauri 环境下运行测试
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}))
