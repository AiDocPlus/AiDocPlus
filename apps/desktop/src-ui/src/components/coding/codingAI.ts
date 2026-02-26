/**
 * 编程区 AI 自动化引擎
 * 
 * 完整自动化循环：
 * 1. 用户输入需求 → AI 生成代码
 * 2. 自动运行代码
 * 3. 检测错误（ModuleNotFoundError → 自动 pip install → 重试）
 * 4. 其他错误 → AI 自动修正 → 重试
 * 5. 最多重试 MAX_RETRIES 次
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getAIInvokeParamsForService } from '@/stores/useSettingsStore';
import { parseThinkTags } from '@/utils/thinkTagParser';
import { getDefaultSystemPrompt } from '@/stores/useCodingStore';
import type { AssistantMode } from '@/stores/useCodingStore';

const MAX_RETRIES = 3;

interface ScriptRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

interface PipInstallResult {
  success: boolean;
  stdout: string;
  stderr: string;
  packages: string[];
}

export interface AutoRunStep {
  type: 'generate' | 'run' | 'pip_install' | 'fix' | 'success' | 'fail';
  message: string;
  code?: string;
  output?: string;
  error?: string;
  packages?: string[];
}

export interface AutoRunCallbacks {
  onStep: (step: AutoRunStep) => void;
  onCodeUpdate: (code: string) => void;
  signal?: AbortSignal;
}

/** 从 stderr 中提取缺失的模块名 */
function extractMissingModules(stderr: string): string[] {
  const modules: string[] = [];
  // ModuleNotFoundError: No module named 'xxx'
  const re = /ModuleNotFoundError:\s*No module named\s+'([^']+)'/g;
  let m;
  while ((m = re.exec(stderr)) !== null) {
    const mod = m[1].split('.')[0]; // 取顶层包名
    if (!modules.includes(mod)) modules.push(mod);
  }
  return modules;
}

/** AI 流式调用选项 */
export interface AIChatOptions {
  enableWebSearch?: boolean;
  enableThinking?: boolean;
  serviceId?: string;
}

/** 调用 AI 流式生成（独立于 ChatPanel） */
async function aiChatStream(
  messages: Array<{ role: string; content: string }>,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
  options?: AIChatOptions,
): Promise<string> {
  const aiParams = getAIInvokeParamsForService(options?.serviceId || undefined);
  if (!aiParams.provider || !aiParams.apiKey || !aiParams.model) {
    throw new Error('AI 服务未配置，请先在设置中配置 AI 服务');
  }

  const requestId = `coding_${Date.now()}`;
  let rawAccumulated = '';
  let prevContentLen = 0;

  if (signal?.aborted) throw new Error('已取消');

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
    if (signal?.aborted) throw new Error('已取消');
    await invoke<string>('chat_stream', {
      messages,
      ...aiParams,
      requestId,
      enableWebSearch: options?.enableWebSearch || undefined,
      enableThinking: options?.enableThinking || undefined,
    });
    const finalParsed = parseThinkTags(rawAccumulated);
    return finalParsed.content;
  } finally {
    unlisten();
  }
}

