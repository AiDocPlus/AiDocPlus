import { useState, useCallback } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button, Label } from '../_framework/ui';
import { Lock, Unlock, Copy, Shield } from 'lucide-react';

type Mode = 'encrypt' | 'decrypt';

/**
 * 基于 Web Crypto API 的 AES-256-GCM 加密/解密
 */
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptText(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));
  // 格式: base64(salt + iv + ciphertext)
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptText(cipherBase64: string, password: string): Promise<string> {
  const dec = new TextDecoder();
  const combined = Uint8Array.from(atob(cipherBase64), c => c.charCodeAt(0));
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return dec.decode(decrypted);
}

export function EncryptPluginPanel({
  document,
  content,
}: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const [mode, setMode] = useState<Mode>('encrypt');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inputText, setInputText] = useState('');
  const [resultText, setResultText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const getContent = useCallback((): string => {
    return content || document.aiGeneratedContent || document.content || '';
  }, [content, document]);

  // 加密
  const handleEncrypt = useCallback(async () => {
    if (!password) { showStatus(t('passwordEmpty'), true); return; }
    if (password !== confirmPassword) { showStatus(t('passwordMismatch'), true); return; }
    const text = inputText.trim() || getContent();
    if (!text.trim()) { showStatus(t('noContent'), true); return; }

    setProcessing(true);
    try {
      const encrypted = await encryptText(text, password);
      setResultText(encrypted);
      showStatus(t('encryptSuccess'));
    } catch (err) {
      showStatus(`${t('encryptFailed')}: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setProcessing(false);
    }
  }, [password, confirmPassword, inputText, getContent, t, showStatus]);

  // 解密
  const handleDecrypt = useCallback(async () => {
    if (!password) { showStatus(t('passwordEmpty'), true); return; }
    if (!inputText.trim()) { showStatus(t('noContent'), true); return; }

    setProcessing(true);
    try {
      const decrypted = await decryptText(inputText.trim(), password);
      setResultText(decrypted);
      showStatus(t('decryptSuccess'));
    } catch (err) {
      showStatus(`${t('decryptFailed')}: ${err instanceof Error ? err.message : String(err)}`, true);
    } finally {
      setProcessing(false);
    }
  }, [password, inputText, t, showStatus]);

  // 复制结果
  const handleCopy = useCallback(async () => {
    if (!resultText) return;
    await host.ui.copyToClipboard(resultText);
    showStatus(t('copied'));
  }, [resultText, host.ui, t, showStatus]);

  // 导入内容
  const handleImportContent = useCallback((text: string, _source: string) => {
    setInputText(text);
  }, []);

  // 加载文档内容到输入框
  const handleLoadContent = useCallback(() => {
    const text = getContent();
    if (text) setInputText(text);
  }, [getContent]);

  return (
    <ToolPluginLayout
      pluginIcon={<Shield className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={handleImportContent}
      hasContent={true}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      extraToolbar={
        resultText ? (
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleCopy}>
            <Copy className="h-3 w-3" />
            {mode === 'encrypt' ? t('copyEncrypted') : t('copyDecrypted')}
          </Button>
        ) : null
      }
    >
      <div className="p-4 space-y-4">
        {/* 模式切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => { setMode('encrypt'); setResultText(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm transition-colors ${
              mode === 'encrypt' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <Lock className="h-4 w-4" />
            {t('modeEncrypt')}
          </button>
          <button
            onClick={() => { setMode('decrypt'); setResultText(''); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm transition-colors ${
              mode === 'decrypt' ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            <Unlock className="h-4 w-4" />
            {t('modeDecrypt')}
          </button>
        </div>

        {/* 加密强度提示 */}
        <div className="flex items-center gap-1.5 p-2 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-xs">
          <Shield className="h-3.5 w-3.5 flex-shrink-0" />
          {t('strengthInfo')}
        </div>

        {/* 密码输入 */}
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('password')}</Label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              className="w-full h-8 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {mode === 'encrypt' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('confirmPassword')}</Label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('confirmPlaceholder')}
                className="w-full h-8 px-2 text-xs border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
        </div>

        {/* 输入内容 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">
              {mode === 'encrypt' ? t('contentSource') : t('pasteEncrypted')}
            </Label>
            {mode === 'encrypt' && (
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleLoadContent}>
                {t('sourceOriginal')}
              </Button>
            )}
          </div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={mode === 'encrypt' ? undefined : t('pasteEncrypted')}
            rows={5}
            className="w-full px-2 py-1.5 text-xs border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            style={{ fontFamily: '宋体', fontSize: '16px' }}
            spellCheck={false}
          />
        </div>

        {/* 操作按钮 */}
        <Button
          className="w-full gap-2"
          onClick={mode === 'encrypt' ? handleEncrypt : handleDecrypt}
          disabled={processing}
        >
          {mode === 'encrypt' ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          {processing
            ? (mode === 'encrypt' ? t('encrypting') : t('decrypting'))
            : (mode === 'encrypt' ? t('encrypt') : t('decrypt'))
          }
        </Button>

        {/* 结果 */}
        {resultText && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {mode === 'encrypt' ? t('encryptedContent') : t('decryptedContent')}
            </Label>
            <textarea
              value={resultText}
              readOnly
              rows={5}
              className="w-full px-2 py-1.5 text-xs border rounded-md bg-muted resize-none font-mono"
              style={{ fontFamily: '宋体', fontSize: '16px' }}
            />
          </div>
        )}
      </div>
    </ToolPluginLayout>
  );
}
