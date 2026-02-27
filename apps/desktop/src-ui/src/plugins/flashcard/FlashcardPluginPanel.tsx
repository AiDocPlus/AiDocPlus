import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { PluginPanelProps } from '../types';
import type { FlashcardData, Flashcard } from './types';
import { CARD_TYPE_LABELS } from './types';
import { buildFlashcardSystemPrompt, buildFlashcardUserPrompt, parseFlashcardsFromAiResponse } from './flashcardAiPrompts';
import { truncateContent } from '../_framework/pluginUtils';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { Layers, Download, Shuffle, CheckCircle, Circle, Trash2, Eye, EyeOff } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';

const DEFAULT_PROMPT = '从文档中提取关键知识点，生成记忆卡片。';

export function FlashcardPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [generating, setGenerating] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [prompt, setPrompt] = useState(
    (pluginData as Record<string, unknown>)?.lastPrompt as string || DEFAULT_PROMPT
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [studyMode, setStudyMode] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [studyFlipped, setStudyFlipped] = useState(false);
  const [filterMastered, setFilterMastered] = useState<'all' | 'unmastered' | 'mastered'>('all');
  const abortRef = useRef(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 4000);
    }
  };

  // 从 pluginData 加载
  useEffect(() => {
    if (pluginData && typeof pluginData === 'object' && 'cards' in (pluginData as Record<string, unknown>)) {
      const saved = pluginData as FlashcardData;
      setCards(saved.cards || []);
    }
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCards = useMemo(() => {
    if (filterMastered === 'unmastered') return cards.filter(c => !c.mastered);
    if (filterMastered === 'mastered') return cards.filter(c => c.mastered);
    return cards;
  }, [cards, filterMastered]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    if (pluginData && typeof pluginData === 'object') {
      onPluginDataChange({ ...(pluginData as Record<string, unknown>), lastPrompt: val });
    }
    host.docData!.markDirty();
  }, [pluginData, onPluginDataChange, host]);

  const saveCards = useCallback((newCards: Flashcard[]) => {
    setCards(newCards);
    const data: FlashcardData = { cards: newCards, generatedAt: Date.now(), lastPrompt: prompt };
    onPluginDataChange(data);
    host.docData!.markDirty();
  }, [prompt, onPluginDataChange, host]);

  const handleGenerate = useCallback(async () => {
    if (generating) {
      abortRef.current = true;
      setGenerating(false);
      showStatus('已中断生成');
      return;
    }

    const sourceContent = content || document.content || '';
    if (!sourceContent.trim()) {
      showStatus('文档内容为空，无法生成卡片', true);
      return;
    }

    abortRef.current = false;
    setGenerating(true);
    showStatus('正在从文档中提取知识点生成卡片...', false, true);

    try {
      const systemPrompt = buildFlashcardSystemPrompt();
      const userPrompt = buildFlashcardUserPrompt(truncateContent(sourceContent), prompt !== DEFAULT_PROMPT ? prompt : undefined);

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 8192 });
      if (abortRef.current) return;

      const parsed = parseFlashcardsFromAiResponse(result);
      if (!parsed || parsed.length === 0) {
        throw new Error('AI 返回的卡片数据格式无效');
      }

      saveCards(parsed);
      showStatus(`生成完成，共 ${parsed.length} 张卡片`);
      onRequestSave?.();
    } catch (err) {
      if (abortRef.current) return;
      showStatus(`生成失败：${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setGenerating(false);
    }
  }, [generating, content, document.content, prompt, host, saveCards, onRequestSave]);

  // 翻转卡片
  const toggleFlip = (id: string) => {
    setFlippedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 标记掌握
  const toggleMastered = (id: string) => {
    const newCards = cards.map(c => c.id === id ? { ...c, mastered: !c.mastered, lastReview: Date.now() } : c);
    saveCards(newCards);
  };

  // 删除卡片
  const deleteCard = (id: string) => {
    saveCards(cards.filter(c => c.id !== id));
    showStatus('已删除一张卡片');
  };

  // 随机打乱
  const shuffleCards = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    saveCards(shuffled);
    showStatus('已随机打乱卡片顺序');
  };

  // 学习模式
  const startStudy = () => {
    const studyCards = filterMastered === 'mastered' ? cards.filter(c => c.mastered) : cards.filter(c => !c.mastered);
    if (studyCards.length === 0) {
      showStatus('没有可学习的卡片', true);
      return;
    }
    setStudyMode(true);
    setStudyIndex(0);
    setStudyFlipped(false);
  };

  const studyCards = useMemo(() => {
    if (filterMastered === 'mastered') return cards.filter(c => c.mastered);
    return cards.filter(c => !c.mastered);
  }, [cards, filterMastered]);

  // 导出 Anki TSV
  const handleExportAnki = async () => {
    if (cards.length === 0) return;
    try {
      const tsv = cards.map(c => `${c.front}\t${c.back}`).join('\n');
      const safeTitle = (document.title || 'flashcards').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_anki.txt`, extensions: ['txt'] });
      if (!filePath) return;
      const data = Array.from(new TextEncoder().encode(tsv));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出 Anki 格式: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  // 导出 CSV
  const handleExportCsv = async () => {
    if (cards.length === 0) return;
    try {
      const header = '"正面","背面","类型","已掌握"';
      const body = cards.map(c =>
        `"${c.front.replace(/"/g, '""')}","${c.back.replace(/"/g, '""')}","${CARD_TYPE_LABELS[c.type] || c.type}","${c.mastered ? '是' : '否'}"`
      ).join('\n');
      const csv = '\uFEFF' + header + '\n' + body;
      const safeTitle = (document.title || 'flashcards').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_cards.csv`, extensions: ['csv'] });
      if (!filePath) return;
      const data = Array.from(new TextEncoder().encode(csv));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const masteredCount = cards.filter(c => c.mastered).length;
  const hasContent = cards.length > 0;

  // 工具栏
  const toolbarContent = (
    <>
      {hasContent && (
        <span className="text-xs text-muted-foreground">
          {masteredCount}/{cards.length} 已掌握
        </span>
      )}
      <div className="flex-1" />
      {hasContent && (
        <>
          <select
            value={filterMastered}
            onChange={e => setFilterMastered(e.target.value as typeof filterMastered)}
            className="h-7 text-xs border rounded-md px-1.5 bg-background"
            title="筛选卡片"
          >
            <option value="all">全部 ({cards.length})</option>
            <option value="unmastered">未掌握 ({cards.length - masteredCount})</option>
            <option value="mastered">已掌握 ({masteredCount})</option>
          </select>
          <Button variant="outline" size="sm" onClick={startStudy} className="gap-1 h-7 text-xs">
            <Eye className="h-3 w-3" />
            学习模式
          </Button>
          <Button variant="outline" size="sm" onClick={shuffleCards} className="gap-1 h-7 text-xs">
            <Shuffle className="h-3 w-3" />
            打乱
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAnki} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            Anki
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            CSV
          </Button>
        </>
      )}
    </>
  );

  // 学习模式视图
  if (studyMode && studyCards.length > 0) {
    const currentCard = studyCards[studyIndex];
    if (!currentCard) {
      setStudyMode(false);
      return null;
    }
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
          <span className="text-sm font-medium">学习模式</span>
          <span className="text-sm text-muted-foreground">{studyIndex + 1} / {studyCards.length}</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => setStudyMode(false)} className="h-7 text-xs">
            <EyeOff className="h-3 w-3 mr-1" />
            退出学习
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div
            className="w-full max-w-md cursor-pointer select-none"
            onClick={() => setStudyFlipped(!studyFlipped)}
          >
            <div className={`rounded-xl border-2 p-8 text-center transition-all duration-300 min-h-[200px] flex flex-col items-center justify-center ${
              studyFlipped ? 'bg-primary/5 border-primary/30' : 'bg-card border-border hover:border-primary/20'
            }`}>
              <div className="text-sm text-muted-foreground mb-3">
                {studyFlipped ? '背面 · 答案' : `正面 · ${CARD_TYPE_LABELS[currentCard.type] || currentCard.type}`}
              </div>
              <div className="text-base leading-relaxed whitespace-pre-wrap">
                {studyFlipped ? currentCard.back : currentCard.front}
              </div>
              {!studyFlipped && (
                <div className="text-sm text-muted-foreground mt-4">点击翻转查看答案</div>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3 px-3 py-3 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setStudyIndex(Math.max(0, studyIndex - 1)); setStudyFlipped(false); }}
            disabled={studyIndex === 0}
            className="h-8"
          >
            上一张
          </Button>
          <Button
            variant={currentCard.mastered ? 'default' : 'outline'}
            size="sm"
            onClick={() => toggleMastered(currentCard.id)}
            className="h-8 gap-1"
          >
            {currentCard.mastered ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            {currentCard.mastered ? '已掌握' : '标记掌握'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setStudyIndex(Math.min(studyCards.length - 1, studyIndex + 1)); setStudyFlipped(false); }}
            disabled={studyIndex >= studyCards.length - 1}
            className="h-8"
          >
            下一张
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PluginPanelLayout
      pluginIcon={<Layers className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title', { defaultValue: '知识卡片' })}
      pluginDesc={t('welcomeDesc', { defaultValue: '从文档中提取关键知识点，生成问答式记忆卡片，支持翻转学习和导出' })}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder', { defaultValue: '描述卡片生成需求...' })}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 生成卡片' })}
      generatingLabel={t('stopGenerate', { defaultValue: '中断生成' })}
      toolbar={toolbarContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        setCards([]);
        setPrompt(DEFAULT_PROMPT);
        onPluginDataChange(null);
        host.docData!.markDirty();
        showStatus('已清空全部卡片');
      }}
      sourceCode={hasContent ? JSON.stringify({ cards }, null, 2) : undefined}
      onSourceCodeSave={(code) => {
        try {
          const parsed = JSON.parse(code) as { cards: Flashcard[] };
          if (parsed.cards) saveCards(parsed.cards);
        } catch { /* ignore */ }
      }}
    >
      {/* 卡片网格 */}
      {filteredCards.length > 0 && (
        <div className="w-full h-full overflow-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredCards.map(card => {
              const isFlipped = flippedCards.has(card.id);
              return (
                <div
                  key={card.id}
                  className={`rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm ${
                    card.mastered ? 'border-green-300 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20' : 'border-border bg-card'
                  }`}
                  onClick={() => toggleFlip(card.id)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {CARD_TYPE_LABELS[card.type] || card.type}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); toggleMastered(card.id); }}
                        className={`cursor-pointer ${card.mastered ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'}`}
                        title={card.mastered ? '取消掌握' : '标记掌握'}
                      >
                        {card.mastered ? <CheckCircle className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteCard(card.id); }}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                        title="删除卡片"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap min-h-[3em]">
                    {isFlipped ? (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">答案：</div>
                        {card.back}
                      </div>
                    ) : (
                      card.front
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2 text-right">
                    {isFlipped ? '点击翻回正面' : '点击查看答案'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </PluginPanelLayout>
  );
}
