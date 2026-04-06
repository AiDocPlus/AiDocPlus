/**
 * 状态栏
 *
 * 显示节点数、字数、完成进度、保存状态、标签数等信息
 */

import { useTranslation } from 'react-i18next';
import { Check, Loader2 } from 'lucide-react';
import type { OutlineStats } from '../types';

type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface StatusBarProps {
  stats: OutlineStats;
  filterActive: boolean;
  saveStatus?: SaveStatus;
  showWordCount?: boolean;
  showProgress?: boolean;
}

export function StatusBar({
  stats,
  filterActive,
  saveStatus = 'saved',
  showWordCount = true,
  showProgress = false,
}: StatusBarProps) {
  const { t } = useTranslation();

  const progressPercent =
    stats.totalNodes > 0
      ? Math.round((stats.completedNodes / stats.totalNodes) * 100)
      : 0;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30 text-xs select-none">
      <div className="flex items-center gap-4">
        <span>
          {t('outline.stats.total', {
            defaultValue: '{{count}} 节点',
            count: stats.totalNodes,
          })}
        </span>

        {showWordCount && stats.totalWords > 0 && (
          <span className="text-muted-foreground">
            {t('outline.stats.words', {
              defaultValue: '{{count}} 字',
              count: stats.totalWords,
            })}
          </span>
        )}

        {stats.totalTags > 0 && (
          <span className="text-muted-foreground">
            {t('outline.stats.tags', {
              defaultValue: '{{count}} 标签',
              count: stats.totalTags,
            })}
          </span>
        )}

        {showProgress && stats.totalNodes > 0 && (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span>
              {t('outline.stats.progress', {
                defaultValue: '{{completed}}/{{total}}',
                completed: stats.completedNodes,
                total: stats.totalNodes,
              })}
            </span>
            <span className="inline-flex w-16 h-1.5 rounded-full bg-muted overflow-hidden">
              <span
                className="h-full bg-primary/60 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </span>
          </span>
        )}

        {filterActive && (
          <span className="text-primary">
            {t('outline.filtering', { defaultValue: '过滤中' })}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-muted-foreground">
        {saveStatus === 'saving' && (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{t('outline.saving', { defaultValue: '保存中...' })}</span>
          </>
        )}
        {saveStatus === 'saved' && (
          <>
            <Check className="w-3 h-3 text-green-500" />
            <span>{t('outline.saved', { defaultValue: '已保存' })}</span>
          </>
        )}
        {saveStatus === 'unsaved' && (
          <span className="text-amber-500">
            {t('outline.unsaved', { defaultValue: '未保存' })}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatusBar;
