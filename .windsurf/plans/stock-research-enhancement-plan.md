# 股票研究模块全面增强计划

## 现状分析

### 模块文件结构（22个文件）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchWorkspace.tsx` — 主工作区（825行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockInfoPanel.tsx` — 左侧股票信息面板（506行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockDataPanel.tsx` — 数据面板（773行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchAISidebar.tsx` — AI侧栏（556行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchDashboard.tsx` — 仪表盘（479行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockComparisonPanel.tsx` — 对比面板（286行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockHistoryView.tsx` — 历史视图
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchStatusBar.tsx` — 状态栏
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/TushareSettingsPanel.tsx` — Tushare设置
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/ai/prompts.ts` — AI提示词（794行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/ai/outputParser.ts` — AI输出解析器（344行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/stockResearchQuickActions.ts` — 快捷操作（497行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/stockResearchContext.ts` — 上下文构建（770行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/types.ts` — 类型定义（910行）
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/constants.ts` — 常量配置
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/utils.ts` — 工具函数
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/definition.ts` — 文档类型定义
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/dialogs/ResearchResultDialog.tsx` — 研究结果对话框
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/dialogs/ThesisPanel.tsx` — 论点面板

### 已有能力
1. **AI 工具调用**：通过 `enableTools=true` 支持 Tushare Function Calling（stock_search, stock_daily, stock_indicator 等 16+ 工具）
2. **一键研究**：发送结构化提示词，AI 返回 JSON 格式研究数据
3. **AI 输出解析**：`outputParser.ts` 可解析 AI 返回的 JSON 并验证数据合理性
4. **快捷操作**：6大类 26+ 个专业分析提示词（杜邦分析、现金流分析、技术评分等）
5. **数据面板**：手工输入财务、技术、交易、新闻、风险、对标数据
6. **对比面板**：4组指标横向对比 + 优劣势分析
7. **仪表盘**：概览卡片、快速操作、近期动态、关键指标

### 关键不足
1. **无图表可视化**：纯数字展示，缺少 K线图、走势图、财务趋势图
2. **AI 研究结果应用不流畅**：用户必须点"应用研究结果"按钮，无预览确认
3. **数据面板纯手工**：缺少"一键从 Tushare 拉取"功能，全靠手工填
4. **一键研究无进度反馈**：发出请求后只有 spinner，不知道执行到第几步
5. **缺少历史财务数据图表**：有 `FinancialHistory[]` 数据模型，但无对应的可视化
6. **对比面板无图表**：纯表格对比，缺少雷达图/柱状图
7. **缺少价格预警/监控**：没有设定目标价后的监控机制

---

## Phase 1：专业图表可视化（高优先级）

### 目标
添加 K线图和财务趋势图，使数据面板从"纯数字列表"升级为"专业数据可视化"。

### 新增依赖
```
lightweight-charts  — TradingView 开源 K线图库（MIT，体积小 ~50KB gzip）
recharts            — React 图表库（MIT，基于 D3，与 React 生态完美集成）
```

### 新增/修改文件

#### 新增文件
1. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/charts/StockPriceChart.tsx`**
   - 基于 lightweight-charts 的 K线图组件
   - 支持日线/周线/月线切换
   - 显示均线（MA5/MA10/MA20/MA60）
   - 显示成交量柱状图
   - 支撑/阻力位标注
   - 数据源：`stock_daily` 工具返回的数据 或 research.technicals

2. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/charts/FinancialTrendChart.tsx`**
   - 基于 recharts 的财务趋势图
   - 多指标折线图（营收、利润、ROE趋势）
   - 柱状图（营收增长率对比）
   - 数据源：`research.financials.history[]`

3. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/charts/ComparisonRadarChart.tsx`**
   - 基于 recharts 的雷达图
   - 多公司指标雷达对比
   - 数据源：主股票 vs 对标公司的 metrics

4. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/charts/MoneyFlowChart.tsx`**
   - 资金流向图（主力/散户 净流入柱状图）
   - 数据源：`stock_moneyflow` 工具数据

#### 修改文件
5. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockDataPanel.tsx`**
   - Technicals tab 顶部嵌入 `StockPriceChart`
   - Financials tab 顶部嵌入 `FinancialTrendChart`
   - 添加"从 Tushare 拉取"按钮（每个 tab 都有）

6. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockComparisonPanel.tsx`**
   - 嵌入 `ComparisonRadarChart` 替代纯文字优劣势

7. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/package.json`**
   - 添加 `lightweight-charts` 和 `recharts` 依赖

### 技术要点
- lightweight-charts 使用 `createChart()` API，需要 useRef + useEffect 管理生命周期
- recharts 是纯 React 组件，直接使用 `<LineChart>`, `<BarChart>`, `<RadarChart>`
- 图表需要响应容器宽度变化（用 ResizeObserver）
- 深色/浅色主题适配

---

## Phase 2：AI 研究结果自动应用增强（高优先级）

### 目标
AI 返回结构化数据后，自动检测并弹出确认对话框，用户确认后一键填充所有数据面板。

### 修改文件

1. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/dialogs/ResearchResultDialog.tsx`**
   - 完全重写：显示 AI 返回的所有结构化数据的预览
   - 分组展示：股票基本信息 / 财务指标 / 技术指标 / 论点 / 风险 / 新闻 / 对标
   - 每组有勾选框，用户可选择性应用
   - 新旧数据对比显示（高亮变化项）
   - "全部应用" / "选择性应用" / "取消" 三个按钮

2. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchAISidebar.tsx`**
   - 监听 AI 消息完成事件
   - 自动调用 `parseAIResearchOutput()` 检测结构化数据
   - 检测到时自动触发 ResearchResultDialog
   - 不再依赖用户手动点击"应用研究结果"按钮

3. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchWorkspace.tsx`**
   - 添加 ResearchResultDialog 的状态管理
   - 添加 `handleApplyResearchResult` 回调，接收 dialog 的选择结果

4. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/ai/outputParser.ts`**
   - 增强解析能力：支持嵌套 JSON、多个 JSON 块
   - 添加 `diffResearchOutput()` 函数：对比新旧数据，生成变更列表

---

## Phase 3：数据面板专业化改造（中优先级）

### 目标
StockDataPanel 从"手工输入为主"升级为"Tushare 自动拉取 + 图表 + 手工修正"。

### 修改文件

1. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockDataPanel.tsx`**
   - 每个 tab 添加"🔄 从 Tushare 拉取"按钮
   - Financials tab：点击后调用 `stock_indicator` + `stock_income` 自动填充
   - Technicals tab：点击后调用 `stock_daily` 自动填充最新行情
   - News tab：点击后通过 AI 联网搜索拉取最新新闻
   - 添加"上次更新"时间戳显示
   - 拉取数据时显示加载状态

2. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/stockResearchContext.ts`**
   - 新增 `useTushareAutoFetch` hook
   - 封装各 tab 的自动拉取逻辑
   - 处理 ts_code 解析（从 stock.code 到标准格式）
   - 返回拉取状态 + 错误处理

3. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/types.ts`**
   - 为 `TechnicalIndicators` 添加 `dailyData?: DailyQuote[]` 字段（存储 K 线数据供图表使用）
   - 新增 `DailyQuote` 接口：`{ date, open, high, low, close, volume, amount }`

---

## Phase 4：一键研究流程优化（中优先级）

### 目标
一键研究从"发出请求→等待→手动应用"升级为"分步执行→实时进度→自动填充"。

### 修改文件

1. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchAISidebar.tsx`**
   - `handleOneClickResearch` 改为多步骤模式
   - 显示研究进度条：
     - Step 1/8: 搜索股票代码... ✅
     - Step 2/8: 获取基本信息... 🔄
     - Step 3/8: 获取行情数据... ⏳
     - ...
   - 通过监听 AI stream chunk 中的工具调用消息（`> 🔧 正在调用工具...`）更新进度

2. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/StockResearchAISidebar.tsx`**
   - 研究完成后自动触发 ResearchResultDialog（Phase 2 的成果）
   - 无需用户手动点击应用

### 新增文件

3. **`/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/document-types/stock-research/ResearchProgressIndicator.tsx`**
   - 研究进度指示器组件
   - 多步骤 stepper UI
   - 显示每步的状态（等待/执行中/完成/失败）
   - 显示工具调用详情

---

## 实施顺序

| 阶段 | 内容 | 预计工作量 | 优先级 |
|------|------|-----------|--------|
| Phase 1 | 专业图表可视化 | 大 | 高 |
| Phase 2 | AI结果自动应用 | 中 | 高 |
| Phase 3 | 数据面板专业化 | 中 | 中 |
| Phase 4 | 一键研究流程优化 | 中 | 中 |

**推荐开始**：Phase 1（图表可视化），因为这是用户体验改善最显著的部分，能让股票研究从"文字工具"跃升为"专业可视化分析工具"。

---

## 开源组件选型理由

### lightweight-charts（K线图）
- **TradingView 官方开源**：金融图表行业标准
- **极轻量**：gzip 后仅 ~50KB
- **MIT 协议**：可商用
- **丰富功能**：K线、折线、柱状图、面积图、自定义标记
- **高性能**：Canvas 渲染，轻松处理上万数据点
- **对比 ECharts**：ECharts 太重（500KB+），K线功能不如 lightweight-charts 专业

### recharts（财务/对比图表）
- **React 原生**：纯 React 组件，无 imperative API
- **基于 D3**：可视化能力强
- **组件丰富**：LineChart, BarChart, RadarChart, PieChart 等
- **与 Tailwind 兼容**：样式可定制
- **对比 nivo/visx**：recharts 上手最简单，社区活跃度最高
