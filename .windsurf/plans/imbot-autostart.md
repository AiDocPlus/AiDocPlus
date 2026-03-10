# IM Bot 自动启动 + 设置入口

## 目标
AiDocPlus 桌面应用启动时，根据用户设置自动启动 IM Bot 子进程；在设置面板提供开关和自动启动选项。

## 涉及文件（完整绝对路径）

### 新建
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/imbot.rs` — IM Bot 子进程管理（start/stop/status）

### 修改
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/commands/mod.rs` — 注册 imbot 模块
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-tauri/src/main.rs` — 注册 ImBotState + 3 个命令
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/stores/useSettingsStore.ts` — 新增 imBot 设置字段
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/components/settings/SettingsPanel.tsx` — 高级 tab 中添加 IM Bot 设置 UI
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/i18n/locales/zh/translation.json` — i18n 中文
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/i18n/locales/en/translation.json` — i18n 英文
- `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/App.tsx` 或启动入口 — 监听 api-server:ready 自动启动

## 实现步骤

### Step 1: Rust — imbot.rs
- `ImBotState`: 持有 `Arc<Mutex<Option<Child>>>`
- `start_imbot(state)`: 通过 `tsx` 启动 im-bot/src/index.ts，注入 API 连接环境变量
- `stop_imbot(state)`: kill 子进程
- `get_imbot_status(state)`: 返回 running/stopped

### Step 2: Rust — 注册
- mod.rs 加 `pub mod imbot;`
- main.rs 加 `use commands::imbot::*;`、`app.manage(ImBotState::default())`、注册 3 个命令

### Step 3: 前端 — useSettingsStore
- 新增 `imBot: { autoStart: boolean }` 字段 + `updateImBotSettings` action

### Step 4: 前端 — SettingsPanel
- 在高级 tab 中添加 IM Bot 区域：运行状态指示灯、启动/停止按钮、自动启动开关

### Step 5: 前端 — 自动启动
- 在 App.tsx 或类似入口监听 `api-server:ready`，若 imBot.autoStart 为 true 则 invoke start_imbot

### Step 6: i18n
- 添加中英文翻译 key

### Step 7: 编译验证
