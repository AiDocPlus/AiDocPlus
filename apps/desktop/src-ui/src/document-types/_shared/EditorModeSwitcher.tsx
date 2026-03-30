/**
 * MD ↔ HTML 编辑器模式切换组件
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Code2, AlignLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { EditorMode } from '../imitative-writing/types';

interface EditorModeSwitcherProps {
  mode: EditorMode;
  onModeChange: (newMode: EditorMode, convertedContent?: string) => void;
  currentContent: string;
  convertToHtml: (md: string) => string;
  convertToMarkdown: (html: string) => string;
  className?: string;
}

export function EditorModeSwitcher({
  mode,
  onModeChange,
  currentContent,
  convertToHtml,
  convertToMarkdown,
  className,
}: EditorModeSwitcherProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<EditorMode | null>(null);

  const handleSwitch = (newMode: EditorMode) => {
    if (newMode === mode) return;
    if (currentContent.trim()) {
      setPendingMode(newMode);
      setConfirmOpen(true);
    } else {
      onModeChange(newMode);
    }
  };

  const confirmSwitch = () => {
    if (!pendingMode) return;
    let converted = currentContent;
    if (mode === 'markdown' && pendingMode === 'html') {
      converted = convertToHtml(currentContent);
    } else if (mode === 'html' && pendingMode === 'markdown') {
      converted = convertToMarkdown(currentContent);
    }
    onModeChange(pendingMode, converted);
    setConfirmOpen(false);
    setPendingMode(null);
  };

  return (
    <>
      <div className={`flex items-center gap-0.5 ${className || ''}`}>
        <Button
          variant={mode === 'markdown' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 px-1.5 text-[10px] gap-1"
          onClick={() => handleSwitch('markdown')}
          title={t('imitativeWriting.editor.markdownMode', { defaultValue: 'Markdown 编辑器' })}
        >
          <AlignLeft className="h-3 w-3" />
          MD
        </Button>
        <Button
          variant={mode === 'html' ? 'secondary' : 'ghost'}
          size="sm"
          className="h-6 px-1.5 text-[10px] gap-1"
          onClick={() => handleSwitch('html')}
          title={t('imitativeWriting.editor.htmlMode', { defaultValue: 'HTML 富文本编辑器' })}
        >
          <Code2 className="h-3 w-3" />
          HTML
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[380px]" style={{ fontFamily: '宋体', fontSize: '16px' }}>
          <DialogHeader>
            <DialogTitle>
              {t('imitativeWriting.editor.switchTitle', { defaultValue: '切换编辑器模式' })}
            </DialogTitle>
            <DialogDescription>
              {t('imitativeWriting.editor.switchWarning', {
                defaultValue: '格式转换可能丢失部分排版细节，是否继续？',
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel', { defaultValue: '取消' })}
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={confirmSwitch}>
              {t('imitativeWriting.editor.switchConfirm', { defaultValue: '确认切换' })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
