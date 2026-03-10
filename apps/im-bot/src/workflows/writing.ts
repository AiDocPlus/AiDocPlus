/**
 * 模板写作工作流
 * 支持快捷模式（一句话）和交互模式（多轮引导）
 *
 * 快捷模式: /写作 商业计划书 公司名=AiDocPlus 行业=AI办公
 * 交互模式: /写作 → 选模板 → 填变量 → AI生成 → 保存文档
 */

import { requireClient } from '../bridge.js';
import { sessionManager, SessionManager, type SessionData, type TemplateVariable } from '../session.js';
import type { OutgoingMessage } from '../channels/base.js';
import logger from '../utils/logger.js';

const TAG = 'WritingWorkflow';

/** 每页显示模板数量 */
const PAGE_SIZE = 10;

// ============================================================
// 模板类型
// ============================================================

interface TemplateInfo {
  id: string;
  name: string;
  category: string;
  title?: string;
}

interface TemplateContent {
  content?: string;
  prompt?: string;
  variables?: Array<{ name: string; description?: string; default?: string }>;
}

// ============================================================
// 工作流入口
// ============================================================

/**
 * 处理 /写作 指令（入口）
 * @param args 指令参数
 * @param userKey 用户唯一键
 */
export async function handleWriteCommand(args: string, userKey: string): Promise<OutgoingMessage> {
  const trimmed = args.trim();

  // 空参数 → 进入交互模式
  if (!trimmed) {
    return startInteractiveMode(userKey);
  }

  // 检查是否有 key=value 格式的变量 → 快捷模式
  const hasVariables = /\S+=\S+/.test(trimmed);
  if (hasVariables) {
    return handleShortcutMode(trimmed, userKey);
  }

  // 只有模板名/关键词 → 搜索模板后进入交互模式
  return startInteractiveMode(userKey, trimmed);
}

/**
 * 处理会话中的用户输入（由 index.ts 调用）
 */
export async function handleSessionInput(input: string, userKey: string): Promise<OutgoingMessage> {
  const session = sessionManager.get(userKey);
  if (!session) {
    return { text: '⚠️ 会话已过期，请重新发送 /写作 开始。' };
  }

  switch (session.step) {
    case 'select_template':
      return handleSelectTemplate(input, userKey, session);
    case 'fill_variables':
      return handleFillVariables(input, userKey, session);
    case 'review_result':
      return handleReviewResult(input, userKey, session);
    default:
      sessionManager.remove(userKey);
      return { text: '⚠️ 未知的会话状态，已重置。请重新发送 /写作 开始。' };
  }
}

// ============================================================
// 快捷模式
// ============================================================

/**
 * 快捷模式：一句话完成写作
 * 格式: /写作 模板名 变量1=值1 变量2=值2
 */