/** 清理 AI 生成的代码（去掉 markdown 代码块标记，支持所有语言） */
function cleanCode(raw: string): string {
  let code = raw.trim();
  // 匹配 ```lang 开头（支持 python/py/javascript/js/typescript/ts/html/json/markdown/css 等）
  const openMatch = code.match(/^```[a-zA-Z]*\s*\n?/);
  if (openMatch) code = code.slice(openMatch[0].length);
  if (code.endsWith('```')) code = code.slice(0, -3);
  return code.trim();
}

/** 按语言生成自动运行的系统提示词 */
function getAutoRunSystemPrompt(language: string): string {
  if (language === 'javascript' || language === 'typescript') {
    const langName = language === 'typescript' ? 'TypeScript' : 'JavaScript';
    return `你是一个 ${langName} 编程助手。用户会描述需要的脚本功能，你直接输出可运行的 ${langName} 代码。
要求：
- 只输出 ${langName} 代码，不要添加 markdown 代码块标记
- 代码应该完整可运行（使用 Node.js 执行）
- 使用 UTF-8 编码
- 如果需要读取文档内容，使用 process.env.AIDOCPLUS_INPUT_FILE 获取输入文件路径
- 如果需要输出文件，使用 process.env.AIDOCPLUS_OUTPUT_FILE 获取输出路径
- 输出结果使用 console.log()
- 添加适当的中文注释`;
  }
  // 默认 Python
  return `你是一个 Python 编程助手。用户会描述需要的 Python 脚本功能，你直接输出可运行的 Python 代码。
要求：
- 只输出 Python 代码，不要添加 markdown 代码块标记
- 代码应该完整可运行
- 使用 UTF-8 编码
- 如果需要读取文档内容，使用 os.environ.get('AIDOCPLUS_INPUT_FILE') 获取输入文件路径
- 如果需要输出文件，使用 os.environ.get('AIDOCPLUS_OUTPUT_FILE') 获取输出路径
- 输出结果尽量使用 Markdown 格式的 print()，方便后续处理
- 添加适当的中文注释`;
}

/** 按语言生成修正提示词 */
function getFixPrompt(language: string, code: string, error: string): string {
  const langName = language === 'typescript' ? 'TypeScript' : language === 'javascript' ? 'JavaScript' : 'Python';
  const codeLang = language === 'typescript' ? 'typescript' : language === 'javascript' ? 'javascript' : 'python';
  return `以下 ${langName} 代码运行出错了，请修正代码使其正确运行。
只输出修正后的完整 ${langName} 代码，不要添加 markdown 代码块标记，不要解释。

原始代码：
\`\`\`${codeLang}
${code}
\`\`\`

错误输出：
\`\`\`
${error}
\`\`\``;
}

/** 
 * AI 自动化完整循环：生成 → 运行 → 检测 → 修正 → 重试
 */
export async function aiAutoRun(
  prompt: string,
  scriptPath: string,
  settings: { timeout: number; customPythonPath: string; customNodePath: string; extraArgs: string },
  callbacks: AutoRunCallbacks,
  language: string = 'python',
): Promise<void> {
  const { onStep, onCodeUpdate, signal } = callbacks;

  const isPython = language === 'python';
  const isNode = language === 'javascript' || language === 'typescript';

  // ── 第1步：AI 生成代码 ──
  onStep({ type: 'generate', message: '🤖 AI 正在生成代码...' });
  let code = '';
  try {
    const raw = await aiChatStream(
      [
        { role: 'system', content: getAutoRunSystemPrompt(language) },
        { role: 'user', content: prompt },
      ],
      (chunk) => { code += chunk; },
      signal,
    );
    code = cleanCode(raw);
  } catch (err) {
    if (signal?.aborted) return;
    onStep({ type: 'fail', message: `❌ AI 生成失败: ${err}`, error: String(err) });
    return;
  }

  if (!code.trim()) {
    onStep({ type: 'fail', message: '❌ AI 未生成有效代码' });
    return;
  }

  onCodeUpdate(code);
  onStep({ type: 'generate', message: '✅ 代码已生成', code });

  // ── 循环：运行 → 检测 → 修正 ──
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) return;

    // 保存代码到文件
    try {
      await invoke('save_coding_script', { filePath: scriptPath, content: code });
    } catch (e) {
      onStep({ type: 'fail', message: `❌ 保存文件失败: ${e}` });
      return;
    }

    // 运行
    onStep({ type: 'run', message: `▶ 运行脚本 (第 ${attempt + 1} 次)...` });
    let result: ScriptRunResult;
    try {
      if (isNode) {
        result = await invoke<ScriptRunResult>('run_node_script', {
          scriptPath,
          timeoutSecs: settings.timeout,
          customNodePath: settings.customNodePath || null,
        });
      } else {
        result = await invoke<ScriptRunResult>('run_python_script', {
          scriptPath,
          code: null,
          inputContent: null,
          outputPath: null,
          args: settings.extraArgs.trim() ? settings.extraArgs.trim().split(/\s+/) : null,
          timeoutSecs: settings.timeout,
          customPythonPath: settings.customPythonPath || null,
        });
      }
    } catch (e) {
      onStep({ type: 'fail', message: `❌ 运行失败: ${e}`, error: String(e) });
      return;
    }

    // 成功
    if (result.exitCode === 0) {
      onStep({
        type: 'success',
        message: `✅ 运行成功 (${(result.durationMs / 1000).toFixed(2)}s)`,
        output: result.stdout,
      });
      return;
    }

    // 超时
    if (result.timedOut) {
      onStep({ type: 'fail', message: `⏱ 执行超时 (${settings.timeout}s)`, error: result.stderr });
      return;
    }

    // 最后一次重试也失败了
    if (attempt >= MAX_RETRIES) {
      onStep({
        type: 'fail',
        message: `❌ 经过 ${MAX_RETRIES + 1} 次尝试仍然失败`,
        output: result.stdout,
        error: result.stderr,
      });
      return;
    }

    const errorOutput = (result.stderr || '') + '\n' + (result.stdout || '');

    // 检测缺失模块 → pip install（仅 Python）
    if (isPython) {
      const missingModules = extractMissingModules(result.stderr);
      if (missingModules.length > 0) {
        onStep({
          type: 'pip_install',
          message: `📦 安装缺失的库: ${missingModules.join(', ')}`,
          packages: missingModules,
        });

        try {
          const pipResult = await invoke<PipInstallResult>('pip_install', {
            packages: missingModules,
            customPythonPath: settings.customPythonPath || null,
          });
          if (pipResult.success) {
            onStep({ type: 'pip_install', message: `✅ 安装成功: ${missingModules.join(', ')}`, packages: missingModules });
            // pip 安装成功后直接重试，不需要修改代码
            continue;
          } else {
            onStep({
              type: 'pip_install',
              message: `⚠️ 安装失败: ${pipResult.stderr}`,
              error: pipResult.stderr,
              packages: missingModules,
            });
            // 安装失败，交给 AI 修正
          }
        } catch (e) {
          onStep({ type: 'pip_install', message: `⚠️ pip 命令失败: ${e}`, error: String(e) });
        }
      }
    }

    // AI 自动修正代码
    if (signal?.aborted) return;
    onStep({ type: 'fix', message: `🔧 AI 正在修正代码 (第 ${attempt + 1} 次)...` });

    let fixedCode = '';
    try {
      const fixPrompt = getFixPrompt(language, code, errorOutput.slice(0, 2000));

      const raw = await aiChatStream(
        [
          { role: 'system', content: getAutoRunSystemPrompt(language) },
          { role: 'user', content: fixPrompt },
        ],
        (chunk) => { fixedCode += chunk; },
        signal,
      );
      fixedCode = cleanCode(raw);
    } catch (err) {
      if (signal?.aborted) return;
      onStep({ type: 'fail', message: `❌ AI 修正失败: ${err}`, error: String(err) });
      return;
    }

    if (fixedCode.trim()) {
      code = fixedCode;
      onCodeUpdate(code);
      onStep({ type: 'fix', message: '✅ 代码已修正', code });
    } else {
      onStep({ type: 'fail', message: '❌ AI 未能生成修正代码' });
      return;
    }
  }
}

