/**
 * 仿写文档类型 — DocTypeDefinition 注册定义
 */
import { lazy } from 'react';
import { BookOpen, PenTool, Sparkles, GitCompare } from 'lucide-react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';
import { createEmptyImitativeWritingContent } from './types';

const ImitativeWritingWorkspace = lazy(() => import('./ImitativeWritingWorkspace'));

export const imitativeWritingDocType: DocTypeDefinition = {
  id: 'imitative-writing',
  version: '1.0.0',
  labelKey: 'docType.imitativeWriting',
  descriptionKey: 'docType.imitativeWritingDesc',
  icon: BookOpen,
  fileSuffix: '.aidoc-imitative',
  category: 'creative',
  EditorComponent: ImitativeWritingWorkspace,
  layoutMode: 'full',
  createEmptyContent: () => JSON.stringify(createEmptyImitativeWritingContent()),
  extractPlainText: (content: string) => {
    try {
      const data = JSON.parse(content);
      const sourcePart = data.source?.text || '';
      const imitationPart = data.imitation?.text || '';
      return [sourcePart, imitationPart].filter(Boolean).join('\n\n');
    } catch {
      return content;
    }
  },
  defaultSystemPrompt: '你是一位精通中外文学的写作训练导师，拥有文学博士学位和二十年创意写作教学经验。你负责指导用户通过仿写经典作品来提升写作能力。你的教学方法是"读-析-仿-评"四步法。精通各种文学体裁的技法分析，能识别并讲解各种修辞手法、叙事技巧、结构模式。分析时精确标注技法类型，结合具体文本举例；指导时循序渐进，给出可操作的具体建议（含可照抄的示例句与修改前后对照）；评价时客观公正。使用 Markdown 格式输出，分析结果结构化呈现，评分使用百分制，对比分析使用表格。若用户需要续写或改写，应直接给出成品段落并附极简点评。',
  aiQuickActions: [
    { id: 'imitative:analyze', labelKey: 'imitativeWriting.ai.analyze', icon: Sparkles, defaultPromptTemplate: '请对以下原文进行全面的文学技法分析，包括体裁特征、结构布局、修辞运用、意象系统、叙事手法和节奏特点：\n\n{{source}}' },
    { id: 'imitative:guide', labelKey: 'imitativeWriting.ai.guide', icon: PenTool, defaultPromptTemplate: '请对照原文和仿写内容，给出逐段指导建议，指出差距并提供具体改进方向：\n\n【原文】\n{{source}}\n\n【仿写】\n{{content}}' },
    { id: 'imitative:compare', labelKey: 'imitativeWriting.ai.compare', icon: GitCompare, defaultPromptTemplate: '请对原文和仿写内容进行多维度对比评析，从修辞密度、意象丰富度、结构完整度、语言流畅度、风格贴合度五个维度进行评分（百分制）：\n\n【原文】\n{{source}}\n\n【仿写】\n{{content}}' },
  ],
};