async function handleShortcutMode(input: string, userKey: string): Promise<OutgoingMessage> {
  // 解析：第一个词是模板名/关键词，后续是变量
  const parts = input.split(/\s+/);
  const variableParts: string[] = [];
  const nameParts: string[] = [];

  for (const p of parts) {
    if (p.includes('=')) {
      variableParts.push(p);
    } else {
      nameParts.push(p);
    }
  }

  const keyword = nameParts.join(' ');
  if (!keyword) {
    return { text: '❓ 请提供模板名称，例如: /写作 商业计划书 公司名=AiDocPlus' };
  }

  // 搜索模板
  const client = requireClient();
  const allTemplates = (await client.templateList()) as TemplateInfo[];
  if (!allTemplates || !Array.isArray(allTemplates) || allTemplates.length === 0) {
    return { text: '📋 暂无模板可用' };
  }

  const matched = fuzzyMatch(allTemplates, keyword);
  if (matched.length === 0) {
    return { text: `🔍 未找到与「${keyword}」相关的模板\n\n💡 发送 /写作 进入交互模式查看所有模板` };
  }

  // 取第一个匹配结果
  const template = matched[0];

  // 获取模板内容
  const templateContent = (await client.templateGetContent({ templateId: template.id })) as TemplateContent;
  const promptTemplate = templateContent?.content || templateContent?.prompt || '';

  // 解析变量
  const userVars = parseVariables(variableParts.join(' '));

  // 替换变量到模板中
  let finalPrompt = promptTemplate;
  if (templateContent?.variables) {
    for (const v of templateContent.variables) {
      const value = userVars[v.name] || v.default || '';
      finalPrompt = finalPrompt.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), value);
      finalPrompt = finalPrompt.replace(new RegExp(`\\$\\{${v.name}\\}`, 'g'), value);
    }
  }
  // 也直接替换用户提供的变量
  for (const [key, value] of Object.entries(userVars)) {
    finalPrompt = finalPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    finalPrompt = finalPrompt.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
  }

  // 如果模板为空，用模板名 + 变量构建 prompt
  if (!finalPrompt.trim()) {
    const varDesc = Object.entries(userVars).map(([k, v]) => `${k}: ${v}`).join('，');
    finalPrompt = `请帮我写一篇「${template.name || keyword}」。${varDesc ? '要求：' + varDesc : ''}`;
  }

  // AI 生成
  const genResult = (await client.aiGenerate({
    prompt: finalPrompt,
    systemPrompt: `你是一个专业写作助手。请根据模板「${template.name || keyword}」的要求，生成高质量的中文内容。输出纯 Markdown 格式。`,
  })) as { content?: string; text?: string };

  const content = genResult?.content || genResult?.text || '';
  if (!content) {
    return { text: '❌ AI 未能生成内容，请稍后重试。' };
  }

  // 创建文档并保存
  const title = `${template.name || keyword}`;
  const activeProjectId = await client.getActiveProjectId();
  const projectId = activeProjectId || 'default';

  const createResult = (await client.documentCreate({
    projectId,
    title,
    content: '',
  })) as { documentId?: string; id?: string };

  const docId = createResult?.documentId || createResult?.id;
  if (docId) {
    await client.documentSave({
      projectId,
      documentId: docId,
      content,
      aiGeneratedContent: content,
    });
  }

  const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
  const lines = [
    `✨ **快捷写作完成**\n`,
    `📋 模板: ${template.name || keyword}`,
    docId ? `📄 文档ID: \`${docId}\`` : '',
    docId ? `📂 项目: ${projectId}` : '',
    `\n---\n`,
    preview,
  ].filter(Boolean);

  return { markdown: lines.join('\n') };
}

// ============================================================
// 交互模式
// ============================================================

/**
 * 进入交互模式（选择模板）
 */
async function startInteractiveMode(userKey: string, keyword?: string): Promise<OutgoingMessage> {
  const client = requireClient();
  const allTemplates = (await client.templateList()) as TemplateInfo[];
  if (!allTemplates || !Array.isArray(allTemplates) || allTemplates.length === 0) {
    return { text: '📋 暂无模板可用' };
  }

  // 标准化模板数据
  const templates = allTemplates.map((t) => ({
    id: t.id || '',
    name: t.name || t.title || '未命名',
    category: t.category || '未分类',
  }));

  // 如果有关键词，筛选
  const filtered = keyword ? fuzzyMatch(templates, keyword) : templates;
  if (keyword && filtered.length === 0) {
    return { text: `🔍 未找到与「${keyword}」相关的模板\n\n💡 发送 /写作 查看所有模板` };
  }

  // 创建会话
  sessionManager.create(userKey, 'select_template', {
    cachedTemplates: filtered,
    templatePage: 0,
    searchKeyword: keyword,
  });

  return formatTemplatePage(filtered, 0, keyword);
}

/**
 * 处理模板选择
 */
