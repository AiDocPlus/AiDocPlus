/**
 * EssayWritingPrompt.tsx — 写作灵感面板
 *
 * Phase 4: 写作灵感与每日提示
 * - AI 生成每日写作提示
 * - 主题联想词发散
 * - 名篇赏析片段
 * - 一键收集到素材库
 * - 定时写作练习
 */

import { useState, useCallback } from 'react';
import { Lightbulb, RefreshCw, BookMarked, Clock, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EssayDocumentContent, MaterialType } from './types';
import type { EssayAISidebarRef } from './EssayAISidebar';

// ── 内置灵感卡片（按子类型）──
const INSPIRATION_CARDS: { subtype: string; items: { title: string; content: string; source: string }[] }[] = [
  {
    subtype: 'lyrical',
    items: [
      { title: '朱自清·荷塘月色', content: '月光如流水一般，静静地泻在这一片叶子和花上。薄薄的青雾浮起在荷塘里。叶子和花仿佛在牛乳中洗过一样；又像笼着轻纱的梦。', source: '《荷塘月色》朱自清' },
      { title: '余光中·乡愁', content: '小时候，乡愁是一枚小小的邮票，我在这头，母亲在那头。', source: '《乡愁》余光中' },
      { title: '林清玄·心田上的百合花', content: '在最高峰长出了美丽的百合花……不管有没有人欣赏，不管你们怎么看我，我都要开花！', source: '《心田上的百合花》林清玄' },
    ],
  },
  {
    subtype: 'narrative',
    items: [
      { title: '史铁生·合欢树', content: '我坐在小公园安静的树林里，闭上眼睛，想，上帝为什么早早地召母亲回去呢？很久很久，迷迷糊糊的我听见了回答：她心里太苦了，上帝看她受不住了，就召她回去。', source: '《合欢树》史铁生' },
      { title: '汪曾祺·故乡的野菜', content: '我的家乡是水乡。出鸭。高邮鸭是著名的鸭种。鸭多，鸭蛋也多。高邮人也善于腌鸭蛋。', source: '《端午的鸭蛋》汪曾祺' },
      { title: '张小娴·余生', content: '世界上最遥远的距离，不是生与死的距离，不是天各一方，而是我就站在你面前，你却不知道我爱你。', source: '《余生》张小娴' },
    ],
  },
  {
    subtype: 'philosophical',
    items: [
      { title: '余秋雨·道士塔', content: '我好恨！恨我没有早生几个世纪……那么，即便所有的损坏都逃不过，也要保留下几个流落海外的学者的名字和耻辱。', source: '《道士塔》余秋雨' },
      { title: '冰心·繁星', content: '成功的花，人们只惊羡她现时的明艳！然而当初她的芽儿，浸透了奋斗的泪泉，洒遍了牺牲的血雨。', source: '《繁星》冰心' },
      { title: '史铁生·我与地坛', content: '死是一件不必急于求成的事，死是一个必然会降临的节日。', source: '《我与地坛》史铁生' },
    ],
  },
];

// ── 每日写作提示（静态备用，AI 未能响应时使用）──
const DAILY_PROMPTS = [
  '写一个你最难忘的清晨，从感官细节出发',
  '描述一种消逝中的手艺或职业，你曾见过它的最后守护者',
  '以"那一年的冬天"为开头，写一段记忆',
  '写一个人的背影——不必说他是谁',
  '描写你家乡最普通的一道食物，让它成为一段记忆的载体',
  '以月亮为视角，写一个它所见证的故事',
  '写一封你永远不会寄出的信',
  '描述一个你经常路过却从未进入的地方',
  '写"再也回不去"这个主题，选择一个具体的物件作为载体',
  '以颜色为题——绿色的记忆，或红色的告别',
];

interface EssayWritingPromptProps {
  essay: EssayDocumentContent;
  aiSidebarRef?: React.RefObject<EssayAISidebarRef | null>;
  onAddMaterial: (content: string, type: MaterialType) => void;
  onInsertToEditor: (text: string) => void;
}

