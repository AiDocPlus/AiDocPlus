import { invoke } from '@tauri-apps/api/core';

export interface FileTreeNode {
  name: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  modifiedAt: number;
  children?: FileTreeNode[];
}

export interface SearchResultItem {
  filePath: string;
  line: number;
  text: string;
}

export function getCodingFileExtColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    py: 'text-yellow-500', js: 'text-yellow-400', jsx: 'text-blue-400',
    ts: 'text-blue-500', tsx: 'text-blue-400', html: 'text-orange-500',
    css: 'text-purple-500', json: 'text-green-500', md: 'text-gray-500',
    sh: 'text-green-600', sql: 'text-red-400', xml: 'text-orange-400',
    yaml: 'text-pink-500', yml: 'text-pink-500', toml: 'text-gray-600',
    txt: 'text-gray-400',
  };
  return map[ext] || 'text-muted-foreground';
}

export function isFavoriteCodingFile(relativePath: string, favorites?: string[]): boolean {
  return (favorites || []).includes(relativePath);
}

export function formatCodingFileSize(size: number): string {
  return size >= 1024 ? `${(size / 1024).toFixed(1)}K` : `${size}B`;
}

export function buildMovedCodingItemPath(relativePath: string, nextName: string): string {
  const parentDir = relativePath.includes('/')
    ? relativePath.substring(0, relativePath.lastIndexOf('/'))
    : '';
  return parentDir ? `${parentDir}/${nextName}` : nextName;
}

export function toggleExpandedCodingDir(expandedDirs: Set<string>, path: string): Set<string> {
  const next = new Set(expandedDirs);
  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }
  return next;
}

export function shouldReplaceCodingFileTree(prev: FileTreeNode[], next: FileTreeNode[]): boolean {
  return JSON.stringify(prev) !== JSON.stringify(next);
}

export function normalizeCodingNewItemName(name: string): string {
  return name.trim();
}

export async function searchCodingFilesCommand(query: string): Promise<SearchResultItem[]> {
  return invoke<SearchResultItem[]>('search_coding_files', { query });
}

export async function listCodingFileTreeCommand(): Promise<FileTreeNode[]> {
  return invoke<FileTreeNode[]>('list_coding_file_tree');
}

export async function moveCodingItemCommand(fromPath: string, toPath: string): Promise<void> {
  await invoke('move_coding_item', { fromPath, toPath });
}

export async function deleteCodingFolderCommand(folderPath: string): Promise<void> {
  await invoke('delete_coding_folder', { folderPath });
}

export async function deleteCodingScriptCommand(filePath: string): Promise<void> {
  await invoke('delete_coding_script', { filePath });
}

export async function createCodingFolderCommand(folderPath: string): Promise<void> {
  await invoke('create_coding_folder', { folderPath });
}

export async function createEmptyCodingScriptCommand(filePath: string): Promise<void> {
  await invoke('save_coding_script', { filePath, content: '' });
}
