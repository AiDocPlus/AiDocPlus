import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { detectLangFromExt, nextTabId } from '@/stores/useCodingStore';
import type { CodingTab, CodingSettings } from '@/stores/useCodingStore';

export const DEFAULT_CODE = `# Python 脚本
# 可通过环境变量获取文档内容：
#   import os
#   input_file = os.environ.get('AIDOCPLUS_INPUT_FILE')
#   if input_file:
#       with open(input_file, 'r', encoding='utf-8') as f:
#           content = f.read()

print("Hello from Python!")
`;

export const DEFAULT_TEMPLATES: Record<string, string> = {
  python: DEFAULT_CODE,
  html: `<!DOCTYPE html>\n<html lang="zh">\n<head>\n    <meta charset="UTF-8">\n    <title>文档</title>\n</head>\n<body>\n    <h1>Hello</h1>\n</body>\n</html>\n`,
  javascript: `// JavaScript\nconsole.log("Hello!");\n`,
  typescript: `// TypeScript\nconsole.log("Hello!");\n`,
  json: `{\n    \n}\n`,
  markdown: `# 标题\n\n正文内容\n`,
  css: `/* CSS */\nbody {\n    margin: 0;\n    padding: 0;\n}\n`,
  text: '',
};

export const NEW_FILE_TYPES = [
  { ext: 'py', label: 'Python', lang: 'python' },
  { ext: 'html', label: 'HTML', lang: 'html' },
  { ext: 'js', label: 'JavaScript', lang: 'javascript' },
  { ext: 'ts', label: 'TypeScript', lang: 'typescript' },
  { ext: 'json', label: 'JSON', lang: 'json' },
  { ext: 'md', label: 'Markdown', lang: 'markdown' },
  { ext: 'css', label: 'CSS', lang: 'css' },
  { ext: 'txt', label: '纯文本', lang: 'text' },
] as const;

export const SUPPORTED_EXTENSIONS = ['py', 'html', 'htm', 'js', 'jsx', 'ts', 'tsx', 'json', 'md', 'css', 'txt', 'xml', 'yaml', 'yml', 'toml', 'sh', 'sql'];

export function createUntitledFileName(existingPaths: string[], ext: string): string {
  let index = 1;
  while (existingPaths.includes(`untitled_${index}.${ext}`)) {
    index += 1;
  }
  return `untitled_${index}.${ext}`;
}

export function createUntitledCodingTab(fileName: string, lang: string): CodingTab {
  return {
    id: nextTabId(),
    filePath: fileName,
    title: fileName,
    code: DEFAULT_TEMPLATES[lang] || '',
    language: lang,
    dirty: true,
    outputLines: [],
    lastExitCode: null,
  };
}

export function createLoadedCodingTab(filePath: string, code: string): CodingTab {
  const fileName = filePath.split(/[/\\]/).pop() || 'untitled.txt';
  return {
    id: nextTabId(),
    filePath,
    title: fileName,
    code,
    language: detectLangFromExt(fileName),
    dirty: false,
    outputLines: [],
    lastExitCode: null,
  };
}

export function findOpenedCodingTab(tabs: CodingTab[], filePath: string): CodingTab | undefined {
  return tabs.find(tab => tab.filePath === filePath);
}

export async function readCodingPanelScriptCommand(filePath: string): Promise<string> {
  return invoke<string>('read_coding_script', { filePath });
}

export async function readExternalFileCommand(path: string): Promise<string | null> {
  return invoke<string>('read_external_file', { path }).catch(() => null);
}

export async function saveCodingPanelScriptCommand(filePath: string, content: string): Promise<void> {
  await invoke('save_coding_script', { filePath, content });
}

export interface ScriptRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export interface CodingOutputLine {
  text: string;
  type: 'stdout' | 'stderr' | 'info';
}

export interface CodingOutputChunkEvent {
  stream: string;
  text: string;
}

