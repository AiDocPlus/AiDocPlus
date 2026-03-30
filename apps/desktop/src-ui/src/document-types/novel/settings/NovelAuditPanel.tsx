/**
 * NovelAuditPanel — 连续性审计面板
 *
 * P2.2: 审计面板 UI
 * - 33 维度检查
 * - 本地规则检查（快速）+ AI 深度检查
 * - 问题列表和修复建议
 */
import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ShieldCheck, AlertTriangle, Check, ChevronDown, ChevronRight,
  RefreshCw, Sparkles, Loader2, AlertCircle, ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { DocTypeHostAPI } from '@/doctype-sdk/types';
import type { NovelDocumentContent } from '../types';
import {
  runLocalAudit,
  buildAIAuditPrompt,
  type AuditReport,
  type AuditIssue,
} from '../novelAudit';

interface NovelAuditPanelProps {
  novel: NovelDocumentContent;
  activeChapterId: string | null;
  host: DocTypeHostAPI;
}

export default function NovelAuditPanel({
  novel,
  activeChapterId,
  host,
}: NovelAuditPanelProps) {
  const { t } = useTranslation();
  const [auditMode, setAuditMode] = useState<'local' | 'ai'>('local');
  const [auditing, setAuditing] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [aiCategory, setAiCategory] = useState<string | null>(null);
  const [aiIssues, setAiIssues] = useState<AuditIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['character']));

  // 运行本地审计
  const runLocal = useCallback(() => {
    setAuditing(true);
    setError(null);
    setReport(null);

    try {
      const result = runLocalAudit(novel);
      setReport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '审计失败');
    } finally {
      setAuditing(false);
    }
  }, [novel]);

  // 运行 AI 审计（按类别）
  const runAIByCategory = useCallback(async (category: string) => {
    setAuditing(true);
    setAiCategory(category);
    setError(null);

    try {
      const prompt = buildAIAuditPrompt(novel, category as any);
      const result = await host.ai.chat([
        { role: 'user', content: prompt }
      ], { temperature: 0.3 });

      // 解析 AI 返回
      const issues: AuditIssue[] = [];
      const lines = result.split('\n');

      for (const line of lines) {
        const match = line.match(/[-•]\s*(.+?)\s*[（(]([^)）]+)[)）]\s*[:：]\s*(.+)/);
        if (match) {
          issues.push({
            id: `ai-${Date.now()}-${issues.length}`,
            category: category as any,
            dimension: match[1].trim(),
            severity: match[2].includes('严重') ? 'error' : match[2].includes('警告') ? 'warning' : 'info',
            description: match[3].trim(),
            location: '',
            suggestion: '',
          });
        }
      }

      setAiIssues(issues);

      // 合并到报告中
      if (report) {
        setReport({
          ...report,
          issues: [...report.issues, ...issues],
          byCategory: {
            ...report.byCategory,
            [category]: [...(report.byCategory[category] || []), ...issues],
          },
          bySeverity: {
            ...report.bySeverity,
            errors: report.bySeverity.errors + issues.filter(i => i.severity === 'error').length,
            warnings: report.bySeverity.warnings + issues.filter(i => i.severity === 'warning').length,
            infos: report.bySeverity.infos + issues.filter(i => i.severity === 'info').length,
          },
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI 审计失败');
    } finally {
      setAuditing(false);
      setAiCategory(null);
    }
  }, [novel, host.ai, report]);

  // 切换折叠状态
  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // 类别标签
  const categoryLabels: Record<string, string> = {
    character: '角色',
    timeline: '时间线',
    setting: '设定',
    foreshadowing: '伏笔',
    style: '文风',
    pacing: '节奏',
    structure: '结构',
  };

  // 严重程度样式
  const severityStyles = {
    error: 'text-red-500 bg-red-500/10',
    warning: 'text-amber-500 bg-amber-500/10',
    info: 'text-blue-500 bg-blue-500/10',
  };

  const severityLabels = {
    error: '错误',
    warning: '警告',
    info: '提示',
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0">
        <ShieldCheck className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium">连续性审计</span>
        <div className="flex-1" />
        <Button
          variant="default"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={runLocal}
          disabled={auditing}
        >
          {auditing ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> 审计中...</>
          ) : (
            <><RefreshCw className="h-3 w-3" /> 运行审计</>
          )}
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-destructive/10 text-destructive text-xs rounded flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button className="ml-auto hover:text-destructive/80" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {/* 初始状态 */}
        {!report && (
          <div className="text-center py-8">
            <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">连续性审计</p>
            <p className="text-xs text-muted-foreground">
              检查角色、时间线、设定、伏笔等 33 维度一致性
            </p>
          </div>
        )}

        {/* 审计报告 */}
        {report && (
          <>
            {/* 总览 */}
            <div className="rounded border p-3 bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">审计结果</span>
                <span className={cn(
                  'text-lg font-bold',
                  report.totalIssues === 0 ? 'text-green-500' :
                  report.bySeverity.errors > 0 ? 'text-red-500' : 'text-amber-500'
                )}>
                  {report.totalIssues === 0 ? '通过' : `${report.totalIssues} 个问题`}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-red-500/10 p-1.5">
                  <div className="font-bold text-red-500">{report.bySeverity.errors}</div>
                  <div className="text-muted-foreground">错误</div>
                </div>
                <div className="rounded bg-amber-500/10 p-1.5">
                  <div className="font-bold text-amber-500">{report.bySeverity.warnings}</div>
                  <div className="text-muted-foreground">警告</div>
                </div>
                <div className="rounded bg-blue-500/10 p-1.5">
                  <div className="font-bold text-blue-500">{report.bySeverity.infos}</div>
                  <div className="text-muted-foreground">提示</div>
                </div>
              </div>
            </div>

            {/* 按类别显示 */}
            <div className="space-y-2">
              {Object.entries(report.byCategory).map(([category, issues]) => {
                if (issues.length === 0) return null;

                const isExpanded = expandedCategories.has(category);
                const errorCount = issues.filter(i => i.severity === 'error').length;
                const warningCount = issues.filter(i => i.severity === 'warning').length;

                return (
                  <div key={category} className="rounded border">
                    {/* 类别标题 */}
                    <button
                      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/30 text-left"
                      onClick={() => toggleCategory(category)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span className="text-xs font-medium flex-1">{categoryLabels[category] || category}</span>
                      {errorCount > 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/10 text-red-500">
                          {errorCount} 错误
                        </span>
                      )}
                      {warningCount > 0 && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-amber-500/10 text-amber-500">
                          {warningCount} 警告
                        </span>
                      )}
                    </button>

                    {/* 问题列表 */}
                    {isExpanded && (
                      <div className="border-t divide-y">
                        {issues.slice(0, 10).map(issue => (
                          <div key={issue.id} className="p-2 space-y-1">
                            <div className="flex items-start gap-2">
                              <span className={cn(
                                'text-[10px] px-1 py-0.5 rounded flex-shrink-0 mt-0.5',
                                severityStyles[issue.severity]
                              )}>
                                {severityLabels[issue.severity]}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium">{issue.dimension}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {issue.description}
                                </div>
                                {issue.location && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    位置：{issue.location}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* AI 深度审计 */}
            <div className="rounded border p-2">
              <div className="text-xs font-medium mb-2">AI 深度审计</div>
              <div className="flex flex-wrap gap-1">
                {['character', 'timeline', 'setting', 'foreshadowing', 'style', 'pacing', 'structure'].map(cat => (
                  <Button
                    key={cat}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => runAIByCategory(cat)}
                    disabled={auditing && aiCategory === cat}
                  >
                    {auditing && aiCategory === cat ? (
                      <><Loader2 className="h-2 w-2 animate-spin" /> 审计中</>
                    ) : (
                      categoryLabels[cat]
                    )}
                  </Button>
                ))}
              </div>
            </div>

            {/* 通过提示 */}
            {report.totalIssues === 0 && (
              <div className="text-center py-4">
                <Check className="h-8 w-8 mx-auto text-green-500 mb-2" />
                <p className="text-sm text-green-600">未发现一致性问题</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部说明 */}
      <div className="px-3 py-2 border-t text-xs text-muted-foreground flex-shrink-0">
        本地审计检查基本规则，AI 审计可发现更深层次问题。
      </div>
    </div>
  );
}
