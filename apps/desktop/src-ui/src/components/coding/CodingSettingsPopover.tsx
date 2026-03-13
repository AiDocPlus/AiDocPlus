import { useTranslation } from 'react-i18next';
import { save } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Settings, CheckCircle, XCircle, X } from 'lucide-react';

interface RunHistoryEntry {
  id: string;
  fileName: string;
  exitCode: number | null;
  durationMs: number;
  timestamp: number;
}

interface CodingSettings {
  customPythonPath: string;
  customNodePath: string;
  timeout: number;
  fontSize: number;
  editorTheme: string;
  passDocContent: boolean;
  specifyOutput: boolean;
  outputPath: string;
  extraArgs: string;
  envVars: Record<string, string>;
  [key: string]: any;
}

interface CodingSettingsPopoverProps {
  activeLang: string;
  settings: CodingSettings;
  updateSettings: (patch: Partial<CodingSettings>) => void;
  runHistory: RunHistoryEntry[];
  clearRunHistory: () => void;
  scriptsDir: string;
}

export function CodingSettingsPopover({
  activeLang,
  settings,
  updateSettings,
  runHistory,
  clearRunHistory,
  scriptsDir,
}: CodingSettingsPopoverProps) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-base px-2" title={t('coding.settings', { defaultValue: '设置' })}>
          <Settings className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 p-3 space-y-2.5">
        <p className="text-base font-semibold">{t('coding.settings', { defaultValue: '设置' })}</p>
        {/* Python 专属设置 */}
        {activeLang === 'python' && (
          <div className="space-y-0.5">
            <Label className="text-sm">{t('coding.pythonPath', { defaultValue: 'Python 路径' })}</Label>
            <Input value={settings.customPythonPath} onChange={e => updateSettings({ customPythonPath: e.target.value })}
              placeholder={t('coding.pythonPathPlaceholder', { defaultValue: '留空自动检测' })} className="h-8 text-base" />
          </div>
        )}
        {/* Node.js 专属设置 */}
        {(activeLang === 'javascript' || activeLang === 'typescript') && (
          <div className="space-y-0.5">
            <Label className="text-sm">Node.js 路径</Label>
            <Input value={settings.customNodePath} onChange={e => updateSettings({ customNodePath: e.target.value })}
              placeholder="留空自动检测" className="h-8 text-base" />
          </div>
        )}
        <div className="flex items-center gap-2">
          <Label className="text-sm flex-1">{t('coding.timeout', { defaultValue: '超时(秒)' })}</Label>
          <Input type="number" value={settings.timeout} min={5} max={300}
            onChange={e => updateSettings({ timeout: Number(e.target.value) })}
            className="h-8 text-base w-20" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('coding.fontSize', { defaultValue: '字号' })}</Label>
            <span className="text-sm font-mono text-muted-foreground">{settings.fontSize}px</span>
          </div>
          <input type="range" min={10} max={20} step={1} value={settings.fontSize}
            onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
            className="w-full h-1.5 accent-primary"
            title={t('coding.fontSize', { defaultValue: '字号' })} />
        </div>
        <div className="space-y-0.5">
          <Label className="text-sm">{t('coding.editorTheme', { defaultValue: '编辑器主题' })}</Label>
          <div className="flex gap-1">
            {[
              { id: 'auto', label: t('coding.themeAuto', { defaultValue: '自动' }) },
              { id: 'light', label: t('coding.themeLight', { defaultValue: '浅色' }) },
              { id: 'oneDark', label: 'One Dark' },
            ].map(th => (
              <Button key={th.id} variant={settings.editorTheme === th.id ? 'default' : 'outline'}
                size="sm" className="h-6 text-xs flex-1"
                onClick={() => updateSettings({ editorTheme: th.id })}>
                {th.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('coding.passDocContent', { defaultValue: '传入文档内容' })}</Label>
          <Switch checked={settings.passDocContent} onCheckedChange={v => updateSettings({ passDocContent: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('coding.specifyOutput', { defaultValue: '指定输出路径' })}</Label>
          <Switch checked={settings.specifyOutput} onCheckedChange={v => updateSettings({ specifyOutput: v })} />
        </div>
        {settings.specifyOutput && (
          <div className="flex items-center gap-1.5">
            <Input value={settings.outputPath} onChange={e => updateSettings({ outputPath: e.target.value })}
              placeholder={t('coding.outputPath', { defaultValue: '输出文件路径' })} className="h-8 text-base flex-1" />
            <Button variant="outline" size="sm" className="h-8 text-base"
              onClick={async () => { const p = await save({ defaultPath: 'output.txt' }); if (p) updateSettings({ outputPath: p }); }}>
              {t('coding.selectOutputPath', { defaultValue: '选择' })}
            </Button>
          </div>
        )}
        <div className="space-y-0.5">
          <Label className="text-sm">{t('coding.extraArgs', { defaultValue: '额外参数' })}</Label>
          <Input value={settings.extraArgs} onChange={e => updateSettings({ extraArgs: e.target.value })}
            placeholder={t('coding.extraArgsPlaceholder', { defaultValue: '传递给脚本的额外参数' })} className="h-8 text-base" />
        </div>
        {/* 环境变量编辑器 */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{t('coding.envVars', { defaultValue: '环境变量' })}</Label>
            <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]"
              onClick={() => {
                const vars = { ...settings.envVars };
                const key = `VAR_${Object.keys(vars).length + 1}`;
                vars[key] = '';
                updateSettings({ envVars: vars });
              }}>+ {t('coding.addEnvVar', { defaultValue: '添加' })}</Button>
          </div>
          {Object.entries(settings.envVars || {}).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1">
              <Input value={k} className="h-6 text-xs flex-1 font-mono" title={t('coding.envKey', { defaultValue: '变量名' })}
                onChange={e => {
                  const vars = { ...settings.envVars };
                  const val = vars[k]; delete vars[k]; vars[e.target.value] = val;
                  updateSettings({ envVars: vars });
                }} />
              <span className="text-muted-foreground">=</span>
              <Input value={v} className="h-6 text-xs flex-1 font-mono" title={t('coding.envValue', { defaultValue: '值' })}
                onChange={e => updateSettings({ envVars: { ...settings.envVars, [k]: e.target.value } })} />
              <button className="p-0.5 hover:bg-muted rounded" title={t('common.delete', { defaultValue: '删除' })}
                onClick={() => { const vars = { ...settings.envVars }; delete vars[k]; updateSettings({ envVars: vars }); }}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        {/* 运行历史 */}
        {runHistory.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{t('coding.runHistory', { defaultValue: '运行历史' })}</Label>
              <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px]"
                onClick={clearRunHistory}>{t('coding.clearHistory', { defaultValue: '清除' })}</Button>
            </div>
            <div className="max-h-28 overflow-y-auto space-y-0.5">
              {runHistory.slice(0, 10).map(h => (
                <div key={h.id} className="flex items-center gap-1.5 text-[10px] font-mono">
                  {h.exitCode === 0
                    ? <CheckCircle className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />
                    : <XCircle className="h-2.5 w-2.5 text-red-500 flex-shrink-0" />}
                  <span className="truncate flex-1">{h.fileName}</span>
                  <span className="text-muted-foreground">{(h.durationMs / 1000).toFixed(1)}s</span>
                  <span className="text-muted-foreground">{new Date(h.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-0.5">
          <Label className="text-sm">{t('coding.scriptsDir', { defaultValue: '脚本目录' })}</Label>
          <div className="text-sm text-muted-foreground font-mono bg-muted/30 px-2 py-1 rounded break-all">{scriptsDir}</div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