async function handleSelectTemplate(input: string, userKey: string, session: SessionData): Promise<OutgoingMessage> {
  const trimmed = input.trim();
  const templates = session.cachedTemplates || [];

  // 翻页：下一页
  if (trimmed === '下一页' || trimmed === 'n' || trimmed === 'next') {
    const page = (session.templatePage || 0) + 1;
    const maxPage = Math.ceil(templates.length / PAGE_SIZE) - 1;
    if (page > maxPage) {
      return { text: '已经是最后一页了' };
    }
    sessionManager.update(userKey, { templatePage: page });
    return formatTemplatePage(templates, page, session.searchKeyword);
  }

  // 翻页：上一页
  if (trimmed === '上一页' || trimmed === 'p' || trimmed === 'prev') {
    const page = Math.max(0, (session.templatePage || 0) - 1);
    sessionManager.update(userKey, { templatePage: page });
    return formatTemplatePage(templates, page, session.searchKeyword);
  }

  // 搜索
  if (trimmed.startsWith('搜索 ') || trimmed.startsWith('搜 ')) {
    const kw = trimmed.replace(/^搜索?\s+/, '');
    const filtered = fuzzyMatch(templates, kw);
    if (filtered.length === 0) {
      return { text: `🔍 未找到与「${kw}」相关的模板，请换个关键词试试` };
    }
    sessionManager.update(userKey, { cachedTemplates: filtered, templatePage: 0, searchKeyword: kw });
    return formatTemplatePage(filtered, 0, kw);
  }

  // 按编号选择
  const num = parseInt(trimmed, 10);
  const page = session.templatePage || 0;
  const pageStart = page * PAGE_SIZE;

  if (!isNaN(num) && num >= 1 && num <= PAGE_SIZE) {
    const idx = pageStart + num - 1;
    if (idx >= templates.length) {
      return { text: `❓ 编号 ${num} 超出范围，当前页共 ${Math.min(PAGE_SIZE, templates.length - pageStart)} 个模板` };
    }
    const selected = templates[idx];
    return selectTemplate(selected, userKey);
  }

  // 按名称模糊匹配
  const matched = fuzzyMatch(templates, trimmed);
  if (matched.length === 1) {
    return selectTemplate(matched[0], userKey);
  } else if (matched.length > 1) {
    sessionManager.update(userKey, { cachedTemplates: matched, templatePage: 0, searchKeyword: trimmed });
    return formatTemplatePage(matched, 0, trimmed);
  }

  return { text: '❓ 未识别的输入，请发送编号、模板名称或搜索关键词\n发送 /取消 退出' };
}

/**
 * 选中模板，进入变量填写阶段
 */
async function selectTemplate(template: { id: string; name: string; category: string }, userKey: string): Promise<OutgoingMessage> {
  const client = requireClient();

  let templateContent: TemplateContent = {};
  try {
    templateContent = (await client.templateGetContent({ templateId: template.id })) as TemplateContent;
  } catch (e) {
    logger.warn(TAG, `获取模板内容失败: ${(e as Error).message}`);
  }

  const variables = extractVariables(templateContent);

  if (variables.length === 0) {
    // 无变量，直接进入生成确认
    sessionManager.update(userKey, {
      step: 'confirm_generate',
      templateId: template.id,
      templateName: template.name,
      templateContent: templateContent?.content || templateContent?.prompt || '',
      variables: [],
    });

    return {
      markdown: `✅ 已选择模板「**${template.name}**」\n\n`
        + `此模板无需填写变量。\n\n`
        + `⏳ 正在使用 AI 生成内容...`,
    };
    // Note: 实际中应立即触发生成，但这里返回消息后由下次调用处理
    // 我们直接在这里生成
  }

  // 有变量，进入填写阶段
  sessionManager.update(userKey, {
    step: 'fill_variables',
    templateId: template.id,
    templateName: template.name,
    templateContent: templateContent?.content || templateContent?.prompt || '',
    variables: variables.map((v) => ({ ...v, value: undefined })),
  });

  const lines = [
    `✅ 已选择模板「**${template.name}**」\n`,
    `需要填写以下变量：\n`,
  ];

  for (let i = 0; i < variables.length; i++) {
    const v = variables[i];
    const desc = v.description ? ` — ${v.description}` : '';
    lines.push(`${i + 1}. **${v.name}**${desc}: ___`);
  }

  lines.push('');
  lines.push('💡 请逐一回复，或一次性发送：');
  lines.push(`\`${variables.map((v) => `${v.name}=值`).join(' ')}\``);
  lines.push('\n发送 /取消 退出');

  return { markdown: lines.join('\n') };
}

/**
 * 处理变量填写
 */
