/**
 * 注册所有内置文档类型
 * 在程序启动时调用一次
 */
import { registerDocType } from '@/doctype-sdk/registry';
import { normalDocType } from './normal/definition';
import { studyNotesDocType } from './study-notes/definition';
import { novelDocType } from './novel/definition';
import { translationDocType } from './translation/definition';
import { diaryDocType } from './diary/definition';
import { essayDocType } from './essay/definition';
import { stockResearchDocType } from './stock-research/definition';
import { imitativeWritingDocType } from './imitative-writing/definition';
import { calculatorDocType } from './calculator/definition';
import { taskListDocType } from './task-list/definition';
import { outlineDocType } from './outline/definition';

export function registerBuiltinDocTypes(): void {
  registerDocType(normalDocType);
  registerDocType(studyNotesDocType);
  registerDocType(novelDocType);
  registerDocType(translationDocType);
  registerDocType(diaryDocType);
  registerDocType(essayDocType);
  registerDocType(stockResearchDocType);
  registerDocType(imitativeWritingDocType);
  registerDocType(calculatorDocType);
  registerDocType(taskListDocType);
  registerDocType(outlineDocType);
}
