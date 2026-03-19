/**
 * AI Skills 注册表 + 执行引擎
 *
 * 每种文档类型声明自己的专属 Skills（原子 AI 能力），
 * 统一注册到此引擎，供 UI 按钮、Workflow、Agent 调用。
 */
import type { DocTypeHostAPI } from '@/doctype-sdk/types';

// ============================================================
// Skill 类型定义
// ============================================================

export interface SkillParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'selection';
  required: boolean;
  description: string;
  options?: string[];
}

export interface SkillResult {
  content: string;
  metadata?: Record<string, unknown>;
}

export interface DocTypeSkill {
  /** 唯一 ID，格式：docTypeId:action，如 'novel:continue' */
  id: string;
  /** 所属文档类型 ID */
  docTypeId: string;
  /** 显示名称 i18n key */
  labelKey: string;
  /** 描述（供 Agent 理解能力） */
  descriptionKey: string;
  /**
   * AI 提示词模板（默认值，用户可在提示词管理中覆盖）。
   * 支持 {{content}} / {{selection}} / {{title}} 等占位符。
   */
  defaultPromptTemplate: string;
  /** 系统提示词（默认值），用户可修改 */
  defaultSystemPrompt?: string;
  /** 输入参数声明 */
  parameters?: SkillParameter[];
  /** 输出类型 */
  outputType?: 'text' | 'json' | 'markdown';
}

// ============================================================
// Skills 注册表
// ============================================================

const skillRegistry = new Map<string, DocTypeSkill>();

export function registerSkill(skill: DocTypeSkill): void {
  skillRegistry.set(skill.id, skill);
}

export function registerSkills(skills: DocTypeSkill[]): void {
  for (const skill of skills) {
    skillRegistry.set(skill.id, skill);
  }
}

export function getSkill(id: string): DocTypeSkill | undefined {
  return skillRegistry.get(id);
}

export function listSkills(docTypeId?: string): DocTypeSkill[] {
  const all = Array.from(skillRegistry.values());
  if (docTypeId) return all.filter(s => s.docTypeId === docTypeId);
  return all;
}

export function unregisterSkill(id: string): boolean {
  return skillRegistry.delete(id);
}

// ============================================================
// 提示词模板渲染
// ============================================================

/**
 * 渲染提示词模板，将 {{变量}} 替换为实际值
 */
export function renderPromptTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

// ============================================================
// Skill 执行引擎
// ============================================================

export interface ExecuteSkillOptions {
  /** Skill ID */
  skillId: string;
  /** 宿主 API */
  host: DocTypeHostAPI;
  /** 模板变量（content/selection/title 等） */
  variables?: Record<string, string>;
  /** 额外参数 */
  params?: Record<string, unknown>;
  /** 用户自定义 prompt（覆盖默认） */
  userPromptOverride?: string;
  /** 用户自定义系统提示词（覆盖默认） */
  userSystemPromptOverride?: string;
}

/**
 * 执行一个 Skill
 * 1. 从注册表获取 Skill 定义
 * 2. 从 PromptStore 获取 prompt（优先用户自定义）
 * 3. 渲染模板
 * 4. 调用 AI
 * 5. 返回结果
 */
export async function executeSkill(opts: ExecuteSkillOptions): Promise<SkillResult> {
  const { skillId, host, variables = {}, userPromptOverride, userSystemPromptOverride } = opts;

  const skill = skillRegistry.get(skillId);
  if (!skill) {
    throw new Error(`Skill "${skillId}" not found`);
  }

  // 获取 prompt（优先用户覆盖 → PromptStore 覆盖 → 默认值）
  const promptTemplate = userPromptOverride || skill.defaultPromptTemplate;
  const systemPrompt = userSystemPromptOverride || skill.defaultSystemPrompt || '';

  // 渲染模板
  const renderedPrompt = renderPromptTemplate(promptTemplate, variables);

  // 调用 AI
  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    { role: 'user', content: renderedPrompt },
  ];

  const result = await host.ai.chat(messages);

  return {
    content: result,
    metadata: { skillId, docTypeId: skill.docTypeId },
  };
}

/**
 * 流式执行 Skill
 */
export async function executeSkillStream(
  opts: ExecuteSkillOptions,
  onChunk: (text: string) => void,
): Promise<SkillResult> {
  const { skillId, host, variables = {}, userPromptOverride, userSystemPromptOverride } = opts;

  const skill = skillRegistry.get(skillId);
  if (!skill) {
    throw new Error(`Skill "${skillId}" not found`);
  }

  const promptTemplate = userPromptOverride || skill.defaultPromptTemplate;
  const systemPrompt = userSystemPromptOverride || skill.defaultSystemPrompt || '';
  const renderedPrompt = renderPromptTemplate(promptTemplate, variables);

  const messages = [
    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
    { role: 'user', content: renderedPrompt },
  ];

  const result = await host.ai.chatStream(messages, onChunk);

  return {
    content: result,
    metadata: { skillId, docTypeId: skill.docTypeId },
  };
}
