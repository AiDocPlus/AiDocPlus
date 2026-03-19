/**
 * OfficialDocAISidebar — 公文写作专属 AI 侧栏
 *
 * 基于 DocTypeAIChatBase，增加公文专属快捷操作：
 * - 格式检查、润色公文、生成批复、要点提取、格式修正
 */
import { useCallback } from 'react';
import { FileCheck, Sparkles, FileOutput, ListChecks, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArrowDownToLine } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, QUICK_ACTION_ICON, EMPTY_STATE_CLASS, EMPTY_STATE_ICON, MSG_ACTION_BTN } from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';

const SYSTEM_PROMPT = '你是专业的公文写作助手。严格遵循公文格式规范，用语准确、简洁、庄重。熟悉常用公文种类：通知、报告、请示、批复、函、纪要等。';

export default function OfficialDocAISidebar({ document: doc, host }: DocTypeAISidebarProps) {
  const { t } = useTranslation();

  const getContent = useCallback(() => {
    return host.doc.getDocument().content || '';
  }, [host.doc]);

  const handleAction = useCallback((_action: string, label: string, prompt: string) => {
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
      placeholder={t('officialDoc.aiPlaceholder', { defaultValue: '输入公文写作相关问题...' })}
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => handleAction('format-check', t('officialDoc.formatCheck', { defaultValue: '格式检查' }), '请检查以下公文的格式规范性，指出不符合公文写作规范的地方并给出修改建议：\n\n{{content}}')}>
            <FileCheck className={QUICK_ACTION_ICON} />
            {t('officialDoc.formatCheck', { defaultValue: '格式检查' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => handleAction('polish', t('officialDoc.polish', { defaultValue: '润色公文' }), '请润色以下公文，使用语更加规范、准确、庄重，保持公文格式不变：\n\n{{content}}')}>
            <Sparkles className={QUICK_ACTION_ICON} />
            {t('officialDoc.polish', { defaultValue: '润色公文' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => handleAction('reply', t('officialDoc.generateReply', { defaultValue: '生成批复' }), '请根据以下公文内容，生成对应的回复/批复文稿，格式规范：\n\n{{content}}')}>
            <FileOutput className={QUICK_ACTION_ICON} />
            {t('officialDoc.generateReply', { defaultValue: '生成批复' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => handleAction('extract', t('officialDoc.extractPoints', { defaultValue: '要点提取' }), '请从以下公文中提取核心要点，按条列出：\n\n{{content}}')}>
            <ListChecks className={QUICK_ACTION_ICON} />
            {t('officialDoc.extractPoints', { defaultValue: '要点提取' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => handleAction('fix', t('officialDoc.autoFix', { defaultValue: '格式修正' }), '请将以下内容修正为规范的公文格式，包括标题、正文、落款等：\n\n{{content}}')}>
            <Wrench className={QUICK_ACTION_ICON} />
            {t('officialDoc.autoFix', { defaultValue: '格式修正' })}
          </Button>
        </div>
      }
      emptyStateSlot={
        <div className={EMPTY_STATE_CLASS}>
          <FileCheck className={EMPTY_STATE_ICON} />
          <p>{t('officialDoc.aiHint', { defaultValue: '公文写作 AI 助手' })}</p>
          <p className="text-[11px]">{t('officialDoc.aiHintDesc', { defaultValue: '格式检查、润色公文、生成批复' })}</p>
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
