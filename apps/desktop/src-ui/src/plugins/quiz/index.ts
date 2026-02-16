import { ClipboardList } from 'lucide-react';
import type { DocumentPlugin } from '../types';
import { registerPluginI18n } from '../i18n-loader';
import { registerPlugin } from '../pluginStore';
import { QuizPluginPanel } from './QuizPluginPanel';
import manifest from './manifest.json';
import zh from './i18n/zh.json';
import en from './i18n/en.json';
import ja from './i18n/ja.json';

registerPluginI18n('plugin-quiz', { zh, en, ja });

export const quizPlugin: DocumentPlugin = {
  id: manifest.id,
  name: '生成测试题',
  icon: ClipboardList,
  description: '根据文档内容 AI 生成单选、多选、判断题',
  i18nNamespace: 'plugin-quiz',
  PanelComponent: QuizPluginPanel,
  hasData: (doc) => {
    const data = doc.pluginData?.[manifest.id];
    return data != null && typeof data === 'object' && 'questions' in (data as Record<string, unknown>);
  },
  toFragments: (pluginData) => {
    const d = pluginData as { title?: string; questions?: { id: number; type: string; question: string; options: string[]; answer: string[]; explanation: string; score: number }[] } | null;
    if (!d?.questions?.length) return [];
    const typeLabel: Record<string, string> = { single: '单选', multiple: '多选', truefalse: '判断' };
    const lines = d.questions.map((q, i) => {
      let md = `**${i + 1}. （${typeLabel[q.type] || q.type}，${q.score}分）** ${q.question}`;
      md += '\n' + q.options.map((o, j) => `   ${String.fromCharCode(65 + j)}. ${o}`).join('\n');
      md += `\n   **答案：** ${q.answer.join(', ')}  `;
      if (q.explanation) md += `**解析：** ${q.explanation}`;
      return md;
    });
    return [{ title: d.title || '测试题', markdown: `# ${d.title || '测试题'}\n\n` + lines.join('\n\n') }];
  },
};

registerPlugin(quizPlugin);
