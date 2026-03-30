import { useState, useRef, useCallback, useEffect } from 'react';
import { jsonrepair } from 'jsonrepair';
import { invoke } from '@tauri-apps/api/core';
import {
  X, Sparkles, Loader2, Check, ChevronDown, ChevronRight,
  Plus, RotateCcw, Square, RefreshCw, Zap, AlertCircle,
} from 'lucide-react';
import type { ResourceTypeConfig, CategoryDefinition, AIServiceConfig } from '@aidocplus/manager-shared';
import { loadAIConfig, aiGenerateStream } from '../hooks/useAIGenerate';
import { useResourceStore } from '../stores/useResourceStore';
import { cn } from './ui/cn';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

// ============================================================
// Provider → 默认 BaseUrl 映射（与主程序 AI 提供商配置一致）
// ============================================================
const PROVIDER_BASE_URLS: Record<string, string> = {
  'openai': 'https://api.openai.com/v1',
  'anthropic': 'https://api.anthropic.com/v1',
  'gemini': 'https://generativelanguage.googleapis.com/v1beta/openai',
  'xai': 'https://api.x.ai/v1',
  'deepseek': 'https://api.deepseek.com',
  'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  'glm': 'https://open.bigmodel.cn/api/paas/v4',
  'glm-code': 'https://open.bigmodel.cn/api/coding/paas/v4',
  'minimax': 'https://api.minimaxi.com/v1',
  'minimax-code': 'https://api.minimaxi.com/v1',
  'kimi': 'https://api.moonshot.cn/v1',
  'kimi-code': 'https://api.kimi.com/coding/v1',
};

// ============================================================
// 本地 AI 服务类型（与 Rust LocalAIServiceItem 对应）
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

/** 单个解析后的资源 */
interface ParsedResource {
  manifest: Record<string, unknown>;
  contentFiles: Record<string, string>;
  selected: boolean;
  expanded: boolean;
}

interface AICreateDialogProps {
  config: ResourceTypeConfig;
  onBatchCreated: (
    items: Array<{
      category: string;
      id: string;
      manifest: Record<string, unknown>;
      contentFiles: Array<{ filename: string; content: string }>;
    }>,
    newCategory?: { key: string; name: string; icon: string },
  ) => void;
  onClose: () => void;
}

type Step = 'config' | 'generate' | 'preview' | 'creating';

const STEPS: { key: Step; label: string }[] = [
  { key: 'config', label: '配置' },
  { key: 'generate', label: '生成' },
  { key: 'preview', label: '预览' },
  { key: 'creating', label: '创建' },
];

/** 从 JSON 文本中逐个提取顶层对象，每个对象用 jsonrepair 修复后解析（兜底策略） */
function extractObjects(jsonStr: string): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let objStart = -1;

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;

    if (ch === '[' && depth === 0) { depth = 1; continue; }
    if (ch === '{') {
      if (depth === 1 && objStart === -1) objStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 1 && objStart >= 0) {
        const raw = jsonStr.slice(objStart, i + 1);
        // 先直接解析，失败再修复后重试
        try {
          items.push(JSON.parse(raw));
        } catch {
          try {
            items.push(JSON.parse(jsonrepair(raw)));
          } catch { /* 跳过无法修复的对象 */ }
        }
        objStart = -1;
      }
    }
  }
  return items;
}

/**
 * 将本地服务转为 AIServiceConfig。
 * maxTokens=0 视为未配置，此处给出安全兜底，避免推理模型只输出思考过程。
 */
function localToConfig(svc: LocalService): AIServiceConfig {
  const baseUrl = svc.baseUrl || PROVIDER_BASE_URLS[svc.provider] || '';
  const effectiveMaxTokens = typeof svc.maxTokens === 'number' && svc.maxTokens > 0 ? svc.maxTokens : 4096;
  return {
    baseUrl,
    apiKey: svc.apiKey,
    model: svc.model,
    maxTokens: effectiveMaxTokens,
    temperature: svc.temperature || 0.7,
  };
}

