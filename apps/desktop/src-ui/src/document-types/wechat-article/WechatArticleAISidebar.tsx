/**
 * WechatArticleAISidebar — 公众号文章专属 AI 侧栏
 *
 * 基于 DocTypeAIChatBase，增加：
 * - 标题优化（生成5个备选）、生成摘要、润色文风、生成开头 hook、SEO 关键词
 */
import { useCallback } from 'react';
import { Newspaper, Sparkles, FileText, Zap, Search, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, QUICK_ACTION_ICON, EMPTY_STATE_CLASS, EMPTY_STATE_ICON, MSG_ACTION_BTN } from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';

const SYSTEM_PROMPT = '你是专业的公众号文章写作助手。擅长撰写吸引眼球的标题、生动的开头、有节奏感的正文。注重排版美观、阅读体验和传播性。';

export default function WechatArticleAISidebar({ document: doc, host }: DocTypeAISidebarProps) {
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
      placeholder={t('wechat.aiPlaceholder', { defaultValue: '输入公众号文章相关问题...' })}
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('wechat.titleOptimize', { defaultValue: '优化标题' }), '请为以下文章提供5个吸引眼球的标题方案，每个标题附简要说明为何有吸引力：\n\n{{content}}')}>
            <Newspaper className={QUICK_ACTION_ICON} />
            {t('wechat.titleOptimize', { defaultValue: '优化标题' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('wechat.summary', { defaultValue: '生成摘要' }), '请为以下公众号文章生成一段吸引读者的摘要（50-100字），适合在朋友圈分享：\n\n{{content}}')}>
            <FileText className={QUICK_ACTION_ICON} />
            {t('wechat.summary', { defaultValue: '生成摘要' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('wechat.polish', { defaultValue: '润色文风' }), '请润色以下公众号文章，使其更加生动有趣、有传播性，保持段落清晰：\n\n{{content}}')}>
            <Sparkles className={QUICK_ACTION_ICON} />
            {t('wechat.polish', { defaultValue: '润色文风' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('wechat.hook', { defaultValue: '开头 Hook' }), '请为以下文章生成3个引人入胜的开头段落（Hook），让读者忍不住继续阅读：\n\n{{content}}')}>
            <Zap className={QUICK_ACTION_ICON} />
            {t('wechat.hook', { defaultValue: '开头 Hook' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('wechat.seo', { defaultValue: 'SEO 关键词' }), '请分析以下文章内容，建议5-8个SEO关键词和标签，适合公众号搜索优化：\n\n{{content}}')}>
            <Search className={QUICK_ACTION_ICON} />
            {t('wechat.seo', { defaultValue: 'SEO 关键词' })}
          </Button>
        </div>
      }
      emptyStateSlot={
        <div className={EMPTY_STATE_CLASS}>
          <Newspaper className={EMPTY_STATE_ICON} />
          <p>{t('wechat.aiHint', { defaultValue: '公众号文章 AI 助手' })}</p>
          <p className="text-[11px]">{t('wechat.aiHintDesc', { defaultValue: '标题优化、摘要生成、文风润色' })}</p>
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
