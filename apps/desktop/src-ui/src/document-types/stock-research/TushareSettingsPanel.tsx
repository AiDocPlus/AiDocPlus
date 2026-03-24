/**
 * Tushare 设置面板
 * 用于配置 Tushare Pro API Token 和查看账户状态
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { KeyRound, CheckCircle, XCircle, Loader2, Trash2, RefreshCw } from 'lucide-react';
import type { TushareCredential } from './types';
import { useTushareLive } from './useTushareLive';

interface TushareSettingsPanelProps {
  /** 关闭面板回调 */
  onClose?: () => void;
  /** 根节点样式（如在 Dialog 内嵌入时去掉 border-l） */
  className?: string;
}

export function TushareSettingsPanel({ onClose, className }: TushareSettingsPanelProps) {
  const { t } = useTranslation();
  const { checkToken, storeToken, deleteToken, error } = useTushareLive();

  const [tokenInput, setTokenInput] = useState('');
  const [credential, setCredential] = useState<TushareCredential | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 初始化时检查 Token 状态
  useEffect(() => {
    checkCredentialStatus();
  }, []);

  const checkCredentialStatus = async () => {
    setIsLoading(true);
    try {
      const result = await checkToken();
      if (result) {
        setCredential(result);
        setMessage({ type: 'success', text: t('stockResearch.tushareConnected', { points: result.points }) });
      } else {
        setCredential(null);
      }
    } catch (e) {
      setCredential(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      setMessage({ type: 'error', text: t('stockResearch.tokenRequired') });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const result = await storeToken(tokenInput.trim());
      if (result.success) {
        setMessage({ type: 'success', text: t('stockResearch.tokenSaved') });
        setTokenInput('');
        await checkCredentialStatus();
      } else {
        setMessage({ type: 'error', text: result.error || t('stockResearch.tokenSaveFailed') });
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteToken = async () => {
    setIsDeleting(true);
    setMessage(null);

    try {
      const result = await deleteToken();
      if (result.success) {
        setCredential(null);
        setMessage({ type: 'success', text: t('stockResearch.tokenDeleted') });
      } else {
        setMessage({ type: 'error', text: result.error || t('stockResearch.tokenDeleteFailed') });
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const result = await checkToken();
      if (result) {
        setCredential(result);
        setMessage({ type: 'success', text: t('stockResearch.connectionSuccess', { points: result.points }) });
      } else {
        // 使用 hook 返回的 error 或默认消息
        const errorMsg = error || t('stockResearch.connectionFailed');
        setMessage({ type: 'error', text: errorMsg });
      }
    } catch (e) {
      setMessage({ type: 'error', text: String(e) });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-card border-l', className)}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{t('stockResearch.tushareSettings')}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-muted"
            title={t('common.close', { defaultValue: '关闭' })}
            aria-label={t('common.close', { defaultValue: '关闭' })}
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* 说明 */}
        <div className="text-sm text-muted-foreground">
          <p>{t('stockResearch.tushareDesc')}</p>
          <a
            href="https://tushare.pro/register"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t('stockResearch.tushareRegisterLink')}
          </a>
        </div>

        {/* Token 输入 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t('stockResearch.tushareToken')}
          </label>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={t('stockResearch.tokenPlaceholder')}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background"
          />
          <button
            onClick={handleSaveToken}
            disabled={isSaving || !tokenInput.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              t('common.save')
            )}
          </button>
        </div>

        {/* 当前连接状态 */}
        {credential && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-500">
                {t('stockResearch.connected')}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('stockResearch.tokenPrefix')}:</span>
                <span className="font-mono">{credential.tokenPrefix}***</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('stockResearch.points')}:</span>
                <span className="font-medium">{credential.points.toLocaleString()}</span>
              </div>
              {credential.email && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('stockResearch.email')}:</span>
                  <span>{credential.email}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 无 Token 状态 */}
        {!credential && !isLoading && (
          <div className="p-3 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t('stockResearch.notConfigured')}
              </span>
            </div>
          </div>
        )}

        {/* 消息提示 */}
        {message && (
          <div
            className={`p-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="space-y-2">
          <button
            onClick={handleTestConnection}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('stockResearch.testConnection')}
          </button>

          {credential && (
            <button
              onClick={handleDeleteToken}
              disabled={isDeleting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? t('common.deleting') : t('stockResearch.deleteToken')}
            </button>
          )}
        </div>

        {/* 积分说明 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">{t('stockResearch.pointsNote')}</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>{t('stockResearch.pointsDesc1')}</li>
            <li>{t('stockResearch.pointsDesc2')}</li>
            <li>{t('stockResearch.pointsDesc3')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
