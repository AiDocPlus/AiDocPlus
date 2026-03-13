// ── 类型 ──

export interface ScriptRunResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
}

export interface PythonInterpreter {
  path: string;
  version: string;
  label: string;
}


export const DEFAULT_CODE = `# Python 脚本
# 可通过环境变量获取文档内容：
#   import os
#   input_file = os.environ.get('AIDOCPLUS_INPUT_FILE')
#   if input_file:
#       with open(input_file, 'r', encoding='utf-8') as f:
#           content = f.read()

print("Hello from Python!")
`;

/** 各语言的默认代码模板 */
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

/** 新建文件类型选项 */
export const NEW_FILE_TYPES = [
  { ext: 'py', label: 'Python', lang: 'python' },
  { ext: 'html', label: 'HTML', lang: 'html' },
  { ext: 'js', label: 'JavaScript', lang: 'javascript' },
  { ext: 'ts', label: 'TypeScript', lang: 'typescript' },
  { ext: 'json', label: 'JSON', lang: 'json' },
  { ext: 'md', label: 'Markdown', lang: 'markdown' },
  { ext: 'css', label: 'CSS', lang: 'css' },
  { ext: 'txt', label: '纯文本', lang: 'text' },
];

/** 支持打开的文件扩展名 */
export const SUPPORTED_EXTENSIONS = ['py','html','htm','js','jsx','ts','tsx','json','md','css','txt','xml','yaml','yml','toml','sh','sql'];
