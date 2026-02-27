#!/usr/bin/env node
/**
 * 从 shared-types/src/index.ts 中提取 BUILT_IN_PPT_THEMES
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

function extractArray(content, marker) {
  const idx = content.indexOf(marker);
  if (idx === -1) return null;
  const start = idx + marker.length;
  let bracketCount = 1;
  let i = start;
  let inString = false, stringChar = '', inTemplate = false;
  while (i < content.length && bracketCount > 0) {
    const ch = content[i];
    if (inTemplate) { if (ch === '\\' && i+1<content.length) { i+=2; continue; } if (ch==='`') inTemplate=false; i++; continue; }
    if (inString) { if (ch === '\\' && i+1<content.length) { i+=2; continue; } if (ch===stringChar) inString=false; i++; continue; }
    if (ch==='`') { inTemplate=true; i++; continue; }
    if (ch==="'" || ch==='"') { inString=true; stringChar=ch; i++; continue; }
    if (ch==='[') bracketCount++;
    if (ch===']') bracketCount--;
    i++;
  }
  try { return eval(content.substring(idx + marker.length - 1, i)); } catch(e) { return null; }
}

function main() {
  if (!fs.existsSync(SOURCE_FILE)) { console.error(`❌ 源文件不存在`); process.exit(1); }
  console.log(`📖 读取源文件: ${SOURCE_FILE}`);
  const content = fs.readFileSync(SOURCE_FILE, 'utf-8');

  // 提取 PPT 主题
  const pptThemes = extractArray(content, 'export const BUILT_IN_PPT_THEMES: PptTheme[] = [');
  if (!pptThemes) { console.error('❌ 未找到 BUILT_IN_PPT_THEMES'); process.exit(1); }
  console.log(`   找到 ${pptThemes.length} 个 PPT 主题`);

  // 清理旧数据
  if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // 写入 _meta.json
  const meta = {
    schemaVersion: '1.0',
    resourceType: 'document-template',
    defaultLocale: 'zh',
    categories: [
      { key: 'report', name: '报告', icon: '📊', order: 0 },
      { key: 'article', name: '文章', icon: '📰', order: 1 },
      { key: 'email-draft', name: '邮件草稿', icon: '✉️', order: 2 },
      { key: 'meeting', name: '会议纪要', icon: '📋', order: 3 },
      { key: 'creative', name: '创意写作', icon: '✨', order: 4 },
      { key: 'technical', name: '技术文档', icon: '💻', order: 5 },
      { key: 'general', name: '通用', icon: '📄', order: 6 },
      { key: 'ppt-theme', name: 'PPT 主题', icon: '🎨', order: 7 },
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

  // 写入 PPT 主题
  let written = 0;
  for (const theme of pptThemes) {
    const id = theme.id;
    const themeDir = path.join(DATA_DIR, 'ppt-theme', id);
    fs.mkdirSync(themeDir, { recursive: true });

    const manifest = {
      id,
      name: theme.name,
      description: `PPT 主题: ${theme.name}`,
      icon: '🎨',
      version: '1.0.0',
      author: 'AiDocPlus',
      resourceType: 'document-template',
      subType: 'ppt-theme',
      majorCategory: 'ppt-theme',
      subCategory: 'general',
      tags: ['ppt', theme.name],
      order: written,
      enabled: true,
      source: 'builtin',
      createdAt: '2026-02-18T00:00:00Z',
      updatedAt: '2026-02-18T00:00:00Z',
      // PPT 主题特有字段
      colors: theme.colors,
      fonts: theme.fonts,
    };

    fs.writeFileSync(path.join(themeDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    written++;
  }

  console.log(`✅ 完成！共写入 ${written} 个 PPT 主题 + 分类定义`);
}

main();
