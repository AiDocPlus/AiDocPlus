/**
 * ScreenplayAISidebar — 电影剧本专属 AI 侧栏
 *
 * 基于 DocTypeAIChatBase，增加：
 * - 生成对白、续写场景、场景描述、角色分析、冲突设计
 */
import { useCallback } from 'react';
import { Film, MessageSquare, Sparkles, Users, Swords, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, QUICK_ACTION_ICON, EMPTY_STATE_CLASS, EMPTY_STATE_ICON, MSG_ACTION_BTN } from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';

const SYSTEM_PROMPT = '你是专业的电影剧本写作助手。熟悉标准剧本格式（场景描述、角色对白、动作指示）。擅长构建戏剧冲突、塑造人物性格、推进情节发展。';

export default function ScreenplayAISidebar({ document: doc, host }: DocTypeAISidebarProps) {
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
      placeholder={t('screenplay.aiPlaceholder', { defaultValue: '输入剧本创作相关问题...' })}
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('screenplay.dialogue', { defaultValue: '生成对白' }), '请根据以下场景描述，生成角色对白（注意性格特征、情绪变化和潜台词），使用标准剧本格式：\n\n{{content}}')}>
            <MessageSquare className={QUICK_ACTION_ICON} />
            {t('screenplay.dialogue', { defaultValue: '生成对白' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('screenplay.continue', { defaultValue: '续写场景' }), '请续写以下剧本场景，推进情节发展，保持角色性格一致：\n\n{{content}}')}>
            <Film className={QUICK_ACTION_ICON} />
            {t('screenplay.continue', { defaultValue: '续写场景' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('screenplay.sceneDesc', { defaultValue: '场景描述' }), '请为以下场景补充详细的场景描述（环境、氛围、光线、声音、镜头语言）：\n\n{{content}}')}>
            <Sparkles className={QUICK_ACTION_ICON} />
            {t('screenplay.sceneDesc', { defaultValue: '场景描述' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('screenplay.characterAnalysis', { defaultValue: '角色分析' }), '请分析以下剧本中出现的角色，为每个角色列出：性格特征、动机、与其他角色的关系、发展弧线：\n\n{{content}}')}>
            <Users className={QUICK_ACTION_ICON} />
            {t('screenplay.characterAnalysis', { defaultValue: '角色分析' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('screenplay.conflict', { defaultValue: '冲突设计' }), '请根据以下剧本内容，设计戏剧冲突点（内在冲突、人物冲突、环境冲突），推动情节高潮：\n\n{{content}}')}>
            <Swords className={QUICK_ACTION_ICON} />
            {t('screenplay.conflict', { defaultValue: '冲突设计' })}
          </Button>
        </div>
      }
      emptyStateSlot={
        <div className={EMPTY_STATE_CLASS}>
          <Film className={EMPTY_STATE_ICON} />
          <p>{t('screenplay.aiHint', { defaultValue: '电影剧本 AI 助手' })}</p>
          <p className="text-[11px]">{t('screenplay.aiHintDesc', { defaultValue: '对白生成、场景续写、角色分析、冲突设计' })}</p>
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
