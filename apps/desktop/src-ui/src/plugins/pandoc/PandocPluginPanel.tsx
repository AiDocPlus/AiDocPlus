import { useState, useCallback, useRef, useEffect } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_framework/ui';
import {
  FileOutput, Download, Loader2, RefreshCw, AlertTriangle,
  ChevronDown, ChevronUp, Settings2, ExternalLink,
} from 'lucide-react';

// ── 导出格式定义 ──

interface ExportFormat {
  id: string;
  label: string;
  ext: string;
  pandocFormat: string;
  needsPdfEngine?: boolean;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { id: 'pdf',      label: 'formatPdf',      ext: 'pdf',   pandocFormat: 'pdf',            needsPdfEngine: true },
  { id: 'docx',     label: 'formatDocx',     ext: 'docx',  pandocFormat: 'docx' },
  { id: 'epub',     label: 'formatEpub',     ext: 'epub',  pandocFormat: 'epub' },
  { id: 'latex',    label: 'formatLatex',    ext: 'tex',   pandocFormat: 'latex' },
  { id: 'html',     label: 'formatHtml',     ext: 'html',  pandocFormat: 'html5' },
  { id: 'rtf',      label: 'formatRtf',      ext: 'rtf',   pandocFormat: 'rtf' },
  { id: 'odt',      label: 'formatOdt',      ext: 'odt',   pandocFormat: 'odt' },
  { id: 'rst',      label: 'formatRst',      ext: 'rst',   pandocFormat: 'rst' },
  { id: 'asciidoc', label: 'formatAsciidoc', ext: 'adoc',  pandocFormat: 'asciidoc' },
  { id: 'plain',    label: 'formatPlain',    ext: 'txt',   pandocFormat: 'plain' },
];

const PDF_ENGINES = ['xelatex', 'lualatex', 'pdflatex', 'tectonic'];

// ── 插件存储类型 ──

interface PandocStorageData {
  selectedFormat?: string;
  contentSource?: 'ai' | 'original' | 'merged';
  pdfEngine?: string;
  cjkFont?: string;
  toc?: boolean;
  standalone?: boolean;
  customArgs?: string;
  showAdvanced?: boolean;
}

// ── 检测结果 ──

