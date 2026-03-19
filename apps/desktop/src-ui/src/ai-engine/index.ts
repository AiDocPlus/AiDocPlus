/**
 * AI Engine — 统一导出
 */

// Skills
export {
  registerSkill,
  registerSkills,
  getSkill,
  listSkills,
  unregisterSkill,
  renderPromptTemplate,
  executeSkill,
  executeSkillStream,
} from './skills';

export type {
  DocTypeSkill,
  SkillParameter,
  SkillResult,
  ExecuteSkillOptions,
} from './skills';

// Prompt Store
export {
  getPrompt,
  getEffectivePrompt,
  setUserPrompt,
  resetToDefault,
  resetSkillToDefault,
  listAllPrompts,
  hasUserOverride,
} from './prompt-store';

export type { PromptEntry } from './prompt-store';
