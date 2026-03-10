/**
 * 斜杠指令路由器
 * 解析用户发送的 /指令 并调用对应的 AiDocPlus API
 */

import { requireClient } from '../bridge.js';
import type { OutgoingMessage } from '../channels/base.js';
import { sessionManager, SessionManager } from '../session.js';
import { handleWriteCommand } from '../workflows/writing.js';
import logger from '../utils/logger.js';

const TAG = 'CommandRouter';

// ============================================================
// 指令定义
// ============================================================

interface CommandDef {
  aliases: string[];
  description: string;
  usage: string;
  handler: (args: string, userKey?: string) => Promise<OutgoingMessage>;
}

const commands: CommandDef[] = [
  {
    aliases: ['/帮助', '/help', '/h'],
    description: '显示帮助信息',
    usage: '/帮助',
    handler: handleHelp,
  },
  {
    aliases: ['/状态', '/status'],
    description: '查看 AiDocPlus 运行状态',
    usage: '/状态',
    handler: handleStatus,
  },
  {
    aliases: ['/项目列表', '/projects'],
    description: '列出所有项目',
    usage: '/项目列表',
    handler: handleProjectList,
  },
  {
    aliases: ['/文档列表', '/docs'],
    description: '列出项目下的文档',
    usage: '/文档列表 [项目ID]',
    handler: handleDocumentList,
  },
  {
    aliases: ['/搜索', '/search'],
    description: '搜索文档',
    usage: '/搜索 关键词',
    handler: handleSearch,
  },
  {
    aliases: ['/新建文档', '/new'],
    description: '创建新文档',
    usage: '/新建文档 标题 [项目ID]',
    handler: handleCreateDocument,
  },
  {
    aliases: ['/查看文档', '/view'],
    description: '查看文档内容预览',
    usage: '/查看文档 项目ID 文档ID',
    handler: handleViewDocument,
  },
  {
    aliases: ['/AI写作', '/ai', '/generate'],
    description: 'AI 生成内容（加 --save 自动保存）',
    usage: '/AI写作 写一段关于... [--save]',
    handler: handleAIGenerate,
  },
  {
    aliases: ['/写作', '/write'],
    description: '模板写作（交互式或快捷模式）',
    usage: '/写作 [模板名 变量=值...]',
    handler: handleWrite,
  },
  {
    aliases: ['/模板列表', '/templates'],
    description: '列出提示词模板',
    usage: '/模板列表 [页码]',
    handler: handleTemplateList,
  },
  {
    aliases: ['/模板详情', '/template'],
    description: '查看模板详情和变量',
    usage: '/模板详情 模板ID',
    handler: handleTemplateDetail,
  },
  {
    aliases: ['/导出', '/export'],
    description: '导出文档',
    usage: '/导出 项目ID 文档ID 格式(md/html/docx/pdf/txt)',
    handler: handleExport,
  },
  {
    aliases: ['/取消', '/cancel'],
    description: '退出当前交互流程',
    usage: '/取消',
    handler: handleCancel,
  },
];

// ============================================================
// 路由入口
// ============================================================

/**
 * 判断是否为斜杠指令
 */
export function isCommand(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('/');
}

/**
 * 路由并执行指令
 * @param userKey 用户唯一键（平台:用户ID），用于会话管理
 */
export async function routeCommand(text: string, userKey?: string): Promise<OutgoingMessage | null> {
  const trimmed = text.trim();
  const spaceIdx = trimmed.indexOf(' ');
  const cmd = spaceIdx === -1 ? trimmed : trimmed.substring(0, spaceIdx);
  const args = spaceIdx === -1 ? '' : trimmed.substring(spaceIdx + 1).trim();

  const cmdLower = cmd.toLowerCase();

  for (const def of commands) {
    if (def.aliases.some((a) => a.toLowerCase() === cmdLower)) {
      logger.info(TAG, `执行指令: ${cmd} ${args}`);
      try {
        return await def.handler(args, userKey);
      } catch (e) {
        const errMsg = (e as Error).message || '未知错误';
        logger.error(TAG, `指令执行失败: ${cmd}`, errMsg);
        return { text: `❌ 执行失败: ${errMsg}` };
      }
    }
  }

  return { text: `❓ 未知指令: ${cmd}\n输入 /帮助 查看可用指令` };
}