interface PandocCheckResult {
  available: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export function PandocPluginPanel({
  document,
  content,
}: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  // 从独立存储恢复设置
  const stored = (host.storage.get('settings') as PandocStorageData) || {};

  const [selectedFormat, setSelectedFormat] = useState(stored.selectedFormat || 'pdf');
  const [contentSource, setContentSource] = useState<'ai' | 'original' | 'merged'>(stored.contentSource || 'ai');
  const [pdfEngine, setPdfEngine] = useState(stored.pdfEngine || 'xelatex');
  const [cjkFont, setCjkFont] = useState(stored.cjkFont || '');
  const [toc, setToc] = useState(stored.toc ?? false);
  const [standalone, setStandalone] = useState(stored.standalone ?? true);
  const [customArgs, setCustomArgs] = useState(stored.customArgs || '');
  const [showAdvanced, setShowAdvanced] = useState(stored.showAdvanced ?? false);

  const [pandocStatus, setPandocStatus] = useState<PandocCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 导入的内容（从工具栏导入按钮）
  const [importedContent, setImportedContent] = useState('');

  const showStatus = useCallback((msg: string, isError = false, persistent = false) => {
    if (statusTimerRef.current) { clearTimeout(statusTimerRef.current); statusTimerRef.current = null; }
    setStatusMsg(msg);
    setStatusIsError(isError);
    if (!persistent) {
      statusTimerRef.current = setTimeout(() => { setStatusMsg(null); statusTimerRef.current = null; }, 5000);
    }
  }, []);

  // 持久化设置
  const saveSettings = useCallback((updates: Partial<PandocStorageData>) => {
    const current = (host.storage.get('settings') as PandocStorageData) || {};
    host.storage.set('settings', { ...current, ...updates });
  }, [host.storage]);

  // 检测 Pandoc
  const checkPandoc = useCallback(async () => {
    setChecking(true);
    try {
      const result = await host.platform.invoke<PandocCheckResult>('check_pandoc');
      setPandocStatus(result);
      if (result.available) {
        showStatus(`${t('pandocReady')} (${result.version})`);
      } else {
        showStatus(t('pandocNotFound'), true);
      }
    } catch (err) {
      setPandocStatus({ available: false, error: String(err) });
      showStatus(t('pandocNotFound'), true);
    } finally {
      setChecking(false);
    }
  }, [host.platform, t, showStatus]);

  // 初始化时检测 Pandoc
  useEffect(() => {
    checkPandoc();
  }, [checkPandoc]);

  // 获取导出内容
  const getExportContent = useCallback((): string => {
    if (importedContent) return importedContent;
    switch (contentSource) {
      case 'ai':
        return content || document.aiGeneratedContent || document.content || '';
      case 'original':
        return document.content || '';
      case 'merged':
        return host.content.getComposedContent() || '';
      default:
        return content || document.aiGeneratedContent || document.content || '';
    }
  }, [contentSource, content, document, host.content, importedContent]);

  // 导出
  const handleExport = useCallback(async () => {
    const exportContent = getExportContent();
    if (!exportContent.trim()) {
      showStatus(t('noContent'), true);
      return;
    }

    const format = EXPORT_FORMATS.find(f => f.id === selectedFormat);
    if (!format) return;

    // 弹出保存对话框
    const filePath = await host.ui.showSaveDialog({
      defaultName: `${document.title || 'document'}.${format.ext}`,
      extensions: [format.ext],
    });
    if (!filePath) return;

    setExporting(true);
    showStatus(t('exporting'), false, true);

    try {
      // 构建额外参数
      const extraArgs: string[] = [];
      if (standalone) extraArgs.push('--standalone');
      if (toc) extraArgs.push('--toc');
      if (format.needsPdfEngine && pdfEngine) {
        extraArgs.push(`--pdf-engine=${pdfEngine}`);
      }
      if (cjkFont) {
        extraArgs.push(`-V`, `CJKmainfont=${cjkFont}`);
      }
      // 自定义参数
      if (customArgs.trim()) {
        const lines = customArgs.split('\n').map(l => l.trim()).filter(Boolean);
        extraArgs.push(...lines);
      }

      await host.platform.invoke('pandoc_export', {
        markdown: exportContent,
        outputPath: filePath,
        format: format.pandocFormat,
        extraArgs,
        title: document.title || '',
      });

      showStatus(`${t('exportSuccess')}: ${filePath}`);

      // 保存当前设置
      saveSettings({
        selectedFormat,
        contentSource,
        pdfEngine,
        cjkFont,
        toc,
        standalone,
        customArgs,
        showAdvanced,
      });
    } catch (err) {
      showStatus(`${t('exportFailed')}: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setExporting(false);
    }
  }, [
    getExportContent, selectedFormat, document.title, host.ui, host.platform,
    t, standalone, toc, pdfEngine, cjkFont, customArgs, showStatus, saveSettings,
    contentSource, showAdvanced,
  ]);

  const handleImportContent = useCallback((text: string, source: string) => {
    setImportedContent(text);
    showStatus(`已导入${source}内容 (${text.length} 字符)`);
  }, [showStatus]);

  const currentFormat = EXPORT_FORMATS.find(f => f.id === selectedFormat);

  return (
    <ToolPluginLayout
      pluginIcon={<FileOutput className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={handleImportContent}
      hasContent={true}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      statusExtra={
        pandocStatus?.available ? (
          <span className="text-xs text-green-600 dark:text-green-400">
            Pandoc {pandocStatus.version}
          </span>
        ) : null
      }
    >
      <div className="p-4 space-y-4">
        {/* Pandoc 状态 */}
        {checking ? (
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('checking')}</span>
          </div>
        ) : pandocStatus && !pandocStatus.available ? (
          <div className="p-3 rounded-lg border border-amber-500/50 bg-amber-500/10 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{t('pandocNotFound')}</span>
              <div className="flex-1" />
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={checkPandoc}>
                <RefreshCw className="h-3 w-3" />
                {t('refreshPandoc')}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>{t('installGuideDesc')}</p>
              <code className="block bg-muted/50 px-2 py-1 rounded text-xs">{t('installMac')}</code>
              <code className="block bg-muted/50 px-2 py-1 rounded text-xs">{t('installWin')}</code>
              <code className="block bg-muted/50 px-2 py-1 rounded text-xs">{t('installLinux')}</code>
              <a
                href="https://pandoc.org/installing.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline mt-1"
              >
                pandoc.org <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ) : null}

        {/* 导出格式选择 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('format')}</Label>
          <Select value={selectedFormat} onValueChange={(v) => { setSelectedFormat(v); saveSettings({ selectedFormat: v }); }}>
            <SelectTrigger>
              <SelectValue placeholder={t('selectFormat')} />
            </SelectTrigger>
            <SelectContent>
              {EXPORT_FORMATS.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {t(f.label)} (.{f.ext})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 内容来源 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t('contentSource')}</Label>
          <Select value={contentSource} onValueChange={(v) => { setContentSource(v as 'ai' | 'original' | 'merged'); saveSettings({ contentSource: v as 'ai' | 'original' | 'merged' }); }}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ai">{t('sourceAiContent')}</SelectItem>
              <SelectItem value="original">{t('sourceOriginal')}</SelectItem>
              <SelectItem value="merged">{t('sourceMerged')}</SelectItem>
            </SelectContent>
          </Select>
          {importedContent && (
            <p className="text-xs text-muted-foreground">
              已通过工具栏导入内容 ({importedContent.length} 字符)，将优先使用导入内容
            </p>
          )}
        </div>

        {/* 高级选项 */}
        <div>
          <button
            onClick={() => { const next = !showAdvanced; setShowAdvanced(next); saveSettings({ showAdvanced: next }); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t('advancedOptions')}
            {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 pl-1 border-l-2 border-muted ml-1.5">
              <div className="pl-3 space-y-3">
                {/* PDF 引擎（仅 PDF 格式时显示） */}
                {currentFormat?.needsPdfEngine && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('pdfEngine')}</Label>
                    <Select value={pdfEngine} onValueChange={(v) => { setPdfEngine(v); saveSettings({ pdfEngine: v }); }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PDF_ENGINES.map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 中文字体 */}
                {currentFormat?.needsPdfEngine && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('cjkFont')}</Label>
                    <input
                      type="text"
                      value={cjkFont}
                      onChange={(e) => { setCjkFont(e.target.value); saveSettings({ cjkFont: e.target.value }); }}
                      placeholder={t('autoDetect')}
                      className="w-full h-8 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      style={{ fontFamily: '宋体', fontSize: '16px' }}
                    />
                  </div>
                )}

                {/* 目录 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={toc}
                    onChange={(e) => { setToc(e.target.checked); saveSettings({ toc: e.target.checked }); }}
                    className="rounded border-border"
                  />
                  <span className="text-xs">{t('toc')}</span>
                </label>

                {/* 独立文件 */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={standalone}
                    onChange={(e) => { setStandalone(e.target.checked); saveSettings({ standalone: e.target.checked }); }}
                    className="rounded border-border"
                  />
                  <span className="text-xs">{t('standalone')}</span>
                </label>

                {/* 自定义参数 */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('customArgs')}</Label>
                  <textarea
                    value={customArgs}
                    onChange={(e) => { setCustomArgs(e.target.value); saveSettings({ customArgs: e.target.value }); }}
                    placeholder={t('customArgsPlaceholder')}
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                    style={{ fontFamily: '宋体', fontSize: '16px' }}
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 导出按钮 */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleExport}
          disabled={exporting || !pandocStatus?.available}
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? t('exporting') : `${t('exportBtn')} ${currentFormat ? t(currentFormat.label) : ''}`}
        </Button>
      </div>
    </ToolPluginLayout>
  );
}
