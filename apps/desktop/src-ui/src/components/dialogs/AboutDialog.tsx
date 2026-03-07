import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { useTranslation } from '@/i18n';
import { Globe, Github, FileText, ExternalLink } from 'lucide-react';
import pkgJson from '../../../../package.json';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (open) {
      getVersion().then(v => setVersion(v || pkgJson.version)).catch(() => setVersion(pkgJson.version));
    }
  }, [open]);

  const handleOpenUrl = (url: string) => {
    invoke('open_file_with_app', { path: url, appName: null }).catch(console.error);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t('settings.about.title', { defaultValue: '关于 AiDocPlus' })}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="text-3xl font-bold tracking-tight">AiDocPlus</div>
          <div className="text-sm text-muted-foreground">
            {t('settings.about.description', { defaultValue: 'AI 驱动的智能文档创作工具' })}
          </div>
          <div className="text-sm font-medium text-muted-foreground">
            v{version}
          </div>

          <div className="w-full space-y-2 pt-2">
            <button
              onClick={() => handleOpenUrl('https://AiDocPlus.com')}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer focus:outline-none"
            >
              <Globe className="h-4 w-4 text-blue-500" />
              <span>{t('settings.about.website', { defaultValue: '官方网站' })}</span>
              <span className="text-blue-500">AiDocPlus.com</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => handleOpenUrl('https://AiDocPlus.com/docs')}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer focus:outline-none"
            >
              <FileText className="h-4 w-4 text-green-500" />
              <span>{t('settings.about.docs', { defaultValue: '使用文档' })}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => handleOpenUrl('https://github.com/AiDocPlus/AiDocPlus')}
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-md text-sm hover:bg-accent transition-colors cursor-pointer focus:outline-none"
            >
              <Github className="h-4 w-4" />
              <span>{t('settings.about.github', { defaultValue: 'GitHub 仓库' })}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>

          <div className="w-full pt-3 border-t text-xs text-muted-foreground space-y-1">
            <p>{t('settings.about.license', { defaultValue: '许可证' })}: MIT</p>
            <p>© 2026 AiDocPlus. All rights reserved.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
