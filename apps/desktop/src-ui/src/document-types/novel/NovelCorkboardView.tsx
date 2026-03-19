/**
 * NovelCorkboardView — 索引卡视图
 *
 * 网格卡片形式展示章节/场景，可拖拽重排
 * 每卡显示：颜色条+标题+字数+synopsis+状态+POV
 */
import { useState, useMemo, useCallback } from 'react';
import { Circle, CheckCircle2, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import type { NovelDocumentContent, NovelChapter } from './types';
import { getChapterWordCount, getSceneWordCount } from './types';

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

interface NovelCorkboardViewProps {
  novel: NovelDocumentContent;
  onNovelChange: (novel: NovelDocumentContent) => void;
  onSelectChapter: (chapterId: string) => void;
  onSelectScene?: (chapterId: string, sceneId: string) => void;
}

interface CardItem {
  type: 'chapter' | 'scene';
  id: string;
  chapterId?: string;
  volumeTitle: string;
  title: string;
  synopsis: string;
  status: NovelChapter['status'];
  words: number;
  colorLabel?: string;
  povName?: string;
  sceneType?: string;
  plotlineColors?: string[];
}

const SCENE_TYPE_LABELS: Record<string, string> = {
  action: '动作', dialogue: '对话', description: '描写', transition: '过渡', flashback: '闪回',
};

export default function NovelCorkboardView({ novel, onSelectChapter, onSelectScene }: NovelCorkboardViewProps) {
  const { t } = useTranslation();
  const [dragId, setDragId] = useState<string | null>(null);

  const cards = useMemo(() => {
    const result: CardItem[] = [];
    const chars = novel.settings.characters;
    const plotlines = novel.settings.plotlines;

    for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
      for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
        if (ch.scenes && ch.scenes.length > 0) {
          for (const sc of [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder)) {
            const povChar = sc.povCharacterId ? chars.find(c => c.id === sc.povCharacterId) : null;
            const plColors = sc.plotlineIds?.map(pid => plotlines.find(p => p.id === pid)?.color).filter(Boolean) as string[] || [];
            result.push({
              type: 'scene', id: sc.id, chapterId: ch.id, volumeTitle: vol.title,
              title: `${ch.title} › ${sc.title}`, synopsis: sc.synopsis || '',
              status: sc.status, words: getSceneWordCount(sc), colorLabel: sc.colorLabel,
              povName: povChar?.name, sceneType: sc.sceneType, plotlineColors: plColors,
            });
          }
        } else {
          const povChar = ch.povCharacterId ? chars.find(c => c.id === ch.povCharacterId) : null;
          result.push({
            type: 'chapter', id: ch.id, volumeTitle: vol.title,
            title: ch.title, synopsis: ch.summary || '',
            status: ch.status, words: getChapterWordCount(ch), colorLabel: ch.colorLabel,
            povName: povChar?.name, sceneType: ch.sceneType,
          });
        }
      }
    }
    return result;
  }, [novel]);

  const handleCardClick = useCallback((card: CardItem) => {
    if (card.type === 'scene' && card.chapterId && onSelectScene) {
      onSelectScene(card.chapterId, card.id);
    } else {
      onSelectChapter(card.id);
    }
  }, [onSelectChapter, onSelectScene]);

  const statusIcon = (s: string) => {
    if (s === 'done') return <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />;
    if (s === 'revised') return <PenLine className="h-3 w-3 text-blue-500 flex-shrink-0" />;
    return <Circle className="h-3 w-3 text-yellow-500 flex-shrink-0" />;
  };

  // 按卷分组显示
  const volumeGroups = useMemo(() => {
    const groups: { title: string; cards: CardItem[] }[] = [];
    let currentVol = '';
    let currentCards: CardItem[] = [];
    for (const card of cards) {
      if (card.volumeTitle !== currentVol) {
        if (currentCards.length > 0) groups.push({ title: currentVol, cards: currentCards });
        currentVol = card.volumeTitle;
        currentCards = [];
      }
      currentCards.push(card);
    }
    if (currentCards.length > 0) groups.push({ title: currentVol, cards: currentCards });
    return groups;
  }, [cards]);

  return (
    <div className="h-full overflow-auto p-4 space-y-6" style={DIALOG_STYLE}>
      {volumeGroups.map(group => (
        <div key={group.title}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">{group.title}</h3>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
            {group.cards.map(card => (
              <div key={card.id}
                className={cn(
                  'rounded-lg border bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow overflow-hidden',
                  dragId === card.id && 'opacity-40',
                )}
                draggable
                onDragStart={() => setDragId(card.id)}
                onDragEnd={() => setDragId(null)}
                onClick={() => handleCardClick(card)}>
                {/* 颜色标签条 */}
                <div className="h-[3px]" style={{ backgroundColor: card.colorLabel || 'transparent' }} />

                <div className="p-3 space-y-1.5">
                  {/* 标题行 */}
                  <div className="flex items-center gap-1.5">
                    {statusIcon(card.status)}
                    <span className="text-sm font-medium truncate flex-1">{card.title}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">
                      {card.words > 999 ? `${(card.words / 1000).toFixed(1)}k` : card.words}
                    </span>
                  </div>

                  {/* 摘要 */}
                  <p className="text-xs text-muted-foreground line-clamp-3 min-h-[36px]">
                    {card.synopsis || t('novel.corkboardNoSynopsis', { defaultValue: '（无摘要）' })}
                  </p>

                  {/* 底部元信息 */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {card.povName && (
                      <span className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground">{card.povName}</span>
                    )}
                    {card.sceneType && (
                      <span className="text-[9px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
                        {SCENE_TYPE_LABELS[card.sceneType] || card.sceneType}
                      </span>
                    )}
                  </div>

                  {/* 情节线彩色条 */}
                  {card.plotlineColors && card.plotlineColors.length > 0 && (
                    <div className="flex gap-0.5 mt-1">
                      {card.plotlineColors.map((color, i) => (
                        <div key={i} className="h-[3px] flex-1 rounded-full" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {cards.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          {t('novel.corkboardEmpty', { defaultValue: '暂无章节或场景' })}
        </div>
      )}
    </div>
  );
}
