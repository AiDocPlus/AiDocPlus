/**
 * StockResearchAISidebar — 股票研究 AI 助手侧栏（基于 DocTypeAIChatBase）
 *
 * 重构后功能：
 * - 使用 DocTypeAIChatBase 提供流式输出、Markdown渲染、think标签解析
 * - headerSlot: 一键研究按钮 + AI服务选择 + 快捷操作下拉菜单 + 上下文模式切换
 * - emptyStateSlot: 股票信息概览卡片
 * - messageActions: 插入到笔记按钮
 * - 系统提示词动态构建
 */

import { useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { invoke } from '@tauri-apps/api/core';
import {
  Sparkles, Settings, ChevronDown,
  TrendingUp, FileText, BarChart3, Loader2, Zap,
  DollarSign, LineChart, Lightbulb, Target, ScrollText, RotateCcw, RefreshCw,
  FileEdit, AlertTriangle,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DocTypeEditorProps, DocTypeToolScope } from '@/doctype-sdk/types';
import DocTypeAIChatBase, { sendDocTypeAIMessage } from '@/document-types/_shared/DocTypeAIChatBase';
import type { DocTypeChatMsg } from '@/document-types/_shared/DocTypeChatMessage';
import { useSettingsStore, getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { useShallow } from 'zustand/react/shallow';
import type { StockResearchDocumentContent } from './types';
import {
  buildStockResearchContext, fillPromptTemplate,
  getOverallDataFreshness,
  type ContextMode,
} from './stockResearchContext';
import {
  getQuickActionsByCategory, getPromptForAction,
  type QuickAction, type QuickActionCategory,
} from './stockResearchQuickActions';
import { QUICK_ACTION_CATEGORIES } from './stockResearchQuickActions';
import { RESEARCH_PHASES, DEFAULT_ONE_CLICK_PROMPT } from './constants';
import { parseAIResearchOutput, type AIResearchOutput } from './ai/outputParser';
import ResearchProgressIndicator, {
  createResearchSteps, updateStepsFromMessage, finalizeResearchStepsOnSuccess, type ResearchStep,
} from './ResearchProgressIndicator';

interface StockResearchAISidebarProps {
  host: DocTypeEditorProps['host'];
  document: DocTypeEditorProps['document'];
  research: StockResearchDocumentContent;
  onInsertToDoc: (text: string) => void;
  /** 应用研究结果回调 */
  onApplyResearchResult: (output: AIResearchOutput) => void;
  /** 打开 Tushare 设置（由工作台包一层 Dialog） */
  onOpenTushareSettings?: () => void;
  /** 设置保存或关闭后递增，用于重新校验 Token */
  tushareRecheckNonce?: number;
}

// 分类图标映射
const CATEGORY_ICONS: Record<QuickActionCategory, typeof TrendingUp> = {
  financial: DollarSign,
  technical: LineChart,
  thesis: Lightbulb,
  comparison: BarChart3,
  report: FileText,
  refresh: RefreshCw,
};

// 分类颜色映射
function toolScopeForQuickAction(action: QuickAction): DocTypeToolScope {
  if (action.category === 'financial') return 'stock:financial';
  if (action.category === 'technical') return 'stock:technical';
  return 'stock';
}

const CATEGORY_COLORS: Record<QuickActionCategory, string> = {
  financial: 'text-green-500',
  technical: 'text-blue-500',
  thesis: 'text-amber-500',
  comparison: 'text-purple-500',
  report: 'text-slate-500',
  refresh: 'text-orange-500',
};

// 数据新鲜度指示器组件
interface DataFreshnessIndicatorProps {
  research: StockResearchDocumentContent;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function DataFreshnessIndicator({ research, t }: DataFreshnessIndicatorProps) {
  const freshness = getOverallDataFreshness(research);

  const colorClass = {
    fresh: 'bg-green-500',
    warning: 'bg-yellow-500',
    stale: 'bg-red-500',
    unknown: 'bg-gray-400',
  }[freshness.status];

  const tooltipText = {
    fresh: t('stockResearch.dataFreshTooltip', { defaultValue: '数据新鲜' }),
    warning: t('stockResearch.dataWarningTooltip', { days: freshness.maxDays, defaultValue: `数据${freshness.maxDays}天前更新` }),
    stale: t('stockResearch.dataStaleTooltip', { days: freshness.maxDays, defaultValue: `数据${freshness.maxDays}天未更新` }),
    unknown: t('stockResearch.dataUnknownTooltip', { defaultValue: '暂无数据' }),
  }[freshness.status];

  return (
    <span className="flex items-center gap-1" title={tooltipText}>
      <span className={cn('w-2 h-2 rounded-full', colorClass)} />
      <span className="text-[10px]">
        {freshness.status === 'fresh' && t('stockResearch.fresh', { defaultValue: '新鲜' })}
        {freshness.status === 'warning' && t('stockResearch.warning', { defaultValue: '较旧' })}
        {freshness.status === 'stale' && t('stockResearch.stale', { defaultValue: '陈旧' })}
        {freshness.status === 'unknown' && t('stockResearch.unknown', { defaultValue: '无数据' })}
      </span>
    </span>
  );
}

export default function StockResearchAISidebar({
  host, document: doc, research, onInsertToDoc,
  onApplyResearchResult,
  onOpenTushareSettings,
  tushareRecheckNonce = 0,
}: StockResearchAISidebarProps) {
  const { t } = useTranslation();

  const [tushareOk, setTushareOk] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await invoke('tushare_token_check');
        if (!cancelled) setTushareOk(true);
      } catch {
        if (!cancelled) setTushareOk(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tushareRecheckNonce]);

  // ── 一键研究输入 ──
  const [researchInput, setResearchInput] = useState('');
  const [isResearching, setIsResearching] = useState(false);
  const [researchSteps, setResearchSteps] = useState<ResearchStep[]>([]);
  const oneClickResearchActiveRef = useRef(false);

  // ── AI 服务 ──
  const { services, activeServiceId } = useSettingsStore(useShallow(s => ({
    services: s.ai.services,
    activeServiceId: s.ai.activeServiceId,
  })));
  const enabledServices = useMemo(() => services.filter(sv => sv.enabled), [services]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(() =>
    host.storage.get<string>('_stock_ai_service_id') || ''
  );
  const effectiveServiceId = selectedServiceId || undefined;
  const aiParams = getAIInvokeParamsForService(effectiveServiceId);
  const [contextMode, setContextMode] = useState<ContextMode>('auto');

  // ── 系统提示词编辑 ──
  const [promptOpen, setPromptOpen] = useState(false);
  const defaultPrompt = useMemo(() => buildSystemPrompt(research), [research]);
  const [customPrompt, setCustomPrompt] = useState<string>(() =>
    host.storage.get<string>('_stock_ai_prompt') || ''
  );
  const [promptDraft, setPromptDraft] = useState(customPrompt || defaultPrompt);

  // ── 一键研究 Prompt 编辑 ──
  const [oneClickPromptOpen, setOneClickPromptOpen] = useState(false);
  const [customOneClickPrompt, setCustomOneClickPrompt] = useState<string>(() =>
    host.storage.get<string>('_stock_one_click_prompt') || ''
  );
  const [oneClickPromptDraft, setOneClickPromptDraft] = useState(customOneClickPrompt || DEFAULT_ONE_CLICK_PROMPT);

  // 构建上下文
  const context = useMemo(() => {
    return buildStockResearchContext(research, { mode: contextMode, maxTokens: 1500 });
  }, [research, contextMode]);

  // 系统提示词（优先使用自定义）
  const systemPrompt = useMemo(() => {
    return customPrompt || defaultPrompt;
  }, [customPrompt, defaultPrompt]);

  // 构建快捷操作提示词
  const buildQuickActionPrompt = useCallback((action: QuickAction): string => {
    const promptTemplate = getPromptForAction(action);
    if (!promptTemplate) return '';
    return fillPromptTemplate(promptTemplate, research);
  }, [research]);

  // 处理快捷操作 - 通过事件系统发送
  const handleQuickAction = useCallback((action: QuickAction) => {
    const prompt = buildQuickActionPrompt(action);
    if (prompt) {
      sendDocTypeAIMessage({
        documentId: doc.id,
        message: t(action.labelKey),
        prompt: prompt,
        systemPrompt: systemPrompt,
        forceWebSearch: action.forceWebSearch,
        enableTools: true,
        toolScope: toolScopeForQuickAction(action),
      });
    }
  }, [buildQuickActionPrompt, doc.id, systemPrompt, t]);

  // 获取研究阶段信息
  const phaseInfo = useMemo(() => {
    return RESEARCH_PHASES.find(p => p.key === research.metadata.phase) || RESEARCH_PHASES[0];
  }, [research.metadata.phase]);

  // 一键研究:发送到聊天面板
  const handleOneClickResearch = useCallback((input: string) => {
    if (!input.trim()) return;

    const stockIdentifier = input.trim();
    const today = new Date().toLocaleDateString('zh-CN');
    const timestamp = Date.now();

    // 使用自定义 prompt 或默认 prompt，替换变量
    const promptTemplate = customOneClickPrompt || DEFAULT_ONE_CLICK_PROMPT;
    const prompt = promptTemplate
      .replace(/\{\{stockIdentifier\}\}/g, stockIdentifier)
      .replace(/\{\{today\}\}/g, today)
      .replace(/\{\{timestamp\}\}/g, String(timestamp));

    oneClickResearchActiveRef.current = true;
    setIsResearching(true);
    setResearchSteps(createResearchSteps(t));

    sendDocTypeAIMessage({
      documentId: doc.id,
      message: t('stockResearch.oneClickResearchLabel', { stock: stockIdentifier, defaultValue: `一键研究：${stockIdentifier}` }),
      prompt,
      systemPrompt: systemPrompt,
      forceWebSearch: true,
      enableTools: true,
      toolScope: 'stock',
    });

    // 清空输入框
    setResearchInput('');
  }, [doc.id, t, systemPrompt, customOneClickPrompt]);

  const onAssistantStreamUpdate = useCallback((text: string) => {
    if (!oneClickResearchActiveRef.current) return;
    setResearchSteps(prev => updateStepsFromMessage(prev, text));
  }, []);

  // 监听 AI 完成/失败事件，重置研究状态
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.documentId === doc.id) {
        oneClickResearchActiveRef.current = false;
        setIsResearching(false);
        if (detail.success) {
          setResearchSteps(prev => finalizeResearchStepsOnSuccess(prev));
        } else {
          setResearchSteps(prev => prev.map(s =>
            s.status === 'running' ? { ...s, status: 'error' as const } : s
          ));
        }
      }
    };
    window.addEventListener('doctype-ai-done', handler);
    return () => window.removeEventListener('doctype-ai-done', handler);
  }, [doc.id]);

  // Header Slot: 一键研究 + AI服务选择 + 快捷操作下拉菜单 + 上下文模式切换
  const headerSlot: ReactNode = (
    <div className="border-b p-2 space-y-1.5 bg-card">
      {tushareOk === false && onOpenTushareSettings && (
        <button
          type="button"
          onClick={onOpenTushareSettings}
          className="w-full flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-left text-[10px] text-amber-950 dark:text-amber-100 hover:bg-amber-500/15 transition-colors"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="flex-1 min-w-0">
            <span className="block">{t('stockResearch.tushareBannerInvalid', { defaultValue: '未检测到有效 Tushare Token，股票工具可能无法返回数据。' })}</span>
            <span className="text-primary underline font-medium">{t('stockResearch.tushareOpenSettings', { defaultValue: '打开 Tushare 设置' })}</span>
          </span>
        </button>
      )}

      {/* 一键研究输入框 + 按钮 */}
      <div className="flex items-center gap-1">
        <Input
          placeholder={t('stockResearch.inputStockPlaceholder')}
          value={researchInput}
          onChange={(e) => setResearchInput(e.target.value)}
          className="h-6 text-xs flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && researchInput.trim()) {
              handleOneClickResearch(researchInput.trim());
            }
          }}
        />
        <Button
          variant="default"
          size="sm"
          className="h-6 w-6 p-0"
          onClick={() => {
            if (researchInput.trim()) {
              handleOneClickResearch(researchInput.trim());
            }
          }}
          disabled={isResearching || !researchInput.trim()}
          title={t('stockResearch.oneClickResearchHint')}
        >
          {isResearching ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* 研究进度指示器 */}
      {researchSteps.length > 0 && (
        <ResearchProgressIndicator
          steps={researchSteps}
          isActive={isResearching}
          onCancel={() => {
            window.dispatchEvent(new CustomEvent('doctype-ai-stop', { detail: { documentId: doc.id } }));
            oneClickResearchActiveRef.current = false;
            setIsResearching(false);
            setResearchSteps([]);
          }}
        />
      )}

      {/* 工具栏：快捷操作 + 上下文模式 */}
      <div className="flex items-center gap-1">
        {/* 快捷操作下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1 flex-1">
              <Zap className="h-3 w-3" />
              {t('stockResearch.quickActions')}
              <ChevronDown className="h-3 w-3 ml-auto" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {QUICK_ACTION_CATEGORIES.map(categoryDef => {
              const actions = getQuickActionsByCategory(categoryDef.key);
              if (actions.length === 0) return null;
              const Icon = CATEGORY_ICONS[categoryDef.key];

              return (
                <DropdownMenuSub key={categoryDef.key}>
                  <DropdownMenuSubTrigger className="text-xs">
                    <Icon className={cn('h-3 w-3 mr-1.5', CATEGORY_COLORS[categoryDef.key])} />
                    {t(categoryDef.labelKey)}
                    <span className="ml-auto text-muted-foreground text-[10px]">{actions.length}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {actions.map(action => (
                      <DropdownMenuItem
                        key={action.id}
                        className="text-xs"
                        onClick={() => handleQuickAction(action)}
                      >
                        <action.icon className="h-3 w-3 mr-1.5" />
                        {t(action.labelKey)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 上下文模式 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Settings className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setContextMode('auto')}>
              {contextMode === 'auto' && '✓ '} {t('stockResearch.contextAuto')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setContextMode('full')}>
              {contextMode === 'full' && '✓ '} {t('stockResearch.contextFull')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setContextMode('minimal')}>
              {contextMode === 'minimal' && '✓ '} {t('stockResearch.contextMinimal')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* AI 服务选择 */}
      {enabledServices.length >= 2 && (
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{t('stockResearch.aiService')}:</span>
          <select
            className="h-5 text-[10px] px-1.5 border rounded bg-background flex-1 truncate"
            value={selectedServiceId || activeServiceId || ''}
            onChange={e => { setSelectedServiceId(e.target.value); host.storage.set('_stock_ai_service_id', e.target.value); }}
            title={t('stockResearch.selectAiService')}
          >
            {enabledServices.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Token 统计 + 数据新鲜度 + Prompt 编辑 */}
      <div className="flex justify-between items-center text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{t('stockResearch.contextTokens', { count: context.totalTokens })}</span>
          <DataFreshnessIndicator research={research} t={t} />
        </div>
        <div className="flex items-center gap-1">
          {/* 一键研究 Prompt 编辑 */}
          <Popover open={oneClickPromptOpen} onOpenChange={setOneClickPromptOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-5 w-5 p-0 ${oneClickPromptOpen ? 'text-blue-500' : ''}`}
                title={t('stockResearch.oneClickPromptTitle', { defaultValue: '编辑一键研究 Prompt' })}>
                <FileEdit className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 bg-card" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('stockResearch.oneClickPromptTitle', { defaultValue: '一键研究 Prompt' })}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setOneClickPromptDraft(DEFAULT_ONE_CLICK_PROMPT)}>
                    <RotateCcw className="h-3 w-3 mr-1" />{t('stockResearch.resetPrompt', { defaultValue: '重置' })}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {t('stockResearch.oneClickPromptHint', { defaultValue: '支持变量：{{stockIdentifier}}、{{today}}、{{timestamp}}' })}
                </p>
                <textarea className="w-full h-48 text-xs border rounded-md p-2 resize-none bg-background font-mono"
                  value={oneClickPromptDraft} onChange={e => setOneClickPromptDraft(e.target.value)}
                  placeholder={t('stockResearch.oneClickPromptPlaceholder', { defaultValue: '输入自定义一键研究 Prompt...' })} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    setCustomOneClickPrompt(oneClickPromptDraft);
                    host.storage.set('_stock_one_click_prompt', oneClickPromptDraft);
                    setOneClickPromptOpen(false);
                  }}>{t('stockResearch.savePrompt', { defaultValue: '保存' })}</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {/* 系统提示词编辑 */}
          <Popover open={promptOpen} onOpenChange={setPromptOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-5 w-5 p-0 ${promptOpen ? 'text-blue-500' : ''}`}
                title={t('stockResearch.systemPrompt', { defaultValue: '系统提示词' })}>
                <ScrollText className="h-3 w-3" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 bg-card" align="end">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('stockResearch.systemPrompt', { defaultValue: '系统提示词' })}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setPromptDraft(defaultPrompt)}>
                    <RotateCcw className="h-3 w-3 mr-1" />{t('stockResearch.resetPrompt', { defaultValue: '重置' })}
                  </Button>
                </div>
                <textarea className="w-full h-32 text-xs border rounded-md p-2 resize-none bg-background"
                  value={promptDraft} onChange={e => setPromptDraft(e.target.value)}
                  placeholder={t('stockResearch.promptPlaceholder', { defaultValue: '输入自定义系统提示词...' })} />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" className="h-7 text-xs" onClick={() => {
                    setCustomPrompt(promptDraft);
                    host.storage.set('_stock_ai_prompt', promptDraft);
                    setPromptOpen(false);
                  }}>{t('stockResearch.savePrompt', { defaultValue: '保存' })}</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );

  // Empty State Slot: 股票信息概览
  const emptyStateSlot: ReactNode = (
    <div className="p-3 text-center space-y-3">
      <div className="p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{research.stock.name || t('stockResearch.untitled')}</span>
          <span className="text-xs text-muted-foreground">({research.stock.code || '-'})</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {research.stock.market && (
            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{research.stock.market}</span>
          )}
          {research.stock.industry && (
            <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">{research.stock.industry}</span>
          )}
          <span className={cn('px-1.5 py-0.5 rounded text-[10px]', phaseInfo.color)}>
            {t(phaseInfo.labelKey)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {research.theses.length > 0 && (
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              <span>{t('stockResearch.thesisCount', { count: research.theses.length })}</span>
            </div>
          )}
          {research.trades.length > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <BarChart3 className="h-3 w-3" />
              <span>{t('stockResearch.tradeCount', { count: research.trades.length })}</span>
            </div>
          )}
        </div>
      </div>
      <div className="text-muted-foreground text-xs">
        <Sparkles className="h-6 w-6 mx-auto mb-1 opacity-20" />
        <p>{t('stockResearch.welcomeAI')}</p>
        <p className="text-[10px] text-muted-foreground">{t('stockResearch.selectQuickAction')}</p>
        <p className="text-[10px] text-muted-foreground/90 mt-2 leading-relaxed px-1">
          {t('stockResearch.dataSourceTushareScope', {
            defaultValue: '行情与财务等工具主要覆盖 Tushare 支持的品种（如 A 股等）；外盘代码可能无法一键拉取完整数据。',
          })}
        </p>
      </div>
    </div>
  );

  // 消息操作：插入到文档 + 应用研究结果（仅当消息包含可解析 JSON 时显示）
  const messageActions = useCallback((msg: DocTypeChatMsg): ReactNode => {
    const parsed = parseAIResearchOutput(msg.content);

    return (
      <div className="flex gap-1">
        {/* 插入到文档 */}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[10px]"
          onClick={() => onInsertToDoc(msg.content)}
        >
          <FileText className="h-3 w-3 mr-1" />
          {t('stockResearch.insertToDoc')}
        </Button>
        {/* 应用研究结果（仅当消息包含可解析 JSON 时显示） */}
        {parsed && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-[10px]"
            onClick={() => {
              onApplyResearchResult(parsed);
            }}
          >
            <Zap className="h-3 w-3 mr-1" />
            {t('stockResearch.applyResearch', { defaultValue: '应用研究结果' })}
          </Button>
        )}
      </div>
    );
  }, [onInsertToDoc, onApplyResearchResult, t]);

  return (
    <DocTypeAIChatBase
      host={host}
      document={doc}
      systemPrompt={systemPrompt}
      aiParams={aiParams}
      headerSlot={headerSlot}
      emptyStateSlot={emptyStateSlot}
      messageActions={messageActions}
      onAssistantStreamUpdate={onAssistantStreamUpdate}
      placeholder={t('stockResearch.inputPlaceholder')}
      historyLimit={6}
      showAIOptions={true}
      defaultWebSearch={true}
      defaultThinking={true}
      enableTools={true}
      toolScope="stock"
    />
  );
}

