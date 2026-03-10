# Desktop Round55 计划

## 目标

- 继续推进 Rust 阶段 4，聚焦 `apps/desktop/src-tauri/src/api_gateway.rs`。
- 审计权限白名单、方法名解析、命名空间分发中的重复样板。
- 只提取纯 helper 或收口低风险分支，保持 HTTP/API 调用行为不变。

## 执行步骤

1. 审查权限检查、方法解析、命名空间路由结构。
2. 识别可以抽离的纯 helper。
3. 保持错误码、方法名和路由语义不变。
4. 执行 `cargo check` 验证。

## 约束

- 不改白名单语义。
- 不改 JSON-RPC 风格请求结构。
- 不扩大到无关模块。
