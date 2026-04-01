/**
 * NovelSettingsDialog — 专业级小说设定集工作台
 *
 * 90vw × 85vh 大型 Dialog，左侧 10 Tab 数据编辑，右侧设定集专用 AI 面板。
 * Tab：梗概/大纲/人物/人物关系/地点/阵营/伏笔/时间线/世界观/素材库
 * AI 面板：上下文感知快捷操作 + 批量导入
 */
import { useState, useCallback } from 'react';
import {
  BookText, ListTree, Users, MapPin, Eye, Globe, Lightbulb,
  Network, Shield, Calendar, Sparkles, PanelRightClose, PanelRightOpen, Target, ShieldCheck, GitBranch,
  Plus, Trash2, Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { NovelDocumentContent, StyleProfile } from './types';
import { addPlotline, deletePlotline } from './types';
import SynopsisPanel from './settings/SynopsisPanel';
import OutlinePanel from './settings/OutlinePanel';
import CharacterPanel from './settings/CharacterPanel';
import CharacterRelationPanel from './settings/CharacterRelationPanel';
import LocationPanel from './settings/LocationPanel';
import FactionPanel from './settings/FactionPanel';
import ForeshadowingPanel from './settings/ForeshadowingPanel';
import TimelinePanel from './settings/TimelinePanel';
import WorldViewPanel from './settings/WorldViewPanel';
import MaterialPanel from './settings/MaterialPanel';
import GoalPanel from './settings/GoalPanel';
import StyleLearningPanel from './settings/StyleLearningPanel';
import SettingsAIPanel from './settings/SettingsAIPanel';
import type { SettingsTab } from './settings/SettingsAIPanel';
import { checkConsistency } from './novelAnalysis';
import { DIALOG_STYLE } from './constants';

const TABS: { key: SettingsTab; icon: typeof BookText; label: string }[] = [
  { key: 'synopsis', icon: BookText, label: '梗概' },
  { key: 'outline', icon: ListTree, label: '大纲' },
  { key: 'characters', icon: Users, label: '人物' },
  { key: 'relations', icon: Network, label: '关系' },
  { key: 'locations', icon: MapPin, label: '地点' },
  { key: 'factions', icon: Shield, label: '阵营' },
  { key: 'foreshadowing', icon: Eye, label: '伏笔' },
  { key: 'timeline', icon: Calendar, label: '时间线' },
  { key: 'worldview', icon: Globe, label: '世界观' },
  { key: 'materials', icon: Lightbulb, label: '素材库' },
  { key: 'goals', icon: Target, label: '目标' },
  { key: 'plotlines', icon: GitBranch, label: '情节线' },
  { key: 'style', icon: Palette, label: '风格' },
  { key: 'check', icon: ShieldCheck, label: '检查' },
];

interface NovelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
  novel: NovelDocumentContent;
  activeChapterId: string | null;
  onNovelChange: (updated: NovelDocumentContent) => void;
  host: DocTypeHostAPI;
  documentId: string;
}

