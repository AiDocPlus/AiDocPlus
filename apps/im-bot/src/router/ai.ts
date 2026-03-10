/**
 * AI 智能路由器
 * 通过 AiDocPlus 内置的 ai.chat API 处理自然语言消息
 * 复用用户在桌面应用中配置的默认 AI 提供商，无需额外配置 API Key
 */

import { requireClient } from '../bridge.js';
import type { OutgoingMessage } from '../channels/base.js';
import logger from '../utils/logger.js';

const TAG = 'AIRouter';

const SYSTEM_PROMPT = `你是 AiDocPlus 智能助手，通过即时通讯平台帮助用户远程操控 AiDocPlus 文档编辑器。

## 可用指令

### 项目与文档
- /状态 — 查看 AiDocPlus 运行状态
- /项目列表 — 列出所有项目
- /文档列表 [项目ID] — 列出文档
- /搜索 关键词 — 搜索文档
- /新建文档 标题 [项目ID] — 创建新文档
- /查看文档 项目ID 文档ID — 预览文档内容
- /导出 项目ID 文档ID 格式 — 导出文档（md/html/docx/pdf/txt）

### AI 写作
- /AI写作 提示词 — AI 生成内容（加 --save 自动保存为文档）
- /写作 — 进入模板写作交互流程（选模板→填变量→AI生成→保存）
- /写作 模板名 变量=值... — 快捷模板写作（一句话完成）

### 模板
- /模板列表 [页码] — 列出提示词模板（分页）
- /模板详情 模板ID — 查看模板内容和变量

### 其他
- /取消 — 退出当前交互流程

## 回复规则
- 用中文回复用户，简洁友好
- 如果用户想执行操作，告诉他们对应的斜杠指令
- 如果用户说"帮我写一篇XX"或"用XX模板写"，建议使用 /写作 指令
- 如果用户说"新建一个文档叫XX"，建议使用 /新建文档 XX
- 如果用户说"帮我保存"或"生成并保存"，建议使用 /AI写作 ... --save
- 对于写作、翻译、总结、问答等通用 AI 任务，直接回答即可`;

// ============================================================
// AI 路由入口
// ============================================================

export class AIRouter {
  private enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * 处理自然语言消息，通过 AiDocPlus 的 ai.chat API 调用用户默认配置的 AI 模型
   */
  async route(userMessage: string): Promise<OutgoingMessage | null> {
    if (!this.enabled) return null;

    try {
      const client = requireClient();

      logger.info(TAG, `调用 ai.chat: ${userMessage.substring(0, 50)}...`);

      const result = await client.aiChat({
        messages: [
          { role: 'user', content: userMessage },
        ],
        systemPrompt: SYSTEM_PROMPT,
      }) as any;

      // ai.chat 返回格式：{ content: string, ... }
      const content = result?.content || result?.message?.content || result?.text;

      if (content) {
        logger.info(TAG, '✅ AI 回复成功');
        return { markdown: content };
      }

      // 如果返回的是其他格式，尝试序列化
      if (result) {
        return { markdown: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
      }

      return { text: '🤔 AI 未返回内容，请稍后再试。' };
    } catch (e) {
      logger.error(TAG, 'AI 路由失败:', (e as Error).message);
      return { text: `❌ AI 处理失败: ${(e as Error).message}` };
    }
  }
}
