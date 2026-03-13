import { useState } from 'react';
import { Plus, Pencil, Trash2, Check, Power, Gift, ExternalLink, Loader2 } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../../i18n';
import { AI_PROVIDERS, getProviderConfig } from '@aidocplus/shared-types';
import type { AIProvider, AIServiceConfig } from '@aidocplus/shared-types';
import { formatBackendError } from '@/lib/backendError';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

export interface AITempSettings {
  services: AIServiceConfig[];
  activeServiceId: string;
  temperature: number;
  maxTokens: number;
  streamEnabled: boolean;
  enableThinking?: boolean;
  markdownMode?: boolean;
  markdownModePrompt?: string;
  systemPrompt?: string;
  maxContentLength: number;
  proxyUrl?: string;
  connectTimeoutSecs?: number;
  requestTimeoutSecs?: number;
}

interface AISettingsTabProps {
  tempAI: AITempSettings;
  updateTempAI: (newSettings: Partial<AITempSettings>) => void;
}

export function AISettingsTab({ tempAI, updateTempAI }: AISettingsTabProps) {
  const { t } = useTranslation();

  const [editingService, setEditingService] = useState<AIServiceConfig | null>(null);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
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

  const handleEditService = async (svc: AIServiceConfig) => {
    const editSvc = { ...svc };
    if (editSvc.apiKey === '__KEYRING__' || !editSvc.apiKey) {
      try {
        const realKey = await invoke<string>('get_ai_credential', { serviceId: svc.id });
        if (realKey) editSvc.apiKey = realKey;
      } catch { /* keyring 读取失败 */ }
    }
    setEditingService(editSvc);
    setIsCreatingService(false);
    setTestResult(null);
  };

  const handleSaveService = async () => {
    if (!editingService) return;
    const providerCfg = getProviderConfig(editingService.provider);
    const svcName = editingService.name.trim() || providerCfg?.name || editingService.provider;
    const realApiKey = editingService.apiKey;
    if (realApiKey && realApiKey !== '__KEYRING__') {
      try {
        await invoke('store_ai_credential', { serviceId: editingService.id, apiKey: realApiKey });
      } catch (e) {
        console.warn('存储 API Key 到密钥链失败，将保留在配置文件中:', e);
      }
    }
    const svc = { ...editingService, name: svcName, apiKey: realApiKey ? '__KEYRING__' : '' };
    const services = [...tempAI.services];
    const idx = services.findIndex(s => s.id === svc.id);
    if (idx >= 0) { services[idx] = svc; } else { services.push(svc); }
    const activeId = tempAI.activeServiceId || svc.id;
    updateTempAI({ services, activeServiceId: activeId });
    setEditingService(null);
  };

  const handleDeleteService = (id: string) => {
    invoke('delete_ai_credential', { serviceId: id }).catch(() => {});
    const services = tempAI.services.filter(s => s.id !== id);
    let activeId = tempAI.activeServiceId;
    if (activeId === id) { activeId = services.find(s => s.enabled)?.id || ''; }
    updateTempAI({ services, activeServiceId: activeId });
  };

  const handleToggleService = (id: string) => {
    const services = tempAI.services.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
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
      setTestResult({ ok: false, msg: formatBackendError(err) });
      setEditingService(prev => prev ? { ...prev, lastTestOk: false } : prev);
    } finally {
      setTestingApi(false);
    }
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('settings.aiServiceConfig', { defaultValue: 'AI 服务配置' })}</h3>
          <Button variant="outline" size="sm" onClick={handleCreateService}>
            <Plus className="h-4 w-4 mr-1" />{t('settings.createApiService', { defaultValue: '创建 API 服务' })}
          </Button>
        </div>

        {/* 服务列表 */}
        {tempAI.services.length === 0 ? (
          <div className="space-y-4">
            {/* 新用户引导卡片 */}
            <div className="rounded-lg border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 p-4">
              <div className="flex items-start gap-3">
                <Gift className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">
                    {t('settings.glmGuide.title', { defaultValue: '🎁 新用户福利：智谱 AI 2000万免费 Tokens' })}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('settings.glmGuide.subtitle', { defaultValue: '注册智谱开放平台，获取免费 API Key 即可开始体验' })}
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground bg-background/50 rounded-md p-3">
                <p><span className="text-primary font-semibold">1.</span> {t('settings.glmGuide.step1', { defaultValue: '访问智谱开放平台' })} <a href="https://open.bigmodel.cn/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">open.bigmodel.cn</a></p>
                <p><span className="text-primary font-semibold">2.</span> {t('settings.glmGuide.step2', { defaultValue: '点击右上角「注册/登录」，使用微信或手机号完成注册' })}</p>
                <p><span className="text-primary font-semibold">3.</span> {t('settings.glmGuide.step3', { defaultValue: '进入「用户中心」→「API Keys」→ 点击「创建新的 API Key」' })}</p>
                <p><span className="text-primary font-semibold">4.</span> {t('settings.glmGuide.step4', { defaultValue: '复制 API Key，点击下方「立即配置」按钮粘贴即可' })}</p>
              </div>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={() => window.open('https://open.bigmodel.cn/', '_blank')}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  {t('settings.glmGuide.openPlatform', { defaultValue: '打开智谱平台' })}
                </Button>
                <Button variant="default" size="sm" onClick={handleCreateService}>
                  <Plus className="h-3 w-3 mr-1" />
                  {t('settings.glmGuide.configureNow', { defaultValue: '立即配置' })}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {tempAI.services.map(svc => {
              const isActive = svc.id === tempAI.activeServiceId;
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
                value={[tempAI.temperature]}
                onValueChange={([value]) => updateTempAI({ temperature: value })}
                min={0}
                max={2}
                step={0.1}
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-12 text-right">{tempAI.temperature}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max Tokens</Label>
            <Input
              type="number"
              value={tempAI.maxTokens}
              onChange={(e) => updateTempAI({ maxTokens: parseInt(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.streamingOutput', { defaultValue: '流式输出' })}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.streamingOutputDesc', { defaultValue: '启用后 AI 回复将逐字显示' })}</p>
            </div>
            <Switch
              checked={tempAI.streamEnabled}
              onCheckedChange={(checked) => updateTempAI({ streamEnabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('settings.enableThinking', { defaultValue: '深度思考' })}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.enableThinkingDesc', { defaultValue: '启用后支持的模型将展示推理/思考过程（Qwen/DeepSeek/Claude 等）' })}</p>
            </div>
            <Switch
              checked={tempAI.enableThinking ?? false}
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
                checked={tempAI.markdownMode ?? true}
                onCheckedChange={(checked) => updateTempAI({ markdownMode: checked })}
              />
            </div>
            {tempAI.markdownMode && (
              <textarea
                value={tempAI.markdownModePrompt ?? ''}
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
              value={tempAI.systemPrompt || ''}
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
              value={tempAI.maxContentLength}
              onChange={(e) => updateTempAI({ maxContentLength: Math.max(0, parseInt(e.target.value) || 0) })}
              placeholder={t('settings.pluginContentLimitPlaceholder', { defaultValue: '0（不限制）' })}
              min={0}
            />
          </div>

          <Separator />

          <div className="space-y-4">
            <Label className="text-base font-semibold">{t('settings.networkSettings', { defaultValue: '网络设置' })}</Label>

            <div className="space-y-2">
              <Label>{t('settings.proxyUrl', { defaultValue: 'HTTP 代理' })}</Label>
              <p className="text-xs text-muted-foreground">{t('settings.proxyUrlDesc', { defaultValue: '留空表示不使用代理。支持 http:// 和 socks5:// 协议' })}</p>
              <Input
                value={tempAI.proxyUrl || ''}
                onChange={(e) => updateTempAI({ proxyUrl: e.target.value })}
                placeholder="http://127.0.0.1:7890"
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settings.connectTimeout', { defaultValue: '连接超时（秒）' })}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.connectTimeoutDesc', { defaultValue: '0 使用默认值 15 秒' })}</p>
                <Input
                  type="number"
                  value={tempAI.connectTimeoutSecs || 0}
                  onChange={(e) => updateTempAI({ connectTimeoutSecs: Math.max(0, parseInt(e.target.value) || 0) })}
                  min={0}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('settings.requestTimeout', { defaultValue: '请求超时（秒）' })}</Label>
                <p className="text-xs text-muted-foreground">{t('settings.requestTimeoutDesc', { defaultValue: '0 使用默认值 300 秒' })}</p>
                <Input
                  type="number"
                  value={tempAI.requestTimeoutSecs || 0}
                  onChange={(e) => updateTempAI({ requestTimeoutSecs: Math.max(0, parseInt(e.target.value) || 0) })}
                  min={0}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </>
  );
}
