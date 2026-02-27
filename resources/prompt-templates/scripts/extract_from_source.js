#!/usr/bin/env node
/**
 * 从 shared-types/src/index.ts 中提取 BUILT_IN_TEMPLATES 和 TEMPLATE_CATEGORIES
 * 拆分为独立的 manifest.json + content.md 文件
 * 
 * 策略：直接 eval TypeScript 中的数组字面量（纯数据，无依赖）
 */
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const REPO_DIR = path.dirname(SCRIPT_DIR);
const DATA_DIR = path.join(REPO_DIR, 'data');
const SOURCE_FILE = path.join(
  path.dirname(REPO_DIR), 'AiDocPlus-Main',
  'packages', 'shared-types', 'src', 'index.ts'
);

function main() {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`❌ 源文件不存在: ${SOURCE_FILE}`);
    process.exit(1);
  }

  console.log(`📖 读取源文件: ${SOURCE_FILE}`);
  const content = fs.readFileSync(SOURCE_FILE, 'utf-8');

  // ── 提取 TEMPLATE_CATEGORIES ──
  const catMatch = content.match(
    /export const TEMPLATE_CATEGORIES:\s*Record<string,\s*TemplateCategoryInfo>\s*=\s*(\{[\s\S]*?\n\});/
  );
  let categories = {};
  if (catMatch) {
    try {
      // 去掉 TypeScript 类型注解，eval 为 JS 对象
      categories = eval('(' + catMatch[1] + ')');
      console.log(`   找到 ${Object.keys(categories).length} 个分类`);
    } catch (e) {
      console.error(`⚠️  分类解析失败: ${e.message}`);
    }
  }

  // ── 提取 BUILT_IN_TEMPLATES ──
  // 找到数组开始和结束位置
  const arrStartMarker = 'export const BUILT_IN_TEMPLATES: PromptTemplate[] = [';
  const arrStartIdx = content.indexOf(arrStartMarker);
  if (arrStartIdx === -1) {
    console.error('❌ 未找到 BUILT_IN_TEMPLATES');
    process.exit(1);
  }

  // 从数组开始位置找到匹配的 ];
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
      if (ch === '`') { inTemplate = false; }
      i++; continue;
    }

    if (inString) {
      if (ch === '\\' && i + 1 < content.length) { i += 2; continue; }
      if (ch === stringChar) { inString = false; }
      i++; continue;
    }

    if (ch === '`') { inTemplate = true; i++; continue; }
    if (ch === "'" || ch === '"') { inString = true; stringChar = ch; i++; continue; }

    if (ch === '[') bracketCount++;
    if (ch === ']') bracketCount--;

    i++;
  }

  const arrText = content.substring(arrStartIdx + arrStartMarker.length - 1, i);

  let templates = [];
  try {
    templates = eval(arrText);
    console.log(`   找到 ${templates.length} 个模板`);
  } catch (e) {
    console.error(`❌ 模板数组解析失败: ${e.message}`);
    // 尝试输出错误位置附近的内容
    console.error(`   数组长度: ${arrText.length} 字符`);
    process.exit(1);
  }

  if (templates.length === 0) {
    console.error('❌ 未提取到任何模板');
    process.exit(1);
  }

  // ── 统计 ──
  const catCounts = {};
  for (const t of templates) {
    const cat = t.category || 'unknown';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  }

  console.log('\n📊 分类统计:');
  for (const [cat, count] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
    const name = categories[cat]?.name || cat;
    console.log(`   ${name} (${cat}): ${count} 个`);
  }

  // ── 写入文件 ──
  console.log(`\n📝 写入模板文件到 ${DATA_DIR}...`);

  // 清理旧数据
  if (fs.existsSync(DATA_DIR)) {
    fs.rmSync(DATA_DIR, { recursive: true });
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // 写入 _meta.json
  const catList = Object.entries(categories).map(([key, info], idx) => ({
    key,
    name: info.name,
    icon: info.icon,
    order: idx,
    subCategories: [{ key: 'general', name: '综合', order: 0 }]
  }));

  const meta = {
    schemaVersion: '1.0',
    resourceType: 'prompt-template',
    defaultLocale: 'zh',
    categories: catList
  };

  fs.writeFileSync(
    path.join(DATA_DIR, '_meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8'
  );

  // 写入每个模板
  let written = 0;
  for (const tmpl of templates) {
    const category = tmpl.category || 'general';
    const id = tmpl.id;
    if (!id) continue;

    const tmplDir = path.join(DATA_DIR, category, id);
    fs.mkdirSync(tmplDir, { recursive: true });

    // content.md
    fs.writeFileSync(
      path.join(tmplDir, 'content.md'),
      tmpl.content || '',
      'utf-8'
    );

    // manifest.json
    const manifest = {
      id,
      name: tmpl.name || '',
      description: tmpl.description || '',
      icon: categories[category]?.icon || '📋',
      version: '1.0.0',
      author: 'AiDocPlus',
      resourceType: 'prompt-template',
      majorCategory: category,
      subCategory: 'general',
      tags: [tmpl.name || ''],
      order: written,
      enabled: true,
      source: 'builtin',
      createdAt: '2026-02-18T00:00:00Z',
      updatedAt: '2026-02-18T00:00:00Z',
    };

    if (tmpl.variables && tmpl.variables.length > 0) {
      manifest.variables = tmpl.variables.map(v => ({
        name: v, label: v, type: 'text', required: false
      }));
    }

    fs.writeFileSync(
      path.join(tmplDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    written++;
  }

  console.log(`✅ 完成！共写入 ${written} 个模板到 ${Object.keys(catCounts).length} 个分类`);
}

main();
