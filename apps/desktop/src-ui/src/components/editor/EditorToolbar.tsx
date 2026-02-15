import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  CodeXml,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  Quote,
  Minus,
  CheckSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  Table,
  Workflow,
  RemoveFormatting,
  Sigma,
  Asterisk,
  FileUp,
  Undo2,
  Redo2,
  Copy,
  Check,
  ClipboardPaste,
  Scissors,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  ListTree,
  Code2,
  Eye,
  Columns,
} from 'lucide-react';
import React, { useState, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '../ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/useSettingsStore';

// CodeMirror 辅助函数（带 try-catch 防止 view 失效时崩溃）
function cmWrap(
  view: EditorView,
  prefix: string,
  suffix: string,
  placeholder: string
) {
  try {
    const { from, to } = view.state.selection.main;
    const sel = view.state.sliceDoc(from, to);
    const text = sel || placeholder;
    const insert = prefix + text + suffix;
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + prefix.length, head: from + prefix.length + text.length },
    });
    view.focus();
  } catch (e) {
    console.warn('[EditorToolbar] cmWrap failed:', e);
  }
}

function cmLinePrefix(
  view: EditorView,
  prefix: string
) {
  try {
    const { from } = view.state.selection.main;
    const line = view.state.doc.lineAt(from);
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: prefix },
      selection: { anchor: from + prefix.length },
    });
    view.focus();
  } catch (e) {
    console.warn('[EditorToolbar] cmLinePrefix failed:', e);
  }
}

function cmInsert(
  view: EditorView,
  text: string
) {
  try {
    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  } catch (e) {
    console.warn('[EditorToolbar] cmInsert failed:', e);
  }
}

function cmGetSelection(view: EditorView): string {
  try {
    const { from, to } = view.state.selection.main;
    return view.state.sliceDoc(from, to);
  } catch {
    return '';
  }
}