/** 检查 AI 服务是否可用 */
export function isAIAvailable(): boolean {
  const aiParams = getAIInvokeParamsForService();
  return !!(aiParams.provider && aiParams.apiKey && aiParams.model);
}

// ═══════════════════════════════════════════════════════
// 对话式 AI 助手（CodingAssistantPanel 专用）
// ═══════════════════════════════════════════════════════

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** assistant 消息中提取的代码块 */
  codeBlocks?: string[];
}


/** 从 AI 回复中提取代码块 */
export function extractCodeBlocks(content: string): string[] {
  const blocks: string[] = [];
  // 匹配任意语言标记的代码块，或无标记的代码块
  const re = /```(?:[a-zA-Z]*)?\s*\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const code = m[1].trim();
    if (code) blocks.push(code);
  }
  return blocks;
}

/** 根据语言生成模式补充提示词 */
function getModeSupplement(mode: AssistantMode, language?: string): string {
  if (mode === 'plan') return `\n\n【计划模式】\n- 将任务分解为清晰的编号步骤（1. 2. 3. ...）\n- 每步说明目标、实现方式和预期结果\n- 评估技术可行性和潜在风险\n- 不要直接给代码，先给计划`;
  if (mode === 'code') {
    const lang = language || 'python';
    const langLabel = lang === 'typescript' ? 'TypeScript' : lang === 'javascript' ? 'JavaScript' : lang === 'html' ? 'HTML' : lang === 'python' ? 'Python' : lang;
    return `\n\n【代码模式】\n- 直接输出完整可运行的 ${langLabel} 代码\n- 代码放在 \`\`\`${lang} 代码块中\n- 不要输出部分代码或伪代码\n- 如需解释，放在代码块之后，尽量简短`;
  }
  return '';
}