// ============================================================
// 指令处理器
// ============================================================

async function handleHelp(): Promise<OutgoingMessage> {
  const lines = [
    '📖 **AiDocPlus Bot 指令列表**\n',
    '**📂 项目与文档**',
  ];
  const docCmds = ['/状态', '/项目列表', '/文档列表', '/搜索', '/新建文档', '/查看文档', '/导出'];
  const aiCmds = ['/AI写作', '/写作'];
  const tplCmds = ['/模板列表', '/模板详情'];
  const otherCmds = ['/取消'];

  for (const def of commands) {
    if (docCmds.includes(def.aliases[0])) {
      lines.push(`• \`${def.aliases[0]}\` — ${def.description}`);
    }
  }
  lines.push('\n**✨ AI 写作**');
  for (const def of commands) {
    if (aiCmds.includes(def.aliases[0])) {
      lines.push(`• \`${def.aliases[0]}\` — ${def.description}`);
      lines.push(`  用法: \`${def.usage}\``);
    }
  }
  lines.push('\n**📋 模板**');
  for (const def of commands) {
    if (tplCmds.includes(def.aliases[0])) {
      lines.push(`• \`${def.aliases[0]}\` — ${def.description}`);
    }
  }
  lines.push('\n**其他**');
  for (const def of commands) {
    if (otherCmds.includes(def.aliases[0])) {
      lines.push(`• \`${def.aliases[0]}\` — ${def.description}`);
    }
  }
  lines.push('\n💡 也可以直接发送自然语言，AI 会自动理解你的意图。');
  return { markdown: lines.join('\n') };
}

async function handleStatus(): Promise<OutgoingMessage> {
  const client = requireClient();
  const alive = await client.isAlive();
  if (!alive) {
    return { text: '⚠️ AiDocPlus 桌面应用未响应，请检查是否已启动。' };
  }
  const status = (await client.appStatus()) as Record<string, unknown>;
  const lines = ['✅ **AiDocPlus 运行中**\n'];
  if (status) {
    for (const [key, value] of Object.entries(status)) {
      lines.push(`• ${key}: ${JSON.stringify(value)}`);
    }
  }
  return { markdown: lines.join('\n') };
}

async function handleProjectList(): Promise<OutgoingMessage> {
  const client = requireClient();
  const result = (await client.projectList()) as Array<{ id: string; name: string; documentCount?: number }>;

  if (!result || !Array.isArray(result) || result.length === 0) {
    return { text: '📂 暂无项目' };
  }

  const lines = [`📂 **项目列表** (共 ${result.length} 个)\n`];
  for (const p of result) {
    const docCount = p.documentCount !== undefined ? ` (${p.documentCount} 篇)` : '';
    lines.push(`• **${p.name}**${docCount}\n  ID: \`${p.id}\``);
  }
  return { markdown: lines.join('\n') };
}

async function handleDocumentList(args: string): Promise<OutgoingMessage> {
  const client = requireClient();
  const params: { projectId?: string } = {};
  if (args) params.projectId = args;

  const result = (await client.documentList(params)) as Array<{ id: string; title: string; updatedAt?: string }>;

  if (!result || !Array.isArray(result) || result.length === 0) {
    return { text: '📄 暂无文档' };
  }

  const lines = [`📄 **文档列表** (共 ${result.length} 篇)\n`];
  for (const d of result) {
    const updated = d.updatedAt ? ` (更新于 ${d.updatedAt})` : '';
    lines.push(`• **${d.title}**${updated}\n  ID: \`${d.id}\``);
  }
  return { markdown: lines.join('\n') };
}

