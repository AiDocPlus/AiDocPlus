/**
 * NovelCollections — 智能集合面板
 *
 * 左栏底部可折叠面板，按元数据动态分组
 * 内置集合：草稿/待修订/字数不足/含伏笔/无摘要
 */
import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Filter, Circle, PenLine, AlertTriangle, Eye, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NovelDocumentContent, NovelChapter } from './types';
import { getChapterWordCount } from './types';

interface NovelCollectionsProps {
  novel: NovelDocumentContent;
  onSelectChapter: (chapterId: string) => void;
}

interface CollectionDef {
  id: string;
  label: string;
  icon: typeof Circle;
  color: string;
  filter: (ch: NovelChapter, novel: NovelDocumentContent) => boolean;
}

const COLLECTIONS: CollectionDef[] = [
  { id: 'draft', label: '草稿章节', icon: Circle, color: 'text-yellow-500',
    filter: (ch) => ch.status === 'draft' },
  { id: 'revised', label: '待修订', icon: PenLine, color: 'text-blue-500',
    filter: (ch) => ch.status === 'revised' },
  { id: 'undergoal', label: '字数不足', icon: AlertTriangle, color: 'text-red-500',
    filter: (ch, novel) => {
      const goal = ch.wordGoal || novel.metadata.chapterDefaultGoal || 3000;
      return getChapterWordCount(ch) < goal && ch.status !== 'done';
    } },
  { id: 'foreshadow', label: '含未解伏笔', icon: Eye, color: 'text-amber-500',
    filter: (ch, novel) => novel.settings.foreshadowing.some(f => f.chapterId === ch.id && f.status === 'open') },
  { id: 'nosummary', label: '无摘要', icon: FileText, color: 'text-muted-foreground',
    filter: (ch) => !ch.summary && getChapterWordCount(ch) > 0 },
];

export default function NovelCollections({ novel, onSelectChapter }: NovelCollectionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeCollId, setActiveCollId] = useState<string | null>(null);

  const allChapters = useMemo(() => {
    return novel.volumes.flatMap(v => v.chapters.map(ch => ({ ...ch, volTitle: v.title })));
  }, [novel]);

  const collectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const coll of COLLECTIONS) {
      counts[coll.id] = allChapters.filter(ch => coll.filter(ch, novel)).length;
    }
    return counts;
  }, [allChapters, novel]);

  const activeItems = useMemo(() => {
    if (!activeCollId) return [];
    const coll = COLLECTIONS.find(c => c.id === activeCollId);
    if (!coll) return [];
    return allChapters.filter(ch => coll.filter(ch, novel));
  }, [activeCollId, allChapters, novel]);

  const totalCount = Object.values(collectionCounts).reduce((s, n) => s + n, 0);

  return (
    <div className="border-t flex-shrink-0">
      {/* 折叠标题 */}
      <button className="flex items-center gap-1 w-full px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
        <Filter className="h-2.5 w-2.5" />
        <span>智能集合</span>
        {totalCount > 0 && <span className="ml-auto text-[9px]">{totalCount}</span>}
      </button>

      {expanded && (
        <div className="px-1 pb-1 space-y-0.5">
          {COLLECTIONS.map(coll => {
            const Icon = coll.icon;
            const count = collectionCounts[coll.id] || 0;
            const isActive = activeCollId === coll.id;
            return (
              <div key={coll.id}>
                <button className={cn('flex items-center gap-1 w-full px-2 py-0.5 text-[10px] rounded transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )} onClick={() => setActiveCollId(isActive ? null : coll.id)}>
                  <Icon className={cn('h-2.5 w-2.5', coll.color)} />
                  <span>{coll.label}</span>
                  <span className="ml-auto tabular-nums">{count}</span>
                </button>
                {isActive && activeItems.length > 0 && (
                  <div className="ml-3 space-y-0">
                    {activeItems.map(ch => (
                      <button key={ch.id} className="block w-full text-left px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded truncate"
                        onClick={() => onSelectChapter(ch.id)}>
                        {ch.title} <span className="text-[9px] opacity-50">{getChapterWordCount(ch)}字</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
