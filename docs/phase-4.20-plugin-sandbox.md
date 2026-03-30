# Phase 4.20: 插件沙箱 PoC

## 现状安全分析

### 已有的安全机制
- `ALLOWED_PLUGIN_COMMANDS` 白名单限制 Tauri invoke 调用
- 插件存储按 `pluginId` 命名空间隔离
- 配置访问返回深拷贝（只读快照）
- `PluginErrorBoundary` 捕获渲染错误

### 安全缺陷
- 插件代码与主程序运行在**同一 JS 上下文**
- 插件可以绕过 `PluginHostAPI` 直接 `import { invoke } from '@tauri-apps/api/core'`
- 插件可以访问 `window`、`document`、`localStorage`、`fetch` 等全局 API
- 插件可以访问其他插件的数据、修改全局 store
- 无 API 调用审计日志
- 无资源限制（CPU/内存/网络）

## PoC 方案：渐进式安全加固

不采用 iframe 完全隔离（会破坏所有 28 个现有内置插件），而是做**渐进式加固**：

### 1. 插件信任等级

```typescript
type PluginTrustLevel = 'builtin' | 'trusted' | 'sandboxed';
```

| 等级 | 说明 | 限制 |
|------|------|------|
| `builtin` | 主程序内置插件 | 无额外限制 |
| `trusted` | 用户手动信任的第三方插件 | API 调用审计 |
| `sandboxed` | 未信任的第三方插件 | API 调用审计 + 权限检查 + 网络/存储限制 |

### 2. 权限声明（manifest.json 扩展）

```json
{
  "permissions": {
    "invoke": ["pandoc_export", "check_pandoc"],
    "network": false,
    "storage": true,
    "ai": true,
    "clipboard": true
  }
}
```

### 3. 安全 PluginHostAPI 包装（PluginSandbox）

为 `sandboxed` 和 `trusted` 级别插件创建 Proxy 包装的 HostAPI：
- **invoke 权限检查**：对照 manifest.permissions.invoke 白名单
- **API 调用审计日志**：记录所有 API 调用（方法名、参数摘要、时间戳）
- **网络限制**：sandboxed 插件的 fetch 被拦截
- **存储限制**：强制 pluginId 命名空间

### 4. 运行时防护

- 在 `PluginHostProvider` 中根据信任等级选择原始或沙箱化 API
- 审计日志存储在内存中，供开发者查看

### 修改的文件

| 文件 | 变更 |
|------|------|
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/plugins/_framework/PluginSandbox.ts` | 新建：沙箱包装、权限检查、审计日志 |
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/plugins/_framework/PluginHostAPI.ts` | 扩展 PlatformAPI，添加审计钩子 |
| `/Users/jdh/Code/AiDocPlus/apps/desktop/src-ui/src/plugins/PluginToolArea.tsx` | 根据信任等级选择 API |
| `/Users/jdh/Code/AiDocPlus/packages/shared-types/src/index.ts` | PluginManifest 添加 permissions 字段 |
