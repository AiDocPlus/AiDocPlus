import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '@/i18n';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useTranslation();
  const handleOpenUrl = (url: string) => {
    invoke('plugin:shell|open', { path: url }).catch(console.error);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle>{t('settings.about.title', { defaultValue: '关于 AiDocPlus' })}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="text-2xl font-bold">AiDocPlus</div>
          <div className="text-sm text-muted-foreground">{t('settings.about.description', { defaultValue: 'AI 智能文档编辑器' })}</div>
          <div className="text-sm text-muted-foreground">{t('settings.about.version', { defaultValue: '版本' })} 0.1.0</div>
          <button
            onClick={() => handleOpenUrl('https://AiDocPlus.com')}
            className="text-sm text-blue-500 hover:text-blue-600 hover:underline cursor-pointer focus:outline-none"
          >
            https://AiDocPlus.com
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
