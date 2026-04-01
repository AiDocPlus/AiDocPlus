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
import { invoke } from '@tauri-apps/api/core';

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
  await listen<ApiServerInfo>('api-server:ready', async (event) => {
    apiServerPort = event.payload.port;
    console.info(`[ApiBridge] API Server ready, port: ${apiServerPort}`);

    // IM Bot 自动启动：延迟导入 settings store 避免循环依赖
    try {
      const { useSettingsStore } = await import('../stores/useSettingsStore');
      const { autoStart } = useSettingsStore.getState().imBot;
      if (autoStart) {
        console.info('[ApiBridge] IM Bot auto-starting...');
        await invoke('start_imbot');
        console.info('[ApiBridge] IM Bot started');
      }
    } catch (e) {
      console.error('[ApiBridge] IM Bot 自动启动失败:', e);
    }
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

  // 监听外部（API/IM Bot）创建或保存文档后的通知，自动刷新前端文档列表
  await listen<{ action: string; projectId: string; documentId: string }>('document:external-change', async (event) => {
    const { action, projectId } = event.payload;
    console.info(`[ApiBridge] External document change: ${action}, projectId=${projectId}`);
    try {
      const { useAppStore } = await import('../stores/useAppStore');
      const state = useAppStore.getState();
      // 如果变更的项目是当前打开的项目，刷新文档列表
      const currentProjectId = state.currentProject?.id;
      if (currentProjectId && currentProjectId === projectId) {
        await state.loadDocuments(projectId);
        console.info(`[ApiBridge] Refreshed documents for project ${projectId}`);
      }
    } catch (e) {
      console.error('[ApiBridge] 刷新文档列表失败:', e);
    }
  });

  console.info('[ApiBridge] Initialized');
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