async function handleFillVariables(input: string, userKey: string, session: SessionData): Promise<OutgoingMessage> {
  const variables = session.variables || [];
  const trimmed = input.trim();

  // 尝试解析 key=value 格式
  const parsed = parseVariables(trimmed);
  if (Object.keys(parsed).length > 0) {
    for (const v of variables) {
      if (parsed[v.name] !== undefined) {
        v.value = parsed[v.name];
      }
    }
  } else {
    // 单值输入：填入第一个未填的变量
    const unfilled = variables.find((v) => !v.value);
    if (unfilled) {
      unfilled.value = trimmed;
    }
  }

  sessionManager.update(userKey, { variables });

  // 检查是否全部填完
  const remaining = variables.filter((v) => !v.value);
  if (remaining.length > 0) {
    const lines = [`📝 变量填写进度：\n`];
    for (const v of variables) {
      const status = v.value ? `✅ ${v.value}` : '⬜ 待填写';
      lines.push(`• **${v.name}**: ${status}`);
    }
    lines.push(`\n请填写 **${remaining[0].name}**${remaining[0].description ? ` (${remaining[0].description})` : ''}：`);
    return { markdown: lines.join('\n') };
  }

  // 全部填完，开始生成
  sessionManager.update(userKey, { step: 'confirm_generate' });
  return generateFromTemplate(userKey, session);
}

/**
 * 使用 AI 从模板生成内容
 */
async function generateFromTemplate(userKey: string, session: SessionData): Promise<OutgoingMessage> {
  const client = requireClient();
  const variables = session.variables || [];

  // 替换变量
  let prompt = session.templateContent || '';
  for (const v of variables) {
    if (v.value) {
      prompt = prompt.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), v.value);
      prompt = prompt.replace(new RegExp(`\\$\\{${v.name}\\}`, 'g'), v.value);
    }
  }

  // 如果模板为空，构建默认 prompt
  if (!prompt.trim()) {
    const varDesc = variables.filter((v) => v.value).map((v) => `${v.name}: ${v.value}`).join('，');
    prompt = `请帮我写一篇「${session.templateName}」。${varDesc ? '要求：' + varDesc : ''}`;
  }

  try {
    const genResult = (await client.aiGenerate({
      prompt,
      systemPrompt: `你是一个专业写作助手。请根据模板「${session.templateName}」的要求，生成高质量的中文内容。输出纯 Markdown 格式。`,
    })) as { content?: string; text?: string };

    const content = genResult?.content || genResult?.text || '';
    if (!content) {
      sessionManager.remove(userKey);
      return { text: '❌ AI 未能生成内容，请稍后重试。' };
    }

    // 保存生成内容到会话
    sessionManager.update(userKey, {
      step: 'review_result',
      generatedContent: content,
    });

    const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
    const lines = [
      `✨ **生成完成！**\n`,
      `📋 模板: ${session.templateName}`,
      `\n---\n`,
      preview,
      `\n---\n`,
      `请选择操作：`,
      `**1**. 保存为新文档`,
      `**2**. 重新生成`,
      `**3**. 放弃`,
    ];

    return { markdown: lines.join('\n') };
  } catch (e) {
    sessionManager.remove(userKey);
    return { text: `❌ AI 生成失败: ${(e as Error).message}` };
  }
}

/**
 * 处理审阅结果（保存/重新生成/放弃）
 */
async function handleReviewResult(input: string, userKey: string, session: SessionData): Promise<OutgoingMessage> {
  const choice = input.trim();

  // 1. 保存为新文档
  if (choice === '1' || choice === '保存' || choice === '确认') {
    return saveAsDocument(userKey, session);
  }

  // 2. 重新生成
  if (choice === '2' || choice === '重新生成' || choice === '重试') {
    return generateFromTemplate(userKey, session);
  }

  // 3. 放弃
  if (choice === '3' || choice === '放弃' || choice === '取消') {
    sessionManager.remove(userKey);
    return { text: '🗑️ 已放弃当前写作内容。' };
  }

  return { text: '❓ 请选择：1=保存为新文档  2=重新生成  3=放弃' };
}

/**
 * 将生成内容保存为新文档
 */
