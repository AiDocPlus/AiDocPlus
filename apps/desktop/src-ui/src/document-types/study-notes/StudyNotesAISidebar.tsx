/**
 * StudyNotesAISidebar — 学习体会专属 AI 侧栏
 *
 * 基于 DocTypeAIChatBase，增加学习体会专属快捷操作：
 * - 提炼要点、扩展解读、反思问题、知识关联、生成总结
 * - AI 回复使用 Markdown 渲染
 * - 支持联网搜索 / 深度思考开关
 */
import { useCallback } from 'react';
import { BookOpenCheck, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, EMPTY_STATE_CLASS, EMPTY_STATE_ICON, MSG_ACTION_BTN } from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';

const SYSTEM_PROMPT = '你是一位学习辅导助手。帮助用户深入理解学习材料，撰写有深度的学习体会文章。回答时注重理论联系实际，鼓励批判性思考，引导用户形成自己的观点。';

export default function StudyNotesAISidebar({ document: doc, host }: DocTypeAISidebarProps) {
  const { t } = useTranslation();

  const getContent = useCallback(() => host.doc.getDocument().content || '', [host.doc]);

  const fire = useCallback((label: string, prompt: string) => {
    const content = getContent();
    if (!content.trim()) return;
    sendDocTypeAIMessage({
      documentId: doc.id,
      message: prompt.replace(/\{\{content\}\}/g, content.slice(-3000)),
      label,
    });
  }, [doc.id, getContent]);

  const handleInsert = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('doctype-insert-text', { detail: { documentId: doc.id, text } }));
  }, [doc.id]);

  return (
    <DocTypeAIChatBase
      host={host}
      document={doc}
      systemPrompt={SYSTEM_PROMPT}
      placeholder={t('studyNotes.inputPlaceholder', { defaultValue: '输入问题或指令...' })}
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('studyNotes.extractPoints', { defaultValue: '提炼要点' }), '请从以下学习材料中提炼核心要点（5-8条），每条用简洁的语言概括：\n\n{{content}}')}>
            {t('studyNotes.extractPoints', { defaultValue: '提炼要点' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('studyNotes.expandInsight', { defaultValue: '扩展解读' }), '请对以下体会进行深入扩展解读，结合理论背景和实际意义：\n\n{{content}}')}>
            {t('studyNotes.expandInsight', { defaultValue: '扩展解读' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('studyNotes.reflect', { defaultValue: '反思问题' }), '请基于以下学习内容，从批判性思维角度提出3-5个反思问题，帮助深入理解：\n\n{{content}}')}>
            {t('studyNotes.reflect', { defaultValue: '反思问题' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('studyNotes.relate', { defaultValue: '知识关联' }), '请分析以下内容与其他相关理论/观点的关联，找出知识点之间的联系：\n\n{{content}}')}>
            {t('studyNotes.relate', { defaultValue: '知识关联' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('studyNotes.summarize', { defaultValue: '生成总结' }), '请为以下学习体会生成一段精炼的总结（200-300字），提炼核心观点和个人收获：\n\n{{content}}')}>
            {t('studyNotes.summarize', { defaultValue: '生成总结' })}
          </Button>
        </div>
      }
      emptyStateSlot={
        <div className={EMPTY_STATE_CLASS}>
          <BookOpenCheck className={EMPTY_STATE_ICON} />
          <p>{t('studyNotes.aiHint', { defaultValue: '学习体会 AI 助手' })}</p>
          <p className="text-[11px]">{t('studyNotes.aiHintDesc', { defaultValue: '提炼要点、扩展解读、反思问题' })}</p>
        </div>
      }
      messageActions={(msg: DocTypeChatMsg) => (
        <button className={MSG_ACTION_BTN} onClick={() => handleInsert(msg.content)}>
          <ArrowDownToLine className="h-3 w-3" />
          {t('novelWorkspace.insertToDoc', { defaultValue: '插入到正文' })}
        </button>
      )}
    />
  );
}
