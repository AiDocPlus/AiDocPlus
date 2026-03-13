import { useState, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import { useCodingStore } from '@/stores/useCodingStore';
import { formatBackendError } from '@/lib/backendError';
import type { CodingTab } from '@/stores/useCodingStore';
import type { ScriptRunResult } from './CodingPanel.constants';

interface ScriptRunnerOptions {
  activeTab: CodingTab | undefined;
  showStatus: (msg: string, isError?: boolean) => void;
}

export function useCodingScriptRunner({ activeTab, showStatus }: ScriptRunnerOptions) {
  const { t } = useTranslation();
  const store = useCodingStore();
  const { settings, scriptsDir, updateTab, addRunHistory } = store;

  const pythonInfo = store.pythonInfo;
  const detecting = store.pythonDetecting;
  const nodeInfo = store.nodeInfo;
  const nodeDetecting = store.nodeDetecting;

  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<ScriptRunResult | null>(null);

  const activeLang = activeTab?.language || 'text';

  /** 判断当前语言是否支持运行 */
  const canRun = useMemo(() => {
    if (activeLang === 'python') return pythonInfo?.available && !detecting;
    if (activeLang === 'javascript' || activeLang === 'typescript') return nodeInfo?.available && !nodeDetecting;
    return false;
  }, [activeLang, pythonInfo, detecting, nodeInfo, nodeDetecting]);

  // 用于存储流式输出行的 ref（避免闭包捕获旧值）
  const streamLinesRef = useRef<Array<{ text: string; type: 'stdout' | 'stderr' | 'info' }>>([]);

  const handleRun = useCallback(async () => {
    if (running || !activeTab) return;

    const lang = activeTab.language || 'python';
    const isPython = lang === 'python';
    const isNode = lang === 'javascript' || lang === 'typescript';

    if (isPython && !pythonInfo?.available) { showStatus(t('coding.pythonNotFound', { defaultValue: '未找到 Python' }), true); return; }
    if (isNode && !nodeInfo?.available) { showStatus('未找到 Node.js', true); return; }
    if (!isPython && !isNode) return;

    setRunning(true);
    setLastResult(null);
    const cmdLabel = isPython ? 'python' : 'node';
    const headerLine = { text: `$ ${cmdLabel} ${activeTab.title}`, type: 'info' as const };
    streamLinesRef.current = [headerLine];
    updateTab(activeTab.id, { outputLines: [headerLine], lastExitCode: null });

    // 先保存文件再运行
    try {
      await invoke('save_coding_script', { filePath: activeTab.filePath, content: activeTab.code });
      updateTab(activeTab.id, { dirty: false });
    } catch { /* ignore save error, still try to run */ }

    const argsArr = settings.extraArgs.trim() ? settings.extraArgs.trim().split(/\s+/) : undefined;
    const isAbsolute = activeTab.filePath.startsWith('/') || /^[a-zA-Z]:/.test(activeTab.filePath);
    const scriptFullPath = isAbsolute ? activeTab.filePath : `${scriptsDir}/${activeTab.filePath}`;

    const interpreter = isPython
      ? (settings.customPythonPath || pythonInfo?.path || 'python3')
      : (settings.customNodePath || nodeInfo?.path || 'node');

    const tabId = activeTab.id;

    // 监听实时输出
    const unlistenChunk = await listen<{ stream: string; text: string }>('coding:output:chunk', (event) => {
      const { stream, text } = event.payload;
      const line = { text, type: (stream === 'stderr' ? 'stderr' : 'stdout') as 'stdout' | 'stderr' };
      streamLinesRef.current = [...streamLinesRef.current, line];
      updateTab(tabId, { outputLines: [...streamLinesRef.current] });
    });

    // 监听完成事件
    const unlistenDone = await listen<{ exitCode: number | null; timedOut: boolean; killed: boolean; durationMs: number }>('coding:output:done', (event) => {
      const { exitCode, timedOut, killed, durationMs } = event.payload;

      if (timedOut) {
        streamLinesRef.current = [...streamLinesRef.current, { text: `⏱ ${t('coding.timedOut', { defaultValue: '执行超时' })} (${settings.timeout}s)`, type: 'info' }];
        showStatus(t('coding.timedOut', { defaultValue: '执行超时' }), true);
      } else if (killed) {
        streamLinesRef.current = [...streamLinesRef.current, { text: `⚠ ${t('coding.killed', { defaultValue: '已终止' })}`, type: 'info' }];
        showStatus(t('coding.killed', { defaultValue: '已终止' }), true);
      } else if (exitCode === 0) {
        showStatus(`✅ ${(durationMs / 1000).toFixed(2)}s`);
      } else {
        showStatus(`❌ ${t('coding.exitCode', { defaultValue: '退出码' })}: ${exitCode}`, true);
      }

      setLastResult({ stdout: '', stderr: '', exitCode, timedOut, durationMs } as ScriptRunResult);
      updateTab(tabId, { outputLines: [...streamLinesRef.current], lastExitCode: exitCode });
      addRunHistory({
        id: `run_${Date.now()}`,
        fileName: activeTab.title,
        language: lang,
        exitCode,
        durationMs,
        timestamp: Date.now(),
      });
      setRunning(false);
      unlistenChunk();
      unlistenDone();
    });

    // 发起流式运行
    try {
      const envVars: Record<string, string> = { ...(settings.envVars || {}) };
      if (settings.specifyOutput && settings.outputPath) envVars['AIDOCPLUS_OUTPUT_FILE'] = settings.outputPath;
      await invoke('run_script_stream', {
        interpreter,
        scriptPath: scriptFullPath,
        args: argsArr || null,
        envVars: Object.keys(envVars).length > 0 ? envVars : null,
        timeoutSecs: settings.timeout,
        cwd: null,
      });
    } catch (err) {
      unlistenChunk();
      unlistenDone();
      updateTab(tabId, {
        outputLines: [headerLine, { text: formatBackendError(err), type: 'stderr' }],
      });
      showStatus(formatBackendError(err), true);
      setRunning(false);
    }
  }, [running, activeTab, pythonInfo, nodeInfo, settings, scriptsDir, showStatus, t, updateTab, addRunHistory]);

  const handleKillScript = useCallback(async () => {
    try {
      await invoke('kill_running_script');
    } catch { /* ignore */ }
  }, []);

  return {
    running,
    lastResult,
    setLastResult,
    canRun,
    handleRun,
    handleKillScript,
    pythonInfo,
    detecting,
    nodeInfo,
    nodeDetecting,
  };
}
