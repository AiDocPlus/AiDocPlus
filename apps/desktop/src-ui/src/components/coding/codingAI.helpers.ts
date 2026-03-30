import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { listen } from '@tauri-apps/api/event';
import { parseThinkTags } from '@/utils/thinkTagParser';

export interface ScriptRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export interface PipInstallResult {
  success: boolean;
  stdout: string;
  stderr: string;
  packages: string[];
}

export interface CodingAIInvokeParams {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

export interface StreamCodingChatParams {
  messages: Array<{ role: string; content: string }>;
  aiParams: CodingAIInvokeParams;
  onChunk: (text: string) => void;
  signal?: AbortSignal;
  requestId?: string;
  enableWebSearch?: boolean;
  enableThinking?: boolean;
}

export function createCodingStreamRequestId(now = Date.now()): string {
  return `coding_${now}`;
}

export function extractMissingModulesFromStderr(stderr: string): string[] {
  const modules: string[] = [];
  const regex = /ModuleNotFoundError:\s*No module named\s+'([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(stderr)) !== null) {
    const moduleName = match[1].split('.')[0];
    if (!modules.includes(moduleName)) {
      modules.push(moduleName);
    }
  }
  return modules;
}

export function cleanGeneratedCode(raw: string): string {
  let code = raw.trim();
  const openMatch = code.match(/^```[a-zA-Z]*\s*\n?/);
  if (openMatch) {
    code = code.slice(openMatch[0].length);
  }
  if (code.endsWith('```')) {
    code = code.slice(0, -3);
  }
  return code.trim();
}

export async function streamCodingChatResponse({
  messages,
  aiParams,
  onChunk,
  signal,
  requestId = createCodingStreamRequestId(),
  enableWebSearch,
  enableThinking,
}: StreamCodingChatParams): Promise<string> {
  let rawAccumulated = '';
  let prevContentLen = 0;

  if (signal?.aborted) {
    throw new Error('已取消');
  }

  const unlisten = await listen<{ request_id: string; content: string }>('ai:stream:chunk', (event) => {
    if (signal?.aborted) return;
    if (event.payload.request_id !== requestId) return;

    rawAccumulated += event.payload.content;
    const parsed = parseThinkTags(rawAccumulated);
    const currentLen = parsed.content.length;
    if (currentLen > prevContentLen) {
      onChunk(parsed.content.slice(prevContentLen));
      prevContentLen = currentLen;
    }
  });

  try {
    if (signal?.aborted) {
      throw new Error('已取消');
    }
    await invoke<string>('chat_stream', {
      messages,
      ...aiParams,
      requestId,
      enableWebSearch: enableWebSearch || undefined,
      enableThinking: enableThinking || undefined,
      maxTokens: (() => { const v = useSettingsStore.getState().ai.maxTokens; return (v && v > 0) ? v : undefined; })(),
    });
    return parseThinkTags(rawAccumulated).content;
  } finally {
    unlisten();
  }
}

export async function saveCodingScriptContentCommand(filePath: string, content: string): Promise<void> {
  await invoke('save_coding_script', { filePath, content });
}

export async function runNodeScriptCommand(params: {
  scriptPath: string;
  timeoutSecs: number;
  customNodePath: string;
}): Promise<ScriptRunResult> {
  return invoke<ScriptRunResult>('run_node_script', {
    scriptPath: params.scriptPath,
    timeoutSecs: params.timeoutSecs,
    customNodePath: params.customNodePath || null,
  });
}

export async function runPythonScriptCommand(params: {
  scriptPath: string;
  timeoutSecs: number;
  customPythonPath: string;
  extraArgs: string;
}): Promise<ScriptRunResult> {
  return invoke<ScriptRunResult>('run_python_script', {
    scriptPath: params.scriptPath,
    code: null,
    inputContent: null,
    outputPath: null,
    args: params.extraArgs.trim() ? params.extraArgs.trim().split(/\s+/) : null,
    timeoutSecs: params.timeoutSecs,
    customPythonPath: params.customPythonPath || null,
  });
}

export async function pipInstallCommand(packages: string[], customPythonPath: string): Promise<PipInstallResult> {
  return invoke<PipInstallResult>('pip_install', {
    packages,
    customPythonPath: customPythonPath || null,
  });
}
