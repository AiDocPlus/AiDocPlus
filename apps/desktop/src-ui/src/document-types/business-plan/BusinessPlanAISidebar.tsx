/**
 * BusinessPlanAISidebar — 商业计划书专属 AI 侧栏
 *
 * 基于 DocTypeAIChatBase，增加：
 * - 市场分析、SWOT、财务预测、竞品分析、电梯演讲稿
 */
import { useCallback } from 'react';
import { BarChart3, Target, TrendingUp, Users, Presentation, ArrowDownToLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import type { DocTypeAISidebarProps } from '@/doctype-sdk/types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '../_shared/DocTypeAIChatBase';
import { QUICK_ACTION_BAR, QUICK_ACTION_BTN, QUICK_ACTION_ICON, EMPTY_STATE_CLASS, EMPTY_STATE_ICON, MSG_ACTION_BTN } from '../_shared/styles';
import type { DocTypeChatMsg } from '../_shared/DocTypeChatMessage';

const SYSTEM_PROMPT = '你是专业的商业计划书写作顾问。擅长市场分析、商业模式设计、财务预测。回答时注重数据支撑和逻辑严密。';

export default function BusinessPlanAISidebar({ document: doc, host }: DocTypeAISidebarProps) {
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
      placeholder={t('businessPlan.aiPlaceholder', { defaultValue: '输入商业计划相关问题...' })}
      headerSlot={
        <div className={QUICK_ACTION_BAR}>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('businessPlan.marketAnalysis', { defaultValue: '市场分析' }), '请根据以下项目描述，生成详细的市场分析（市场规模、增长趋势、竞争格局、目标用户画像）：\n\n{{content}}')}>
            <BarChart3 className={QUICK_ACTION_ICON} />
            {t('businessPlan.marketAnalysis', { defaultValue: '市场分析' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('businessPlan.swot', { defaultValue: 'SWOT 分析' }), '请根据以下商业计划内容，生成 SWOT 分析表格（优势、劣势、机会、威胁），每项至少3条：\n\n{{content}}')}>
            <Target className={QUICK_ACTION_ICON} />
            {t('businessPlan.swot', { defaultValue: 'SWOT 分析' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('businessPlan.financial', { defaultValue: '财务预测' }), '请根据以下商业计划，生成3年财务预测框架（收入模型、成本结构、盈亏平衡分析、关键假设）：\n\n{{content}}')}>
            <TrendingUp className={QUICK_ACTION_ICON} />
            {t('businessPlan.financial', { defaultValue: '财务预测' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('businessPlan.competitors', { defaultValue: '竞品分析' }), '请根据以下项目描述，分析可能的竞争对手，从产品功能、定价、市场份额、差异化等维度对比：\n\n{{content}}')}>
            <Users className={QUICK_ACTION_ICON} />
            {t('businessPlan.competitors', { defaultValue: '竞品分析' })}
          </Button>
          <Button variant="outline" size="sm" className={QUICK_ACTION_BTN}
            onClick={() => fire(t('businessPlan.pitch', { defaultValue: '电梯演讲' }), '请根据以下商业计划，生成一段30秒电梯演讲稿（Elevator Pitch），简明扼要地说明项目价值：\n\n{{content}}')}>
            <Presentation className={QUICK_ACTION_ICON} />
            {t('businessPlan.pitch', { defaultValue: '电梯演讲' })}
          </Button>
        </div>
      }
      emptyStateSlot={
        <div className={EMPTY_STATE_CLASS}>
          <BarChart3 className={EMPTY_STATE_ICON} />
          <p>{t('businessPlan.aiHint', { defaultValue: '商业计划书 AI 顾问' })}</p>
          <p className="text-[11px]">{t('businessPlan.aiHintDesc', { defaultValue: '市场分析、SWOT、财务预测、竞品分析' })}</p>
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
