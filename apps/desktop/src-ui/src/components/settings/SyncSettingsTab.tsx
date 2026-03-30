/**
 * SyncSettingsTab.tsx — 云同步设置面板
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SyncConfig {
  provider: 'ICloudDrive' | 'WebDAV';
  icloudFolder?: string;
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
  webdavRemoteDir?: string;
  scope: {
    syncDocuments: boolean;
    syncSettings: boolean;
    syncTemplates: boolean;
    syncPluginData: boolean;
    syncCodingScripts: boolean;
  };
  autoSyncIntervalSecs: number;
}

interface SyncStatus {
  configured: boolean;
  phase: string;
  lastSyncTime?: string;
  lastSyncFiles: number;
  conflictCount: number;
  error?: string;
}

interface SyncResult {
  uploaded: number;
  downloaded: number;
  skipped: number;
  conflicts: number;
  errors: number;
  elapsedMs: number;
}

const defaultScope = {
  syncDocuments: true,
  syncSettings: true,
  syncTemplates: true,
  syncPluginData: true,
  syncCodingScripts: false,
};

export function SyncSettingsTab() {
  const { t } = useTranslation();
  const [provider, setProvider] = useState<'ICloudDrive' | 'WebDAV'>('ICloudDrive');
  const [icloudFolder, setIcloudFolder] = useState(
    '~/Library/Mobile Documents/com~apple~CloudDocs/AiDocPlus'
  );
  const [webdavUrl, setWebdavUrl] = useState('https://dav.jianguoyun.com/dav/');
  const [webdavUsername, setWebdavUsername] = useState('');
  const [webdavPassword, setWebdavPassword] = useState('');
  const [webdavRemoteDir, setWebdavRemoteDir] = useState('AiDocPlus');
  const [scope, setScope] = useState(defaultScope);
  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(300);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  // 加载已保存的配置
  useEffect(() => {
    loadConfig();
    loadStatus();

    const unlisten = listen<{ phase: string; conflicts?: number }>('sync:status-change', (event) => {
      if (event.payload.phase === 'scanning') {
        setStatus((prev) => prev ? { ...prev, phase: 'scanning' } : prev);
      } else if (event.payload.phase === 'done' || event.payload.phase === 'resolvingConflicts') {
        loadStatus();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadConfig = async () => {
    try {
      const config = await invoke<SyncConfig | null>('load_sync_config');
      if (config) {
        setProvider(config.provider);
        if (config.icloudFolder) setIcloudFolder(config.icloudFolder);
        if (config.webdavUrl) setWebdavUrl(config.webdavUrl);
        if (config.webdavUsername) setWebdavUsername(config.webdavUsername);
        if (config.webdavPassword) setWebdavPassword(config.webdavPassword);
        if (config.webdavRemoteDir) setWebdavRemoteDir(config.webdavRemoteDir);
        if (config.scope) setScope(config.scope);
        setAutoSync(config.autoSyncIntervalSecs > 0);
        setSyncInterval(config.autoSyncIntervalSecs || 300);
        setHasChanges(false);
      }
    } catch (e) {
      console.error('加载同步配置失败:', e);
    }
  };

  const loadStatus = async () => {
    try {
      const s = await invoke<SyncStatus>('get_sync_status');
      setStatus(s);
    } catch {
      // ignore
    }
  };

  const buildConfig = (): SyncConfig => ({
    provider,
    icloudFolder: provider === 'ICloudDrive' ? icloudFolder : undefined,
    webdavUrl: provider === 'WebDAV' ? webdavUrl : undefined,
    webdavUsername: provider === 'WebDAV' ? webdavUsername : undefined,
    webdavPassword: provider === 'WebDAV' ? webdavPassword : undefined,
    webdavRemoteDir: provider === 'WebDAV' ? webdavRemoteDir : undefined,
    scope,
    autoSyncIntervalSecs: autoSync ? syncInterval : 0,
  });

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setErrorMsg('');
    try {
      await invoke<boolean>('test_sync_connection', { config: buildConfig() });
      setTestResult('success');
    } catch (e) {
      setTestResult('error');
      setErrorMsg(String(e));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setErrorMsg('');
    try {
      await invoke('configure_sync', { config: buildConfig() });
      setHasChanges(false);
      loadStatus();
    } catch (e) {
      setErrorMsg(String(e));
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setErrorMsg('');
    try {
      const result = await invoke<SyncResult>('sync_now');
      if (result.conflicts > 0) {
        setErrorMsg(
          t('sync.conflictWarning', {
            defaultValue: `检测到 ${result.conflicts} 个文件冲突，请手动检查`,
            count: result.conflicts,
          })
        );
      }
      loadStatus();
    } catch (e) {
      setErrorMsg(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const phaseLabel = (phase: string) => {
    const map: Record<string, string> = {
      idle: t('sync.phaseIdle', { defaultValue: '空闲' }),
      scanning: t('sync.phaseScanning', { defaultValue: '扫描中...' }),
      uploading: t('sync.phaseUploading', { defaultValue: '上传中...' }),
      downloading: t('sync.phaseDownloading', { defaultValue: '下载中...' }),
      done: t('sync.phaseDone', { defaultValue: '完成' }),
      error: t('sync.phaseError', { defaultValue: '错误' }),
    };
    return map[phase] || phase;
  };

  const markChanged = () => setHasChanges(true);

  return (
    <div className="space-y-6">
      {/* 同步服务选择 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t('sync.provider', { defaultValue: '同步服务' })}
        </Label>
        <Select value={provider} onValueChange={(v) => { setProvider(v as typeof provider); markChanged(); }}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ICloudDrive">
              iCloud Drive
            </SelectItem>
            <SelectItem value="WebDAV">
              {t('sync.jianguoyun', { defaultValue: '坚果云 (WebDAV)' })}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* iCloud 设置 */}
      {provider === 'ICloudDrive' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            {t('sync.icloudFolder', { defaultValue: '同步文件夹' })}
          </Label>
          <Input
            value={icloudFolder}
            onChange={(e) => { setIcloudFolder(e.target.value); markChanged(); }}
            placeholder="~/Library/Mobile Documents/com~apple~CloudDocs/AiDocPlus"
          />
          <p className="text-xs text-muted-foreground">
            {t('sync.icloudHint', {
              defaultValue: '选择 iCloud Drive 中的文件夹，macOS 自动同步到云端',
            })}
          </p>
        </div>
      )}

      {/* WebDAV 设置 */}
      {provider === 'WebDAV' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">{t('sync.webdavUrl', { defaultValue: '服务器地址' })}</Label>
            <Input
              value={webdavUrl}
              onChange={(e) => { setWebdavUrl(e.target.value); markChanged(); }}
              placeholder="https://dav.jianguoyun.com/dav/"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t('sync.webdavUsername', { defaultValue: '账号' })}</Label>
            <Input
              value={webdavUsername}
              onChange={(e) => { setWebdavUsername(e.target.value); markChanged(); }}
              placeholder="user@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t('sync.webdavPassword', { defaultValue: '应用密码' })}</Label>
            <Input
              type="password"
              value={webdavPassword}
              onChange={(e) => { setWebdavPassword(e.target.value); markChanged(); }}
              placeholder={t('sync.passwordHint', { defaultValue: '在坚果云「安全选项」中创建应用专用密码' })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{t('sync.remoteDir', { defaultValue: '远程目录' })}</Label>
            <Input
              value={webdavRemoteDir}
              onChange={(e) => { setWebdavRemoteDir(e.target.value); markChanged(); }}
              placeholder="AiDocPlus"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || !webdavUrl || !webdavUsername || !webdavPassword}
          >
            {testing
              ? t('sync.testing', { defaultValue: '测试中...' })
              : t('sync.testConnection', { defaultValue: '测试连接' })}
          </Button>
          {testResult === 'success' && (
            <p className="text-xs text-green-600">{t('sync.testSuccess', { defaultValue: '连接成功' })}</p>
          )}
          {testResult === 'error' && (
            <p className="text-xs text-red-500">{errorMsg}</p>
          )}
        </div>
      )}

      <Separator />

      {/* 同步范围 */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {t('sync.scope', { defaultValue: '同步范围' })}
        </Label>
        <div className="space-y-2">
          {[
            { key: 'syncDocuments', label: t('sync.scopeDocs', { defaultValue: '文档和项目' }) },
            { key: 'syncSettings', label: t('sync.scopeSettings', { defaultValue: '设置和偏好' }) },
            { key: 'syncTemplates', label: t('sync.scopeTemplates', { defaultValue: '自定义模板' }) },
            { key: 'syncPluginData', label: t('sync.scopePluginData', { defaultValue: '插件数据' }) },
            { key: 'syncCodingScripts', label: t('sync.scopeScripts', { defaultValue: '编程区脚本' }) },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <Switch
                checked={scope[key as keyof typeof scope]}
                onCheckedChange={(v) => {
                  setScope((s) => ({ ...s, [key]: v }));
                  markChanged();
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 自动同步 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">{t('sync.autoSync', { defaultValue: '自动同步' })}</Label>
          <Switch checked={autoSync} onCheckedChange={(v) => { setAutoSync(v); markChanged(); }} />
        </div>
        {autoSync && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t('sync.interval', { defaultValue: '同步间隔（秒）' })}
            </Label>
            <Input
              type="number"
              min={60}
              max={3600}
              value={syncInterval}
              onChange={(e) => {
                setSyncInterval(Number(e.target.value));
                markChanged();
              }}
            />
          </div>
        )}
      </div>

      <Separator />

      {/* 同步状态 */}
      {status && (
        <div className="space-y-2 rounded-md border p-3 bg-muted/30">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('sync.status', { defaultValue: '状态' })}</span>
            <span>{status.configured ? phaseLabel(status.phase) : t('sync.notConfigured', { defaultValue: '未配置' })}</span>
          </div>
          {status.lastSyncTime && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('sync.lastSync', { defaultValue: '上次同步' })}</span>
              <span>{new Date(status.lastSyncTime).toLocaleString()}</span>
            </div>
          )}
          {status.lastSyncFiles > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('sync.syncedFiles', { defaultValue: '同步文件数' })}</span>
              <span>{status.lastSyncFiles}</span>
            </div>
          )}
          {status.error && (
            <p className="text-xs text-red-500">{status.error}</p>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!hasChanges}>
          {t('common.save', { defaultValue: '保存' })}
        </Button>
        <Button
          variant="outline"
          onClick={handleSyncNow}
          disabled={syncing || !status?.configured}
        >
          {syncing
            ? t('sync.syncing', { defaultValue: '同步中...' })
            : t('sync.syncNow', { defaultValue: '立即同步' })}
        </Button>
      </div>

      {errorMsg && <p className="text-xs text-red-500">{errorMsg}</p>}
    </div>
  );
}
