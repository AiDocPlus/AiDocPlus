/**
 * 插件沙箱模块（Phase 4.20 PoC）
 *
 * 为非 builtin 插件提供安全包装：
 * - API 调用审计日志
 * - 权限检查（基于 manifest.sandboxPermissions）
 * - invoke 命令二次过滤（manifest 声明的子集）
 * - 网络/剪贴板/AI/存储等能力按权限开关
 *
 * builtin 插件不受影响，直接使用原始 PluginHostAPI。
 */

import type {
  PluginHostAPI,
  AIAPI,
  StorageAPI,
  UIAPI,
  PlatformAPI,
} from './PluginHostAPI';
import type { PluginTrustLevel, PluginSandboxPermissions } from '@aidocplus/shared-types';

// ============================================================
// 审计日志
// ============================================================

/** 单条审计记录 */
export interface AuditEntry {
  timestamp: number;
  pluginId: string;
  api: string;
  args?: string;
  allowed: boolean;
  reason?: string;
}

const AUDIT_LOG: AuditEntry[] = [];
const MAX_AUDIT_SIZE = 500;

function pushAudit(entry: AuditEntry) {
  AUDIT_LOG.push(entry);
  if (AUDIT_LOG.length > MAX_AUDIT_SIZE) {
    AUDIT_LOG.splice(0, AUDIT_LOG.length - MAX_AUDIT_SIZE);
  }
}

/** 获取全部审计日志 */
export function getAuditLog(): readonly AuditEntry[] {
  return AUDIT_LOG;
}

/** 获取指定插件的审计日志 */
export function getPluginAuditLog(pluginId: string): AuditEntry[] {
  return AUDIT_LOG.filter(e => e.pluginId === pluginId);
}

/** 清空审计日志 */
export function clearAuditLog() {
  AUDIT_LOG.length = 0;
}

// ============================================================
// 辅助
// ============================================================

function summarizeArgs(args: unknown): string {
  try {
    const s = JSON.stringify(args);
    return s.length > 200 ? s.slice(0, 200) + '...' : s;
  } catch {
    return '[不可序列化]';
  }
}

function denied(pluginId: string, api: string, reason: string, args?: unknown): never {
  pushAudit({
    timestamp: Date.now(),
    pluginId,
    api,
    args: args !== undefined ? summarizeArgs(args) : undefined,
    allowed: false,
    reason,
  });
  throw new Error(`[PluginSandbox] 插件 "${pluginId}" 无权调用 ${api}：${reason}`);
}

function audit(pluginId: string, api: string, args?: unknown) {
  pushAudit({
    timestamp: Date.now(),
    pluginId,
    api,
    args: args !== undefined ? summarizeArgs(args) : undefined,
    allowed: true,
  });
}

// ============================================================
// 权限解析
// ============================================================

const DEFAULT_SANDBOXED: Required<PluginSandboxPermissions> = {
  invoke: [],
  network: false,
  storage: true,
  ai: false,
  clipboard: false,
  fileDialog: false,
};

const ALL_GRANTED: Required<PluginSandboxPermissions> = {
  invoke: ['*'],
  network: true,
  storage: true,
  ai: true,
  clipboard: true,
  fileDialog: true,
};

function resolvePermissions(
  trustLevel: PluginTrustLevel,
  declared?: PluginSandboxPermissions,
): Required<PluginSandboxPermissions> {
  if (trustLevel === 'builtin' || trustLevel === 'trusted') {
    return ALL_GRANTED;
  }
  // sandboxed: 以默认最小权限为基础，合并 manifest 声明
  return {
    invoke: declared?.invoke ?? DEFAULT_SANDBOXED.invoke,
    network: declared?.network ?? DEFAULT_SANDBOXED.network,
    storage: declared?.storage ?? DEFAULT_SANDBOXED.storage,
    ai: declared?.ai ?? DEFAULT_SANDBOXED.ai,
    clipboard: declared?.clipboard ?? DEFAULT_SANDBOXED.clipboard,
    fileDialog: declared?.fileDialog ?? DEFAULT_SANDBOXED.fileDialog,
  };
}

// ============================================================
// 沙箱包装工厂
// ============================================================

export interface SandboxOptions {
  pluginId: string;
  trustLevel: PluginTrustLevel;
  declaredPermissions?: PluginSandboxPermissions;
}

/**
 * 根据信任等级包装 PluginHostAPI。
 *
 * - builtin：直接返回原始 API（零开销）
 * - trusted：添加审计日志，不做权限拦截
 * - sandboxed：审计日志 + 权限拦截
 */
