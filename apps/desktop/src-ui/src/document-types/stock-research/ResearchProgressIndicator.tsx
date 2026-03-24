/**
 * ResearchProgressIndicator — 一键研究多步骤进度指示器
 *
 * 功能：
 * - 8步研究流程的 stepper UI
 * - 每步显示：等待 / 执行中 / 完成 / 失败
 * - 显示当前正在调用的工具名称
 * - 可折叠/展开
 */

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  Loader2, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
} from 'lucide-react';

export type StepStatus = 'pending' | 'running' | 'done' | 'error';

export interface ResearchStep {
  id: string;
  label: string;
  toolName?: string;
  status: StepStatus;
  detail?: string;
}

interface ResearchProgressIndicatorProps {
  steps: ResearchStep[];
  isActive: boolean;
  onCancel?: () => void;
  className?: string;
}

const STEP_ICONS: Record<StepStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  running: Loader2,
  done: CheckCircle2,
  error: XCircle,
};

const STEP_COLORS: Record<StepStatus, string> = {
  pending: 'text-muted-foreground',
  running: 'text-blue-500',
  done: 'text-green-500',
  error: 'text-red-500',
};

export function createResearchSteps(t: (key: string, opts?: Record<string, unknown>) => string): ResearchStep[] {
  return [
    { id: 'search', label: t('stockResearch.stepSearch', { defaultValue: '搜索股票代码' }), toolName: 'stock_search', status: 'pending' },
    { id: 'basic', label: t('stockResearch.stepBasic', { defaultValue: '获取基本信息' }), toolName: 'stock_basic_info', status: 'pending' },
    { id: 'daily', label: t('stockResearch.stepDaily', { defaultValue: '获取行情数据' }), toolName: 'stock_daily', status: 'pending' },
    { id: 'indicator', label: t('stockResearch.stepIndicator', { defaultValue: '获取财务指标' }), toolName: 'stock_indicator', status: 'pending' },
    { id: 'income', label: t('stockResearch.stepIncome', { defaultValue: '获取利润表' }), toolName: 'stock_income', status: 'pending' },
    { id: 'moneyflow', label: t('stockResearch.stepMoneyflow', { defaultValue: '获取资金流向' }), toolName: 'stock_moneyflow', status: 'pending' },
    { id: 'news', label: t('stockResearch.stepNews', { defaultValue: '搜索最新新闻' }), status: 'pending' },
    { id: 'report', label: t('stockResearch.stepReport', { defaultValue: '生成研究报告' }), status: 'pending' },
  ];
}

/** Rust `ai.rs` 联网阶段注入文案含此子串（如「正在联网搜索最新资讯」） */
export const WEB_SEARCH_SNIPPET = '正在联网搜索';

const MIN_SIGNIFICANT_BODY_AFTER_WEB = 28;

/** 单调合并：不将 done/error 回退，running 不回到 pending */
export function mergeMonotonicStepStatus(prev: StepStatus, computed: StepStatus): StepStatus {
  if (prev === 'error') return 'error';
  if (prev === 'done') return 'done';
  if (prev === 'running' && computed === 'pending') return 'running';
  return computed;
}

/**
 * 从流式文本中提取按出现顺序的 stock_* 工具名（多模式，兼容中英文展示差异）
 */
