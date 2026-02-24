import { useState, useRef, useCallback, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import type { ExtractData, Extraction, ExtractTemplate } from './types';
import { EXTRACT_TEMPLATES } from './types';
import {
  buildExtractSystemPrompt,
  buildCustomExtractSystemPrompt,
  buildExtractUserPrompt,
  parseExtractFromAiResponse,
} from './extractAiPrompts';
import { truncateContent } from '../_framework/pluginUtils';
import { Button } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { TableProperties, Download, Trash2, Plus, Check, X } from 'lucide-react';
import { PluginPanelLayout } from '../_framework/PluginPanelLayout';

const DEFAULT_PROMPT = '从文档中提取结构化信息。';

export function ExtractPluginPanel({ document, content, pluginData, onPluginDataChange, onRequestSave }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [generating, setGenerating] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ExtractTemplate>(EXTRACT_TEMPLATES[0]);
  const [customDesc, setCustomDesc] = useState('');
  const [prompt, setPrompt] = useState(
    (pluginData as Record<string, unknown>)?.lastPrompt as string || DEFAULT_PROMPT
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [currentExtraction, setCurrentExtraction] = useState<Extraction | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [editValue, setEditValue] = useState('');
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

  // 从 pluginData 加载已保存的数据
  useEffect(() => {
    if (pluginData && typeof pluginData === 'object' && 'extractions' in (pluginData as Record<string, unknown>)) {
      const saved = pluginData as ExtractData;
      const keys = Object.keys(saved.extractions);
      if (keys.length > 0) {
        setCurrentExtraction(saved.extractions[keys[keys.length - 1]]);
      }
    }
  }, [document.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePromptChange = useCallback((val: string) => {
    setPrompt(val);
    if (pluginData && typeof pluginData === 'object') {
      onPluginDataChange({ ...(pluginData as Record<string, unknown>), lastPrompt: val });
    }
    host.docData!.markDirty();
  }, [pluginData, onPluginDataChange, host]);

  const handleGenerate = useCallback(async () => {
    if (generating) {
      abortRef.current = true;
      setGenerating(false);
      showStatus('已中断提取');
      return;
    }

    const sourceContent = content || document.content || '';
    if (!sourceContent.trim()) {
      showStatus('文档内容为空，无法提取', true);
      return;
    }

    if (selectedTemplate.key === 'custom' && !customDesc.trim()) {
      showStatus('请描述你要提取的信息', true);
      return;
    }

    abortRef.current = false;
    setGenerating(true);
    showStatus(`正在从文档中提取「${selectedTemplate.label}」信息...`, false, true);

    try {
      const isCustom = selectedTemplate.key === 'custom';
      const systemPrompt = isCustom
        ? buildCustomExtractSystemPrompt()
        : buildExtractSystemPrompt(selectedTemplate.fields);
      const userPrompt = buildExtractUserPrompt(
        truncateContent(sourceContent),
        selectedTemplate,
        isCustom ? customDesc : undefined
      );

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const result = await host.ai.chat(messages, { maxTokens: 8192 });
      if (abortRef.current) return;

      const parsed = parseExtractFromAiResponse(result);
      if (!parsed) {
        throw new Error('AI 返回的数据格式无效');
      }

      const extraction: Extraction = {
        templateKey: selectedTemplate.key,
        templateLabel: selectedTemplate.label,
        fields: parsed.fields,
        rows: parsed.rows,
        generatedAt: Date.now(),
      };

      setCurrentExtraction(extraction);

      const existingData = (pluginData as ExtractData) || { extractions: {} };
      const newData: ExtractData = {
        ...existingData,
        extractions: {
          ...existingData.extractions,
          [selectedTemplate.key]: extraction,
        },
        lastPrompt: prompt,
      };
      onPluginDataChange(newData);
      host.docData!.markDirty();

      showStatus(`提取完成，共 ${parsed.rows.length} 条记录`);
      onRequestSave?.();
    } catch (err) {
      if (abortRef.current) return;
      const errMsg = err instanceof Error ? err.message : String(err);
      showStatus(`提取失败：${errMsg}`, true);
    } finally {
      setGenerating(false);
    }
  }, [generating, content, document.content, selectedTemplate, customDesc, prompt, pluginData, onPluginDataChange, host, onRequestSave]);

  // 编辑单元格
  const startEdit = (rowIdx: number, key: string, value: string) => {
    setEditingCell({ row: rowIdx, key });
    setEditValue(value);
  };

  const confirmEdit = () => {
    if (!editingCell || !currentExtraction) return;
    const newRows = [...currentExtraction.rows];
    newRows[editingCell.row] = { ...newRows[editingCell.row], [editingCell.key]: editValue };
    const updated = { ...currentExtraction, rows: newRows };
    setCurrentExtraction(updated);
    updatePluginData(updated);
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  // 删除行
  const deleteRow = (rowIdx: number) => {
    if (!currentExtraction) return;
    const newRows = currentExtraction.rows.filter((_, i) => i !== rowIdx);
    const updated = { ...currentExtraction, rows: newRows };
    setCurrentExtraction(updated);
    updatePluginData(updated);
    showStatus('已删除一条记录');
  };

  // 添加空行
  const addRow = () => {
    if (!currentExtraction) return;
    const emptyRow: Record<string, string> = {};
    for (const f of currentExtraction.fields) {
      emptyRow[f.key] = '';
    }
    const updated = { ...currentExtraction, rows: [...currentExtraction.rows, emptyRow] };
    setCurrentExtraction(updated);
    updatePluginData(updated);
  };

  const updatePluginData = (extraction: Extraction) => {
    const existingData = (pluginData as ExtractData) || { extractions: {} };
    const newData: ExtractData = {
      ...existingData,
      extractions: { ...existingData.extractions, [extraction.templateKey]: extraction },
    };
    onPluginDataChange(newData);
    host.docData!.markDirty();
  };

  // 导出 CSV
  const handleExportCsv = async () => {
    if (!currentExtraction) return;
    try {
      const { fields, rows } = currentExtraction;
      const header = fields.map(f => `"${f.label}"`).join(',');
      const body = rows.map(row =>
        fields.map(f => `"${(row[f.key] || '').replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      const csv = '\uFEFF' + header + '\n' + body;

      const safeTitle = (currentExtraction.templateLabel || 'extract').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}.csv`, extensions: ['csv'] });
      if (!filePath) return;

      const data = Array.from(new TextEncoder().encode(csv));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  // 导出 JSON
  const handleExportJson = async () => {
    if (!currentExtraction) return;
    try {
      const json = JSON.stringify(currentExtraction.rows, null, 2);
      const safeTitle = (currentExtraction.templateLabel || 'extract').replace(/[/\\:*?"<>|]/g, '_');
      const filePath = await host.ui.showSaveDialog({ defaultName: `${safeTitle}.json`, extensions: ['json'] });
      if (!filePath) return;

      const data = Array.from(new TextEncoder().encode(json));
      await host.platform.invoke('write_binary_file', { path: filePath, data });
      showStatus(`已导出: ${filePath}`);
    } catch (error) {
      showStatus(`导出失败: ${error instanceof Error ? error.message : String(error)}`, true);
    }
  };

  const hasContent = !!currentExtraction && currentExtraction.rows.length > 0;

  // 模板选择器（放在生成区上方）
  const generationZoneExtra = (
    <div className="space-y-2 mb-2">
      <div className="flex flex-wrap gap-1.5">
        {EXTRACT_TEMPLATES.map(tmpl => (
          <button
            key={tmpl.key}
            onClick={() => setSelectedTemplate(tmpl)}
            className={`px-2.5 py-1 text-sm rounded-md border transition-colors cursor-pointer ${
              selectedTemplate.key === tmpl.key
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-muted/30 border-border hover:bg-muted/60'
            }`}
            title={tmpl.description}
          >
            {tmpl.label}
          </button>
        ))}
      </div>
      {selectedTemplate.key === 'custom' && (
        <input
          type="text"
          value={customDesc}
          onChange={e => setCustomDesc(e.target.value)}
          placeholder="描述你要提取的信息，如：提取所有产品名称、价格和规格..."
          className="w-full px-2.5 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          title="自定义提取描述"
        />
      )}
    </div>
  );

  // 工具栏
  const toolbarContent = (
    <>
      <div className="flex-1" />
      {currentExtraction && (
        <>
          <Button variant="outline" size="sm" onClick={addRow} className="gap-1 h-7 text-xs">
            <Plus className="h-3 w-3" />
            添加行
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            导出 CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJson} className="gap-1 h-7 text-xs">
            <Download className="h-3 w-3" />
            导出 JSON
          </Button>
        </>
      )}
    </>
  );

  return (
    <PluginPanelLayout
      pluginIcon={<TableProperties className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title', { defaultValue: '结构化数据提取' })}
      pluginDesc={t('welcomeDesc', { defaultValue: '选择提取模板，AI 将从文档中提取结构化信息，支持编辑和导出' })}
      prompt={prompt}
      onPromptChange={handlePromptChange}
      promptPlaceholder={t('promptPlaceholder', { defaultValue: '描述提取需求...' })}
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel={t('generate', { defaultValue: 'AI 提取数据' })}
      generatingLabel={t('stopGenerate', { defaultValue: '中断提取' })}
      toolbar={toolbarContent}
      hasContent={hasContent}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      onClearAll={() => {
        setCurrentExtraction(null);
        setPrompt(DEFAULT_PROMPT);
        onPluginDataChange(null);
        host.docData!.markDirty();
        showStatus('已清空全部内容');
      }}
      sourceCode={currentExtraction ? JSON.stringify(currentExtraction, null, 2) : undefined}
      onSourceCodeSave={(code) => {
        try {
          const parsed = JSON.parse(code) as Extraction;
          setCurrentExtraction(parsed);
          updatePluginData(parsed);
        } catch { /* ignore invalid JSON */ }
      }}
    >
      {/* 模板选择器 */}
      {!hasContent && generationZoneExtra}

      {/* 表格内容区 */}
      {currentExtraction && currentExtraction.rows.length > 0 && (
        <div className="w-full h-full overflow-auto">
          {/* 模板选择器（有内容时也显示在顶部） */}
          <div className="px-3 py-2 border-b bg-muted/20">
            {generationZoneExtra}
          </div>
          <div className="p-2">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="border border-border px-2 py-1.5 text-left font-medium w-8">#</th>
                  {currentExtraction.fields.map(f => (
                    <th key={f.key} className="border border-border px-2 py-1.5 text-left font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="border border-border px-2 py-1.5 text-center font-medium w-16">操作</th>
                </tr>
              </thead>
              <tbody>
                {currentExtraction.rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="hover:bg-muted/20">
                    <td className="border border-border px-2 py-1 text-muted-foreground">{rowIdx + 1}</td>
                    {currentExtraction.fields.map(f => (
                      <td
                        key={f.key}
                        className="border border-border px-2 py-1 cursor-pointer hover:bg-primary/5"
                        onClick={() => startEdit(rowIdx, f.key, row[f.key] || '')}
                      >
                        {editingCell?.row === rowIdx && editingCell?.key === f.key ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') confirmEdit();
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              className="flex-1 px-1 py-0.5 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                              title="编辑单元格"
                              autoFocus
                            />
                            <button onClick={confirmEdit} className="text-green-600 hover:text-green-700 cursor-pointer" title="确认">
                              <Check className="h-3 w-3" />
                            </button>
                            <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground cursor-pointer" title="取消">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="block min-h-[1.2em]">{row[f.key] || ''}</span>
                        )}
                      </td>
                    ))}
                    <td className="border border-border px-2 py-1 text-center">
                      <button
                        onClick={() => deleteRow(rowIdx)}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                        title="删除此行"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-sm text-muted-foreground">
              共 {currentExtraction.rows.length} 条记录 · 点击单元格可编辑
            </div>
          </div>
        </div>
      )}
    </PluginPanelLayout>
  );
}
