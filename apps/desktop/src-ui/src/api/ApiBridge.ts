/**
 * API Bridge — 前端状态同步桥
 *
 * 监听后端 API Server 就绪事件，并处理需要前端参与的 API 请求
 * （例如获取当前打开的文档、编辑器选中文本等 UI 状态）。
 *
 * 架构关系：
 * - 插件 → PluginHostAPI → Tauri invoke（进程内，白名单控制）
 * - 脚本/外部 → HTTP API → API Gateway → 业务逻辑（进程间，Token 认证）
 * - ApiBridge 负责桥接"只有前端才有"的状态（当前文档、选中文本等）给 API Gateway
 */

import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';

/** API Server 就绪信息 */
interface ApiServerInfo {
  port: number;
}

/** 前端状态提供者回调 */
interface FrontendStateProvider {
  /** 获取当前活跃文档 */
  getActiveDocument?: () => { id: string; title: string; projectId: string; content: string } | null;
  /** 获取编辑器选中文本 */
  getSelectedText?: () => string;
  /** 获取当前项目 ID */
  getActiveProjectId?: () => string | null;
  /** 获取 AI 配置 */
  getAiConfig?: () => { provider?: string; apiKey?: string; model?: string; baseUrl?: string } | null;
}

/** API Bridge 状态 */
let apiServerPort: number | null = null;
let initialized = false;
let stateProvider: FrontendStateProvider = {};

/**
 * 注册前端状态提供者
 * 由 App 组件在挂载后调用，将 store 中的状态访问函数注册进来
 */
export function registerFrontendStateProvider(provider: FrontendStateProvider): void {
  stateProvider = { ...stateProvider, ...provider };
}

/**
 * 初始化 API Bridge
 * 应在 App 启动时调用一次
 */
export async function initApiBridge(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // 监听 API Server 就绪事件
  await listen<ApiServerInfo>('api-server:ready', (event) => {
    apiServerPort = event.payload.port;
    console.log(`[ApiBridge] API Server 就绪，端口: ${apiServerPort}`);
  });

  // 监听后端查询前端状态的请求
  await listen<{ queryType: string; queryId: string }>('api-bridge:query', async (event) => {
    const { queryType, queryId } = event.payload;
    let result: unknown = null;

    switch (queryType) {
      case 'getActiveDocument':
        result = stateProvider.getActiveDocument?.() ?? null;
        break;
      case 'getSelectedText':
        result = stateProvider.getSelectedText?.() ?? '';
        break;
      case 'getActiveProjectId':
        result = stateProvider.getActiveProjectId?.() ?? null;
        break;
      case 'getAiConfig':
        result = stateProvider.getAiConfig?.() ?? null;
        break;
      default:
        result = { error: `未知查询类型: ${queryType}` };
    }

    // 回复后端
    await emit('api-bridge:response', { queryId, result });
  });

  console.log('[ApiBridge] 已初始化');
}

/**
 * 获取 API Server 端口号
 */
export function getApiServerPort(): number | null {
  return apiServerPort;
}

/**
 * 检查 API Server 是否就绪
 */
export function isApiServerReady(): boolean {
  return apiServerPort !== null;
}
