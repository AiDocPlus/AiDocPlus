import type { SlideLayout } from '@aidocplus/shared-types';

/**
 * 构造 AI 生成幻灯片的 system prompt（Markdown 格式输出）
 */
export function buildSlideSystemPrompt(): string {
  return `你是一个专业的 PPT 内容策划师。用户会给你一个主题或大纲，你需要生成结构化的幻灯片内容。

请严格按照以下 Markdown 格式输出，不要输出任何其他解释文字：

# 演示文稿大标题
副标题或作者信息

> 演讲者备注（可选）

---

## 章节名称

> 演讲者备注（可选）

---

### 内容页标题

- 要点一
- 要点二
- 要点三

> 演讲者备注（可选）

---

### 双栏页标题
<!-- layout: two-column -->

- 左栏要点一
- 左栏要点二
|||
- 右栏要点一
- 右栏要点二

> 演讲者备注（可选）

格式规则：
- # 一级标题 = 封面页（第一页），紧跟的普通文本行为副标题
- ## 二级标题 = 章节分隔页
- ### 三级标题 = 内容页
- --- = 幻灯片之间的分隔线（必须用）
- - 列表项 = 内容要点
- > 引用块 = 演讲者备注
- ||| = 双栏分隔符（左右栏之间）
- <!-- layout: two-column --> = 标记为双栏页

内容规则：
1. 第一页必须是封面（# 标题）
2. 最后一页建议是总结或致谢页
3. 每条要点简洁有力，不超过 30 字
4. 合理使用 ## 章节页分隔不同主题
5. 总页数建议 8-15 页
6. 所有内容使用中文
7. 每张幻灯片之间必须用 --- 分隔`;
}

/**
 * 从 AI 返回的 Markdown 文本中解析幻灯片数据
 */
