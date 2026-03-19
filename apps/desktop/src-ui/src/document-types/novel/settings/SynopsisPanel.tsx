/**
 * SynopsisPanel — 梗概面板
 * 题材/时代/风格 + 故事梗概（MarkdownEditor 占满空间）
 */
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import type { NovelDocumentContent } from '../types';

interface SynopsisPanelProps {
  novel: NovelDocumentContent;
  onUpdate: (patch: Partial<NovelDocumentContent['settings']>) => void;
}

const LABEL = 'text-xs text-muted-foreground font-medium';
const INPUT = 'w-full text-sm border rounded px-2 py-1 bg-background mt-0.5 focus:outline-none focus:ring-1 focus:ring-ring';

export default function SynopsisPanel({ novel, onUpdate }: SynopsisPanelProps) {
  const s = novel.settings;
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-3 gap-3 flex-shrink-0 pb-2">
        <div>
          <label className={LABEL}>题材</label>
          <input className={INPUT} value={s.genre} onChange={e => onUpdate({ genre: e.target.value })} placeholder="武侠/科幻/奇幻..." />
        </div>
        <div>
          <label className={LABEL}>时代</label>
          <input className={INPUT} value={s.era} onChange={e => onUpdate({ era: e.target.value })} placeholder="古代/现代/未来..." />
        </div>
        <div>
          <label className={LABEL}>风格</label>
          <input className={INPUT} value={s.style} onChange={e => onUpdate({ style: e.target.value })} placeholder="古龙式/细腻心理..." />
        </div>
      </div>
      <label className={LABEL}>故事梗概</label>
      <div className="flex-1 min-h-0 mt-0.5">
        <MarkdownEditor
          value={s.synopsis}
          onChange={val => onUpdate({ synopsis: val })}
          placeholder="描述故事主线、核心冲突、主要转折..."
          showToolbar={true}
          showStatusBar={false}
          theme="light"
          editorId="synopsis-editor"
        />
      </div>
    </div>
  );
}
