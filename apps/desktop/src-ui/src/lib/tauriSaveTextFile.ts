import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

export type SaveTextFileFilter = { name: string; extensions: string[] };

/**
 * 打开系统「另存为」对话框并将 UTF-8 文本写入所选路径（与图片二进制导出共用 write_binary_file，支持新文件路径）
 * @returns 用户选择的路径，取消时为 null
 */
export async function saveTextFileWithDialog(params: {
  defaultPath: string;
  filters: SaveTextFileFilter[];
  content: string;
}): Promise<string | null> {
  const filePath = await save({
    defaultPath: params.defaultPath,
    filters: params.filters,
  });
  if (!filePath) return null;
  const bytes = new TextEncoder().encode(params.content);
  await invoke('write_binary_file', {
    path: filePath,
    data: Array.from(bytes),
  });
  return filePath;
}
