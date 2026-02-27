import { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ChevronRight, ChevronDown, File, Folder, FolderOpen,
  FilePlus, FolderPlus, Trash2, Pencil, RefreshCw, Search, X, Star,
} from 'lucide-react';

// ── 类型 ──
export interface FileTreeNode {
  name: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  modifiedAt: number;
  children?: FileTreeNode[];
}

interface CodingFileTreeProps {
  onOpenFile: (relativePath: string) => void;
  activeFilePath?: string;
  favorites?: string[];
  onToggleFavorite?: (relativePath: string) => void;
}

// ── 语言图标颜色 ──
function extColor(name: string): string {
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

// ── 单个树节点 ──
function TreeNode({
  node, depth, onOpenFile, activeFilePath,
  onRefresh, expandedDirs, toggleDir, favorites, onToggleFavorite,
}: {
  node: FileTreeNode;
  depth: number;
  onOpenFile: (p: string) => void;
  activeFilePath?: string;
  onRefresh: () => void;
  expandedDirs: Set<string>;
  toggleDir: (p: string) => void;
  favorites?: string[];
  onToggleFavorite?: (relativePath: string) => void;
}) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const isExpanded = expandedDirs.has(node.relativePath);
  const isActive = !node.isDir && node.relativePath === activeFilePath;
  const isFav = !node.isDir && (favorites || []).includes(node.relativePath);

  const handleClick = useCallback(() => {
    if (node.isDir) {
      toggleDir(node.relativePath);
    } else {
      onOpenFile(node.relativePath);
    }
  }, [node, toggleDir, onOpenFile]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleRename = useCallback(async () => {
    if (!renameName.trim() || renameName === node.name) { setRenaming(false); return; }
    try {
      const parentDir = node.relativePath.includes('/')
        ? node.relativePath.substring(0, node.relativePath.lastIndexOf('/'))
        : '';
      const newPath = parentDir ? `${parentDir}/${renameName}` : renameName;
      await invoke('move_coding_item', { fromPath: node.relativePath, toPath: newPath });
      onRefresh();
    } catch (e) {
      console.error('重命名失败:', e);
    }
    setRenaming(false);
  }, [renameName, node, onRefresh]);

  const handleDelete = useCallback(async () => {
    try {
      if (node.isDir) {
        await invoke('delete_coding_folder', { folderPath: node.relativePath });
      } else {
        await invoke('delete_coding_script', { filePath: node.relativePath });
      }
      onRefresh();
    } catch (e) {
      console.error('删除失败:', e);
    }
    setCtxMenu(null);
  }, [node, onRefresh]);

  // 关闭右键菜单
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [ctxMenu]);

  useEffect(() => {
    if (renaming && renameRef.current) renameRef.current.focus();
  }, [renaming]);

  return (
    <div>
      <div
        className={`flex items-center gap-0.5 px-1 py-0.5 cursor-pointer rounded text-sm hover:bg-muted/60 select-none ${isActive ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-medium' : ''}`}
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={node.relativePath}
      >
        {node.isDir ? (
          <>
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />}
            {isExpanded ? <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500" /> : <Folder className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500" />}
          </>
        ) : (
          <>
            <span className="w-3.5 flex-shrink-0" />
            <File className={`h-3.5 w-3.5 flex-shrink-0 ${extColor(node.name)}`} />
          </>
        )}
        {renaming ? (
          <Input
            ref={renameRef}
            value={renameName}
            onChange={e => setRenameName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
            className="h-5 text-xs px-1 py-0 flex-1 min-w-0"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="truncate flex-1 text-xs flex items-center gap-0.5">
            {isFav && <Star className="h-2.5 w-2.5 text-amber-500 flex-shrink-0 fill-amber-500" />}
            {node.name}
          </span>
        )}
        {!node.isDir && !renaming && <span className="text-[9px] text-muted-foreground/40 flex-shrink-0 pr-1">{node.size >= 1024 ? `${(node.size / 1024).toFixed(1)}K` : `${node.size}B`}</span>}
      </div>

      {/* 子节点 */}
      {node.isDir && isExpanded && node.children && node.children.map(child => (
        <TreeNode
          key={child.relativePath}
          node={child}
          depth={depth + 1}
          onOpenFile={onOpenFile}
          activeFilePath={activeFilePath}
          onRefresh={onRefresh}
          expandedDirs={expandedDirs}
          toggleDir={toggleDir}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
        />
      ))}

      {/* 右键菜单 */}
      {ctxMenu && (
        <div
          className="fixed z-50 bg-popover border rounded shadow-md py-1 min-w-[120px] text-xs"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          {!node.isDir && onToggleFavorite && (
            <button className="w-full px-3 py-1 text-left hover:bg-muted flex items-center gap-1.5"
              onClick={() => { setCtxMenu(null); onToggleFavorite(node.relativePath); }}>
              <Star className={`h-3 w-3 ${isFav ? 'text-amber-500 fill-amber-500' : ''}`} />
              {isFav ? t('coding.removeFavorite', { defaultValue: '取消收藏' }) : t('coding.addFavorite', { defaultValue: '添加收藏' })}
            </button>
          )}
          <button className="w-full px-3 py-1 text-left hover:bg-muted flex items-center gap-1.5"
            onClick={() => { setCtxMenu(null); setRenameName(node.name); setRenaming(true); }}>
            <Pencil className="h-3 w-3" />{t('coding.rename', { defaultValue: '重命名' })}
          </button>
          <button className="w-full px-3 py-1 text-left hover:bg-muted flex items-center gap-1.5 text-red-500"
            onClick={handleDelete}>
            <Trash2 className="h-3 w-3" />{t('common.delete', { defaultValue: '删除' })}
          </button>
        </div>
      )}
    </div>
  );
}