export function AICreateDialog({ config, onBatchCreated, onClose }: AICreateDialogProps) {
  const categories = useResourceStore((s) => s.categories);

  // AI 服务（从本地持久化列表读取）
  const [localServices, setLocalServices] = useState<LocalService[]>([]);
  const [activeServiceId, setActiveServiceId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState('');

  // Step 1: 配置
  const [step, setStep] = useState<Step>('config');
  const [categoryMode, setCategoryMode] = useState<'existing' | 'new'>('existing');
  const [selectedCategoryKey, setSelectedCategoryKey] = useState(categories[0]?.key || '');
  const [newCategoryKey, setNewCategoryKey] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📁');
  const [count, setCount] = useState(10);
  const [userPrompt, setUserPrompt] = useState('');

  // Step 2: 生成
  const [generating, setGenerating] = useState(false);
  const [rawOutput, setRawOutput] = useState('');
  const [editableOutput, setEditableOutput] = useState('');
  const [editingRaw, setEditingRaw] = useState(false);
  const [error, setError] = useState('');
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const statusLogRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const stoppedRef = useRef(false);

  const appendLog = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setStatusLog((prev) => [...prev, `[${ts}] ${msg}`]);
    setTimeout(() => statusLogRef.current?.scrollTo(0, statusLogRef.current.scrollHeight), 50);
  }, []);

  // Step 3: 预览
  const [parsedResources, setParsedResources] = useState<ParsedResource[]>([]);

  // Step 4: 创建进度
  const [createProgress, setCreateProgress] = useState({ current: 0, total: 0, errors: [] as string[] });

  // 加载本地 AI 服务列表
  const loadServices = useCallback(async () => {
    setServicesLoading(true);
    setServicesError('');
    try {
      const data = await invoke<LocalAIServices>('cmd_load_local_ai_services');
      setLocalServices(data.services);
      setActiveServiceId(data.activeServiceId);
      if (data.services.length > 0) {
        const active = data.services.find((s) => s.id === data.activeServiceId) || data.services[0];
        setSelectedServiceId(active.id);
      }
    } catch {
      setServicesError('无法加载 AI 服务列表，请先在「设置」中配置');
    } finally {
      setServicesLoading(false);
    }
  }, []);

  useEffect(() => { loadServices(); }, [loadServices]);

  const getCategoryKey = () => categoryMode === 'existing' ? selectedCategoryKey : newCategoryKey;

  /** 获取当前选中的 AIServiceConfig */
  const getSelectedConfig = useCallback(async (): Promise<AIServiceConfig | null> => {
    const svc = localServices.find((s) => s.id === selectedServiceId);
    if (svc) {
      return localToConfig(svc);
    }
    // 回退到管理器旧配置
    try {
      const old = await loadAIConfig();
      if (old.apiKey) return old;
    } catch { /* ignore */ }
    return null;
  }, [localServices, selectedServiceId]);

  // 构建 system prompt
  const buildSystemPrompt = useCallback(() => {
    const contentFileNames = config.contentFiles.map((f) => f.filename);
    const contentFilesDesc = config.contentFiles
      .map((f) => `"${f.filename}": "${f.label}内容（${f.type}格式）"`)
      .join(', ');

    return `${config.aiGenerate.systemPromptTemplate}

【重要】输出格式要求：
你必须输出一个严格的 JSON 数组，不要包含任何 markdown 代码块标记或其他文字。
数组中每个元素代表一个${config.resourceLabel}，结构如下：
[
  {
    "manifest": {
      "id": "英文标识符（小写，用连字符分隔）",
      "name": "中文名称",
      "description": "中文描述（一句话）",
      "icon": "一个合适的 emoji",
      "version": "1.0.0",
      "author": "AiDocPlus",
      "resourceType": "${config.resourceType}",
      "majorCategory": "${getCategoryKey()}",
      "subCategory": "",
      "tags": ["标签1", "标签2"],
      "order": 0,
      "enabled": true,
      "source": "builtin",
      "roles": [],
      "createdAt": "ISO时间戳",
      "updatedAt": "ISO时间戳"
    },
    "contentFiles": { ${contentFilesDesc} }
  }
]

请生成 ${count} 个${config.resourceLabel}。每个资源的内容文件包括：${contentFileNames.join('、')}。
确保每个资源的 id 唯一且有意义，内容详实完整。
只输出 JSON 数组，不要输出任何其他内容。`;
  }, [config, count, getCategoryKey]);

  // 停止生成
  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
    setGenerating(false);
  }, []);

  // 开始生成
  const handleGenerate = async () => {
    const aiConfig = await getSelectedConfig();
    if (!aiConfig || !aiConfig.apiKey) {
      setError('请先选择一个 AI 服务，或在主程序中配置 AI 服务后刷新');
      return;
    }
    if (!aiConfig.baseUrl) {
      setError('所选 AI 服务缺少 API 地址（baseUrl），请检查配置');
      return;
    }

    // 清理旧的事件监听器，防止重复注册
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    setGenerating(true);
    setRawOutput('');
    setEditableOutput('');
    setEditingRaw(false);
    setError('');
    setStatusLog([]);
    setStep('generate');
    stoppedRef.current = false;

    const svcName = localServices.find((s) => s.id === selectedServiceId)?.name || '本地配置';
    appendLog(`使用服务: ${svcName}，模型: ${aiConfig.model}`);
    appendLog(`请求生成 ${count} 个${config.resourceLabel}...`);
    appendLog(`正在连接 AI API (${aiConfig.baseUrl})...`);
    appendLog(`批量生成需要较长时间，AI 模型正在思考中，请耐心等待首个响应...`);

    try {
      let fullContent = '';
      let firstChunk = true;
      const unlisten = await aiGenerateStream(
        aiConfig,
        buildSystemPrompt(),
        userPrompt,
        (delta) => {
          if (stoppedRef.current) return;
          if (firstChunk) {
            appendLog('收到 AI 响应，正在流式接收数据...');
            firstChunk = false;
          }
          fullContent += delta;
          setRawOutput(fullContent);
        },
        (finalContent) => {
          if (stoppedRef.current) return;
          setRawOutput(finalContent);
          setEditableOutput(finalContent);
          setGenerating(false);
          appendLog(`接收完成，共 ${finalContent.length} 字符。请点击「解析结果」继续。`);
          // 检测 JSON 是否被截断（未以 ] 结尾）
          const trimmed = finalContent.trim();
          const endsWithBracket = trimmed.endsWith(']') || trimmed.endsWith('```');
          if (!endsWithBracket && trimmed.length > 0) {
            appendLog('⚠️ 警告：AI 输出可能被截断（未正常结束），建议减少生成数量或检查 AI 服务的 maxTokens 设置。');
            setError('AI 输出可能被截断，部分资源不完整。可尝试减少生成数量后重新生成，或点击「解析结果」尝试恢复已完成的部分。');
          }
        },
        (errMsg) => {
          if (stoppedRef.current) return;
          setGenerating(false);
          appendLog(`❌ AI 请求失败: ${errMsg}`);
          setError('AI 请求失败: ' + errMsg);
        },
      );
      unlistenRef.current = unlisten;
    } catch (e) {
      const errMsg = String(e);
      appendLog(`生成失败: ${errMsg}`);
      setError('AI 生成失败: ' + errMsg);
      setGenerating(false);
    }
  };

  // 解析 AI 输出
  const tryParse = (text: string) => {
    try {
      let jsonStr = text.trim();

      // 1. 用 jsonrepair 修复整个 JSON（处理截断、缺引号、尾逗号、代码块包裹等）
      let repaired: string;
      try {
        repaired = jsonrepair(jsonStr);
      } catch {
        // jsonrepair 也无法修复时，尝试先提取 JSON 数组部分再修复
        const startIdx = jsonStr.indexOf('[');
        if (startIdx >= 0) {
          jsonStr = jsonStr.slice(startIdx);
        }
        try {
          repaired = jsonrepair(jsonStr);
        } catch {
          repaired = jsonStr;
        }
      }

      let arr: unknown[];
      try {
        arr = JSON.parse(repaired);
      } catch {
        // jsonrepair 修复后仍无法整体解析：逐对象提取 + 逐个修复（兜底）
        const recovered = extractObjects(repaired.length > jsonStr.length ? repaired : jsonStr);
        if (recovered.length > 0) {
          arr = recovered;
          setError(`JSON 整体解析失败，已通过逐对象容错恢复 ${recovered.length} 个资源`);
        } else {
          throw new Error('JSON 格式无效且无法恢复');
        }
      }
      if (!Array.isArray(arr) || arr.length === 0) {
        setError('AI 输出不是有效的 JSON 数组');
        return;
      }

      const parsed: ParsedResource[] = (arr as Record<string, unknown>[]).map((item) => ({
        manifest: (item.manifest || item) as Record<string, unknown>,
        contentFiles: (item.contentFiles || item.content_files || {}) as Record<string, string>,
        selected: true,
        expanded: false,
      }));

      setParsedResources(parsed);
      setError('');
      setStep('preview');
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.error('JSON 解析失败:', errMsg, '\n原始输出前500字符:', text.slice(0, 500));
      setError(`解析 JSON 失败: ${errMsg}。可点击「编辑原始输出」手动修正后重试`);
      setEditableOutput(text);
    }
  };

  // 切换选中
  const toggleSelect = (idx: number) => {
    setParsedResources((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, selected: !r.selected } : r)),
    );
  };

  // 切换展开
  const toggleExpand = (idx: number) => {
    setParsedResources((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, expanded: !r.expanded } : r)),
    );
  };

  // 全选/全不选
  const toggleSelectAll = () => {
    const allSelected = parsedResources.every((r) => r.selected);
    setParsedResources((prev) => prev.map((r) => ({ ...r, selected: !allSelected })));
  };

  // 确认批量创建
  const handleConfirmCreate = async () => {
    const selected = parsedResources.filter((r) => r.selected);
    if (selected.length === 0) return;

    setStep('creating');
    setCreateProgress({ current: 0, total: selected.length, errors: [] });

    const items = selected.map((r) => {
      const manifest = r.manifest;
      const id = (manifest.id as string) || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const category = getCategoryKey();
      manifest.majorCategory = category;

      const contentFiles = config.contentFiles.map((spec) => ({
        filename: spec.filename,
        content: (r.contentFiles[spec.filename] as string) || spec.defaultContent,
      }));

      return { category, id, manifest, contentFiles };
    });

    const newCat = categoryMode === 'new'
      ? { key: newCategoryKey, name: newCategoryName, icon: newCategoryIcon }
      : undefined;

    onBatchCreated(items, newCat);
  };

  const selectedCount = parsedResources.filter((r) => r.selected).length;
  const currentStepIdx = STEPS.findIndex((s) => s.key === step);

  // 配置步骤是否可以开始生成
  const canGenerate = userPrompt.trim()
    && (categoryMode === 'existing' || (newCategoryKey.trim() && newCategoryName.trim()))
    && (localServices.length > 0 || !servicesLoading);

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl h-[80vh] top-[5vh] translate-y-0 overflow-hidden flex flex-col p-0">
        {/* 标题栏 */}
        <DialogHeader className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b space-y-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI 批量新建{config.resourceLabel}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* 步骤指示器（已完成步骤可点击回溯，creating 步骤不可回溯） */}
        <div className="flex items-center gap-0 px-6 py-3 border-b bg-muted/20 shrink-0">
          {STEPS.map((s, i) => {
            const canNavigate = i < currentStepIdx && step !== 'creating';
            return (
              <div key={s.key} className="flex items-center">
                {i > 0 && (
                  <div className={cn('w-8 h-px mx-1', i <= currentStepIdx ? 'bg-primary' : 'bg-border')} />
                )}
                <button
                  type="button"
                  disabled={!canNavigate}
                  onClick={() => canNavigate && setStep(s.key)}
                  className={cn(
                    'flex items-center gap-1.5',
                    canNavigate && 'cursor-pointer hover:opacity-80',
                    !canNavigate && 'cursor-default',
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                    i < currentStepIdx && 'bg-primary text-primary-foreground',
                    i === currentStepIdx && 'bg-primary text-primary-foreground ring-2 ring-primary/30',
                    i > currentStepIdx && 'bg-muted text-muted-foreground',
                  )}>
                    {i < currentStepIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <span className={cn(
                    'text-sm',
                    i === currentStepIdx ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}>
                    {s.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* 内容区 */}
        <div className="p-6 space-y-5 flex-1 min-h-0 overflow-y-auto">

          {/* ===== Step 1: 配置 ===== */}
          <div className="space-y-5" style={{ display: step === 'config' ? undefined : 'none' }}>
              {/* AI 服务选择 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">AI 服务</label>
                  <button
                    onClick={loadServices}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                    title="刷新服务列表"
                  >
                    <RefreshCw className="h-3 w-3" /> 刷新
                  </button>
                </div>
                {servicesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> 加载 AI 服务...
                  </div>
                ) : localServices.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>未找到 AI 服务。请先在工具栏「设置」中导入或添加 AI 服务。</span>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {localServices.map((svc) => (
                      <button
                        key={svc.id}
                        onClick={() => setSelectedServiceId(svc.id)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                          selectedServiceId === svc.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 ring-1 ring-blue-500/30'
                            : 'border-border hover:bg-muted/50',
                        )}
                      >
                        <Zap className={cn('h-4 w-4 shrink-0', selectedServiceId === svc.id ? 'text-blue-500' : 'text-muted-foreground')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{svc.name || svc.model}</span>
                            {svc.id === activeServiceId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 shrink-0">默认</span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {svc.model} · {svc.provider || svc.baseUrl}
                          </div>
                        </div>
                        {selectedServiceId === svc.id && (
                          <Check className="h-4 w-4 text-blue-500 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {servicesError && (
                  <div className="text-sm text-destructive">{servicesError}</div>
                )}
              </div>

              {/* 分类选择 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">目标分类</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      checked={categoryMode === 'existing'}
                      onChange={() => setCategoryMode('existing')}
                    />
                    选择现有分类
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      checked={categoryMode === 'new'}
                      onChange={() => setCategoryMode('new')}
                    />
                    新建分类
                  </label>
                </div>

                {categoryMode === 'existing' ? (
                  <select
                    value={selectedCategoryKey}
                    onChange={(e) => setSelectedCategoryKey(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    {categories.map((c: CategoryDefinition) => (
                      <option key={c.key} value={c.key}>
                        {c.icon || ''} {c.name} ({c.key})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-[1fr_1fr_70px] gap-3">
                    <input
                      value={newCategoryKey}
                      onChange={(e) => setNewCategoryKey(e.target.value)}
                      placeholder="分类 key（英文）"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="分类名称（中文）"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      value={newCategoryIcon}
                      onChange={(e) => setNewCategoryIcon(e.target.value)}
                      placeholder="图标"
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm text-center outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                )}
              </div>

              {/* 生成数量 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">生成数量</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <input
                    type="number"
                    value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                    min={1}
                    max={30}
                    className="w-16 h-9 rounded-md border border-input bg-background px-2 text-sm text-center shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">描述你想要的{config.resourceLabel}</label>
                <textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  rows={5}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring resize-y"
                  placeholder={`例如：请生成关于"学术写作"主题的${config.resourceLabel}，涵盖论文撰写、文献综述、摘要提炼等方向...`}
                />
              </div>

              {error && step === 'config' && (
                <div className="text-sm px-3 py-2 rounded-md bg-destructive/10 text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
          </div>

          {/* ===== Step 2: 生成 ===== */}
          <div className="space-y-5" style={{ display: step === 'generate' ? undefined : 'none' }}>
              {/* 状态日志区 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    {generating && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {generating ? '生成状态' : <span className="text-green-600">生成完成</span>}
                  </label>
                  {generating && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStop}
                      className="h-7 border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <Square className="h-3 w-3" /> 停止
                    </Button>
                  )}
                </div>
                <div
                  ref={statusLogRef}
                  className="w-full h-[120px] overflow-y-auto rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono leading-relaxed"
                >
                  {statusLog.length > 0 ? (
                    statusLog.map((line, i) => (
                      <div key={i} className="text-muted-foreground">{line}</div>
                    ))
                  ) : (
                    <span className="text-muted-foreground">等待状态信息...</span>
                  )}
                </div>
              </div>

              {/* AI 原始输出 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">AI 输出</label>
                {editingRaw ? (
                  <textarea
                    value={editableOutput}
                    onChange={(e) => setEditableOutput(e.target.value)}
                    className="w-full h-[280px] rounded-md border border-input bg-background px-3 py-2 text-xs font-mono shadow-sm outline-none focus:ring-1 focus:ring-ring resize-y"
                  />
                ) : (
                  <pre className="w-full max-h-[280px] overflow-y-auto rounded-md border border-input bg-muted/20 px-4 py-3 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                    {rawOutput || <span className="text-muted-foreground">等待 AI 响应...</span>}
                  </pre>
                )}
              </div>

              {error && (
                <div className="text-sm px-3 py-2.5 rounded-md bg-destructive/10 text-destructive flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="truncate">{error}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 border-destructive/20 hover:bg-destructive/10"
                      onClick={() => setEditingRaw(!editingRaw)}
                    >
                      {editingRaw ? '查看原始' : '编辑原始输出'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 bg-destructive/10 hover:bg-destructive/20"
                      onClick={() => tryParse(editingRaw ? editableOutput : rawOutput)}
                    >
                      <RotateCcw className="h-3 w-3" /> 重试解析
                    </Button>
                  </div>
                </div>
              )}
          </div>

          {/* ===== Step 3: 预览 ===== */}
          <div className="space-y-5" style={{ display: step === 'preview' ? undefined : 'none' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  共 <span className="font-medium text-foreground">{parsedResources.length}</span> 个，
                  已选 <span className="font-medium text-primary">{selectedCount}</span> 个
                </span>
                <button onClick={toggleSelectAll} className="text-sm text-primary hover:underline font-medium">
                  {parsedResources.every((r) => r.selected) ? '全不选' : '全选'}
                </button>
              </div>

              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {parsedResources.map((res, idx) => {
                  const m = res.manifest;
                  const tags = (m.tags as string[]) || [];
                  return (
                    <div key={idx} className={cn(
                      'border rounded-lg transition-colors',
                      res.selected ? 'border-primary/30 bg-primary/[0.02]' : 'border-border opacity-60',
                    )}>
                      <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => toggleExpand(idx)}
                      >
                        <input
                          type="checkbox"
                          checked={res.selected}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(idx); }}
                          className="shrink-0 w-4 h-4 accent-primary"
                        />
                        <button onClick={(e) => { e.stopPropagation(); toggleExpand(idx); }} className="shrink-0">
                          {res.expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                        <span className="text-lg shrink-0">{(m.icon as string) || '📄'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{(m.name as string) || '未命名'}</div>
                          <div className="text-xs text-muted-foreground truncate mt-0.5">{(m.description as string) || ''}</div>
                          {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tags.slice(0, 4).map((tag, ti) => (
                                <span key={ti} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{tag}</span>
                              ))}
                              {tags.length > 4 && <span className="text-[10px] text-muted-foreground">+{tags.length - 4}</span>}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 font-mono">{(m.id as string) || ''}</span>
                      </div>
                      {res.expanded && (
                        <div className="px-4 pb-4 space-y-3 border-t bg-muted/20">
                          <div className="grid grid-cols-2 gap-3 pt-3">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">ID</label>
                              <input
                                value={(m.id as string) || ''}
                                onChange={(e) => {
                                  setParsedResources((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, manifest: { ...r.manifest, id: e.target.value } } : r,
                                    ),
                                  );
                                }}
                                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring font-mono"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">名称</label>
                              <input
                                value={(m.name as string) || ''}
                                onChange={(e) => {
                                  setParsedResources((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, manifest: { ...r.manifest, name: e.target.value } } : r,
                                    ),
                                  );
                                }}
                                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                          </div>
                          {config.contentFiles.map((spec) => (
                            <div key={spec.filename} className="space-y-1.5">
                              <label className="text-xs font-medium text-muted-foreground">{spec.label} ({spec.filename})</label>
                              <textarea
                                value={res.contentFiles[spec.filename] || ''}
                                onChange={(e) => {
                                  setParsedResources((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? { ...r, contentFiles: { ...r.contentFiles, [spec.filename]: e.target.value } }
                                        : r,
                                    ),
                                  );
                                }}
                                rows={4}
                                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono shadow-sm resize-y outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
          </div>

          {/* ===== Step 4: 创建中 ===== */}
          <div style={{ display: step === 'creating' ? undefined : 'none' }}>
            <div className="space-y-5 py-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div>
                  <div className="text-sm font-medium">正在创建资源...</div>
                  <div className="text-xs text-muted-foreground">{createProgress.current}/{createProgress.total}</div>
                </div>
              </div>
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${createProgress.total > 0 ? (createProgress.current / createProgress.total) * 100 : 0}%` }}
                />
              </div>
              {createProgress.errors.length > 0 && (
                <div className="text-sm text-destructive space-y-1 bg-destructive/5 rounded-lg p-3">
                  {createProgress.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 通用错误（非 config/generate 步骤） */}
          {error && step !== 'generate' && step !== 'config' && (
            <div className="text-sm px-3 py-2 rounded-md bg-destructive/10 text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-between px-6 py-4 border-t shrink-0">
          <div>
            {step === 'preview' && (
              <Button
                variant="outline"
                onClick={() => setStep('generate')}
              >
                <RotateCcw className="h-3.5 w-3.5" /> 返回生成
              </Button>
            )}
            {step === 'generate' && !generating && (
              <Button
                variant="outline"
                onClick={() => setStep('config')}
              >
                返回配置
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {step === 'creating' ? '关闭' : '取消'}
            </Button>

            {step === 'config' && (
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
              >
                <Sparkles className="h-4 w-4" /> 开始生成
              </Button>
            )}

            {step === 'generate' && !generating && rawOutput && (
              <Button
                onClick={() => tryParse(editingRaw ? editableOutput : rawOutput)}
              >
                <Check className="h-4 w-4" /> 解析结果
              </Button>
            )}

            {step === 'preview' && (
              <Button
                onClick={handleConfirmCreate}
                disabled={selectedCount === 0}
              >
                <Plus className="h-4 w-4" /> 创建 {selectedCount} 个{config.resourceLabel}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
