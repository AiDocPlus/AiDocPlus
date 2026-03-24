/**
 * EssayDashboard.tsx — 散文写作仪表盘
 *
 * Phase 6: 写作进度与统计一览（增强版）
 * - 写作进度圆环 + 阶段标签
 * - 四格统计卡片（字数/段落/修辞/阅读时间）
 * - 段落角色分布（横向彩色条形）
 * - 修辞类型分布
 * - 素材库统计
 * - 意象感官分布
 * - 文档信息摘要
 * - 快捷操作按钮
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  FileText, BookOpen, Clock, Zap, Target,
  Award, TrendingUp, AlignLeft, Download, Camera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EssayDocumentContent } from './types';
import { getWordCount, getReadingTime, getParagraphCount } from './types';
import {
  RHETORIC_TYPE_LABEL,
  RHETORIC_BG_COLORS,
  IMAGERY_SENSE_LABEL,
  IMAGERY_SENSE_COLORS,
  MATERIAL_TYPE_LABEL,
} from './constants';

interface EssayDashboardProps {
  essay: EssayDocumentContent;
  content: string;
  onExport?: () => void;
  onSnapshot?: () => void;
  className?: string;
}

// ── 圆形进度条 ──
function CircleProgress({ pct, size = 80, strokeWidth = 7, color = 'text-primary', children }: {
  pct: number; size?: number; strokeWidth?: number; color?: string; children?: React.ReactNode;
}) {
  const r = (size - strokeWidth * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" strokeWidth={strokeWidth}
          fill="none" className="text-muted/40" />
        <circle cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" strokeWidth={strokeWidth}
          fill="none" className={color}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

// ── 统计卡片 ──
function StatCard({ icon, value, label, sub, color }: {
  icon: React.ReactNode; value: string | number; label: string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-lg border p-2.5 flex items-start gap-2">
      <div className={cn('p-1.5 rounded-md flex-shrink-0', color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-base font-bold tabular-nums leading-tight">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── 横向分布条 ──
function DistBar({ items }: {
  items: { label: string; count: number; color: string }[];
}) {
  const total = items.reduce((s, it) => s + it.count, 0);
  if (total === 0) return <div className="text-[11px] text-muted-foreground py-1">暂无数据</div>;
  return (
    <div className="space-y-1.5">
      {items.map(it => {
        const pct = it.count / total;
        return (
          <div key={it.label} className="flex items-center gap-2">
            <span className="w-10 text-[11px] text-muted-foreground flex-shrink-0 text-right">{it.label}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', it.color)}
                style={{ width: `${Math.max(pct * 100, it.count > 0 ? 3 : 0)}%` }}
              />
            </div>
            <span className="w-5 text-right text-[11px] text-muted-foreground flex-shrink-0">{it.count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── 素材背景色（仅用于仪表盘展示条形）──
const MATERIAL_COLORS: Record<string, string> = {
  inspiration: 'bg-yellow-400', quote: 'bg-blue-400',
  imagery: 'bg-green-400', reference: 'bg-purple-400',
};

// ── 意象关键词到感官类型的简单映射（用于统计分布）──
const IMAGERY_SENSE_KEYWORDS: Record<string, string[]> = {
  visual:    ['光', '色', '红', '蓝', '绿', '白', '黑', '明', '暗', '影', '亮', '照', '映', '望', '看', '见'],
  auditory:  ['声', '音', '鸣', '响', '吟', '唱', '哭', '笑', '雷', '风声', '雨声', '歌', '曲'],
  olfactory: ['香', '臭', '味', '芳', '馨', '熏', '闻', '嗅'],
  tactile:   ['凉', '暖', '热', '冷', '软', '硬', '触', '抚', '握', '滑', '粗'],
  gustatory: ['甜', '苦', '辣', '酸', '咸', '涩', '尝', '饮', '食'],
};

function detectImagerySense(keyword: string): string {
  for (const [sense, words] of Object.entries(IMAGERY_SENSE_KEYWORDS)) {
    if (words.some(w => keyword.includes(w))) return sense;
  }
  return 'abstract';
}

export default function EssayDashboard({
  essay,
  content,
  onExport,
  onSnapshot,
  className,
}: EssayDashboardProps) {
  const wordCount = useMemo(() => getWordCount(content), [content]);
  const paragraphCount = useMemo(() => getParagraphCount(content), [content]);
  const readingTime = useMemo(() => getReadingTime(content), [content]);
  const targetWordCount = essay.settings.targetWordCount || 1500;
  const wordPct = targetWordCount > 0 ? wordCount / targetWordCount : 0;

  // ── 段落角色分布 ──
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { open: 0, carry: 0, turn: 0, close: 0, none: 0 };
    for (const p of essay.paragraphs) counts[p.role ?? 'none'] = (counts[p.role ?? 'none'] ?? 0) + 1;
    return counts;
  }, [essay.paragraphs]);

  const totalRoleAssigned = ['open', 'carry', 'turn', 'close'].reduce((s, k) => s + (roleCounts[k] ?? 0), 0);
  const assignmentPct = essay.paragraphs.length > 0 ? totalRoleAssigned / essay.paragraphs.length : 0;

  // ── 修辞类型分布 ──
  const rhetoricTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of (essay.rhetorics ?? [])) {
      counts[r.type] = (counts[r.type] ?? 0) + 1;
    }
    return counts;
  }, [essay.rhetorics]);

  const rhetoricItems = useMemo(() =>
    Object.entries(rhetoricTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([type, count]) => ({
        label: RHETORIC_TYPE_LABEL[type] ?? type,
        count,
        color: RHETORIC_BG_COLORS[type] ?? 'bg-muted',
      })),
  [rhetoricTypeCounts]);

  // ── 意象感官分布（从 imagery.keyword 推断感官类型）──
  const imageryItems = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const img of (essay.imagery ?? [])) {
      const sense = detectImagerySense(img.keyword);
      counts[sense] = (counts[sense] ?? 0) + 1;
    }
    return Object.entries(counts).map(([sense, count]) => ({
      label: IMAGERY_SENSE_LABEL[sense] ?? sense,
      count,
      color: IMAGERY_SENSE_COLORS[sense] ?? 'bg-muted',
    }));
  }, [essay.imagery]);

  // ── 素材类型分布 ──
  const materialItems = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of (essay.materials ?? [])) counts[m.type] = (counts[m.type] ?? 0) + 1;
    return Object.entries(counts).map(([type, count]) => ({
      label: MATERIAL_TYPE_LABEL[type] ?? type,
      count,
      color: MATERIAL_COLORS[type] ?? 'bg-muted',
    }));
  }, [essay.materials]);

  // ── 写作阶段 ──
  const phase = wordPct < 0.2 ? '构思阶段'
              : wordPct < 0.5 ? '初稿阶段'
              : wordPct < 0.8 ? '完善阶段'
              : wordPct < 1.0 ? '收尾阶段'
              : '完成';

  const roleItems: { label: string; count: number; color: string }[] = [
    { label: '起', count: roleCounts.open ?? 0,  color: 'bg-blue-400' },
    { label: '承', count: roleCounts.carry ?? 0, color: 'bg-green-400' },
    { label: '转', count: roleCounts.turn ?? 0,  color: 'bg-orange-400' },
    { label: '合', count: roleCounts.close ?? 0, color: 'bg-purple-400' },
    { label: '未标', count: roleCounts.none ?? 0,  color: 'bg-muted-foreground/30' },
  ];

  return (
    <div className={cn('flex flex-col gap-3 p-3 overflow-y-auto text-xs', className)}>

      {/* ── 写作进度 ── */}
      <section>
        <h3 className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
          <Target className="h-3 w-3" />写作进度
        </h3>
        <div className="flex items-center gap-3">
          <CircleProgress
            pct={wordPct}
            size={72}
            strokeWidth={6}
            color={wordPct >= 1 ? 'text-green-500' : 'text-primary'}
          >
            <div className="text-center">
              <div className="text-sm font-bold leading-tight">{Math.round(wordPct * 100)}%</div>
              <div className="text-[9px] text-muted-foreground">{phase}</div>
            </div>
          </CircleProgress>

          <div className="flex-1 space-y-1.5">
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-muted-foreground">字数</span>
                <span className="font-medium">{wordCount.toLocaleString()} / {targetWordCount.toLocaleString()}</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(wordPct * 100, 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-0.5">
                <span className="text-muted-foreground">段落角色</span>
                <span>{Math.round(assignmentPct * 100)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(assignmentPct * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 四格统计 ── */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard icon={<FileText className="h-3.5 w-3.5 text-primary" />}
          value={wordCount.toLocaleString()} label="总字数"
          sub={`目标 ${targetWordCount} 字`} color="bg-primary/10" />
        <StatCard icon={<AlignLeft className="h-3.5 w-3.5 text-blue-600" />}
          value={paragraphCount} label="段落数"
          sub={`标注 ${totalRoleAssigned} 段`} color="bg-blue-50 dark:bg-blue-950/30" />
        <StatCard icon={<Clock className="h-3.5 w-3.5 text-green-600" />}
          value={`${readingTime} 分`} label="阅读时长"
          sub="300字/分钟" color="bg-green-50 dark:bg-green-950/30" />
        <StatCard icon={<Zap className="h-3.5 w-3.5 text-orange-500" />}
          value={(essay.rhetorics?.length ?? 0) + (essay.imagery?.length ?? 0)}
          label="高亮标注"
          sub={`修辞 ${essay.rhetorics?.length ?? 0} · 意象 ${essay.imagery?.length ?? 0}`}
          color="bg-orange-50 dark:bg-orange-950/30" />
      </div>

      {/* ── 段落角色分布 ── */}
      {essay.paragraphs.length > 0 && (
        <section className="rounded-lg border p-2.5">
          <p className="font-medium text-[11px] mb-2 flex items-center gap-1 text-muted-foreground">
            <BookOpen className="h-3 w-3" />段落角色分布
          </p>
          <DistBar items={roleItems} />
        </section>
      )}

      {/* ── 修辞类型分布 ── */}
      {rhetoricItems.length > 0 && (
        <section className="rounded-lg border p-2.5">
          <p className="font-medium text-[11px] mb-2 flex items-center gap-1 text-muted-foreground">
            <TrendingUp className="h-3 w-3" />修辞类型分布
          </p>
          <DistBar items={rhetoricItems} />
        </section>
      )}

      {/* ── 意象标注 ── */}
      {imageryItems.length > 0 && (
        <section className="rounded-lg border p-2.5">
          <p className="font-medium text-[11px] mb-2 flex items-center gap-1 text-muted-foreground">
            <Award className="h-3 w-3" />意象标注
          </p>
          <DistBar items={imageryItems} />
        </section>
      )}

      {/* ── 素材库 ── */}
      {essay.materials.length > 0 && (
        <section className="rounded-lg border p-2.5">
          <p className="font-medium text-[11px] mb-2 flex items-center gap-1 text-muted-foreground">
            <Award className="h-3 w-3" />素材库（{essay.materials.length} 条）
          </p>
          <DistBar items={materialItems} />
        </section>
      )}

      {/* ── 文档信息 ── */}
      <section className="rounded-lg border p-2.5 space-y-1.5 text-[11px] text-muted-foreground">
        <p className="font-medium text-foreground text-xs flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />文档信息
        </p>
        {[
          ['散文类型', essay.settings.subtype],
          ['情感基调', essay.settings.mood || '未设置'],
          ['写作风格', essay.settings.targetStyle || '自由'],
          ['主题线索', essay.settings.theme || '—'],
          ['关键意象', essay.settings.keyImagery?.join('、') || '—'],
          ['快照数', String(essay.snapshots?.length ?? 0)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span>{k}</span>
            <span className="text-foreground truncate max-w-[120px] text-right">{v}</span>
          </div>
        ))}
      </section>

      {/* ── 快捷操作 ── */}
      <div className="flex flex-col gap-1.5 pb-1">
        {onSnapshot && (
          <Button size="sm" variant="outline" className="w-full text-xs justify-start h-7" onClick={onSnapshot}>
            <Camera className="h-3.5 w-3.5 mr-2" />创建快照
          </Button>
        )}
        {onExport && (
          <Button size="sm" variant="outline" className="w-full text-xs justify-start h-7" onClick={onExport}>
            <Download className="h-3.5 w-3.5 mr-2" />导出文档
          </Button>
        )}
      </div>
    </div>
  );
}
