/**
 * PromptStore — 提示词管理
 *
 * 所有 AI 提示词用户可见可修改。
 * 默认值来自 Skill 定义，用户覆盖值存储在 localStorage。
 * 执行 Skill 前先查此 Store，优先使用用户自定义版本。
 */
import { listSkills, type DocTypeSkill } from './skills';

const STORAGE_KEY = 'aidocplus:prompt-overrides';

export interface PromptEntry {
  skillId: string;
  docTypeId: string;
  labelKey: string;
  /** 默认提示词模板 */
  defaultPrompt: string;
  /** 用户自定义提示词（undefined 表示使用默认） */
  userPrompt?: string;
  /** 默认系统提示词 */
  defaultSystemPrompt?: string;
  /** 用户自定义系统提示词 */
  userSystemPrompt?: string;
}

// 内存缓存
let overrides: Record<string, { prompt?: string; systemPrompt?: string }> = {};
let loaded = false;

function ensureLoaded(): void {
  if (loaded) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) overrides = JSON.parse(raw);
  } catch { /* ignore */ }
  loaded = true;
}

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch { /* ignore */ }
}

/**
 * 获取实际使用的 prompt（优先用户修改版，否则用默认值）
 */
export function getPrompt(skillId: string, field: 'prompt' | 'systemPrompt'): string | undefined {
  ensureLoaded();
  const override = overrides[skillId];
  if (override && override[field] !== undefined) {
    return override[field];
  }
  return undefined; // 调用方需回退到 Skill 默认值
}

/**
 * 获取 Skill 的有效提示词（用户覆盖 > 默认值）
 */
export function getEffectivePrompt(skill: DocTypeSkill): { prompt: string; systemPrompt: string } {
  ensureLoaded();
  const override = overrides[skill.id];
  return {
    prompt: override?.prompt ?? skill.defaultPromptTemplate,
    systemPrompt: override?.systemPrompt ?? skill.defaultSystemPrompt ?? '',
  };
}

/**
 * 用户自定义 prompt（覆盖默认值）
 */
export function setUserPrompt(skillId: string, field: 'prompt' | 'systemPrompt', value: string): void {
  ensureLoaded();
  if (!overrides[skillId]) overrides[skillId] = {};
  overrides[skillId][field] = value;
  persist();
}

/**
 * 重置为默认值
 */
export function resetToDefault(skillId: string, field: 'prompt' | 'systemPrompt'): void {
  ensureLoaded();
  if (overrides[skillId]) {
    delete overrides[skillId][field];
    if (Object.keys(overrides[skillId]).length === 0) {
      delete overrides[skillId];
    }
    persist();
  }
}

/**
 * 重置某个 Skill 的所有覆盖
 */
export function resetSkillToDefault(skillId: string): void {
  ensureLoaded();
  delete overrides[skillId];
  persist();
}

/**
 * 列出所有可编辑的 prompt（合并默认值 + 用户覆盖）
 */
export function listAllPrompts(docTypeId?: string): PromptEntry[] {
  ensureLoaded();
  const skills = listSkills(docTypeId);
  return skills.map(skill => {
    const override = overrides[skill.id];
    return {
      skillId: skill.id,
      docTypeId: skill.docTypeId,
      labelKey: skill.labelKey,
      defaultPrompt: skill.defaultPromptTemplate,
      userPrompt: override?.prompt,
      defaultSystemPrompt: skill.defaultSystemPrompt,
      userSystemPrompt: override?.systemPrompt,
    };
  });
}

/**
 * 检查某个 Skill 是否有用户覆盖
 */
export function hasUserOverride(skillId: string): boolean {
  ensureLoaded();
  return !!overrides[skillId] && Object.keys(overrides[skillId]).length > 0;
}
