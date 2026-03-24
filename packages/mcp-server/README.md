# AiDocPlus MCP Server

通过 [Model Context Protocol](https://modelcontextprotocol.io/) 让 AI 助手（Claude Desktop、Cursor 等）直接操作 AiDocPlus。

## 前提条件

- AiDocPlus 桌面程序正在运行（API Server 会自动启动）
- Node.js 18+

## 安装依赖

```bash
cd packages/mcp-server
npm install
```

## Claude Desktop 配置

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`（macOS）或 `%APPDATA%\Claude\claude_desktop_config.json`（Windows）：

```json
{
  "mcpServers": {
    "aidocplus": {
      "command": "node",
      "args": ["/Users/你的用户名/Code/AiDocPlus/packages/mcp-server/index.js"]
    }
  }
}
```

配置完成后，重启 Claude Desktop 使配置生效。

## 快速开始

### 1. 测试连接

在 Claude Desktop 中输入：
```
请用 aidocplus_status 查看 AiDocPlus 的运行状态
```

### 2. 列出项目

```
列出我所有的 AiDocPlus 项目
```

### 3. 读取文档

```
读取我当前正在编辑的文档内容
```

---

## Tushare 股票数据使用指南

### 获取 Tushare Token

1. 访问 [Tushare Pro](https://tushare.pro/) 注册账号
2. 进入「个人中心」→「我的 API」→「复制 Token」
3. 在 Claude 中存储 Token：

```
请用 aidocplus_stock_store_credential 存储我的 Tushare Token：你的Token字符串
```

4. 验证 Token：

```
请用 aidocplus_stock_token_check 验证我的 Tushare Token 是否有效
```

### 常用查询示例

#### 查询股票基本信息

```
帮我查询贵州茅台（600519.SH）的基本信息
```

→ 调用 `aidocplus_stock_basic_info`

#### 查询日线行情

```
获取贵州茅台最近20个交易日的日线数据
```

→ 调用 `aidocplus_stock_daily`

#### 查询财务数据

```
获取万科A（000002.SZ）最近2年的利润表数据
```

→ 调用 `aidocplus_stock_income`

#### 查询资金流向

```
分析比亚迪（002594.SZ）最近1个月的主力资金流向
```

→ 调用 `aidocplus_stock_moneyflow`

#### 综合分析（自动调用多个工具）

```
对宁德时代（300750.SZ）进行全面研究：基本信息 + 最近20日行情 + 财务数据 + 资金流向
```

### 股票代码格式

| 市场 | 代码格式 | 示例 |
|------|---------|------|
| 上海主板 | `600519.SH` | 贵州茅台 |
| 上海科创板 | `688005.SH` | 容百科技 |
| 深圳主板 | `000001.SZ` | 平安银行 |
| 深圳中小板 | `002594.SZ` | 比亚迪 |
| 深圳创业板 | `300750.SZ` | 宁德时代 |

### 日期格式

所有日期参数使用 `YYYYMMDD` 格式，例如：
- `start_date: "20240101"` 表示 2024年1月1日
- `end_date: "20240131"` 表示 2024年1月31日

### 积分说明

Tushare API 调用受积分限制：

| 积分 | 调用频率 | 可用接口数 |
|------|---------|----------|
| 120（注册即送） | 200次/分钟 | 基础行情 |
| 1000 | 500次/分钟 | 标准行情 + 财务 |
| 5000 | 1000次/分钟 | 全量数据 |
| 10000（最高） | 2000次/分钟 | 全部49个股票接口 |

**提示**：不同接口需要不同积分，可在 [Tushare 积分规则](https://tushare.pro/document/1?doc_id=32) 查看具体要求。

---

## 工具索引（72 个）

### 程序与项目

| 工具名 | 说明 |
|--------|------|
| `aidocplus_status` | 获取程序运行状态 |
| `aidocplus_get_active_document` | 获取当前编辑的文档 |
| `aidocplus_get_selected_text` | 获取选中的文本 |
| `aidocplus_list_projects` | 列出所有项目 |

### 文档操作

| 工具名 | 说明 |
|--------|------|
| `aidocplus_list_documents` | 列出项目中的文档 |
| `aidocplus_get_document` | 获取文档详情 |
| `aidocplus_create_document` | 创建新文档 |
| `aidocplus_save_document` | 保存文档内容 |
| `aidocplus_search_documents` | 搜索文档 |

### AI 对话

| 工具名 | 说明 |
|--------|------|
| `aidocplus_ai_chat` | AI 对话（支持 system_prompt 参数） |
| `aidocplus_ai_generate` | AI 内容生成（快捷方式） |

### 模板与插件

| 工具名 | 说明 |
|--------|------|
| `aidocplus_list_templates` | 列出提示词模板（内置+自定义） |
| `aidocplus_get_template_content` | 获取模板完整内容 |
| `aidocplus_list_plugins` | 列出已安装的插件 |

### 文件操作

| 工具名 | 说明 |
|--------|------|
| `aidocplus_file_read` | 读取文件（限 ~/AiDocPlus/ 下） |
| `aidocplus_file_write` | 写入文件（限 ~/AiDocPlus/ 下） |
| `aidocplus_file_metadata` | 获取文件元数据 |

### 导出

| 工具名 | 说明 |
|--------|------|
| `aidocplus_export_markdown` | 导出为 Markdown 文件 |
| `aidocplus_export_html` | 导出为 HTML（公文排版） |
| `aidocplus_export_docx` | 导出为 Word（公文排版） |
| `aidocplus_export_pdf` | 导出为 PDF（浏览器打印） |
| `aidocplus_export_txt` | 导出为纯文本 |

### 脚本

| 工具名 | 说明 |
|--------|------|
| `aidocplus_list_scripts` | 列出脚本文件 |

### 股票数据（Tushare Pro，共49个）

#### Token 管理（3个）

| 工具名 | 说明 |
|--------|------|
| `aidocplus_stock_token_check` | 验证 Tushare Token 并返回账户信息 |
| `aidocplus_stock_store_credential` | 存储 Tushare Token |
| `aidocplus_stock_delete_credential` | 删除已存储的 Tushare Token |

#### 行情数据（14个）

| 工具名 | 说明 |
|--------|------|
| `aidocplus_stock_search` | 搜索股票（按名称或代码） |
| `aidocplus_stock_basic_info` | 获取股票基本信息 |
| `aidocplus_stock_daily` | 获取日线行情 |
| `aidocplus_stock_weekly` | 获取周线行情 |
| `aidocplus_stock_monthly` | 获取月线行情 |
| `aidocplus_stock_realtime_quote` | 获取股票实时行情 |
| `aidocplus_stock_price_limit` | 获取每日涨跌停价格 |
| `aidocplus_stock_suspend_d` | 获取停复牌数据 |
| `aidocplus_stock_adj_factor` | 获取复权因子 |
| `aidocplus_stock_tick_data` | 获取分笔数据 |
| `aidocplus_stock_index_daily` | 获取指数日线数据 |
| `aidocplus_stock_index_basic` | 获取指数基本信息 |
| `aidocplus_stock_index_weight` | 获取指数成分股权重 |
| `aidocplus_stock_industry_index` | 获取行业日行情 |

#### 财务数据（10个）

| 工具名 | 说明 |
|--------|------|
| `aidocplus_stock_income` | 获取利润表数据 |
| `aidocplus_stock_balance_sheet` | 获取资产负债表 |
| `aidocplus_stock_cashflow` | 获取现金流量表 |
| `aidocplus_stock_indicator` | 获取财务指标（ROE、PE、PB等） |
| `aidocplus_stock_forecast` | 获取业绩预告/快报 |
| `aidocplus_stock_dividend` | 获取分红送股数据 |
| `aidocplus_stock_float_holder` | 获取流通股东数据 |
| `aidocplus_stock_top10_float_holder` | 获取十大流通股东数据 |
| `aidocplus_stock_float_holder_num` | 获取股东人数变化 |
| `aidocplus_stock_share_float` | 获取流通股本数据 |

#### 资金流向（4个）

| 工具名 | 说明 |
|--------|------|
| `aidocplus_stock_moneyflow` | 获取个股资金流向 |
| `aidocplus_stock_hsgt_top` | 获取北向资金持股排行 |
| `aidocplus_stock_hsgt_shanghai` | 获取沪股通每日持股明细 |
| `aidocplus_stock_hsgt_shenzhen` | 获取深股通每日持股明细 |

#### 交易数据（5个）

| 工具名 | 说明 |
|--------|------|
| `aidocplus_stock_top_list` | 获取龙虎榜每日明细 |
| `aidocplus_stock_top_inst` | 获取龙虎榜机构明细 |
| `aidocplus_stock_block_trade` | 获取大宗交易数据 |
| `aidocplus_stock_margin_detail` | 获取融资融券每日明细 |
| `aidocplus_stock_new_share` | 获取新股IPO数据 |

#### 板块数据（4个）

| 工具名 | 说明 |
|--------|------|
| `aidocplus_stock_board_industry` | 获取股票所属行业信息 |
| `aidocplus_stock_board_concept` | 获取概念板块信息 |
| `aidocplus_stock_concept_detail` | 获取概念板块成分股 |
| `aidocplus_stock_concept_index` | 获取概念指数（规划中） |

#### 期货期权（2个）

| 工具名 | 说明 |
|--------|------|
| `aidocplus_stock_future_daily` | 获取期货日线行情 |
| `aidocplus_stock_option_daily` | 获取期权日线行情 |

#### 宏观数据（4个）

| 工具名 | 说明 |
|--------|------|
| `aidocplus_stock_gdp` | 获取国内生产总值（GDP） |
| `aidocplus_stock_cpi` | 获取居民消费价格指数（CPI） |
| `aidocplus_stock_money_supply` | 获取货币供应量 |
| `aidocplus_stock_money_supply_bal` | 获取货币供应量余额 |

---

## 工作原理

```
Claude Desktop  ←(stdio/MCP)→  MCP Server  ←(HTTP)→  AiDocPlus API Server
```

MCP Server 读取 `~/.aidocplus/api.json` 获取 AiDocPlus 的连接信息（端口 + Token），然后将 MCP tool 调用转发为 HTTP API 请求。

---

## 故障排查

### MCP Server 未启动

**症状**：Claude Desktop 显示 "Connection refused" 或无法找到工具。

**解决**：
1. 确认 AiDocPlus 程序正在运行
2. 确认已执行 `npm install`
3. 检查配置文件路径是否正确（绝对路径）

### Token 无效

**症状**：`aidocplus_stock_token_check` 返回积分显示为0或报错。

**解决**：
1. 确认 Token 正确（无多余空格）
2. 重新到 Tushare Pro 获取新 Token
3. 用 `aidocplus_stock_store_credential` 重新存储

### 调用报 "积分不足"

**症状**：返回 `{ "error": "积分不足" }`。

**解决**：Tushare API 有调用权限限制，需升级积分或换用基础接口。

### 股票代码格式错误

**症状**：返回数据为空或报错。

**解决**：确认使用正确格式，如 `600519.SH`（沪市）或 `000001.SZ`（深市）。

---

## Cursor 配置（可选）

在 Cursor 的 `Settings` → `AI` → `MCP Servers` 中添加同样配置，即可在 Cursor 中使用所有工具。
