import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

// ── 类型 ──

/** 从文件名推断语言标识 */
export function detectLangFromExt(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    py: 'python', pyw: 'python',
    html: 'html', htm: 'html',
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    json: 'json',
    md: 'markdown', markdown: 'markdown',
    css: 'css', scss: 'css', less: 'css',
    xml: 'xml', svg: 'xml',
    yaml: 'yaml', yml: 'yaml',
    toml: 'toml',
    sh: 'shell', bash: 'shell', zsh: 'shell',
    sql: 'sql',
    txt: 'text',
  };
  return map[ext] || 'text';
}

export interface CodingChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  codeBlocks?: string[];
}

export interface CodingTab {
  id: string;
  filePath: string;       // 相对路径（CodingScripts 目录内）或绝对路径（外部文件）
  title: string;
  code: string;
  language: string;       // 语言标识，由文件扩展名推断
  dirty: boolean;
  outputLines: Array<{ text: string; type: 'stdout' | 'stderr' | 'info' }>;
  lastExitCode: number | null;
  chatMessages?: CodingChatMessage[];
}

export type AssistantMode = 'chat' | 'code' | 'plan';

export interface RuntimeCheckResult {
  available: boolean;
  version: string | null;
  path: string | null;
  error: string | null;
}

export interface CodingSettings {
  timeout: number;
  customPythonPath: string;
  customNodePath: string;
  extraArgs: string;
  fontSize: number;
  passDocContent: boolean;
  specifyOutput: boolean;
  outputPath: string;
  systemPrompt: string;
  assistantMode: AssistantMode;
  enableWebSearch: boolean;
  enableThinking: boolean;
  codingServiceId: string;
  envVars: Record<string, string>;
  editorTheme: string;
  // 布局记忆
  outputHeight: number;
  assistantWidth: number;
  assistantOpen: boolean;
  fileTreeOpen: boolean;
  fileTreeWidth: number;
}

export interface RunHistoryEntry {
  id: string;
  fileName: string;
  language: string;
  exitCode: number | null;
  durationMs: number;
  timestamp: number;
}

interface CodingState {
  // 状态
  tabs: CodingTab[];
  activeTabId: string;
  favorites: string[];
  settings: CodingSettings;
  scriptsDir: string;
  initialized: boolean;
  runHistory: RunHistoryEntry[];
  recentFiles: string[];

  // 运行时环境缓存
  pythonInfo: RuntimeCheckResult | null;
  nodeInfo: RuntimeCheckResult | null;
  pythonDetecting: boolean;
  nodeDetecting: boolean;

  // 动作
  init: () => Promise<void>;
  persistState: () => void;
  detectPython: (force?: boolean) => Promise<void>;
  detectNode: (force?: boolean) => Promise<void>;

  // 标签页
  addTab: (tab: CodingTab) => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTab: (tabId: string, patch: Partial<CodingTab>) => void;

  // 文件
  saveFile: (tabId: string) => Promise<void>;
  loadFile: (filePath: string) => Promise<string>;

  // 收藏
  toggleFavorite: (filePath: string) => void;

  // 标签页排序
  reorderTabs: (fromId: string, toId: string) => void;

  // 设置
  updateSettings: (patch: Partial<CodingSettings>) => void;

  // 运行历史
  addRunHistory: (entry: RunHistoryEntry) => void;
  clearRunHistory: () => void;

  // 最近文件
  addRecentFile: (filePath: string) => void;
  clearRecentFiles: () => void;
}

// ── 按语言的默认系统提示词 ──

const SYSTEM_PROMPT_COMMON_SUFFIX = `
回复要求：
- 使用中文回复
- 回复简洁实用，不要过度冗长
- 如果给出代码修改，给出完整可运行的代码`;

