/**
 * 注册所有内置文档类型的 Skills
 * 在程序启动时调用一次（紧跟 registerBuiltinDocTypes 之后）
 */
import { registerSkills, type DocTypeSkill } from './skills';

// ── 通用文档 Skills ──
const normalSkills: DocTypeSkill[] = [
  {
    id: 'normal:rewrite',
    docTypeId: 'normal',
    labelKey: 'skill.rewrite',
    descriptionKey: 'skill.rewriteDesc',
    defaultPromptTemplate: '请改写以下文本，换一种表达方式，保持原意不变：\n\n{{content}}',
    defaultSystemPrompt: '你是专业的文字编辑助手。改写时保持原文含义，提升表达质量。',
  },
  {
    id: 'normal:polish',
    docTypeId: 'normal',
    labelKey: 'skill.polish',
    descriptionKey: 'skill.polishDesc',
    defaultPromptTemplate: '请对以下文本进行语言润色，提升文学性和可读性，修正语病：\n\n{{content}}',
    defaultSystemPrompt: '你是专业的文字润色助手。润色时保持原文含义，提升语言质量。',
  },
  {
    id: 'normal:summarize',
    docTypeId: 'normal',
    labelKey: 'skill.summarize',
    descriptionKey: 'skill.summarizeDesc',
    defaultPromptTemplate: '请为以下文本生成一段精炼的摘要（200-300字）：\n\n{{content}}',
  },
  {
    id: 'normal:expand',
    docTypeId: 'normal',
    labelKey: 'skill.expand',
    descriptionKey: 'skill.expandDesc',
    defaultPromptTemplate: '请对以下文本进行扩写，增加细节和论述，使内容更加丰满：\n\n{{content}}',
  },
  {
    id: 'normal:translate-zh-en',
    docTypeId: 'normal',
    labelKey: 'skill.translateZhEn',
    descriptionKey: 'skill.translateZhEnDesc',
    defaultPromptTemplate: '请将以下中文翻译为英文，注重信、达、雅：\n\n{{content}}',
    defaultSystemPrompt: '你是专业的中英翻译助手。',
  },
  {
    id: 'normal:translate-en-zh',
    docTypeId: 'normal',
    labelKey: 'skill.translateEnZh',
    descriptionKey: 'skill.translateEnZhDesc',
    defaultPromptTemplate: '请将以下英文翻译为中文，语言通顺自然：\n\n{{content}}',
    defaultSystemPrompt: '你是专业的英中翻译助手。',
  },
];

// ── 小说 Skills ──
const novelSkills: DocTypeSkill[] = [
  {
    id: 'novel:continue',
    docTypeId: 'novel',
    labelKey: 'novel.actionContinue',
    descriptionKey: 'skill.novelContinueDesc',
    defaultPromptTemplate: '请续写以下小说正文，保持风格和节奏一致，直接输出续写内容：\n\n{{content}}',
    defaultSystemPrompt: '你是一位专业的小说写作助手。保持文风一致，情节连贯，人物性格稳定。直接输出续写内容，不要添加额外说明。',
  },
  {
    id: 'novel:expand',
    docTypeId: 'novel',
    labelKey: 'novel.actionExpand',
    descriptionKey: 'skill.novelExpandDesc',
    defaultPromptTemplate: '请对以下文本进行扩写，增加细节描写、心理活动或环境描写：\n\n{{content}}',
    defaultSystemPrompt: '你是一位专业的小说写作助手。',
  },
  {
    id: 'novel:polish',
    docTypeId: 'novel',
    labelKey: 'novel.actionPolish',
    descriptionKey: 'skill.novelPolishDesc',
    defaultPromptTemplate: '请对以下小说文本进行语言润色，提升文学性：\n\n{{content}}',
    defaultSystemPrompt: '你是一位专业的小说写作助手。',
  },
];

// ── 学习体会 Skills ──
const studyNotesSkills: DocTypeSkill[] = [
  {
    id: 'study:extract-points',
    docTypeId: 'study-notes',
    labelKey: 'studyNotes.extractPoints',
    descriptionKey: 'skill.studyExtractDesc',
    defaultPromptTemplate: '请从以下学习材料中提炼核心要点（5-8条），每条用简洁的语言概括：\n\n{{content}}',
    defaultSystemPrompt: '你是一位学习辅导助手。帮助用户深入理解学习材料。',
  },
  {
    id: 'study:expand-insight',
    docTypeId: 'study-notes',
    labelKey: 'studyNotes.expandInsight',
    descriptionKey: 'skill.studyExpandDesc',
    defaultPromptTemplate: '请对以下体会进行深入扩展解读，结合理论背景和实际意义：\n\n{{content}}',
    defaultSystemPrompt: '你是一位学习辅导助手。回答时注重理论联系实际。',
  },
  {
    id: 'study:reflect',
    docTypeId: 'study-notes',
    labelKey: 'studyNotes.reflect',
    descriptionKey: 'skill.studyReflectDesc',
    defaultPromptTemplate: '请基于以下学习内容，从批判性思维角度提出3-5个反思问题：\n\n{{content}}',
    defaultSystemPrompt: '你是一位学习辅导助手。鼓励批判性思考。',
  },
  {
    id: 'study:summarize',
    docTypeId: 'study-notes',
    labelKey: 'studyNotes.summarize',
    descriptionKey: 'skill.studySummarizeDesc',
    defaultPromptTemplate: '请为以下学习体会生成一段精炼的总结（200-300字）：\n\n{{content}}',
  },
];

// ── 翻译 Skills ──
const translationSkills: DocTypeSkill[] = [
  {
    id: 'translation:translate',
    docTypeId: 'translation',
    labelKey: 'translation.translate',
    descriptionKey: 'skill.translationTranslateDesc',
    defaultPromptTemplate: '请翻译以下段落，注重信、达、雅：\n\n{{content}}',
    defaultSystemPrompt: '你是专业的中英文翻译助手。翻译时注重信、达、雅，保持术语一致性。只输出译文。',
  },
  {
    id: 'translation:polish',
    docTypeId: 'translation',
    labelKey: 'translation.polish',
    descriptionKey: 'skill.translationPolishDesc',
    defaultPromptTemplate: '请润色以下译文，使其更加通顺自然：\n\n{{content}}',
    defaultSystemPrompt: '你是专业的翻译润色助手。',
  },
  {
    id: 'translation:alternative',
    docTypeId: 'translation',
    labelKey: 'translation.alternative',
    descriptionKey: 'skill.translationAlternativeDesc',
    defaultPromptTemplate: '请提供以下译文的另一种翻译方案：\n\n{{content}}',
    defaultSystemPrompt: '你是专业的翻译助手。提供不同风格的翻译供选择。',
  },
];

/**
 * 注册所有内置 Skills
 */
export function registerBuiltinSkills(): void {
  registerSkills([
    ...normalSkills,
    ...novelSkills,
    ...studyNotesSkills,
    ...translationSkills,
  ]);
}