export default function NovelSettingsDialog({
  open, onOpenChange, initialTab, novel, activeChapterId, onNovelChange, host, documentId,
}: NovelSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'synopsis');
  const [aiCollapsed, setAiCollapsed] = useState(false);

  const updateSettings = useCallback((patch: Partial<NovelDocumentContent['settings']>) => {
    onNovelChange({ ...novel, settings: { ...novel.settings, ...patch } });
  }, [novel, onNovelChange]);

  // 风格分析回调：调用 AI 分析文本风格
  const handleAnalyzeStyle = useCallback(async (_corpusId: string, text: string): Promise<StyleProfile | null> => {
    try {
      const STYLE_ANALYSIS_PROMPT = `你是一位专业的文学风格分析师。请分析以下文本的写作风格，提取可供模仿的风格特征。

**重要规则**：
1. 分析必须基于原文实际特征，每个特征都要附上原文例句佐证
2. 不要泛泛而谈，要给出具体可操作的建议
3. 输出必须是严格的 JSON 格式

请分析以下文本的写作风格：

\`\`\`
${text.slice(0, 15000)}
\`\`\`

请从以下维度进行分析，输出 JSON 格式的风格画像：

\`\`\`json
{
  "avgSentenceLength": 25.5,
  "sentenceLengthStdDev": 12.3,
  "avgParagraphLength": 180,
  "paragraphLengthRange": { "min": 50, "max": 350 },
  "dialogueRatio": 0.35,
  "narrationRatio": 0.65,
  "vocabularyDiversity": 0.42,
  "narrativeVoice": "第三人称有限视角",
  "tensePreference": "过去时",
  "toneStyle": "冷峻克制",
  "commonMetaphors": ["刀剑意象", "自然力量", "光影对比"],
  "rhetoricalDevices": ["短句排比", "动作细节", "环境烘托"],
  "topPatterns": ["四字成语+动作", "对话+心理"],
  "dialogueStyle": "简洁有力，少用形容词",
  "tagVerbPreference": ["道", "问", "答"],
  "sensoryFocus": ["视觉", "触觉", "听觉"],
  "pacingPreference": "快节奏，句式短促",
  "summary": "整体风格概述（200-300字），描述文风的主要特点...",
  "signature": "标志性特征（如：四字成语密集+动作描写+环境烘托）"
}
\`\`\``;

      const result = await host.ai.chat([
        { role: 'user', content: STYLE_ANALYSIS_PROMPT }
      ], { temperature: 0.3 });

      // 解析 JSON
      const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const profile = JSON.parse(jsonMatch[1]) as StyleProfile;
        profile.analyzedAt = Date.now();
        return profile;
      }

      // 尝试直接解析
      try {
        const profile = JSON.parse(result) as StyleProfile;
        profile.analyzedAt = Date.now();
        return profile;
      } catch {
        console.error('Failed to parse style profile:', result);
        return null;
      }
    } catch (error) {
      console.error('Style analysis failed:', error);
      return null;
    }
  }, [host.ai]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[5vh] !translate-y-0 w-[90vw] h-[85vh] max-w-[1400px] max-h-[85vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">设定集</DialogTitle>

        {/* Tab 栏 */}
        <div className="flex items-center border-b px-2 py-1 flex-shrink-0 overflow-x-auto scrollbar-hide">
          <Sparkles className="h-4 w-4 text-amber-500 mr-2 flex-shrink-0" />
          <span className="text-sm font-medium mr-3 flex-shrink-0">设定集</span>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.key}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 text-xs font-medium whitespace-nowrap rounded transition-colors',
                  activeTab === tab.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
                onClick={() => setActiveTab(tab.key)}>
                <Icon className="h-3 w-3" />
                {tab.label}
              </button>
            );
          })}
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0"
            onClick={() => setAiCollapsed(!aiCollapsed)}
            title={aiCollapsed ? '展开 AI 面板' : '收起 AI 面板'}>
            {aiCollapsed ? <PanelRightOpen className="h-3.5 w-3.5" /> : <PanelRightClose className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* 主体：左侧数据编辑 + 右侧 AI 面板 */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧：数据编辑区 */}
          <div className={cn('flex-1 min-w-0 min-h-0 overflow-hidden', !aiCollapsed && 'border-r')}>
            {activeTab === 'synopsis' && (
              <div className="h-full p-3 flex flex-col min-h-0">
                <SynopsisPanel novel={novel} onUpdate={updateSettings} />
              </div>
            )}
            {activeTab === 'outline' && (
              <div className="h-full p-3 flex flex-col min-h-0">
                <OutlinePanel novel={novel} activeChapterId={activeChapterId} onUpdate={updateSettings} onNovelChange={onNovelChange} />
              </div>
            )}
            {activeTab === 'characters' && (
              <CharacterPanel novel={novel} onNovelChange={onNovelChange} />
            )}
            {activeTab === 'relations' && (
              <CharacterRelationPanel novel={novel} onNovelChange={onNovelChange} />
            )}
            {activeTab === 'locations' && (
              <LocationPanel novel={novel} onNovelChange={onNovelChange} />
            )}
            {activeTab === 'factions' && (
              <FactionPanel novel={novel} onNovelChange={onNovelChange} />
            )}
            {activeTab === 'foreshadowing' && (
              <ForeshadowingPanel novel={novel} activeChapterId={activeChapterId} onNovelChange={onNovelChange} />
            )}
            {activeTab === 'timeline' && (
              <TimelinePanel novel={novel} onNovelChange={onNovelChange} />
            )}
            {activeTab === 'worldview' && (
              <WorldViewPanel novel={novel} onUpdate={updateSettings} />
            )}
            {activeTab === 'materials' && (
              <MaterialPanel novel={novel} onNovelChange={onNovelChange} />
            )}
            {activeTab === 'goals' && (
              <GoalPanel novel={novel} onNovelChange={onNovelChange} />
            )}
            {activeTab === 'plotlines' && (
              <div className="h-full p-3 overflow-auto space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground">情节线管理</p>
                  <Button variant="outline" size="sm" className="h-6 text-xs gap-1"
                    onClick={() => {
                      const colors = ['#3b82f6','#ec4899','#8b5cf6','#22c55e','#f97316','#ef4444'];
                      const color = colors[novel.settings.plotlines.length % colors.length];
                      onNovelChange(addPlotline(novel, '新情节线', color));
                    }}>
                    <Plus className="h-3 w-3" />添加
                  </Button>
                </div>
                {novel.settings.plotlines.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">暂无情节线，点击"添加"创建</p>
                )}
                {novel.settings.plotlines.map(pl => (
                  <div key={pl.id} className="flex items-center gap-2 rounded border p-2 bg-background">
                    <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: pl.color }} />
                    <span className="flex-1 text-sm font-medium">{pl.title}</span>
                    {pl.description && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{pl.description}</span>}
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => {
                      onNovelChange(deletePlotline(novel, pl.id));
                    }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'style' && (
              <StyleLearningPanel
                novel={novel}
                projectId={host.doc.getDocument().projectId}
                onNovelChange={onNovelChange}
                onAnalyzeStyle={handleAnalyzeStyle}
              />
            )}
            {activeTab === 'check' && (
              <div className="h-full p-3 overflow-auto space-y-2">
                <p className="text-xs font-medium text-muted-foreground">一致性检查结果</p>
                {(() => {
                  const issues = checkConsistency(novel);
                  if (issues.length === 0) return <p className="text-sm text-green-600 py-4 text-center">✅ 未发现一致性问题</p>;
                  return issues.map((issue, i) => (
                    <div key={i} className="rounded border p-2 text-xs space-y-0.5 bg-background">
                      <div className="flex items-center gap-2">
                        <span className={issue.type === 'name-variant' ? 'text-amber-500' : 'text-blue-500'}>
                          {issue.type === 'name-variant' ? '⚠️ 拼写变体' : '❓ 未注册名称'}
                        </span>
                        <span className="text-muted-foreground">{issue.chapterTitle}</span>
                      </div>
                      <div>{issue.detail}</div>
                      <div className="text-muted-foreground">建议：{issue.suggestion}</div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>

          {/* 右侧：AI 面板 */}
          {!aiCollapsed && (
            <div className="w-[380px] flex-shrink-0 flex flex-col min-h-0">
              <SettingsAIPanel
                host={host}
                documentId={documentId}
                novel={novel}
                activeTab={activeTab}
                activeChapterId={activeChapterId}
                onNovelChange={onNovelChange}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
