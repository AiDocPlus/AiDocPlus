import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIMessage } from '@aidocplus/shared-types';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { useAppStore } from '@/stores/useAppStore';
import {
  estimateMessagesTokens,
  getModelContextWindow,
  formatTokenCount,
} from '@/lib/tokenEstimator';

const EMPTY_MESSAGES: AIMessage[] = [];

interface TokenUsageIndicatorProps {
  tabId: string;
}

export function TokenUsageIndicator({ tabId }: TokenUsageIndicatorProps) {
  const { t } = useTranslation();
  const aiMessages = useAppStore(s => s.aiMessagesByTab[tabId] ?? EMPTY_MESSAGES);
  const tabs = useAppStore(s => s.tabs);
  const documents = useAppStore(s => s.documents);
  const aiSettings = useSettingsStore(s => s.ai);

  const { usedTokens, contextWindow, percentage, level } = useMemo(() => {
    // 获取当前文档绑定的 AI 服务
    const currentTab = tabs.find(tab => tab.id === tabId);
    const currentDoc = currentTab
      ? documents.find(d => d.id === currentTab.documentId)
      : null;
    const aiParams = getAIInvokeParamsForService(currentDoc?.aiServiceId);

    // 计算上下文窗口
    const ctxWindow = aiSettings.maxContextTokens && aiSettings.maxContextTokens > 0
      ? aiSettings.maxContextTokens
      : getModelContextWindow(aiParams.model, aiParams.provider);

    // 估算当前消息的 token 数
    const messages = aiMessages.map((m: AIMessage) => ({
      role: m.role,
      content: m.content,
    }));
    const tokens = estimateMessagesTokens(messages);

    const pct = ctxWindow > 0 ? Math.min(100, Math.round((tokens / ctxWindow) * 100)) : 0;
    const lvl = pct >= 80 ? 'high' : pct >= 50 ? 'medium' : 'low';

    return { usedTokens: tokens, contextWindow: ctxWindow, percentage: pct, level: lvl };
  }, [aiMessages, tabs, documents, tabId, aiSettings.maxContextTokens]);

  // 无消息时不显示
  if (aiMessages.length === 0) return null;

  const colorMap = {
    low: 'text-muted-foreground',
    medium: 'text-amber-500 dark:text-amber-400',
    high: 'text-red-500 dark:text-red-400',
  };

  const barColorMap = {
    low: 'bg-emerald-500/60',
    medium: 'bg-amber-500/60',
    high: 'bg-red-500/60',
  };

  return (
    <div className="flex items-center gap-2 px-1">
      {/* 进度条 */}
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColorMap[level as keyof typeof barColorMap]}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      {/* 文字 */}
      <span className={`text-[10px] tabular-nums ${colorMap[level as keyof typeof colorMap]}`}>
        {t('chat.tokenUsage', {
          defaultValue: '~{{used}} / {{total}} tokens',
          used: formatTokenCount(usedTokens),
          total: formatTokenCount(contextWindow),
        })}
      </span>
    </div>
  );
}
