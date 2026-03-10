# AiDocPlus IM Bot 桥接服务

通过飞书、钉钉、企业微信、QQ 远程控制 AiDocPlus 桌面应用。

## 架构

```
飞书/钉钉/企微/QQ  ──长连接──→  IM Bot  ──HTTP API──→  AiDocPlus 桌面应用
```

- **指令模式**：`/帮助`、`/项目列表`、`/搜索 关键词` 等斜杠指令
- **AI 模式**：自然语言 → LLM Function Calling → AiDocPlus API

## 快速开始

### 1. 安装依赖

```bash
cd apps/im-bot
pnpm install
```

### 2. 配置

```bash
cp .env.example .env
```

编辑 `.env`，至少启用一个渠道并填写对应凭证。

### 3. 启动

```bash
# 开发模式（热重载）
pnpm dev

# 生产模式
pnpm start
```

> **前提**：AiDocPlus 桌面应用需要正在运行（Bot 通过 `~/.aidocplus/api.json` 自动发现连接信息）。

## 支持的渠道

| 渠道 | 连接方式 | 环境变量前缀 | 配置指南 |
|------|---------|-------------|---------|
| 飞书 | 长连接（WebSocket） | `FEISHU_` | 飞书开放平台创建企业自建应用 |
| 钉钉 | Stream（WebSocket） | `DINGTALK_` | 钉钉开放平台创建企业内部应用 |
| 企业微信 | 自建应用 API | `WECOM_` | 企业微信管理后台创建自建应用 |
| QQ | 官方 Bot WebSocket | `QQ_` | QQ 开放平台创建机器人 |

所有渠道均**无需公网 IP**，本机能访问公网即可。

## 支持的指令

| 指令 | 说明 |
|------|------|
| `/帮助` | 显示指令列表 |
| `/状态` | 查看 AiDocPlus 运行状态 |
| `/项目列表` | 列出所有项目 |
| `/文档列表 [项目ID]` | 列出文档 |
| `/搜索 关键词` | 搜索文档 |
| `/AI写作 提示词` | AI 生成内容 |
| `/模板列表` | 列出提示词模板 |
| `/导出 项目ID 文档ID 格式` | 导出文档 |

## AI 智能路由（可选）

在 `.env` 中配置：

```env
AI_ENABLED=true
AI_API_KEY=sk-xxx
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
```

启用后，直接发送自然语言即可，AI 会自动理解意图并调用对应的 AiDocPlus API。

## 各平台配置简要

### 飞书

1. 访问 [飞书开放平台](https://open.feishu.cn)
2. 创建企业自建应用 → 启用「机器人」能力
3. 添加权限：`im:message`、`im:message.group_at_msg`、`im:resource`
4. 事件订阅 → 选择「使用长连接接收事件」
5. 复制 App ID 和 App Secret 到 `.env`

### 钉钉

1. 访问 [钉钉开放平台](https://open.dingtalk.com)
2. 创建企业内部应用（个人即可注册企业，5 分钟完成）
3. 启用「机器人」能力，选择 Stream 模式
4. 复制 ClientID 和 ClientSecret 到 `.env`

### 企业微信

1. 访问 [企业微信管理后台](https://work.weixin.qq.com)
2. 创建自建应用，获取 CorpID、Secret、AgentID
3. 配置可信 IP 和消息回调
4. 复制凭证到 `.env`

### QQ

1. 访问 [QQ 开放平台](https://q.qq.com)
2. 创建机器人应用
3. 获取 AppID 和 AppSecret
4. 配置沙箱群进行测试
5. 复制凭证到 `.env`
