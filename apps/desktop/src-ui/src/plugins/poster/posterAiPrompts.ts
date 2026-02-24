import type { PosterTheme } from './types';

/**
 * 构造信息图海报生成的 system prompt
 */
export function buildPosterSystemPrompt(theme: PosterTheme): string {
  return `你是一个专业的信息图设计师。用户会给你一段文档内容，你需要将其转化为一个精美的 HTML 信息图海报。

设计要求：
- 主色调：${theme.primaryColor}
- 背景色：${theme.bgColor}
- 文字色：${theme.textColor}
- 风格：${theme.label} - ${theme.description}

请直接输出完整的 HTML 代码（包含内联 CSS），不要输出任何其他解释文字。

HTML 要求：
1. 使用 div 布局，宽度固定 800px，适合打印和截图
2. 包含以下区域：
   - 顶部标题区（大标题 + 副标题）
   - 核心数据/统计区（如果文档中有数字数据，用大字号突出显示）
   - 要点列表区（3-6 个关键要点，使用图标或编号）
   - 详细内容区（分栏或卡片式布局展示详细信息）
   - 底部信息区（来源、日期等）
3. 使用内联 CSS 样式，不依赖外部资源
4. 使用 CSS 渐变、圆角、阴影等现代效果
5. 使用 Unicode 符号（如 ● ◆ ★ ▶ ✓ 📊 📈 💡 🎯）作为装饰图标
6. 字体使用系统字体栈：font-family: "Songti SC", "SimSun", "STSong", -apple-system, sans-serif
7. 确保内容层次分明、视觉效果突出
8. 只输出 HTML 代码，不要用 markdown 代码块包裹`;
}

/**
 * 构造用户 prompt
 */
export function buildPosterUserPrompt(content: string, customPrompt?: string): string {
  const parts: string[] = [];

  if (customPrompt && customPrompt.trim()) {
    parts.push(customPrompt);
  } else {
    parts.push('请将以下文档内容转化为一个精美的信息图海报。提取核心信息，突出重点数据和关键要点。');
  }

  parts.push('');
  parts.push('---');
  parts.push('文档内容：');
  parts.push(content);
  parts.push('---');

  return parts.join('\n');
}

/**
 * 从 AI 响应中提取 HTML
 */
export function extractHtmlFromResponse(text: string): string | null {
  let cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  // 尝试从 code block 提取
  const codeBlockMatch = cleaned.match(/```(?:html)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // 尝试直接匹配 HTML
  const htmlMatch = cleaned.match(/<(!DOCTYPE|html|div|section)[^>]*>[\s\S]*<\/(html|div|section)>/i);
  if (htmlMatch) {
    return htmlMatch[0].trim();
  }

  // 如果整个响应看起来像 HTML
  if (cleaned.startsWith('<') && cleaned.includes('</')) {
    return cleaned;
  }

  return null;
}
