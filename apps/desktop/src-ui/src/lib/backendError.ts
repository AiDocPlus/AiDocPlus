/**
 * 统一解析 Rust 后端（Tauri invoke）返回的结构化错误。
 *
 * Rust AppError 序列化为 { code: ErrorCode, message: string }。
 * Tauri 2 在 invoke 失败时将该 JSON 作为 rejection value 传到前端。
 *
 * 本模块提供：
 * - `parseBackendError(err)` — 从任意 catch 值中提取 { code, message }
 * - `formatBackendError(err)` — 返回 i18n 友好的用户可读字符串
 */

import i18n from '@/i18n';

/** Rust ErrorCode 枚举值（与 error.rs 中的 ErrorCode 一一对应） */
export type ErrorCode =
  | 'IoError'
  | 'SerializeError'
  | 'ProjectNotFound'
  | 'DocumentNotFound'
  | 'VersionNotFound'
  | 'ValidationError'
  | 'ExportFailed'
  | 'ImportFailed'
  | 'AiError'
  | 'SecurityError'
  | 'ResourceError'
  | 'ExternalToolError'
  | 'Internal';

/** 解析后的后端错误结构 */
export interface BackendError {
  /** Rust ErrorCode 枚举值 */
  code: ErrorCode | null;
  /** Rust 端的原始错误消息（中文） */
  message: string;
}

/**
 * 从 Tauri invoke 的 catch 值中提取结构化错误信息。
 *
 * 支持的格式：
 * 1. `{ code: "DocumentNotFound", message: "文档未找到: xxx" }` — AppError 序列化
 * 2. 字符串 — 旧式纯文本错误 / 非 Tauri 错误
 * 3. Error 对象
 * 4. 其他 — JSON.stringify fallback
 */
export function parseBackendError(err: unknown): BackendError {
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    // Tauri 2 结构化错误：{ code, message }
    if (typeof obj.code === 'string' && typeof obj.message === 'string') {
      return { code: obj.code as ErrorCode, message: obj.message };
    }
    // Error 实例
    if (err instanceof Error) {
      return { code: null, message: err.message };
    }
    // 其他对象
    if (typeof obj.message === 'string') {
      return { code: null, message: obj.message };
    }
    return { code: null, message: JSON.stringify(err) };
  }
  if (typeof err === 'string') {
    return { code: null, message: err };
  }
  return { code: null, message: String(err) };
}

/**
 * ErrorCode → i18n 翻译键的映射。
 * 对应 translation.json 中 `errors.backend.*` 路径。
 */
const CODE_TO_I18N_KEY: Record<ErrorCode, string> = {
  IoError: 'errors.backend.IoError',
  SerializeError: 'errors.backend.SerializeError',
  ProjectNotFound: 'errors.backend.ProjectNotFound',
  DocumentNotFound: 'errors.backend.DocumentNotFound',
  VersionNotFound: 'errors.backend.VersionNotFound',
  ValidationError: 'errors.backend.ValidationError',
  ExportFailed: 'errors.backend.ExportFailed',
  ImportFailed: 'errors.backend.ImportFailed',
  AiError: 'errors.backend.AiError',
  SecurityError: 'errors.backend.SecurityError',
  ResourceError: 'errors.backend.ResourceError',
  ExternalToolError: 'errors.backend.ExternalToolError',
  Internal: 'errors.backend.Internal',
};

/**
 * 将 catch 值格式化为用户可读的错误字符串。
 *
 * 逻辑：
 * 1. 如果有 ErrorCode 且 i18n 中有对应翻译 → 使用翻译 + 附带详细信息
 * 2. 否则 fallback 到原始 message
 *
 * @param err - catch 块中的 error 值
 * @param includeDetail - 是否在翻译后附加原始详细信息（默认 true）
 */
export function formatBackendError(err: unknown, includeDetail = true): string {
  const { code, message } = parseBackendError(err);

  if (code) {
    const key = CODE_TO_I18N_KEY[code];
    if (key && i18n.exists(key)) {
      const translated = i18n.t(key);
      if (includeDetail && message && translated !== message) {
        return `${translated}：${message}`;
      }
      return translated;
    }
  }

  return message || i18n.t('errors.general', { defaultValue: '发生错误' });
}
