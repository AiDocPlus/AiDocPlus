import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { PluginPanelProps } from '../types';
import type { GlossaryData, GlossaryTerm, SortMode } from './types';
import { generateTermId } from './types';
import { buildGlossarySystemPrompt, buildGlossaryUserPrompt, parseGlossaryFromAiResponse } from './glossaryAiPrompts';
import { truncateContent } from '../_framework/pluginUtils';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { BookA, Download, Trash2, Pencil, Plus, Check, X, Search } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';

const DEFAULT_PROMPT = '从文档中识别并提取专业术语，生成术语表。';

export function GlossaryPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [generating, setGenerating] = useState(false);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [prompt, setPrompt] = useState(
    (pluginData as Record<string, unknown>)?.lastPrompt as string || DEFAULT_PROMPT
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('order');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState('');
  const [editDef, setEditDef] = useState('');
  const [editTranslation, setEditTranslation] = useState('');
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
    if (pluginData && typeof pluginData === 'object' && 'terms' in (pluginData as Record<string, unknown>)) {
      const saved = pluginData as GlossaryData;
      setTerms(saved.terms || []);
    }
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 过滤和排序
  const displayTerms = useMemo(() => {
    let filtered = terms;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = terms.filter(t =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q) ||
        t.aliases.some(a => a.toLowerCase().includes(q)) ||
        (t.translation && t.translation.toLowerCase().includes(q))
      );
    }
    const sorted = [...filtered];
    if (sortMode === 'alpha') {
      sorted.sort((a, b) => a.term.localeCompare(b.term, 'zh-Hans'));
    } else if (sortMode === 'frequency') {
      sorted.sort((a, b) => b.frequency - a.frequency);
    }
    return sorted;
  }, [terms, searchQuery, sortMode]);

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    if (pluginData && typeof pluginData === 'object') {
      onPluginDataChange({ ...(pluginData as Record<string, unknown>), lastPrompt: val });
    }
    host.docData!.markDirty();
  }, [pluginData, onPluginDataChange, host]);

  const saveTerms = useCallback((newTerms: GlossaryTerm[]) => {
    setTerms(newTerms);
    const data: GlossaryData = { terms: newTerms, generatedAt: Date.now(), lastPrompt: prompt };
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
      showStatus('文档内容为空，无法生成术语表', true);
      return;
    }

    abortRef.current = false;
    setGenerating(true);
    showStatus('正在分析文档，识别专业术语...', false, true);

    try {
      const systemPrompt = buildGlossarySystemPrompt();
      const userPrompt = buildGlossaryUserPrompt(truncateContent(sourceContent), prompt !== DEFAULT_PROMPT ? prompt : undefined);

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 8192 });
      if (abortRef.current) return;

      const parsed = parseGlossaryFromAiResponse(result);
      if (!parsed || parsed.length === 0) {
        throw new Error('AI 返回的术语数据格式无效');
      }

      saveTerms(parsed);
      showStatus(`术语表生成完成，共 ${parsed.length} 个术语`);
      onRequestSave?.();
    } catch (err) {
      if (abortRef.current) return;
      showStatus(`生成失败：${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setGenerating(false);
    }
  }, [generating, content, document.content, prompt, host, saveTerms, onRequestSave]);

  // 编辑术语
  const startEdit = (term: GlossaryTerm) => {
    setEditingId(term.id);
    setEditTerm(term.term);
    setEditDef(term.definition);
    setEditTranslation(term.translation || '');
  };

  const confirmEdit = () => {
    if (!editingId) return;
    const newTerms = terms.map(t =>
      t.id === editingId ? { ...t, term: editTerm, definition: editDef, translation: editTranslation || undefined } : t
    );
    saveTerms(newTerms);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  // 删除术语
  const deleteTerm = (id: string) => {
    saveTerms(terms.filter(t => t.id !== id));
    showStatus('已删除一个术语');
  };

  // 添加空术语
  const addTerm = () => {
    const newTerm: GlossaryTerm = {
      id: generateTermId(),
      term: '',
      definition: '',
      aliases: [],
      frequency: 0,
    };
    const newTerms = [...terms, newTerm];
    saveTerms(newTerms);
    startEdit(newTerm);
  };

  // 导出 Markdown
  const handleExportMarkdown = async () => {
    if (terms.length === 0) return;
    try {
      const lines = terms.map(t => {
        let md = `### ${t.term}`;
        if (t.translation) md += ` (${t.translation})`;
        md += `\n\n${t.definition}`;
        if (t.aliases.length > 0) md += `\n\n**别名：** ${t.aliases.join('、')}`;
        if (t.frequency > 0) md += `\n\n**出现频次：** ${t.frequency}`;
        return md;
      });
      const markdown = `# 术语表\n\n${lines.join('\n\n---\n\n')}`;
      const safeTitle = (document.title || 'glossary').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_术语表.md`, extensions: ['md'] });
      if (!filePath) return;
      const data = Array.from(new TextEncoder().encode(markdown));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  // 导出 CSV
  const handleExportCsv = async () => {
    if (terms.length === 0) return;
    try {
      const header = '"术语","定义","别名","频次","翻译"';
      const body = terms.map(t =>
        `"${t.term.replace(/"/g, '""')}","${t.definition.replace(/"/g, '""')}","${t.aliases.join('; ').replace(/"/g, '""')}","${t.frequency}","${(t.translation || '').replace(/"/g, '""')}"`
      ).join('\n');
      const csv = '\uFEFF' + header + '\n' + body;
      const safeTitle = (document.title || 'glossary').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}_术语表.csv`, extensions: ['csv'] });
      if (!filePath) return;
      const data = Array.from(new TextEncoder().encode(csv));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const hasContent = terms.length > 0;

  // 排序模式标签
  const sortLabels: Record<SortMode, string> = { order: '原始顺序', alpha: '字母排序', frequency: '频次排序' };

  // 工具栏
  const toolbarContent = (
    <>
      {hasContent && (
        <span className="text-xs text-muted-foreground">{terms.length} 个术语</span>
      )}
      <div className="flex-1" />
      {hasContent && (
        <>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索术语..."
              className="h-7 pl-7 pr-2 text-sm border rounded-md bg-background w-32 focus:outline-none focus:ring-1 focus:ring-ring"
              title="搜索术语"
            />
          </div>
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            className="h-7 text-sm border rounded-md px-1.5 bg-background"
            title="排序方式"
          >
            {Object.entries(sortLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={addTerm} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" />
            添加
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportMarkdown} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            Markdown
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
      pluginIcon={<BookA className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title', { defaultValue: '术语表' })}
      pluginDesc={t('welcomeDesc', { defaultValue: 'AI 自动识别文档中的专业术语，生成带定义的术语表' })}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder', { defaultValue: '描述术语提取需求...' })}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 生成术语表' })}
      generatingLabel={t('stopGenerate', { defaultValue: '中断生成' })}
      toolbar={toolbarContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        setTerms([]);
        setPrompt(DEFAULT_PROMPT);
        setSearchQuery('');
        onPluginDataChange(null);
        host.docData!.markDirty();
        showStatus('已清空全部术语');
      }}
      sourceCode={hasContent ? JSON.stringify({ terms }, null, 2) : undefined}
      onSourceCodeSave={(code) => {
        try {
          const parsed = JSON.parse(code) as { terms: GlossaryTerm[] };
          if (parsed.terms) saveTerms(parsed.terms);
        } catch { /* ignore */ }
      }}
    >
      {/* 术语列表 */}
      {displayTerms.length > 0 && (
        <div className="w-full h-full overflow-auto p-3 space-y-2">
          {displayTerms.map(term => (
            <div
              key={term.id}
              className="rounded-lg border border-border bg-card p-3 hover:shadow-sm transition-shadow"
            >
              {editingId === term.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTerm}
                    onChange={e => setEditTerm(e.target.value)}
                    placeholder="术语名称"
                    className="w-full px-2 py-1 text-sm font-medium border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    title="术语名称"
                    autoFocus
                  />
                  <textarea
                    value={editDef}
                    onChange={e => setEditDef(e.target.value)}
                    placeholder="术语定义"
                    rows={2}
                    className="w-full px-2 py-1 text-sm border rounded bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    title="术语定义"
                  />
                  <input
                    type="text"
                    value={editTranslation}
                    onChange={e => setEditTranslation(e.target.value)}
                    placeholder="翻译（可选）"
                    className="w-full px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    title="翻译"
                  />
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
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{term.term}</span>
                      {term.translation && (
                        <span className="text-sm text-muted-foreground">({term.translation})</span>
                      )}
                      {term.frequency > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          ×{term.frequency}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEdit(term)}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        title="编辑术语"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => deleteTerm(term.id)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                        title="删除术语"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{term.definition}</p>
                  {term.aliases.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {term.aliases.map((alias, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {alias}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          {searchQuery && displayTerms.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              未找到匹配「{searchQuery}」的术语
            </div>
          )}
        </div>
      )}
    </PluginPanelLayout>
  );
}