export function wrapWithSandbox(
  api: PluginHostAPI,
  opts: SandboxOptions,
): PluginHostAPI {
  const { pluginId, trustLevel } = opts;

  // builtin 插件不做任何包装
  if (trustLevel === 'builtin') {
    return api;
  }

  const perms = resolvePermissions(trustLevel, opts.declaredPermissions);
  const isSandboxed = trustLevel === 'sandboxed';

  // ── Platform API 包装 ──
  const wrappedPlatform: PlatformAPI = {
    invoke: async <T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> => {
      // sandboxed: 检查 manifest 声明的 invoke 子集
      if (isSandboxed && !perms.invoke.includes('*') && !perms.invoke.includes(command)) {
        denied(pluginId, 'platform.invoke', `命令 "${command}" 不在权限声明中`, command);
      }
      audit(pluginId, 'platform.invoke', command);
      return api.platform.invoke<T>(command, args);
    },
    getConfig: <T = unknown>(section: string): T | null => {
      audit(pluginId, 'platform.getConfig', section);
      return api.platform.getConfig<T>(section);
    },
    t: (key: string, params?: Record<string, string | number>): string => {
      // i18n 不做限制，只审计
      return api.platform.t(key, params);
    },
    getApiServerInfo: () => {
      audit(pluginId, 'platform.getApiServerInfo');
      return api.platform.getApiServerInfo();
    },
  };

  // ── AI API 包装 ──
  const wrappedAI: AIAPI = isSandboxed && !perms.ai
    ? {
        chat: async () => denied(pluginId, 'ai.chat', '无 AI 权限'),
        chatStream: async () => denied(pluginId, 'ai.chatStream', '无 AI 权限'),
        isAvailable: () => false,
        truncateContent: (t: string) => t,
        getLastThinking: () => '',
        listServices: () => [],
        getServiceParams: () => null,
      }
    : {
        chat: async (messages, options) => {
          audit(pluginId, 'ai.chat', { msgCount: messages.length });
          return api.ai.chat(messages, options);
        },
        chatStream: async (messages, onChunk, options) => {
          audit(pluginId, 'ai.chatStream', { msgCount: messages.length });
          return api.ai.chatStream(messages, onChunk, options);
        },
        isAvailable: () => api.ai.isAvailable(),
        truncateContent: (t: string) => api.ai.truncateContent(t),
        getLastThinking: () => api.ai.getLastThinking(),
        listServices: () => api.ai.listServices(),
        getServiceParams: (id: string) => api.ai.getServiceParams(id),
      };

  // ── Storage API 包装 ──
  const wrappedStorage: StorageAPI = isSandboxed && !perms.storage
    ? {
        get: () => { denied(pluginId, 'storage.get', '无存储权限'); },
        set: () => { denied(pluginId, 'storage.set', '无存储权限'); },
        remove: () => { denied(pluginId, 'storage.remove', '无存储权限'); },
        clear: () => { denied(pluginId, 'storage.clear', '无存储权限'); },
      }
    : {
        get: <T = unknown>(key: string): T | null => {
          audit(pluginId, 'storage.get', key);
          return api.storage.get<T>(key);
        },
        set: (key: string, value: unknown) => {
          audit(pluginId, 'storage.set', key);
          api.storage.set(key, value);
        },
        remove: (key: string) => {
          audit(pluginId, 'storage.remove', key);
          api.storage.remove(key);
        },
        clear: () => {
          audit(pluginId, 'storage.clear');
          api.storage.clear();
        },
      };

  // ── UI API 包装 ──
  const wrappedUI: UIAPI = {
    showStatus: api.ui.showStatus,
    copyToClipboard: async (text: string) => {
      if (isSandboxed && !perms.clipboard) {
        denied(pluginId, 'ui.copyToClipboard', '无剪贴板权限');
      }
      audit(pluginId, 'ui.copyToClipboard');
      return api.ui.copyToClipboard(text);
    },
    showSaveDialog: async (opts) => {
      if (isSandboxed && !perms.fileDialog) {
        denied(pluginId, 'ui.showSaveDialog', '无文件对话框权限');
      }
      audit(pluginId, 'ui.showSaveDialog', opts);
      return api.ui.showSaveDialog(opts);
    },
    showOpenDialog: async (opts) => {
      if (isSandboxed && !perms.fileDialog) {
        denied(pluginId, 'ui.showOpenDialog', '无文件对话框权限');
      }
      audit(pluginId, 'ui.showOpenDialog');
      return api.ui.showOpenDialog(opts);
    },
    showOpenDialogMultiple: async (opts) => {
      if (isSandboxed && !perms.fileDialog) {
        denied(pluginId, 'ui.showOpenDialogMultiple', '无文件对话框权限');
      }
      audit(pluginId, 'ui.showOpenDialogMultiple');
      return api.ui.showOpenDialogMultiple(opts);
    },
    getLocale: () => api.ui.getLocale(),
    getTheme: () => api.ui.getTheme(),
  };

  return {
    apiVersion: api.apiVersion,
    pluginId: api.pluginId,
    content: api.content,       // 内容访问：只读，不做限制
    ai: wrappedAI,
    storage: wrappedStorage,
    docData: api.docData,       // docData：按现有机制由宿主控制
    ui: wrappedUI,
    platform: wrappedPlatform,
    events: api.events,         // 事件：只读订阅，不做限制
  };
}

// ============================================================
// 开发者工具：暴露到 window 供调试
// ============================================================

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__pluginAudit = {
    getLog: getAuditLog,
    getPluginLog: getPluginAuditLog,
    clear: clearAuditLog,
  };
}