async function handleSearch(args: string): Promise<OutgoingMessage> {
  if (!args) {
    return { text: '❓ 请提供搜索关键词，例如: /搜索 会议纪要' };
  }

  const client = requireClient();
  const result = (await client.searchDocuments({ query: args })) as Array<{ id: string; title: string; snippet?: string }>;

  if (!result || !Array.isArray(result) || result.length === 0) {
    return { text: `🔍 未找到与「${args}」相关的文档` };
  }

  const lines = [`🔍 **搜索结果**「${args}」(共 ${result.length} 条)\n`];
  for (const d of result.slice(0, 10)) {
    const snippet = d.snippet ? `\n  ${d.snippet}` : '';
    lines.push(`• **${d.title}**${snippet}\n  ID: \`${d.id}\``);
  }
  if (result.length > 10) {
    lines.push(`\n...还有 ${result.length - 10} 条结果`);
  }
  return { markdown: lines.join('\n') };
}

// ============================================================
// 新增指令：文档操作
// ============================================================

async function handleCreateDocument(args: string): Promise<OutgoingMessage> {
  if (!args) {
    return { text: '❓ 请提供文档标题，例如: /新建文档 项目总结\n可选: /新建文档 标题 项目ID' };
  }

  const parts = args.split(/\s+/);
  const title = parts[0];
  const specifiedProjectId = parts[1];

  const client = requireClient();
  const projectId = specifiedProjectId || (await client.getActiveProjectId()) || 'default';

  const result = (await client.documentCreate({
    projectId,
    title,
  })) as { documentId?: string; id?: string };

  const docId = result?.documentId || result?.id;
  if (docId) {
    return {
      markdown: `📄 **文档已创建**\n\n`
        + `• 标题: **${title}**\n`
        + `• 项目: \`${projectId}\`\n`
        + `• 文档ID: \`${docId}\`\n`
        + `\n💡 发送 \`/查看文档 ${projectId} ${docId}\` 查看内容`,
    };
  }

  return { text: '✅ 文档创建成功' };
}

async function handleViewDocument(args: string): Promise<OutgoingMessage> {
  const parts = args.split(/\s+/);
  if (parts.length < 2) {
    return { text: '❓ 用法: /查看文档 项目ID 文档ID' };
  }

  const [projectId, documentId] = parts;
  const client = requireClient();
  const result = (await client.documentGet({ projectId, documentId })) as {
    id?: string;
    title?: string;
    content?: string;
    aiGeneratedContent?: string;
    updatedAt?: string;
  };

  if (!result) {
    return { text: '❌ 未找到该文档' };
  }

  const content = result.content || result.aiGeneratedContent || '';
  const preview = content.length > 500 ? content.substring(0, 500) + '...' : content;
  const lines = [
    `📄 **${result.title || '未命名文档'}**\n`,
    result.updatedAt ? `更新于: ${result.updatedAt}\n` : '',
    `---\n`,
    preview || '（空文档）',
  ].filter(Boolean);

  return { markdown: lines.join('\n') };
}

// ============================================================
// AI 写作（增强版，支持 --save）
// ============================================================