export function extractInvokedStockTools(messageContent: string): string[] {
  const hits: { i: number; name: string }[] = [];

  const patterns: RegExp[] = [
    /调用\s+(stock_[a-z0-9_]+)/g,
    /calling\s*[:：]?\s*(stock_[a-z0-9_]+)/gi,
    /\bcall\s+[:：]?\s*(stock_[a-z0-9_]+)/gi,
    /🔧[^\n\r]{0,240}?(stock_[a-z0-9_]+)/g,
    /(?:^|[\n\r])>[^\n\r]{0,120}?(stock_[a-z0-9_]+)/gm,
    /`(stock_[a-z0-9_]+)`/g,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(messageContent)) !== null) {
      const name = m[1];
      if (name) hits.push({ i: m.index, name });
    }
  }

  hits.sort((a, b) => a.i - b.i || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const invoked: string[] = [];
  for (const h of hits) {
    const key = `${h.i}\0${h.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    invoked.push(h.name);
  }
  return invoked;
}

/** 流式文本中是否已出现一键研究结构化 JSON（围栏大小写/裸对象） */
export function detectResearchJsonInStream(text: string): boolean {
  if (/```\s*json\b/i.test(text)) return true;
  const i = text.indexOf('{');
  if (i < 0) return false;
  const slice = text.slice(i, Math.min(text.length, i + 1500));
  return (
    /"stock"\s*:\s*\{/.test(slice)
    || /"financials"\s*:\s*\{/.test(slice)
    || /"technicals"\s*:\s*\{/.test(slice)
    || /"theses"\s*:\s*\[/.test(slice)
    || /"news"\s*:\s*\[/.test(slice)
    || /"risk"\s*:\s*\{/.test(slice)
    || /"peers"\s*:\s*\[/.test(slice)
  );
}

/** 一键研究成功结束时将各步标为完成（保留已有 error） */
export function finalizeResearchStepsOnSuccess(steps: ResearchStep[]): ResearchStep[] {
  return steps.map(s => ({
    ...s,
    status: s.status === 'error' ? 'error' : 'done',
  }));
}

/**
 * 根据流式累积文本中的工具标记更新步骤（后端格式：`> 🔧 调用 stock_xxx(...)`）
 */
export function updateStepsFromMessage(
  steps: ResearchStep[],
  messageContent: string,
): ResearchStep[] {
  const updated = steps.map(s => ({ ...s }));

  const invoked = extractInvokedStockTools(messageContent);

  const hasStructured = detectResearchJsonInStream(messageContent);
  const webHint = messageContent.includes(WEB_SEARCH_SNIPPET);
  const webIdx = messageContent.indexOf(WEB_SEARCH_SNIPPET);
  const tailAfterWeb = webIdx >= 0
    ? messageContent.slice(webIdx + WEB_SEARCH_SNIPPET.length)
    : '';
  // 联网提示之后模型开始输出正文时，视为「新闻检索」阶段已转入成文
  const significantBodyAfterWeb = tailAfterWeb.replace(/[\s\n>`#\-_*【】]/g, '').length
    >= MIN_SIGNIFICANT_BODY_AFTER_WEB;

  for (const step of updated) {
    if (step.toolName) {
      const idx = invoked.lastIndexOf(step.toolName);
      if (idx < 0) {
        step.status = 'pending';
      } else if (idx === invoked.length - 1 && !hasStructured) {
        step.status = 'running';
      } else {
        step.status = 'done';
      }
    } else if (step.id === 'news') {
      if (hasStructured) step.status = 'done';
      else if (webHint && significantBodyAfterWeb) step.status = 'done';
      else if (webHint) step.status = 'running';
      else step.status = invoked.length > 0 ? 'running' : 'pending';
    } else if (step.id === 'report') {
      step.status = hasStructured ? 'done' : (invoked.length > 0 || webHint ? 'running' : 'pending');
    }
  }

  return updated.map((step, i) => ({
    ...step,
    status: mergeMonotonicStepStatus(steps[i].status, step.status),
  }));
}

export default function ResearchProgressIndicator({
  steps, isActive, onCancel, className,
}: ResearchProgressIndicatorProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  const completedCount = steps.filter(s => s.status === 'done').length;
  const hasError = steps.some(s => s.status === 'error');
  const allDone = completedCount === steps.length;

  // 自动折叠（完成后 2 秒）
  useEffect(() => {
    if (allDone) {
      const timer = setTimeout(() => setExpanded(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [allDone]);

  if (!isActive && completedCount === 0) return null;

  return (
    <div className={cn('border rounded-md overflow-hidden bg-card', className)}>
      {/* 标题栏 */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        {isActive && !allDone ? (
          <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
        ) : allDone ? (
          <CheckCircle2 className="h-3 w-3 text-green-500" />
        ) : hasError ? (
          <XCircle className="h-3 w-3 text-red-500" />
        ) : (
          <Clock className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-xs font-medium flex-1">
          {t('stockResearch.researchProgress', { defaultValue: '研究进度' })}
          <span className="ml-1 text-muted-foreground font-normal">
            {completedCount}/{steps.length}
          </span>
        </span>
        {/* 进度条 */}
        <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              hasError ? 'bg-red-500' : allDone ? 'bg-green-500' : 'bg-blue-500',
            )}
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </div>

      {/* 步骤列表 */}
      {expanded && (
        <div className="border-t px-2 py-1 space-y-0.5">
          {steps.map((step, i) => {
            const Icon = STEP_ICONS[step.status];
            return (
              <div key={step.id} className="flex items-center gap-1.5 text-[11px]">
                <Icon className={cn(
                  'h-3 w-3 flex-shrink-0',
                  STEP_COLORS[step.status],
                  step.status === 'running' && 'animate-spin',
                )} />
                <span className={cn(
                  step.status === 'done' ? 'text-muted-foreground line-through' :
                  step.status === 'running' ? 'text-foreground font-medium' :
                  'text-muted-foreground',
                )}>
                  {i + 1}. {step.label}
                </span>
                {step.detail && (
                  <span className="text-[10px] text-muted-foreground truncate ml-auto">
                    {step.detail}
                  </span>
                )}
              </div>
            );
          })}
          {isActive && !allDone && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] w-full mt-1"
              onClick={onCancel}
            >
              {t('common.cancel', { defaultValue: '取消' })}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