const SYSTEM_PROMPTS: Record<string, string> = {
  python: `你是 AiDocPlus 编程区的 AI 助手，专门帮助用户编写和调试 Python 脚本。
你的核心目标是帮助用户（可能不懂编程）通过 Python 脚本生成文档内容。

能力：
- 根据用户的自然语言描述生成完整可运行的 Python 代码
- 分析和解释代码
- 诊断运行错误并提供修复方案
- 优化代码性能和可读性
- 识别代码需要的第三方库
- 为代码添加测试

环境说明：
- 用户在桌面应用 AiDocPlus 中运行 Python 脚本
- 可通过 os.environ.get('AIDOCPLUS_INPUT_FILE') 读取文档内容
- 可通过 os.environ.get('AIDOCPLUS_OUTPUT_FILE') 输出文件
- 输出结果使用 Markdown 格式的 print()，方便文档处理
- 代码放在 \`\`\`python 代码块中`,

  javascript: `你是 AiDocPlus 编程区的 AI 助手，专门帮助用户编写和调试 JavaScript 代码。

能力：
- 根据用户的自然语言描述生成完整可运行的 JavaScript 代码
- 分析和解释代码逻辑
- 诊断运行错误并提供修复方案
- 优化代码性能和可读性
- 支持 ES6+ 语法、Node.js API
- 代码放在 \`\`\`javascript 代码块中`,

  typescript: `你是 AiDocPlus 编程区的 AI 助手，专门帮助用户编写和调试 TypeScript 代码。

能力：
- 根据用户的自然语言描述生成完整的 TypeScript 代码
- 充分利用 TypeScript 类型系统：接口、泛型、联合类型、类型守卫等
- 分析和解释代码逻辑
- 诊断类型错误和运行时错误并提供修复方案
- 优化代码性能、类型安全和可读性
- 支持 ES6+ 语法、Node.js API
- 代码放在 \`\`\`typescript 代码块中`,

  html: `你是 AiDocPlus 编程区的 AI 助手，专门帮助用户编写和调试 HTML/CSS 页面。

能力：
- 根据用户描述生成完整的 HTML 页面
- 编写结构良好的语义化 HTML 和现代 CSS
- 支持内联 JavaScript 交互逻辑
- 响应式布局和美观的视觉设计
- 代码放在 \`\`\`html 代码块中`,

  markdown: `你是 AiDocPlus 编程区的 AI 助手，专门帮助用户编写 Markdown 文档。

能力：
- 根据用户描述生成结构清晰的 Markdown 文档
- 支持 GFM（GitHub Flavored Markdown）语法
- 支持表格、代码块、数学公式（KaTeX）、Mermaid 图表
- 帮助优化文档结构和排版
- 代码放在 \`\`\`markdown 代码块中`,

  json: `你是 AiDocPlus 编程区的 AI 助手，专门帮助用户编写和调试 JSON 数据。

能力：
- 根据用户描述生成结构良好的 JSON
- 校验 JSON 格式、诊断语法错误
- 支持 JSON Schema 规范
- 帮助设计合理的数据结构
- 代码放在 \`\`\`json 代码块中`,
};

/** 根据语言获取默认系统提示词 */
export function getDefaultSystemPrompt(language?: string): string {
  const lang = (language || 'python').toLowerCase();
  const body = SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.python;
  return body + SYSTEM_PROMPT_COMMON_SUFFIX;
}

/** 保持向后兼容 */
export const DEFAULT_SYSTEM_PROMPT = getDefaultSystemPrompt('python');

/** 所有可用的提示词语言选项 */
export const SYSTEM_PROMPT_LANGUAGES = [
  { id: 'python', label: 'Python' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'html', label: 'HTML' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'json', label: 'JSON' },
] as const;

const DEFAULT_SETTINGS: CodingSettings = {
  timeout: 30,
  customPythonPath: '',
  customNodePath: '',
  extraArgs: '',
  fontSize: 14,
  passDocContent: false,
  specifyOutput: false,
  outputPath: '',
  systemPrompt: '',
  assistantMode: 'code',
  enableWebSearch: true,
  enableThinking: false,
  codingServiceId: '',
  envVars: {},
  editorTheme: 'auto',
  outputHeight: 200,
  assistantWidth: 420,
  assistantOpen: true,
  fileTreeOpen: false,
  fileTreeWidth: 200,
};