async function handleAIGenerate(args: string): Promise<OutgoingMessage> {
  if (!args) {
    return { text: '❓ 请提供写作内容，例如:\n/AI写作 写一段项目总结\n/AI写作 写一段项目总结 --save（自动保存为文档）' };
  }

  // 检查 --save 标志
  const shouldSave = args.includes('--save');
  const prompt = args.replace(/--save/g, '').trim();

  if (!prompt) {
    return { text: '❓ 请提供写作内容' };
  }

  const client = requireClient();
  const result = (await client.aiGenerate({ prompt })) as { content?: string; text?: string };
  const content = result?.content || result?.text || '';

  if (!content) {
    return { text: '❌ AI 未能生成内容，请稍后重试。' };
  }

  if (shouldSave) {
    // 自动创建文档并保存
    const titleMatch = content.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].substring(0, 50) : `AI写作 ${new Date().toLocaleDateString('zh-CN')}`;

    const activeProjectId = await client.getActiveProjectId();
    const projectId = activeProjectId || 'default';
    logger.info(TAG, `--save: projectId=${projectId}, title=${title}`);

    try {
      const createResult = (await client.documentCreate({
        projectId,
        title,
        content: '',
      })) as { documentId?: string; id?: string };

      logger.info(TAG, `--save: createResult keys=${Object.keys(createResult || {})}`);
      const docId = createResult?.documentId || createResult?.id;
      if (docId) {
        await client.documentSave({
          projectId,
          documentId: docId,
          aiGeneratedContent: content,
          authorNotes: prompt,
        });
        logger.info(TAG, `--save: ✅ 文档已保存 docId=${docId}`);

        return {
          markdown: `✨ **AI 写作完成并已保存**\n\n`
            + `📄 标题: **${title}**\n`
            + `📂 项目: \`${projectId}\`\n`
            + `🆔 文档ID: \`${docId}\`\n`
            + `\n---\n\n`
            + (content.length > 300 ? content.substring(0, 300) + '...' : content),
        };
      }
      logger.error(TAG, `--save: document.create 返回无 ID`, JSON.stringify(createResult));
    } catch (saveErr) {
      logger.error(TAG, `--save: 保存失败:`, (saveErr as Error).message);
      return { text: `✨ AI 已生成内容，但保存文档失败: ${(saveErr as Error).message}` };
    }
  }

  return { markdown: `✨ **AI 生成结果**\n\n${content}\n\n💡 提示: 加 \`--save\` 可自动保存为文档` };
}

// ============================================================
// 模板写作（交互式工作流入口）
// ============================================================

async function handleWrite(args: string, userKey?: string): Promise<OutgoingMessage> {
  if (!userKey) {
    return { text: '⚠️ 无法识别用户身份，请重试。' };
  }
  return handleWriteCommand(args, userKey);
}

// ============================================================
// 模板相关
// ============================================================

async function handleTemplateList(args: string): Promise<OutgoingMessage> {
  const client = requireClient();
  const result = (await client.templateList()) as Array<{ id?: string; name?: string; category?: string; title?: string }>;

  if (!result || !Array.isArray(result) || result.length === 0) {
    return { text: '📋 暂无模板' };
  }

  // 按分类分组
  const grouped = new Map<string, Array<{ id: string; name: string }>>();
  for (const t of result) {
    const cat = t.category || '未分类';
    const name = t.name || t.title || t.id || '未命名';
    const id = t.id || '';
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push({ id, name });
  }

  // 分页支持
  const page = parseInt(args, 10) || 1;
  const categories = Array.from(grouped.keys());
  const pageSize = 5; // 每页显示 5 个分类
  const totalPages = Math.ceil(categories.length / pageSize);
  const pageIdx = Math.max(0, Math.min(page - 1, totalPages - 1));
  const pageCats = categories.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);

  const lines = [`📋 **提示词模板** (共 ${result.length} 个，${categories.length} 个分类)\n`];
  lines.push(`第 ${pageIdx + 1}/${totalPages} 页\n`);

  for (const cat of pageCats) {
    const items = grouped.get(cat)!;
    lines.push(`**${cat}** (${items.length})`);
    for (const item of items.slice(0, 5)) {
      lines.push(`  • ${item.name}  \`${item.id}\``);
    }
    if (items.length > 5) {
      lines.push(`  ...还有 ${items.length - 5} 个`);
    }
  }

  if (totalPages > 1) {
    lines.push(`\n💡 发送 \`/模板列表 ${pageIdx + 2}\` 查看下一页`);
  }
  lines.push('💡 发送 `/模板详情 模板ID` 查看模板内容和变量');
  lines.push('💡 发送 `/写作` 开始模板写作');

  return { markdown: lines.join('\n') };
}

