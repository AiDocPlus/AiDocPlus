import { useState, useEffect } from 'react';
import { X, Monitor, Type, Globe, Zap, Download, Upload, RotateCcw, Loader2, Puzzle, Plus, Pencil, Trash2, Check, Power, Mail } from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../i18n';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { AI_PROVIDERS, getProviderConfig, EMAIL_PROVIDER_PRESETS, getEmailPreset } from '@aidocplus/shared-types';
import type { AIProvider, AIServiceConfig, EmailAccountConfig } from '@aidocplus/shared-types';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, changeAppLanguage } from '../../i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { t } = useTranslation();
  const {
    editor,
    ui,
    file,
    ai,
    email,
    updateEditorSettings,
    updateUISettings,
    updateAISettings,
    updateEmailSettings,
    resetSettings,
    exportSettings,
    importSettings,
    error
  } = useSettingsStore();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
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

  // ========== AI 服务编辑弹窗 ==========
  const [editingService, setEditingService] = useState<AIServiceConfig | null>(null);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const editingProviderConfig = editingService ? getProviderConfig(editingService.provider) : null;

  const handleCreateService = () => {
    const defaultProvider: AIProvider = 'glm';
    const config = getProviderConfig(defaultProvider);
    setEditingService({
      id: `svc_${Date.now()}`,
      name: '',
      provider: defaultProvider,
      apiKey: '',
      model: config?.defaultModel || '',
      baseUrl: config?.baseUrl || '',
      enabled: true,
    });
    setIsCreatingService(true);
    setTestResult(null);
  };

  const handleEditService = (svc: AIServiceConfig) => {
    setEditingService({ ...svc });
    setIsCreatingService(false);
    setTestResult(null);
  };

  const handleSaveService = () => {
    if (!editingService) return;
    // 自动命名：如果用户没填名称，用服务商名称
    const providerCfg = getProviderConfig(editingService.provider);
    const svcName = editingService.name.trim() || providerCfg?.name || editingService.provider;
    const svc = { ...editingService, name: svcName };

    const services = [...tempSettings.ai.services];
    const idx = services.findIndex(s => s.id === svc.id);
    if (idx >= 0) {
      services[idx] = svc;
    } else {
      services.push(svc);
    }
    // 如果还没有激活服务，自动激活新创建的
    const activeId = tempSettings.ai.activeServiceId || svc.id;
    updateTempAI({ services, activeServiceId: activeId });
    setEditingService(null);
  };

  const handleDeleteService = (id: string) => {
    const services = tempSettings.ai.services.filter(s => s.id !== id);
    let activeId = tempSettings.ai.activeServiceId;
    if (activeId === id) {
      activeId = services.find(s => s.enabled)?.id || '';
    }
    updateTempAI({ services, activeServiceId: activeId });
  };

  const handleToggleService = (id: string) => {
    const services = tempSettings.ai.services.map(s =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    updateTempAI({ services });
  };

  const handleActivateService = (id: string) => {
    updateTempAI({ activeServiceId: id });
  };

  const handleEditProviderChange = (newProvider: AIProvider) => {
    if (!editingService) return;
    const config = getProviderConfig(newProvider);
    setEditingService({
      ...editingService,
      provider: newProvider,
      model: config?.defaultModel || '',
      baseUrl: config?.baseUrl || '',
    });
  };

  const handleTestConnection = async () => {
    if (!editingService) return;
    setTestingApi(true);
    setTestResult(null);
    try {
      const providerConfig = getProviderConfig(editingService.provider);
      const result = await invoke<string>('test_api_connection', {
        provider: editingService.provider || undefined,
        apiKey: editingService.apiKey || undefined,
        model: editingService.model || undefined,
        baseUrl: editingService.baseUrl || providerConfig?.baseUrl || undefined,
      });
      setTestResult({ ok: true, msg: result });
      setEditingService(prev => prev ? { ...prev, lastTestOk: true } : prev);
    } catch (err: any) {
      setTestResult({ ok: false, msg: String(err) });
      setEditingService(prev => prev ? { ...prev, lastTestOk: false } : prev);
    } finally {
      setTestingApi(false);
    }
  };

  // ========== 邮箱账户编辑弹窗 ==========
  const [editingEmailAccount, setEditingEmailAccount] = useState<EmailAccountConfig | null>(null);
  const [isCreatingEmailAccount, setIsCreatingEmailAccount] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleCreateEmailAccount = () => {
    const defaultPreset = EMAIL_PROVIDER_PRESETS[0];
    setEditingEmailAccount({
      id: `email_${Date.now()}`,
      name: '',
      provider: defaultPreset.id,
      smtpHost: defaultPreset.smtpHost,
      smtpPort: defaultPreset.smtpPort,
      encryption: defaultPreset.encryption,
      email: '',
      password: '',
      displayName: '',
      enabled: true,
    });
    setIsCreatingEmailAccount(true);
    setSmtpTestResult(null);
  };

  const handleEditEmailAccount = (acct: EmailAccountConfig) => {
    setEditingEmailAccount({ ...acct });
    setIsCreatingEmailAccount(false);
    setSmtpTestResult(null);
  };

  const handleSaveEmailAccount = () => {
    if (!editingEmailAccount) return;
    const preset = getEmailPreset(editingEmailAccount.provider);
    const acctName = editingEmailAccount.name.trim() || preset?.name || editingEmailAccount.email;
    const acct = { ...editingEmailAccount, name: acctName };

    const accounts = [...tempSettings.email.accounts];
    const idx = accounts.findIndex(a => a.id === acct.id);
    if (idx >= 0) {
      accounts[idx] = acct;
    } else {
      accounts.push(acct);
    }
    const activeId = tempSettings.email.activeAccountId || acct.id;
    updateTempEmail({ accounts, activeAccountId: activeId });
    setEditingEmailAccount(null);
  };

  const handleDeleteEmailAccount = (id: string) => {
    const accounts = tempSettings.email.accounts.filter(a => a.id !== id);
    let activeId = tempSettings.email.activeAccountId;
    if (activeId === id) {
      activeId = accounts.find(a => a.enabled)?.id || '';
    }
    updateTempEmail({ accounts, activeAccountId: activeId });
  };

  const handleToggleEmailAccount = (id: string) => {
    const accounts = tempSettings.email.accounts.map(a =>
      a.id === id ? { ...a, enabled: !a.enabled } : a
    );
    updateTempEmail({ accounts });
  };

  const handleActivateEmailAccount = (id: string) => {
    updateTempEmail({ activeAccountId: id });
  };

  const handleEmailProviderChange = (newProvider: string) => {
    if (!editingEmailAccount) return;
    const preset = getEmailPreset(newProvider);
    setEditingEmailAccount({
      ...editingEmailAccount,
      provider: newProvider,
      smtpHost: preset?.smtpHost || '',
      smtpPort: preset?.smtpPort || 465,
      encryption: preset?.encryption || 'tls',
    });
  };

  const handleTestSmtpConnection = async () => {
    if (!editingEmailAccount) return;
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const result = await invoke<string>('test_smtp_connection', {
        smtpHost: editingEmailAccount.smtpHost,
        smtpPort: editingEmailAccount.smtpPort,
        encryption: editingEmailAccount.encryption,
        email: editingEmailAccount.email,
        password: editingEmailAccount.password,
      });
      setSmtpTestResult({ ok: true, msg: result });
      setEditingEmailAccount(prev => prev ? { ...prev, lastTestOk: true } : prev);
    } catch (err: any) {
      setSmtpTestResult({ ok: false, msg: String(err) });
      setEditingEmailAccount(prev => prev ? { ...prev, lastTestOk: false } : prev);
    } finally {
      setTestingSmtp(false);
    }
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

        <Tabs defaultValue="editor" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-7 w-full bg-muted">
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
              {t('settings.plugins', { defaultValue: '\u63D2\u4EF6' })}
            </TabsTrigger>
            <TabsTrigger value="ai">
              <Zap className="w-4 h-4 mr-1" />
              AI
            </TabsTrigger>
            <TabsTrigger value="email">
              <Mail className="w-4 h-4 mr-1" />
              邮件
            </TabsTrigger>
            <TabsTrigger value="advanced">
              {t('settings.advanced')}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto bg-card" id="settings-content">
            {/* Plugins */}
            <TabsContent value="plugins" className="space-y-6 p-4 bg-card h-full">
              <div>
                <h3 className="text-lg font-semibold mb-2">{t('settings.pluginsSettings.title', { defaultValue: '\u63D2\u4EF6\u7BA1\u7406' })}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t('settings.pluginsSettings.description', { defaultValue: '\u7BA1\u7406\u6587\u6863\u5904\u7406\u63D2\u4EF6\u3002\u63D2\u4EF6\u53EF\u4EE5\u5BF9\u6587\u6863\u5185\u5BB9\u8FDB\u884C\u4E8C\u6B21\u52A0\u5DE5\uFF0C\u5982\u751F\u6210 PPT\u3001\u601D\u7EF4\u5BFC\u56FE\u7B49\u3002' })}
                </p>
                <Separator className="mb-4" />
                <PluginSettingsList />

                {useAppStore.getState().pluginManifests.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Puzzle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>{t('settings.pluginsSettings.noPlugins', { defaultValue: '\u6682\u65E0\u53EF\u7528\u63D2\u4EF6' })}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <h3 className="text-lg font-semibold mb-2">{t('settings.pluginsSettings.usage', { defaultValue: '\u4F7F\u7528\u65B9\u6CD5' })}</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>{t('settings.pluginsSettings.usageStep1', { defaultValue: '1. \u5728\u6587\u6863\u7F16\u8F91\u5668\u5DE5\u5177\u680F\u4E2D\u70B9\u51FB \uD83E\uDDE9 \u63D2\u4EF6\u6309\u94AE' })}</p>
                  <p>{t('settings.pluginsSettings.usageStep2', { defaultValue: '2. \u4ECE\u4E0B\u62C9\u83DC\u5355\u4E2D\u9009\u62E9\u8981\u4F7F\u7528\u7684\u63D2\u4EF6' })}</p>
                  <p>{t('settings.pluginsSettings.usageStep3', { defaultValue: '3. \u63D2\u4EF6\u9762\u677F\u5C06\u66FF\u4EE3\u7F16\u8F91\u5668\u533A\u57DF\u663E\u793A\uFF0C\u70B9\u51FB\u201C\u8FD4\u56DE\u7F16\u8F91\u5668\u201D\u53EF\u9000\u51FA' })}</p>
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
                    <Label>编辑器字体</Label>
                    <Select
                      value={tempSettings.editor.fontFamily}
                      onValueChange={(value) => updateTempEditor({ fontFamily: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'>系统默认</SelectItem>
                        <SelectItem value='"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif'>苹方 / 微软雅黑</SelectItem>
                        <SelectItem value='"Noto Sans SC", "Source Han Sans SC", "PingFang SC", sans-serif'>思源黑体</SelectItem>
                        <SelectItem value='"Noto Serif SC", "Source Han Serif SC", "Songti SC", serif'>思源宋体</SelectItem>
                        <SelectItem value='"Songti SC", "SimSun", "STSong", serif'>宋体</SelectItem>
                        <SelectItem value='"Kaiti SC", "STKaiti", "KaiTi", serif'>楷体</SelectItem>
                        <SelectItem value='"JetBrains Mono", "Fira Code", "Consolas", monospace'>等宽字体 (JetBrains Mono)</SelectItem>
                        <SelectItem value='"Cascadia Code", "Fira Code", "Consolas", monospace'>等宽字体 (Cascadia Code)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">应用于编辑器和预览区域</p>
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

                  <h4 className="text-sm font-medium text-muted-foreground">编辑器功能</h4>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="highlight-active-line">高亮当前行</Label>
                      <p className="text-xs text-muted-foreground">高亮显示光标所在行</p>
                    </div>
                    <Switch
                      id="highlight-active-line"
                      checked={tempSettings.editor.highlightActiveLine !== false}
                      onCheckedChange={(checked) => updateTempEditor({ highlightActiveLine: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="bracket-matching">括号匹配</Label>
                      <p className="text-xs text-muted-foreground">高亮显示匹配的括号</p>
                    </div>
                    <Switch
                      id="bracket-matching"
                      checked={tempSettings.editor.bracketMatching !== false}
                      onCheckedChange={(checked) => updateTempEditor({ bracketMatching: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="close-brackets">自动闭合括号</Label>
                      <p className="text-xs text-muted-foreground">输入左括号时自动补全右括号</p>
                    </div>
                    <Switch
                      id="close-brackets"
                      checked={tempSettings.editor.closeBrackets !== false}
                      onCheckedChange={(checked) => updateTempEditor({ closeBrackets: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="code-folding">代码折叠</Label>
                      <p className="text-xs text-muted-foreground">在行号旁显示折叠/展开按钮</p>
                    </div>
                    <Switch
                      id="code-folding"
                      checked={tempSettings.editor.codeFolding !== false}
                      onCheckedChange={(checked) => updateTempEditor({ codeFolding: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="highlight-sel-matches">高亮选中匹配</Label>
                      <p className="text-xs text-muted-foreground">高亮文档中与选中文本相同的内容</p>
                    </div>
                    <Switch
                      id="highlight-sel-matches"
                      checked={tempSettings.editor.highlightSelectionMatches !== false}
                      onCheckedChange={(checked) => updateTempEditor({ highlightSelectionMatches: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="autocompletion">自动补全</Label>
                      <p className="text-xs text-muted-foreground">输入时显示 Markdown 语法建议</p>
                    </div>
                    <Switch
                      id="autocompletion"
                      checked={tempSettings.editor.autocompletion !== false}
                      onCheckedChange={(checked) => updateTempEditor({ autocompletion: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="multi-cursor">多光标编辑</Label>
                      <p className="text-xs text-muted-foreground">按住 Alt 拖拽可创建矩形选区</p>
                    </div>
                    <Switch
                      id="multi-cursor"
                      checked={tempSettings.editor.multiCursor !== false}
                      onCheckedChange={(checked) => updateTempEditor({ multiCursor: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="scroll-past-end">滚动超出末尾</Label>
                      <p className="text-xs text-muted-foreground">允许滚动到文档最后一行之后</p>
                    </div>
                    <Switch
                      id="scroll-past-end"
                      checked={tempSettings.editor.scrollPastEnd !== false}
                      onCheckedChange={(checked) => updateTempEditor({ scrollPastEnd: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="indent-on-input">自动缩进</Label>
                      <p className="text-xs text-muted-foreground">输入特定字符时自动调整缩进</p>
                    </div>
                    <Switch
                      id="indent-on-input"
                      checked={tempSettings.editor.indentOnInput !== false}
                      onCheckedChange={(checked) => updateTempEditor({ indentOnInput: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="markdown-lint">Markdown 语法检查</Label>
                      <p className="text-xs text-muted-foreground">实时检查标题层级、空链接、未闭合代码块等问题</p>
                    </div>
                    <Switch
                      id="markdown-lint"
                      checked={tempSettings.editor.markdownLint !== false}
                      onCheckedChange={(checked) => updateTempEditor({ markdownLint: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>默认视图模式</Label>
                    <Select
                      value={tempSettings.editor.defaultViewMode || 'edit'}
                      onValueChange={(value: 'edit' | 'preview' | 'split') => updateTempEditor({ defaultViewMode: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="edit">编辑</SelectItem>
                        <SelectItem value="preview">预览</SelectItem>
                        <SelectItem value="split">分屏</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">打开文档时的默认显示模式</p>
                  </div>

                  <Separator />

                  <h4 className="text-sm font-medium text-muted-foreground">工具栏按钮</h4>
                  <p className="text-xs text-muted-foreground -mt-2">选择在编辑器工具栏中显示哪些按钮组</p>

                  {([
                    ['undo', '撤销'],
                    ['redo', '重做'],
                    ['copy', '复制'],
                    ['cut', '剪切'],
                    ['paste', '粘贴'],
                    ['clearAll', '清空内容'],
                    ['headings', '标题'],
                    ['bold', '粗体'],
                    ['italic', '斜体'],
                    ['strikethrough', '删除线'],
                    ['inlineCode', '行内代码'],
                    ['clearFormat', '清除格式'],
                    ['unorderedList', '无序列表'],
                    ['orderedList', '有序列表'],
                    ['taskList', '任务列表'],
                    ['quote', '引用'],
                    ['horizontalRule', '分隔线'],
                    ['link', '链接'],
                    ['image', '图片'],
                    ['table', '表格'],
                    ['footnote', '脚注'],
                    ['codeBlock', '代码块'],
                    ['mermaid', 'Mermaid 图表'],
                    ['math', '数学公式'],
                    ['importFile', '导入文件'],
                    ['goToTop', '滚动到顶部'],
                    ['goToBottom', '滚动到底部'],
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
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">AI 服务配置</h3>
                  <Button variant="outline" size="sm" onClick={handleCreateService}>
                    <Plus className="h-4 w-4 mr-1" />创建 API 服务
                  </Button>
                </div>

                {/* 服务列表 */}
                {tempSettings.ai.services.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">还没有配置任何 AI 服务</p>
                    <p className="text-xs mt-1">点击上方「创建 API 服务」按钮添加一个</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tempSettings.ai.services.map(svc => {
                      const isActive = svc.id === tempSettings.ai.activeServiceId;
                      const provCfg = getProviderConfig(svc.provider);
                      return (
                        <div
                          key={svc.id}
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                            isActive
                              ? 'border-primary bg-primary/10'
                              : svc.enabled
                                ? 'border-transparent bg-muted/30 hover:bg-muted/50'
                                : 'border-transparent bg-muted/10 opacity-50'
                          }`}
                          onClick={() => svc.enabled && handleActivateService(svc.id)}
                        >
                          {/* 服务信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{svc.name}</span>
                              <span className="text-xs text-muted-foreground">{provCfg?.name || svc.provider}</span>
                              {isActive && (
                                <span className="text-xs font-semibold text-primary bg-primary/15 px-1.5 py-0.5 rounded">使用中</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              模型: {svc.model || '默认模型'} {svc.apiKey ? '' : '• ⚠️ 未配置 Key'}
                            </div>
                          </div>
                          {/* 操作按钮 */}
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleService(svc.id)} title={svc.enabled ? '禁用' : '启用'}>
                              <Power className={`h-3.5 w-3.5 ${!svc.enabled ? 'text-muted-foreground' : !svc.apiKey ? 'text-red-500' : svc.lastTestOk === true ? 'text-green-500' : svc.lastTestOk === false ? 'text-red-500' : 'text-orange-500'}`} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditService(svc)} title="编辑">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteService(svc.id)} title="删除">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Separator className="my-4" />

                {/* 全局 AI 设置 */}
                <h4 className="text-sm font-semibold mb-3">全局设置</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[tempSettings.ai.temperature]}
                        onValueChange={([value]) => updateTempAI({ temperature: value })}
                        min={0}
                        max={2}
                        step={0.1}
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground w-12 text-right">{tempSettings.ai.temperature}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input
                      type="number"
                      value={tempSettings.ai.maxTokens}
                      onChange={(e) => updateTempAI({ maxTokens: parseInt(e.target.value) || 2000 })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>流式输出</Label>
                      <p className="text-xs text-muted-foreground">启用后 AI 回复将逐字显示</p>
                    </div>
                    <Switch
                      checked={tempSettings.ai.streamEnabled}
                      onCheckedChange={(checked) => updateTempAI({ streamEnabled: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>强制 Markdown 格式输出</Label>
                        <p className="text-xs text-muted-foreground">启用后 AI 将始终以纯净 Markdown 格式返回内容，不含多余的开场白和总结语</p>
                      </div>
                      <Switch
                        checked={tempSettings.ai.markdownMode ?? true}
                        onCheckedChange={(checked) => updateTempAI({ markdownMode: checked })}
                      />
                    </div>
                    {tempSettings.ai.markdownMode && (
                      <textarea
                        value={tempSettings.ai.markdownModePrompt ?? ''}
                        onChange={(e) => updateTempAI({ markdownModePrompt: e.target.value })}
                        placeholder="Markdown 格式约束提示词..."
                        className="w-full min-h-[120px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>System Prompt <span className="text-xs text-muted-foreground">(可选)</span></Label>
                    <textarea
                      value={tempSettings.ai.systemPrompt || ''}
                      onChange={(e) => updateTempAI({ systemPrompt: e.target.value })}
                      placeholder="可选，留空则不附加额外系统提示词..."
                      className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>插件正文字数限制</Label>
                    <p className="text-xs text-muted-foreground">插件发送给 AI 的正文最大字符数，0 表示不限制</p>
                    <Input
                      type="number"
                      value={tempSettings.ai.maxContentLength}
                      onChange={(e) => updateTempAI({ maxContentLength: Math.max(0, parseInt(e.target.value) || 0) })}
                      placeholder="0（不限制）"
                      min={0}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* AI 服务编辑弹窗 */}
            <Dialog open={!!editingService} onOpenChange={(open) => { if (!open) setEditingService(null); }}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{isCreatingService ? '创建 API 服务' : '编辑 API 服务'}</DialogTitle>
                </DialogHeader>
                {editingService && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>服务名称 <span className="text-xs text-muted-foreground">(可选，留空自动命名)</span></Label>
                      <Input
                        value={editingService.name}
                        onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                        placeholder={editingProviderConfig?.name || '例如：我的 GPT 服务'}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>服务商</Label>
                      <Select
                        value={editingService.provider}
                        onValueChange={(v) => handleEditProviderChange(v as AIProvider)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_PROVIDERS.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-red-500">API Key <span className="text-xs text-red-500">*必填</span></Label>
                      <Input
                        value={editingService.apiKey}
                        onChange={(e) => setEditingService({ ...editingService, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>模型</Label>
                      {editingProviderConfig && editingProviderConfig.models.length > 0 && (
                        <Select
                          value={editingProviderConfig.models.some(m => m.id === editingService.model) ? editingService.model : '__custom__'}
                          onValueChange={(v) => { if (v !== '__custom__') setEditingService({ ...editingService, model: v }); }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="选择预置模型..." />
                          </SelectTrigger>
                          <SelectContent>
                            {editingProviderConfig.models.map(m => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">自定义模型...</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">模型 ID（实际调用值，可手动修改）</Label>
                        <Input
                          value={editingService.model}
                          onChange={(e) => setEditingService({ ...editingService, model: e.target.value })}
                          placeholder="输入模型 ID，如 kimi-k2.5"
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input
                        value={editingService.baseUrl}
                        onChange={(e) => setEditingService({ ...editingService, baseUrl: e.target.value })}
                        placeholder="输入 Base URL"
                        className="font-mono text-sm"
                      />
                    </div>

                    <Separator />

                    {/* 测试连接 */}
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={testingApi || !editingService.apiKey}
                        className="w-full"
                      >
                        {testingApi ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />测试中...</>
                        ) : (
                          '测试连接'
                        )}
                      </Button>
                      {testResult && (
                        <p className={`text-sm px-3 py-2 rounded-md ${testResult.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                          {testResult.msg}
                        </p>
                      )}
                    </div>

                    {/* 保存/取消 */}
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" className="flex-1" onClick={() => setEditingService(null)}>取消</Button>
                      <Button className="flex-1" onClick={handleSaveService} disabled={!editingService.apiKey}>
                        <Check className="h-4 w-4 mr-1" />保存
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Email Settings */}
            <TabsContent value="email" className="space-y-6 p-4 bg-card h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">邮箱账户配置</h3>
                  <Button variant="outline" size="sm" onClick={handleCreateEmailAccount}>
                    <Plus className="h-4 w-4 mr-1" />添加邮箱账户
                  </Button>
                </div>

                {tempSettings.email.accounts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">还没有配置任何邮箱账户</p>
                    <p className="text-xs mt-1">点击上方「添加邮箱账户」按钮添加一个</p>
                    <p className="text-xs mt-3 text-muted-foreground/70">支持网易 163、126、移动 139、QQ 邮箱、Gmail、Outlook 等</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tempSettings.email.accounts.map(acct => {
                      const isActive = acct.id === tempSettings.email.activeAccountId;
                      const preset = getEmailPreset(acct.provider);
                      return (
                        <div
                          key={acct.id}
                          className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                            isActive
                              ? 'border-primary bg-primary/10'
                              : acct.enabled
                                ? 'border-transparent bg-muted/30 hover:bg-muted/50'
                                : 'border-transparent bg-muted/10 opacity-50'
                          }`}
                          onClick={() => acct.enabled && handleActivateEmailAccount(acct.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{acct.name}</span>
                              <span className="text-xs text-muted-foreground">{preset?.name || '自定义'}</span>
                              {isActive && (
                                <span className="text-xs font-semibold text-primary bg-primary/15 px-1.5 py-0.5 rounded">使用中</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {acct.email || '未配置邮箱地址'} {acct.password ? '' : '• ⚠️ 未配置授权码'}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleEmailAccount(acct.id)} title={acct.enabled ? '禁用' : '启用'}>
                              <Power className={`h-3.5 w-3.5 ${!acct.enabled ? 'text-muted-foreground' : !acct.password ? 'text-red-500' : acct.lastTestOk === true ? 'text-green-500' : acct.lastTestOk === false ? 'text-red-500' : 'text-orange-500'}`} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditEmailAccount(acct)} title="编辑">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteEmailAccount(acct.id)} title="删除">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Separator className="my-4" />

                <div>
                  <h4 className="text-sm font-semibold mb-2">使用说明</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>1. 选择邮箱服务商后，SMTP 服务器地址和端口会自动填充</p>
                    <p>2. 大多数邮箱需要开启 SMTP 服务并获取授权码（非登录密码）</p>
                    <p>3. 配置完成后可点击「测试连接」验证设置是否正确</p>
                    <p>4. 在邮件发送插件中可直接选择已配置的账户发送邮件</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 邮箱账户编辑弹窗 */}
            <Dialog open={!!editingEmailAccount} onOpenChange={(open) => { if (!open) setEditingEmailAccount(null); }}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{isCreatingEmailAccount ? '添加邮箱账户' : '编辑邮箱账户'}</DialogTitle>
                </DialogHeader>
                {editingEmailAccount && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>账户名称 <span className="text-xs text-muted-foreground">(可选，留空自动命名)</span></Label>
                      <Input
                        value={editingEmailAccount.name}
                        onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, name: e.target.value })}
                        placeholder="例如：我的工作邮箱"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>邮箱服务商</Label>
                      <Select
                        value={editingEmailAccount.provider}
                        onValueChange={handleEmailProviderChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EMAIL_PROVIDER_PRESETS.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-red-500">邮箱地址 <span className="text-xs text-red-500">*必填</span></Label>
                      <Input
                        value={editingEmailAccount.email}
                        onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, email: e.target.value })}
                        placeholder="your@example.com"
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-red-500">SMTP 授权码 <span className="text-xs text-red-500">*必填</span></Label>
                      <Input
                        type="password"
                        value={editingEmailAccount.password}
                        onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, password: e.target.value })}
                        placeholder="SMTP 授权码（非登录密码）"
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>发件人显示名称 <span className="text-xs text-muted-foreground">(可选)</span></Label>
                      <Input
                        value={editingEmailAccount.displayName || ''}
                        onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, displayName: e.target.value })}
                        placeholder="收件人看到的发件人名称"
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">SMTP 服务器设置（选择服务商后自动填充，也可手动修改）</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">SMTP 地址</Label>
                          <Input
                            value={editingEmailAccount.smtpHost}
                            onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, smtpHost: e.target.value })}
                            placeholder="smtp.example.com"
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">端口</Label>
                          <Input
                            type="number"
                            value={editingEmailAccount.smtpPort}
                            onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, smtpPort: parseInt(e.target.value) || 465 })}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">加密方式</Label>
                        <Select
                          value={editingEmailAccount.encryption}
                          onValueChange={(v) => setEditingEmailAccount({ ...editingEmailAccount, encryption: v as 'tls' | 'starttls' | 'none' })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tls">TLS (SSL)</SelectItem>
                            <SelectItem value="starttls">STARTTLS</SelectItem>
                            <SelectItem value="none">无加密</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        onClick={handleTestSmtpConnection}
                        disabled={testingSmtp || !editingEmailAccount.email || !editingEmailAccount.password || !editingEmailAccount.smtpHost}
                        className="w-full"
                      >
                        {testingSmtp ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />测试中...</>
                        ) : (
                          '测试连接'
                        )}
                      </Button>
                      {smtpTestResult && (
                        <p className={`text-sm px-3 py-2 rounded-md ${smtpTestResult.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                          {smtpTestResult.msg}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" className="flex-1" onClick={() => setEditingEmailAccount(null)}>取消</Button>
                      <Button className="flex-1" onClick={handleSaveEmailAccount} disabled={!editingEmailAccount.email || !editingEmailAccount.password}>
                        <Check className="h-4 w-4 mr-1" />保存
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Advanced Settings */}
            <TabsContent value="advanced" className="space-y-6 p-4 bg-card h-full">
              <div>
                <h3 className="text-lg font-semibold mb-4">{t('settings.advancedSettings.title')}</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t('settings.advancedSettings.dataPath')}</Label>
                    <Input value={file.defaultPath || '~/AiDocPlus'} disabled />
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
                  <p>{t('settings.about.version')}: 0.1.0</p>
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
 * 插件设置列表 — 从后端 manifest 驱动
 */
function PluginSettingsList() {
  const { t } = useTranslation();
  const { pluginManifests, loadPlugins } = useAppStore();

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    try {
      await invoke('set_plugin_enabled', { pluginId, enabled });
      await loadPlugins(); // 重新加载 manifest
    } catch (error) {
      console.error('Failed to toggle plugin:', error);
    }
  };

  if (pluginManifests.length === 0) return null;

  return (
    <div className="space-y-3">
      {pluginManifests.map(manifest => (
        <div
          key={manifest.id}
          className="flex items-center gap-4 p-4 rounded-lg border bg-background"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Puzzle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{manifest.name}</span>
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
            </div>
            {manifest.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{manifest.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-muted-foreground">
              {manifest.enabled
                ? t('settings.pluginsSettings.enabled', { defaultValue: '已启用' })
                : t('settings.pluginsSettings.disabled', { defaultValue: '已禁用' })}
            </span>
            <Switch
              checked={manifest.enabled}
              onCheckedChange={(checked) => handleToggle(manifest.id, checked)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default SettingsPanel;
