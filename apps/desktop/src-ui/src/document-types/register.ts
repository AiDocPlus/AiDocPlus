/**
 * 注册所有内置文档类型
 * 在程序启动时调用一次
 */
import { registerDocType } from '@/doctype-sdk/registry';
import { normalDocType } from './normal/definition';
import { studyNotesDocType } from './study-notes/definition';
import { novelDocType } from './novel/definition';
import { translationDocType } from './translation/definition';
import { officialDocType } from './official-doc/definition';
import { wechatArticleDocType } from './wechat-article/definition';
import { businessPlanDocType } from './business-plan/definition';
import { meetingMinutesDocType } from './meeting-minutes/definition';
import { academicPaperDocType } from './academic-paper/definition';
import { screenplayDocType } from './screenplay/definition';
import { diaryDocType } from './diary/definition';
import { essayDocType } from './essay/definition';
import { stockResearchDocType } from './stock-research/definition';

export function registerBuiltinDocTypes(): void {
  registerDocType(normalDocType);
  registerDocType(studyNotesDocType);
  registerDocType(novelDocType);
  registerDocType(translationDocType);
  registerDocType(officialDocType);
  registerDocType(wechatArticleDocType);
  registerDocType(businessPlanDocType);
  registerDocType(meetingMinutesDocType);
  registerDocType(academicPaperDocType);
  registerDocType(screenplayDocType);
  registerDocType(diaryDocType);
  registerDocType(essayDocType);
  registerDocType(stockResearchDocType);
}
