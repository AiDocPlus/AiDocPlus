/**
 * WorldViewPanel — 增强版世界观面板
 * 4 个水平子 Tab：规则设定 / 地理设定 / 文化/社会 / 历史背景
 * 每个子 Tab 使用 MarkdownEditor 占满空间
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import type { NovelDocumentContent } from '../types';

interface WorldViewPanelProps {
  novel: NovelDocumentContent;
  onUpdate: (patch: Partial<NovelDocumentContent['settings']>) => void;
}

type SubTab = 'rules' | 'geography' | 'culture' | 'history';

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'rules', label: '规则设定' },
  { key: 'geography', label: '地理设定' },
  { key: 'culture', label: '文化/社会' },
  { key: 'history', label: '历史背景' },
];

export default function WorldViewPanel({ novel, onUpdate }: WorldViewPanelProps) {
  const [subTab, setSubTab] = useState<SubTab>('rules');
  const s = novel.settings;

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 子 Tab 栏 */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b flex-shrink-0">
        {SUB_TABS.map(tab => (
          <button key={tab.key}
            className={cn('text-xs px-2.5 py-1 rounded font-medium transition-colors',
              subTab === tab.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
            onClick={() => setSubTab(tab.key)}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 — MarkdownEditor 占满 */}
      <div className="flex-1 min-h-0 flex flex-col">
        {subTab === 'rules' && (
          <div className="flex-1 min-h-0 flex flex-col">
            {s.worldView ? (
              <>
                <div className="flex-1 min-h-0">
                  <MarkdownEditor value={s.worldRules || ''} onChange={val => onUpdate({ worldRules: val })}
                    placeholder="描述力量体系、科技水平、种族设定、魔法规则..."
                    showToolbar={true} showStatusBar={false} theme="light" editorId="worldview-rules-editor" />
                </div>
                <div className="h-[200px] flex-shrink-0 border-t flex flex-col">
                  <label className="text-xs text-muted-foreground font-medium px-3 py-1 flex-shrink-0">通用世界观描述（旧字段）</label>
                  <div className="flex-1 min-h-0">
                    <MarkdownEditor value={s.worldView} onChange={val => onUpdate({ worldView: val })}
                      placeholder="总体世界观描述..."
                      showToolbar={true} showStatusBar={false} theme="light" editorId="worldview-legacy-editor" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 min-h-0">
                <MarkdownEditor value={s.worldRules || ''} onChange={val => onUpdate({ worldRules: val })}
                  placeholder="描述力量体系、科技水平、种族设定、魔法规则..."
                  showToolbar={true} showStatusBar={false} theme="light" editorId="worldview-rules-editor" />
              </div>
            )}
          </div>
        )}

        {subTab === 'geography' && (
          <div className="flex-1 min-h-0">
            <MarkdownEditor value={s.worldGeography || ''} onChange={val => onUpdate({ worldGeography: val })}
              placeholder="描述世界地理、气候特征、资源分布、交通路线..."
              showToolbar={true} showStatusBar={false} theme="light" editorId="worldview-geography-editor" />
          </div>
        )}

        {subTab === 'culture' && (
          <div className="flex-1 min-h-0">
            <MarkdownEditor value={s.worldCulture || ''} onChange={val => onUpdate({ worldCulture: val })}
              placeholder="描述社会制度、宗教信仰、经济体系、语言文字..."
              showToolbar={true} showStatusBar={false} theme="light" editorId="worldview-culture-editor" />
          </div>
        )}

        {subTab === 'history' && (
          <div className="flex-1 min-h-0">
            <MarkdownEditor value={s.historicalBackground} onChange={val => onUpdate({ historicalBackground: val })}
              placeholder="描述历史时期、重大事件、社会变迁..."
              showToolbar={true} showStatusBar={false} theme="light" editorId="worldview-history-editor" />
          </div>
        )}
      </div>
    </div>
  );
}
