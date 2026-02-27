#!/usr/bin/env node
/**
 * 从 shared-types/src/index.ts 中提取 AI_PROVIDERS 数据
 * 拆分为独立的 manifest.json 文件
 */
const fs = require('fs');
const path = require('path');

const REPO_DIR = path.dirname(__dirname);
const DATA_DIR = path.join(REPO_DIR, 'data');
const SOURCE_FILE = path.join(
  path.dirname(REPO_DIR), 'AiDocPlus',
  'packages', 'shared-types', 'src', 'index.ts'
);

function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ 源文件不存在: ${SOURCE_FILE}`);
    process.exit(1);
  }

  console.log(`📖 读取源文件: ${SOURCE_FILE}`);
  const content = fs.readFileSync(SOURCE_FILE, 'utf-8');

  // 提取 AI_PROVIDERS 数组
  const arrStartMarker = 'export const AI_PROVIDERS: AIProviderConfig[] = [';
  const arrStartIdx = content.indexOf(arrStartMarker);
  if (arrStartIdx === -1) {
    console.error('❌ 未找到 AI_PROVIDERS');
    process.exit(1);
  }

  const arrContentStart = arrStartIdx + arrStartMarker.length;
  let bracketCount = 1;
  let i = arrContentStart;
  let inString = false;
  let stringChar = '';
  let inTemplate = false;

  while (i < content.length && bracketCount > 0) {
    const ch = content[i];
    if (inTemplate) {
      if (ch === '\\' && i + 1 < content.length) { i += 2; continue; }
      if (ch === '`') inTemplate = false;
      i++; continue;
    }
    if (inString) {
      if (ch === '\\' && i + 1 < content.length) { i += 2; continue; }
      if (ch === stringChar) inString = false;
      i++; continue;
    }
    if (ch === '`') { inTemplate = true; i++; continue; }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; i++; continue; }
    if (ch === '[') bracketCount++;
    if (ch === ']') bracketCount--;
    i++;
  }

  const arrText = content.substring(arrStartIdx + arrStartMarker.length - 1, i);

  let providers = [];
  try {
    providers = eval(arrText);
    console.log(`   找到 ${providers.length} 个 AI 提供商`);
  } catch (e) {
    console.error(`❌ 解析失败: ${e.message}`);
    process.exit(1);
  }

  // 清理旧数据
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // 写入 _meta.json
  const meta = {
    schemaVersion: '1.0',
    resourceType: 'ai-provider',
    defaultLocale: 'zh',
    categories: [
      { key: 'international', name: '国际服务', icon: '🌍', order: 0 },
      { key: 'china', name: '国内服务', icon: '🇨🇳', order: 1 },
      { key: 'custom', name: '自定义', icon: '⚙️', order: 2 },
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  // 分类映射
  const categoryMap = {
    openai: 'international',
    anthropic: 'international',
    gemini: 'international',
    xai: 'international',
    deepseek: 'china',
    qwen: 'china',
    glm: 'china',
    'glm-code': 'china',
    minimax: 'china',
    'minimax-code': 'china',
    kimi: 'china',
    'kimi-code': 'china',
    custom: 'custom',
  };

  // 写入每个提供商
  let written = 0;
  for (const provider of providers) {
    const id = provider.id;
    const category = categoryMap[id] || 'custom';
    const providerDir = path.join(DATA_DIR, category, id);
    fs.mkdirSync(providerDir, { recursive: true });

    const manifest = {
      id,
      name: provider.name,
      description: `${provider.name} AI 服务`,
      icon: getProviderIcon(id),
      version: '1.0.0',
      author: 'AiDocPlus',
      resourceType: 'ai-provider',
      majorCategory: category,
      subCategory: 'general',
      tags: [provider.name],
      order: written,
      enabled: true,
      source: 'builtin',
      createdAt: '2026-02-18T00:00:00Z',
      updatedAt: '2026-02-18T00:00:00Z',
      // AI 提供商特有字段
      baseUrl: provider.baseUrl,
      defaultModel: provider.defaultModel,
      models: provider.models,
      authHeader: provider.authHeader || 'bearer',
      capabilities: provider.capabilities,
    };

    fs.writeFileSync(
      path.join(providerDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );
    written++;
  }

  console.log(`✅ 完成！共写入 ${written} 个 AI 提供商`);
}

function getProviderIcon(id) {
  const icons = {
    openai: '🤖',
    anthropic: '🧠',
    gemini: '💎',
    xai: '⚡',
    deepseek: '🔍',
    qwen: '☁️',
    glm: '🔮',
    'glm-code': '💻',
    minimax: '🎯',
    'minimax-code': '💻',
    kimi: '🌙',
    'kimi-code': '💻',
    custom: '⚙️',
  };
  return icons[id] || '🤖';
}

main();