export default function EssayWritingPrompt({
  essay,
  aiSidebarRef,
  onAddMaterial,
  onInsertToEditor,
}: EssayWritingPromptProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'classics' | 'timer'>('daily');
  const [dailyPrompt, setDailyPrompt] = useState(() =>
    DAILY_PROMPTS[Math.floor(Math.random() * DAILY_PROMPTS.length)],
  );
  const [associationInput, setAssociationInput] = useState('');
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTotal, setTimerTotal] = useState(5 * 60); // 默认5分钟
  const timerRef = useState<ReturnType<typeof setInterval> | null>(null);

  // ── 换一条写作提示 ──
  const refreshPrompt = useCallback(() => {
    const current = dailyPrompt;
    const others = DAILY_PROMPTS.filter(p => p !== current);
    setDailyPrompt(others[Math.floor(Math.random() * others.length)]);
  }, [dailyPrompt]);

  // ── AI 生成联想词 ──
  const handleAssociation = useCallback(() => {
    if (!associationInput.trim() || !aiSidebarRef?.current) return;
    aiSidebarRef.current.sendMessage(
      `请以「${associationInput.trim()}」为核心，发散联想5-8个适合写入散文的相关意象、场景或情感词汇，每个词后面加一句简短的写法提示。格式：词汇 — 提示`,
    );
  }, [associationInput, aiSidebarRef]);

  // ── AI 扩展写作提示 ──
  const handleExpandPrompt = useCallback((prompt: string) => {
    if (!aiSidebarRef?.current) return;
    aiSidebarRef.current.sendMessage(
      `请基于以下写作题目，给出3个不同的写作角度和切入方式，每个方向附一个开篇示例句（50字以内）：\n\n题目：${prompt}`,
    );
  }, [aiSidebarRef]);

  // ── 计时器 ──
  const startTimer = useCallback((minutes: number) => {
    setTimerTotal(minutes * 60);
    setTimerSeconds(0);
    setTimerRunning(true);
    if (timerRef[0]) clearInterval(timerRef[0]);
    const id = setInterval(() => {
      setTimerSeconds(s => {
        if (s >= minutes * 60 - 1) {
          clearInterval(id);
          setTimerRunning(false);
          return minutes * 60;
        }
        return s + 1;
      });
    }, 1000);
    timerRef[0] = id;
  }, [timerRef]);

  const stopTimer = useCallback(() => {
    if (timerRef[0]) clearInterval(timerRef[0]);
    timerRef[0] = null;
    setTimerRunning(false);
  }, [timerRef]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ── 获取与当前子类型匹配的名篇 ──
  const classics = INSPIRATION_CARDS.find(c => c.subtype === essay.settings.subtype)?.items
    ?? INSPIRATION_CARDS[0].items;

  return (
    <div className="flex flex-col h-full text-xs">

      {/* ── Tab 切换 ── */}
      <div className="flex border-b flex-shrink-0">
        {[
          { key: 'daily', label: '灵感提示', icon: <Lightbulb className="h-3 w-3" /> },
          { key: 'classics', label: '名篇赏析', icon: <BookMarked className="h-3 w-3" /> },
          { key: 'timer', label: '定时写作', icon: <Clock className="h-3 w-3" /> },
        ].map(tab => (
          <button
            key={tab.key}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 text-[11px] transition-colors border-b-2',
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">

        {/* ── 每日灵感提示 ── */}
        {activeTab === 'daily' && (
          <>
            {/* 今日题目 */}
            <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <Lightbulb className="h-3.5 w-3.5" />
                  今日写作题目
                </span>
                <button
                  className="text-amber-600 hover:text-amber-800 dark:text-amber-400"
                  onClick={refreshPrompt}
                  title="换一题"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              </div>
              <p className="text-sm text-amber-900 dark:text-amber-300 leading-relaxed font-medium">
                {dailyPrompt}
              </p>
              <div className="flex gap-1.5 mt-2">
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-amber-300"
                  onClick={() => onInsertToEditor(`# ${dailyPrompt}\n\n`)}>
                  用此题目开始
                </Button>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-amber-300"
                  onClick={() => handleExpandPrompt(dailyPrompt)}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI 扩展方向
                </Button>
              </div>
            </div>

            {/* 联想词发散 */}
            <div className="rounded-lg border p-3">
              <p className="font-medium mb-2 text-muted-foreground">意象联想</p>
              <div className="flex gap-1.5">
                <input
                  className="flex-1 text-xs px-2 py-1 border rounded bg-background"
                  placeholder={`输入词语，如"${essay.settings.keyImagery[0] || '月色'}"…`}
                  value={associationInput}
                  onChange={e => setAssociationInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAssociation()}
                />
                <Button size="sm" className="h-7 text-[11px] px-2" onClick={handleAssociation}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  发散
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">AI 将为你联想相关意象，结果显示在右侧聊天框</p>
            </div>

            {/* 当前主题关键词 */}
            {essay.settings.keyImagery.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="font-medium mb-2 text-muted-foreground">已设关键意象</p>
                <div className="flex flex-wrap gap-1">
                  {essay.settings.keyImagery.map((img, i) => (
                    <button
                      key={i}
                      className="text-[11px] px-2 py-0.5 rounded bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
                      onClick={() => setAssociationInput(img)}
                    >
                      {img}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 名篇赏析 ── */}
        {activeTab === 'classics' && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-[11px]">
              以下为与当前散文类型（{essay.settings.subtype}）相关的名篇精选，可收藏到素材库
            </p>
            {classics.map((item, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-1.5">
                <div className="font-medium text-[11px] text-primary">{item.title}</div>
                <p className="text-xs leading-relaxed text-foreground italic">
                  「{item.content}」
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">—— {item.source}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm" variant="ghost" className="h-5 text-[10px] px-1.5"
                      onClick={() => onAddMaterial(item.content + `\n—— ${item.source}`, 'quote')}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      收藏
                    </Button>
                    <Button
                      size="sm" variant="ghost" className="h-5 text-[10px] px-1.5"
                      onClick={() => onInsertToEditor(item.content)}
                    >
                      插入
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 定时写作练习 ── */}
        {activeTab === 'timer' && (
          <div className="space-y-3">
            {/* 计时器显示 */}
            <div className="rounded-lg border p-4 text-center">
              <div className={cn(
                'text-4xl font-mono font-bold tabular-nums mb-2',
                timerRunning ? 'text-primary' : 'text-muted-foreground',
              )}>
                {timerRunning || timerSeconds > 0
                  ? formatTime(timerSeconds)
                  : formatTime(timerTotal)
                }
              </div>
              {timerRunning && (
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000"
                    style={{ width: `${(timerSeconds / timerTotal) * 100}%` }}
                  />
                </div>
              )}
              {timerSeconds >= timerTotal && timerTotal > 0 && !timerRunning && (
                <p className="text-green-600 font-medium text-sm mb-2">🎉 时间到！</p>
              )}
            </div>

            {/* 时长选择 */}
            {!timerRunning && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-[11px] text-center">选择练习时长</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20].map(min => (
                    <button
                      key={min}
                      className={cn(
                        'py-2 rounded border text-xs font-medium transition-colors',
                        timerTotal === min * 60 && !timerRunning
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted hover:bg-muted/80 border-border',
                      )}
                      onClick={() => startTimer(min)}
                    >
                      {min}分钟
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 停止按钮 */}
            {timerRunning && (
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={stopTimer}>
                停止计时
              </Button>
            )}

            {/* 练习说明 */}
            <div className="rounded border bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">自由书写练习</p>
              <p>计时开始后，不停笔地写下你想到的任何内容。</p>
              <p>不追求完美，不修改，只是流动地写。</p>
              <p>结束后可以从中发现有价值的素材和灵感。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
