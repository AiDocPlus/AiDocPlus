/**
 * AcademicPaperAISidebar — 学术论文专属 AI 侧栏
 *
 * 基于 DocTypeAIChatBase，增加：
 * - 文献综述生成、摘要生成、学术润色、论点强化、逻辑分析
 */
import { useCallback } from 'react';
import { GraduationCap, FileText, Sparkles, Brain, GitBranch, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, QUICK_ACTION_ICON, EMPTY_STATE_CLASS, EMPTY_STATE_ICON, MSG_ACTION_BTN } from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';

const SYSTEM_PROMPT = '你是专业的学术论文写作助手。熟悉学术写作规范，擅长文献综述、论证逻辑、学术用语。回答时注重学术严谨性和引用规范。';

export default function AcademicPaperAISidebar({ document: doc, host }: DocTypeAISidebarProps) {
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
      placeholder={t('academic.aiPlaceholder', { defaultValue: '输入学术论文相关问题...' })}
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('academic.literatureReview', { defaultValue: '文献综述' }), '请根据以下研究主题，生成文献综述框架，包含关键研究方向、主要学者观点和研究空白：\n\n{{content}}')}>
            <GraduationCap className={QUICK_ACTION_ICON} />
            {t('academic.literatureReview', { defaultValue: '文献综述' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('academic.abstract', { defaultValue: '生成摘要' }), '请为以下论文生成学术摘要（200-300字），包含研究目的、方法、结果和结论：\n\n{{content}}')}>
            <FileText className={QUICK_ACTION_ICON} />
            {t('academic.abstract', { defaultValue: '生成摘要' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('academic.polish', { defaultValue: '学术润色' }), '请润色以下学术文本，将口语化表达替换为学术语言，使其更加严谨、规范：\n\n{{content}}')}>
            <Sparkles className={QUICK_ACTION_ICON} />
            {t('academic.polish', { defaultValue: '学术润色' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('academic.strengthen', { defaultValue: '论点强化' }), '请分析以下论述的论证逻辑，指出薄弱环节并提供强化建议：\n\n{{content}}')}>
            <Brain className={QUICK_ACTION_ICON} />
            {t('academic.strengthen', { defaultValue: '论点强化' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('academic.logic', { defaultValue: '逻辑分析' }), '请检查以下论文的论证逻辑链完整性，指出逻辑跳跃、论据不足或因果关系不清的地方：\n\n{{content}}')}>
            <GitBranch className={QUICK_ACTION_ICON} />
            {t('academic.logic', { defaultValue: '逻辑分析' })}
          </Button>
        </div>
      }
      emptyStateSlot={
        <div className={EMPTY_STATE_CLASS}>
          <GraduationCap className={EMPTY_STATE_ICON} />
          <p>{t('academic.aiHint', { defaultValue: '学术论文 AI 助手' })}</p>
          <p className="text-[11px]">{t('academic.aiHintDesc', { defaultValue: '文献综述、摘要生成、学术润色、论点强化' })}</p>
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
