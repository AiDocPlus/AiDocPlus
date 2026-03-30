/**
 * 标签云组件
 * 
 * 显示所有标签和提及，支持点击过滤
 */

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface TagCloudProps {
  tags: string[];
  mentions: string[];
  selectedTags: Set<string>;
  selectedMentions: Set<string>;
  tagCounts: Map<string, number>;
  mentionCounts: Map<string, number>;
  onTagClick: (tag: string) => void;
  onMentionClick: (mention: string) => void;
}

export function TagCloud({
  tags,
  mentions,
  selectedTags,
  selectedMentions,
  tagCounts,
  mentionCounts,
  onTagClick,
  onMentionClick,
}: TagCloudProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* 标签区域 */}
      {tags.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            {t('outline.tags', { defaultValue: '标签' })}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const count = tagCounts.get(tag) || 0;
              const isSelected = selectedTags.has(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onTagClick(tag)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-md transition-all duration-200',
                    'hover:shadow-sm',
                    isSelected
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'bg-background hover:bg-muted border'
                  )}
                  title={`${count} ${t('outline.nodeCount', { defaultValue: '个节点', count })}`}
                >
                  <span className="text-primary/80">#</span>
                  {tag}
                  <span className={cn(
                    'ml-1 text-[10px]',
                    isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 提及区域 */}
      {mentions.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            {t('outline.mentions', { defaultValue: '提及' })}
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {mentions.map((mention) => {
              const count = mentionCounts.get(mention) || 0;
              const isSelected = selectedMentions.has(mention);
              return (
                <button
                  key={mention}
                  onClick={() => onMentionClick(mention)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-md transition-all duration-200',
                    'hover:shadow-sm',
                    isSelected
                      ? 'bg-blue-500 text-white font-medium'
                      : 'bg-background hover:bg-muted border'
                  )}
                  title={`${count} ${t('outline.nodeCount', { defaultValue: '个节点', count })}`}
                >
                  <span className="text-blue-500/80">@</span>
                  {mention}
                  <span className={cn(
                    'ml-1 text-[10px]',
                    isSelected ? 'text-white/70' : 'text-muted-foreground'
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {tags.length === 0 && mentions.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4">
          {t('outline.noTags', { defaultValue: '暂无标签或提及' })}
        </div>
      )}
    </div>
  );
}

export default TagCloud;
