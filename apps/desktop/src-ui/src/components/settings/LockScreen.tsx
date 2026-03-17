/**
 * 启动密码验证锁屏组件
 *
 * 在应用启动时，如果用户设置了启动密码，则显示此全屏遮罩层，
 * 阻止用户操作直到输入正确密码。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useTranslation } from '../../i18n';

/** SHA-256 哈希（使用 Web Crypto API） */
async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface LockScreenProps {
  passwordHash: string;
  onUnlock: () => void;
}

export function LockScreen({ passwordHash, onUnlock }: LockScreenProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!password.trim()) return;

    const hash = await sha256(password);
    if (hash === passwordHash) {
      onUnlock();
    } else {
      setError(t('settings.security.wrongPassword', { defaultValue: '密码错误，请重试' }));
      setShake(true);
      setAttempts(prev => prev + 1);
      setPassword('');
      setTimeout(() => setShake(false), 500);
      inputRef.current?.focus();
    }
  }, [password, passwordHash, onUnlock, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        {/* Logo / 图标 */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">AiDocPlus</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('settings.security.lockScreenHint', { defaultValue: '请输入密码以解锁应用' })}
          </p>
        </div>

        {/* 密码输入框 */}
        <div className={`space-y-4 ${shake ? 'animate-shake' : ''}`}>
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={handleKeyDown}
              placeholder={t('settings.security.passwordPlaceholder', { defaultValue: '输入启动密码' })}
              className="w-full h-11 px-4 pr-10 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-1.5 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
              {attempts >= 3 && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({t('settings.security.attemptCount', { defaultValue: '已尝试 {{count}} 次', count: attempts })})
                </span>
              )}
            </div>
          )}

          {/* 解锁按钮 */}
          <button
            onClick={handleSubmit}
            disabled={!password.trim()}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {t('settings.security.unlock', { defaultValue: '解锁' })}
          </button>
        </div>

      </div>
    </div>
  );
}
