import { useEffect, useRef, useState, useCallback } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';
import { useTranslation } from '@/i18n';
import { Download, RefreshCw, CheckCircle2, AlertCircle, X } from 'lucide-react';

type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date';

export function UpdateChecker() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [currentVersion, setCurrentVersion] = useState('');
  const [newVersion, setNewVersion] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [showBanner, setShowBanner] = useState(false);
  const checkedRef = useRef(false);

  const checkForUpdate = useCallback(async (silent = false) => {
    try {
      setStatus('checking');
      setErrorMsg('');
      const update: Update | null = await check();
      if (update) {
        setNewVersion(update.version);
        setReleaseNotes(update.body || '');
        setStatus('available');
        setShowBanner(true);
      } else {
        setStatus('up-to-date');
        if (!silent) {
          setShowBanner(true);
        }
      }
    } catch (err: any) {
      console.error('[UpdateChecker] check failed:', err);
      setStatus('error');
      setErrorMsg(String(err));
      if (!silent) {
        setShowBanner(true);
      }
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    try {
      setStatus('downloading');
      setProgress(0);
      const update = await check();
      if (!update) return;

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            setProgress(100);
            break;
        }
      });

      setStatus('ready');
    } catch (err: any) {
      console.error('[UpdateChecker] download failed:', err);
      setStatus('error');
      setErrorMsg(String(err));
    }
  }, []);

  const handleRelaunch = useCallback(async () => {
    await relaunch();
  }, []);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    getVersion().then(setCurrentVersion).catch(() => setCurrentVersion('0.3.0'));

    const timer = setTimeout(() => {
      checkForUpdate(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [checkForUpdate]);

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {status === 'available' && <Download className="w-5 h-5 text-primary shrink-0" />}
            {status === 'downloading' && <RefreshCw className="w-5 h-5 text-primary shrink-0 animate-spin" />}
            {status === 'ready' && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
            {status === 'up-to-date' && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
            {status === 'error' && <AlertCircle className="w-5 h-5 text-destructive shrink-0" />}
            <span className="text-sm font-medium">
              {status === 'available' && t('update.newVersionAvailable', { defaultValue: '发现新版本' })}
              {status === 'downloading' && t('update.downloading', { defaultValue: '正在下载更新...' })}
              {status === 'ready' && t('update.readyToRestart', { defaultValue: '更新已就绪' })}
              {status === 'up-to-date' && t('update.upToDate', { defaultValue: '已是最新版本' })}
              {status === 'error' && t('update.checkFailed', { defaultValue: '检查更新失败' })}
            </span>
          </div>
          <button
            title="关闭"
            onClick={() => setShowBanner(false)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === 'available' && (
          <>
            <p className="text-xs text-muted-foreground">
              {currentVersion} → {newVersion}
            </p>
            {releaseNotes && (
              <p className="text-xs text-muted-foreground line-clamp-3">{releaseNotes}</p>
            )}
            <button
              onClick={downloadAndInstall}
              className="w-full text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90"
            >
              {t('update.downloadAndInstall', { defaultValue: '下载并安装' })}
            </button>
          </>
        )}

        {status === 'downloading' && (
          <div className="space-y-1">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{progress}%</p>
          </div>
        )}

        {status === 'ready' && (
          <>
            <p className="text-xs text-muted-foreground">
              {t('update.restartToApply', { defaultValue: '重启应用以完成更新' })}
            </p>
            <button
              onClick={handleRelaunch}
              className="w-full text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:bg-primary/90"
            >
              {t('update.restartNow', { defaultValue: '立即重启' })}
            </button>
          </>
        )}

        {status === 'up-to-date' && (
          <p className="text-xs text-muted-foreground">
            {t('update.currentVersion', { defaultValue: '当前版本' })}: v{currentVersion}
          </p>
        )}

        {status === 'error' && (
          <p className="text-xs text-destructive line-clamp-2">{errorMsg}</p>
        )}
      </div>
    </div>
  );
}

export function useUpdateChecker() {
  const [checking, setChecking] = useState(false);

  const manualCheck = useCallback(async () => {
    setChecking(true);
    try {
      const update = await check();
      return update;
    } finally {
      setChecking(false);
    }
  }, []);

  return { checking, manualCheck };
}
