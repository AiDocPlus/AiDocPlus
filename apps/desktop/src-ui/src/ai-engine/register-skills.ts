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

// ── 公文写作 Skills ──
const officialDocSkills: DocTypeSkill[] = [
  { id: 'official:format-check', docTypeId: 'official-doc', labelKey: 'officialDoc.formatCheck', descriptionKey: 'skill.officialFormatDesc', defaultPromptTemplate: '请检查以下公文的格式规范性：\n\n{{content}}', defaultSystemPrompt: '你是公文格式审查专家。' },
  { id: 'official:polish', docTypeId: 'official-doc', labelKey: 'officialDoc.polish', descriptionKey: 'skill.officialPolishDesc', defaultPromptTemplate: '请润色以下公文：\n\n{{content}}', defaultSystemPrompt: '你是公文写作专家。' },
  { id: 'official:generate-reply', docTypeId: 'official-doc', labelKey: 'officialDoc.generateReply', descriptionKey: 'skill.officialReplyDesc', defaultPromptTemplate: '请生成回复/批复文稿：\n\n{{content}}' },
];

// ── 公众号文章 Skills ──
const wechatSkills: DocTypeSkill[] = [
  { id: 'wechat:title-optimize', docTypeId: 'wechat-article', labelKey: 'wechat.titleOptimize', descriptionKey: 'skill.wechatTitleDesc', defaultPromptTemplate: '请提供5个吸引眼球的标题：\n\n{{content}}' },
  { id: 'wechat:summary', docTypeId: 'wechat-article', labelKey: 'wechat.summary', descriptionKey: 'skill.wechatSummaryDesc', defaultPromptTemplate: '请生成摘要（50-100字）：\n\n{{content}}' },
  { id: 'wechat:polish', docTypeId: 'wechat-article', labelKey: 'wechat.polish', descriptionKey: 'skill.wechatPolishDesc', defaultPromptTemplate: '请润色文章使其更有传播性：\n\n{{content}}' },
];

// ── 商业计划书 Skills ──
const businessPlanSkills: DocTypeSkill[] = [
  { id: 'bplan:market-analysis', docTypeId: 'business-plan', labelKey: 'businessPlan.marketAnalysis', descriptionKey: 'skill.bplanMarketDesc', defaultPromptTemplate: '请生成市场分析：\n\n{{content}}' },
  { id: 'bplan:swot', docTypeId: 'business-plan', labelKey: 'businessPlan.swot', descriptionKey: 'skill.bplanSwotDesc', defaultPromptTemplate: '请生成SWOT分析：\n\n{{content}}' },
  { id: 'bplan:financial', docTypeId: 'business-plan', labelKey: 'businessPlan.financial', descriptionKey: 'skill.bplanFinancialDesc', defaultPromptTemplate: '请生成3年财务预测：\n\n{{content}}' },
];

// ── 会议纪要 Skills ──
const meetingSkills: DocTypeSkill[] = [
  { id: 'meeting:extract-actions', docTypeId: 'meeting-minutes', labelKey: 'meeting.extractActions', descriptionKey: 'skill.meetingActionsDesc', defaultPromptTemplate: '请提取行动项：\n\n{{content}}' },
  { id: 'meeting:summarize', docTypeId: 'meeting-minutes', labelKey: 'meeting.summarize', descriptionKey: 'skill.meetingSummaryDesc', defaultPromptTemplate: '请生成会议摘要：\n\n{{content}}' },
  { id: 'meeting:format', docTypeId: 'meeting-minutes', labelKey: 'meeting.format', descriptionKey: 'skill.meetingFormatDesc', defaultPromptTemplate: '请整理为规范纪要格式：\n\n{{content}}' },
];

// ── 学术论文 Skills ──
const academicSkills: DocTypeSkill[] = [
  { id: 'academic:literature-review', docTypeId: 'academic-paper', labelKey: 'academic.literatureReview', descriptionKey: 'skill.academicLitDesc', defaultPromptTemplate: '请生成文献综述框架：\n\n{{content}}' },
  { id: 'academic:abstract', docTypeId: 'academic-paper', labelKey: 'academic.abstract', descriptionKey: 'skill.academicAbstractDesc', defaultPromptTemplate: '请生成学术摘要：\n\n{{content}}' },
  { id: 'academic:polish', docTypeId: 'academic-paper', labelKey: 'academic.polish', descriptionKey: 'skill.academicPolishDesc', defaultPromptTemplate: '请润色学术文本：\n\n{{content}}' },
];

// ── 电影剧本 Skills ──
const screenplaySkills: DocTypeSkill[] = [
  { id: 'screenplay:dialogue', docTypeId: 'screenplay', labelKey: 'screenplay.dialogue', descriptionKey: 'skill.screenplayDialogueDesc', defaultPromptTemplate: '请生成角色对白：\n\n{{content}}' },
  { id: 'screenplay:scene-desc', docTypeId: 'screenplay', labelKey: 'screenplay.sceneDesc', descriptionKey: 'skill.screenplaySceneDesc', defaultPromptTemplate: '请补充场景描述：\n\n{{content}}' },
  { id: 'screenplay:continue', docTypeId: 'screenplay', labelKey: 'screenplay.continue', descriptionKey: 'skill.screenplayContinueDesc', defaultPromptTemplate: '请续写剧本场景：\n\n{{content}}' },
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
    ...officialDocSkills,
    ...wechatSkills,
    ...businessPlanSkills,
    ...meetingSkills,
    ...academicSkills,
    ...screenplaySkills,
  ]);
}
