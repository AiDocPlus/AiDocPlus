import { useState, useMemo } from 'react';
import type { PluginHostAPI } from '../_framework/PluginHostAPI';
import {
  Button, Input, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '../_framework/ui';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import type { WechatApiMode, WechatApiConfig } from './wechatApiProvider';
import { createProvider } from './wechatApiProvider';

export interface WechatConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: WechatApiConfig;
  onSave: (config: WechatApiConfig) => void;
  host: PluginHostAPI;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const MODE_TABS: { mode: WechatApiMode; labelKey: string }[] = [
  { mode: 'direct', labelKey: 'wxModeDirect' },
  { mode: 'cloudrun', labelKey: 'wxModeCloudRun' },
  { mode: 'proxy', labelKey: 'wxModeProxy' },
  { mode: 'thirdparty', labelKey: 'wxModeThirdParty' },
];

export function WechatConnectionDialog({
  open, onOpenChange, config, onSave, host, t,
}: WechatConnectionDialogProps) {
  const [activeMode, setActiveMode] = useState<WechatApiMode>(config.mode || 'direct');
  const [showSecret, setShowSecret] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // 各模式的编辑状态
  const [directAppid, setDirectAppid] = useState(config.direct?.appid || '');
  const [directSecret, setDirectSecret] = useState(config.direct?.secret || '');

  const [cloudrunUrl, setCloudrunUrl] = useState(config.cloudrun?.baseUrl || '');
  const [cloudrunKey, setCloudrunKey] = useState(config.cloudrun?.apiKey || '');

  const [proxyUrl, setProxyUrl] = useState(config.proxy?.baseUrl || '');
  const [proxyKey, setProxyKey] = useState(config.proxy?.apiKey || '');
  const [proxyAppid, setProxyAppid] = useState(config.proxy?.appid || '');
  const [proxySecret, setProxySecret] = useState(config.proxy?.secret || '');

  const [tpUrl, setTpUrl] = useState(config.thirdparty?.providerUrl || '');
  const [tpToken, setTpToken] = useState(config.thirdparty?.authToken || '');
  const [tpName, setTpName] = useState(config.thirdparty?.providerName || '');

  const buildConfig = (): WechatApiConfig => ({
    mode: activeMode,
    direct: { appid: directAppid.trim(), secret: directSecret.trim() },
    cloudrun: { baseUrl: cloudrunUrl.trim(), apiKey: cloudrunKey.trim() },
    proxy: { baseUrl: proxyUrl.trim(), apiKey: proxyKey.trim() || undefined, appid: proxyAppid.trim() || undefined, secret: proxySecret.trim() || undefined },
    thirdparty: { providerUrl: tpUrl.trim(), authToken: tpToken.trim(), providerName: tpName.trim() || undefined },
  });

  const canSave = useMemo(() => {
    switch (activeMode) {
      case 'direct': return !!directAppid.trim() && !!directSecret.trim();
      case 'cloudrun': return !!cloudrunUrl.trim() && !!cloudrunKey.trim();
      case 'proxy': return !!proxyUrl.trim();
      case 'thirdparty': return !!tpUrl.trim() && !!tpToken.trim();
      default: return false;
    }
  }, [activeMode, directAppid, directSecret, cloudrunUrl, cloudrunKey, proxyUrl, tpUrl, tpToken]);

  const handleTest = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const cfg = buildConfig();
      const provider = createProvider(host, cfg);
      const result = await provider.testConnection();
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({ ok: false, msg: err instanceof Error ? err.message : String(err) });
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = () => {
    onSave(buildConfig());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (!v) { setVerifyResult(null); setShowSecret(false); }
    }}>
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto" style={{ fontFamily: '宋体, SimSun, serif', fontSize: '16px' }}>
        <DialogHeader>
          <DialogTitle>{t('wxConnectionTitle')}</DialogTitle>
          <DialogDescription>{t('wxConnectionDesc')}</DialogDescription>
        </DialogHeader>

        {/* 模式 Tab */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
          {MODE_TABS.map(tab => (
            <button
              key={tab.mode}
              className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                activeMode === tab.mode
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => { setActiveMode(tab.mode); setVerifyResult(null); }}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        {/* 直连模式 */}
        {activeMode === 'direct' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('wxDirectDesc')}</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AppID</Label>
              <Input value={directAppid} onChange={e => setDirectAppid(e.target.value)}
                placeholder="wx1234567890abcdef" className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AppSecret</Label>
              <div className="relative">
                <Input type={showSecret ? 'text' : 'password'} value={directSecret}
                  onChange={e => setDirectSecret(e.target.value)}
                  placeholder="••••••••••••••••" className="h-8 text-sm font-mono pr-8" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 云托管模式 */}
        {activeMode === 'cloudrun' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('wxCloudRunDesc')}</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('wxServiceUrl')}</Label>
              <Input value={cloudrunUrl} onChange={e => setCloudrunUrl(e.target.value)}
                placeholder="https://your-service.ap-shanghai.run.tcloudbase.com" className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">API Key</Label>
              <div className="relative">
                <Input type={showSecret ? 'text' : 'password'} value={cloudrunKey}
                  onChange={e => setCloudrunKey(e.target.value)}
                  placeholder="••••••••••••••••" className="h-8 text-sm font-mono pr-8" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 自建代理模式 */}
        {activeMode === 'proxy' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('wxProxyDesc')}</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('wxProxyUrl')}</Label>
              <Input value={proxyUrl} onChange={e => setProxyUrl(e.target.value)}
                placeholder="https://your-proxy.example.com" className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">API Key ({t('wxOptional')})</Label>
              <Input value={proxyKey} onChange={e => setProxyKey(e.target.value)}
                placeholder={t('wxOptional')} className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AppID ({t('wxOptional')})</Label>
              <Input value={proxyAppid} onChange={e => setProxyAppid(e.target.value)}
                placeholder={t('wxOptional')} className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">AppSecret ({t('wxOptional')})</Label>
              <div className="relative">
                <Input type={showSecret ? 'text' : 'password'} value={proxySecret}
                  onChange={e => setProxySecret(e.target.value)}
                  placeholder={t('wxOptional')} className="h-8 text-sm font-mono pr-8" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 第三方服务商模式 */}
        {activeMode === 'thirdparty' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{t('wxThirdPartyDesc')}</p>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('wxProviderName')} ({t('wxOptional')})</Label>
              <Input value={tpName} onChange={e => setTpName(e.target.value)}
                placeholder={t('wxProviderNamePlaceholder')} className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('wxProviderUrl')}</Label>
              <Input value={tpUrl} onChange={e => setTpUrl(e.target.value)}
                placeholder="https://api.provider.com" className="h-8 text-sm font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('wxAuthToken')}</Label>
              <div className="relative">
                <Input type={showSecret ? 'text' : 'password'} value={tpToken}
                  onChange={e => setTpToken(e.target.value)}
                  placeholder="••••••••••••••••" className="h-8 text-sm font-mono pr-8" />
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowSecret(!showSecret)}>
                  {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 验证结果 */}
        {verifyResult && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${
            verifyResult.ok
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}>
            {verifyResult.ok
              ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              : <XCircle className="h-4 w-4 flex-shrink-0" />
            }
            <span className="break-all">{verifyResult.msg}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs"
            onClick={() => onOpenChange(false)}>
            {t('wxCancel')}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
            style={{ borderColor: '#07C160', color: '#07C160' }}
            disabled={verifying || !canSave}
            onClick={handleTest}>
            {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {t('wxTestConnection')}
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 text-xs"
            disabled={!canSave}
            onClick={handleSave}>
            {t('wxSave')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
