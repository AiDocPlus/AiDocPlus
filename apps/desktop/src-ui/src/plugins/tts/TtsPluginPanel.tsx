import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../_framework/ui';
import {
  Volume2, Play, Square, Upload, SkipBack, SkipForward,
  ChevronDown, ChevronRight, Trash2,
} from 'lucide-react';

type PlayState = 'idle' | 'playing' | 'paused';

interface TtsStorage {
  voiceId?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  customText?: string;
  currentSegmentIndex?: number;
  settingsOpen?: boolean;
  textOpen?: boolean;
  fontSize?: number;
}

interface VoiceInfo { id: string; name: string; language: string; }
interface ParamRanges {
  rate: { min: number; max: number; normal: number };
  pitch: { min: number; max: number; normal: number };
  volume: { min: number; max: number; normal: number };
}

// ── 工具函数 ──

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1').replace(/`([^`]+)`/g, '$1')
    .replace(/```[\s\S]*?```/g, '').replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '').replace(/^>\s+/gm, '').replace(/---+/g, '').trim();
}

function splitSegments(text: string): string[] {
  if (!text.trim()) return [];
  const paragraphs = text.split(/\n+/).filter(p => p.trim());
  const segments: string[] = [];
  for (const para of paragraphs) {
    if (para.length > 200) {
      segments.push(...para.split(/(?<=[。！？.!?])\s*/).filter(s => s.trim()));
    } else {
      segments.push(para.trim());
    }
  }
  return segments;
}

function nativeToSpeed(native: number, normal: number): number {
  if (normal <= 0) return 1;
  return native / normal;
}

