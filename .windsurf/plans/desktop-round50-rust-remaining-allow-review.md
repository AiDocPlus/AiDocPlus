# Desktop Round50 计划

## 目标

- 继续推进 Rust 阶段 4 清理，重新扫描 `apps/desktop/src-tauri/src` 中剩余的 `allow` 抑制点。
- 区分哪些局部抑制已经足够精确，哪些仍可继续收缩。
- 仅处理低风险、可由编译器结果证明安全的目标。

## 执行步骤

1. 搜索剩余 `allow(dead_code)`、`allow(non_snake_case)`、`allow(unused_*)`。
2. 判断是否仍存在文件级或过宽范围抑制。
3. 对下一组低风险目标做最小修改。
4. 执行构建验证。

## 约束

- 不删真正承担兼容作用的局部 `allow`。
- 不做行为性重构。
- 保持 Tauri 参数协议与 Rust 类型兼容性不变。
