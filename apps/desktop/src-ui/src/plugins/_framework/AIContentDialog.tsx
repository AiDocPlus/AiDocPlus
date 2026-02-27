import { useState, useCallback } from 'react';
import { Wand2, Loader2, Check, X } from 'lucide-react';
import { usePluginHost } from './PluginHostAPI';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui';
import { useTranslation } from '@/i18n';

export interface AIContentDialogProps {
  /** 弹窗是否打开 */
  open: boolean;
  /** 打开状态变更 */
  onOpenChange: (open: boolean) => void;
  /** 弹窗标题 */
  title?: string;
  /** 弹窗描述 */
  description?: string;
  /** 系统提示词 */
  systemPrompt: string;
  /** 参考内容（如文档正文，自动截断） */
  referenceContent?: string;
  /** 生成成功回调 */
  onGenerated: (content: string) => void;
  /** 预设提示词选项 */
  presetPrompts?: Array<{ label: string; prompt: string }>;
  /** 默认提示词 */
  defaultPrompt?: string;
  /** 最大 token 数 */
  maxTokens?: number;
}

/**
 * 通用 AI 内容生成弹窗
 * 功能执行类插件可在任意位置放置 AI 按钮，点击打开此弹窗
 */
export function AIContentDialog({
  open,
  onOpenChange,
  title,
  description,
  systemPrompt,
  referenceContent,
  onGenerated,
  presetPrompts,
  defaultPrompt = '',
  maxTokens = 4096,
}: AIContentDialogProps) {
  const { t } = useTranslation('plugin-framework');
  const host = usePluginHost();

  const [prompt, setPrompt] = useState(defaultPrompt);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handlePresetChange = useCallback((value: string) => {
    setSelectedPreset(value);
    const preset = presetPrompts?.find(p => p.label === value);
    if (preset) {
      setPrompt(preset.prompt);
    }
  }, [presetPrompts]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;

    setGenerating(true);
    setError('');
    setResult('');

    try {
      const refContent = referenceContent
        ? host.ai.truncateContent(referenceContent)
        : '';

      const userContent = refContent
        ? `${prompt.trim()}\n\n---\n参考内容如下：\n${refContent}`
        : prompt.trim();

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ];

      const generated = await host.ai.chat(messages, { maxTokens });
      setResult(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [prompt, referenceContent, systemPrompt, maxTokens, host.ai]);

  const handleConfirm = useCallback(() => {
    if (result.trim()) {
      onGenerated(result);
    }
    // 重置状态
    setResult('');
    setError('');
    onOpenChange(false);
  }, [result, onGenerated, onOpenChange]);

  const handleCancel = useCallback(() => {
    setResult('');
    setError('');
    setGenerating(false);
    onOpenChange(false);
  }, [onOpenChange]);

  // 弹窗打开时重置
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen) {
      setPrompt(defaultPrompt);
      setSelectedPreset('');
      setResult('');
      setError('');
    }
    onOpenChange(isOpen);
  }, [defaultPrompt, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {title || t('aiGenDialog', { defaultValue: 'AI 内容生成' })}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-3 overflow-y-auto py-2">
          {/* 预设选择 */}
          {presetPrompts && presetPrompts.length > 0 && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {t('aiPreset', { defaultValue: '预设风格' })}
              </label>
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('aiPresetPlaceholder', { defaultValue: '选择预设风格...' })} />
                </SelectTrigger>
                <SelectContent>
                  {presetPrompts.map(p => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 提示词输入 */}
          <div className="space-y-1">
            <label className="text-sm font-medium">
              {t('aiPrompt', { defaultValue: '提示词' })}
            </label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={t('aiPromptPlaceholder', { defaultValue: '描述你想要生成的内容...' })}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* 生成按钮 */}
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim() || !host.ai.isAvailable()}
            className="w-full gap-2"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t('aiGenerating', { defaultValue: '生成中...' })}</>
            ) : (
              <><Wand2 className="h-4 w-4" />{t('aiGenerate', { defaultValue: 'AI 生成' })}</>
            )}
          </Button>

          {/* 错误提示 */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-md p-2">
              {error}
            </div>
          )}

          {/* 生成结果预览/编辑 */}
          {result && (
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {t('aiResult', { defaultValue: '生成结果' })}
              </label>
              <Textarea
                value={result}
                onChange={e => setResult(e.target.value)}
                rows={8}
                className="resize-none font-mono text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} className="gap-1">
            <X className="h-4 w-4" />
            {t('cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            variant="outline"
            onClick={handleConfirm}
            disabled={!result.trim()}
            className="gap-1"
          >
            <Check className="h-4 w-4" />
            {t('confirmInsert', { defaultValue: '确认插入' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