// 清除选中文本中的 Markdown 格式标记
function cmClearFormat(view: EditorView) {
  try {
    const { from, to } = view.state.selection.main;
    if (from === to) return; // 没有选中内容时不操作
    let text = view.state.sliceDoc(from, to);
    // 去除粗体/斜体/删除线/行内代码
    text = text.replace(/\*\*\*(.+?)\*\*\*/g, '$1');  // ***bold italic***
    text = text.replace(/\*\*(.+?)\*\*/g, '$1');       // **bold**
    text = text.replace(/\*(.+?)\*/g, '$1');            // *italic*
    text = text.replace(/~~(.+?)~~/g, '$1');            // ~~strikethrough~~
    text = text.replace(/`([^`]+)`/g, '$1');            // `code`
    // 去除行首的标题/列表/引用标记
    text = text.replace(/^#{1,6}\s+/gm, '');            // # heading
    text = text.replace(/^>\s?/gm, '');                 // > quote
    text = text.replace(/^[-*+]\s+/gm, '');             // - list
    text = text.replace(/^\d+\.\s+/gm, '');             // 1. list
    text = text.replace(/^- \[[ x]\]\s+/gm, '');        // - [ ] task
    // 去除链接格式，保留文本
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url)
    view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from, head: from + text.length },
    });
    view.focus();
  } catch (e) {
    console.warn('[EditorToolbar] cmClearFormat failed:', e);
  }
}

interface ToolbarButtonProps {
  active?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  tooltip?: string;
}

function ToolbarButton({ active, onClick, icon, tooltip }: ToolbarButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn('h-7 w-7 p-0', active && 'bg-muted')}
      title={tooltip}
    >
      {icon}
    </Button>
  );
}

type ViewMode = 'edit' | 'preview' | 'split';

interface EditorToolbarProps {
  cmViewRef: React.RefObject<EditorView | null>;
  outlineOpen?: boolean;
  onToggleOutline?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showViewModeSwitch?: boolean;
}

export function EditorToolbar({ cmViewRef, outlineOpen, onToggleOutline, viewMode, onViewModeChange, showViewModeSwitch }: EditorToolbarProps) {
  const tb = useSettingsStore((s) => s.editor.toolbarButtons) ?? {};

  // 延迟执行操作，确保在 DropdownMenu 关闭后再操作 CodeMirror，避免 React 渲染冲突
  const runAction = (fn: (view: EditorView) => void) => {
    setTimeout(() => {
      const v = cmViewRef.current;
      if (v) fn(v);
    }, 0);
  };

  const doWrap = (prefix: string, suffix: string, ph: string) => {
    runAction((v) => cmWrap(v, prefix, suffix, ph));
  };
  const doPrefix = (prefix: string) => {
    runAction((v) => cmLinePrefix(v, prefix));
  };
  const doInsert = (text: string) => {
    runAction((v) => cmInsert(v, text));
  };

  // 分隔线：当左右两侧各至少有一个按钮可见时才渲染
  const Sep = ({ left, right }: { left: boolean[]; right: boolean[] }) => {
    if (!left.some(v => v !== false) || !right.some(v => v !== false)) return null;
    return <div className="w-px h-6 bg-border mx-1" />;
  };

  const s = (key: keyof typeof tb) => tb[key] !== false;

  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1 bg-background flex-wrap flex-shrink-0">

      {/* ── 编辑操作 ── */}
      {s('undo') && <FeedbackButton
        onClick={() => runAction((v) => undo(v))}
        icon={<Undo2 className="h-4 w-4" />}
        tooltip="撤销 (Cmd+Z)"
        doneTooltip="已撤销"
      />}
      {s('redo') && <FeedbackButton
        onClick={() => runAction((v) => redo(v))}
        icon={<Redo2 className="h-4 w-4" />}
        tooltip="重做 (Cmd+Shift+Z)"
        doneTooltip="已重做"
      />}
      {s('copy') && <FeedbackButton
        onClick={() => runAction((v) => { const sel = cmGetSelection(v); if (sel) navigator.clipboard.writeText(sel); })}
        icon={<Copy className="h-4 w-4" />}
        tooltip="复制 (Cmd+C)"
        doneTooltip="已复制"
      />}
      {s('cut') && <FeedbackButton
        onClick={() => runAction((v) => { const sel = cmGetSelection(v); if (sel) { navigator.clipboard.writeText(sel); const { from, to } = v.state.selection.main; v.dispatch({ changes: { from, to, insert: '' } }); } })}
        icon={<Scissors className="h-4 w-4" />}
        tooltip="剪切 (Cmd+X)"
        doneTooltip="已剪切"
      />}
      {s('paste') && <FeedbackButton
        onClick={() => runAction(async (v) => { try { const text = await navigator.clipboard.readText(); if (text) cmInsert(v, text); } catch { /* clipboard access denied */ } })}
        icon={<ClipboardPaste className="h-4 w-4" />}
        tooltip="粘贴 (Cmd+V)"
        doneTooltip="已粘贴"
      />}
      {s('clearAll') && <FeedbackButton
        onClick={() => runAction((v) => {
          const len = v.state.doc.length;
          if (len > 0) v.dispatch({ changes: { from: 0, to: len, insert: '' } });
        })}
        icon={<Trash2 className="h-4 w-4" />}
        tooltip="清空全部内容"
        doneTooltip="已清空"
      />}

      <Sep left={[s('undo'), s('redo'), s('copy'), s('cut'), s('paste'), s('clearAll')]} right={[s('headings')]} />

      {/* ── 标题 ── */}
      {s('headings') && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="标题">
            <Heading1 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => doPrefix('# ')}><Heading1 className="h-4 w-4 mr-2" />一级标题</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('## ')}><Heading2 className="h-4 w-4 mr-2" />二级标题</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('### ')}><Heading3 className="h-4 w-4 mr-2" />三级标题</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('#### ')}><Heading4 className="h-4 w-4 mr-2" />四级标题</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('##### ')}><Heading5 className="h-4 w-4 mr-2" />五级标题</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('###### ')}><Heading6 className="h-4 w-4 mr-2" />六级标题</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}

      <Sep left={[s('headings')]} right={[s('bold'), s('italic'), s('strikethrough'), s('inlineCode'), s('clearFormat')]} />

      {/* ── 文本格式 ── */}
      {s('bold') && <FeedbackButton onClick={() => doWrap('**', '**', '粗体文本')} icon={<Bold className="h-4 w-4" />} tooltip="粗体 (Cmd+B)" doneTooltip="已加粗" />}
      {s('italic') && <FeedbackButton onClick={() => doWrap('*', '*', '斜体文本')} icon={<Italic className="h-4 w-4" />} tooltip="斜体 (Cmd+I)" doneTooltip="已斜体" />}
      {s('strikethrough') && <FeedbackButton onClick={() => doWrap('~~', '~~', '删除线文本')} icon={<Strikethrough className="h-4 w-4" />} tooltip="删除线 (Cmd+Shift+X)" doneTooltip="已添加删除线" />}
      {s('inlineCode') && <FeedbackButton onClick={() => doWrap('`', '`', '代码')} icon={<Code className="h-4 w-4" />} tooltip="行内代码 (Cmd+E)" doneTooltip="已添加代码" />}
      {s('clearFormat') && <FeedbackButton onClick={() => runAction((v) => cmClearFormat(v))} icon={<RemoveFormatting className="h-4 w-4" />} tooltip="清除格式" doneTooltip="已清除格式" />}

      <Sep left={[s('bold'), s('italic'), s('strikethrough'), s('inlineCode'), s('clearFormat')]} right={[s('unorderedList'), s('orderedList'), s('taskList'), s('quote'), s('horizontalRule')]} />

      {/* ── 段落结构 ── */}
      {s('unorderedList') && <FeedbackButton onClick={() => doPrefix('- ')} icon={<List className="h-4 w-4" />} tooltip="无序列表" doneTooltip="已插入" />}
      {s('orderedList') && <FeedbackButton onClick={() => doPrefix('1. ')} icon={<ListOrdered className="h-4 w-4" />} tooltip="有序列表" doneTooltip="已插入" />}
      {s('taskList') && <FeedbackButton onClick={() => doPrefix('- [ ] ')} icon={<CheckSquare className="h-4 w-4" />} tooltip="任务列表" doneTooltip="已插入" />}
      {s('quote') && <FeedbackButton onClick={() => doPrefix('> ')} icon={<Quote className="h-4 w-4" />} tooltip="引用" doneTooltip="已插入" />}
      {s('horizontalRule') && <FeedbackButton onClick={() => doInsert('\n---\n')} icon={<Minus className="h-4 w-4" />} tooltip="分隔线" doneTooltip="已插入" />}

      <Sep left={[s('unorderedList'), s('orderedList'), s('taskList'), s('quote'), s('horizontalRule')]} right={[s('link'), s('image'), s('table'), s('footnote')]} />

      {/* ── 插入内容 ── */}
      {s('link') && <LinkPopover runAction={runAction} />}
      {s('image') && <ImagePopover runAction={runAction} />}
      {s('table') && <TableGridPicker doInsert={doInsert} />}
      {s('footnote') && <FeedbackButton
        onClick={() => {
          runAction((v) => {
            const { from } = v.state.selection.main;
            const sel = cmGetSelection(v);
            const noteText = sel || '脚注内容';
            const insert = `[^1]\n\n[^1]: ${noteText}`;
            v.dispatch({
              changes: { from, to: from + sel.length, insert },
              selection: { anchor: from + insert.length - noteText.length, head: from + insert.length },
            });
            v.focus();
          });
        }}
        icon={<Asterisk className="h-4 w-4" />}
        tooltip="插入脚注"
        doneTooltip="已插入脚注"
      />}

      <Sep left={[s('link'), s('image'), s('table'), s('footnote')]} right={[s('codeBlock'), s('mermaid')]} />

      {/* ── 代码块 ── */}
      {s('codeBlock') && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="代码块">
            <CodeXml className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => doInsert('\n```\n\n```\n')}>普通代码块</DropdownMenuItem>
          {['javascript', 'typescript', 'python', 'rust', 'html', 'css', 'json', 'sql', 'bash'].map(lang => (
            <DropdownMenuItem key={lang} onClick={() => doInsert(`\n\`\`\`${lang}\n\n\`\`\`\n`)}>{lang}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>}

      {/* ── Mermaid 图表 ── */}
      {s('mermaid') && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Mermaid 图表">
            <Workflow className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 overflow-y-auto">
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\ngraph TD\n    A[开始] --> B{判断}\n    B -->|是| C[结果1]\n    B -->|否| D[结果2]\n```\n')}>流程图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nsequenceDiagram\n    participant A as 客户端\n    participant B as 服务器\n    A->>B: 请求\n    B-->>A: 响应\n```\n')}>时序图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nclassDiagram\n    class Animal {\n        +String name\n        +int age\n        +makeSound()\n    }\n    class Dog {\n        +fetch()\n    }\n    Animal <|-- Dog\n```\n')}>类图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nstateDiagram-v2\n    [*] --> 待处理\n    待处理 --> 进行中: 开始\n    进行中 --> 已完成: 完成\n    进行中 --> 待处理: 退回\n    已完成 --> [*]\n```\n')}>状态图</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER {\n        string name\n        string email\n    }\n    ORDER {\n        int orderNumber\n        date created\n    }\n```\n')}>ER 图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\npie title 项目占比\n    "分类A" : 40\n    "分类B" : 30\n    "分类C" : 20\n    "分类D" : 10\n```\n')}>饼图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\ngantt\n    title 项目计划\n    dateFormat YYYY-MM-DD\n    section 阶段一\n        任务1 :a1, 2024-01-01, 30d\n        任务2 :after a1, 20d\n    section 阶段二\n        任务3 :2024-02-20, 25d\n        任务4 :after a1, 15d\n```\n')}>甘特图</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nmindmap\n  root((中心主题))\n    分支A\n      子项1\n      子项2\n    分支B\n      子项3\n      子项4\n    分支C\n```\n')}>思维导图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\ntimeline\n    title 项目里程碑\n    2024-Q1 : 需求分析\n            : 技术选型\n    2024-Q2 : 开发阶段\n            : 单元测试\n    2024-Q3 : 集成测试\n            : 上线部署\n```\n')}>时间线</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\ngitGraph\n    commit\n    commit\n    branch develop\n    checkout develop\n    commit\n    commit\n    checkout main\n    merge develop\n    commit\n```\n')}>Git 图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\njourney\n    title 用户购物旅程\n    section 浏览\n      打开首页: 5: 用户\n      搜索商品: 4: 用户\n    section 购买\n      加入购物车: 3: 用户\n      结算支付: 2: 用户\n    section 售后\n      确认收货: 5: 用户\n```\n')}>用户旅程</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nquadrantChart\n    title 优先级矩阵\n    x-axis 低紧急 --> 高紧急\n    y-axis 低重要 --> 高重要\n    quadrant-1 立即执行\n    quadrant-2 计划执行\n    quadrant-3 委托他人\n    quadrant-4 暂时搁置\n    任务A: [0.8, 0.9]\n    任务B: [0.3, 0.7]\n    任务C: [0.7, 0.3]\n    任务D: [0.2, 0.2]\n```\n')}>象限图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nxychart-beta\n    title "月度销售额"\n    x-axis [1月, 2月, 3月, 4月, 5月, 6月]\n    y-axis "销售额（万元）" 0 --> 100\n    bar [30, 45, 60, 55, 70, 85]\n    line [30, 45, 60, 55, 70, 85]\n```\n')}>XY 图表</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nsankey-beta\n\n来源A,目标X,30\n来源A,目标Y,20\n来源B,目标X,15\n来源B,目标Z,25\n来源C,目标Y,10\n来源C,目标Z,20\n```\n')}>桑基图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nblock-beta\n    columns 3\n    前端 中间件 后端\n    space:3\n    数据库\n```\n')}>框图</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\narchitecture-beta\n    group api(cloud)[API]\n\n    service db(database)[数据库] in api\n    service disk1(disk)[存储] in api\n    service disk2(disk)[备份] in api\n    service server(server)[服务器] in api\n\n    db:L -- R:server\n    disk1:T -- B:server\n    disk2:T -- B:db\n```\n')}>架构图</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}

      <Sep left={[s('codeBlock'), s('mermaid')]} right={[s('math')]} />

      {/* ── 数学公式 ── */}
      {s('math') && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="数学公式">
            <Sigma className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => doWrap('$', '$', 'E=mc^2')}>行内公式 $...$</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n$$\n\\sum_{i=1}^{n} x_i\n$$\n')}>块级公式 $$...$$</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}

      <Sep left={[s('math')]} right={[s('goToTop'), s('goToBottom'), s('importFile')]} />

      {/* ── 导航 ── */}
      {s('goToTop') && <ToolbarButton
        onClick={() => runAction((v) => {
          // 滚动到文档开头
          v.dispatch({
            effects: EditorView.scrollIntoView(0, { y: 'start' })
          });
        })}
        icon={<ArrowUpToLine className="h-4 w-4" />}
        tooltip="滚动到顶部"
      />}
      {s('goToBottom') && <ToolbarButton
        onClick={() => runAction((v) => {
          // 滚动到文档末尾
          const docEnd = v.state.doc.length;
          v.dispatch({
            effects: EditorView.scrollIntoView(docEnd, { y: 'end' })
          });
        })}
        icon={<ArrowDownToLine className="h-4 w-4" />}
        tooltip="滚动到底部"
      />}

      <Sep left={[s('goToTop'), s('goToBottom')]} right={[s('importFile')]} />

      {/* ── 导入 ── */}
      {s('importFile') && <ImportButton runAction={runAction} />}

      {onToggleOutline && (
        <>
          <div className="w-px h-6 bg-border mx-1" />
          <ToolbarButton
            active={outlineOpen}
            onClick={onToggleOutline}
            icon={<ListTree className="h-4 w-4" />}
            tooltip={outlineOpen ? '关闭大纲' : '打开大纲'}
          />
        </>
      )}

      {/* ── 视图模式切换（右侧） ── */}
      {showViewModeSwitch && onViewModeChange && (
        <div className="ml-auto flex items-center gap-0.5 pl-2">
          <button
            type="button"
            onClick={() => onViewModeChange('edit')}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
              viewMode === 'edit' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : 'text-muted-foreground hover:text-foreground'
            )}
            title="编辑模式"
          >
            <Code2 className="h-3.5 w-3.5" />
            编辑
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('preview')}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
              viewMode === 'preview' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : 'text-muted-foreground hover:text-foreground'
            )}
            title="预览模式"
          >
            <Eye className="h-3.5 w-3.5" />
            预览
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('split')}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
              viewMode === 'split' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : 'text-muted-foreground hover:text-foreground'
            )}
            title="分屏模式"
          >
            <Columns className="h-3.5 w-3.5" />
            分屏
          </button>
        </div>
      )}
    </div>
  );
}

// ── 通用反馈按钮（点击后图标变为对勾 1.5s） ──
function FeedbackButton({ onClick, icon, tooltip, doneTooltip }: {
  onClick: () => void;
  icon: React.ReactNode;
  tooltip: string;
  doneTooltip: string;
}) {
  const [done, setDone] = useState(false);
  const handleClick = () => {
    onClick();
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <ToolbarButton
      onClick={handleClick}
      icon={done ? <Check className="h-4 w-4 text-green-500" /> : icon}
      tooltip={done ? doneTooltip : tooltip}
    />
  );
}

// ── 链接弹出框 ──
function LinkPopover({
  runAction,
}: {
  runAction: (fn: (v: EditorView) => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const handleInsert = useCallback(() => {
    const text = linkText || '链接文本';
    const url = linkUrl || 'https://';
    runAction((v) => {
      const { from, to } = v.state.selection.main;
      const sel = v.state.sliceDoc(from, to);
      const displayText = sel || text;
      const insert = `[${displayText}](${url})`;
      v.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + 1, head: from + 1 + displayText.length },
      });
      v.focus();
    });
    setLinkText('');
    setLinkUrl('');
    setOpen(false);
  }, [linkText, linkUrl, runAction]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="插入链接 (Cmd+K)">
          <LinkIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">插入链接</h4>
          <div className="space-y-2">
            <Label className="text-xs">链接文本</Label>
            <Input
              placeholder="链接文本（可选，使用选中文本）"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">URL 地址</Label>
            <Input
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <PopoverClose asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">取消</Button>
            </PopoverClose>
            <Button size="sm" className="h-7 text-xs" onClick={handleInsert}>插入</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 图片弹出框 ──
function ImagePopover({
  runAction,
}: {
  runAction: (fn: (v: EditorView) => void) => void;
}) {
  const [open, setOpen] = useState(false);
  const [altText, setAltText] = useState('');
  const [imgUrl, setImgUrl] = useState('');

  const handleInsert = useCallback(() => {
    const alt = altText || '图片';
    const url = imgUrl || 'https://';
    runAction((v) => {
      cmInsert(v, `![${alt}](${url})`);
    });
    setAltText('');
    setImgUrl('');
    setOpen(false);
  }, [altText, imgUrl, runAction]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="插入图片">
          <ImageIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">插入图片</h4>
          <div className="space-y-2">
            <Label className="text-xs">图片描述</Label>
            <Input
              placeholder="图片描述（alt 文本）"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">图片 URL</Label>
            <Input
              placeholder="https://example.com/image.png"
              value={imgUrl}
              onChange={(e) => setImgUrl(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <PopoverClose asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">取消</Button>
            </PopoverClose>
            <Button size="sm" className="h-7 text-xs" onClick={handleInsert}>插入</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 导入按钮 ──
function ImportButton({
  runAction,
}: {
  runAction: (fn: (v: EditorView) => void) => void;
}) {
  const [importing, setImporting] = useState(false);

  const handleImport = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: '文档文件',
            extensions: ['txt', 'md', 'markdown', 'docx', 'csv', 'html', 'htm', 'json', 'xml', 'yaml', 'yml', 'toml', 'rst', 'tex', 'log'],
          },
          { name: 'Word 文档', extensions: ['docx'] },
          { name: '文本文件', extensions: ['txt', 'md', 'markdown'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });

      if (!selected) {
        setImporting(false);
        return;
      }

      const filePath = typeof selected === 'string' ? selected : (selected as any)?.path ?? String(selected);
      const content = await invoke<string>('import_file', { path: filePath });

      if (content) {
        runAction((v) => {
          const { from } = v.state.selection.main;
          v.dispatch({
            changes: { from, to: from, insert: content },
            selection: { anchor: from + content.length },
          });
          v.focus();
        });
      }
    } catch (error) {
      console.error('[ImportButton] 导入失败:', error);
      // 在编辑器中插入错误提示
      const errMsg = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error));
      runAction((v) => {
        cmInsert(v, `\n> ⚠️ 导入失败：${errMsg}\n`);
      });
    } finally {
      setImporting(false);
    }
  }, [importing, runAction]);

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('h-7 w-7 p-0', importing && 'opacity-50')}
      title="导入文件 (txt, md, docx, csv, html, json...)"
      onClick={handleImport}
      disabled={importing}
    >
      <FileUp className="h-4 w-4" />
    </Button>
  );
}

// ── 表格网格选择器 ──
function TableGridPicker({ doInsert }: { doInsert: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);
  const maxRows = 8;
  const maxCols = 8;

  const handleSelect = useCallback((rows: number, cols: number) => {
    const header = '| ' + Array.from({ length: cols }, (_, i) => `标题${i + 1}`).join(' | ') + ' |';
    const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
    const bodyRows = Array.from({ length: rows }, () =>
      '| ' + Array.from({ length: cols }, () => '内容').join(' | ') + ' |'
    ).join('\n');
    doInsert(`\n${header}\n${separator}\n${bodyRows}\n`);
    setOpen(false);
    setHoverRows(0);
    setHoverCols(0);
  }, [doInsert]);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setHoverRows(0); setHoverCols(0); } }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="插入表格">
          <Table className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            插入表格 {hoverRows > 0 && hoverCols > 0 ? `${hoverRows}×${hoverCols}` : ''}
          </h4>
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${maxCols}, 1fr)` }}
            onMouseLeave={() => { setHoverRows(0); setHoverCols(0); }}
          >
            {Array.from({ length: maxRows * maxCols }, (_, idx) => {
              const r = Math.floor(idx / maxCols) + 1;
              const c = (idx % maxCols) + 1;
              const active = r <= hoverRows && c <= hoverCols;
              return (
                <div
                  key={idx}
                  className={cn(
                    'w-5 h-5 border rounded-sm cursor-pointer transition-colors',
                    active ? 'bg-primary/60 border-primary' : 'bg-muted/40 border-border hover:bg-muted'
                  )}
                  onMouseEnter={() => { setHoverRows(r); setHoverCols(c); }}
                  onClick={() => handleSelect(r, c)}
                />
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