function speedToNative(speed: number, normal: number): number {
  return speed * normal;
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

// ── 主组件 ──

export function TtsPluginPanel({ document: doc, content }: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;
  const invoke = host.platform.invoke;
  const stored = (host.storage.get('settings') as TtsStorage) || {};

  // ── 系统 TTS 状态 ──
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState(stored.voiceId || '');
  const [rate, setRate] = useState(stored.rate ?? 0);
  const [pitch, setPitch] = useState(stored.pitch ?? 0);
  const [volume, setVolume] = useState(stored.volume ?? 0);
  const [paramRanges, setParamRanges] = useState<ParamRanges | null>(null);

  // ── 公共状态 ──
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [customText, setCustomText] = useState(stored.customText || '');
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(stored.currentSegmentIndex ?? 0);
  const [ttsReady, setTtsReady] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(stored.settingsOpen ?? false);
  const [textOpen, setTextOpen] = useState(stored.textOpen ?? true);
  const [fontSize, setFontSize] = useState(stored.fontSize ?? 16);

  const playStateRef = useRef<PlayState>('idle');
  const currentSegmentRef = useRef(0);
  const segmentsRef = useRef<string[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stoppedManuallyRef = useRef(false);
  const segmentListRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  const showStatus = useCallback((msg: string, isError = false) => {
    setStatusMsg(msg); setStatusIsError(isError);
    setTimeout(() => setStatusMsg(null), 4000);
  }, []);

  const saveSettings = useCallback((updates: Partial<TtsStorage>) => {
    const current = (host.storage.get('settings') as TtsStorage) || {};
    host.storage.set('settings', { ...current, ...updates });
  }, [host.storage]);

  // ── 初始化 ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [voiceList, ranges] = await Promise.all([
          invoke<VoiceInfo[]>('tts_list_voices'),
          invoke<ParamRanges>('tts_get_param_ranges'),
        ]);
        if (cancelled) return;
        setVoices(voiceList);
        setParamRanges(ranges);
        setRate(stored.rate ?? ranges.rate.normal);
        setPitch(stored.pitch ?? ranges.pitch.normal);
        setVolume(stored.volume ?? ranges.volume.normal);
        if (!stored.voiceId && voiceList.length > 0) {
          const zh = voiceList.find(v => v.language.startsWith('zh'));
          setSelectedVoiceId(zh?.id || voiceList[0].id);
        }
        if (stored.rate != null) { try { await invoke('tts_set_rate', { rate: stored.rate }); } catch { /* ignore */ } }
        if (stored.pitch != null) { try { await invoke('tts_set_pitch', { pitch: stored.pitch }); } catch { /* ignore */ } }
        if (stored.volume != null) { try { await invoke('tts_set_volume', { volume: stored.volume }); } catch { /* ignore */ } }
        if (stored.voiceId) { try { await invoke('tts_set_voice', { voiceId: stored.voiceId }); } catch { /* ignore */ } }
        setTtsReady(true);
      } catch (err) {
        if (!cancelled) setInitError(String(err));
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 保存 customText（防抖）
  useEffect(() => {
    const timer = setTimeout(() => saveSettings({ customText }), 500);
    return () => clearTimeout(timer);
  }, [customText, saveSettings]);

  // 文本 → 段落
  const getContent = useCallback((): string => {
    if (customText.trim()) return customText;
    return content || doc.aiGeneratedContent || doc.content || '';
  }, [customText, content, doc]);

  const segments = useMemo(() => splitSegments(stripMarkdown(getContent())), [getContent]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  // 自动滚动
  useEffect(() => {
    if (activeSegmentRef.current && segmentListRef.current) {
      activeSegmentRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSegmentIndex, playState]);

  // ══════════════════════════════════════
  // 系统 TTS 播放逻辑
  // ══════════════════════════════════════

  const playSegmentSystem = useCallback(async (index: number) => {
    const segs = segmentsRef.current;
    if (index < 0 || index >= segs.length) {
      setPlayState('idle'); playStateRef.current = 'idle';
      showStatus(t('playComplete'));
      return;
    }
    stoppedManuallyRef.current = false;
    setCurrentSegmentIndex(index);
    currentSegmentRef.current = index;
    saveSettings({ currentSegmentIndex: index });
    try {
      await invoke('tts_speak', { text: segs[index], interrupt: true });
      setPlayState('playing'); playStateRef.current = 'playing';
    } catch (err) {
      showStatus(String(err), true);
      setPlayState('idle'); playStateRef.current = 'idle';
    }
  }, [invoke, saveSettings, showStatus, t]);

  // 轮询系统 TTS 播完 → 自动下一段
  useEffect(() => {
    if (playState === 'playing') {
      pollingRef.current = setInterval(async () => {
        try {
          const speaking = await invoke<boolean>('tts_is_speaking');
          if (!speaking && playStateRef.current === 'playing' && !stoppedManuallyRef.current) {
            const next = currentSegmentRef.current + 1;
            if (next < segmentsRef.current.length) {
              playSegmentSystem(next);
            } else {
              setPlayState('idle'); playStateRef.current = 'idle';
              showStatus(t('playComplete'));
            }
          }
        } catch { /* ignore */ }
      }, 300);
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [playState, invoke, playSegmentSystem, showStatus, t]);

  // ── 播放控制 ──
  const handlePlay = useCallback(() => {
    if (segments.length === 0) { showStatus(t('noContent'), true); return; }
    const idx = currentSegmentIndex < segments.length ? currentSegmentIndex : 0;
    playSegmentSystem(idx);
  }, [segments, currentSegmentIndex, playSegmentSystem, showStatus, t]);

  const handleStop = useCallback(async () => {
    stoppedManuallyRef.current = true;
    try { await invoke('tts_stop'); } catch { /* ignore */ }
    setPlayState('idle'); playStateRef.current = 'idle';
  }, [invoke]);

  const handlePrev = useCallback(() => {
    const idx = Math.max(0, currentSegmentRef.current - 1);
    playSegmentSystem(idx);
  }, [playSegmentSystem]);

  const handleNext = useCallback(() => {
    const idx = Math.min(segmentsRef.current.length - 1, currentSegmentRef.current + 1);
    playSegmentSystem(idx);
  }, [playSegmentSystem]);

  // ── 系统 TTS 参数 ──
  const applyRate = useCallback(async (v: number) => {
    setRate(v); saveSettings({ rate: v });
    try { await invoke('tts_set_rate', { rate: v }); } catch { /* ignore */ }
  }, [invoke, saveSettings]);

  const applyPitch = useCallback(async (v: number) => {
    setPitch(v); saveSettings({ pitch: v });
    try { await invoke('tts_set_pitch', { pitch: v }); } catch { /* ignore */ }
  }, [invoke, saveSettings]);

  const applyVolume = useCallback(async (v: number) => {
    setVolume(v); saveSettings({ volume: v });
    try { await invoke('tts_set_volume', { volume: v }); } catch { /* ignore */ }
  }, [invoke, saveSettings]);

  const applyVoice = useCallback(async (id: string) => {
    setSelectedVoiceId(id); saveSettings({ voiceId: id });
    try { await invoke('tts_set_voice', { voiceId: id }); } catch { /* ignore */ }
  }, [invoke, saveSettings]);

  const handleSpeedPreset = useCallback(() => {
    if (!paramRanges) return;
    const currentSpeed = nativeToSpeed(rate, paramRanges.rate.normal);
    const idx = SPEED_PRESETS.findIndex(s => s > currentSpeed + 0.01);
    const nextSpeed = SPEED_PRESETS[idx >= 0 ? idx : 0];
    applyRate(speedToNative(nextSpeed, paramRanges.rate.normal));
  }, [rate, paramRanges, applyRate]);

  // ── 内容操作 ──
  const handleLoadContent = useCallback(() => {
    const text = content || doc.aiGeneratedContent || doc.content || '';
    if (text) {
      setCustomText(stripMarkdown(text));
      setCurrentSegmentIndex(0); currentSegmentRef.current = 0;
      showStatus(t('loadContent'));
    }
  }, [content, doc, t, showStatus]);

  const handleClearContent = useCallback(() => {
    setCustomText('');
    setCurrentSegmentIndex(0); currentSegmentRef.current = 0;
  }, []);

  const handleImportContent = useCallback((text: string) => {
    setCustomText(stripMarkdown(text));
    setCurrentSegmentIndex(0); currentSegmentRef.current = 0;
  }, []);

  // ── 折叠面板 ──
  const toggleSettings = useCallback(() => {
    setSettingsOpen(v => { saveSettings({ settingsOpen: !v }); return !v; });
  }, [saveSettings]);
  const toggleText = useCallback(() => {
    setTextOpen(v => { saveSettings({ textOpen: !v }); return !v; });
  }, [saveSettings]);

  // ── 显示数据 ──
  const speedDisplay = paramRanges ? nativeToSpeed(rate, paramRanges.rate.normal).toFixed(1) + 'x' : '1.0x';
  const charCount = segments.reduce((sum, s) => sum + s.length, 0);
  const speedVal = paramRanges ? nativeToSpeed(rate, paramRanges.rate.normal) : 1;
  const estimatedSeconds = charCount > 0 ? Math.ceil(charCount / (speedVal * 5)) : 0;
  const estMin = Math.floor(estimatedSeconds / 60);
  const estSec = estimatedSeconds % 60;

  // ── 错误界面 ──
  if (initError) {
    return (
      <ToolPluginLayout pluginIcon={<Volume2 className="h-12 w-12 text-muted-foreground/50" />}
        pluginTitle={t('title')} pluginDesc={t('description')}
        onImportContent={handleImportContent} hasContent={true}>
        <div className="p-4">
          <div className="p-4 rounded-lg border bg-red-500/10 text-red-700 dark:text-red-400 text-sm text-center">
            {t('ttsNotSupported')}: {initError}
          </div>
        </div>
      </ToolPluginLayout>
    );
  }

  return (
    <ToolPluginLayout
      pluginIcon={<Volume2 className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')} pluginDesc={t('description')}
      onImportContent={handleImportContent} hasContent={true}
      statusMsg={statusMsg} statusIsError={statusIsError}
      extraToolbar={
        <div className="flex items-center gap-1">
          {playState === 'idle' ? (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handlePlay}
              disabled={!ttsReady || segments.length === 0}>
              <Play className="h-3 w-3" />{t('play')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleStop}>
              <Square className="h-3 w-3" />{t('stop')}
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col h-full min-h-0">
        {/* ═══ 播放器控制栏 ═══ */}
        <div className="flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2 border-b bg-muted/20">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handlePrev}
            disabled={playState === 'idle' || currentSegmentIndex <= 0}
            title={t('prevSegment')}>
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button variant={playState === 'playing' ? 'destructive' : 'default'}
            size="sm" className="h-10 w-10 rounded-full p-0"
            disabled={!ttsReady || segments.length === 0}
            onClick={playState === 'idle' ? handlePlay : handleStop}
            title={playState === 'idle' ? t('play') : t('stop')}>
            {playState === 'playing'
              ? <Square className="h-4 w-4" />
              : <Play className="h-4 w-4 ml-0.5" />}
          </Button>

          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleNext}
            disabled={playState === 'idle' || currentSegmentIndex >= segments.length - 1}
            title={t('nextSegment')}>
            <SkipForward className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border mx-1" />

          <span className="text-xs text-muted-foreground font-mono min-w-[50px] text-center">
            {segments.length > 0 ? `${currentSegmentIndex + 1}/${segments.length}` : '0/0'}
          </span>

          <Button variant="outline" size="sm" className="h-7 px-2 text-xs font-mono"
            onClick={handleSpeedPreset} title={t('speedLabel')}>
            {speedDisplay}
          </Button>

          <span className="text-[10px] text-muted-foreground/70">
            {estMin > 0 ? `${estMin}${t('minutes')}` : ''}{estSec}{t('seconds')}
          </span>
        </div>

        {/* ═══ 段落列表 ═══ */}
        <div ref={segmentListRef}
          className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5"
          style={{ minHeight: '120px' }}>
          {segments.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted-foreground/60">
              {t('noSegments')}
            </div>
          ) : (
            <div className="space-y-0.5">
              {segments.map((seg, i) => {
                const isActive = i === currentSegmentIndex && playState !== 'idle';
                return (
                  <div key={i}
                    ref={isActive ? activeSegmentRef : undefined}
                    onClick={() => playSegmentSystem(i)}
                    className={`group px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
                      isActive
                        ? 'shadow-sm'
                        : i === currentSegmentIndex
                          ? 'text-foreground'
                          : 'hover:bg-muted/30 text-muted-foreground'
                    }`}
                    style={{
                      fontFamily: '"Songti SC", "SimSun", "STSong", serif',
                      fontSize: `${fontSize}px`,
                      lineHeight: '1.6',
                      ...(isActive ? { backgroundColor: 'rgba(59,130,246,0.15)', color: '#1d4ed8', outline: '1px solid rgba(59,130,246,0.4)' } : {}),
                      ...(i === currentSegmentIndex && !isActive ? { backgroundColor: 'rgba(59,130,246,0.05)' } : {}),
                    }}
                  >
                    <span className="inline-block w-6 text-right mr-1.5 text-[10px]"
                      style={{ color: isActive ? '#2563eb' : undefined, opacity: isActive ? 1 : 0.4 }}
                    >{i + 1}.</span>
                    {seg.length > 120 ? seg.slice(0, 120) + '...' : seg}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ═══ 折叠面板：语音设置 ═══ */}
        <div className="flex-shrink-0 border-t">
          <button onClick={toggleSettings}
            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
            {settingsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {t('settingsPanel')}
          </button>
          {settingsOpen && (
            <div className="px-3 pb-2.5 space-y-2.5">
              {/* 字体大小 */}
              <div className="space-y-0.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">字体大小</Label>
                  <span className="text-[11px] font-mono text-muted-foreground">{fontSize}px</span>
                </div>
                <input type="range" min={12} max={24} step={1} value={fontSize}
                  onChange={e => { const v = Number(e.target.value); setFontSize(v); saveSettings({ fontSize: v }); }}
                  className="w-full h-1.5 accent-primary" title="字体大小" />
              </div>

              {/* 语音选择 */}
              {voices.length > 0 && (
                <Select value={selectedVoiceId} onValueChange={applyVoice}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder={t('selectVoice')} />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name} ({v.language})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* 语速/音调/音量 */}
              {paramRanges && (
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px]">{t('rate')}</Label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {nativeToSpeed(rate, paramRanges.rate.normal).toFixed(1)}x
                      </span>
                    </div>
                    <input type="range"
                      min={speedToNative(0.25, paramRanges.rate.normal)}
                      max={speedToNative(3.0, paramRanges.rate.normal)}
                      step={paramRanges.rate.normal * 0.05}
                      value={rate}
                      onChange={e => applyRate(Number(e.target.value))}
                      className="w-full h-1.5 accent-primary" title={t('rate')} />
                    <div className="flex justify-between text-[9px] text-muted-foreground/50">
                      <span>0.25x</span><span>1.0x</span><span>3.0x</span>
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px]">{t('pitch')}</Label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {nativeToSpeed(pitch, paramRanges.pitch.normal).toFixed(1)}x
                      </span>
                    </div>
                    <input type="range"
                      min={paramRanges.pitch.min}
                      max={paramRanges.pitch.max}
                      step={(paramRanges.pitch.max - paramRanges.pitch.min) / 40}
                      value={pitch}
                      onChange={e => applyPitch(Number(e.target.value))}
                      className="w-full h-1.5 accent-primary" title={t('pitch')} />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px]">{t('volume')}</Label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {Math.round((volume / paramRanges.volume.max) * 100)}%
                      </span>
                    </div>
                    <input type="range"
                      min={paramRanges.volume.min}
                      max={paramRanges.volume.max}
                      step={(paramRanges.volume.max - paramRanges.volume.min) / 20}
                      value={volume}
                      onChange={e => applyVolume(Number(e.target.value))}
                      className="w-full h-1.5 accent-primary" title={t('volume')} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═══ 折叠面板：文本内容 ═══ */}
        <div className="flex-shrink-0 border-t">
          <div className="flex items-center">
            <button onClick={toggleText}
              className="flex-1 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              {textOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {t('textPanel')}
              {charCount > 0 && (
                <span className="text-[10px] text-muted-foreground/50 ml-1">
                  {charCount.toLocaleString()} {t('charCount')}
                </span>
              )}
            </button>
            {textOpen && (
              <div className="flex items-center gap-0.5 pr-2">
                <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5" onClick={handleLoadContent}>
                  <Upload className="h-3 w-3" />{t('loadContent')}
                </Button>
                {customText && (
                  <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5 text-destructive hover:text-destructive"
                    onClick={handleClearContent}>
                    <Trash2 className="h-3 w-3" />{t('clearContent')}
                  </Button>
                )}
              </div>
            )}
          </div>
          {textOpen && (
            <div className="px-3 pb-2">
              <textarea value={customText} onChange={e => setCustomText(e.target.value)}
                placeholder={t('customTextPlaceholder')} rows={4}
                className="w-full px-2 py-1.5 text-xs border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                style={{ fontFamily: '"Songti SC", "SimSun", "STSong", serif', fontSize: `${fontSize}px`, maxHeight: '150px', overflow: 'auto' }}
                spellCheck={false} />
            </div>
          )}
        </div>
      </div>
    </ToolPluginLayout>
  );
}