interface SearchResultItem {
  filePath: string;
  line: number;
  text: string;
}

// ── 主组件 ──
export function CodingFileTree({ onOpenFile, activeFilePath, favorites, onToggleFavorite }: CodingFileTreeProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<FileTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [newItemMode, setNewItemMode] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const newItemRef = useRef<HTMLInputElement>(null);

  // ── 全局搜索 ──
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await invoke<SearchResultItem[]>('search_coding_files', { query: q });
        setSearchResults(res);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
  }, []);

  const loadTree = useCallback(async () => {
    setLoading(true);
    try {
      const nodes = await invoke<FileTreeNode[]>('list_coding_file_tree');
      setTree(nodes);
    } catch (e) {
      console.error('加载文件树失败:', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTree(); }, [loadTree]);

  // 文件变更监听：每 3 秒轮询刷新
  useEffect(() => {
    const timer = setInterval(() => {
      invoke<FileTreeNode[]>('list_coding_file_tree').then(nodes => {
        setTree(prev => {
          const prevJson = JSON.stringify(prev);
          const nextJson = JSON.stringify(nodes);
          return prevJson === nextJson ? prev : nodes;
        });
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }, []);

  const handleCreateItem = useCallback(async () => {
    if (!newItemName.trim() || !newItemMode) { setNewItemMode(null); return; }
    try {
      if (newItemMode === 'folder') {
        await invoke('create_coding_folder', { folderPath: newItemName.trim() });
      } else {
        await invoke('save_coding_script', { filePath: newItemName.trim(), content: '' });
      }
      await loadTree();
      if (newItemMode === 'file') onOpenFile(newItemName.trim());
    } catch (e) {
      console.error('创建失败:', e);
    }
    setNewItemMode(null);
    setNewItemName('');
  }, [newItemName, newItemMode, loadTree, onOpenFile]);

  useEffect(() => {
    if (newItemMode && newItemRef.current) newItemRef.current.focus();
  }, [newItemMode]);

  return (
    <div className="h-full flex flex-col text-sm">
      {/* 工具栏 */}
      <div className="flex items-center gap-0.5 px-1 py-1 border-b">
        <span className="text-xs font-medium text-muted-foreground flex-1 truncate px-1">
          {t('coding.fileExplorer', { defaultValue: '文件' })}
        </span>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0"
          onClick={() => { setNewItemMode('file'); setNewItemName('untitled.py'); }}
          title={t('coding.newFile', { defaultValue: '新建文件' })}>
          <FilePlus className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0"
          onClick={() => { setNewItemMode('folder'); setNewItemName(''); }}
          title={t('coding.newFolder', { defaultValue: '新建文件夹' })}>
          <FolderPlus className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="sm" className="h-5 w-5 p-0"
          onClick={loadTree} disabled={loading}
          title={t('coding.refreshTree', { defaultValue: '刷新' })}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
        <Button variant={searchMode ? 'default' : 'ghost'} size="sm" className="h-5 w-5 p-0"
          onClick={() => { setSearchMode(v => !v); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          title={t('coding.globalSearch', { defaultValue: '搜索' })}>
          <Search className="h-3 w-3" />
        </Button>
      </div>

      {/* 新建输入 */}
      {newItemMode && (
        <div className="px-1 py-1 border-b flex items-center gap-1">
          {newItemMode === 'folder' ? <Folder className="h-3 w-3 text-yellow-500" /> : <File className="h-3 w-3 text-muted-foreground" />}
          <Input
            ref={newItemRef}
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            onBlur={handleCreateItem}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateItem(); if (e.key === 'Escape') { setNewItemMode(null); setNewItemName(''); } }}
            className="h-5 text-xs px-1 py-0 flex-1"
            placeholder={newItemMode === 'folder' ? t('coding.folderName', { defaultValue: '文件夹名' }) : t('coding.fileName', { defaultValue: '文件名' })}
          />
        </div>
      )}

      {/* 搜索框 */}
      {searchMode && (
        <div className="px-1 py-1 border-b flex items-center gap-1">
          <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setSearchMode(false); setSearchQuery(''); setSearchResults([]); } }}
            className="h-5 text-xs px-1 py-0 flex-1"
            placeholder={t('coding.searchPlaceholder', { defaultValue: '搜索文件内容...' })}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="p-0.5 hover:bg-muted rounded" title={t('common.clear', { defaultValue: '清除' })}>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* 搜索结果 / 文件树 */}
      {searchMode && searchQuery ? (
        <div className="flex-1 overflow-y-auto py-0.5">
          {searching && <div className="text-xs text-muted-foreground text-center py-4">{t('common.loading', { defaultValue: '搜索中...' })}</div>}
          {!searching && searchResults.length === 0 && searchQuery && (
            <div className="text-xs text-muted-foreground text-center py-4">{t('coding.searchNoResults', { defaultValue: '无搜索结果' })}</div>
          )}
          {searchResults.map((r, i) => (
            <button key={i}
              className="w-full text-left px-2 py-1 hover:bg-muted/50 text-xs border-b border-border/30"
              onClick={() => onOpenFile(r.filePath)}
            >
              <div className="flex items-center gap-1">
                <File className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="font-medium truncate">{r.filePath}</span>
                <span className="text-muted-foreground/60 flex-shrink-0">:{r.line}</span>
              </div>
              <div className="text-muted-foreground truncate pl-4 mt-0.5">{r.text.trim()}</div>
            </button>
          ))}
          {searchResults.length > 0 && (
            <div className="text-[10px] text-muted-foreground/50 text-center py-1">
              {searchResults.length} {t('coding.searchMatches', { defaultValue: '个匹配' })}
            </div>
          )}
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto py-0.5">
        {tree.length === 0 && !loading && (
          <div className="text-xs text-muted-foreground text-center py-4">
            {t('coding.emptyDir', { defaultValue: '目录为空' })}
          </div>
        )}
        {tree.map(node => (
          <TreeNode
            key={node.relativePath}
            node={node}
            depth={0}
            onOpenFile={onOpenFile}
            activeFilePath={activeFilePath}
            onRefresh={loadTree}
            expandedDirs={expandedDirs}
            toggleDir={toggleDir}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
      )}
    </div>
  );
}
