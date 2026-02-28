# AiDocPlus JavaScript SDK

在 JavaScript/TypeScript 脚本中调用 AiDocPlus 主程序的各种功能。

## 快速开始

```javascript
const aidocplus = require('aidocplus');

// 连接到正在运行的 AiDocPlus（在编程区中运行时自动连接）
const api = aidocplus.connect();

// 列出项目
const projects = await api.project.list();

// 列出文档
const docs = await api.document.list({ projectId: 'your-project-id' });

// 获取文档详情
const doc = await api.document.get({ projectId: 'pid', documentId: 'did' });

// 保存文档
await api.document.save({ projectId: 'pid', documentId: 'did', content: '新内容' });

// 搜索文档
const results = await api.search.documents({ query: '关键词' });

// 获取当前打开的文档
const activeDoc = await api.app.getActiveDocument();

// 获取程序状态
const status = await api.app.status();

// AI 对话
const result = await api.ai.chat({ messages: [{ role: 'user', content: '你好' }] });
console.log(result.content);

// AI 对话（带系统提示）
const result2 = await api.ai.chat({
  messages: [{ role: 'user', content: '帮我润色这段文字' }],
  system_prompt: '你是一位资深的中文编辑',
});

// AI 内容生成（快捷方式）
const gen = await api.ai.generate({ prompt: '写一篇关于人工智能的短文' });

// 导出文档为 Word
await api.export.docx({ projectId: 'pid', documentId: 'did' });

// 直接导出 Markdown 内容为 HTML
await api.export.html({ content: '# 标题\n正文内容', title: '测试文档' });

// 读写文件（限 ~/AiDocPlus/ 下）
await api.file.write({ path: '~/AiDocPlus/notes/test.txt', content: 'hello' });
const data = await api.file.read({ path: '~/AiDocPlus/notes/test.txt' });

// 列出脚本文件
const scripts = await api.script.listFiles();

// 列出提示词模板
const templates = await api.template.list();
templates.templates.forEach(t => console.log(t.name, t.category));

// 获取模板内容
const tpl = await api.template.getContent({ templateId: 'some-template-id' });
console.log(tpl.content);
```

## 连接方式

连接参数按以下优先级获取：
1. **函数参数** — `aidocplus.connect({ port: 45678, token: 'xxx' })`
2. **环境变量** — `AIDOCPLUS_API_PORT` + `AIDOCPLUS_API_TOKEN`（编程区自动注入）
3. **配置文件** — `~/.aidocplus/api.json`（程序启动时自动生成）

## API 命名空间

| 命名空间 | 说明 | 示例 |
|----------|------|------|
| `api.app` | 程序状态 | `await api.app.status()` |
| `api.document` | 文档操作 | `await api.document.list({ projectId: '...' })` |
| `api.project` | 项目管理 | `await api.project.list()` |
| `api.ai` | AI 对话 | `await api.ai.chat({ messages: [...] })` |
| `api.search` | 搜索 | `await api.search.documents({ query: '...' })` |
| `api.export` | 导出 | `await api.export.pdf({ documentId: '...' })` |
| `api.email` | 邮件 | `await api.email.send({ to: [...] })` |
| `api.template` | 模板 | `await api.template.list()` |
| `api.plugin` | 插件 | `await api.plugin.list()` |
| `api.tts` | 语音 | `await api.tts.speak({ text: '...' })` |
| `api.file` | 文件 | `await api.file.read({ path: '...' })` |
| `api.script` | 脚本 | `await api.script.listFiles()` |
