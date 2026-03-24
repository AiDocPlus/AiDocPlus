/**
 * EssayToolbar.tsx — 散文专用工具栏
 *
 * Phase 1: 从 EssayDocWorkspace 抽取并增强
 * - 左/右栏开关
 * - 散文子类型快速切换
 * - 文档操作（新建/关闭/全关/保存/全保存）
 * - 版本历史 / 分析 / 导出 / 设置 快速跳转
 * - 格式化按钮（加粗/斜体/引用/分隔线）
 * - 视图模式切换（编辑 / 预览 / 分屏 / 大纲）
 * - 打字机滚动开关
 * - 修辞高亮 / 意象标注开关
 * - 专注模式
 * - AI 侧栏开关
 */

import {
  Save, SaveAll, FilePlus,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Maximize2, BarChart3, Settings, FileDown, History,
  Feather, ChevronDown, X, XCircle, Palette, Sparkles,
  Bold, Italic, Quote, Minus, List,
  Eye, Columns2, SplitSquareHorizontal,
  AlignJustify, Type, LayoutTemplate,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { EssaySubtype } from './types';
import { ESSAY_SUBTYPE_OPTIONS, ESSAY_SUBTYPE_LABEL } from './constants';

export type ViewMode = 'edit' | 'preview' | 'split' | 'outline';
export type LeftTab = 'nav' | 'materials' | 'analysis' | 'export' | 'settings' | 'prompt';

interface EssayToolbarProps {
  // 布局状态
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  focusMode: boolean;
  viewMode: ViewMode;
  typewriterMode: boolean;
  rhetoricHighlight: boolean;
  imageryHighlight: boolean;
  // 文档状态
  subtype: EssaySubtype;
  isSaving: boolean;
  // 回调
  onToggleLeft: () => void;
  onToggleRight: () => void;
  onToggleFocus: () => void;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleTypewriter: () => void;
  onToggleRhetoricHighlight: () => void;
  onToggleImageryHighlight: () => void;
  onSubtypeChange: (subtype: EssaySubtype) => void;
  onNew: () => void;
  onClose: () => void;
  onCloseAll: () => void;
  onSave: () => void;
  onSaveAll: () => void;
  onSnapshot: () => void;
  onLeftTabChange: (tab: LeftTab) => void;
  onFormatInsert: (syntax: string) => void;
  onOpenTemplate: () => void;
}

const VIEW_MODE_OPTIONS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  { value: 'edit', label: '编辑模式', icon: <Type className="h-3.5 w-3.5" /> },
  { value: 'preview', label: '预览模式', icon: <Eye className="h-3.5 w-3.5" /> },
  { value: 'split', label: '分屏模式', icon: <Columns2 className="h-3.5 w-3.5" /> },
  { value: 'outline', label: '大纲模式', icon: <List className="h-3.5 w-3.5" /> },
];

