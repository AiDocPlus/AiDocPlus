/**
 * OutlinePanel — 大纲面板
 * 全局大纲（MarkdownEditor 占满空间）+ 当前章节大纲
 */
import { useCallback } from 'react';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import type { NovelDocumentContent } from '../types';
import { getChapterById } from '../types';

interface OutlinePanelProps {
  novel: NovelDocumentContent;
  activeChapterId: string | null;
  onUpdate: (patch: Partial<NovelDocumentContent['settings']>) => void;
  onNovelChange: (novel: NovelDocumentContent) => void;
}

const LABEL = 'text-xs text-muted-foreground font-medium';

export default function OutlinePanel({ novel, activeChapterId, onUpdate, onNovelChange }: OutlinePanelProps) {
  const activeChapter = activeChapterId ? getChapterById(novel, activeChapterId) : null;

  const handleChapterOutlineChange = useCallback((val: string) => {
    if (!activeChapterId) return;
    onNovelChange({
      ...novel,
      volumes: novel.volumes.map(v => ({
        ...v,
        chapters: v.chapters.map(c =>
          c.id === activeChapterId ? { ...c, outline: val } : c
        ),
      })),
    });
  }, [novel, activeChapterId, onNovelChange]);

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className={activeChapter ? 'flex-1 min-h-0 flex flex-col' : 'flex-1 min-h-0 flex flex-col'}>
        <label className={`${LABEL} flex-shrink-0`}>全局大纲</label>
        <div className="flex-1 min-h-0 mt-0.5">
          <MarkdownEditor
            value={novel.settings.outlineGlobal}
            onChange={val => onUpdate({ outlineGlobal: val })}
            placeholder="全书情节走向..."
            showToolbar={true}
            showStatusBar={false}
            theme="light"
            editorId="outline-global-editor"
          />
        </div>
      </div>
      {activeChapter && (
        <div className="flex-1 min-h-0 flex flex-col">
          <label className={`${LABEL} flex-shrink-0`}>当前章节大纲（{activeChapter.title}）</label>
          <div className="flex-1 min-h-0 mt-0.5">
            <MarkdownEditor
              value={activeChapter.outline || ''}
              onChange={handleChapterOutlineChange}
              placeholder="本章情节要点..."
              showToolbar={true}
              showStatusBar={false}
              theme="light"
              editorId="outline-chapter-editor"
            />
          </div>
        </div>
      )}
    </div>
  );
}