export function parseSlidesFromAiResponse(text: string): Array<{
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  content: string[];
  notes?: string;
}> | null {
  const cleaned = text.trim();
  if (!cleaned) return null;

  // 按 --- 分割幻灯片（宽容匹配：前后可有空行，支持 3 个以上 -）
  const rawSlides = cleaned.split(/\n-{3,}\n?/).map(s => s.trim()).filter(Boolean);
  if (rawSlides.length === 0) {
    // 如果没有 ---，尝试按标题分割
    const byHeading = cleaned.split(/\n(?=#{1,3}\s)/).map(s => s.trim()).filter(Boolean);
    if (byHeading.length > 0) {
      rawSlides.length = 0;
      rawSlides.push(...byHeading);
    }
  }

  if (rawSlides.length === 0) {
    console.error('[PPT] 无法从 Markdown 中解析幻灯片，原始文本长度:', text.length);
    return null;
  }

  const slides: Array<{
    layout: SlideLayout;
    title: string;
    subtitle?: string;
    content: string[];
    notes?: string;
  }> = [];

  for (const raw of rawSlides) {
    const lines = raw.split('\n');
    let layout: SlideLayout = 'content';
    let title = '';
    let subtitle: string | undefined;
    const content: string[] = [];
    const notesLines: string[] = [];
    let isTwoColumn = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // 跳过空行
      if (!trimmed) continue;

      // 检测双栏标记
      if (trimmed === '<!-- layout: two-column -->') {
        isTwoColumn = true;
        continue;
      }

      // 双栏分隔符
      if (trimmed === '|||') {
        content.push('---');
        continue;
      }

      // 演讲者备注（> 引用块）
      if (trimmed.startsWith('> ')) {
        notesLines.push(trimmed.slice(2));
        continue;
      }
      if (trimmed === '>') {
        continue;
      }

      // # 一级标题 = 封面页
      const h1Match = trimmed.match(/^#\s+(.+)$/);
      if (h1Match) {
        layout = 'title';
        title = h1Match[1].trim();
        continue;
      }

      // ## 二级标题 = 章节页
      const h2Match = trimmed.match(/^##\s+(.+)$/);
      if (h2Match) {
        layout = 'section';
        title = h2Match[1].trim();
        continue;
      }

      // ### 三级标题 = 内容页
      const h3Match = trimmed.match(/^###\s+(.+)$/);
      if (h3Match) {
        layout = 'content';
        title = h3Match[1].trim();
        continue;
      }

      // - 列表项 或 1. 编号列表 = 内容要点
      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        content.push(bulletMatch[1].trim());
        continue;
      }
      const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (numberedMatch) {
        content.push(numberedMatch[1].trim());
        continue;
      }

      // 封面页的副标题（非标题、非列表、非备注的普通文本行，支持多行拼接）
      if (layout === 'title' && title) {
        subtitle = subtitle ? `${subtitle}\n${trimmed}` : trimmed;
        continue;
      }

      // 其他文本作为内容
      if (title) {
        content.push(trimmed);
      }
    }

    // 跳过没有标题的空幻灯片
    if (!title) continue;

    if (isTwoColumn) {
      layout = 'two-column';
    }

    slides.push({
      layout,
      title,
      subtitle,
      content,
      notes: notesLines.length > 0 ? notesLines.join('\n') : undefined,
    });
  }

  if (slides.length === 0) {
    console.error('[PPT] Markdown 解析结果为空，原始文本长度:', text.length);
    return null;
  }

  return slides;
}

/**
 * 将幻灯片数据转换回 Markdown 源码
 */
export function slidesToMarkdown(slides: Array<{
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  content: string[];
  notes?: string;
}>): string {
  const parts: string[] = [];

  for (const slide of slides) {
    const lines: string[] = [];

    switch (slide.layout) {
      case 'title':
        lines.push(`# ${slide.title}`);
        if (slide.subtitle) lines.push(slide.subtitle);
        break;
      case 'section':
        lines.push(`## ${slide.title}`);
        break;
      case 'two-column':
        lines.push(`### ${slide.title}`);
        lines.push('<!-- layout: two-column -->');
        lines.push('');
        {
          const sepIdx = slide.content.indexOf('---');
          const left = sepIdx >= 0 ? slide.content.slice(0, sepIdx) : slide.content.slice(0, Math.ceil(slide.content.length / 2));
          const right = sepIdx >= 0 ? slide.content.slice(sepIdx + 1) : slide.content.slice(Math.ceil(slide.content.length / 2));
          for (const item of left) lines.push(`- ${item}`);
          lines.push('|||');
          for (const item of right) lines.push(`- ${item}`);
        }
        break;
      default:
        lines.push(`### ${slide.title}`);
        if (slide.content.length > 0) {
          lines.push('');
          for (const item of slide.content) lines.push(`- ${item}`);
        }
        break;
    }

    if (slide.notes) {
      lines.push('');
      for (const noteLine of slide.notes.split('\n')) {
        lines.push(`> ${noteLine}`);
      }
    }

    parts.push(lines.join('\n'));
  }

  return parts.join('\n\n---\n\n');
}

/**
 * PPT 生成模板（用于提示词模板系统）
 */
export interface PptPromptTemplate {
  id: string;
  name: string;
  description: string;
  defaultTopic: string;
  suggestedSlideCount: number;
  promptTemplate?: string;  // 提示词模板内容（可选，用于自定义模板）
  builtin?: boolean;        // 是否内置模板
}

const CUSTOM_TEMPLATES_KEY = 'ppt-custom-templates';

/** 获取所有模板（内置 + 自定义） */
export function getAllPptTemplates(): PptPromptTemplate[] {
  const custom = getCustomTemplates();
  return [...BUILT_IN_PPT_TEMPLATES, ...custom];
}

/** 获取自定义模板 */
export function getCustomTemplates(): PptPromptTemplate[] {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PptPromptTemplate[];
  } catch {
    return [];
  }
}

/** 保存自定义模板列表 */
function saveCustomTemplates(templates: PptPromptTemplate[]) {
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
}

/** 添加或更新模板（内置模板的修改也存为自定义副本） */
export function savePptTemplate(template: PptPromptTemplate): PptPromptTemplate[] {
  const customs = getCustomTemplates();
  const idx = customs.findIndex(t => t.id === template.id);
  const saved = { ...template, builtin: false };
  if (idx >= 0) {
    customs[idx] = saved;
  } else {
    customs.push(saved);
  }
  saveCustomTemplates(customs);
  return customs;
}

/** 删除模板（仅自定义模板可删除） */
export function deletePptTemplate(id: string): PptPromptTemplate[] {
  const customs = getCustomTemplates().filter(t => t.id !== id);
  saveCustomTemplates(customs);
  return customs;
}

/** 重置：删除所有自定义模板 */
export function resetPptTemplates(): void {
  localStorage.removeItem(CUSTOM_TEMPLATES_KEY);
}

export const BUILT_IN_PPT_TEMPLATES: PptPromptTemplate[] = [
  {
    id: 'ppt-business-report',
    name: '商务汇报',
    description: '适用于工作汇报、项目进展、季度总结等商务场景',
    defaultTopic: '2024年度工作总结与2025年计划',
    suggestedSlideCount: 12,
    builtin: true,
  },
  {
    id: 'ppt-project-summary',
    name: '项目总结',
    description: '适用于项目结项、成果展示、经验分享',
    defaultTopic: 'XX项目总结报告',
    suggestedSlideCount: 10,
    builtin: true,
  },
  {
    id: 'ppt-teaching',
    name: '教学课件',
    description: '适用于课堂教学、培训讲座、知识分享',
    defaultTopic: '人工智能基础入门',
    suggestedSlideCount: 15,
    builtin: true,
  },
  {
    id: 'ppt-product-launch',
    name: '产品发布',
    description: '适用于新产品发布、功能介绍、市场推广',
    defaultTopic: '全新产品发布会',
    suggestedSlideCount: 10,
    builtin: true,
  },
  {
    id: 'ppt-proposal',
    name: '方案提案',
    description: '适用于项目提案、解决方案、投标演示',
    defaultTopic: '数字化转型解决方案',
    suggestedSlideCount: 12,
    builtin: true,
  },
  {
    id: 'ppt-speech',
    name: '演讲稿',
    description: '适用于主题演讲、会议发言、公开讲话',
    defaultTopic: '主题演讲',
    suggestedSlideCount: 10,
    builtin: true,
  },
  {
    id: 'ppt-research',
    name: '研究报告',
    description: '适用于学术研究、调研分析、数据报告',
    defaultTopic: '行业研究报告',
    suggestedSlideCount: 15,
    builtin: true,
  },
  {
    id: 'ppt-team-intro',
    name: '团队介绍',
    description: '适用于团队展示、公司介绍、组织架构',
    defaultTopic: '团队与公司介绍',
    suggestedSlideCount: 8,
    builtin: true,
  },
  {
    id: 'ppt-marketing',
    name: '营销策划',
    description: '适用于市场营销方案、品牌推广、活动策划',
    defaultTopic: '品牌营销推广方案',
    suggestedSlideCount: 12,
    builtin: true,
  },
  {
    id: 'ppt-training',
    name: '培训材料',
    description: '适用于员工培训、技能提升、操作指南',
    defaultTopic: '新员工入职培训',
    suggestedSlideCount: 15,
    builtin: true,
  },
  {
    id: 'ppt-competition',
    name: '竞赛答辩',
    description: '适用于比赛答辩、毕业论文答辩、创业大赛',
    defaultTopic: '毕业论文答辩',
    suggestedSlideCount: 12,
    builtin: true,
  },
];