export interface CodingOutputDoneEvent {
  exitCode: number | null;
  timedOut: boolean;
  killed: boolean;
  durationMs: number;
}

export interface ResolvedCodingRunContext {
  cmdLabel: 'python' | 'node';
  interpreter: string;
  scriptPath: string;
  args: string[] | null;
  envVars: Record<string, string> | null;
  timeoutSecs: number;
}

export function createCodingOutputHeaderLine(cmdLabel: 'python' | 'node', title: string): CodingOutputLine {
  return { text: `$ ${cmdLabel} ${title}`, type: 'info' };
}

export function appendCodingOutputLine(lines: CodingOutputLine[], line: CodingOutputLine): CodingOutputLine[] {
  return [...lines, line];
}

export function createCodingRunResult(payload: CodingOutputDoneEvent): ScriptRunResult {
  return {
    stdout: '',
    stderr: '',
    exitCode: payload.exitCode,
    timedOut: payload.timedOut,
    durationMs: payload.durationMs,
  };
}

export function resolveCodingRunContext(params: {
  language: string;
  filePath: string;
  title: string;
  scriptsDir: string;
  timeout: number;
  extraArgs: string;
  customPythonPath: string;
  customNodePath: string;
  pythonPath?: string | null;
  nodePath?: string | null;
  specifyOutput: boolean;
  outputPath: string;
  envVars: Record<string, string>;
}): ResolvedCodingRunContext | null {
  const isPython = params.language === 'python';
  const isNode = params.language === 'javascript' || params.language === 'typescript';
  if (!isPython && !isNode) {
    return null;
  }

  const isAbsolute = params.filePath.startsWith('/') || /^[a-zA-Z]:/.test(params.filePath);
  const mergedEnvVars: Record<string, string> = { ...(params.envVars || {}) };
  if (params.specifyOutput && params.outputPath) {
    mergedEnvVars.AIDOCPLUS_OUTPUT_FILE = params.outputPath;
  }

  return {
    cmdLabel: isPython ? 'python' : 'node',
    interpreter: isPython
      ? (params.customPythonPath || params.pythonPath || 'python3')
      : (params.customNodePath || params.nodePath || 'node'),
    scriptPath: isAbsolute ? params.filePath : `${params.scriptsDir}/${params.filePath}`,
    args: params.extraArgs.trim() ? params.extraArgs.trim().split(/\s+/) : null,
    envVars: Object.keys(mergedEnvVars).length > 0 ? mergedEnvVars : null,
    timeoutSecs: params.timeout,
  };
}

export async function attachCodingRunListeners(params: {
  onChunk: (payload: CodingOutputChunkEvent) => void;
  onDone: (payload: CodingOutputDoneEvent) => void;
}): Promise<() => void> {
  const unlistenChunk = await listen<CodingOutputChunkEvent>('coding:output:chunk', (event) => {
    params.onChunk(event.payload);
  });
  const unlistenDone = await listen<CodingOutputDoneEvent>('coding:output:done', (event) => {
    params.onDone(event.payload);
  });
  return () => {
    unlistenChunk();
    unlistenDone();
  };
}

export async function runScriptStreamCommand(context: ResolvedCodingRunContext): Promise<void> {
  await invoke('run_script_stream', {
    interpreter: context.interpreter,
    scriptPath: context.scriptPath,
    args: context.args,
    envVars: context.envVars,
    timeoutSecs: context.timeoutSecs,
    cwd: null,
  });
}

export async function killRunningScriptCommand(): Promise<void> {
  await invoke('kill_running_script');
}

export function isPythonCodingLanguage(language: string): boolean {
  return language === 'python';
}

export function isNodeCodingLanguage(language: string): boolean {
  return language === 'javascript' || language === 'typescript';
}

export function isPreviewableCodingLanguage(language: string): boolean {
  return language === 'html' || language === 'markdown';
}

