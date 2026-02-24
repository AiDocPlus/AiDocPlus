import { useState, useRef, useCallback, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import type { ComplianceReport, RuleSet } from './types';
import { RULE_SETS } from './types';
import { buildComplianceSystemPrompt, buildComplianceUserPrompt, parseComplianceFromAiResponse } from './complianceAiPrompts';
import { truncateContent } from '../_framework/pluginUtils';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ShieldCheck, CheckCircle, AlertTriangle, XCircle, Download } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';

const LEVEL_CONFIG = {
  pass: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20', label: '通过' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/20', label: '警告' },
  error: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/20', label: '错误' },
};

const DEFAULT_PROMPT = '检查文档是否符合写作规范。';

export function CompliancePluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [generating, setGenerating] = useState(false);
  const [selectedRuleSet, setSelectedRuleSet] = useState<RuleSet>(RULE_SETS[3]);
  const [customRules, setCustomRules] = useState('');
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [prompt, setPrompt] = useState(
    (pluginData as Record<string, unknown>)?.lastPrompt as string || DEFAULT_PROMPT
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'warning' | 'pass'>('all');
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

  // 从 pluginData 恢复报告
  useEffect(() => {
    if (pluginData && typeof pluginData === 'object' && 'items' in (pluginData as Record<string, unknown>)) {
      const saved = pluginData as ComplianceReport & { lastPrompt?: string };
      setReport(saved);
      const rs = RULE_SETS.find(r => r.key === saved.ruleSetKey);
      if (rs) setSelectedRuleSet(rs);
    }
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    if (pluginData && typeof pluginData === 'object') {
      onPluginDataChange({ ...(pluginData as Record<string, unknown>), lastPrompt: val });
    }
    host.docData!.markDirty();
  }, [pluginData, onPluginDataChange, host]);

  const saveReport = useCallback((newReport: ComplianceReport) => {
    setReport(newReport);
    onPluginDataChange({ ...newReport, lastPrompt: prompt });
    host.docData!.markDirty();
  }, [prompt, onPluginDataChange, host]);

  const handleGenerate = useCallback(async () => {
    if (generating) {
      abortRef.current = true;
      setGenerating(false);
      showStatus('已中断检查');
      return;
    }

    const sourceContent = content || document.content || '';
    if (!sourceContent.trim()) {
      showStatus('文档内容为空，无法检查', true);
      return;
    }

    if (selectedRuleSet.key === 'custom' && !customRules.trim()) {
      showStatus('请输入自定义检查规则', true);
      return;
    }

    abortRef.current = false;
    setGenerating(true);
    showStatus(`正在按「${selectedRuleSet.label}」规范检查文档...`, false, true);

    try {
      const systemPrompt = buildComplianceSystemPrompt(selectedRuleSet);
      const userPrompt = buildComplianceUserPrompt(
        truncateContent(sourceContent),
        selectedRuleSet,
        selectedRuleSet.key === 'custom' ? customRules : undefined
      );

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 8192 });
      if (abortRef.current) return;

      const items = parseComplianceFromAiResponse(result);
      if (!items) {
        throw new Error('AI 返回的检查数据格式无效');
      }

      const summary = {
        pass: items.filter(i => i.level === 'pass').length,
        warning: items.filter(i => i.level === 'warning').length,
        error: items.filter(i => i.level === 'error').length,
      };

      const newReport: ComplianceReport = {
        ruleSetKey: selectedRuleSet.key,
        ruleSetLabel: selectedRuleSet.label,
        items,
        summary,
        checkedAt: Date.now(),
      };

      saveReport(newReport);

      const totalIssues = summary.error + summary.warning;
      if (totalIssues === 0) {
        showStatus(`检查完成，全部通过！共 ${items.length} 项检查`);
      } else {
        showStatus(`检查完成：${summary.error} 个错误、${summary.warning} 个警告、${summary.pass} 个通过`);
      }
      onRequestSave?.();
    } catch (err) {
      if (abortRef.current) return;
      showStatus(`检查失败：${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setGenerating(false);
    }
  }, [generating, content, document.content, selectedRuleSet, customRules, host, saveReport, onRequestSave]);

  // 导出 Markdown 报告
  const handleExportMarkdown = async () => {
    if (!report) return;
    try {
      const levelIcon: Record<string, string> = { pass: '✅', warning: '⚠️', error: '❌' };
      const lines = [
        `# 合规检查报告`,
        ``,
        `**规则集：** ${report.ruleSetLabel}`,
        `**检查时间：** ${new Date(report.checkedAt).toLocaleString('zh-CN')}`,
        `**结果摘要：** ${report.summary.error} 个错误、${report.summary.warning} 个警告、${report.summary.pass} 个通过`,
        ``,
        `---`,
        ``,
      ];
      for (const item of report.items) {
        lines.push(`${levelIcon[item.level] || '•'} **${item.category}**${item.location ? ` (${item.location})` : ''}`);
        lines.push(`  ${item.description}`);
        if (item.suggestion && item.level !== 'pass') {
          lines.push(`  > 💡 建议：${item.suggestion}`);
        }
        lines.push('');
      }
      const markdown = lines.join('\n');
      const safeTitle = (document.title || 'compliance').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_合规检查报告.md`, extensions: ['md'] });
      if (!filePath) return;
      const data = Array.from(new TextEncoder().encode(markdown));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const filteredItems = report?.items.filter(item => filterLevel === 'all' || item.level === filterLevel) || [];
  const hasContent = !!report;

  // 规则集选择器
  const ruleSetSelector = (
    <div className="space-y-2 mb-2">
      <div className="flex flex-wrap gap-1.5">
        {RULE_SETS.map(rs => (
          <button
            key={rs.key}
            onClick={() => setSelectedRuleSet(rs)}
            className={`px-2.5 py-1 text-sm rounded-md border transition-colors cursor-pointer ${
              selectedRuleSet.key === rs.key
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-muted/30 border-border hover:bg-muted/60'
            }`}
            title={rs.description}
          >
            {rs.label}
          </button>
        ))}
      </div>
      {selectedRuleSet.key === 'custom' && (
        <textarea
          value={customRules}
          onChange={e => setCustomRules(e.target.value)}
          placeholder="用自然语言描述你的检查规则，如：检查是否所有段落都有主题句；检查数字是否使用了统一格式..."
          rows={2}
          className="w-full px-2.5 py-1.5 text-sm border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          title="自定义检查规则"
        />
      )}
    </div>
  );

  // 工具栏
  const toolbarContent = (
    <>
      {report && (
        <>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-3 w-3 text-red-600" />
            <span className="text-sm">{report.summary.error}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
            <span className="text-sm">{report.summary.warning}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
            <span className="text-sm">{report.summary.pass}</span>
          </div>
        </>
      )}
      <div className="flex-1" />
      {report && (
        <>
          <select
            value={filterLevel}
            onChange={e => setFilterLevel(e.target.value as typeof filterLevel)}
            className="h-7 text-sm border rounded-md px-1.5 bg-background"
            title="筛选级别"
          >
            <option value="all">全部 ({report.items.length})</option>
            <option value="error">仅错误 ({report.summary.error})</option>
            <option value="warning">仅警告 ({report.summary.warning})</option>
            <option value="pass">仅通过 ({report.summary.pass})</option>
          </select>
          <Button variant="outline" size="sm" onClick={handleExportMarkdown} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            导出报告
          </Button>
        </>
      )}
    </>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<ShieldCheck className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title', { defaultValue: '合规检查' })}
      pluginDesc={t('welcomeDesc', { defaultValue: '选择规则集，AI 将检查文档是否符合规范并输出检查报告' })}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder', { defaultValue: '描述检查需求...' })}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 检查文档' })}
      generatingLabel={t('stopGenerate', { defaultValue: '中断检查' })}
      toolbar={toolbarContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        setReport(null);
        setPrompt(DEFAULT_PROMPT);
        onPluginDataChange(null);
        host.docData!.markDirty();
        showStatus('已清空检查报告');
      }}
      sourceCode={report ? JSON.stringify(report, null, 2) : undefined}
      onSourceCodeSave={(code) => {
        try {
          const parsed = JSON.parse(code) as ComplianceReport;
          if (parsed.items) saveReport(parsed);
        } catch { /* ignore */ }
      }}
    >
      {/* 规则集选择器 */}
      {!hasContent && ruleSetSelector}

      {/* 检查报告 */}
      {report && (
        <div className="w-full h-full overflow-auto">
          <div className="px-3 py-2 border-b bg-muted/20">
            {ruleSetSelector}
          </div>
          <div className="p-2 space-y-1.5">
            {filteredItems.map(item => {
              const config = LEVEL_CONFIG[item.level];
              const Icon = config.icon;
              return (
                <div key={item.id} className={`rounded-lg border p-2.5 ${config.bg}`}>
                  <div className="flex items-start gap-2">
                    <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.category}</span>
                        {item.location && (
                          <span className="text-xs text-muted-foreground">· {item.location}</span>
                        )}
                      </div>
                      <p className="text-sm mt-0.5 leading-relaxed">{item.description}</p>
                      {item.suggestion && item.level !== 'pass' && (
                        <p className="text-sm mt-1 text-muted-foreground">
                          <span className="font-medium">建议：</span>{item.suggestion}
                        </p>
                      )}
                    </div>
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
