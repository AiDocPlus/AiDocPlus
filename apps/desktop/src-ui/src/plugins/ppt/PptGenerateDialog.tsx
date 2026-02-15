import { useState, useEffect, useCallback } from 'react';
import { Settings2 } from 'lucide-react';
import { getAllPptTemplates } from './slideAiPrompts';
import type { PptPromptTemplate } from './slideAiPrompts';
import { PptTemplateManager } from './PptTemplateManager';
import { Button, Label, Input, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';

interface PptGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPrompt: string;
  documentTitle: string;
  aiContent: string;
  onGenerate: (prompt: string) => void;
}

export function PptGenerateDialog({
  open,
  onOpenChange,
  defaultPrompt,
  documentTitle,
  aiContent,
  onGenerate,
}: PptGenerateDialogProps) {
  const host = usePluginHost();
  const t = host.platform.t;
  const [prompt, setPrompt] = useState('');
  const [slideCountStr, setSlideCountStr] = useState('10');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<PptPromptTemplate[]>([]);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);

  const refreshTemplates = useCallback(() => {
    setTemplates(getAllPptTemplates());
  }, []);

  // 打开时初始化提示词和模板列表
  useEffect(() => {
    if (open) {
      refreshTemplates();
      if (defaultPrompt) {
        setPrompt(defaultPrompt);
      } else {
        const autoPrompt = buildDefaultPrompt(documentTitle, aiContent);
        setPrompt(autoPrompt);
      }
      setSelectedTemplate(null);
    }
  }, [open, defaultPrompt, documentTitle, aiContent, refreshTemplates]);

  const handleTemplateClick = (templateId: string) => {
    const tpl = templates.find(t => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplate(templateId);
    const count = tpl.suggestedSlideCount || 10;
    setSlideCountStr(String(count));
    // 如果模板有自定义提示词内容，使用它（替换占位符），否则自动生成
    let tplPrompt: string;
    if (tpl.promptTemplate) {
      tplPrompt = tpl.promptTemplate
        .replace(/\{topic\}/g, documentTitle || tpl.defaultTopic)
        .replace(/\{content\}/g, aiContent)
        .replace(/\{slideCount\}/g, String(count));
    } else {
      tplPrompt = `根据本文档的正文内容，以「${tpl.name}」的风格生成约 ${count} 页 PPT 幻灯片。\n\n场景说明：${tpl.description}`;
    }
    setPrompt(tplPrompt);
  };

  // 页数变更时，更新提示词中的页数
  const handleSlideCountChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setSlideCountStr(cleaned);
    // 如果提示词中包含页数描述，替换它
    if (cleaned && parseInt(cleaned, 10) > 0) {
      setPrompt(prev => prev.replace(/约 \d+ 页/g, `约 ${cleaned} 页`));
    }
  };

  const handleConfirm = () => {
    if (!prompt.trim()) return;
    onGenerate(prompt);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('slides.promptBuilderTitle', { defaultValue: '提示词构造器' })}</DialogTitle>
          <DialogDescription>
            {t('slides.promptBuilderDesc', { defaultValue: '选择模板并编辑提示词，确认后将填充到提示词框中。' })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* 模板选择 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">{t('slides.promptTemplate', { defaultValue: '提示词模板' })}</Label>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setTemplateManagerOpen(true)}
              >
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                {t('slides.templateManage', { defaultValue: '管理模板' })}
              </Button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {templates.map((tpl) => (
                <Button
                  key={tpl.id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTemplateClick(tpl.id)}
                  className={`h-7 px-3 text-xs ${
                    selectedTemplate === tpl.id
                      ? 'border-primary bg-primary/10 font-medium'
                      : tpl.builtin
                        ? ''
                        : 'border-dashed border-primary/40'
                  }`}
                  title={tpl.description}
                >
                  {tpl.name}
                </Button>
              ))}
            </div>
          </div>

          {/* 提示词编辑 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('slides.promptLabel', { defaultValue: 'PPT 提示词' })}</Label>
            <textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setSelectedTemplate(null);
              }}
              placeholder={t('slides.promptPlaceholder', { defaultValue: '描述你想要生成的 PPT 内容...' })}
              className="w-full min-h-[300px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ fontFamily: '宋体, system-ui, sans-serif', fontSize: 16 }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
            />
          </div>

          {/* 页数设置 */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('slides.slideCountLabel', { defaultValue: '建议页数' })}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={slideCountStr}
                onChange={(e) => handleSlideCountChange(e.target.value)}
                className="w-20 h-8 text-sm"
                style={{ fontFamily: '宋体', fontSize: '16px' }}
              />
              <span className="text-xs text-muted-foreground">
                {t('slides.slideCountHint', { defaultValue: '页（建议 8-15 页）' })}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button variant="outline" onClick={handleConfirm} disabled={!prompt.trim()}>
            {t('slides.confirmPrompt', { defaultValue: '确认提示词' })}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 模板管理器 */}
      <PptTemplateManager
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
        onTemplatesChanged={refreshTemplates}
      />
    </Dialog>
  );
}

function buildDefaultPrompt(title: string, _aiContent: string): string {
  const topic = title || '演示文稿';
  return `根据本文档的正文内容，生成主题为「${topic}」的 PPT 幻灯片，约 10 页。`;
}
