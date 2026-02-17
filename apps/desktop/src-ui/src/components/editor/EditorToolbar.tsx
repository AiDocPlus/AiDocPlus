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
  FileText,
  ChevronDown,
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
  AArrowDown,
  AArrowUp,
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '../ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useTranslation } from '@/i18n';
import { getFragmentsGroupedByPlugin } from '@/plugins/fragments';
import type { ImportSources } from './MarkdownEditor';

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
  importSources?: ImportSources;
  fontSize?: number;
  onFontSizeChange?: (size: number) => void;
}

export function EditorToolbar({ cmViewRef, outlineOpen, onToggleOutline, viewMode, onViewModeChange, showViewModeSwitch, importSources, fontSize, onFontSizeChange }: EditorToolbarProps) {
  const { t } = useTranslation();
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

      {/* ── 1. 导入（最左端） ── */}
      {s('importFile') && <ImportButton runAction={runAction} importSources={importSources} />}

      <Sep left={[s('importFile')]} right={[s('undo'), s('redo'), s('copy'), s('cut'), s('paste'), s('clearAll')]} />

      {/* ── 2. 编辑操作（撤销/重做/剪贴板/清空） ── */}
      {s('undo') && <FeedbackButton
        onClick={() => runAction((v) => undo(v))}
        icon={<Undo2 className="h-4 w-4" />}
        tooltip={t('editor.toolbar.undo', { defaultValue: '撤销 (Cmd+Z)' })}
        doneTooltip={t('editor.toolbar.undoDone', { defaultValue: '已撤销' })}
      />}
      {s('redo') && <FeedbackButton
        onClick={() => runAction((v) => redo(v))}
        icon={<Redo2 className="h-4 w-4" />}
        tooltip={t('editor.toolbar.redo', { defaultValue: '重做 (Cmd+Shift+Z)' })}
        doneTooltip={t('editor.toolbar.redoDone', { defaultValue: '已重做' })}
      />}
      {s('copy') && <FeedbackButton
        onClick={() => runAction((v) => { const sel = cmGetSelection(v); if (sel) navigator.clipboard.writeText(sel); })}
        icon={<Copy className="h-4 w-4" />}
        tooltip={t('editor.toolbar.copy', { defaultValue: '复制 (Cmd+C)' })}
        doneTooltip={t('editor.toolbar.copyDone', { defaultValue: '已复制' })}
      />}
      {s('cut') && <FeedbackButton
        onClick={() => runAction((v) => { const sel = cmGetSelection(v); if (sel) { navigator.clipboard.writeText(sel); const { from, to } = v.state.selection.main; v.dispatch({ changes: { from, to, insert: '' } }); } })}
        icon={<Scissors className="h-4 w-4" />}
        tooltip={t('editor.toolbar.cut', { defaultValue: '剪切 (Cmd+X)' })}
        doneTooltip={t('editor.toolbar.cutDone', { defaultValue: '已剪切' })}
      />}
      {s('paste') && <FeedbackButton
        onClick={() => runAction(async (v) => { try { const text = await navigator.clipboard.readText(); if (text) cmInsert(v, text); } catch { /* clipboard access denied */ } })}
        icon={<ClipboardPaste className="h-4 w-4" />}
        tooltip={t('editor.toolbar.paste', { defaultValue: '粘贴 (Cmd+V)' })}
        doneTooltip={t('editor.toolbar.pasteDone', { defaultValue: '已粘贴' })}
      />}
      {s('clearAll') && <FeedbackButton
        onClick={() => runAction((v) => {
          const len = v.state.doc.length;
          if (len > 0) v.dispatch({ changes: { from: 0, to: len, insert: '' } });
        })}
        icon={<Trash2 className="h-4 w-4" />}
        tooltip={t('editor.toolbar.clearAll', { defaultValue: '清空全部内容' })}
        doneTooltip={t('editor.toolbar.clearAllDone', { defaultValue: '已清空' })}
      />}

      <Sep left={[s('undo'), s('redo'), s('copy'), s('cut'), s('paste'), s('clearAll')]} right={[s('headings')]} />

      {/* ── 3. 标题 ── */}
      {s('headings') && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editor.toolbar.heading', { defaultValue: '标题' })}>
            <Heading1 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => doPrefix('# ')}><Heading1 className="h-4 w-4 mr-2" />{t('editor.toolbar.heading1', { defaultValue: '一级标题' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('## ')}><Heading2 className="h-4 w-4 mr-2" />{t('editor.toolbar.heading2', { defaultValue: '二级标题' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('### ')}><Heading3 className="h-4 w-4 mr-2" />{t('editor.toolbar.heading3', { defaultValue: '三级标题' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('#### ')}><Heading4 className="h-4 w-4 mr-2" />{t('editor.toolbar.heading4', { defaultValue: '四级标题' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('##### ')}><Heading5 className="h-4 w-4 mr-2" />{t('editor.toolbar.heading5', { defaultValue: '五级标题' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doPrefix('###### ')}><Heading6 className="h-4 w-4 mr-2" />{t('editor.toolbar.heading6', { defaultValue: '六级标题' })}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}

      <Sep left={[s('headings')]} right={[s('bold'), s('italic'), s('strikethrough'), s('clearFormat')]} />

      {/* ── 4. 文本格式 ── */}
      {s('bold') && <FeedbackButton onClick={() => doWrap('**', '**', t('editor.toolbar.boldPlaceholder', { defaultValue: '粗体文本' }))} icon={<Bold className="h-4 w-4" />} tooltip={t('editor.toolbar.boldCmd', { defaultValue: '粗体 (Cmd+B)' })} doneTooltip={t('editor.toolbar.boldDone', { defaultValue: '已加粗' })} />}
      {s('italic') && <FeedbackButton onClick={() => doWrap('*', '*', t('editor.toolbar.italicPlaceholder', { defaultValue: '斜体文本' }))} icon={<Italic className="h-4 w-4" />} tooltip={t('editor.toolbar.italicCmd', { defaultValue: '斜体 (Cmd+I)' })} doneTooltip={t('editor.toolbar.italicDone', { defaultValue: '已斜体' })} />}
      {s('strikethrough') && <FeedbackButton onClick={() => doWrap('~~', '~~', t('editor.toolbar.strikethroughPlaceholder', { defaultValue: '删除线文本' }))} icon={<Strikethrough className="h-4 w-4" />} tooltip={t('editor.toolbar.strikethroughCmd', { defaultValue: '删除线 (Cmd+Shift+X)' })} doneTooltip={t('editor.toolbar.strikethroughDone', { defaultValue: '已添加删除线' })} />}
      {s('clearFormat') && <FeedbackButton onClick={() => runAction((v) => cmClearFormat(v))} icon={<RemoveFormatting className="h-4 w-4" />} tooltip={t('editor.toolbar.clearFormat', { defaultValue: '清除格式' })} doneTooltip={t('editor.toolbar.clearFormatDone', { defaultValue: '已清除' })} />}

      <Sep left={[s('bold'), s('italic'), s('strikethrough'), s('clearFormat')]} right={[s('unorderedList'), s('orderedList'), s('taskList'), s('quote'), s('horizontalRule')]} />

      {/* ── 5. 段落结构 ── */}
      {s('unorderedList') && <FeedbackButton onClick={() => doPrefix('- ')} icon={<List className="h-4 w-4" />} tooltip={t('editor.toolbar.unorderedList', { defaultValue: '无序列表' })} doneTooltip={t('editor.toolbar.inserted', { defaultValue: '已插入' })} />}
      {s('orderedList') && <FeedbackButton onClick={() => doPrefix('1. ')} icon={<ListOrdered className="h-4 w-4" />} tooltip={t('editor.toolbar.orderedList', { defaultValue: '有序列表' })} doneTooltip={t('editor.toolbar.inserted', { defaultValue: '已插入' })} />}
      {s('taskList') && <FeedbackButton onClick={() => doPrefix('- [ ] ')} icon={<CheckSquare className="h-4 w-4" />} tooltip={t('editor.toolbar.taskList', { defaultValue: '任务列表' })} doneTooltip={t('editor.toolbar.inserted', { defaultValue: '已插入' })} />}
      {s('quote') && <FeedbackButton onClick={() => doPrefix('> ')} icon={<Quote className="h-4 w-4" />} tooltip={t('editor.toolbar.quote', { defaultValue: '引用' })} doneTooltip={t('editor.toolbar.inserted', { defaultValue: '已插入' })} />}
      {s('horizontalRule') && <FeedbackButton onClick={() => doInsert('\n---\n')} icon={<Minus className="h-4 w-4" />} tooltip={t('editor.toolbar.horizontalRule', { defaultValue: '分隔线' })} doneTooltip={t('editor.toolbar.inserted', { defaultValue: '已插入' })} />}

      <Sep left={[s('unorderedList'), s('orderedList'), s('taskList'), s('quote'), s('horizontalRule')]} right={[s('link'), s('image'), s('table'), s('footnote'), s('inlineCode'), s('codeBlock'), s('mermaid'), s('math')]} />

      {/* ── 6. 插入对象（链接、图片、表格、脚注、行内代码、代码块、图表、公式） ── */}
      {s('link') && <LinkPopover runAction={runAction} />}
      {s('image') && <ImagePopover runAction={runAction} />}
      {s('table') && <TableGridPicker doInsert={doInsert} />}
      {s('footnote') && <FeedbackButton
        onClick={() => {
          runAction((v) => {
            const { from } = v.state.selection.main;
            const sel = cmGetSelection(v);
            const noteText = sel || t('editor.toolbar.footnotePlaceholder', { defaultValue: '脚注内容' });
            const insert = `[^1]\n\n[^1]: ${noteText}`;
            v.dispatch({
              changes: { from, to: from + sel.length, insert },
              selection: { anchor: from + insert.length - noteText.length, head: from + insert.length },
            });
            v.focus();
          });
        }}
        icon={<Asterisk className="h-4 w-4" />}
        tooltip={t('editor.toolbar.footnote', { defaultValue: '插入脚注' })}
        doneTooltip={t('editor.toolbar.footnoteDone', { defaultValue: '已插入脚注' })}
      />}
      {s('inlineCode') && <FeedbackButton onClick={() => doWrap('`', '`', t('editor.toolbar.inlineCodePlaceholder', { defaultValue: '代码' }))} icon={<Code className="h-4 w-4" />} tooltip={t('editor.toolbar.inlineCodeCmd', { defaultValue: '行内代码 (Cmd+E)' })} doneTooltip={t('editor.toolbar.inlineCodeDone', { defaultValue: '已添加代码' })} />}
      {s('codeBlock') && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editor.toolbar.codeBlock', { defaultValue: '代码块' })}>
            <CodeXml className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => doInsert('\n```\n\n```\n')}>{t('editor.toolbar.plainCodeBlock', { defaultValue: '普通代码块' })}</DropdownMenuItem>
          {['javascript', 'typescript', 'python', 'rust', 'html', 'css', 'json', 'sql', 'bash'].map(lang => (
            <DropdownMenuItem key={lang} onClick={() => doInsert(`\n\`\`\`${lang}\n\n\`\`\`\n`)}>{lang}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>}
      {s('mermaid') && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editor.toolbar.mermaidChart', { defaultValue: 'Mermaid 图表' })}>
            <Workflow className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="max-h-80 overflow-y-auto">
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\ngraph TD\n    A[开始] --> B{判断}\n    B -->|是| C[结果1]\n    B -->|否| D[结果2]\n```\n')}>{t('editor.toolbar.mermaidFlowchart', { defaultValue: '流程图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nsequenceDiagram\n    participant A as 客户端\n    participant B as 服务器\n    A->>B: 请求\n    B-->>A: 响应\n```\n')}>{t('editor.toolbar.mermaidSequence', { defaultValue: '时序图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nclassDiagram\n    class Animal {\n        +String name\n        +int age\n        +makeSound()\n    }\n    class Dog {\n        +fetch()\n    }\n    Animal <|-- Dog\n```\n')}>{t('editor.toolbar.mermaidClass', { defaultValue: '类图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nstateDiagram-v2\n    [*] --> 待处理\n    待处理 --> 进行中: 开始\n    进行中 --> 已完成: 完成\n    进行中 --> 待处理: 退回\n    已完成 --> [*]\n```\n')}>{t('editor.toolbar.mermaidState', { defaultValue: '状态图' })}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nerDiagram\n    CUSTOMER ||--o{ ORDER : places\n    ORDER ||--|{ LINE-ITEM : contains\n    CUSTOMER {\n        string name\n        string email\n    }\n    ORDER {\n        int orderNumber\n        date created\n    }\n```\n')}>{t('editor.toolbar.mermaidER', { defaultValue: 'ER 图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\npie title 项目占比\n    "分类A" : 40\n    "分类B" : 30\n    "分类C" : 20\n    "分类D" : 10\n```\n')}>{t('editor.toolbar.mermaidPie', { defaultValue: '饼图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\ngantt\n    title 项目计划\n    dateFormat YYYY-MM-DD\n    section 阶段一\n        任务1 :a1, 2024-01-01, 30d\n        任务2 :after a1, 20d\n    section 阶段二\n        任务3 :2024-02-20, 25d\n        任务4 :after a1, 15d\n```\n')}>{t('editor.toolbar.mermaidGantt', { defaultValue: '甘特图' })}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nmindmap\n  root((中心主题))\n    分支A\n      子项1\n      子项2\n    分支B\n      子项3\n      子项4\n    分支C\n```\n')}>{t('editor.toolbar.mermaidMindmap', { defaultValue: '思维导图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\ntimeline\n    title 项目里程碑\n    2024-Q1 : 需求分析\n            : 技术选型\n    2024-Q2 : 开发阶段\n            : 单元测试\n    2024-Q3 : 集成测试\n            : 上线部署\n```\n')}>{t('editor.toolbar.mermaidTimeline', { defaultValue: '时间线' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\ngitGraph\n    commit\n    commit\n    branch develop\n    checkout develop\n    commit\n    commit\n    checkout main\n    merge develop\n    commit\n```\n')}>{t('editor.toolbar.mermaidGit', { defaultValue: 'Git 图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\njourney\n    title 用户购物旅程\n    section 浏览\n      打开首页: 5: 用户\n      搜索商品: 4: 用户\n    section 购买\n      加入购物车: 3: 用户\n      结算支付: 2: 用户\n    section 售后\n      确认收货: 5: 用户\n```\n')}>{t('editor.toolbar.mermaidJourney', { defaultValue: '用户旅程' })}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nquadrantChart\n    title 优先级矩阵\n    x-axis 低紧急 --> 高紧急\n    y-axis 低重要 --> 高重要\n    quadrant-1 立即执行\n    quadrant-2 计划执行\n    quadrant-3 委托他人\n    quadrant-4 暂时搁置\n    任务A: [0.8, 0.9]\n    任务B: [0.3, 0.7]\n    任务C: [0.7, 0.3]\n    任务D: [0.2, 0.2]\n```\n')}>{t('editor.toolbar.mermaidQuadrant', { defaultValue: '象限图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nxychart-beta\n    title "月度销售额"\n    x-axis [1月, 2月, 3月, 4月, 5月, 6月]\n    y-axis "销售额（万元）" 0 --> 100\n    bar [30, 45, 60, 55, 70, 85]\n    line [30, 45, 60, 55, 70, 85]\n```\n')}>{t('editor.toolbar.mermaidXY', { defaultValue: 'XY 图表' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nsankey-beta\n\n来源A,目标X,30\n来源A,目标Y,20\n来源B,目标X,15\n来源B,目标Z,25\n来源C,目标Y,10\n来源C,目标Z,20\n```\n')}>{t('editor.toolbar.mermaidSankey', { defaultValue: '桑基图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\nblock-beta\n    columns 3\n    前端 中间件 后端\n    space:3\n    数据库\n```\n')}>{t('editor.toolbar.mermaidBlock', { defaultValue: '框图' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n```mermaid\narchitecture-beta\n    group api(cloud)[API]\n\n    service db(database)[数据库] in api\n    service disk1(disk)[存储] in api\n    service disk2(disk)[备份] in api\n    service server(server)[服务器] in api\n\n    db:L -- R:server\n    disk1:T -- B:server\n    disk2:T -- B:db\n```\n')}>{t('editor.toolbar.mermaidArchitecture', { defaultValue: '架构图' })}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}
      {s('math') && <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editor.toolbar.mathFormula', { defaultValue: '数学公式' })}>
            <Sigma className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => doWrap('$', '$', 'E=mc^2')}>{t('editor.toolbar.inlineFormula', { defaultValue: '行内公式 $...$' })}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => doInsert('\n$$\n\\sum_{i=1}^{n} x_i\n$$\n')}>{t('editor.toolbar.blockFormula', { defaultValue: '块级公式 $$...$$' })}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>}

      <Sep left={[s('link'), s('image'), s('table'), s('footnote'), s('inlineCode'), s('codeBlock'), s('mermaid'), s('math')]} right={[true]} />

      {/* ── 7. 字体大小 ── */}
      {fontSize !== undefined && onFontSizeChange && <FontSizeButtons fontSize={fontSize} onFontSizeChange={onFontSizeChange} />}

      <Sep left={[true]} right={[s('goToTop'), s('goToBottom')]} />

      {/* ── 8. 导航/大纲 ── */}
      {s('goToTop') && <ToolbarButton
        onClick={() => runAction((v) => {
          v.dispatch({
            effects: EditorView.scrollIntoView(0, { y: 'start' })
          });
        })}
        icon={<ArrowUpToLine className="h-4 w-4" />}
        tooltip={t('editor.toolbar.scrollToTop', { defaultValue: '滚动到顶部' })}
      />}
      {s('goToBottom') && <ToolbarButton
        onClick={() => runAction((v) => {
          const docEnd = v.state.doc.length;
          v.dispatch({
            effects: EditorView.scrollIntoView(docEnd, { y: 'end' })
          });
        })}
        icon={<ArrowDownToLine className="h-4 w-4" />}
        tooltip={t('editor.toolbar.scrollToBottom', { defaultValue: '滚动到底部' })}
      />}
      {onToggleOutline && (
        <ToolbarButton
          active={outlineOpen}
          onClick={onToggleOutline}
          icon={<ListTree className="h-4 w-4" />}
          tooltip={outlineOpen ? t('editor.toolbar.closeOutline', { defaultValue: '关闭大纲' }) : t('editor.toolbar.openOutline', { defaultValue: '打开大纲' })}
        />
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
            title={t('editor.toolbar.editMode', { defaultValue: '编辑模式' })}
          >
            <Code2 className="h-3.5 w-3.5" />
            {t('editor.toolbar.edit', { defaultValue: '编辑' })}
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('preview')}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
              viewMode === 'preview' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : 'text-muted-foreground hover:text-foreground'
            )}
            title={t('editor.toolbar.previewMode', { defaultValue: '预览模式' })}
          >
            <Eye className="h-3.5 w-3.5" />
            {t('editor.toolbar.preview', { defaultValue: '预览' })}
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('split')}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
              viewMode === 'split' ? 'bg-pink-500/20 text-pink-600 dark:text-pink-400' : 'text-muted-foreground hover:text-foreground'
            )}
            title={t('editor.toolbar.splitMode', { defaultValue: '分屏模式' })}
          >
            <Columns className="h-3.5 w-3.5" />
            {t('editor.toolbar.split', { defaultValue: '分屏' })}
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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const handleInsert = useCallback(() => {
    const text = linkText || t('editor.toolbar.linkTextDefault', { defaultValue: '链接文本' });
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
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editor.toolbar.insertLinkCmd', { defaultValue: '插入链接 (Cmd+K)' })}>
          <LinkIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{t('editor.toolbar.insertLink', { defaultValue: '插入链接' })}</h4>
          <div className="space-y-2">
            <Label className="text-xs">{t('editor.toolbar.linkText', { defaultValue: '链接文本' })}</Label>
            <Input
              placeholder={t('editor.toolbar.linkTextPlaceholder', { defaultValue: '链接文本（可选，使用选中文本）' })}
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t('editor.toolbar.urlAddress', { defaultValue: 'URL 地址' })}</Label>
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
              <Button variant="ghost" size="sm" className="h-7 text-xs">{t('editor.toolbar.cancel', { defaultValue: '取消' })}</Button>
            </PopoverClose>
            <Button size="sm" className="h-7 text-xs" onClick={handleInsert}>{t('editor.toolbar.insert', { defaultValue: '插入' })}</Button>
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
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [altText, setAltText] = useState('');
  const [imgUrl, setImgUrl] = useState('');

  const handleInsert = useCallback(() => {
    const alt = altText || t('editor.toolbar.imageDescDefault', { defaultValue: '图片' });
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
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editor.toolbar.insertImage', { defaultValue: '插入图片' })}>
          <ImageIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{t('editor.toolbar.insertImage', { defaultValue: '插入图片' })}</h4>
          <div className="space-y-2">
            <Label className="text-xs">{t('editor.toolbar.imageDescription', { defaultValue: '图片描述' })}</Label>
            <Input
              placeholder={t('editor.toolbar.imageDescPlaceholder', { defaultValue: '图片描述（alt 文本）' })}
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleInsert(); }}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">{t('editor.toolbar.imageUrl', { defaultValue: '图片 URL' })}</Label>
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
              <Button variant="ghost" size="sm" className="h-7 text-xs">{t('editor.toolbar.cancel', { defaultValue: '取消' })}</Button>
            </PopoverClose>
            <Button size="sm" className="h-7 text-xs" onClick={handleInsert}>{t('editor.toolbar.insert', { defaultValue: '插入' })}</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── 字体大小调整 ──
const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 28;
const FONT_SIZE_STEP = 1;

function FontSizeButtons({ fontSize, onFontSizeChange }: { fontSize: number; onFontSizeChange: (size: number) => void }) {
  const { t } = useTranslation();
  const decrease = useCallback(() => {
    const next = Math.max(FONT_SIZE_MIN, fontSize - FONT_SIZE_STEP);
    if (next !== fontSize) onFontSizeChange(next);
  }, [fontSize, onFontSizeChange]);

  const increase = useCallback(() => {
    const next = Math.min(FONT_SIZE_MAX, fontSize + FONT_SIZE_STEP);
    if (next !== fontSize) onFontSizeChange(next);
  }, [fontSize, onFontSizeChange]);

  return (
    <div className="flex items-center gap-0">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title={t('editor.toolbar.decreaseFont', { defaultValue: '减小字体 (当前 {{size}}px)', size: fontSize })}
        onClick={decrease}
        disabled={fontSize <= FONT_SIZE_MIN}
      >
        <AArrowDown className="h-4 w-4" />
      </Button>
      <span className="text-xs text-muted-foreground w-6 text-center select-none" title={t('editor.toolbar.currentFontSize', { defaultValue: '当前字体大小' })}>{fontSize}</span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        title={t('editor.toolbar.increaseFont', { defaultValue: '增大字体 (当前 {{size}}px)', size: fontSize })}
        onClick={increase}
        disabled={fontSize >= FONT_SIZE_MAX}
      >
        <AArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── 导入下拉菜单 ──
function ImportButton({
  runAction,
  importSources,
}: {
  runAction: (fn: (v: EditorView) => void) => void;
  importSources?: ImportSources;
}) {
  const { t } = useTranslation();
  const [importing, setImporting] = useState(false);

  // 在光标位置插入文本
  const insertText = useCallback((text: string) => {
    runAction((v) => {
      const { from } = v.state.selection.main;
      v.dispatch({
        changes: { from, to: from, insert: text },
        selection: { anchor: from + text.length },
      });
      v.focus();
    });
  }, [runAction]);

  // 从文件导入
  const handleImportFromFile = useCallback(async () => {
    if (importing) return;
    setImporting(true);
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: t('editor.toolbar.documentFiles', { defaultValue: '文档文件' }),
            extensions: ['txt', 'md', 'markdown', 'docx', 'csv', 'html', 'htm', 'json', 'xml', 'yaml', 'yml', 'toml', 'rst', 'tex', 'log'],
          },
          { name: t('editor.toolbar.wordFiles', { defaultValue: 'Word 文档' }), extensions: ['docx'] },
          { name: t('editor.toolbar.textFiles', { defaultValue: '文本文件' }), extensions: ['txt', 'md', 'markdown'] },
          { name: t('editor.toolbar.allFiles', { defaultValue: '所有文件' }), extensions: ['*'] },
        ],
      });

      if (!selected) {
        setImporting(false);
        return;
      }

      const filePath = typeof selected === 'string' ? selected : (selected as any)?.path ?? String(selected);
      const content = await invoke<string>('import_file', { path: filePath });

      if (content) {
        insertText(content);
      }
    } catch (error) {
      console.error('[ImportButton] 导入失败:', error);
      const errMsg = typeof error === 'string' ? error : (error instanceof Error ? error.message : String(error));
      runAction((v) => {
        cmInsert(v, `\n> ⚠️ ${t('editor.toolbar.importFailed', { defaultValue: '导入失败：{{error}}', error: errMsg })}\n`);
      });
    } finally {
      setImporting(false);
    }
  }, [importing, runAction, insertText]);

  // 从正文导入
  const handleImportFromContent = useCallback(() => {
    const aiContent = importSources?.aiContent;
    if (aiContent?.trim()) {
      insertText(aiContent);
    }
  }, [importSources?.aiContent, insertText]);

  // 从插件片段导入
  const handleImportFragment = useCallback((markdown: string) => {
    insertText(markdown);
  }, [insertText]);

  // 获取插件片段分组
  const fragmentGroups = importSources?.document
    ? getFragmentsGroupedByPlugin(importSources.document)
    : new Map();
  const hasFragments = fragmentGroups.size > 0;
  const hasAiContent = !!importSources?.aiContent?.trim();

  // 始终显示下拉菜单
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('h-7 px-1.5 gap-0.5', importing && 'opacity-50')}
          title={t('editor.toolbar.import', { defaultValue: '导入' })}
          disabled={importing}
        >
          <FileText className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={handleImportFromFile}>
          <FileText className="h-4 w-4 mr-2" />
          {t('editor.toolbar.importFromFile', { defaultValue: '从文件导入 (txt, md, docx, csv, html...)' })}
        </DropdownMenuItem>
        {hasAiContent && (
          <DropdownMenuItem onClick={handleImportFromContent}>
            <FileText className="h-4 w-4 mr-2" />
            {t('editor.toolbar.importFromContent', { defaultValue: '从正文导入' })}
          </DropdownMenuItem>
        )}
        {hasFragments && (
          <>
            <DropdownMenuSeparator />
            {Array.from(fragmentGroups.entries()).map(([pluginId, group]) => {
              const IconComp = group.pluginIcon;
              if (group.fragments.length === 1) {
                const f = group.fragments[0];
                return (
                  <DropdownMenuItem key={pluginId} onClick={() => handleImportFragment(f.markdown)}>
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
                    {group.fragments.map((f: { id: string; markdown: string; title: string }) => (
                      <DropdownMenuItem key={f.id} onClick={() => handleImportFragment(f.markdown)}>
                        <span className="truncate">{f.title}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => {
                      const allMd = group.fragments.map((f: { markdown: string }) => f.markdown).join('\n\n---\n\n');
                      handleImportFragment(allMd);
                    }}>
                      {t('editor.toolbar.insertAll', { defaultValue: '全部插入' })}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── 表格网格选择器 ──
function TableGridPicker({ doInsert }: { doInsert: (text: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hoverRows, setHoverRows] = useState(0);
  const [hoverCols, setHoverCols] = useState(0);
  const maxRows = 8;
  const maxCols = 8;

  const handleSelect = useCallback((rows: number, cols: number) => {
    const header = '| ' + Array.from({ length: cols }, (_, i) => `${t('editor.toolbar.tableHeader', { defaultValue: '标题' })}${i + 1}`).join(' | ') + ' |';
    const separator = '| ' + Array.from({ length: cols }, () => '---').join(' | ') + ' |';
    const bodyRows = Array.from({ length: rows }, () =>
      '| ' + Array.from({ length: cols }, () => t('editor.toolbar.tableContent', { defaultValue: '内容' })).join(' | ') + ' |'
    ).join('\n');
    doInsert(`\n${header}\n${separator}\n${bodyRows}\n`);
    setOpen(false);
    setHoverRows(0);
    setHoverCols(0);
  }, [doInsert]);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setHoverRows(0); setHoverCols(0); } }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('editor.toolbar.insertTable', { defaultValue: '插入表格' })}>
          <Table className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            {t('editor.toolbar.insertTable', { defaultValue: '插入表格' })} {hoverRows > 0 && hoverCols > 0 ? `${hoverRows}×${hoverCols}` : ''}
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
