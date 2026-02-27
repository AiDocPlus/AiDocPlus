import { snippetCompletion } from '@codemirror/autocomplete';
import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';

/**
 * Markdown 自动补全 source
 * 在行首输入特定前缀时提供 Markdown 语法片段建议
 * 链接/图片/脚注等使用 snippet 模板支持 Tab 跳转
 */
export function markdownCompletions(context: CompletionContext): CompletionResult | null {
  // 只在显式触发或输入至少 1 个字符后激活
  const word = context.matchBefore(/^[#\->\d`\|!\\$\[].{0,10}$/m);
  if (!word && !context.explicit) return null;

  // 获取当前行文本
  const line = context.state.doc.lineAt(context.pos);
  const lineText = line.text.slice(0, context.pos - line.from);

  // 只在行首触发（避免在行中间弹出）
  const trimmed = lineText.trimStart();
  if (trimmed.length > 16) return null;

  const from = line.from + (lineText.length - trimmed.length);

  // snippet 模板用 ${} 占位符，Tab 可在占位符之间跳转
  const options: Completion[] = [
    // 标题
    snippetCompletion('# ${标题}', { label: '# ', displayLabel: '# 一级标题', type: 'keyword', detail: 'H1' }),
    snippetCompletion('## ${标题}', { label: '## ', displayLabel: '## 二级标题', type: 'keyword', detail: 'H2' }),
    snippetCompletion('### ${标题}', { label: '### ', displayLabel: '### 三级标题', type: 'keyword', detail: 'H3' }),
    snippetCompletion('#### ${标题}', { label: '#### ', displayLabel: '#### 四级标题', type: 'keyword', detail: 'H4' }),
    // 列表
    snippetCompletion('- ${内容}', { label: '- ', displayLabel: '- 无序列表', type: 'text', detail: '列表' }),
    snippetCompletion('1. ${内容}', { label: '1. ', displayLabel: '1. 有序列表', type: 'text', detail: '列表' }),
    snippetCompletion('- [ ] ${任务}', { label: '- [ ] ', displayLabel: '- [ ] 任务列表', type: 'text', detail: '任务' }),
    // 引用 / 分隔线
    snippetCompletion('> ${引用内容}', { label: '> ', displayLabel: '> 引用', type: 'text', detail: '引用' }),
    { label: '---', displayLabel: '--- 分隔线', type: 'text', detail: '分隔线', apply: '---\n' },
    // 代码块（snippet：Tab 跳到代码区域）
    snippetCompletion('```${1:语言}\n${2:代码}\n```\n', { label: '```', displayLabel: '``` 代码块', type: 'text', detail: '代码' }),
    snippetCompletion('```javascript\n${代码}\n```\n', { label: '```js', displayLabel: '```js JavaScript', type: 'text', detail: '代码' }),
    snippetCompletion('```typescript\n${代码}\n```\n', { label: '```ts', displayLabel: '```ts TypeScript', type: 'text', detail: '代码' }),
    snippetCompletion('```python\n${代码}\n```\n', { label: '```py', displayLabel: '```py Python', type: 'text', detail: '代码' }),
    // Mermaid 图表（16 种）
    { label: '```mermaid', displayLabel: '```mermaid 流程图', type: 'text', detail: 'Mermaid', apply: '```mermaid\ngraph TD\n    A[开始] --> B{判断}\n    B -->|是| C[结果1]\n    B -->|否| D[结果2]\n```\n' },
    { label: '```mermaid seq', displayLabel: '```mermaid 时序图', type: 'text', detail: 'Mermaid', apply: '```mermaid\nsequenceDiagram\n    participant A as 客户端\n    participant B as 服务器\n    A->>B: 请求\n    B-->>A: 响应\n```\n' },
    { label: '```mermaid class', displayLabel: '```mermaid 类图', type: 'text', detail: 'Mermaid', apply: '```mermaid\nclassDiagram\n    class Animal {\n        +String name\n        +int age\n        +makeSound()\n    }\n    class Dog {\n        +fetch()\n    }\n    Animal <|-- Dog\n```\n' },
    { label: '```mermaid state', displayLabel: '```mermaid 状态图', type: 'text', detail: 'Mermaid', apply: '```mermaid\nstateDiagram-v2\n    [*] --> 待处理\n    待处理 --> 进行中: 开始\n    进行中 --> 已完成: 完成\n    进行中 --> 待处理: 退回\n    已完成 --> [*]\n```\n' },
    { label: '```mermaid er', displayLabel: '```mermaid ER图', type: 'text', detail: 'Mermaid', apply: '```mermaid\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER {\n        string name\n        string email\n    }\n    ORDER {\n        int orderNumber\n        date created\n    }\n```\n' },
    { label: '```mermaid pie', displayLabel: '```mermaid 饼图', type: 'text', detail: 'Mermaid', apply: '```mermaid\npie title 项目占比\n    "分类A" : 40\n    "分类B" : 30\n    "分类C" : 20\n    "分类D" : 10\n```\n' },
    { label: '```mermaid gantt', displayLabel: '```mermaid 甘特图', type: 'text', detail: 'Mermaid', apply: '```mermaid\ngantt\n    title 项目计划\n    dateFormat YYYY-MM-DD\n    section 阶段一\n        任务1 :a1, 2024-01-01, 30d\n        任务2 :after a1, 20d\n    section 阶段二\n        任务3 :2024-02-20, 25d\n```\n' },
    { label: '```mermaid mind', displayLabel: '```mermaid 思维导图', type: 'text', detail: 'Mermaid', apply: '```mermaid\nmindmap\n  root((中心主题))\n    分支A\n      子项1\n      子项2\n    分支B\n      子项3\n      子项4\n    分支C\n```\n' },
    { label: '```mermaid time', displayLabel: '```mermaid 时间线', type: 'text', detail: 'Mermaid', apply: '```mermaid\ntimeline\n    title 项目里程碑\n    2024-Q1 : 需求分析 : 技术选型\n    2024-Q2 : 开发阶段 : 单元测试\n    2024-Q3 : 集成测试 : 上线部署\n```\n' },
    { label: '```mermaid git', displayLabel: '```mermaid Git图', type: 'text', detail: 'Mermaid', apply: '```mermaid\ngitGraph\n    commit\n    commit\n    branch develop\n    checkout develop\n    commit\n    commit\n    checkout main\n    merge develop\n    commit\n```\n' },
    { label: '```mermaid journey', displayLabel: '```mermaid 用户旅程', type: 'text', detail: 'Mermaid', apply: '```mermaid\njourney\n    title 用户购物旅程\n    section 浏览\n      打开首页: 5: 用户\n      搜索商品: 4: 用户\n    section 购买\n      加入购物车: 3: 用户\n      结算支付: 2: 用户\n```\n' },
    { label: '```mermaid quad', displayLabel: '```mermaid 象限图', type: 'text', detail: 'Mermaid', apply: '```mermaid\nquadrantChart\n    title 优先级矩阵\n    x-axis 低紧急 --> 高紧急\n    y-axis 低重要 --> 高重要\n    quadrant-1 立即执行\n    quadrant-2 计划执行\n    quadrant-3 委托他人\n    quadrant-4 暂时搁置\n    任务A: [0.8, 0.9]\n    任务B: [0.3, 0.7]\n```\n' },
    { label: '```mermaid xy', displayLabel: '```mermaid XY图表', type: 'text', detail: 'Mermaid', apply: '```mermaid\nxychart-beta\n    title "月度销售额"\n    x-axis [1月, 2月, 3月, 4月, 5月, 6月]\n    y-axis "销售额（万元）" 0 --> 100\n    bar [30, 45, 60, 55, 70, 85]\n    line [30, 45, 60, 55, 70, 85]\n```\n' },
    { label: '```mermaid sankey', displayLabel: '```mermaid 桑基图', type: 'text', detail: 'Mermaid', apply: '```mermaid\nsankey-beta\n\n来源A,目标X,30\n来源A,目标Y,20\n来源B,目标X,15\n来源B,目标Z,25\n```\n' },
    { label: '```mermaid block', displayLabel: '```mermaid 框图', type: 'text', detail: 'Mermaid', apply: '```mermaid\nblock-beta\n    columns 3\n    前端 中间件 后端\n    space:3\n    数据库\n```\n' },
    { label: '```mermaid arch', displayLabel: '```mermaid 架构图', type: 'text', detail: 'Mermaid', apply: '```mermaid\narchitecture-beta\n    group api(cloud)[API]\n\n    service db(database)[数据库] in api\n    service disk1(disk)[存储] in api\n    service server(server)[服务器] in api\n\n    db:L -- R:server\n    disk1:T -- B:server\n```\n' },
    // 表格（snippet：Tab 跳转标题和内容）
    snippetCompletion('| ${1:标题1} | ${2:标题2} | ${3:标题3} |\n| --- | --- | --- |\n| ${4:内容} | ${5:内容} | ${6:内容} |\n', { label: '| ', displayLabel: '| 表格', type: 'text', detail: '表格' }),
    // 链接 / 图片（snippet：Tab 在文本和 URL 之间跳转）
    snippetCompletion('![${1:图片描述}](${2:url})', { label: '![', displayLabel: '![] 图片', type: 'text', detail: '图片' }),
    snippetCompletion('[${1:链接文本}](${2:url})', { label: '[', displayLabel: '[] 链接', type: 'text', detail: '链接' }),
    // 数学公式
    snippetCompletion('$$\n${公式}\n$$\n', { label: '$$', displayLabel: '$$ 块级公式', type: 'text', detail: '公式' }),
    snippetCompletion('$${公式}$', { label: '$', displayLabel: '$ 行内公式', type: 'text', detail: '公式' }),
    // 脚注（snippet：Tab 在引用标记和脚注内容之间跳转）
    snippetCompletion('[^${1:1}]\n\n[^${1:1}]: ${2:脚注内容}', { label: '[^', displayLabel: '[^1] 脚注', type: 'text', detail: '脚注' }),
  ];

  // 过滤匹配项
  const filtered = options.filter(o => o.label.startsWith(trimmed) || trimmed === '');

  if (filtered.length === 0) return null;

  return {
    from,
    options: filtered,
    validFor: /^[#\->\d`\|!\[\]$a-z ]*$/,
  };
}
