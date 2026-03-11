# §2.4 对话上下文管理优化 — 实施计划

## 现状分析

### 当前问题
1. `sendChatMessage` 将**全部对话历史**发送给 AI，无 token 限制
2. 超长对话会超出模型上下文窗口 → API 报错
3. 用户无法感知当前对话消耗了多少 token
4. 没有对话摘要/压缩机制

### 当前数据流
```
tabMessages (全部历史)
  → buildChatMessages() 注入 system prompt + context
    → invoke('chat_stream', { messages: [...] })
      → 后端直接转发给 AI provider
```

## 实施步骤

### Step 1: Token 估算工具 (`src-ui/src/lib/tokenEstimator.ts`)

- `estimateTokens(text: string): number` — 基于字符的 token 估算
  - 英文: ~4 chars/token
  - 中文: ~1.5 chars/token
  - 混合文本自动检测
- `estimateMessagesTokens(messages: AIMessage[]): number` — 消息数组的总 token 数
- 模型上下文窗口映射表（按 provider + model 查找）

### Step 2: 滑动窗口消息截断 (`sendChatMessage` 中)

- 在发送前对 `tabMessages` 做截断：
  - 保留 system prompt（不截断）
  - 从最新消息往前保留，直到接近 `maxContextTokens - reserveForResponse`
  - 截断的消息前插入一条摘要提示："（前面有 N 条消息被省略）"
- `maxContextTokens` 默认值按模型自动设定，用户可在设置中覆盖
- `reserveForResponse` 默认 4096（给 AI 回复留空间）

### Step 3: 前端 Token 用量指示器

- ChatPanel 底部（输入框附近）显示 `~1,234 / 128K tokens`
- 颜色分级：绿(<50%) / 黄(50-80%) / 红(>80%)
- 实时更新：每次消息变化时重新估算

### Step 4: 设置项

- `ai.maxContextMessages`（可选）：最大保留消息条数，0=不限
- `ai.maxContextTokens`（可选）：最大上下文 token 数，0=自动按模型

### Step 5: 对话摘要（可选，后续）

- 当对话过长时显示"摘要对话"按钮
- AI 自动将旧消息压缩为一段摘要
- 摘要作为 system message 保留

## 文件变更清单

| 文件 | 变更 |
|------|------|
| `src-ui/src/lib/tokenEstimator.ts` | 新建：token 估算 + 模型上下文窗口映射 |
| `src-ui/src/stores/useAppStore.ts` | 修改：sendChatMessage 添加滑动窗口截断 |
| `src-ui/src/stores/useSettingsStore.ts` | 修改：添加 maxContextMessages / maxContextTokens 设置项 |
| `src-ui/src/components/ChatPanel.tsx` | 修改：添加 TokenUsageIndicator |
| `src-ui/src/components/TokenUsageIndicator.tsx` | 新建：token 用量显示组件 |
| `src-ui/src/i18n/locales/zh/translation.json` | 修改：新增 i18n 键 |
| `src-ui/src/i18n/locales/en/translation.json` | 修改：新增 i18n 键 |

## 验证标准

- [ ] tsc --noEmit 零错误
- [ ] 超长对话（100+条消息）不会导致 API 报错
- [ ] Token 用量指示器正确显示和更新
- [ ] 截断后的消息仍然保持上下文连贯
