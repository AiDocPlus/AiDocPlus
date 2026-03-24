/**
 * StockHistoryView — 历史视图
 *
 * 功能：
 * - 时间线展示研究历史
 * - 显示交易记录、论点更新、新闻、笔记等节点
 * - 支持按类型和时间范围筛选
 * - 详情展开
 */

import { useState, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Clock, TrendingUp, TrendingDown, Target, FileText, AlertTriangle,
  ChevronDown, ChevronRight, Filter, Calendar, Wallet,
  Minus,
} from 'lucide-react';
import type { StockResearchDocumentContent } from './types';
import { formatRelativeTime, formatCurrency } from './utils';

// 历史事件类型
type HistoryEventType = 'trade' | 'thesis' | 'news' | 'note' | 'risk';

// 历史事件接口
interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  timestamp: number;
  title: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  data?: any;
}

interface StockHistoryViewProps {
  research: StockResearchDocumentContent;
  onSelectNote?: (noteId: string) => void;
}

export default function StockHistoryView({
  research, onSelectNote,
}: StockHistoryViewProps) {
  const { t } = useTranslation();
  const { trades, news, theses, notes, risk, stock } = research;

  // 筛选状态
  const [filterTypes, setFilterTypes] = useState<Set<HistoryEventType>>(new Set(['trade', 'thesis', 'news', 'note']));
  const [timeRange, setTimeRange] = useState<'all' | 'week' | 'month' | 'quarter' | 'year'>('all');
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // 构建历史事件列表
  const events = useMemo((): HistoryEvent[] => {
    const allEvents: HistoryEvent[] = [];

    // 交易记录
    trades.forEach(trade => {
      allEvents.push({
        id: `trade-${trade.id}`,
        type: 'trade',
        timestamp: trade.executedAt,
        title: trade.direction === 'buy'
          ? t('stockResearch.historyBuy', { defaultValue: '买入 {{qty}}股 @ {{price}}', qty: trade.quantity, price: trade.price })
          : trade.direction === 'sell'
          ? t('stockResearch.historySell', { defaultValue: '卖出 {{qty}}股 @ {{price}}', qty: trade.quantity, price: trade.price })
          : t('stockResearch.historyDividend', { defaultValue: '分红 {{amount}}', amount: formatCurrency(trade.amount, stock.currency) }),
        description: trade.note,
        icon: trade.direction === 'buy' ? TrendingUp : trade.direction === 'sell' ? TrendingDown : Wallet,
        iconColor: trade.direction === 'buy' ? 'text-green-500' : trade.direction === 'sell' ? 'text-red-500' : 'text-blue-500',
        data: trade,
      });
    });

    // 投资论点
    theses.forEach(thesis => {
      allEvents.push({
        id: `thesis-${thesis.id}`,
        type: 'thesis',
        timestamp: thesis.createdAt,
        title: thesis.title,
        description: thesis.content?.slice(0, 100) + (thesis.content && thesis.content.length > 100 ? '...' : ''),
        icon: thesis.status === 'bullish' ? TrendingUp : thesis.status === 'bearish' ? TrendingDown : Minus,
        iconColor: thesis.status === 'bullish' ? 'text-green-500' : thesis.status === 'bearish' ? 'text-red-500' : 'text-gray-500',
        data: thesis,
      });

      // 论点更新
      if (thesis.updatedAt !== thesis.createdAt) {
        allEvents.push({
          id: `thesis-update-${thesis.id}-${thesis.updatedAt}`,
          type: 'thesis',
          timestamp: thesis.updatedAt,
          title: t('stockResearch.historyThesisUpdate', { defaultValue: '更新论点：{{title}}', title: thesis.title }),
          icon: Target,
          iconColor: 'text-amber-500',
          data: thesis,
        });
      }
    });

    // 新闻
    news.forEach(n => {
      allEvents.push({
        id: `news-${n.id}`,
        type: 'news',
        timestamp: n.publishedAt,
        title: n.title,
        description: n.summary,
        icon: FileText,
        iconColor: n.sentiment === 'positive' ? 'text-green-500' : n.sentiment === 'negative' ? 'text-red-500' : 'text-gray-500',
        data: n,
      });
    });

    // 笔记
    notes.forEach(note => {
      allEvents.push({
        id: `note-${note.id}`,
        type: 'note',
        timestamp: note.createdAt,
        title: note.title,
        description: note.content?.slice(0, 100) + (note.content && note.content.length > 100 ? '...' : ''),
        icon: FileText,
        iconColor: 'text-blue-500',
        data: note,
      });

      // 笔记更新
      if (note.updatedAt !== note.createdAt) {
        allEvents.push({
          id: `note-update-${note.id}-${note.updatedAt}`,
          type: 'note',
          timestamp: note.updatedAt,
          title: t('stockResearch.historyNoteUpdate', { defaultValue: '更新笔记：{{title}}', title: note.title }),
          icon: FileText,
          iconColor: 'text-blue-400',
          data: note,
        });
      }
    });

    // 风险评估
    if (risk) {
      allEvents.push({
        id: `risk-${risk.assessedAt}`,
        type: 'risk',
        timestamp: risk.assessedAt,
        title: t('stockResearch.historyRiskAssessment', { defaultValue: '风险评估：{{level}}', level: risk.level }),
        description: risk.factors.slice(0, 3).join('、'),
        icon: AlertTriangle,
        iconColor: risk.level === 'low' ? 'text-green-500' : risk.level === 'medium' ? 'text-yellow-500' : 'text-red-500',
        data: risk,
      });
    }

    // 按时间排序（最新在前）
    return allEvents.sort((a, b) => b.timestamp - a.timestamp);
  }, [trades, news, theses, notes, risk, stock.currency, t]);

  // 应用筛选
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // 类型筛选
    if (filterTypes.size < 4) {
      filtered = filtered.filter(e => filterTypes.has(e.type));
    }

    // 时间范围筛选
    if (timeRange !== 'all') {
      const now = Date.now();
      const ranges: Record<string, number> = {
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        quarter: 90 * 24 * 60 * 60 * 1000,
        year: 365 * 24 * 60 * 60 * 1000,
      };
      const range = ranges[timeRange];
      if (range) {
        filtered = filtered.filter(e => now - e.timestamp <= range);
      }
    }

    return filtered;
  }, [events, filterTypes, timeRange]);

  // 切换类型筛选
  const toggleFilterType = (type: HistoryEventType) => {
    setFilterTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // 切换事件展开
  const toggleEventExpand = (eventId: string) => {
    setExpandedEvent(prev => prev === eventId ? null : eventId);
  };

  // 按日期分组
  const groupedEvents = useMemo(() => {
    const groups: { date: string; events: HistoryEvent[] }[] = [];
    let currentDate = '';
    let currentGroup: HistoryEvent[] = [];

    filteredEvents.forEach(event => {
      const eventDate = new Date(event.timestamp).toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      if (eventDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, events: currentGroup });
        }
        currentDate = eventDate;
        currentGroup = [];
      }
      currentGroup.push(event);
    });

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, events: currentGroup });
    }

    return groups;
  }, [filteredEvents]);

  // 类型筛选按钮
  const typeFilters: { type: HistoryEventType; label: string; icon: React.ComponentType<{ className?: string }>; color: string }[] = [
    { type: 'trade', label: t('stockResearch.trades', { defaultValue: '交易' }), icon: Wallet, color: 'text-green-500' },
    { type: 'thesis', label: t('stockResearch.theses', { defaultValue: '论点' }), icon: Target, color: 'text-amber-500' },
    { type: 'news', label: t('stockResearch.news', { defaultValue: '新闻' }), icon: FileText, color: 'text-purple-500' },
    { type: 'note', label: t('stockResearch.notes', { defaultValue: '笔记' }), icon: FileText, color: 'text-blue-500' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="flex gap-1">
          {typeFilters.map(({ type, label, icon: Icon, color }) => (
            <Button
              key={type}
              variant={filterTypes.has(type) ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => toggleFilterType(type)}
            >
              <Icon className={cn('h-3 w-3', color)} />
              {label}
            </Button>
          ))}
        </div>
        <div className="flex-1" />
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="h-6 text-xs px-2 border rounded bg-background"
        >
          <option value="all">{t('stockResearch.allTime', { defaultValue: '全部时间' })}</option>
          <option value="week">{t('stockResearch.lastWeek', { defaultValue: '最近一周' })}</option>
          <option value="month">{t('stockResearch.lastMonth', { defaultValue: '最近一月' })}</option>
          <option value="quarter">{t('stockResearch.lastQuarter', { defaultValue: '最近三月' })}</option>
          <option value="year">{t('stockResearch.lastYear', { defaultValue: '最近一年' })}</option>
        </select>
      </div>

      {/* 时间线 */}
      <div className="flex-1 overflow-y-auto">
        {groupedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Clock className="h-8 w-8 mb-2 opacity-30" />
            <div className="text-sm">{t('stockResearch.noHistory', { defaultValue: '暂无历史记录' })}</div>
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {groupedEvents.map(group => (
              <div key={group.date}>
                {/* 日期标题 */}
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{group.date}</span>
                  <span className="text-[10px] text-muted-foreground">({group.events.length})</span>
                </div>

                {/* 事件列表 */}
                <div className="relative pl-4 border-l-2 border-border space-y-2">
                  {group.events.map(event => {
                    const Icon = event.icon;
                    const isExpanded = expandedEvent === event.id;

                    return (
                      <div
                        key={event.id}
                        className={cn(
                          'relative bg-card border rounded-lg p-2 cursor-pointer transition-colors',
                          'hover:bg-muted/30',
                          isExpanded && 'ring-1 ring-primary',
                        )}
                        onClick={() => toggleEventExpand(event.id)}
                      >
                        {/* 时间线圆点 */}
                        <div className="absolute -left-[21px] top-3 w-2 h-2 rounded-full bg-background border-2 border-muted-foreground" />

                        {/* 事件头部 */}
                        <div className="flex items-start gap-2">
                          <Icon className={cn('h-4 w-4 mt-0.5', event.iconColor)} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{event.title}</div>
                            {event.description && !isExpanded && (
                              <div className="text-[10px] text-muted-foreground line-clamp-1">{event.description}</div>
                            )}
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {formatRelativeTime(event.timestamp)}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>

                        {/* 展开详情 */}
                        {isExpanded && (
                          <div className="mt-2 pt-2 border-t text-xs space-y-1">
                            {event.type === 'trade' && event.data && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('stockResearch.direction')}:</span>
                                  <span className={event.iconColor}>
                                    {event.data.direction === 'buy' ? t('stockResearch.tradeBuy') :
                                     event.data.direction === 'sell' ? t('stockResearch.tradeSell') :
                                     t('stockResearch.tradeDividend')}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('stockResearch.quantity')}:</span>
                                  <span>{event.data.quantity}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('stockResearch.price')}:</span>
                                  <span>{formatCurrency(event.data.price, stock.currency)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('stockResearch.amount')}:</span>
                                  <span>{formatCurrency(event.data.amount, stock.currency)}</span>
                                </div>
                              </>
                            )}

                            {event.type === 'thesis' && event.data && (
                              <>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('stockResearch.status')}:</span>
                                  <span className={event.iconColor}>
                                    {event.data.status === 'bullish' ? t('stockResearch.thesisBullish') :
                                     event.data.status === 'bearish' ? t('stockResearch.thesisBearish') :
                                     t('stockResearch.thesisNeutral')}
                                  </span>
                                </div>
                                {event.data.content && (
                                  <div className="mt-1 p-2 bg-muted/30 rounded text-[10px]">
                                    {event.data.content}
                                  </div>
                                )}
                                {event.data.targetPrice && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('stockResearch.targetPrice')}:</span>
                                    <span>{formatCurrency(event.data.targetPrice, stock.currency)}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {event.type === 'news' && event.data && (
                              <>
                                {event.data.summary && (
                                  <div className="p-2 bg-muted/30 rounded text-[10px]">
                                    {event.data.summary}
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">{t('stockResearch.sentiment')}:</span>
                                  <span className={event.iconColor}>
                                    {event.data.sentiment === 'positive' ? t('stockResearch.positive') :
                                     event.data.sentiment === 'negative' ? t('stockResearch.negative') :
                                     t('stockResearch.neutral')}
                                  </span>
                                </div>
                                {event.data.source && (
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">{t('stockResearch.source')}:</span>
                                    <span>{event.data.source}</span>
                                  </div>
                                )}
                              </>
                            )}

                            {event.type === 'note' && event.data && (
                              <>
                                {event.data.content && (
                                  <div className="p-2 bg-muted/30 rounded text-[10px] max-h-32 overflow-y-auto">
                                    {event.data.content}
                                  </div>
                                )}
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-5 text-[10px] p-0 mt-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectNote?.(event.data.id);
                                  }}
                                >
                                  {t('stockResearch.openNote', { defaultValue: '打开笔记' })}
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
