import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';

export type SaveBlobFileFilter = { name: string; extensions: string[] };

/**
 * 系统「另存为」对话框 + 二进制写入（与任务清单图片导出一致）
 */
export async function saveBlobWithDialog(params: {
  defaultPath: string;
  filters: SaveBlobFileFilter[];
  blob: Blob;
}): Promise<string | null> {
  const filePath = await save({
    defaultPath: params.defaultPath,
    filters: params.filters,
  });
  if (!filePath) return null;
  const bytes = new Uint8Array(await params.blob.arrayBuffer());
  await invoke('write_binary_file', {
    path: filePath,
    data: Array.from(bytes),
  });
  return filePath;
}
