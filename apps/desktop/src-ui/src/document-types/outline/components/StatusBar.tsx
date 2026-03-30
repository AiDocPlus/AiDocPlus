/**
 * 状态栏
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { OutlineStats } from '../types';

interface StatusBarProps {
  stats: OutlineStats;
  filterActive: boolean;
}

export function StatusBar({ stats, filterActive }: StatusBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-t bg-muted/30 text-xs">
      <div className="flex items-center gap-4">
        <span>
          {t('outline.stats.total', {
            defaultValue: '{{count}} 节点',
            count: stats.totalNodes,
          })}
        </span>

        {stats.totalTags > 0 && (
          <span className="text-muted-foreground">
            {t('outline.stats.tags', {
              defaultValue: '{{count}} 标签',
              count: stats.totalTags,
            })}
          </span>
        )}

        {filterActive && (
          <span className="text-primary">
            {t('outline.filtering', { defaultValue: '过滤中' })}
          </span>
        )}
      </div>

      <div className="text-muted-foreground">
        {t('outline.autoSave', { defaultValue: '自动保存开启' })}
      </div>
    </div>
  );
}

export default StatusBar;
