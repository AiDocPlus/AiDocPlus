import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export interface PluginPromptBuilderDialogProps {
  /** 弹窗是否打开 */
  open: boolean;
  /** 打开/关闭回调 */
  onOpenChange: (open: boolean) => void;
  /** 弹窗描述（可选） */
  description?: string;
  /** 确认回调，传回组装好的提示词 */
  onConfirm: (prompt: string) => void;
  /** 实时预览的提示词 */
  previewPrompt: string;
  /** 插件自定义的选择/设置/输入控件 */
  children: React.ReactNode;
}

/**
 * 插件提示词构建弹窗 — 通用壳
 *
 * 提供统一的弹窗结构：标题 + 插件自定义内容 + 提示词预览 + 取消/确认按钮。
 * 各插件只需传入自定义控件和提示词组装逻辑。
 */
export function PluginPromptBuilderDialog({
  open,
  onOpenChange,
  description,
  onConfirm,
  previewPrompt,
  children,
}: PluginPromptBuilderDialogProps) {
  const { t } = useTranslation('plugin-framework');

  const handleConfirm = () => {
    onConfirm(previewPrompt);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('promptBuilder')}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* 插件自定义控件 */}
          {children}

          {/* 提示词预览 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t('promptPreview')}</label>
            <div
              className="w-full min-h-[80px] max-h-[200px] overflow-y-auto px-3 py-2 text-sm border rounded-md bg-muted/30 whitespace-pre-wrap"
              style={{ fontFamily: '宋体', fontSize: '16px' }}
            >
              {previewPrompt || <span className="text-muted-foreground italic">{t('promptPreviewEmpty')}</span>}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button variant="outline" onClick={handleConfirm} disabled={!previewPrompt.trim()}>
            {t('confirmPrompt')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