let _tabCounter = 1;
export function nextTabId() {
  return `tab_${Date.now()}_${_tabCounter++}`;
}

// debounce 持久化
let _persistTimer: ReturnType<typeof setTimeout> | null = null;

export const useCodingStore = create<CodingState>()((set, get) => ({
  tabs: [],
  activeTabId: '',
  favorites: [],
  settings: { ...DEFAULT_SETTINGS },
  scriptsDir: '',
  initialized: false,
  runHistory: [],
  recentFiles: [],
  pythonInfo: null,
  nodeInfo: null,
  pythonDetecting: false,
  nodeDetecting: false,

  init: async () => {
    if (get().initialized) return;
    try {
      const dir = await invoke<string>('get_coding_scripts_dir');
      const json = await invoke<string | null>('load_coding_state');
      let tabs: CodingTab[] = [];
      let activeTabId = '';
      let favorites: string[] = [];
      let settings = { ...DEFAULT_SETTINGS };

      if (json) {
        try {
          const state = JSON.parse(json);
          favorites = state.favorites || [];
          settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
          const recentFiles = Array.isArray(state.recentFiles) ? state.recentFiles.slice(0, 20) : [];
          const cachedPythonInfo = state.pythonInfo || null;
          const cachedNodeInfo = state.nodeInfo || null;
          set({ recentFiles, pythonInfo: cachedPythonInfo, nodeInfo: cachedNodeInfo });
          activeTabId = state.activeTabId || '';

          // 恢复打开的标签页
          if (Array.isArray(state.openTabs)) {
            for (const t of state.openTabs) {
              try {
                const code = await invoke<string>('read_coding_script', { filePath: t.filePath });
                const fname = t.filePath.replace(/^.*[\\/]/, '');
                tabs.push({
                  id: t.id || nextTabId(),
                  filePath: t.filePath,
                  title: fname,
                  code,
                  language: detectLangFromExt(fname),
                  dirty: false,
                  outputLines: [],
                  lastExitCode: null,
                  chatMessages: Array.isArray(t.chatMessages) ? t.chatMessages : [],
                });
              } catch {
                // 文件已删除，跳过
              }
            }
          }
        } catch {
          // JSON 解析失败，使用默认值
        }
      }

      // 至少一个标签页
      if (tabs.length === 0) {
        const defaultTab: CodingTab = {
          id: nextTabId(),
          filePath: 'untitled_1.py',
          title: 'untitled_1.py',
          code: `# Python 脚本\n# 可通过环境变量获取文档内容：\n#   import os\n#   input_file = os.environ.get('AIDOCPLUS_INPUT_FILE')\n#   if input_file:\n#       with open(input_file, 'r', encoding='utf-8') as f:\n#           content = f.read()\n\nprint("Hello from Python!")\n`,
          language: 'python',
          dirty: true,
          outputLines: [],
          lastExitCode: null,
        };
        tabs = [defaultTab];
        activeTabId = defaultTab.id;
      }

      if (!activeTabId || !tabs.find(t => t.id === activeTabId)) {
        activeTabId = tabs[0]?.id || '';
      }

      set({ tabs, activeTabId, favorites, settings, scriptsDir: dir, initialized: true });
    } catch (e) {
      console.error('编程区初始化失败:', e);
      set({ initialized: true });
    }
  },

  detectPython: async (force = false) => {
    const { pythonInfo, pythonDetecting, settings } = get();
    if (pythonDetecting) return;
    if (!force && pythonInfo !== null) return;
    set({ pythonDetecting: true });
    try {
      const result = await invoke<RuntimeCheckResult>('check_python', {
        customPath: settings.customPythonPath || null,
      });
      set({ pythonInfo: result, pythonDetecting: false });
      get().persistState();
    } catch (err) {
      set({
        pythonInfo: { available: false, version: null, path: null, error: String(err) },
        pythonDetecting: false,
      });
    }
  },

  detectNode: async (force = false) => {
    const { nodeInfo, nodeDetecting, settings } = get();
    if (nodeDetecting) return;
    if (!force && nodeInfo !== null) return;
    set({ nodeDetecting: true });
    try {
      const result = await invoke<RuntimeCheckResult>('check_nodejs', {
        customPath: settings.customNodePath || null,
      });
      set({ nodeInfo: result, nodeDetecting: false });
      get().persistState();
    } catch (err) {
      set({
        nodeInfo: { available: false, version: null, path: null, error: String(err) },
        nodeDetecting: false,
      });
    }
  },

  persistState: () => {
    if (_persistTimer) clearTimeout(_persistTimer);
    _persistTimer = setTimeout(() => {
      const { tabs, activeTabId, favorites, settings, recentFiles, pythonInfo, nodeInfo } = get();
      const state = {
        openTabs: tabs.map(t => ({ id: t.id, filePath: t.filePath, chatMessages: t.chatMessages || [] })),
        activeTabId,
        favorites,
        settings,
        recentFiles,
        pythonInfo,
        nodeInfo,
      };
      invoke('save_coding_state', { json: JSON.stringify(state, null, 2) }).catch(() => {});
      _persistTimer = null;
    }, 500);
  },

  addTab: (tab) => {
    set(s => ({ tabs: [...s.tabs, tab], activeTabId: tab.id }));
    get().persistState();
  },

  removeTab: (tabId) => {
    set(s => {
      const newTabs = s.tabs.filter(t => t.id !== tabId);
      let newActive = s.activeTabId;
      if (newActive === tabId) {
        const idx = s.tabs.findIndex(t => t.id === tabId);
        newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.id || '';
      }
      return { tabs: newTabs, activeTabId: newActive };
    });
    get().persistState();
  },

  setActiveTab: (tabId) => {
    set({ activeTabId: tabId });
    get().persistState();
  },

  updateTab: (tabId, patch) => {
    set(s => ({
      tabs: s.tabs.map(t => t.id === tabId ? { ...t, ...patch } : t),
    }));
    if ('chatMessages' in patch) get().persistState();
  },

  saveFile: async (tabId) => {
    const tab = get().tabs.find(t => t.id === tabId);
    if (!tab) return;
    try {
      await invoke('save_coding_script', { filePath: tab.filePath, content: tab.code });
      set(s => ({
        tabs: s.tabs.map(t => t.id === tabId ? { ...t, dirty: false } : t),
      }));
      get().persistState();
    } catch (e) {
      console.error('保存脚本失败:', e);
    }
  },

  loadFile: async (filePath) => {
    return invoke<string>('read_coding_script', { filePath });
  },

  toggleFavorite: (filePath) => {
    set(s => {
      const favs = s.favorites.includes(filePath)
        ? s.favorites.filter(f => f !== filePath)
        : [...s.favorites, filePath];
      return { favorites: favs };
    });
    get().persistState();
  },

  reorderTabs: (fromId, toId) => {
    set(s => {
      const tabs = [...s.tabs];
      const fromIdx = tabs.findIndex(t => t.id === fromId);
      const toIdx = tabs.findIndex(t => t.id === toId);
      if (fromIdx < 0 || toIdx < 0) return s;
      const [moved] = tabs.splice(fromIdx, 1);
      tabs.splice(toIdx, 0, moved);
      return { tabs };
    });
    get().persistState();
  },

  updateSettings: (patch) => {
    set(s => ({ settings: { ...s.settings, ...patch } }));
    get().persistState();
  },

  addRunHistory: (entry) => {
    set(s => ({ runHistory: [entry, ...s.runHistory].slice(0, 50) }));
  },

  clearRunHistory: () => {
    set({ runHistory: [] });
  },

  addRecentFile: (filePath) => {
    set(s => {
      const filtered = s.recentFiles.filter(f => f !== filePath);
      return { recentFiles: [filePath, ...filtered].slice(0, 20) };
    });
    get().persistState();
  },

  clearRecentFiles: () => {
    set({ recentFiles: [] });
    get().persistState();
  },
}));
