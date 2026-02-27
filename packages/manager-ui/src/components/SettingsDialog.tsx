import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  X, RefreshCw, Check, Plus, Trash2, Download, Pencil,
  Zap, AlertCircle, Star, StarOff, Loader2,
} from 'lucide-react';
import { cn } from './ui/cn';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

// ============================================================
// 类型定义
// ============================================================

interface LocalService {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

interface LocalAIServices {
  services: LocalService[];
  activeServiceId: string;
}

interface SharedService {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
}

interface SharedAIServices {
  services: SharedService[];
  activeServiceId: string;
  temperature: number;
  maxTokens: number;
}

const PROVIDER_BASE_URLS: Record<string, string> = {
  'openai': 'https://api.openai.com/v1',
  'anthropic': 'https://api.anthropic.com/v1',
  'gemini': 'https://generativelanguage.googleapis.com/v1beta/openai',
  'xai': 'https://api.x.ai/v1',
  'deepseek': 'https://api.deepseek.com',
  'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  'glm': 'https://open.bigmodel.cn/api/paas/v4',
  'minimax': 'https://api.minimaxi.com/v1',
  'kimi': 'https://api.moonshot.cn/v1',
};

// ============================================================
// 组件
// ============================================================

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const [localServices, setLocalServices] = useState<LocalService[]>([]);
  const [activeServiceId, setActiveServiceId] = useState('');
  const [sharedServices, setSharedServices] = useState<SharedService[]>([]);
  const [sharedMeta, setSharedMeta] = useState<{ activeId: string; temperature: number; maxTokens: number }>({ activeId: '', temperature: 0.7, maxTokens: 0 });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [editingService, setEditingService] = useState<LocalService | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importSelection, setImportSelection] = useState<Set<string>>(new Set());

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [local, shared] = await Promise.all([
        invoke<LocalAIServices>('cmd_load_local_ai_services').catch(() => ({ services: [], activeServiceId: '' })),
        invoke<SharedAIServices>('cmd_load_shared_ai_services').catch(() => null),
      ]);
      setLocalServices(local.services);
      setActiveServiceId(local.activeServiceId);
      if (shared) {
        setSharedServices(shared.services.filter((s) => s.enabled));
        setSharedMeta({ activeId: shared.activeServiceId, temperature: shared.temperature, maxTokens: shared.maxTokens });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 2500);
  };

  // 保存本地服务列表
  const saveLocal = async (services: LocalService[], activeId: string) => {
    try {
      await invoke('cmd_save_local_ai_services', { data: { services, activeServiceId: activeId } });
      setLocalServices(services);
      setActiveServiceId(activeId);
      showMsg('已保存', 'success');
    } catch (e) {
      showMsg('保存失败: ' + String(e), 'error');
    }
  };

  // 设为默认
  const handleSetActive = (id: string) => {
    saveLocal(localServices, id);
  };

  // 删除服务
  const handleDelete = (id: string) => {
    const next = localServices.filter((s) => s.id !== id);
    const nextActive = activeServiceId === id ? (next[0]?.id || '') : activeServiceId;
    saveLocal(next, nextActive);
  };

  // 保存编辑
  const handleSaveEdit = (svc: LocalService) => {
    const exists = localServices.find((s) => s.id === svc.id);
    let next: LocalService[];
    if (exists) {
      next = localServices.map((s) => s.id === svc.id ? svc : s);
    } else {
      next = [...localServices, svc];
    }
    const nextActive = activeServiceId || svc.id;
    saveLocal(next, nextActive);
    setEditingService(null);
  };

  // 新建空服务
  const handleAddNew = () => {
    setEditingService({
      id: `svc-${Date.now()}`,
      name: '',
      provider: '',
      baseUrl: '',
      apiKey: '',
      model: '',
      maxTokens: 0,
      temperature: 0.7,
    });
  };

  // 从主程序导入
  const handleImport = () => {
    if (importSelection.size === 0) return;
    const toImport = sharedServices.filter((s) => importSelection.has(s.id));
    const newServices = [...localServices];
    for (const svc of toImport) {
      const existIdx = newServices.findIndex((s) => s.id === svc.id);
      const local: LocalService = {
        id: svc.id,
        name: svc.name || svc.provider,
        provider: svc.provider,
        baseUrl: svc.baseUrl || PROVIDER_BASE_URLS[svc.provider] || '',
        apiKey: svc.apiKey,
        model: svc.model,
        maxTokens: sharedMeta.maxTokens || 0,
        temperature: sharedMeta.temperature || 0.7,
      };
      if (existIdx >= 0) {
        newServices[existIdx] = local;
      } else {
        newServices.push(local);
      }
    }
    const nextActive = activeServiceId || newServices[0]?.id || '';
    saveLocal(newServices, nextActive);
    setShowImport(false);
    setImportSelection(new Set());
  };

  // 刷新主程序服务
  const handleRefreshShared = async () => {
    try {
      const shared = await invoke<SharedAIServices>('cmd_load_shared_ai_services');
      setSharedServices(shared.services.filter((s) => s.enabled));
      setSharedMeta({ activeId: shared.activeServiceId, temperature: shared.temperature, maxTokens: shared.maxTokens });
      showMsg('已刷新主程序服务列表', 'success');
    } catch (e) {
      showMsg('刷新失败: ' + String(e), 'error');
    }
  };

  // 切换导入选择
  const toggleImportSelect = (id: string) => {
    setImportSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 全选/全不选导入
  const toggleImportAll = () => {
    if (importSelection.size === sharedServices.length) {
      setImportSelection(new Set());
    } else {
      setImportSelection(new Set(sharedServices.map((s) => s.id)));
    }
  };

  const maskKey = (key: string) => key ? key.slice(0, 6) + '••••••' : '未设置';

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] top-[5vh] translate-y-0 overflow-hidden flex flex-col p-0">
        {/* 标题栏 */}
        <DialogHeader className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b space-y-0">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            AI 服务管理
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : editingService ? (
          /* ===== 编辑/新建服务 ===== */
          <ServiceEditor
            service={editingService}
            onSave={handleSaveEdit}
            onCancel={() => setEditingService(null)}
          />
        ) : showImport ? (
          /* ===== 从主程序导入 ===== */
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/20 shrink-0">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">从主程序导入 AI 服务</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRefreshShared} className="p-1.5 rounded-md hover:bg-muted" title="刷新">
                  <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button onClick={toggleImportAll} className="text-xs text-primary hover:underline">
                  {importSelection.size === sharedServices.length ? '全不选' : '全选'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sharedServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">未找到主程序 AI 服务</p>
                  <p className="text-xs mt-1">请先在主程序中配置 AI 服务</p>
                </div>
              ) : (
                sharedServices.map((svc) => {
                  const isSelected = importSelection.has(svc.id);
                  const alreadyLocal = localServices.some((l) => l.id === svc.id);
                  return (
                    <button
                      key={svc.id}
                      onClick={() => toggleImportSelect(svc.id)}
                      className={cn(
                        'w-full text-left p-3.5 rounded-lg border transition-all',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500/30'
                          : 'border-border hover:bg-muted/40',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Zap className={cn('h-4 w-4 shrink-0', isSelected ? 'text-blue-500' : 'text-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{svc.name || svc.provider}</span>
                            {svc.id === sharedMeta.activeId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">主程序默认</span>
                            )}
                            {alreadyLocal && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 shrink-0">已导入</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {svc.model} · {svc.provider}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="flex justify-between px-6 py-4 border-t shrink-0">
              <Button
                variant="outline"
                onClick={() => { setShowImport(false); setImportSelection(new Set()); }}
              >
                返回
              </Button>
              <Button
                onClick={handleImport}
                disabled={importSelection.size === 0}
              >
                <Download className="h-4 w-4" />
                导入 {importSelection.size > 0 ? `${importSelection.size} 个服务` : ''}
              </Button>
            </div>
          </div>
        ) : (
          /* ===== 服务列表主界面 ===== */
          <div className="flex-1 flex flex-col min-h-0">
            {/* 操作栏 */}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/20 shrink-0">
              <span className="text-sm text-muted-foreground">
                {localServices.length > 0
                  ? `${localServices.length} 个服务`
                  : '暂无服务，请导入或手动添加'}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
                  <Download className="h-3.5 w-3.5" /> 从主程序导入
                </Button>
                <Button size="sm" onClick={handleAddNew}>
                  <Plus className="h-3.5 w-3.5" /> 手动添加
                </Button>
              </div>
            </div>

            {/* 服务列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {localServices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Zap className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">还没有 AI 服务</p>
                  <p className="text-xs mt-1">点击「从主程序导入」或「手动添加」开始配置</p>
                </div>
              ) : (
                localServices.map((svc) => {
                  const isActive = svc.id === activeServiceId;
                  return (
                    <div
                      key={svc.id}
                      className={cn(
                        'rounded-lg border p-4 transition-all',
                        isActive
                          ? 'border-primary/40 bg-primary/[0.03] ring-1 ring-primary/10'
                          : 'border-border hover:border-border/80',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                          isActive ? 'bg-primary/10' : 'bg-muted',
                        )}>
                          <Zap className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold truncate">{svc.name || svc.model}</span>
                            {isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">当前使用</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            <div className="flex items-center gap-4">
                              <span>模型: <span className="font-mono text-foreground/70">{svc.model}</span></span>
                              {svc.provider && <span>提供商: {svc.provider}</span>}
                            </div>
                            <div className="truncate">
                              API: <span className="font-mono text-foreground/70">{svc.baseUrl || '未设置'}</span>
                            </div>
                            <div>Key: <span className="font-mono text-foreground/70">{maskKey(svc.apiKey)}</span></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleSetActive(svc.id)}
                            className={cn('p-1.5 rounded-md transition-colors', isActive ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-amber-500 hover:bg-muted')}
                            title={isActive ? '当前默认服务' : '设为默认'}
                          >
                            {isActive ? <Star className="h-4 w-4 fill-current" /> : <StarOff className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setEditingService({ ...svc })}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="编辑"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(svc.id)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="删除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 消息 + 底部 */}
            {message && (
              <div className={cn(
                'mx-6 mb-2 text-sm px-3 py-2 rounded-md',
                message.type === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-green-50 text-green-700',
              )}>
                {message.text}
              </div>
            )}
            <div className="flex justify-end px-6 py-4 border-t shrink-0">
              <Button variant="outline" onClick={onClose}>
                关闭
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// 服务编辑子组件
// ============================================================

function ServiceEditor({
  service,
  onSave,
  onCancel,
}: {
  service: LocalService;
  onSave: (svc: LocalService) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<LocalService>(service);
  const isNew = !service.name && !service.apiKey;

  const update = (key: keyof LocalService, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSave = form.name.trim() && form.apiKey.trim() && form.model.trim();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/20 shrink-0">
        <Pencil className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{isNew ? '添加新服务' : `编辑: ${service.name}`}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">服务名称 <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="例如: DeepSeek Chat"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">提供商</label>
            <input
              type="text"
              value={form.provider}
              onChange={(e) => update('provider', e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="例如: deepseek"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">API Base URL</label>
          <input
            type="text"
            value={form.baseUrl}
            onChange={(e) => update('baseUrl', e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono shadow-sm outline-none focus:ring-1 focus:ring-ring"
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">API Key <span className="text-destructive">*</span></label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => update('apiKey', e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono shadow-sm outline-none focus:ring-1 focus:ring-ring"
            placeholder="sk-..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">模型 <span className="text-destructive">*</span></label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => update('model', e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm font-mono shadow-sm outline-none focus:ring-1 focus:ring-ring"
            placeholder="gpt-4o / deepseek-chat / ..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">最大 Token</label>
            <input
              type="number"
              value={form.maxTokens}
              onChange={(e) => update('maxTokens', parseInt(e.target.value) || 0)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">温度</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={form.temperature}
              onChange={(e) => update('temperature', parseFloat(e.target.value) || 0.7)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button
          onClick={() => canSave && onSave(form)}
          disabled={!canSave}
        >
          <Check className="h-4 w-4" /> 保存
        </Button>
      </div>
    </div>
  );
}