export function canRunCodingLanguage(params: {
  language: string;
  pythonAvailable?: boolean;
  pythonDetecting: boolean;
  nodeAvailable?: boolean;
  nodeDetecting: boolean;
}): boolean {
  if (isPythonCodingLanguage(params.language)) {
    return !!params.pythonAvailable && !params.pythonDetecting;
  }
  if (isNodeCodingLanguage(params.language)) {
    return !!params.nodeAvailable && !params.nodeDetecting;
  }
  return false;
}

export function addCodingEnvVar(envVars: Record<string, string>): Record<string, string> {
  const next = { ...envVars };
  const key = `VAR_${Object.keys(next).length + 1}`;
  next[key] = '';
  return next;
}

export function renameCodingEnvVar(
  envVars: Record<string, string>,
  oldKey: string,
  newKey: string,
): Record<string, string> {
  const next = { ...envVars };
  const value = next[oldKey];
  delete next[oldKey];
  next[newKey] = value;
  return next;
}

export function updateCodingEnvVarValue(
  envVars: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  return {
    ...envVars,
    [key]: value,
  };
}

export function removeCodingEnvVar(envVars: Record<string, string>, key: string): Record<string, string> {
  const next = { ...envVars };
  delete next[key];
  return next;
}

export function createCodingStringSettingPatch<
  Key extends 'customPythonPath' | 'customNodePath' | 'outputPath' | 'extraArgs' | 'editorTheme',
>(key: Key, value: string): Pick<CodingSettings, Key> {
  return {
    [key]: value,
  } as Pick<CodingSettings, Key>;
}

export function createCodingNumberSettingPatch<Key extends 'timeout' | 'fontSize'>(
  key: Key,
  value: number,
): Pick<CodingSettings, Key> {
  return {
    [key]: value,
  } as Pick<CodingSettings, Key>;
}

export function createCodingBooleanSettingPatch<Key extends 'passDocContent' | 'specifyOutput'>(
  key: Key,
  value: boolean,
): Pick<CodingSettings, Key> {
  return {
    [key]: value,
  } as Pick<CodingSettings, Key>;
}

export function buildCodingOutputPreviewText(lines: CodingOutputLine[]): string {
  return lines.filter(line => line.type === 'stdout').map(line => line.text).join('\n');
}

export function shouldRenderCodingOutputAsHtml(language: string, outputText: string): boolean {
  return language === 'html' || /^\s*<!DOCTYPE|^\s*<html/i.test(outputText);
}

export function getCodingOutputEmptyHint(params: {
  language: string;
  isMac: boolean;
  runLabel: string;
  previewLabel: string;
  editLabel: string;
}): string {
  if (isPythonCodingLanguage(params.language) || isNodeCodingLanguage(params.language)) {
    return `${params.isMac ? '⌘' : 'Ctrl'}+Shift+Enter ${params.runLabel}`;
  }
  if (isPreviewableCodingLanguage(params.language)) {
    return params.previewLabel;
  }
  return params.editLabel;
}

export function getCodingRuntimeLabel(params: {
  language: string;
  pythonPath?: string | null;
  nodePath?: string | null;
}): string {
  if (isPythonCodingLanguage(params.language)) {
    return params.pythonPath || 'Python';
  }
  if (isNodeCodingLanguage(params.language)) {
    return params.nodePath || 'Node.js';
  }
  return params.language.toUpperCase();
}

export function getCodingApiTooltip(language: string, apiPort: number | null | undefined): string {
  return `API Server :${apiPort ?? '-'}\n\n${isPythonCodingLanguage(language)
    ? 'Python SDK:\nimport aidocplus\napi = aidocplus.connect()'
    : isNodeCodingLanguage(language)
      ? 'JavaScript SDK:\nconst aidocplus = require("aidocplus");\nconst api = aidocplus.connect();'
      : 'Python: import aidocplus\nJS: const aidocplus = require("aidocplus")'}`;
}
