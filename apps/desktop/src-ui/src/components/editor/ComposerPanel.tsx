import { useState, useCallback, useMemo } from 'react';
import { FileText, Puzzle, FileUp, Maximize2, Minimize2, ChevronRight } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { MarkdownEditor } from './MarkdownEditor';
import { getFragmentsGroupedByPlugin } from '@/plugins/fragments';
import type { Document } from '@aidocplus/shared-types';

interface ComposerPanelProps {
  document: Document;
  composedContent: string;
  onComposedContentChange: (value: string) => void;
  aiContent: string;
  theme?: 'light' | 'dark';
  isMaximized?: boolean;
  onMaximizeToggle?: () => void;
  leftSidebarOpen?: boolean;
  onLeftSidebarToggle?: (open: boolean) => void;
  rightSidebarOpen?: boolean;
  onRightSidebarToggle?: (open: boolean) => void;
}

export function ComposerPanel({
  document,
  composedContent,
  onComposedContentChange,
  aiContent,
  theme,
  isMaximized,
  onMaximizeToggle,
  leftSidebarOpen,
  onLeftSidebarToggle,
  rightSidebarOpen,
  onRightSidebarToggle,
}: ComposerPanelProps) {
  const [statusMsg, setStatusMsg] = useState('');

  const showStatus = useCallback((msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  }, []);

  // 获取所有插件片段（按插件分组）
  const fragmentGroups = useMemo(() => getFragmentsGroupedByPlugin(document), [document]);
  const hasFragments = fragmentGroups.size > 0;

  // 从正文导入
  const handleImportFromContent = useCallback(() => {
    if (!aiContent?.trim()) {
      showStatus('正文内容为空');
      return;
    }
    const separator = composedContent.trim() ? '\n\n---\n\n' : '';
    onComposedContentChange(composedContent + separator + aiContent);
    showStatus('已从正文导入');
  }, [aiContent, composedContent, onComposedContentChange, showStatus]);

  // 从插件片段导入
  const handleInsertFragment = useCallback((markdown: string, title: string) => {
    const separator = composedContent.trim() ? '\n\n---\n\n' : '';
    onComposedContentChange(composedContent + separator + markdown);
    showStatus(`已插入：${title}`);
  }, [composedContent, onComposedContentChange, showStatus]);

  // 从文件导入
  const handleImportFromFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: '文本文件', extensions: ['md', 'markdown', 'txt'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (!selected || typeof selected !== 'string') return;

      const fileContent = await invoke<string>('import_file', { path: selected });
      if (!fileContent?.trim()) {
        showStatus('文件内容为空');
        return;
      }
      const separator = composedContent.trim() ? '\n\n---\n\n' : '';
      onComposedContentChange(composedContent + separator + fileContent);
      showStatus('已从文件导入');
    } catch (err) {
      console.error('Import file failed:', err);
      showStatus(`导入文件失败: ${err}`);
    }
  }, [composedContent, onComposedContentChange, showStatus]);

  // 最大化切换
  const handleMaximize = useCallback(() => {
    if (isMaximized) {
      // 恢复侧边栏
      if (leftSidebarOpen === false) onLeftSidebarToggle?.(true);
      if (rightSidebarOpen === false) onRightSidebarToggle?.(true);
    } else {
      // 隐藏侧边栏
      if (leftSidebarOpen) onLeftSidebarToggle?.(false);
      if (rightSidebarOpen) onRightSidebarToggle?.(false);
    }
    onMaximizeToggle?.();
  }, [isMaximized, leftSidebarOpen, rightSidebarOpen, onLeftSidebarToggle, onRightSidebarToggle, onMaximizeToggle]);

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/30 flex-shrink-0">
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleImportFromContent}>
          <FileText className="h-3 w-3" />
          从正文导入
        </Button>

        {/* 从插件导入（分类菜单） */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" disabled={!hasFragments}>
              <Puzzle className="h-3 w-3" />
              从插件导入
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {Array.from(fragmentGroups.entries()).map(([pluginId, group]) => {
              const IconComp = group.pluginIcon;
              if (group.fragments.length === 1) {
                // 单片段：直接显示为菜单项
                const f = group.fragments[0];
                return (
                  <DropdownMenuItem key={pluginId} onClick={() => handleInsertFragment(f.markdown, f.title)}>
                    {IconComp && <IconComp className="h-4 w-4 mr-2 flex-shrink-0" />}
                    <span className="truncate">{group.pluginName}：{f.title}</span>
                  </DropdownMenuItem>
                );
              }
              // 多片段：子菜单
              return (
                <DropdownMenuSub key={pluginId}>
                  <DropdownMenuSubTrigger>
                    {IconComp && <IconComp className="h-4 w-4 mr-2 flex-shrink-0" />}
                    <span className="truncate">{group.pluginName}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {group.fragments.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={() => handleInsertFragment(f.markdown, f.title)}>
                        <span className="truncate">{f.title}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      const allMd = group.fragments.map(f => f.markdown).join('\n\n---\n\n');
                      handleInsertFragment(allMd, `${group.pluginName}（全部）`);
                    }}>
                      全部插入
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleImportFromFile}>
          <FileUp className="h-3 w-3" />
          从文件导入
        </Button>

        <div className="flex-1" />

        {statusMsg && (
          <span className="text-xs text-muted-foreground animate-in fade-in">{statusMsg}</span>
        )}

        {onMaximizeToggle && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={handleMaximize}
            title={isMaximized ? '退出最大化' : '最大化'}
          >
            {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        )}
      </div>

      {/* 编辑器区域 */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MarkdownEditor
          value={composedContent}
          onChange={onComposedContentChange}
          placeholder="在此合并文档内容…可从正文、插件或文件导入内容，也可直接编辑。"
          theme={theme}
          showToolbar={true}
          showViewModeSwitch={true}
          editorId="composer-editor"
        />
      </div>
    </div>
  );
}
