import { useState, useCallback, useEffect, useRef } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_framework/ui';
import { Volume2, Play, Pause, Square, Upload } from 'lucide-react';

type PlayState = 'idle' | 'playing' | 'paused';

interface TtsStorage {
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export function TtsPluginPanel({
  document,
  content,
}: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  const stored = (host.storage.get('settings') as TtsStorage) || {};
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState(stored.voiceURI || '');
  const [rate, setRate] = useState(stored.rate ?? 1.0);
  const [pitch, setPitch] = useState(stored.pitch ?? 1.0);
  const [volume, setVolume] = useState(stored.volume ?? 1.0);
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [customText, setCustomText] = useState('');
  const [ttsSupported, setTtsSupported] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg);
    setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const saveSettings = useCallback((updates: Partial<TtsStorage>) => {
    const current = (host.storage.get('settings') as TtsStorage) || {};
    host.storage.set('settings', { ...current, ...updates });
  }, [host.storage]);

  // 检测 TTS 支持并加载语音列表
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setTtsSupported(false);
      return;
    }

    const loadVoices = () => {
      const available = speechSynthesis.getVoices();
      setVoices(available);
      if (available.length > 0 && !selectedVoiceURI) {
        // 优先选中文语音
        const zhVoice = available.find(v => v.lang.startsWith('zh'));
        if (zhVoice) setSelectedVoiceURI(zhVoice.voiceURI);
        else setSelectedVoiceURI(available[0].voiceURI);
      }
    };

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [selectedVoiceURI]);

  const getContent = useCallback((): string => {
    if (customText.trim()) return customText;
    return content || document.aiGeneratedContent || document.content || '';
  }, [customText, content, document]);

  // 去除 Markdown 标记
  const stripMarkdown = (text: string): string => {
    return text
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/---+/g, '')
      .trim();
  };

  // 播放
  const handlePlay = useCallback(() => {
    if (!ttsSupported) { showStatus(t('ttsNotSupported'), true); return; }

    const text = stripMarkdown(getContent());
    if (!text) { showStatus(t('noContent'), true); return; }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
    if (voice) utterance.voice = voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;

    utterance.onend = () => setPlayState('idle');
    utterance.onerror = () => { setPlayState('idle'); showStatus(t('noContent'), true); };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
    setPlayState('playing');
    showStatus(t('playing'));
  }, [ttsSupported, getContent, voices, selectedVoiceURI, rate, pitch, volume, t, showStatus]);

  // 暂停
  const handlePause = useCallback(() => {
    speechSynthesis.pause();
    setPlayState('paused');
  }, []);

  // 继续
  const handleResume = useCallback(() => {
    speechSynthesis.resume();
    setPlayState('playing');
  }, []);

  // 停止
  const handleStop = useCallback(() => {
    speechSynthesis.cancel();
    setPlayState('idle');
  }, []);

  // 加载文档内容到自定义文本
  const handleLoadContent = useCallback(() => {
    const text = content || document.aiGeneratedContent || document.content || '';
    if (text) {
      setCustomText(stripMarkdown(text));
      showStatus(`${t('loadContent')} (${text.length} ${t('charCount')})`);
    }
  }, [content, document, t, showStatus]);

  // 估算时长
  const textToRead = customText.trim() || stripMarkdown(getContent());
  const charCount = textToRead.length;
  const estimatedSeconds = charCount > 0 ? Math.ceil(charCount / (rate * 5)) : 0; // ~5字/秒
  const estMin = Math.floor(estimatedSeconds / 60);
  const estSec = estimatedSeconds % 60;

  const handleImportContent = useCallback((text: string, _source: string) => {
    setCustomText(stripMarkdown(text));
  }, []);

  // 清理
  useEffect(() => {
    return () => { speechSynthesis.cancel(); };
  }, []);

  return (
    <ToolPluginLayout
      pluginIcon={<Volume2 className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={handleImportContent}
      hasContent={true}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      extraToolbar={
        <div className="flex items-center gap-1">
          {playState === 'idle' && (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handlePlay}>
              <Play className="h-3 w-3" />
              {t('play')}
            </Button>
          )}
          {playState === 'playing' && (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handlePause}>
              <Pause className="h-3 w-3" />
              {t('pause')}
            </Button>
          )}
          {playState === 'paused' && (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleResume}>
              <Play className="h-3 w-3" />
              {t('resume')}
            </Button>
          )}
          {playState !== 'idle' && (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleStop}>
              <Square className="h-3 w-3" />
              {t('stop')}
            </Button>
          )}
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {!ttsSupported ? (
          <div className="p-4 rounded-lg border bg-red-500/10 text-red-700 dark:text-red-400 text-sm text-center">
            {t('ttsNotSupported')}
          </div>
        ) : (
          <>
            {/* 语音选择 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('voice')}</Label>
              {voices.length > 0 ? (
                <Select value={selectedVoiceURI} onValueChange={(v) => { setSelectedVoiceURI(v); saveSettings({ voiceURI: v }); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t('selectVoice')} />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map(v => (
                      <SelectItem key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">{t('noVoices')}</p>
              )}
            </div>

            {/* 语音参数 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t('rate')}: {rate.toFixed(1)}x</Label>
                <input
                  type="range" min={0.5} max={3} step={0.1}
                  value={rate}
                  onChange={(e) => { const v = Number(e.target.value); setRate(v); saveSettings({ rate: v }); }}
                  className="w-full h-1.5 accent-primary"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('pitch')}: {pitch.toFixed(1)}</Label>
                <input
                  type="range" min={0.5} max={2} step={0.1}
                  value={pitch}
                  onChange={(e) => { const v = Number(e.target.value); setPitch(v); saveSettings({ pitch: v }); }}
                  className="w-full h-1.5 accent-primary"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('volume')}: {Math.round(volume * 100)}%</Label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={volume}
                  onChange={(e) => { const v = Number(e.target.value); setVolume(v); saveSettings({ volume: v }); }}
                  className="w-full h-1.5 accent-primary"
                />
              </div>
            </div>

            {/* 信息栏 */}
            <div className="flex items-center gap-4 p-2.5 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
              <span>{t('charCount')}: {charCount.toLocaleString()}</span>
              <span>{t('estimatedTime')}: {estMin > 0 ? `${estMin} ${t('minutes')} ` : ''}{estSec} {t('seconds')}</span>
            </div>

            {/* 自定义文本 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">{t('customText')}</Label>
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={handleLoadContent}>
                  <Upload className="h-3 w-3" />
                  {t('loadContent')}
                </Button>
              </div>
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={t('customTextPlaceholder')}
                rows={6}
                className="w-full px-2 py-1.5 text-xs border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                style={{ fontFamily: '宋体', fontSize: '16px' }}
                spellCheck={false}
              />
            </div>

            {/* 大播放按钮 */}
            <Button
              className="w-full gap-2"
              onClick={playState === 'idle' ? handlePlay : (playState === 'playing' ? handlePause : handleResume)}
              disabled={charCount === 0}
            >
              {playState === 'playing' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {playState === 'idle' ? t('play') : (playState === 'playing' ? t('pause') : t('resume'))}
            </Button>
          </>
        )}
      </div>
    </ToolPluginLayout>
  );
}
