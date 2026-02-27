import { useState, useCallback, useMemo } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_framework/ui';
import { Droplets, Download, Trash2, Eye } from 'lucide-react';

interface WatermarkSettings {
  text: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  color: string;
  density: 'low' | 'medium' | 'high';
}

const DEFAULT_SETTINGS: WatermarkSettings = {
  text: '机密文件',
  fontSize: 24,
  opacity: 0.15,
  rotation: -30,
  color: '#888888',
  density: 'medium',
};

const PRESETS = [
  { key: 'confidential', label: 'presetConfidential', text: '机密文件' },
  { key: 'draft', label: 'presetDraft', text: '草稿' },
  { key: 'internal', label: 'presetInternal', text: '内部资料' },
  { key: 'sample', label: 'presetSample', text: '样本' },
];

export function WatermarkPluginPanel({
  document,
  content,
}: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const stored = (host.storage.get('settings') as Partial<WatermarkSettings>) || {};
  const [settings, setSettings] = useState<WatermarkSettings>({ ...DEFAULT_SETTINGS, ...stored });
  const [showPreview, setShowPreview] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const updateSettings = useCallback((updates: Partial<WatermarkSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    host.storage.set('settings', next);
  }, [settings, host.storage]);

  const getContent = useCallback((): string => {
    return content || document.aiGeneratedContent || document.content || '';
  }, [content, document]);

  // 生成水印 HTML 用于导出
  const generateWatermarkHtml = useCallback((docContent: string): string => {
    const gap = settings.density === 'low' ? 300 : settings.density === 'high' ? 120 : 200;
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: '宋体', serif; font-size: 16px; line-height: 1.8; padding: 40px; position: relative; }
.watermark { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; overflow: hidden; }
.watermark span {
  display: inline-block; position: absolute;
  font-size: ${settings.fontSize}px; color: ${settings.color};
  opacity: ${settings.opacity}; transform: rotate(${settings.rotation}deg);
  white-space: nowrap; user-select: none;
}
.content { position: relative; z-index: 1; white-space: pre-wrap; }
</style></head><body>
<div class="watermark" id="wm"></div>
<div class="content">${docContent.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
<script>
const wm = document.getElementById('wm');
const text = '${settings.text.replace(/'/g, "\\'")}';
for (let y = 0; y < window.innerHeight + 500; y += ${gap}) {
  for (let x = -200; x < window.innerWidth + 500; x += ${gap + 50}) {
    const s = document.createElement('span');
    s.textContent = text;
    s.style.left = x + 'px';
    s.style.top = y + 'px';
    wm.appendChild(s);
  }
}
</script></body></html>`;
  }, [settings]);

  // 导出带水印的 HTML
  const handleExport = useCallback(async () => {
    const docContent = getContent();
    if (!docContent.trim()) {
      showStatus(t('noContent'), true);
      return;
    }

    const filePath = await host.ui.showSaveDialog({
      defaultName: `${document.title || 'document'}_watermark.html`,
      extensions: ['html'],
    });
    if (!filePath) return;

    try {
      const html = generateWatermarkHtml(docContent);
      const encoder = new TextEncoder();
      const bytes = encoder.encode(html);
      await host.platform.invoke('write_binary_file', { path: filePath, data: Array.from(bytes) });
      showStatus(t('exportSuccess'));
    } catch (err) {
      showStatus(`${t('exportFailed')}: ${err instanceof Error ? err.message : String(err)}`, true);
    }
  }, [getContent, document.title, host.ui, host.platform, t, showStatus, generateWatermarkHtml]);

  const handleImportContent = useCallback((_text: string, _source: string) => {
    // 水印插件不需要导入
  }, []);

  // 水印预览
  const previewStyle = useMemo(() => ({
    position: 'relative' as const,
    overflow: 'hidden',
    minHeight: '200px',
  }), []);

  const watermarkItems = useMemo(() => {
    const gap = settings.density === 'low' ? 120 : settings.density === 'high' ? 50 : 80;
    const items: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < 300; y += gap) {
      for (let x = -50; x < 500; x += gap + 30) {
        items.push({ x, y });
      }
    }
    return items;
  }, [settings.density]);

  return (
    <ToolPluginLayout
      pluginIcon={<Droplets className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={handleImportContent}
      hasContent={true}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      extraToolbar={
        <>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-3 w-3" />
            {t('preview')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleExport}>
            <Download className="h-3 w-3" />
            {t('export')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => { setSettings(DEFAULT_SETTINGS); host.storage.set('settings', DEFAULT_SETTINGS); }}>
            <Trash2 className="h-3 w-3" />
            {t('clear')}
          </Button>
        </>
      }
    >
      <div className="p-4 space-y-4">
        {/* 预设 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('presets')}</Label>
          <div className="flex gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => updateSettings({ text: p.text })}
                className={`px-2 py-1 text-xs rounded border transition-colors ${
                  settings.text === p.text
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {t(p.label)}
              </button>
            ))}
          </div>
        </div>

        {/* 水印文字 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('watermarkText')}</Label>
          <input
            type="text"
            value={settings.text}
            onChange={(e) => updateSettings({ text: e.target.value })}
            placeholder={t('watermarkTextPlaceholder')}
            className="w-full h-8 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            style={{ fontFamily: '宋体', fontSize: '16px' }}
          />
        </div>

        {/* 设置网格 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t('fontSize')}: {settings.fontSize}px</Label>
            <input
              type="range" min={12} max={60} step={1}
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              className="w-full h-1.5 accent-primary"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('opacity')}: {Math.round(settings.opacity * 100)}%</Label>
            <input
              type="range" min={5} max={50} step={1}
              value={Math.round(settings.opacity * 100)}
              onChange={(e) => updateSettings({ opacity: Number(e.target.value) / 100 })}
              className="w-full h-1.5 accent-primary"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('rotation')}: {settings.rotation}°</Label>
            <input
              type="range" min={-90} max={90} step={5}
              value={settings.rotation}
              onChange={(e) => updateSettings({ rotation: Number(e.target.value) })}
              className="w-full h-1.5 accent-primary"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('color')}</Label>
            <input
              type="color"
              value={settings.color}
              onChange={(e) => updateSettings({ color: e.target.value })}
              className="w-full h-8 border rounded cursor-pointer"
            />
          </div>
        </div>

        {/* 密度 */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t('density')}</Label>
          <Select value={settings.density} onValueChange={(v) => updateSettings({ density: v as 'low' | 'medium' | 'high' })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{t('densityLow')}</SelectItem>
              <SelectItem value="medium">{t('densityMedium')}</SelectItem>
              <SelectItem value="high">{t('densityHigh')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 预览 */}
        {showPreview && (
          <div className="rounded-lg border overflow-hidden" style={previewStyle}>
            <div className="p-3 text-xs text-muted-foreground bg-card" style={{ fontFamily: '宋体', fontSize: '16px' }}>
              {(getContent() || '这是一段示例文本，用于预览水印效果。\n\n文档水印可以保护您的文档内容，防止未经授权的使用。').slice(0, 500)}
            </div>
            {/* 水印层 */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {watermarkItems.map((item, i) => (
                <span
                  key={i}
                  className="absolute whitespace-nowrap select-none"
                  style={{
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                    fontSize: `${settings.fontSize}px`,
                    color: settings.color,
                    opacity: settings.opacity,
                    transform: `rotate(${settings.rotation}deg)`,
                  }}
                >
                  {settings.text}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </ToolPluginLayout>
  );
}
