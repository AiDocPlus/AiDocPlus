/**
 * DiaryDailyPrompt — 每日写作提示组件
 *
 * 在欢迎页显示 AI 生成的写作灵感
 * 通过 host.storage 缓存（当天有效）
 * 点击提示可直接开始新条目
 */
import { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { formatBackendError } from '@/lib/backendError';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { DiaryDocumentContent } from './types';
import { buildDailyPromptRequest, buildDiarySystemPrompt } from './diaryContext';

const CACHE_KEY = '_diary_daily_prompt';
const CACHE_DATE_KEY = '_diary_daily_prompt_date';

interface CachedPrompt {
  prompts: string[];
  date: string;
}

interface DiaryDailyPromptProps {
  host: DocTypeHostAPI;
  diary: DiaryDocumentContent;
  onStartWithPrompt: (content: string) => void;
}

export default function DiaryDailyPrompt({ host, diary, onStartWithPrompt }: DiaryDailyPromptProps) {
  const { t } = useTranslation();
  const [prompts, setPrompts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const aiParams = getAIInvokeParamsForService();
  const aiAvailable = !!(aiParams.provider && aiParams.apiKey && aiParams.model);

  // 从缓存加载
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const cachedDate = host.storage.get<string>(CACHE_DATE_KEY);
    if (cachedDate === today) {
      const cached = host.storage.get<CachedPrompt>(CACHE_KEY);
      if (cached && cached.prompts.length > 0) {
        setPrompts(cached.prompts);
        return;
      }
    }
    // 缓存过期或不存在，自动生成
    if (aiAvailable) {
      generatePrompts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generatePrompts = useCallback(async () => {
    if (!aiAvailable || loading) return;
    setLoading(true);
    setError('');
    try {
      const systemPrompt = buildDiarySystemPrompt(diary, null, 'week');
      const userPrompt = buildDailyPromptRequest(diary);
      let full = '';
      await host.ai.chatStream(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        (chunk) => { full += chunk; },
        {},
      );
      // 解析 AI 回复为提示列表（按数字编号或换行分割）
      const lines = full
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .split(/\n/)
        .map(l => l.replace(/^\d+[\.\)、]\s*/, '').trim())
        .filter(l => l.length > 5);
      const result = lines.slice(0, 5);
      setPrompts(result);
      // 缓存
      const today = new Date().toISOString().slice(0, 10);
      host.storage.set(CACHE_KEY, { prompts: result, date: today });
      host.storage.set(CACHE_DATE_KEY, today);
    } catch (err) {
      setError(formatBackendError(err));
    } finally {
      setLoading(false);
    }
  }, [aiAvailable, loading, diary, host.ai, host.storage]);

  if (!aiAvailable) return null;
  if (prompts.length === 0 && !loading && !error) return null;

  return (
    <div className="text-left space-y-1.5 w-full">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs text-muted-foreground font-medium">
          {t('diary.dailyPromptTitle', { defaultValue: '今日写作灵感' })}
        </span>
        <Button variant="ghost" size="icon" className="h-4 w-4 ml-auto"
          onClick={generatePrompts} disabled={loading}
          title={t('diary.refreshPrompt', { defaultValue: '换一批' })}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && (
        <div className="text-xs text-muted-foreground animate-pulse py-2">
          {t('diary.generatingPrompts', { defaultValue: 'AI 正在构思写作灵感...' })}
        </div>
      )}

      {error && (
        <div className="text-xs text-red-500 py-1">{error}</div>
      )}

      {prompts.map((prompt, i) => (
        <button
          key={i}
          className="w-full text-left text-xs px-2.5 py-1.5 rounded-md border hover:bg-accent hover:border-primary/30 transition-colors"
          onClick={() => onStartWithPrompt(`## ${prompt}\n\n`)}
        >
          <span className="text-primary/60 mr-1">💡</span>
          {prompt}
        </button>
      ))}
    </div>
  );
}
