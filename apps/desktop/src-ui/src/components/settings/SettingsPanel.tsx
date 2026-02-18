import { useState, useEffect } from 'react';
import { X, Monitor, Type, Globe, Zap, Download, Upload, RotateCcw, Loader2, Puzzle, Plus, Pencil, Trash2, Check, Power, Mail, Search, ChevronDown, ChevronRight, LayoutTemplate } from 'lucide-react';
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
import { RolePanel } from './RolePanel';

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
    role,
    updateEditorSettings,
    updateUISettings,
    updateAISettings,
    updateEmailSettings,
    createRoleInstance,
    updateRoleInstance,
    deleteRoleInstance,
    setActiveInstance,
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
            <TabsTrigger value="role">
              <span className="mr-1">🎭</span>
              {t('settings.roleTab', { defaultValue: '角色' })}
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
            {/* Role */}
            <TabsContent value="role" className="p-4 bg-card h-full">
              <RolePanel
                role={role}
                onCreateInstance={createRoleInstance}
                onUpdateInstance={updateRoleInstance}
                onDeleteInstance={deleteRoleInstance}
                onSetActive={setActiveInstance}
                t={t}
              />
            </TabsContent>

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
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{t('settings.aiServiceConfig', { defaultValue: 'AI 服务配置' })}</h3>
                  <Button variant="outline" size="sm" onClick={handleCreateService}>
                    <Plus className="h-4 w-4 mr-1" />{t('settings.createApiService', { defaultValue: '创建 API 服务' })}
                  </Button>
                </div>

                {/* 服务列表 */}
                {tempSettings.ai.services.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="text-sm">{t('settings.noAiServices', { defaultValue: '还没有配置任何 AI 服务' })}</p>
                    <p className="text-xs mt-1">{t('settings.noAiServicesHint', { defaultValue: '点击上方「创建 API 服务」按钮添加一个' })}</p>
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
                                <span className="text-xs font-semibold text-primary bg-primary/15 px-1.5 py-0.5 rounded">{t('settings.inUse', { defaultValue: '使用中' })}</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {t('settings.modelLabel', { defaultValue: '模型: {{model}}', model: svc.model || t('settings.defaultModel', { defaultValue: '默认模型' }) })} {svc.apiKey ? '' : `• ${t('settings.noKeyWarning', { defaultValue: '⚠️ 未配置 Key' })}`}
                            </div>
                          </div>
                          {/* 操作按钮 */}
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleService(svc.id)} title={svc.enabled ? t('settings.disable', { defaultValue: '禁用' }) : t('settings.enable', { defaultValue: '启用' })}>
                              <Power className={`h-3.5 w-3.5 ${!svc.enabled ? 'text-muted-foreground' : !svc.apiKey ? 'text-red-500' : svc.lastTestOk === true ? 'text-green-500' : svc.lastTestOk === false ? 'text-red-500' : 'text-orange-500'}`} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditService(svc)} title={t('settings.edit', { defaultValue: '编辑' })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteService(svc.id)} title={t('settings.delete', { defaultValue: '删除' })}>
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
                <h4 className="text-sm font-semibold mb-3">{t('settings.globalSettings', { defaultValue: '全局设置' })}</h4>
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
                      <Label>{t('settings.streamingOutput', { defaultValue: '流式输出' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.streamingOutputDesc', { defaultValue: '启用后 AI 回复将逐字显示' })}</p>
                    </div>
                    <Switch
                      checked={tempSettings.ai.streamEnabled}
                      onCheckedChange={(checked) => updateTempAI({ streamEnabled: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>{t('settings.enableThinking', { defaultValue: '深度思考' })}</Label>
                      <p className="text-xs text-muted-foreground">{t('settings.enableThinkingDesc', { defaultValue: '启用后支持的模型将展示推理/思考过程（Qwen/DeepSeek/Claude 等）' })}</p>
                    </div>
                    <Switch
                      checked={tempSettings.ai.enableThinking ?? false}
                      onCheckedChange={(checked) => updateTempAI({ enableThinking: checked })}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>{t('settings.forceMarkdown', { defaultValue: '强制 Markdown 格式输出' })}</Label>
                        <p className="text-xs text-muted-foreground">{t('settings.forceMarkdownDesc', { defaultValue: '启用后 AI 将始终以纯净 Markdown 格式返回内容，不含多余的开场白和总结语' })}</p>
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
                        placeholder={t('settings.markdownPromptPlaceholder', { defaultValue: 'Markdown 格式约束提示词...' })}
                        className="w-full min-h-[120px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                        spellCheck={false}
                        autoCorrect="off"
                        autoCapitalize="off"
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.systemPromptLabel', { defaultValue: 'System Prompt' })} <span className="text-xs text-muted-foreground">{t('settings.systemPromptOptional', { defaultValue: '(可选)' })}</span></Label>
                    <textarea
                      value={tempSettings.ai.systemPrompt || ''}
                      onChange={(e) => updateTempAI({ systemPrompt: e.target.value })}
                      placeholder={t('settings.systemPromptPlaceholder', { defaultValue: '可选，留空则不附加额外系统提示词...' })}
                      className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('settings.pluginContentLimit', { defaultValue: '插件正文字数限制' })}</Label>
                    <p className="text-xs text-muted-foreground">{t('settings.pluginContentLimitDesc', { defaultValue: '插件发送给 AI 的正文最大字符数，0 表示不限制' })}</p>
                    <Input
                      type="number"
                      value={tempSettings.ai.maxContentLength}
                      onChange={(e) => updateTempAI({ maxContentLength: Math.max(0, parseInt(e.target.value) || 0) })}
                      placeholder={t('settings.pluginContentLimitPlaceholder', { defaultValue: '0（不限制）' })}
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
                  <DialogTitle>{isCreatingService ? t('settings.createApiServiceTitle', { defaultValue: '创建 API 服务' }) : t('settings.editApiServiceTitle', { defaultValue: '编辑 API 服务' })}</DialogTitle>
                </DialogHeader>
                {editingService && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>{t('settings.serviceNameLabel', { defaultValue: '服务名称' })} <span className="text-xs text-muted-foreground">{t('settings.serviceNameOptional', { defaultValue: '(可选，留空自动命名)' })}</span></Label>
                      <Input
                        value={editingService.name}
                        onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                        placeholder={editingProviderConfig?.name || t('settings.serviceNamePlaceholder', { defaultValue: '例如：我的 GPT 服务' })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('settings.providerLabel', { defaultValue: '服务商' })}</Label>
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
                      <Label className="text-red-500">{t('settings.apiKeyRequired', { defaultValue: 'API Key' })} <span className="text-xs text-red-500">{t('settings.apiKeyRequiredMark', { defaultValue: '*必填' })}</span></Label>
                      <Input
                        value={editingService.apiKey}
                        onChange={(e) => setEditingService({ ...editingService, apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('settings.modelSelectPlaceholder', { defaultValue: '模型' })}</Label>
                      {editingProviderConfig && editingProviderConfig.models.length > 0 && (
                        <Select
                          value={editingProviderConfig.models.some(m => m.id === editingService.model) ? editingService.model : '__custom__'}
                          onValueChange={(v) => { if (v !== '__custom__') setEditingService({ ...editingService, model: v }); }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('settings.modelSelectPlaceholder', { defaultValue: '选择预置模型...' })} />
                          </SelectTrigger>
                          <SelectContent>
                            {editingProviderConfig.models.map(m => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">{t('settings.customModel', { defaultValue: '自定义模型...' })}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{t('settings.modelIdLabel', { defaultValue: '模型 ID（实际调用值，可手动修改）' })}</Label>
                        <Input
                          value={editingService.model}
                          onChange={(e) => setEditingService({ ...editingService, model: e.target.value })}
                          placeholder={t('settings.modelIdPlaceholder', { defaultValue: '输入模型 ID，如 kimi-k2.5' })}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Base URL</Label>
                      <Input
                        value={editingService.baseUrl}
                        onChange={(e) => setEditingService({ ...editingService, baseUrl: e.target.value })}
                        placeholder={t('settings.baseUrlPlaceholder', { defaultValue: '输入 Base URL' })}
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
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('settings.testing', { defaultValue: '测试中...' })}</>
                        ) : (
                          t('settings.testConnection', { defaultValue: '测试连接' })
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
                      <Button variant="outline" className="flex-1" onClick={() => setEditingService(null)}>{t('settings.cancel', { defaultValue: '取消' })}</Button>
                      <Button className="flex-1" onClick={handleSaveService} disabled={!editingService.apiKey}>
                        <Check className="h-4 w-4 mr-1" />{t('settings.save', { defaultValue: '保存' })}
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
                  <h3 className="text-lg font-semibold">{t('settings.emailAccountConfig', { defaultValue: '邮箱账户配置' })}</h3>
                  <Button variant="outline" size="sm" onClick={handleCreateEmailAccount}>
                    <Plus className="h-4 w-4 mr-1" />{t('settings.addEmailAccount', { defaultValue: '添加邮箱账户' })}
                  </Button>
                </div>

                {tempSettings.email.accounts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">{t('settings.noEmailAccounts', { defaultValue: '还没有配置任何邮箱账户' })}</p>
                    <p className="text-xs mt-1">{t('settings.noEmailAccountsHint', { defaultValue: '点击上方「添加邮箱账户」按钮添加一个' })}</p>
                    <p className="text-xs mt-3 text-muted-foreground/70">{t('settings.emailProviderSupport', { defaultValue: '支持网易 163、126、移动 139、QQ 邮箱、Gmail、Outlook 等' })}</p>
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
                              <span className="text-xs text-muted-foreground">{preset?.name || t('settings.customProvider', { defaultValue: '自定义' })}</span>
                              {isActive && (
                                <span className="text-xs font-semibold text-primary bg-primary/15 px-1.5 py-0.5 rounded">{t('settings.inUse', { defaultValue: '使用中' })}</span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {acct.email || t('settings.noEmailConfigured', { defaultValue: '未配置邮箱地址' })} {acct.password ? '' : `• ${t('settings.noAuthCodeWarning', { defaultValue: '⚠️ 未配置授权码' })}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleEmailAccount(acct.id)} title={acct.enabled ? t('settings.disable', { defaultValue: '禁用' }) : t('settings.enable', { defaultValue: '启用' })}>
                              <Power className={`h-3.5 w-3.5 ${!acct.enabled ? 'text-muted-foreground' : !acct.password ? 'text-red-500' : acct.lastTestOk === true ? 'text-green-500' : acct.lastTestOk === false ? 'text-red-500' : 'text-orange-500'}`} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditEmailAccount(acct)} title={t('settings.edit', { defaultValue: '编辑' })}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteEmailAccount(acct.id)} title={t('settings.delete', { defaultValue: '删除' })}>
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
                  <h4 className="text-sm font-semibold mb-2">{t('settings.emailUsageTitle', { defaultValue: '使用说明' })}</h4>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{t('settings.emailUsageStep1', { defaultValue: '1. 选择邮箱服务商后，SMTP 服务器地址和端口会自动填充' })}</p>
                    <p>{t('settings.emailUsageStep2', { defaultValue: '2. 大多数邮箱需要开启 SMTP 服务并获取授权码（非登录密码）' })}</p>
                    <p>{t('settings.emailUsageStep3', { defaultValue: '3. 配置完成后可点击「测试连接」验证设置是否正确' })}</p>
                    <p>{t('settings.emailUsageStep4', { defaultValue: '4. 在邮件发送插件中可直接选择已配置的账户发送邮件' })}</p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 邮箱账户编辑弹窗 */}
            <Dialog open={!!editingEmailAccount} onOpenChange={(open) => { if (!open) setEditingEmailAccount(null); }}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>{isCreatingEmailAccount ? t('settings.addEmailAccountTitle', { defaultValue: '添加邮箱账户' }) : t('settings.editEmailAccountTitle', { defaultValue: '编辑邮箱账户' })}</DialogTitle>
                </DialogHeader>
                {editingEmailAccount && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>{t('settings.accountNameLabel', { defaultValue: '账户名称' })} <span className="text-xs text-muted-foreground">{t('settings.accountNameOptional', { defaultValue: '(可选，留空自动命名)' })}</span></Label>
                      <Input
                        value={editingEmailAccount.name}
                        onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, name: e.target.value })}
                        placeholder={t('settings.accountNamePlaceholder', { defaultValue: '例如：我的工作邮箱' })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('settings.emailProviderLabel', { defaultValue: '邮箱服务商' })}</Label>
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
                      <Label className="text-red-500">{t('settings.emailAddressLabel', { defaultValue: '邮箱地址' })} <span className="text-xs text-red-500">{t('settings.emailAddressRequired', { defaultValue: '*必填' })}</span></Label>
                      <Input
                        value={editingEmailAccount.email}
                        onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, email: e.target.value })}
                        placeholder="your@example.com"
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-red-500">{t('settings.smtpAuthCodeLabel', { defaultValue: 'SMTP 授权码' })} <span className="text-xs text-red-500">{t('settings.smtpAuthCodeRequired', { defaultValue: '*必填' })}</span></Label>
                      <Input
                        type="password"
                        value={editingEmailAccount.password}
                        onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, password: e.target.value })}
                        placeholder={t('settings.smtpAuthCodePlaceholder', { defaultValue: 'SMTP 授权码（非登录密码）' })}
                        className="font-mono text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t('settings.senderNameLabel', { defaultValue: '发件人显示名称' })} <span className="text-xs text-muted-foreground">{t('settings.senderNameOptional', { defaultValue: '(可选)' })}</span></Label>
                      <Input
                        value={editingEmailAccount.displayName || ''}
                        onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, displayName: e.target.value })}
                        placeholder={t('settings.senderNamePlaceholder', { defaultValue: '收件人看到的发件人名称' })}
                      />
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t('settings.smtpServerSettings', { defaultValue: 'SMTP 服务器设置（选择服务商后自动填充，也可手动修改）' })}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t('settings.smtpAddress', { defaultValue: 'SMTP 地址' })}</Label>
                          <Input
                            value={editingEmailAccount.smtpHost}
                            onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, smtpHost: e.target.value })}
                            placeholder="smtp.example.com"
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t('settings.smtpPort', { defaultValue: '端口' })}</Label>
                          <Input
                            type="number"
                            value={editingEmailAccount.smtpPort}
                            onChange={(e) => setEditingEmailAccount({ ...editingEmailAccount, smtpPort: parseInt(e.target.value) || 465 })}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('settings.smtpEncryption', { defaultValue: '加密方式' })}</Label>
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
                            <SelectItem value="none">{t('settings.noEncryption', { defaultValue: '无加密' })}</SelectItem>
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
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t('settings.testing', { defaultValue: '测试中...' })}</>
                        ) : (
                          t('settings.testConnection', { defaultValue: '测试连接' })
                        )}
                      </Button>
                      {smtpTestResult && (
                        <p className={`text-sm px-3 py-2 rounded-md ${smtpTestResult.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                          {smtpTestResult.msg}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" className="flex-1" onClick={() => setEditingEmailAccount(null)}>{t('settings.cancel', { defaultValue: '取消' })}</Button>
                      <Button className="flex-1" onClick={handleSaveEmailAccount} disabled={!editingEmailAccount.email || !editingEmailAccount.password}>
                        <Check className="h-4 w-4 mr-1" />{t('settings.save', { defaultValue: '保存' })}
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
 * 插件设置列表 — 分类分组视图 + 搜索 + 批量操作
 */
function PluginSettingsList() {
  const { t } = useTranslation();
  const { pluginManifests, loadPlugins } = useAppStore();
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