async function handleTemplateDetail(args: string): Promise<OutgoingMessage> {
  if (!args) {
    return { text: '❓ 请提供模板 ID，例如: /模板详情 business-plan\n\n💡 发送 /模板列表 查看所有模板' };
  }

  const templateId = args.trim();
  const client = requireClient();

  try {
    const result = (await client.templateGetContent({ templateId })) as {
      content?: string;
      prompt?: string;
      name?: string;
      title?: string;
      category?: string;
      description?: string;
      variables?: Array<{ name: string; description?: string; default?: string }>;
    };

    if (!result) {
      return { text: `❌ 未找到模板: ${templateId}` };
    }

    const lines = [`📋 **模板详情**\n`];
    if (result.name || result.title) lines.push(`• 名称: **${result.name || result.title}**`);
    if (result.category) lines.push(`• 分类: ${result.category}`);
    if (result.description) lines.push(`• 描述: ${result.description}`);

    // 变量列表
    const vars: Array<{ name: string; description?: string }> = [];
    if (result.variables && Array.isArray(result.variables)) {
      for (const v of result.variables) {
        vars.push(v);
      }
    } else {
      // 从内容中提取 {{变量名}}
      const text = result.content || result.prompt || '';
      const regex = /\{\{(\w+)\}\}|\$\{(\w+)\}/g;
      const seen = new Set<string>();
      let match;
      while ((match = regex.exec(text)) !== null) {
        const name = match[1] || match[2];
        if (!seen.has(name)) {
          seen.add(name);
          vars.push({ name });
        }
      }
    }

    if (vars.length > 0) {
      lines.push(`\n**变量** (${vars.length} 个):`);
      for (const v of vars) {
        const desc = v.description ? ` — ${v.description}` : '';
        lines.push(`  • \`${v.name}\`${desc}`);
      }
    } else {
      lines.push('\n此模板无需填写变量');
    }

    // 内容预览
    const content = result.content || result.prompt || '';
    if (content) {
      const preview = content.length > 300 ? content.substring(0, 300) + '...' : content;
      lines.push(`\n**内容预览:**\n\`\`\`\n${preview}\n\`\`\``);
    }

    // 快捷写作提示
    if (vars.length > 0) {
      const varStr = vars.map((v) => `${v.name}=值`).join(' ');
      lines.push(`\n💡 快捷写作: \`/写作 ${result.name || templateId} ${varStr}\``);
    } else {
      lines.push(`\n💡 使用此模板: \`/写作 ${result.name || templateId}\``);
    }

    return { markdown: lines.join('\n') };
  } catch (e) {
    return { text: `❌ 获取模板失败: ${(e as Error).message}` };
  }
}

// ============================================================
// 导出
// ============================================================

async function handleExport(args: string): Promise<OutgoingMessage> {
  const parts = args.split(/\s+/);
  if (parts.length < 3) {
    return { text: '❓ 用法: /导出 项目ID 文档ID 格式\n支持格式: md, html, docx, pdf, txt' };
  }

  const [projectId, documentId, format] = parts;
  const validFormats = ['md', 'markdown', 'html', 'docx', 'pdf', 'txt'];
  if (!validFormats.includes(format.toLowerCase())) {
    return { text: `❓ 不支持的格式「${format}」\n支持格式: md, html, docx, pdf, txt` };
  }

  const client = requireClient();
  const result = (await client.exportDocument({
    projectId,
    documentId,
    format: format.toLowerCase() === 'md' ? 'markdown' : format.toLowerCase(),
  })) as { path?: string; content?: string };

  if (result?.path) {
    return { text: `📤 导出成功！文件路径: ${result.path}` };
  } else if (result?.content) {
    const preview = result.content.length > 500 ? result.content.substring(0, 500) + '...' : result.content;
    return { markdown: `📤 **导出结果**\n\n\`\`\`\n${preview}\n\`\`\`` };
  }

  return { text: '📤 导出完成' };
}

// ============================================================
// 取消当前交互流程
// ============================================================

async function handleCancel(_args: string, userKey?: string): Promise<OutgoingMessage> {
  if (userKey && sessionManager.has(userKey)) {
    sessionManager.remove(userKey);
    return { text: '✅ 已退出当前交互流程。' };
  }
  return { text: '💡 当前没有进行中的交互流程。' };
}
