import { useCallback } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { MarkdownEditor } from './MarkdownEditor';
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
  const { t } = useTranslation();

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
        <div className="flex-1" />

        {onMaximizeToggle && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={handleMaximize}
            title={isMaximized ? t('editor.composer.exitMaximize', { defaultValue: '退出最大化' }) : t('editor.composer.maximize', { defaultValue: '最大化' })}
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
          placeholder={t('editor.composer.placeholder', { defaultValue: '在此合并文档内容…可从工具栏的导入按钮导入正文、插件或文件内容，也可直接编辑。' })}
          theme={theme}
          showToolbar={true}
          showViewModeSwitch={true}
          editorId="composer-editor"
          importSources={{ aiContent, document }}
        />
      </div>
    </div>
  );
}