// 构建系统提示词
function buildSystemPrompt(research: StockResearchDocumentContent): string {
  const today = new Date().toLocaleDateString('zh-CN');

  const basePrompt = `你是一位资深的股票研究分析师，拥有 CFA 和 CPA 资质。

【分析原则】
- 数据驱动：每个结论都要有数据支撑；数值须来自本对话中的工具返回或联网检索，禁止编造
- 逻辑清晰、风险意识、中立客观

【输出规范】
- 常规问答：可用 Markdown 标题、列表、表格
- **一键研究 / 需要写入研究卡片时**：在正文末尾输出与「一键研究」模板一致的 \`\`\`json 代码块（字段含 stock、financials、technicals、theses、risk、news、peers），以便用户点击「应用研究结果」

【工具】
可调用的函数与参数以请求中的 tools 列表为准。流程建议：stock_search → ts_code → 按需调用行情/财报/指标/资金流等；工具无数据时明确说明，勿臆测。联网用于新闻与公告等定性信息。Tushare Token 在应用设置中配置。`;

  const context = buildStockResearchContext(research, { mode: 'auto', maxTokens: 1500 });
  const contextSection = context.text
    ? `\n\n【当前股票数据】\n${context.text}`
    : '\n\n【当前股票数据】\n（暂无详细数据）';

  return `${basePrompt}${contextSection}\n\n【今日日期】${today}`;
}
