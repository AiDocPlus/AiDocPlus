/**
 * CalculatorDashboard — 计算文档统计面板
 * 纯 SVG/CSS 图表，数据从 calcDoc 派生，无外部 API。
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CalculatorDocumentContent,
  CalculatorLine,
  CalculatorLineRole,
  CalculatorVariable,
} from './types';

// ── 类型 ──

interface CalculatorDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calcDoc: CalculatorDocumentContent;
}

// ── 颜色常量 ──

const ROLE_COLORS: Record<CalculatorLineRole, string> = {
  normal: '#3b82f6',    // blue-500
  heading: '#8b5cf6',   // violet-500
  comment: '#6b7280',   // gray-500
  subtotal: '#f59e0b',  // amber-500
};

const ROLE_COLORS_DARK: Record<CalculatorLineRole, string> = {
  normal: '#60a5fa',
  heading: '#a78bfa',
  comment: '#9ca3af',
  subtotal: '#fbbf24',
};

// ── 工具函数 ──

function extractFunctions(lines: CalculatorLine[]): Map<string, number> {
  const fnRe = /\b([a-zA-Z_]\w*)\s*\(/g;
  const counts = new Map<string, number>();
  for (const line of lines) {
    if (line.lineRole === 'comment' || line.lineRole === 'heading') continue;
    let m: RegExpExecArray | null;
    while ((m = fnRe.exec(line.expression)) !== null) {
      const name = m[1].toLowerCase();
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return counts;
}

// ── 组件 ──

export function CalculatorDashboard({ onOpenChange, calcDoc }: CalculatorDashboardProps) {
  const { t } = useTranslation();
  const isDark = typeof document !== 'undefined'
    && document.documentElement.classList.contains('dark');
  const rc = isDark ? ROLE_COLORS_DARK : ROLE_COLORS;

  // ── 汇总数据 ──

  const stats = useMemo(() => {
    const allLines = calcDoc.sheets.flatMap(s => s.lines);
    const normalLines = allLines.filter(l => l.lineRole === 'normal');
    const errorLines = allLines.filter(l => l.result?.type === 'error');
    const numericValues = normalLines
      .map(l => l.result?.value)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const numSum = numericValues.reduce((a, b) => a + b, 0);
    const allVars = Object.values(calcDoc.sheets.reduce<Record<string, CalculatorVariable>>((acc, s) => {
      return { ...acc, ...s.variables };
    }, {}));
    const fnCounts = extractFunctions(allLines);

    // 行类型分布
    const roleDist: Record<CalculatorLineRole, number> = { normal: 0, heading: 0, comment: 0, subtotal: 0 };
    for (const l of allLines) roleDist[l.lineRole]++;

    // 变量 Top 20
    const varEntries = Object.values(allVars)
      .filter(v => typeof v.value === 'number')
      .sort((a, b) => Math.abs(b.value as number) - Math.abs(a.value as number))
      .slice(0, 20);

    // 函数 Top 15
    const fnEntries = [...fnCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    // Sheet 统计
    const sheetStats = calcDoc.sheets.map(s => {
      const sv = Object.values(s.variables);
      return {
        name: s.name,
        lineCount: s.lines.length,
        varCount: sv.length,
        errorCount: s.lines.filter(l => l.result?.type === 'error').length,
      };
    });

    return {
      totalLines: allLines.length,
      normalLines: normalLines.length,
      varCount: allVars.length,
      errorCount: errorLines.length,
      numSum,
      sheetCount: calcDoc.sheets.length,
      roleDist,
      varEntries,
      fnEntries,
      sheetStats,
    };
  }, [calcDoc]);

  const maxFnCount = Math.max(1, ...stats.fnEntries.map(([, c]) => c));

  // ── 环形图 ──

  const donutData = useMemo(() => {
    const total = Object.values(stats.roleDist).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    let cumulative = 0;
    return (Object.entries(stats.roleDist) as [CalculatorLineRole, number][])
      .filter(([, count]) => count > 0)
      .map(([role, count]) => {
        const start = (cumulative / total) * 360;
        const end = ((cumulative + count) / total) * 360;
        cumulative += count;
        return { role, count, pct: ((count / total) * 100).toFixed(1), start, end };
      });
  }, [stats.roleDist]);

  function polarToXY(angle: number, radius: number, cx: number, cy: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  // ── 渲染 ──

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onOpenChange(false); }}
    >
      <div
        className="bg-card border rounded-lg shadow-xl w-[90vw] max-w-[900px] h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <h2 className="text-base font-semibold">
            {t('calculator.dashboard', { defaultValue: '计算文档统计' })}
          </h2>
          <button
            className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
            onClick={() => onOpenChange(false)}
          >
            &times;
          </button>
        </div>

        {/* 主体 */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* 总览卡片 */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: t('calculator.statNormalLines', { defaultValue: '计算行' }), value: stats.normalLines },
              { label: t('calculator.statTotalLines', { defaultValue: '总行数' }), value: stats.totalLines },
              { label: t('calculator.statVars', { defaultValue: '变量' }), value: stats.varCount },
              { label: t('calculator.statErrors', { defaultValue: '错误' }), value: stats.errorCount },
              { label: t('calculator.statSum', { defaultValue: '数值合计' }), value: stats.numSum.toLocaleString(undefined, { maximumFractionDigits: 2 }) },
              { label: t('calculator.statSheets', { defaultValue: 'Sheet' }), value: stats.sheetCount },
            ].map(card => (
              <div key={card.label} className="bg-muted/40 rounded-lg p-3 text-center">
                <div className="text-lg font-semibold tabular-nums">{card.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
              </div>
            ))}
          </div>

          {/* 图表区域 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 行类型分布 — 环形图 */}
            <div className="bg-muted/40 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">{t('calculator.chartLineTypes', { defaultValue: '行类型分布' })}</h3>
              {donutData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
                    {donutData.map(({ role, start, end }) => {
                      const r = 40;
                      const cx = 60, cy = 60;
                      const largeArc = end - start > 180 ? 1 : 0;
                      const p1 = polarToXY(start, r, cx, cy);
                      const p2 = polarToXY(end, r, cx, cy);
                      return (
                        <path
                          key={role}
                          d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${cx} ${cy} Z`}
                          fill={rc[role]}
                          opacity={0.8}
                        >
                          <title>{role}: {(end - start).toFixed(1)} deg</title>
                        </path>
                      );
                    })}
                    <circle cx="60" cy="60" r="24" fill="var(--card)" />
                  </svg>
                  <div className="flex flex-col gap-1.5 text-xs">
                    {(Object.entries(stats.roleDist) as [CalculatorLineRole, number][])
                      .filter(([, c]) => c > 0)
                      .map(([role, count]) => (
                        <div key={role} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: rc[role] }} />
                          <span className="text-muted-foreground">{role}</span>
                          <span className="ml-auto font-medium tabular-nums">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {t('calculator.noData', { defaultValue: '暂无数据' })}
                </div>
              )}
            </div>

            {/* 变量值分布 — 横向柱状图 */}
            <div className="bg-muted/40 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">{t('calculator.chartVariables', { defaultValue: '变量值 Top 20' })}</h3>
              {stats.varEntries.length > 0 ? (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {stats.varEntries.map(v => {
                    const absVal = Math.abs(v.value as number);
                    const maxAbs = Math.max(1, Math.abs(stats.varEntries[0].value as number));
                    const pct = (absVal / maxAbs) * 100;
                    return (
                      <div key={v.name} className="flex items-center gap-2 text-xs">
                        <span className="w-16 truncate text-right font-mono text-muted-foreground">{v.name}</span>
                        <div className="flex-1 bg-muted rounded-full overflow-hidden h-4">
                          <div
                            className="h-full bg-blue-400/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-16 text-right tabular-nums">{(v.value as number).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {t('calculator.noVariables', { defaultValue: '暂无变量' })}
                </div>
              )}
            </div>

            {/* 函数使用频率 — 柱状图 */}
            <div className="bg-muted/40 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">{t('calculator.chartFunctions', { defaultValue: '函数使用 Top 15' })}</h3>
              {stats.fnEntries.length > 0 ? (
                <div className="flex items-end gap-1.5 h-40">
                  {stats.fnEntries.map(([name, count]) => (
                    <div key={name} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <span className="text-[10px] tabular-nums">{count}</span>
                      <div
                        className="w-full bg-violet-400/60 rounded-t transition-all"
                        style={{ height: `${(count / maxFnCount) * 100}%` }}
                      >
                        <title>{name}: {count}</title>
                      </div>
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center">{name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {t('calculator.noFunctions', { defaultValue: '暂无函数使用' })}
                </div>
              )}
            </div>

            {/* Sheet 统计 */}
            <div className="bg-muted/40 rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">{t('calculator.chartSheets', { defaultValue: 'Sheet 统计' })}</h3>
              {stats.sheetStats.length > 0 ? (
                <div className="space-y-2">
                  {stats.sheetStats.map(sheet => (
                    <div key={sheet.name} className="flex items-center gap-3 text-xs">
                      <span className="w-20 truncate font-medium">{sheet.name}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{t('calculator.lines', { defaultValue: '行' })}</span>
                          <span className="font-medium tabular-nums">{sheet.lineCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">{t('calculator.vars', { defaultValue: '变量' })}</span>
                          <span className="font-medium tabular-nums">{sheet.varCount}</span>
                        </div>
                        {sheet.errorCount > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-red-500">{t('calculator.errors', { defaultValue: '错误' })}</span>
                            <span className="font-medium tabular-nums text-red-500">{sheet.errorCount}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {t('calculator.noSheets', { defaultValue: '暂无 Sheet' })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
