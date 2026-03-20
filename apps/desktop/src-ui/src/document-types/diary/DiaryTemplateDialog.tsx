/**
 * DiaryTemplateDialog — 模板选择/预览弹窗
 *
 * 左侧：内置模板 + 自定义模板列表
 * 右侧：模板预览
 * 应用方式：覆盖当前 / 追加到末尾
 */
import { useState, useMemo } from 'react';
import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n';
import type { DiaryTemplate } from './types';
import { BUILTIN_TEMPLATES, getAllTemplates } from './diaryTemplates';

const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };

interface DiaryTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customTemplates: DiaryTemplate[];
  onApply: (content: string, mode: 'replace' | 'append') => void;
}

export default function DiaryTemplateDialog({
  open, onOpenChange, customTemplates, onApply,
}: DiaryTemplateDialogProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string>(BUILTIN_TEMPLATES[0]?.id || '');

  const allTemplates = useMemo(() => getAllTemplates(customTemplates), [customTemplates]);
  const selected = allTemplates.find(tpl => tpl.id === selectedId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!top-[10vh] !translate-y-0 w-[65vw] h-[60vh] max-w-[800px] max-h-[60vh] flex flex-col p-0 gap-0 bg-card overflow-hidden"
        style={DIALOG_STYLE}
      >
        <DialogTitle className="sr-only">{t('diary.selectTemplate', { defaultValue: '选择模板' })}</DialogTitle>

        <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0">
          <FileText className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">{t('diary.selectTemplate', { defaultValue: '选择日记模板' })}</span>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧：模板列表 */}
          <div className="w-[200px] flex-shrink-0 border-r overflow-auto p-2 space-y-0.5">
            <div className="text-xs text-muted-foreground font-medium px-2 py-1">{t('diary.builtinTemplates', { defaultValue: '内置模板' })}</div>
            {BUILTIN_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-sm text-left transition-colors ${selectedId === tpl.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground'}`}
                onClick={() => setSelectedId(tpl.id)}
              >
                <span className="text-base">{tpl.icon}</span>
                <div>
                  <div>{tpl.name}</div>
                  {tpl.description && <div className="text-xs text-muted-foreground">{tpl.description}</div>}
                </div>
              </button>
            ))}

            {customTemplates.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground font-medium px-2 py-1 mt-2">{t('diary.customTemplatesLabel', { defaultValue: '自定义模板' })}</div>
                {customTemplates.map(tpl => (
                  <button
                    key={tpl.id}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-sm text-left transition-colors ${selectedId === tpl.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground'}`}
                    onClick={() => setSelectedId(tpl.id)}
                  >
                    <span className="text-base">{tpl.icon}</span>
                    <span>{tpl.name}</span>
                  </button>
                ))}
              </>
            )}
          </div>

          {/* 右侧：预览 + 操作 */}
          <div className="flex-1 flex flex-col min-w-0 p-4">
            {selected ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{selected.icon}</span>
                  <div>
                    <div className="text-base font-medium">{selected.name}</div>
                    {selected.description && <div className="text-xs text-muted-foreground">{selected.description}</div>}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-auto border rounded p-3 bg-background">
                  <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-foreground/80">
                    {selected.content || t('diary.emptyTemplate', { defaultValue: '（空白模板，自由书写）' })}
                  </pre>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button variant="default" className="gap-1" onClick={() => { onApply(selected.content, 'replace'); onOpenChange(false); }}>
                    <Plus className="h-3.5 w-3.5" />
                    {t('diary.applyReplace', { defaultValue: '使用模板（覆盖）' })}
                  </Button>
                  <Button variant="outline" className="gap-1" onClick={() => { onApply(selected.content, 'append'); onOpenChange(false); }}>
                    <Plus className="h-3.5 w-3.5" />
                    {t('diary.applyAppend', { defaultValue: '追加到末尾' })}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                {t('diary.selectATemplate', { defaultValue: '请选择一个模板' })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
