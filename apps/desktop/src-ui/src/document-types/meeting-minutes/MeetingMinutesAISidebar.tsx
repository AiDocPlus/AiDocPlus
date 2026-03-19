/**
 * MeetingMinutesAISidebar — 会议纪要专属 AI 侧栏
 *
 * 基于 DocTypeAIChatBase，增加：
 * - 提取行动项、生成会议摘要、格式规范化、生成会后邮件、整理会议记录
 */
import { useCallback } from 'react';
import { ClipboardList, FileText, Sparkles, Mail, ListChecks, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, QUICK_ACTION_ICON, EMPTY_STATE_CLASS, EMPTY_STATE_ICON, MSG_ACTION_BTN } from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';

const SYSTEM_PROMPT = '你是专业的会议纪要助手。擅长提炼会议要点、整理行动项、梳理决议事项。语言简洁明确，条理清晰。';

export default function MeetingMinutesAISidebar({ document: doc, host }: DocTypeAISidebarProps) {
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
      placeholder={t('meeting.aiPlaceholder', { defaultValue: '输入会议纪要相关问题...' })}
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('meeting.extractActions', { defaultValue: '提取行动项' }), '请从以下会议内容中提取所有行动项，整理为表格格式（序号、事项、负责人、截止日期、状态）：\n\n{{content}}')}>
            <ListChecks className={QUICK_ACTION_ICON} />
            {t('meeting.extractActions', { defaultValue: '提取行动项' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('meeting.summarize', { defaultValue: '会议摘要' }), '请为以下会议纪要生成简洁的会议摘要（200字以内），包含：会议主题、关键讨论点、主要决议：\n\n{{content}}')}>
            <FileText className={QUICK_ACTION_ICON} />
            {t('meeting.summarize', { defaultValue: '会议摘要' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('meeting.format', { defaultValue: '格式规范化' }), '请将以下会议记录整理为规范的会议纪要格式，包含：会议信息头、议题、讨论内容、决议事项、行动项表格：\n\n{{content}}')}>
            <Sparkles className={QUICK_ACTION_ICON} />
            {t('meeting.format', { defaultValue: '格式规范化' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('meeting.email', { defaultValue: '会后邮件' }), '请根据以下会议纪要，生成一封会后跟进邮件，包含会议摘要、决议事项和行动项提醒：\n\n{{content}}')}>
            <Mail className={QUICK_ACTION_ICON} />
            {t('meeting.email', { defaultValue: '会后邮件' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('meeting.organize', { defaultValue: '整理记录' }), '请将以下粗糙的会议记录/速记稿整理为条理清晰的规范会议纪要，补充逻辑连接：\n\n{{content}}')}>
            <ClipboardList className={QUICK_ACTION_ICON} />
            {t('meeting.organize', { defaultValue: '整理记录' })}
          </Button>
        </div>
      }
      emptyStateSlot={
        <div className={EMPTY_STATE_CLASS}>
          <ClipboardList className={EMPTY_STATE_ICON} />
          <p>{t('meeting.aiHint', { defaultValue: '会议纪要 AI 助手' })}</p>
          <p className="text-[11px]">{t('meeting.aiHintDesc', { defaultValue: '行动项提取、会议摘要、格式规范化' })}</p>
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
