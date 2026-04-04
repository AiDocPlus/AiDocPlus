/**
 * 文档类型系统 — Design Tokens 统一样式常量
 *
 * 所有文档类型的编辑器和 AI 侧栏必须使用这些常量，确保视觉一致性。
 */

// ═══ 消息气泡 ═══
export const MSG_USER_CLASS = 'bg-primary/10 ml-8 rounded-lg p-3 text-sm';
export const MSG_AI_CLASS = 'bg-muted mr-2 rounded-lg p-3 text-sm';
export const MSG_LIST_CLASS = 'space-y-3';
export const MSG_STREAMING_CURSOR = 'inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5';

// ═══ 快捷操作按钮 ═══
export const QUICK_ACTION_BTN = 'h-7 text-xs px-2 gap-1';
export const QUICK_ACTION_ICON = 'h-3.5 w-3.5';
/** DocTypeAIChatBase headerSlot：单层底边，与侧栏顶栏统一 */
export const QUICK_ACTION_BAR = 'flex flex-wrap gap-1 px-2 py-1.5 border-b flex-shrink-0 bg-card';

// ═══ AI 侧栏顶部（会话 + 快捷）合并为一块，减少多条 border-b ═══
export const SIDEBAR_AI_HEADER_PANEL = 'flex-shrink-0 border-b bg-card';
export const SIDEBAR_AI_HEADER_ROW = 'flex items-center gap-1 px-2 py-1 min-h-0';
export const SIDEBAR_AI_HEADER_SUBROW = 'flex items-center gap-1 px-2 py-1 border-t border-border/40 flex-wrap overflow-x-auto min-h-0';
/** 顶栏第三行：纵向堆叠（如建议芯片 + 工具条） */
export const SIDEBAR_AI_HEADER_SUBROW_STACK = 'flex flex-col gap-1 px-2 py-1.5 border-t border-border/40 shrink-0 min-w-0';

// ═══ 工具栏 ═══
export const TOOLBAR_CLASS = 'flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 bg-card';
export const TOOLBAR_ICON = 'h-4 w-4';

// ═══ 状态栏 ═══
export const STATUS_BAR_CLASS = 'flex items-center gap-3 px-3 py-1 border-t text-xs text-muted-foreground flex-shrink-0 bg-card';

// ═══ 输入区 ═══
export const INPUT_AREA_CLASS = 'flex-shrink-0 border-t p-2 space-y-1.5';
export const TEXTAREA_CLASS = 'flex-1 text-sm px-3 py-2 border rounded-md bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring';

// ═══ 空状态 ═══
export const EMPTY_STATE_CLASS = 'text-center text-xs text-muted-foreground py-8 space-y-2';
export const EMPTY_STATE_ICON = 'h-8 w-8 mx-auto opacity-20';

// ═══ AI 选项开关 ═══
export const AI_OPTION_BTN_BASE = 'h-6 px-1.5 text-[11px] gap-0.5';
export const AI_OPTION_ACTIVE = 'text-green-600 dark:text-green-400';
export const AI_OPTION_THINKING_ACTIVE = 'text-purple-600 dark:text-purple-400';
export const AI_OPTION_INACTIVE = 'text-muted-foreground';

// ═══ 消息操作 ═══
export const MSG_ACTION_BTN = 'text-[11px] text-primary hover:underline flex items-center gap-0.5';
export const MSG_ACTION_AREA = 'flex gap-2 mt-2 pt-1.5 border-t border-border/50';

// ═══ 弹窗字体 ═══
/** 所有文档类型弹窗统一字体（宋体 16px） */
export const DIALOG_STYLE = { fontFamily: "'宋体', 'SimSun', serif", fontSize: '16px' };