/** 构建上下文感知的消息列表 */
export function buildContextMessages(
  history: ChatMessage[],
  context: {
    currentCode?: string;
    selectedCode?: string;
    lastOutput?: string;
    lastError?: string;
    fileName?: string;
    customSystemPrompt?: string;
    mode?: AssistantMode;
    language?: string;
  },
): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // 系统提示（优先使用自定义提示词）
  let systemContent = (context.customSystemPrompt && context.customSystemPrompt.trim()) || getDefaultSystemPrompt(context.language);
  // 追加模式补充
  const modeSupplement = getModeSupplement(context.mode || 'chat', context.language);
  if (modeSupplement) systemContent += modeSupplement;
  if (context.currentCode || context.lastOutput || context.lastError) {
    systemContent += '\n\n--- 当前上下文 ---';
    if (context.fileName) systemContent += `\n文件名: ${context.fileName}`;
    const codeLang = context.language || 'python';
    if (context.currentCode) systemContent += `\n\n当前代码:\n\`\`\`${codeLang}\n${context.currentCode.slice(0, 4000)}\n\`\`\``;
    if (context.selectedCode) systemContent += `\n\n用户选中的代码片段:\n\`\`\`${codeLang}\n${context.selectedCode.slice(0, 2000)}\n\`\`\``;
    if (context.lastOutput) systemContent += `\n\n最近运行输出:\n\`\`\`\n${context.lastOutput.slice(0, 2000)}\n\`\`\``;
    if (context.lastError) systemContent += `\n\n最近错误:\n\`\`\`\n${context.lastError.slice(0, 2000)}\n\`\`\``;
  }
  messages.push({ role: 'system', content: systemContent });

  // 对话历史（最多保留最近 20 条）
  const recent = history.filter(m => m.role !== 'system').slice(-20);
  for (const msg of recent) {
    messages.push({ role: msg.role, content: msg.content });
  }

  return messages;
}

/** 流式对话 —— 供 CodingAssistantPanel 调用 */
export async function chatWithAssistant(
  messages: Array<{ role: string; content: string }>,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
  options?: AIChatOptions,
): Promise<string> {
  return aiChatStream(messages, onChunk, signal, options);
}

// ── 快捷操作提示词 ──

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  needsError: boolean;
  buildPrompt: (ctx: { code: string; error: string }, language?: string) => string;
}

export const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    id: 'fix',
    icon: 'Wrench',
    label: '修正错误',
    needsError: true,
    buildPrompt: (ctx: { code: string; error: string }, _language?: string) =>
      `以下代码运行出错，请修正：\n\n错误信息:\n\`\`\`\n${ctx.error.slice(0, 2000)}\n\`\`\`\n\n请给出修正后的完整代码。`,
  },
  {
    id: 'explain',
    icon: 'BookOpen',
    label: '解释代码',
    needsError: false,
    buildPrompt: (_ctx: { code: string; error: string }, _language?: string) => '请解释当前代码的功能、逻辑流程和关键部分。',
  },
  {
    id: 'optimize',
    icon: 'Zap',
    label: '优化代码',
    needsError: false,
    buildPrompt: (_ctx: { code: string; error: string }, _language?: string) => '请优化当前代码的性能和可读性，给出优化后的完整代码并说明改进点。',
  },
  {
    id: 'deps',
    icon: 'Package',
    label: '安装依赖',
    needsError: false,
    buildPrompt: (_ctx: { code: string; error: string }, language?: string) => {
      if (language === 'javascript' || language === 'typescript') return '请分析当前代码需要哪些第三方 npm 包，列出 npm install 命令。';
      return '请分析当前代码需要哪些第三方 Python 库（不含标准库），列出 pip install 命令。';
    },
  },
  {
    id: 'doc',
    icon: 'FileText',
    label: '生成文档',
    needsError: false,
    buildPrompt: (_ctx: { code: string; error: string }, _language?: string) => '请根据当前代码的功能，生成一段 Markdown 格式的使用说明文档。',
  },
  {
    id: 'test',
    icon: 'FlaskConical',
    label: '添加测试',
    needsError: false,
    buildPrompt: (_ctx: { code: string; error: string }, language?: string) => {
      if (language === 'javascript' || language === 'typescript') return '请为当前代码编写单元测试，给出完整的测试代码。';
      return '请为当前代码编写单元测试，使用 pytest 或 unittest 框架，给出完整的测试代码。';
    },
  },
];

export type QuickActionId = typeof QUICK_ACTIONS[number]['id'];

/** 简单逐行 diff（LCS 算法） */
export interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
}

export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const m = oldLines.length, n = newLines.length;

  // LCS 表
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp.push(new Array(n + 1).fill(0));
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = oldLines[i - 1] === newLines[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // 回溯生成 diff
  const result: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.push({ type: 'same', text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: 'add', text: newLines[j - 1] });
      j--;
    } else {
      result.push({ type: 'del', text: oldLines[i - 1] });
      i--;
    }
  }
  return result.reverse();
}
