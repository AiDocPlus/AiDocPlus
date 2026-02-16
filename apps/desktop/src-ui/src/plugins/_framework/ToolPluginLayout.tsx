import { useMemo, useState, useEffect, useRef } from 'react';
import { FileText, Puzzle, ChevronRight, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { usePluginHost, useThinkingContent } from './PluginHostAPI';
import { Button } from './ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui';
import { useTranslation } from '@/i18n';

export interface ToolPluginLayoutProps {
  /** 欢迎界面图标 */
  pluginIcon: React.ReactNode;
  /** 欢迎界面标题 */
  pluginTitle: string;
  /** 欢迎界面描述 */
  pluginDesc: string;
  /** 导入内容回调（文本 + 来源名称） */
  onImportContent: (text: string, source: string) => void;
  /** 插件自定义的额外工具栏按钮 */
  extraToolbar?: React.ReactNode;
  /** 功能区（插件完全自定义） */
  children: React.ReactNode;
  /** 是否有内容（控制欢迎界面显示） */
  hasContent?: boolean;
  /** 状态消息 */
  statusMsg?: string | null;
  /** 状态是否为错误 */
  statusIsError?: boolean;
  /** 状态栏额外内容 */
  statusExtra?: React.ReactNode;
}

/**
 * 功能执行类插件的统一布局
 * 三区域：① 标准内容导入工具栏 ② 功能区 ③ 状态区
 */
export function ToolPluginLayout({
  pluginIcon,
  pluginTitle,
  pluginDesc,
  onImportContent,
  extraToolbar,
  children,
  hasContent = true,
  statusMsg,
  statusIsError,
  statusExtra,
}: ToolPluginLayoutProps) {
  const { t } = useTranslation('plugin-framework');
  const host = usePluginHost();

  // ── 状态区：思考内容 + 收缩/展开 ──
  const thinkingContent = useThinkingContent();
  const [statusExpanded, setStatusExpanded] = useState(false);
  const prevThinkingRef = useRef(thinkingContent);
  const prevStatusMsgRef = useRef(statusMsg);
  const statusScrollRef = useRef<HTMLDivElement>(null);
  const [statusLogs, setStatusLogs] = useState<Array<{ msg: string; isError: boolean }>>([]);

  // statusMsg 变化时追加到历史
  useEffect(() => {
    if (statusMsg && statusMsg !== prevStatusMsgRef.current) {
      setStatusLogs(prev => [...prev, { msg: statusMsg, isError: !!statusIsError }]);
      setStatusExpanded(true);
      requestAnimationFrame(() => {
        if (statusScrollRef.current) {
          statusScrollRef.current.scrollTop = statusScrollRef.current.scrollHeight;
        }
      });
    }
    prevStatusMsgRef.current = statusMsg;
  }, [statusMsg, statusIsError]);

  // 有新的思考内容到来时自动展开并滚动到底部
  useEffect(() => {
    if (thinkingContent && thinkingContent !== prevThinkingRef.current) {
      setStatusExpanded(true);
      requestAnimationFrame(() => {
        if (statusScrollRef.current) {
          statusScrollRef.current.scrollTop = statusScrollRef.current.scrollHeight;
        }
      });
    }
    prevThinkingRef.current = thinkingContent;
  }, [thinkingContent]);

  // 获取插件片段（用于"从插件导入"下拉菜单）
  const fragmentGroups = useMemo(() => host.content.getPluginFragments(), [host]);
  const hasFragments = fragmentGroups.size > 0;

  // ── 导入操作 ──
  const handleImportContent = () => {
    const text = host.content.getAIContent() || host.content.getDocumentContent();
    if (!text?.trim()) {
      host.ui.showStatus(t('importEmpty', { defaultValue: '正文内容为空' }), true);
      return;
    }
    onImportContent(text, t('importFromContent', { defaultValue: '正文' }));
  };

  const handleImportComposed = () => {
    const text = host.content.getComposedContent();
    if (!text?.trim()) {
      host.ui.showStatus(t('importComposedEmpty', { defaultValue: '合并区内容为空' }), true);
      return;
    }
    onImportContent(text, t('importFromComposed', { defaultValue: '合并区' }));
  };

  const handleImportFragment = (markdown: string, title: string) => {
    onImportContent(markdown, title);
  };

  // ── 欢迎界面 ──
  if (!hasContent) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 px-8">
            {pluginIcon}
            <h3 className="text-lg font-medium text-muted-foreground">{pluginTitle}</h3>
            <p className="text-sm text-muted-foreground/70 max-w-sm">{pluginDesc}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* ① 工具栏 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b bg-muted/30 flex-shrink-0">
        {/* 导入正文 */}
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleImportContent}>
          <FileText className="h-3 w-3" />
          {t('importContent', { defaultValue: '导入正文' })}
        </Button>

        {/* 从插件导入 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" disabled={!hasFragments}>
              <Puzzle className="h-3 w-3" />
              {t('importPlugin', { defaultValue: '导入插件' })}
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {Array.from(fragmentGroups.entries()).map(([pluginId, group]) => {
              const IconComp = group.pluginIcon;
              if (group.fragments.length === 1) {
                const f = group.fragments[0];
                return (
                  <DropdownMenuItem key={pluginId} onClick={() => handleImportFragment(f.markdown, f.title)}>
                    {IconComp && <IconComp className="h-4 w-4 mr-2 flex-shrink-0" />}
                    <span className="truncate">{group.pluginName}：{f.title}</span>
                  </DropdownMenuItem>
                );
              }
              return (
                <DropdownMenuSub key={pluginId}>
                  <DropdownMenuSubTrigger>
                    {IconComp && <IconComp className="h-4 w-4 mr-2 flex-shrink-0" />}
                    <span className="truncate">{group.pluginName}</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48">
                    {group.fragments.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={() => handleImportFragment(f.markdown, f.title)}>
                        <span className="truncate">{f.title}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      const allMd = group.fragments.map(f => f.markdown).join('\n\n---\n\n');
                      handleImportFragment(allMd, `${group.pluginName}（全部）`);
                    }}>
                      {t('insertAll', { defaultValue: '全部插入' })}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 导入合并区 */}
        <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleImportComposed}>
          {t('importComposed', { defaultValue: '导入合并区' })}
        </Button>

        {/* 插件自定义按钮 */}
        {extraToolbar}

        <div className="flex-1" />
      </div>

      {/* ② 功能区 */}
      <div className="flex-1 min-h-0 overflow-auto">
        {children}
      </div>

      {/* ③ 状态区（统一滚动区域） */}
      <div className="border-t bg-muted/30 flex-shrink-0">
        {statusExpanded && (
          <div
            ref={statusScrollRef}
            className="max-h-[150px] overflow-y-auto px-3 py-1.5 text-xs whitespace-pre-wrap border-b"
            style={{ fontFamily: '宋体', fontSize: '12px' }}
          >
            {statusLogs.map((log, i) => (
              <div key={i} className={log.isError ? 'text-destructive' : 'text-muted-foreground'}>
                {log.msg}
              </div>
            ))}
            {thinkingContent && (
              <div className="text-muted-foreground mt-1">{thinkingContent}</div>
            )}
            {statusLogs.length === 0 && !thinkingContent && (
              <div className="text-muted-foreground">暂无状态信息</div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-1 min-h-[24px]">
          {statusExtra}
          <div className="flex-1 truncate text-muted-foreground">
            {!statusExpanded && statusMsg && (
              <span className={`text-xs ${statusIsError ? 'text-destructive' : 'text-muted-foreground'}`}>
                {statusMsg}
              </span>
            )}
          </div>
          <button
            onClick={() => setStatusExpanded(!statusExpanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={statusExpanded ? '收起' : '展开'}
          >
            <Brain className="h-3 w-3" />
            <span>状态</span>
            {statusExpanded
              ? <ChevronDown className="h-3 w-3" />
              : <ChevronUp className="h-3 w-3" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
