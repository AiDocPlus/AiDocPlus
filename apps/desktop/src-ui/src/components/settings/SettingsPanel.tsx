import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Monitor, Type, Globe, Zap, Download, Upload, RotateCcw, Loader2, Puzzle, Mail, Search, ChevronDown, ChevronRight, LayoutTemplate, Bot, Play, Square, Circle, FolderOpen } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { open as openDialog, message, confirm } from '@tauri-apps/plugin-dialog';
import { useTranslation } from '../../i18n';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, changeAppLanguage } from '../../i18n';
import { formatBackendError } from '@/lib/backendError';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { AISettingsTab } from './AISettingsTab';
import { EmailSettingsTab } from './EmailSettingsTab';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: string;
}

export function SettingsPanel({ open, onClose, defaultTab }: SettingsPanelProps) {
  const { t } = useTranslation();
  const [appVersion, setAppVersion] = useState('');
  const [activeTab, setActiveTab] = useState(defaultTab || 'editor');
  const [dataRootPath, setDataRootPath] = useState('');
  const [isDataMigrating, setIsDataMigrating] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab || 'editor');
      getVersion().then(setAppVersion).catch(() => setAppVersion('0.3.0'));
      invoke<string>('get_data_root_path').then(setDataRootPath).catch(() => {});
    }
  }, [open, defaultTab]);
  const {
    editor,
    ui,
    ai,
    email,
    updateEditorSettings,
    updateUISettings,
    updateAISettings,
    updateEmailSettings,
    resetSettings,
    exportSettings,
    importSettings,
    imBot,
    updateImBotSettings,
    error
  } = useSettingsStore();

  // IM Bot 状态
  const [imBotRunning, setImBotRunning] = useState(false);
  const [imBotLoading, setImBotLoading] = useState(false);
  const imBotPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollImBotStatus = useCallback(async () => {
    try {
      const status = await invoke<{ running: boolean }>('get_imbot_status');
      setImBotRunning(status.running);
    } catch { setImBotRunning(false); }
  }, []);

  useEffect(() => {
    if (open && activeTab === 'advanced') {
      pollImBotStatus();
      imBotPollRef.current = setInterval(pollImBotStatus, 3000);
    }
    return () => { if (imBotPollRef.current) clearInterval(imBotPollRef.current); };
  }, [open, activeTab, pollImBotStatus]);

  const handleStartImBot = async () => {
    setImBotLoading(true);
    try {
      await invoke('start_imbot');
      await pollImBotStatus();
    } catch (e) { console.error('启动 IM Bot 失败:', e); }
    finally { setImBotLoading(false); }
  };

  const handleStopImBot = async () => {
    setImBotLoading(true);
    try {
      await invoke('stop_imbot');
      await pollImBotStatus();
    } catch (e) { console.error('停止 IM Bot 失败:', e); }
    finally { setImBotLoading(false); }
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [tempSettings, setTempSettings] = useState({
    editor,
    ui,
    ai,
    email
  });

  // 当设置面板打开时，初始化临时设置
  useEffect(() => {
    if (open) {
      setTempSettings({ editor, ui, ai, email });
      setHasChanges(false);
    }
  }, [open, editor, ui, ai, email]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = () => {
    // 应用临时设置到store
    if (tempSettings.editor) updateEditorSettings(tempSettings.editor);
    if (tempSettings.ui) updateUISettings(tempSettings.ui);
    if (tempSettings.ai) updateAISettings(tempSettings.ai);
    if (tempSettings.email) updateEmailSettings(tempSettings.email);
    setHasChanges(false);
    onClose();
  };

  const handleCancel = () => {
    // 放弃更改，恢复原值
    setTempSettings({ editor, ui, ai, email });
    setHasChanges(false);
    onClose();
  };

  // 更新临时设置的辅助函数
  const updateTempEditor = (newSettings: Partial<typeof editor>) => {
    setTempSettings(prev => ({
      ...prev,
      editor: { ...prev.editor, ...newSettings }
    }));
    setHasChanges(true);
  };

  const updateTempUI = (newSettings: Partial<typeof ui>) => {
    setTempSettings(prev => ({
      ...prev,
      ui: { ...prev.ui, ...newSettings }
    }));
    setHasChanges(true);
  };

  const updateTempAI = (newSettings: Partial<typeof ai>) => {
    setTempSettings(prev => ({
      ...prev,
      ai: { ...prev.ai, ...newSettings }
    }));
    setHasChanges(true);
  };

  const updateTempEmail = (newSettings: Partial<typeof email>) => {
    setTempSettings(prev => ({
      ...prev,
      email: { ...prev.email, ...newSettings }
    }));
    setHasChanges(true);
  };

  const handleExport = () => {
    try {
      const settingsJson = exportSettings();
      const blob = new Blob([settingsJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aidocplus-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export settings:', err);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            importSettings(content);
            // Reload page to apply language change if needed
            if (ui.language) {
              window.location.reload();
            }
          } catch (err) {
            console.error('Failed to import settings:', err);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleReset = () => {
    resetSettings();
    setShowResetConfirm(false);
    // Reload page to apply default language
    window.location.reload();
  };

  const handleLanguageChange = async (lang: SupportedLanguage) => {
    updateUISettings({ language: lang });
    await changeAppLanguage(lang);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] top-[5vh] overflow-hidden flex flex-col bg-card border shadow-2xl p-0 translate-x-[-50%] translate-y-0">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-6 pt-6 bg-card border-b">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            <DialogTitle className="text-xl">{t('settings.title')}</DialogTitle>
            {hasChanges && (
              <span className="text-sm text-amber-500 ml-2">
                {t('common.unsavedChanges', { defaultValue: '未保存' })}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-9 w-full bg-muted">
            <TabsTrigger value="editor">
              <Type className="w-4 h-4 mr-1" />
              {t('settings.editor')}
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Monitor className="w-4 h-4 mr-1" />
              {t('settings.appearance')}
            </TabsTrigger>
            <TabsTrigger value="language">
              <Globe className="w-4 h-4 mr-1" />
              {t('settings.language')}
            </TabsTrigger>
            <TabsTrigger value="plugins">
              <Puzzle className="w-4 h-4 mr-1" />
              {t('settings.plugins', { defaultValue: '插件' })}
            </TabsTrigger>
            <TabsTrigger value="templates">
              <LayoutTemplate className="w-4 h-4 mr-1" />
              {t('settings.templateTab', { defaultValue: '模板' })}
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Zap className="w-4 h-4 mr-1" />
              AI
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="w-4 h-4 mr-1" />
              {t('settings.emailTab', { defaultValue: '邮件' })}
            </TabsTrigger>
            <TabsTrigger value="advanced">
              {t('settings.advanced')}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto bg-card" id="settings-content">
            {/* Plugins */}
            <TabsContent value="plugins" className="space-y-6 p-4 bg-card h-full">
              <div>
                <h3 className="text-lg font-semibold mb-2">{t('settings.pluginsSettings.title', { defaultValue: '插件管理' })}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('settings.pluginsSettings.description', { defaultValue: '管理文档处理插件。插件可以对文档内容进行二次加工，如生成 PPT、思维导图等。' })}
                </p>
                <Separator className="mb-4" />
                <PluginSettingsList />

                {useAppStore.getState().pluginManifests.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Puzzle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t('settings.pluginsSettings.noPlugins', { defaultValue: '暂无可用插件' })}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-2">{t('settings.pluginsSettings.usage', { defaultValue: '使用方法' })}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t('settings.pluginsSettings.usageStep1', { defaultValue: '1. 在文档编辑器工具栏中点击 🧩 插件按钮' })}</p>
                  <p>{t('settings.pluginsSettings.usageStep2', { defaultValue: '2. 从下拉菜单中选择要使用的插件' })}</p>
                  <p>{t('settings.pluginsSettings.usageStep3', { defaultValue: '3. 插件面板将替代编辑器区域显示，点击“返回编辑器”可退出' })}</p>
                </div>
              </div>
            </TabsContent>

            {/* Templates */}
            <TabsContent value="templates" className="space-y-6 p-4 bg-card h-full">
              <div>
                <h3 className="text-lg font-semibold mb-2">{t('settings.templateManagement', { defaultValue: '模板管理' })}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('settings.templateManagementDesc', { defaultValue: '管理文档模板。可通过“文件 → 存为模板”将当前文档保存为模板，或通过“文件 → 从模板新建”使用模板创建文档。' })}
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.dispatchEvent(new CustomEvent('menu-manage-templates'))}
                >
                  <LayoutTemplate className="w-4 h-4 mr-2" />
                  {t('settings.openTemplateManager', { defaultValue: '打开模板管理器' })}
                </Button>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">{t('settings.templateUsage', { defaultValue: '使用方法' })}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t('settings.templateUsageStep1', { defaultValue: '1. 编辑文档后，点击工具栏模板按钮或菜单“文件 → 存为模板”' })}</p>
                  <p>{t('settings.templateUsageStep2', { defaultValue: '2. 设置模板名称、分类，选择保留的内容' })}</p>
                  <p>{t('settings.templateUsageStep3', { defaultValue: '3. 新建文档时，使用“文件 → 从模板新建”（⌘⇧T）选择模板' })}</p>
                  <p>{t('settings.templateUsageStep4', { defaultValue: '4. 模板存储在 ~/AiDocPlus/Templates/ 目录中' })}</p>
                </div>
              </div>
            </TabsContent>

            {/* Editor Settings */}
            <TabsContent value="editor" className="space-y-6 p-4 bg-card h-full">
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('settings.editorSettings.title')}</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.editorSettings.fontSize')}</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[tempSettings.editor.fontSize]}
                        onValueChange={([value]) => updateTempEditor({ fontSize: value })}
                        min={12}
                        max={24}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">{tempSettings.editor.fontSize}px</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.editorFont', { defaultValue: '编辑器字体' })}</Label>
                    <Select
                      value={tempSettings.editor.fontFamily}
                      onValueChange={(value) => updateTempEditor({ fontFamily: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'>{t('settings.fontSystemDefault', { defaultValue: '系统默认' })}</SelectItem>
                        <SelectItem value='"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'>{t('settings.fontPingFang', { defaultValue: '苹方 / 微软雅黑' })}</SelectItem>
                        <SelectItem value='"Noto Sans SC", "Source Han Sans SC", "PingFang SC", sans-serif'>{t('settings.fontNotoSans', { defaultValue: '思源黑体' })}</SelectItem>
                        <SelectItem value='"Noto Serif SC", "Source Han Serif SC", "Songti SC", serif'>{t('settings.fontNotoSerif', { defaultValue: '思源宋体' })}</SelectItem>
                        <SelectItem value='"Songti SC", "SimSun", "STSong", serif'>{t('settings.fontSongti', { defaultValue: '宋体' })}</SelectItem>
                        <SelectItem value='"Kaiti SC", "STKaiti", "KaiTi", serif'>{t('settings.fontKaiti', { defaultValue: '楷体' })}</SelectItem>
                        <SelectItem value='"JetBrains Mono", "Fira Code", "Consolas", monospace'>{t('settings.fontJetBrains', { defaultValue: '等宽字体 (JetBrains Mono)' })}</SelectItem>
                        <SelectItem value='"Cascadia Code", "Fira Code", "Consolas", monospace'>{t('settings.fontCascadia', { defaultValue: '等宽字体 (Cascadia Code)' })}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t('settings.fontApplyHint', { defaultValue: '应用于编辑器和预览区域' })}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.editorSettings.lineHeight')}</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[tempSettings.editor.lineHeight]}
                        onValueChange={([value]) => updateTempEditor({ lineHeight: value })}
                        min={1.0}
                        max={2.5}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">{tempSettings.editor.lineHeight}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.editorSettings.tabSize')}</Label>
                    <Select
                      value={tempSettings.editor.tabSize.toString()}
                      onValueChange={(value) => updateTempEditor({ tabSize: parseInt(value) })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 spaces</SelectItem>
                        <SelectItem value="4">4 spaces</SelectItem>
                        <SelectItem value="8">8 spaces</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-line-numbers">{t('settings.editorSettings.showLineNumbers')}</Label>
                    <Switch
                      id="show-line-numbers"
                      checked={tempSettings.editor.showLineNumbers}
                      onCheckedChange={(checked) => updateTempEditor({ showLineNumbers: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="word-wrap">{t('settings.editorSettings.wordWrap')}</Label>
                    <Switch
                      id="word-wrap"
                      checked={tempSettings.editor.wordWrap}
                      onCheckedChange={(checked) => updateTempEditor({ wordWrap: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="spell-check">{t('settings.editorSettings.spellCheck')}</Label>
                    <Switch
                      id="spell-check"
                      checked={tempSettings.editor.spellCheck}
                      onCheckedChange={(checked) => updateTempEditor({ spellCheck: checked })}
                    />
                  </div>

                  <Separator />

                  <h4 className="text-sm font-medium text-muted-foreground">{t('settings.editorFeatures', { defaultValue: '编辑器功能' })}</h4>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="highlight-active-line">{t('settings.highlightActiveLine', { defaultValue: '高亮当前行' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.highlightActiveLineDesc', { defaultValue: '高亮显示光标所在行' })}</p>
                    </div>
                    <Switch
                      id="highlight-active-line"
                      checked={tempSettings.editor.highlightActiveLine !== false}
                      onCheckedChange={(checked) => updateTempEditor({ highlightActiveLine: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="bracket-matching">{t('settings.bracketMatching', { defaultValue: '括号匹配' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.bracketMatchingDesc', { defaultValue: '高亮显示匹配的括号' })}</p>
                    </div>
                    <Switch
                      id="bracket-matching"
                      checked={tempSettings.editor.bracketMatching !== false}
                      onCheckedChange={(checked) => updateTempEditor({ bracketMatching: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="close-brackets">{t('settings.closeBrackets', { defaultValue: '自动闭合括号' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.closeBracketsDesc', { defaultValue: '输入左括号时自动补全右括号' })}</p>
                    </div>
                    <Switch
                      id="close-brackets"
                      checked={tempSettings.editor.closeBrackets !== false}
                      onCheckedChange={(checked) => updateTempEditor({ closeBrackets: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="code-folding">{t('settings.codeFolding', { defaultValue: '代码折叠' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.codeFoldingDesc', { defaultValue: '在行号旁显示折叠/展开按钮' })}</p>
                    </div>
                    <Switch
                      id="code-folding"
                      checked={tempSettings.editor.codeFolding !== false}
                      onCheckedChange={(checked) => updateTempEditor({ codeFolding: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="highlight-sel-matches">{t('settings.highlightSelMatches', { defaultValue: '高亮选中匹配' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.highlightSelMatchesDesc', { defaultValue: '高亮文档中与选中文本相同的内容' })}</p>
                    </div>
                    <Switch
                      id="highlight-sel-matches"
                      checked={tempSettings.editor.highlightSelectionMatches !== false}
                      onCheckedChange={(checked) => updateTempEditor({ highlightSelectionMatches: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autocompletion">{t('settings.autocompletion', { defaultValue: '自动补全' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.autocompletionDesc', { defaultValue: '输入时显示 Markdown 语法建议' })}</p>
                    </div>
                    <Switch
                      id="autocompletion"
                      checked={tempSettings.editor.autocompletion !== false}
                      onCheckedChange={(checked) => updateTempEditor({ autocompletion: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="multi-cursor">{t('settings.multiCursor', { defaultValue: '多光标编辑' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.multiCursorDesc', { defaultValue: '按住 Alt 拖拽可创建矩形选区' })}</p>
                    </div>
                    <Switch
                      id="multi-cursor"
                      checked={tempSettings.editor.multiCursor !== false}
                      onCheckedChange={(checked) => updateTempEditor({ multiCursor: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="scroll-past-end">{t('settings.scrollPastEnd', { defaultValue: '滚动超出末尾' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.scrollPastEndDesc', { defaultValue: '允许滚动到文档最后一行之后' })}</p>
                    </div>
                    <Switch
                      id="scroll-past-end"
                      checked={tempSettings.editor.scrollPastEnd !== false}
                      onCheckedChange={(checked) => updateTempEditor({ scrollPastEnd: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="indent-on-input">{t('settings.indentOnInput', { defaultValue: '自动缩进' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.indentOnInputDesc', { defaultValue: '输入特定字符时自动调整缩进' })}</p>
                    </div>
                    <Switch
                      id="indent-on-input"
                      checked={tempSettings.editor.indentOnInput !== false}
                      onCheckedChange={(checked) => updateTempEditor({ indentOnInput: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="markdown-lint">{t('settings.markdownLint', { defaultValue: 'Markdown 语法检查' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.markdownLintDesc', { defaultValue: '实时检查标题层级、空链接、未闭合代码块等问题' })}</p>
                    </div>
                    <Switch
                      id="markdown-lint"
                      checked={tempSettings.editor.markdownLint !== false}
                      onCheckedChange={(checked) => updateTempEditor({ markdownLint: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.defaultViewMode', { defaultValue: '默认视图模式' })}</Label>
                    <Select
                      value={tempSettings.editor.defaultViewMode || 'edit'}
                      onValueChange={(value: 'edit' | 'preview' | 'split') => updateTempEditor({ defaultViewMode: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="edit">{t('settings.viewEdit', { defaultValue: '编辑' })}</SelectItem>
                        <SelectItem value="preview">{t('settings.viewPreview', { defaultValue: '预览' })}</SelectItem>
                        <SelectItem value="split">{t('settings.viewSplit', { defaultValue: '分屏' })}</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t('settings.defaultViewModeDesc', { defaultValue: '打开文档时的默认显示模式' })}</p>
                  </div>

                  <Separator />

                  <h4 className="text-sm font-medium text-muted-foreground">{t('settings.toolbarButtons', { defaultValue: '工具栏按钮' })}</h4>
                  <p className="text-xs text-muted-foreground -mt-2">{t('settings.toolbarButtonsDesc', { defaultValue: '选择在编辑器工具栏中显示哪些按钮组' })}</p>

                  {([
                    ['undo', t('settings.toolbar.undo', { defaultValue: '撤销' })],
                    ['redo', t('settings.toolbar.redo', { defaultValue: '重做' })],
                    ['copy', t('settings.toolbar.copy', { defaultValue: '复制' })],
                    ['cut', t('settings.toolbar.cut', { defaultValue: '剪切' })],
                    ['paste', t('settings.toolbar.paste', { defaultValue: '粘贴' })],
                    ['clearAll', t('settings.toolbar.clearAll', { defaultValue: '清空内容' })],
                    ['headings', t('settings.toolbar.headings', { defaultValue: '标题' })],
                    ['bold', t('settings.toolbar.bold', { defaultValue: '粗体' })],
                    ['italic', t('settings.toolbar.italic', { defaultValue: '斜体' })],
                    ['strikethrough', t('settings.toolbar.strikethrough', { defaultValue: '删除线' })],
                    ['inlineCode', t('settings.toolbar.inlineCode', { defaultValue: '行内代码' })],
                    ['clearFormat', t('settings.toolbar.clearFormat', { defaultValue: '清除格式' })],
                    ['unorderedList', t('settings.toolbar.unorderedList', { defaultValue: '无序列表' })],
                    ['orderedList', t('settings.toolbar.orderedList', { defaultValue: '有序列表' })],
                    ['taskList', t('settings.toolbar.taskList', { defaultValue: '任务列表' })],
                    ['quote', t('settings.toolbar.quote', { defaultValue: '引用' })],
                    ['horizontalRule', t('settings.toolbar.horizontalRule', { defaultValue: '分隔线' })],
                    ['link', t('settings.toolbar.link', { defaultValue: '链接' })],
                    ['image', t('settings.toolbar.image', { defaultValue: '图片' })],
                    ['table', t('settings.toolbar.table', { defaultValue: '表格' })],
                    ['footnote', t('settings.toolbar.footnote', { defaultValue: '脚注' })],
                    ['codeBlock', t('settings.toolbar.codeBlock', { defaultValue: '代码块' })],
                    ['mermaid', t('settings.toolbar.mermaid', { defaultValue: 'Mermaid 图表' })],
                    ['math', t('settings.toolbar.math', { defaultValue: '数学公式' })],
                    ['importFile', t('settings.toolbar.importFile', { defaultValue: '导入文件' })],
                    ['goToTop', t('settings.toolbar.goToTop', { defaultValue: '滚动到顶部' })],
                    ['goToBottom', t('settings.toolbar.goToBottom', { defaultValue: '滚动到底部' })],
                  ] as [keyof import('@aidocplus/shared-types').ToolbarButtons, string][]).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label htmlFor={`tb-${key}`}>{label}</Label>
                      <Switch
                        id={`tb-${key}`}
                        checked={(tempSettings.editor.toolbarButtons ?? {} as any)[key] !== false}
                        onCheckedChange={(checked) => updateTempEditor({
                          toolbarButtons: { ...(tempSettings.editor.toolbarButtons ?? {} as any), [key]: checked }
                        })}
                      />
                    </div>
                  ))}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="auto-save">{t('settings.editorSettings.autoSave')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('settings.editorSettings.autoSaveInterval', { defaultValue: 'Auto save interval' })}
                      </p>
                    </div>
                    <Switch
                      id="auto-save"
                      checked={tempSettings.editor.autoSave}
                      onCheckedChange={(checked) => updateTempEditor({ autoSave: checked })}
                    />
                  </div>

                  {tempSettings.editor.autoSave && (
                    <div className="space-y-2">
                      <Label>{t('settings.editorSettings.autoSaveInterval')}</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[tempSettings.editor.autoSaveInterval]}
                          onValueChange={([value]) => updateTempEditor({ autoSaveInterval: value })}
                          min={10}
                          max={300}
                          step={10}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground w-20 text-right">
                          {tempSettings.editor.autoSaveInterval} {t('settings.editorSettings.seconds')}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Appearance Settings */}
            <TabsContent value="appearance" className="space-y-6 p-4 bg-card h-full">
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('settings.appearanceSettings.title')}</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.appearanceSettings.theme')}</Label>
                    <Select
                      value={tempSettings.ui.theme}
                      onValueChange={(value: 'light' | 'dark' | 'auto') => updateTempUI({ theme: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">{t('settings.appearanceSettings.themeLight')}</SelectItem>
                        <SelectItem value="dark">{t('settings.appearanceSettings.themeDark')}</SelectItem>
                        <SelectItem value="auto">{t('settings.appearanceSettings.themeAuto')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.appearanceSettings.layout')}</Label>
                    <Select
                      value={tempSettings.ui.layout}
                      onValueChange={(value: 'vertical' | 'horizontal') => updateTempUI({ layout: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vertical">{t('settings.appearanceSettings.layoutVertical')}</SelectItem>
                        <SelectItem value="horizontal">{t('settings.appearanceSettings.layoutHorizontal')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.appearanceSettings.fontSize')}</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[tempSettings.ui.fontSize]}
                        onValueChange={([value]) => updateTempUI({ fontSize: value })}
                        min={12}
                        max={20}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">{tempSettings.ui.fontSize}px</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.appearanceSettings.sidebarWidth')}</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[tempSettings.ui.sidebarWidth]}
                        onValueChange={([value]) => updateTempUI({ sidebarWidth: value })}
                        min={200}
                        max={400}
                        step={10}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">{tempSettings.ui.sidebarWidth}px</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.appearanceSettings.chatPanelWidth')}</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[tempSettings.ui.chatPanelWidth]}
                        onValueChange={([value]) => updateTempUI({ chatPanelWidth: value })}
                        min={250}
                        max={500}
                        step={10}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">{tempSettings.ui.chatPanelWidth}px</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Language Settings */}
            <TabsContent value="language" className="space-y-6 p-4 bg-card h-full">
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('settings.languageSettings.title')}</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.languageSettings.select')}</Label>
                    <Select
                      value={ui.language}
                      onValueChange={(value) => handleLanguageChange(value as SupportedLanguage)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SUPPORTED_LANGUAGES).map(([code, { name, flag }]) => (
                          <SelectItem key={code} value={code}>
                            {flag} {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {t('settings.languageSettings.restartRequired')}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* AI Settings */}
            <TabsContent value="ai" className="space-y-6 p-4 bg-card h-full">
              <AISettingsTab tempAI={tempSettings.ai} updateTempAI={updateTempAI} />
            </TabsContent>

            {/* Email Settings */}
            <TabsContent value="email" className="space-y-6 p-4 bg-card h-full">
              <EmailSettingsTab tempEmail={tempSettings.email} updateTempEmail={updateTempEmail} />
            </TabsContent>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6 p-4 bg-card h-full">
              {/* IM Bot */}
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  <Bot className="w-5 h-5 inline-block mr-2" />
                  {t('settings.imBot.title', { defaultValue: 'IM Bot 服务' })}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('settings.imBot.description', { defaultValue: '通过飞书、钉钉等即时通讯平台远程操控 AiDocPlus。' })}
                </p>

                <div className="space-y-4">
                  {/* 运行状态 + 启停按钮 */}
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-background">
                    <div className="flex items-center gap-3">
                      <Circle className={`w-3 h-3 ${imBotRunning ? 'fill-green-500 text-green-500' : 'fill-muted text-muted-foreground'}`} />
                      <span className="text-sm font-medium">
                        {imBotRunning
                          ? t('settings.imBot.running', { defaultValue: '运行中' })
                          : t('settings.imBot.stopped', { defaultValue: '已停止' })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {imBotRunning ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStopImBot}
                          disabled={imBotLoading}
                        >
                          {imBotLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Square className="w-3 h-3 mr-1" />}
                          {t('settings.imBot.stop', { defaultValue: '停止' })}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStartImBot}
                          disabled={imBotLoading}
                        >
                          {imBotLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />}
                          {t('settings.imBot.start', { defaultValue: '启动' })}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* 自动启动开关 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="imbot-autostart">{t('settings.imBot.autoStart', { defaultValue: '随应用自动启动' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.imBot.autoStartDesc', { defaultValue: 'AiDocPlus 启动后自动运行 IM Bot 服务' })}</p>
                    </div>
                    <Switch
                      id="imbot-autostart"
                      checked={imBot.autoStart}
                      onCheckedChange={(checked) => updateImBotSettings({ autoStart: checked })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">{t('settings.advancedSettings.title')}</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.advancedSettings.dataPath', { defaultValue: '数据存储路径' })}</Label>
                    <div className="flex gap-2">
                      <Input value={dataRootPath} readOnly className="flex-1 font-mono text-xs" />
                      <Button
                        variant="outline"
                        size="icon"
                        title={t('settings.advancedSettings.changeDataPath', { defaultValue: '更改数据目录' })}
                        disabled={isDataMigrating}
                        onClick={async () => {
                          const selected = await openDialog({ directory: true, title: t('settings.advancedSettings.selectDataDir', { defaultValue: '选择数据存储目录' }) });
                          if (!selected || typeof selected !== 'string') return;
                          if (selected === dataRootPath) return;
                          const doMigrate = await confirm(
                            t('settings.advancedSettings.migrateConfirmMsg', { defaultValue: '是否将现有数据迁移（复制）到新目录？\n\n选择"是"：复制所有数据到新位置\n选择"否"：仅切换目录（不迁移数据）' }),
                            { title: t('settings.advancedSettings.migrateConfirmTitle', { defaultValue: '数据迁移确认' }), kind: 'info' }
                          );
                          try {
                            if (doMigrate) {
                              setIsDataMigrating(true);
                              const result = await invoke<string>('migrate_data_to_new_root', { newPath: selected });
                              setIsDataMigrating(false);
                              setDataRootPath(selected);
                              await message(result + '\n\n' + t('settings.advancedSettings.restartHint', { defaultValue: '建议重启应用以确保所有功能正常。' }), { title: t('common.success', { defaultValue: '成功' }) });
                            } else {
                              await invoke('change_data_root', { newPath: selected });
                              setDataRootPath(selected);
                              await message(t('settings.advancedSettings.switchedNoMigrate', { defaultValue: '数据目录已切换。建议重启应用以确保所有功能正常。' }), { title: t('common.success', { defaultValue: '成功' }) });
                            }
                          } catch (err: any) {
                            setIsDataMigrating(false);
                            await message(formatBackendError(err), { title: t('common.error', { defaultValue: '错误' }), kind: 'error' });
                          }
                        }}
                      >
                        {isDataMigrating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderOpen className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('settings.advancedSettings.dataPathHint', { defaultValue: '可将数据目录指向 iCloud Drive、OneDrive 等云同步文件夹，实现多设备数据同步。' })}
                    </p>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={handleExport}>
                      <Download className="w-4 h-4 mr-2" />
                      {t('settings.advancedSettings.exportSettings')}
                    </Button>
                    <Button variant="outline" onClick={handleImport}>
                      <Upload className="w-4 h-4 mr-2" />
                      {t('settings.advancedSettings.importSettings')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowResetConfirm(true)}
                      className="text-destructive hover:text-destructive"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      {t('settings.advancedSettings.resetSettings')}
                    </Button>
                  </div>

                  {showResetConfirm && (
                    <div className="p-4 bg-destructive/10 rounded-lg space-y-2">
                      <p className="text-sm font-medium">
                        {t('settings.resetConfirm', { defaultValue: 'Are you sure you want to reset all settings to default?' })}
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleReset} variant="destructive">
                          {t('common.confirm', { defaultValue: 'Confirm' })}
                        </Button>
                        <Button size="sm" onClick={() => setShowResetConfirm(false)} variant="outline">
                          {t('common.cancel', { defaultValue: 'Cancel' })}
                        </Button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-4">{t('settings.about.title')}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t('settings.about.description')}</p>
                  <p>{t('settings.about.version')}: {appVersion}</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="border-t pt-4 flex justify-between items-center px-6 pb-6 bg-card">
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-sm text-muted-foreground">
                {t('common.unsavedChanges', { defaultValue: '有未保存的更改' })}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              {t('common.close', { defaultValue: '关闭' })}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (tempSettings.editor) updateEditorSettings(tempSettings.editor);
                if (tempSettings.ui) updateUISettings(tempSettings.ui);
                if (tempSettings.ai) updateAISettings(tempSettings.ai);
                if (tempSettings.email) updateEmailSettings(tempSettings.email);
                setHasChanges(false);
              }}
            >
              {t('common.save', { defaultValue: '保存' })}
            </Button>
            <Button variant="outline" onClick={handleSave}>
              {t('common.saveAndClose', { defaultValue: '保存并关闭' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 插件设置列表 — 分类分组视图 + 搜索 + 批量操作
 */
function PluginSettingsList() {
  const { t } = useTranslation();
  const { pluginManifests, loadPlugins } = useAppStore(useShallow(s => ({
    pluginManifests: s.pluginManifests,
    loadPlugins: s.loadPlugins,
  })));
  const { plugins: pluginsSettings } = useSettingsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const pluginUsageCount: Record<string, number> = pluginsSettings?.usageCount || {};

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    try {
      await invoke('set_plugin_enabled', { pluginId, enabled });
      await loadPlugins();
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
    }
  };

  const handleBatchToggle = async (pluginIds: string[], enabled: boolean) => {
    try {
      for (const id of pluginIds) {
        await invoke('set_plugin_enabled', { pluginId: id, enabled });
      }
      await loadPlugins();
    } catch (error) {
      console.error('Failed to batch toggle plugins:', error);
    }
  };

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (pluginManifests.length === 0) return null;

  // 按分类分组
  const grouped = new Map<string, typeof pluginManifests>();
  for (const m of pluginManifests) {
    const major = m.majorCategory || 'content-generation';
    if (!grouped.has(major)) grouped.set(major, []);
    grouped.get(major)!.push(m);
  }

  // 搜索过滤
  const filteredGrouped = new Map<string, typeof pluginManifests>();
  const q = searchQuery.toLowerCase().trim();
  for (const [key, manifests] of grouped) {
    const filtered = q
      ? manifests.filter(m =>
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.tags.some(tag => tag.toLowerCase().includes(q))
        )
      : manifests;
    if (filtered.length > 0) {
      filteredGrouped.set(key, filtered);
    }
  }

  // 大类标签映射
  const majorLabels: Record<string, string> = {
    'content-generation': t('settings.pluginCategoryContentGen', { defaultValue: '内容生成' }),
    'functional': t('settings.pluginCategoryFunctional', { defaultValue: '功能执行' }),
  };

  return (
    <div className="space-y-4">
      {/* 搜索栏 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-background">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('settings.pluginsSettings.searchPlaceholder', { defaultValue: '搜索插件...' })}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* 分组列表 */}
      {Array.from(filteredGrouped.entries()).map(([majorKey, manifests]) => {
        const isCollapsed = collapsedGroups.has(majorKey);
        const enabledCount = manifests.filter(m => m.enabled).length;
        const allEnabled = enabledCount === manifests.length;

        return (
          <div key={majorKey} className="rounded-lg border overflow-hidden">
            {/* 分组标题栏 */}
            <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30">
              <button
                onClick={() => toggleGroup(majorKey)}
                className="text-muted-foreground hover:text-foreground"
              >
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4" />
                  : <ChevronDown className="h-4 w-4" />
                }
              </button>
              <span className="text-sm font-semibold flex-1">
                {majorLabels[majorKey] || majorKey}
              </span>
              <span className="text-xs text-muted-foreground">
                {enabledCount}/{manifests.length} {t('settings.pluginsSettings.enabled', { defaultValue: '已启用' })}
              </span>
              <Switch
                checked={allEnabled}
                onCheckedChange={(checked) => handleBatchToggle(manifests.map(m => m.id), checked)}
              />
            </div>

            {/* 插件列表 */}
            {!isCollapsed && (
              <div className="divide-y">
                {manifests.map(manifest => (
                  <div
                    key={manifest.id}
                    className="flex items-center gap-4 px-4 py-3 bg-background"
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                      <Puzzle className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{manifest.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          manifest.type === 'builtin'
                            ? 'bg-green-500/10 text-green-600'
                            : 'bg-blue-500/10 text-blue-600'
                        }`}>
                          {manifest.type === 'builtin'
                            ? t('settings.pluginsSettings.builtin', { defaultValue: '内置' })
                            : t('settings.pluginsSettings.custom', { defaultValue: '自定义' })}
                        </span>
                        <span className="text-xs text-muted-foreground">v{manifest.version}</span>
                        {(pluginUsageCount[manifest.id] || 0) > 0 && (
                          <span className="text-xs text-muted-foreground/60">
                            {t('settings.pluginUsageCount', { defaultValue: '已使用 {{count}} 次', count: pluginUsageCount[manifest.id] })}
                          </span>
                        )}
                      </div>
                      {manifest.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{manifest.description}</p>
                      )}
                    </div>
                    <Switch
                      checked={manifest.enabled}
                      onCheckedChange={(checked) => handleToggle(manifest.id, checked)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {filteredGrouped.size === 0 && searchQuery && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          {t('settings.noMatchingPlugins', { defaultValue: '未找到匹配的插件' })}
        </div>
      )}
    </div>
  );
}

export default SettingsPanel;
