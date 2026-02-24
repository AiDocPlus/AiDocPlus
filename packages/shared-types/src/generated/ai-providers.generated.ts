/**
 * 自动生成文件 — 请勿手动编辑
 * 由 AiDocPlus-AIProviders/scripts/build.py 生成
 */
import type { AIProviderConfig } from '../index';
import type { AIProvider } from '../index';

export const AI_PROVIDERS: AIProviderConfig[] = [
  {
    id: "openai" as AIProvider,
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: true },
    models: [
      { id: "gpt-4o", name: "GPT-4o" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini" },
      { id: "gpt-4.1", name: "GPT-4.1（代码优化）" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
      { id: "o3", name: "o3（深度推理）" },
      { id: "o4-mini", name: "o4-mini（快速推理）" },
      { id: "gpt-5", name: "GPT-5" },
      { id: "gpt-5-mini", name: "GPT-5 Mini" },
    ],
  },
  {
    id: "anthropic" as AIProvider,
    name: "Anthropic (Claude)",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-opus-4-6",
    authHeader: "x-api-key",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: true },
    models: [
      { id: "claude-opus-4-6", name: "Claude Opus 4.6（最强旗舰，1M context）" },
      { id: "claude-opus-4-5", name: "Claude Opus 4.5" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5（推荐）" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5（快速低价）" },
      { id: "claude-opus-4-1-20250805", name: "Claude Opus 4.1" },
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
      { id: "claude-3-7-sonnet-20250219", name: "Claude Sonnet 3.7" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude Sonnet 3.5 v2" },
    ],
  },
  {
    id: "gemini" as AIProvider,
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-3-flash-preview",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: true },
    models: [
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro（预览）" },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash（预览）" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash（稳定推荐）" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
    ],
  },
  {
    id: "xai" as AIProvider,
    name: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4-0709",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: false },
    models: [
      { id: "grok-4-0709", name: "Grok 4" },
      { id: "grok-3", name: "Grok 3" },
      { id: "grok-3-mini", name: "Grok 3 Mini" },
    ],
  },
  {
    id: "deepseek" as AIProvider,
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    capabilities: { webSearch: false, thinking: true, functionCalling: true, vision: false },
    models: [
      { id: "deepseek-chat", name: "DeepSeek-V3.2" },
      { id: "deepseek-reasoner", name: "DeepSeek-R1（推理）" },
    ],
  },
  {
    id: "qwen" as AIProvider,
    name: "通义千问 (Qwen)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen3-max",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: true },
    models: [
      { id: "qwen3-max", name: "Qwen3 Max" },
      { id: "qwen-max", name: "Qwen Max" },
      { id: "qwen-plus", name: "Qwen Plus（推荐）" },
      { id: "qwen-turbo", name: "Qwen Turbo" },
      { id: "qwen-long", name: "Qwen Long" },
      { id: "qwen3-coder-plus", name: "Qwen3 Coder Plus" },
      { id: "qwen-coder-plus", name: "Qwen Coder Plus" },
      { id: "qwq-plus", name: "QwQ Plus（推理）" },
      { id: "qwen-flash", name: "Qwen Flash" },
    ],
  },
  {
    id: "glm" as AIProvider,
    name: "智谱 AI (通用)",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    defaultModel: "glm-5",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: true },
    models: [
      { id: "glm-5", name: "GLM-5（旗舰）" },
      { id: "glm-4.7", name: "GLM-4.7" },
      { id: "glm-4.7-flash", name: "GLM-4.7 Flash（免费）" },
      { id: "glm-4.6", name: "GLM-4.6" },
      { id: "glm-4.5-air", name: "GLM-4.5 Air" },
      { id: "glm-4.5-airx", name: "GLM-4.5 AirX" },
      { id: "glm-4.5-flash", name: "GLM-4.5 Flash（免费）" },
      { id: "glm-4-flash", name: "GLM-4 Flash（免费）" },
      { id: "glm-4-long", name: "GLM-4 Long" },
    ],
  },
  {
    id: "glm-code" as AIProvider,
    name: "智谱 AI (Coding Plan)",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    defaultModel: "GLM-5",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: false },
    models: [
      { id: "GLM-5", name: "GLM-5（旗舰）" },
      { id: "GLM-4.7", name: "GLM-4.7" },
      { id: "GLM-4.6", name: "GLM-4.6" },
      { id: "GLM-4.5-air", name: "GLM-4.5 Air" },
    ],
  },
  {
    id: "minimax" as AIProvider,
    name: "MiniMax (通用)",
    baseUrl: "https://api.minimaxi.com/v1",
    defaultModel: "MiniMax-M2.5",
    capabilities: { webSearch: false, thinking: true, functionCalling: true, vision: false },
    models: [
      { id: "MiniMax-M2.5", name: "MiniMax M2.5" },
      { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 高速版" },
      { id: "MiniMax-M2.1", name: "MiniMax M2.1" },
      { id: "MiniMax-M2.1-highspeed", name: "MiniMax M2.1 高速版" },
    ],
  },
  {
    id: "minimax-code" as AIProvider,
    name: "MiniMax (Coding Plan)",
    baseUrl: "https://api.minimaxi.com/v1",
    defaultModel: "MiniMax-M2.5",
    capabilities: { webSearch: false, thinking: true, functionCalling: true, vision: false },
    models: [
      { id: "MiniMax-M2.5", name: "MiniMax M2.5" },
      { id: "MiniMax-M2.5-highspeed", name: "MiniMax M2.5 高速版" },
    ],
  },
  {
    id: "kimi" as AIProvider,
    name: "Kimi / Moonshot 开放平台",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.5",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: true },
    models: [
      { id: "kimi-k2.5", name: "Kimi K2.5（旗舰多模态）" },
      { id: "kimi-k2", name: "Kimi K2" },
      { id: "kimi-latest", name: "Kimi Latest" },
      { id: "moonshot-v1-auto", name: "Moonshot v1 Auto" },
      { id: "moonshot-v1-128k", name: "Moonshot v1 128K" },
    ],
  },
  {
    id: "kimi-code" as AIProvider,
    name: "Kimi Code（会员编程）",
    baseUrl: "https://api.kimi.com/coding/v1",
    defaultModel: "kimi-for-coding",
    capabilities: { webSearch: true, thinking: true, functionCalling: true, vision: false },
    models: [
      { id: "kimi-for-coding", name: "Kimi for Coding（默认）" },
    ],
  },
  {
    id: "custom" as AIProvider,
    name: "自定义 (OpenAI 兼容)",
    baseUrl: "",
    defaultModel: "",
    capabilities: { webSearch: false, thinking: false, functionCalling: false, vision: false },
    models: [],
  },
];

export function getProviderConfig(providerId: AIProvider): AIProviderConfig | undefined {
  return AI_PROVIDERS.find(p => p.id === providerId);
}
