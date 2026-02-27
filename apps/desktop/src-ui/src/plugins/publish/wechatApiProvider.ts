import type { PluginHostAPI } from '../_framework/PluginHostAPI';

// ── API 调用模式 ──

export type WechatApiMode = 'direct' | 'cloudrun' | 'proxy' | 'thirdparty';

// ── 模式配置 ──

export interface DirectConfig {
  appid: string;
  secret: string;
}

export interface CloudRunConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ProxyConfig {
  baseUrl: string;
  apiKey?: string;
  appid?: string;
  secret?: string;
}

export interface ThirdPartyConfig {
  providerUrl: string;
  authToken: string;
  providerName?: string;
}

export interface WechatApiConfig {
  mode: WechatApiMode;
  direct?: DirectConfig;
  cloudrun?: CloudRunConfig;
  proxy?: ProxyConfig;
  thirdparty?: ThirdPartyConfig;
}

// ── 草稿参数 ──

export interface DraftParams {
  title: string;
  content: string;
  thumbMediaId: string;
  author?: string;
  digest?: string;
  contentSourceUrl?: string;
  needOpenComment?: number;
  onlyFansCanComment?: number;
  picCrop235_1?: string;
  picCrop1_1?: string;
}

// ── Provider 接口 ──

export interface WechatApiProvider {
  readonly mode: WechatApiMode;
  readonly label: string;
  getAccessToken(): Promise<{ accessToken: string; expiresIn: number }>;
  uploadThumb(accessToken: string, imagePath: string): Promise<{ mediaId: string }>;
  uploadContentImage(accessToken: string, imagePath: string): Promise<{ url: string }>;
  addDraft(accessToken: string, params: DraftParams): Promise<{ mediaId: string }>;
  testConnection(): Promise<{ ok: boolean; msg: string }>;
}

// ── 通用 HTTP 调用封装 ──

export async function wechatHttpRequest(
  host: PluginHostAPI,
  opts: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    jsonBody?: unknown;
    fileField?: string;
    filePath?: string;
    fileName?: string;
    extraForm?: Record<string, string>;
  },
): Promise<unknown> {
  return host.platform.invoke('wechat_http_request', {
    url: opts.url,
    method: opts.method || 'POST',
    headers: opts.headers || null,
    jsonBody: opts.jsonBody || null,
    fileField: opts.fileField || null,
    filePath: opts.filePath || null,
    fileName: opts.fileName || null,
    extraForm: opts.extraForm || null,
  });
}

// ── 微信 API 错误检查 ──

export function checkWxError(body: unknown): void {
  const obj = body as Record<string, unknown>;
  const errcode = obj?.errcode;
  if (typeof errcode === 'number' && errcode !== 0) {
    const errmsg = (obj?.errmsg as string) || '未知错误';
    throw new Error(`微信API错误 ${errcode}: ${errmsg}`);
  }
}

// ── 工厂函数 ──

export function createProvider(host: PluginHostAPI, config: WechatApiConfig): WechatApiProvider {
  switch (config.mode) {
    case 'direct': {
      const { createDirectProvider } = require('./providers/directProvider');
      return createDirectProvider(host, config.direct!);
    }
    case 'cloudrun': {
      const { createCloudRunProvider } = require('./providers/cloudrunProvider');
      return createCloudRunProvider(host, config.cloudrun!);
    }
    case 'proxy': {
      const { createProxyProvider } = require('./providers/proxyProvider');
      return createProxyProvider(host, config.proxy!);
    }
    case 'thirdparty': {
      const { createThirdPartyProvider } = require('./providers/thirdpartyProvider');
      return createThirdPartyProvider(host, config.thirdparty!);
    }
    default:
      throw new Error(`未知的 API 模式: ${config.mode}`);
  }
}
