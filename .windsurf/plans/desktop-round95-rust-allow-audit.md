# Desktop Round95 计划 / 审计结论

## 目标

- 复查 Rust 侧剩余 `#[allow(...)]` 命中，确认是否还有适合低风险继续收口的一组。
- 区分真正的死代码抑制与前后端接口约束导致的命名抑制。

## 审计结果

- `apps/desktop/src-tauri/src/ai.rs` 中与 `dead_code` 直接相关的一组热点，已在前两轮完成收口。
- 当前剩余 `#[allow(...)]` 命中，主要集中在多个 Tauri command 的参数名与部分导出结构上，类型几乎全部为 `#[allow(non_snake_case)]`。
- 这些命中用于保持前端传参字段与 Rust command 参数的 `camelCase` 兼容，不属于死代码，也不是简单删除即可收口的宽泛抑制。

## 结论

- Rust 侧当前这条 `dead_code` / 宽泛 `allow` 低风险清理线，已基本完成可机械收口的部分。
- 若继续推进，下一步将不再是简单删除，而是需要评估是否引入参数重命名、桥接层或请求结构体封装，风险明显上升。

## 约束

- 不改 Tauri command 接口。
- 不改前端传参字段名。
- 不为删除 `allow(non_snake_case)` 而引入高风险接口改造。