export default function EssayToolbar({
  leftCollapsed, rightCollapsed, focusMode,
  viewMode, typewriterMode, rhetoricHighlight, imageryHighlight,
  subtype, isSaving,
  onToggleLeft, onToggleRight, onToggleFocus,
  onViewModeChange, onToggleTypewriter,
  onToggleRhetoricHighlight, onToggleImageryHighlight,
  onSubtypeChange, onNew, onClose, onCloseAll,
  onSave, onSaveAll, onSnapshot, onLeftTabChange,
  onFormatInsert, onOpenTemplate,
}: EssayToolbarProps) {
  const currentViewIcon = VIEW_MODE_OPTIONS.find(v => v.value === viewMode)?.icon ?? <Type className="h-3.5 w-3.5" />;

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b flex-shrink-0 bg-card text-xs select-none">

      {/* ── 左栏开关 ── */}
      <Button variant="ghost" size="icon" className="h-6 w-6"
        onClick={onToggleLeft}
        title={leftCollapsed ? '显示左栏' : '隐藏左栏'}>
        {leftCollapsed
          ? <PanelLeftOpen className="h-3.5 w-3.5" />
          : <PanelLeftClose className="h-3.5 w-3.5" />}
      </Button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* ── 散文子类型 ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-0.5 text-xs font-medium hover:text-primary transition-colors px-1 py-0.5 rounded hover:bg-muted">
            <Feather className="h-3.5 w-3.5" />
            <span className="truncate max-w-[72px]">{ESSAY_SUBTYPE_LABEL[subtype] || '散文'}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-card">
          {ESSAY_SUBTYPE_OPTIONS.map(opt => (
            <DropdownMenuItem key={opt.value} className="text-xs" onClick={() => onSubtypeChange(opt.value)}>
              {opt.label}
              {subtype === opt.value && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* ── 文档操作 ── */}
      <Button variant="ghost" size="icon" className="h-6 w-6" title="新建散文 (⌘N)" onClick={onNew}>
        <FilePlus className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose} title="关闭标签页">
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCloseAll} title="关闭所有标签">
        <XCircle className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* ── 保存 ── */}
      <Button variant={isSaving ? 'secondary' : 'ghost'} size="icon" className="h-6 w-6"
        disabled={isSaving} onClick={onSave} title="保存 (⌘S)">
        <Save className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6"
        disabled={isSaving} onClick={onSaveAll} title="全部保存 (⌘⇧S)">
        <SaveAll className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* ── 格式化 ── */}
      <Button variant="ghost" size="icon" className="h-6 w-6" title="加粗 (⌘B)"
        onClick={() => onFormatInsert('**')}>
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="斜体 (⌘I)"
        onClick={() => onFormatInsert('*')}>
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="引用块"
        onClick={() => onFormatInsert('>')}>
        <Quote className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="分隔线"
        onClick={() => onFormatInsert('---')}>
        <Minus className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* ── 视图模式 ── */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-0.5 text-xs hover:text-primary transition-colors px-1 py-0.5 rounded hover:bg-muted"
            title={`当前: ${VIEW_MODE_OPTIONS.find(v => v.value === viewMode)?.label}`}>
            {currentViewIcon}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-card">
          {VIEW_MODE_OPTIONS.map(opt => (
            <DropdownMenuItem key={opt.value} className="text-xs gap-2" onClick={() => onViewModeChange(opt.value)}>
              {opt.icon}
              {opt.label}
              {viewMode === opt.value && <span className="ml-auto text-primary">✓</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs gap-2" onClick={onToggleTypewriter}>
            <AlignJustify className="h-3.5 w-3.5" />
            打字机滚动
            {typewriterMode && <span className="ml-auto text-primary">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* ── 快速跳转 ── */}
      <Button variant="ghost" size="icon" className="h-6 w-6" title="版本历史"
        onClick={() => { onSnapshot(); onLeftTabChange('export'); }}>
        <History className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="写作分析"
        onClick={() => onLeftTabChange('analysis')}>
        <BarChart3 className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="写作模板"
        onClick={onOpenTemplate}>
        <LayoutTemplate className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="导出文档"
        onClick={() => onLeftTabChange('export')}>
        <FileDown className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" title="写作设置"
        onClick={() => onLeftTabChange('settings')}>
        <Settings className="h-3.5 w-3.5" />
      </Button>

      <div className="w-px h-4 bg-border mx-0.5" />

      {/* ── 高亮开关 ── */}
      <Button
        variant={rhetoricHighlight ? 'default' : 'ghost'}
        size="icon" className="h-6 w-6"
        onClick={onToggleRhetoricHighlight}
        title={rhetoricHighlight ? '关闭修辞高亮' : '开启修辞高亮'}>
        <Sparkles className={cn('h-3.5 w-3.5', rhetoricHighlight && 'text-yellow-400')} />
      </Button>
      <Button
        variant={imageryHighlight ? 'default' : 'ghost'}
        size="icon" className="h-6 w-6"
        onClick={onToggleImageryHighlight}
        title={imageryHighlight ? '关闭意象标注' : '开启意象标注'}>
        <Palette className={cn('h-3.5 w-3.5', imageryHighlight && 'text-purple-400')} />
      </Button>

      {/* ── 分隔线到右侧 ── */}
      <div className="flex-1" />

      {/* ── 大纲预览 ── */}
      <Button
        variant={viewMode === 'split' ? 'default' : 'ghost'}
        size="icon" className="h-6 w-6"
        title="分屏（编辑+预览）"
        onClick={() => onViewModeChange(viewMode === 'split' ? 'edit' : 'split')}>
        <SplitSquareHorizontal className="h-3.5 w-3.5" />
      </Button>

      {/* ── 专注模式 ── */}
      <Button
        variant={focusMode ? 'default' : 'ghost'}
        size="icon" className="h-6 w-6"
        onClick={onToggleFocus}
        title="专注模式 (⌘E)">
        <Maximize2 className={cn('h-3.5 w-3.5', focusMode && 'text-primary')} />
      </Button>

      {/* ── AI 开关 ── */}
      <Button
        variant={rightCollapsed ? 'ghost' : 'default'}
        size="icon" className="h-6 w-6"
        onClick={onToggleRight}
        title={rightCollapsed ? '打开 AI 助手' : '关闭 AI 助手'}>
        {rightCollapsed
          ? <PanelRightOpen className="h-3.5 w-3.5" />
          : <PanelRightClose className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
