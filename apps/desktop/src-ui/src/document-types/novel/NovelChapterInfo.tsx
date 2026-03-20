/**
 * NovelChapterInfo — 编辑器下方可折叠章节信息面板
 *
 * 水平 Tab 切换：大纲/摘要/便笺/状态/目标/POV/标签
 * 面板默认折叠，点击展开，高度 ~120px
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NovelChapter, NovelCharacter, NovelSceneType } from './types';
import { getChapterWordCount } from './types';
import { STATUS_OPTIONS, COLOR_PRESETS, SCENE_TYPES } from './constants';

type InfoTab = 'outline' | 'summary' | 'notes' | 'status' | 'goal' | 'pov' | 'label';

interface NovelChapterInfoProps {
  chapter: NovelChapter | null;
  characters?: NovelCharacter[];
  onUpdateOutline: (val: string) => void;
  onUpdateSummary: (val: string) => void;
  onAIGenerateSummary?: () => void;
  onUpdateNotes: (val: string) => void;
  onUpdateStatus: (status: NovelChapter['status']) => void;
  onUpdateMeta?: (patch: Partial<Pick<NovelChapter, 'wordGoal' | 'povCharacterId' | 'colorLabel' | 'sceneType'>>) => void;
}

export default function NovelChapterInfo({
  chapter,
  characters = [],
  onUpdateOutline,
  onUpdateSummary,
  onAIGenerateSummary,
  onUpdateNotes,
  onUpdateStatus,
  onUpdateMeta,
}: NovelChapterInfoProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<InfoTab>('outline');

  if (!chapter) return null;

  const wc = getChapterWordCount(chapter);

  const tabClass = (tab: InfoTab) => cn(
    'px-2 py-0.5 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap',
    activeTab === tab ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
  );

  return (
    <div className="border-t flex-shrink-0 bg-card">
      {/* 标题栏（点击展开/折叠） */}
      <div
        className="flex items-center gap-1 px-3 py-1 cursor-pointer hover:bg-muted/30 transition-colors overflow-x-auto"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" /> : <ChevronUp className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
        <span className="text-xs text-muted-foreground font-medium flex-shrink-0">章节信息</span>
        <div className="flex-1" />
        <button className={tabClass('outline')} onClick={(e) => { e.stopPropagation(); setActiveTab('outline'); setExpanded(true); }}>大纲</button>
        <button className={tabClass('summary')} onClick={(e) => { e.stopPropagation(); setActiveTab('summary'); setExpanded(true); }}>摘要</button>
        <button className={tabClass('notes')} onClick={(e) => { e.stopPropagation(); setActiveTab('notes'); setExpanded(true); }}>便笺</button>
        <button className={tabClass('status')} onClick={(e) => { e.stopPropagation(); setActiveTab('status'); setExpanded(true); }}>
          {STATUS_OPTIONS.find(s => s.value === chapter.status)?.label || '草稿'}
        </button>
        <button className={tabClass('goal')} onClick={(e) => { e.stopPropagation(); setActiveTab('goal'); setExpanded(true); }}>
          目标{chapter.wordGoal ? ` ${Math.round(wc / chapter.wordGoal * 100)}%` : ''}
        </button>
        <button className={tabClass('pov')} onClick={(e) => { e.stopPropagation(); setActiveTab('pov'); setExpanded(true); }}>POV</button>
        <button className={tabClass('label')} onClick={(e) => { e.stopPropagation(); setActiveTab('label'); setExpanded(true); }}>
          {chapter.colorLabel ? <span className="inline-block w-2 h-2 rounded-full mr-0.5" style={{ backgroundColor: chapter.colorLabel }} /> : null}
          标签
        </button>
      </div>

      {/* 展开内容 */}
      {expanded && (
        <div className="px-3 pb-2">
          {activeTab === 'outline' && (
            <textarea
              className="w-full h-[100px] text-xs border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              value={chapter.outline || ''}
              onChange={e => onUpdateOutline(e.target.value)}
              placeholder="描述本章情节走向、需要完成的任务..."
            />
          )}
          {activeTab === 'summary' && (
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <div className="flex-1" />
                {onAIGenerateSummary && (
                  <button className="flex items-center gap-1 text-[10px] text-purple-600 hover:text-purple-800 transition-colors" onClick={onAIGenerateSummary}>
                    <Sparkles className="h-3 w-3" />AI 生成摘要
                  </button>
                )}
              </div>
              <textarea
                className="w-full h-[85px] text-xs border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                value={chapter.summary || ''}
                onChange={e => onUpdateSummary(e.target.value)}
                placeholder="本章摘要（可由 AI 生成）..."
              />
            </div>
          )}
          {activeTab === 'notes' && (
            <textarea
              className="w-full h-[100px] text-xs border rounded p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              value={chapter.authorNotes || ''}
              onChange={e => onUpdateNotes(e.target.value)}
              placeholder="写作备忘、注意事项..."
            />
          )}
          {activeTab === 'status' && (
            <div className="flex items-center gap-3 py-2">
              <span className="text-xs text-muted-foreground">章节状态：</span>
              {STATUS_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={cn(
                    'flex items-center gap-1 px-3 py-1 text-xs rounded-full border transition-colors',
                    chapter.status === opt.value
                      ? `${opt.color} border-current bg-current/10 font-medium`
                      : 'text-muted-foreground border-border hover:border-current',
                  )}
                  onClick={() => onUpdateStatus(opt.value)}
                >
                  {opt.label}
                  {chapter.status === opt.value && ' ✓'}
                </button>
              ))}
            </div>
          )}
          {activeTab === 'goal' && (
            <div className="flex items-center gap-3 py-2">
              <span className="text-xs text-muted-foreground">目标字数：</span>
              <input type="number" className="w-20 text-xs border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                value={chapter.wordGoal || ''} placeholder="如3000"
                onChange={e => onUpdateMeta?.({ wordGoal: e.target.value ? parseInt(e.target.value) : undefined })} />
              <span className="text-xs text-muted-foreground">当前 {wc} 字</span>
              {chapter.wordGoal && chapter.wordGoal > 0 && (
                <>
                  <span className="text-xs font-medium">{Math.round(wc / chapter.wordGoal * 100)}%</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[120px]">
                    <div className={cn('h-full rounded-full transition-all',
                      wc / chapter.wordGoal < 0.5 ? 'bg-red-400' : wc / chapter.wordGoal < 0.8 ? 'bg-yellow-400' : wc / chapter.wordGoal <= 1 ? 'bg-green-400' : 'bg-blue-400'
                    )} style={{ width: `${Math.min(100, Math.round(wc / chapter.wordGoal * 100))}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">还需 {Math.max(0, chapter.wordGoal - wc)} 字</span>
                </>
              )}
            </div>
          )}
          {activeTab === 'pov' && (
            <div className="flex items-center gap-3 py-2">
              <span className="text-xs text-muted-foreground">POV 视角角色：</span>
              <select className="text-xs border rounded px-2 py-1 bg-background" title="POV角色"
                value={chapter.povCharacterId || ''} onChange={e => onUpdateMeta?.({ povCharacterId: e.target.value || undefined })}>
                <option value="">未指定</option>
                {characters.map(c => <option key={c.id} value={c.id}>{c.name}（{c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '龙套'}）</option>)}
              </select>
              <span className="text-xs text-muted-foreground">场景类型：</span>
              <select className="text-xs border rounded px-2 py-1 bg-background" title="场景类型"
                value={chapter.sceneType || ''} onChange={e => onUpdateMeta?.({ sceneType: (e.target.value || undefined) as NovelSceneType | undefined })}>
                <option value="">未指定</option>
                {SCENE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          )}
          {activeTab === 'label' && (
            <div className="flex items-center gap-2 py-2">
              <span className="text-xs text-muted-foreground">颜色标签：</span>
              {COLOR_PRESETS.map(cp => (
                <button key={cp.color}
                  className={cn('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                    chapter.colorLabel === cp.color ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: cp.color }}
                  onClick={() => onUpdateMeta?.({ colorLabel: chapter.colorLabel === cp.color ? undefined : cp.color })}
                  title={chapter.colorLabel === cp.color ? '清除' : cp.label}
                />
              ))}
              {chapter.colorLabel && (
                <button className="text-xs text-muted-foreground hover:text-foreground px-1"
                  onClick={() => onUpdateMeta?.({ colorLabel: undefined })}>清除</button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