async function saveAsDocument(userKey: string, session: SessionData): Promise<OutgoingMessage> {
  const client = requireClient();
  const content = session.generatedContent || '';

  // 构建标题
  const varValues = (session.variables || [])
    .filter((v) => v.value)
    .map((v) => v.value)
    .slice(0, 2);
  const titleSuffix = varValues.length > 0 ? ` - ${varValues.join(' ')}` : '';
  const title = `${session.templateName || '未命名'}${titleSuffix}`;

  try {
    const activeProjectId = await client.getActiveProjectId();
    const projectId = session.projectId || activeProjectId || 'default';

    const createResult = (await client.documentCreate({
      projectId,
      title,
      content: '',
    })) as { documentId?: string; id?: string };

    const docId = createResult?.documentId || createResult?.id;
    if (docId) {
      // 同时写入 content 和 aiGeneratedContent
      await client.documentSave({
        projectId,
        documentId: docId,
        content,
        aiGeneratedContent: content,
      });
    }

    sessionManager.remove(userKey);

    return {
      markdown: `📄 **文档已创建！**\n\n`
        + `• 标题: **${title}**\n`
        + `• 项目: \`${projectId}\`\n`
        + (docId ? `• 文档ID: \`${docId}\`\n` : '')
        + `\n💡 在 AiDocPlus 中打开即可查看和编辑`,
    };
  } catch (e) {
    return { text: `❌ 文档创建失败: ${(e as Error).message}\n\n回复 1 重试保存，3 放弃` };
  }
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 格式化模板分页列表
 */
function formatTemplatePage(
  templates: Array<{ id: string; name: string; category: string }>,
  page: number,
  keyword?: string,
): OutgoingMessage {
  const totalPages = Math.ceil(templates.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const pageItems = templates.slice(start, start + PAGE_SIZE);

  const lines = [
    `📝 **选择写作模板**${keyword ? ` (搜索: ${keyword})` : ''}\n`,
    `共 ${templates.length} 个模板，第 ${page + 1}/${totalPages} 页\n`,
  ];

  for (let i = 0; i < pageItems.length; i++) {
    const t = pageItems[i];
    lines.push(`**${i + 1}**. ${t.name}  \`${t.category}\``);
  }

  lines.push('');
  const hints: string[] = [];
  if (page > 0) hints.push('发送 **上一页** 翻页');
  if (page < totalPages - 1) hints.push('发送 **下一页** 翻页');
  hints.push('发送 **编号** 或 **模板名称** 选择');
  hints.push('发送 **搜索 关键词** 筛选');
  hints.push('发送 **/取消** 退出');
  lines.push(hints.join('\n'));

  return { markdown: lines.join('\n') };
}

/**
 * 从模板内容中提取变量
 */
function extractVariables(templateContent: TemplateContent): TemplateVariable[] {
  // 1. 如果模板自带 variables 定义
  if (templateContent?.variables && Array.isArray(templateContent.variables)) {
    return templateContent.variables.map((v) => ({
      name: v.name,
      description: v.description,
    }));
  }

  // 2. 从模板文本中提取 {{变量名}} 或 ${变量名}
  const text = templateContent?.content || templateContent?.prompt || '';
  const vars = new Set<string>();
  const regex = /\{\{(\w+)\}\}|\$\{(\w+)\}/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    vars.add(match[1] || match[2]);
  }

  return Array.from(vars).map((name) => ({ name }));
}

/**
 * 解析 key=value 格式的变量
 */
function parseVariables(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  // 匹配：变量名=值（值可包含中文和空格，但遇到下一个 key= 时停止）
  const regex = /(\S+?)=([^=]+?)(?=\s+\S+=|$)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    result[match[1].trim()] = match[2].trim();
  }
  return result;
}

/**
 * 模糊匹配模板
 */
function fuzzyMatch(
  templates: Array<{ id: string; name: string; category: string }>,
  keyword: string,
): Array<{ id: string; name: string; category: string }> {
  const kw = keyword.toLowerCase();
  return templates.filter((t) => {
    const name = (t.name || '').toLowerCase();
    const cat = (t.category || '').toLowerCase();
    return name.includes(kw) || cat.includes(kw) || kw.includes(name);
  });
}
