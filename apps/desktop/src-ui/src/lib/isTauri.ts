/**
 * 检查是否运行在 Tauri 环境中
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
