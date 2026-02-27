import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { PluginPanelProps } from '../types';
import type { CitationData, Citation, CitationStyle } from './types';
import { CITATION_STYLE_LABELS, CITATION_TYPE_LABELS } from './types';
import { buildCitationSystemPrompt, buildCitationUserPrompt, parseCitationsFromAiResponse } from './citationAiPrompts';
import { truncateContent } from '../_framework/pluginUtils';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { BookOpen, Download, AlertTriangle, CheckCircle, Trash2, Pencil, Check, X } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';

const DEFAULT_PROMPT = '识别并提取文档中的引用和参考文献。';

export function CitationPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [generating, setGenerating] = useState(false);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [style, setStyle] = useState<CitationStyle>('gb');
  const [prompt, setPrompt] = useState(
    (pluginData as Record<string, unknown>)?.lastPrompt as string || DEFAULT_PROMPT
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthors, setEditAuthors] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editSource, setEditSource] = useState('');
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

  useEffect(() => {
    if (pluginData && typeof pluginData === 'object' && 'citations' in (pluginData as Record<string, unknown>)) {
      const saved = pluginData as CitationData;
      setCitations(saved.citations || []);
      if (saved.style) setStyle(saved.style);
    }
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const validCount = useMemo(() => citations.filter(c => c.valid).length, [citations]);
  const invalidCount = citations.length - validCount;

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    if (pluginData && typeof pluginData === 'object') {
      onPluginDataChange({ ...(pluginData as Record<string, unknown>), lastPrompt: val });
    }
    host.docData!.markDirty();
  }, [pluginData, onPluginDataChange, host]);

  const saveCitations = useCallback((newCitations: Citation[], newStyle?: CitationStyle) => {
    setCitations(newCitations);
    const data: CitationData = {
      citations: newCitations,
      style: newStyle || style,
      generatedAt: Date.now(),
      lastPrompt: prompt,
    };
    onPluginDataChange(data);
    host.docData!.markDirty();
  }, [style, prompt, onPluginDataChange, host]);

  const handleGenerate = useCallback(async () => {
    if (generating) {
      abortRef.current = true;
      setGenerating(false);
      showStatus('已中断提取');
      return;
    }

    const sourceContent = content || document.content || '';
    if (!sourceContent.trim()) {
      showStatus('文档内容为空，无法提取引用', true);
      return;
    }

    abortRef.current = false;
    setGenerating(true);
    showStatus(`正在按 ${CITATION_STYLE_LABELS[style]} 格式分析文档引用...`, false, true);

    try {
      const systemPrompt = buildCitationSystemPrompt(style);
      const userPrompt = buildCitationUserPrompt(
        truncateContent(sourceContent),
        style,
        prompt !== DEFAULT_PROMPT ? prompt : undefined
      );

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 8192 });
      if (abortRef.current) return;

      const parsed = parseCitationsFromAiResponse(result);
      if (!parsed || parsed.length === 0) {
        throw new Error('AI 返回的引用数据格式无效');
      }

      saveCitations(parsed);
      const invalid = parsed.filter(c => !c.valid).length;
      if (invalid > 0) {
        showStatus(`提取完成，共 ${parsed.length} 条引用，其中 ${invalid} 条有问题`);
      } else {
        showStatus(`提取完成，共 ${parsed.length} 条引用，全部格式正确`);
      }
      onRequestSave?.();
    } catch (err) {
      if (abortRef.current) return;
      showStatus(`提取失败：${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setGenerating(false);
    }
  }, [generating, content, document.content, style, prompt, host, saveCitations, onRequestSave]);

  const startEdit = (c: Citation) => {
    setEditingId(c.id);
    setEditTitle(c.title);
    setEditAuthors(c.authors.join(', '));
    setEditYear(c.year);
    setEditSource(c.source);
  };

  const confirmEdit = () => {
    if (!editingId) return;
    const newCitations = citations.map(c =>
      c.id === editingId
        ? { ...c, title: editTitle, authors: editAuthors.split(',').map(s => s.trim()).filter(Boolean), year: editYear, source: editSource }
        : c
    );
    saveCitations(newCitations);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  const deleteCitation = (id: string) => {
    const newCitations = citations.filter(c => c.id !== id).map((c, i) => ({ ...c, index: i + 1 }));
    saveCitations(newCitations);
    showStatus('已删除一条引用');
  };

  const handleExportBib = async () => {
    if (citations.length === 0) return;
    try {
      const lines = citations.map((c, i) => {
        const key = `ref${i + 1}`;
        const parts = [`@${c.type === 'journal' ? 'article' : c.type === 'book' ? 'book' : 'misc'}{${key}`];
        if (c.authors.length) parts.push(`  author = {${c.authors.join(' and ')}}`);
        parts.push(`  title = {${c.title}}`);
        if (c.source) parts.push(`  ${c.type === 'journal' ? 'journal' : 'publisher'} = {${c.source}}`);
        if (c.year) parts.push(`  year = {${c.year}}`);
        if (c.volume) parts.push(`  volume = {${c.volume}}`);
        if (c.issue) parts.push(`  number = {${c.issue}}`);
        if (c.pages) parts.push(`  pages = {${c.pages}}`);
        if (c.doi) parts.push(`  doi = {${c.doi}}`);
        if (c.url) parts.push(`  url = {${c.url}}`);
        return parts.join(',\n') + '\n}';
      });
      const bib = lines.join('\n\n');
      const safeTitle = (document.title || 'references').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}.bib`, extensions: ['bib'] });
      if (!filePath) return;
      const data = Array.from(new TextEncoder().encode(bib));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出 BibTeX: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const handleExportCsv = async () => {
    if (citations.length === 0) return;
    try {
      const header = '"序号","作者","标题","来源","年份","类型","DOI","有效","问题"';
      const body = citations.map(c =>
        `"${c.index}","${c.authors.join('; ').replace(/"/g, '""')}","${c.title.replace(/"/g, '""')}","${c.source.replace(/"/g, '""')}","${c.year}","${CITATION_TYPE_LABELS[c.type] || c.type}","${c.doi || ''}","${c.valid ? '是' : '否'}","${c.issues.join('; ').replace(/"/g, '""')}"`
      ).join('\n');
      const csv = '\uFEFF' + header + '\n' + body;
      const safeTitle = (document.title || 'references').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_引用.csv`, extensions: ['csv'] });
      if (!filePath) return;
      const data = Array.from(new TextEncoder().encode(csv));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const hasContent = citations.length > 0;

  const toolbarContent = (
    <>
      {hasContent && (
        <>
          <span className="text-xs text-muted-foreground">{citations.length} 条引用</span>
          {invalidCount > 0 && (
            <span className="text-xs text-yellow-600 flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3" />{invalidCount} 有问题
            </span>
          )}
        </>
      )}
      <div className="flex-1" />
      {hasContent && (
        <>
          <select
            value={style}
            onChange={e => { setStyle(e.target.value as CitationStyle); }}
            className="h-7 text-sm border rounded-md px-1.5 bg-background"
            title="引用格式"
          >
            {Object.entries(CITATION_STYLE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={handleExportBib} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            BibTeX
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            CSV
          </Button>
        </>
      )}
    </>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<BookOpen className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title', { defaultValue: '引用管理' })}
      pluginDesc={t('welcomeDesc', { defaultValue: 'AI 识别文档中的引用和参考文献，支持格式转换、完整性检查和导出' })}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder', { defaultValue: '描述引用提取需求...' })}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 提取引用' })}
      generatingLabel={t('stopGenerate', { defaultValue: '中断提取' })}
      toolbar={toolbarContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        setCitations([]);
        setPrompt(DEFAULT_PROMPT);
        onPluginDataChange(null);
        host.docData!.markDirty();
        showStatus('已清空全部引用');
      }}
      sourceCode={hasContent ? JSON.stringify({ citations, style }, null, 2) : undefined}
      onSourceCodeSave={(code) => {
        try {
          const parsed = JSON.parse(code) as { citations: Citation[]; style?: CitationStyle };
          if (parsed.citations) saveCitations(parsed.citations, parsed.style);
        } catch { /* ignore */ }
      }}
    >
      {/* 格式选择器（无内容时） */}
      {!hasContent && (
        <div className="px-3 py-2 border-b">
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(CITATION_STYLE_LABELS) as [CitationStyle, string][]).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setStyle(k)}
                className={`px-2.5 py-1 text-sm rounded-md border transition-colors cursor-pointer ${
                  style === k
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-muted/30 border-border hover:bg-muted/60'
                }`}
                title={v}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 引用列表 */}
      {citations.length > 0 && (
        <div className="w-full h-full overflow-auto p-3 space-y-2">
          {citations.map(cite => (
            <div
              key={cite.id}
              className={`rounded-lg border p-3 transition-shadow hover:shadow-sm ${
                cite.valid
                  ? 'border-border bg-card'
                  : 'border-yellow-300 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20'
              }`}
            >
              {editingId === cite.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="标题"
                    className="w-full px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    title="标题"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={editAuthors}
                    onChange={e => setEditAuthors(e.target.value)}
                    placeholder="作者（逗号分隔）"
                    className="w-full px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    title="作者"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editSource}
                      onChange={e => setEditSource(e.target.value)}
                      placeholder="来源"
                      className="flex-1 px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      title="来源"
                    />
                    <input
                      type="text"
                      value={editYear}
                      onChange={e => setEditYear(e.target.value)}
                      placeholder="年份"
                      className="w-20 px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      title="年份"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="default" size="sm" onClick={confirmEdit} className="h-7 text-xs gap-1">
                      <Check className="h-3 w-3" />
                      保存
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelEdit} className="h-7 text-xs gap-1">
                      <X className="h-3 w-3" />
                      取消
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-mono text-muted-foreground flex-shrink-0">
                        [{cite.index}]
                      </span>
                      {cite.valid ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 flex-shrink-0" />
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
                        {CITATION_TYPE_LABELS[cite.type] || cite.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => startEdit(cite)} className="text-muted-foreground hover:text-foreground cursor-pointer" title="编辑">
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button onClick={() => deleteCitation(cite.id)} className="text-muted-foreground hover:text-destructive cursor-pointer" title="删除">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm font-medium mt-1">{cite.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {cite.authors.join(', ')}{cite.year ? ` (${cite.year})` : ''}
                    {cite.source ? `. ${cite.source}` : ''}
                    {cite.volume ? `, ${cite.volume}` : ''}
                    {cite.issue ? `(${cite.issue})` : ''}
                    {cite.pages ? `: ${cite.pages}` : ''}
                  </p>
                  {cite.doi && (
                    <p className="text-xs text-muted-foreground mt-0.5">DOI: {cite.doi}</p>
                  )}
                  {cite.issues.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {cite.issues.map((issue, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                          ⚠ {issue}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </PluginPanelLayout>
  );
}
