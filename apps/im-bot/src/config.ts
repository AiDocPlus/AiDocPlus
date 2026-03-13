/**
 * 配置管理
 * 从 .env 和 ~/.aidocplus/api.json 读取配置
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { config as dotenvConfig } from 'dotenv';
import logger from './utils/logger.js';

const TAG = 'Config';

// 加载 .env — 优先 ~/.aidocplus/im-bot/.env（生产模式），然后 cwd/.env（开发模式）
const prodEnvPath = join(homedir(), '.aidocplus', 'im-bot', '.env');
if (existsSync(prodEnvPath)) {
  dotenvConfig({ path: prodEnvPath });
} else {
  dotenvConfig();
}

// ============================================================
// 类型定义
// ============================================================

export interface FeishuConfig {
  enabled: boolean;
  appId: string;
  appSecret: string;
}

export interface DingtalkConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export interface WecomConfig {
  enabled: boolean;
  corpId: string;
  secret: string;
  token: string;
  encodingAesKey: string;
  agentId: string;
}

export interface QQConfig {
  enabled: boolean;
  appId: string;
  appSecret: string;
}

export interface AIConfig {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface AiDocPlusConnection {
  port: number;
  token: string;
}

export interface AppConfig {
  feishu: FeishuConfig;
  dingtalk: DingtalkConfig;
  wecom: WecomConfig;
  qq: QQConfig;
  ai: AIConfig;
  allowedUsers: string[];
  logLevel: string;
}

// ============================================================
// 读取 api.json
// ============================================================

export function readApiJson(): AiDocPlusConnection | null {
  const apiJsonPath = join(homedir(), '.aidocplus', 'api.json');
  try {
    if (!existsSync(apiJsonPath)) return null;
    const content = readFileSync(apiJsonPath, 'utf-8');
    const data = JSON.parse(content);
    if (data.port && data.token) {
      return { port: data.port, token: data.token };
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// 加载配置
// ============================================================

function envBool(key: string, fallback = false): boolean {
  const val = process.env[key];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

function envStr(key: string, fallback = ''): string {
  return process.env[key] || fallback;
}

export function loadConfig(): AppConfig {
  const config: AppConfig = {
    feishu: {
      enabled: envBool('FEISHU_ENABLED'),
      appId: envStr('FEISHU_APP_ID'),
      appSecret: envStr('FEISHU_APP_SECRET'),
    },
    dingtalk: {
      enabled: envBool('DINGTALK_ENABLED'),
      clientId: envStr('DINGTALK_CLIENT_ID'),
      clientSecret: envStr('DINGTALK_CLIENT_SECRET'),
    },
    wecom: {
      enabled: envBool('WECOM_ENABLED'),
      corpId: envStr('WECOM_CORP_ID'),
      secret: envStr('WECOM_SECRET'),
      token: envStr('WECOM_TOKEN'),
      encodingAesKey: envStr('WECOM_ENCODING_AES_KEY'),
      agentId: envStr('WECOM_AGENT_ID'),
    },
    qq: {
      enabled: envBool('QQ_ENABLED'),
      appId: envStr('QQ_APP_ID'),
      appSecret: envStr('QQ_APP_SECRET'),
    },
    ai: {
      enabled: envBool('AI_ENABLED'),
      apiKey: envStr('AI_API_KEY'),
      baseUrl: envStr('AI_BASE_URL', 'https://api.openai.com/v1'),
      model: envStr('AI_MODEL', 'gpt-4o-mini'),
    },
    allowedUsers: envStr('ALLOWED_USERS')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    logLevel: envStr('LOG_LEVEL', 'info'),
  };

  // 统计启用的渠道
  const enabledChannels: string[] = [];
  if (config.feishu.enabled) enabledChannels.push('飞书');
  if (config.dingtalk.enabled) enabledChannels.push('钉钉');
  if (config.wecom.enabled) enabledChannels.push('企业微信');
  if (config.qq.enabled) enabledChannels.push('QQ');

  logger.info(TAG, `已加载配置，启用渠道: ${enabledChannels.length > 0 ? enabledChannels.join('、') : '无'}`);
  if (config.ai.enabled) {
    logger.info(TAG, `AI 路由已启用，模型: ${config.ai.model}`);
  }

  return config;
}
