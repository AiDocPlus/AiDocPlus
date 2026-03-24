/**
 * EssaySelectionToolbar.tsx — 散文选中文本浮动工具栏
 *
 * Phase 6: 选中文本浮动工具栏
 * - AI 分析选中文本
 * - 添加到素材库
 * - 修辞标注
 * - 段落角色标记
 * - 查找相似内容
 * - 复制/剪切/粘贴
 * - 格式化操作
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Brain, BookmarkPlus, Tag, Search, Copy, Scissors,
  Bold, Italic, Underline, Highlighter, AlignLeft,
  AlignCenter, AlignRight, Quote, ChevronDown,
  Sparkles, BookOpen, MessageSquare, Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { MaterialType, ParagraphRole } from './types';

interface EssaySelectionToolbarProps {
  selection: {
    text: string;
    range: { start: number; end: number };
    paragraphId?: string;
  };
  position: { x: number; y: number };
  onClose: () => void;
  onAnalyzeSelection: (text: string) => void;
  onAddMaterial: (text: string, type: MaterialType) => void;
  onAnnotateRhetoric: (range: { start: number; end: number }, type: string) => void;
  onMarkParagraphRole: (paragraphId: string, role: ParagraphRole) => void;
  onFormatText: (range: { start: number; end: number }, format: string) => void;
  onSearchSimilar: (text: string) => void;
}

export default function EssaySelectionToolbar({
  selection,
  position,
  onClose,
  onAnalyzeSelection,
  onAddMaterial,
  onAnnotateRhetoric,
  onMarkParagraphRole,
  onFormatText,
  onSearchSimilar,
}: EssaySelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [showRhetoricMenu, setShowRhetoricMenu] = useState(false);
  const [showMaterialMenu, setShowMaterialMenu] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // 确保工具栏不超出视窗
  const adjustedPosition = React.useMemo(() => {
    const toolbarWidth = 400; // 估计宽度
    const toolbarHeight = 40; // 估计高度
    const margin = 10;

    let x = position.x;
    let y = position.y;

    // 水平调整
    if (x + toolbarWidth > window.innerWidth - margin) {
      x = window.innerWidth - toolbarWidth - margin;
    }
    if (x < margin) {
      x = margin;
    }

    // 垂直调整
    if (y + toolbarHeight > window.innerHeight - margin) {
      y = position.y - toolbarHeight - margin;
    }
    if (y < margin) {
      y = margin;
    }

    return { x, y };
  }, [position]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const materialTypes: { type: MaterialType; label: string; icon: React.ReactNode }[] = [
    { type: 'inspiration', label: '灵感素材', icon: <Sparkles className="h-4 w-4" /> },
    { type: 'quote', label: '引用素材', icon: <Quote className="h-4 w-4" /> },
    { type: 'imagery', label: '意象素材', icon: <Palette className="h-4 w-4" /> },
    { type: 'reference', label: '参考资料', icon: <BookOpen className="h-4 w-4" /> },
  ];

  const rhetoricTypes: { type: string; label: string; description: string }[] = [
    { type: 'metaphor', label: '比喻', description: '明喻、暗喻、借喻' },
    { type: 'personification', label: '拟人', description: '赋予事物人的特征' },
    { type: 'parallelism', label: '排比', description: '三个或以上相似结构' },
    { type: 'synesthesia', label: '通感', description: '跨感官描述' },
    { type: 'hyperbole', label: '夸张', description: '夸大或缩小的表达' },
    { type: 'rhetorical-question', label: '反问', description: '无疑而问的修辞' },
    { type: 'contrast', label: '对偶', description: '对称对比结构' },
    { type: 'allusion', label: '引用', description: '引用典故或名言' },
    { type: 'repetition', label: '反复', description: '重复关键词句' },
    { type: 'symbolism', label: '象征', description: '用具体表抽象' },
  ];

  const paragraphRoles: { role: ParagraphRole; label: string; description: string }[] = [
    { role: 'open', label: '开篇', description: '文章开头段落' },
    { role: 'carry', label: '承接', description: '承上启下段落' },
    { role: 'turn', label: '转折', description: '转折过渡段落' },
    { role: 'close', label: '收尾', description: '文章结尾段落' },
    { role: 'none', label: '无角色', description: '移除段落角色' },
  ];

  const formatOptions: { format: string; label: string; icon: React.ReactNode }[] = [
    { format: 'bold', label: '加粗', icon: <Bold className="h-4 w-4" /> },
    { format: 'italic', label: '斜体', icon: <Italic className="h-4 w-4" /> },
    { format: 'underline', label: '下划线', icon: <Underline className="h-4 w-4" /> },
    { format: 'highlight', label: '高亮', icon: <Highlighter className="h-4 w-4" /> },
    { format: 'align-left', label: '左对齐', icon: <AlignLeft className="h-4 w-4" /> },
    { format: 'align-center', label: '居中', icon: <AlignCenter className="h-4 w-4" /> },
    { format: 'align-right', label: '右对齐', icon: <AlignRight className="h-4 w-4" /> },
  ];

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 bg-background border border-border rounded-lg shadow-lg p-1 flex items-center gap-1"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {/* AI 分析 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => handleAction(() => onAnalyzeSelection(selection.text))}
        title="AI 分析选中文本"
      >
        <Brain className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 添加到素材库 */}
      <DropdownMenu open={showMaterialMenu} onOpenChange={setShowMaterialMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            title="添加到素材库"
          >
            <BookmarkPlus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {materialTypes.map(({ type, label, icon }) => (
            <DropdownMenuItem
              key={type}
              onClick={() => handleAction(() => onAddMaterial(selection.text, type))}
            >
              <span className="mr-2">{icon}</span>
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 修辞标注 */}
      <DropdownMenu open={showRhetoricMenu} onOpenChange={setShowRhetoricMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            title="修辞标注"
          >
            <Tag className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 max-h-64 overflow-y-auto">
          {rhetoricTypes.map(({ type, label, description }) => (
            <DropdownMenuItem
              key={type}
              onClick={() => handleAction(() => onAnnotateRhetoric(selection.range, type))}
            >
              <div>
                <div className="font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 段落角色 */}
      {selection.paragraphId && (
        <DropdownMenu open={showRoleMenu} onOpenChange={setShowRoleMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              title="段落角色标记"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {paragraphRoles.map(({ role, label, description }) => (
              <DropdownMenuItem
                key={role}
                onClick={() => handleAction(() => onMarkParagraphRole(selection.paragraphId!, role))}
              >
                <div>
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 查找相似 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => handleAction(() => onSearchSimilar(selection.text))}
        title="查找相似内容"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* 格式化操作 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            title="格式化"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {formatOptions.map(({ format, label, icon }) => (
            <DropdownMenuItem
              key={format}
              onClick={() => handleAction(() => onFormatText(selection.range, format))}
            >
              <span className="mr-2">{icon}</span>
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleAction(() => navigator.clipboard.writeText(selection.text))}>
            <Copy className="h-4 w-4 mr-2" />
            复制
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleAction(() => {
            navigator.clipboard.writeText(selection.text);
            // 这里应该触发剪切操作，需要编辑器支持
          })}>
            <Scissors className="h-4 w-4 mr-2" />
            剪切
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* AI 聊天 */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2"
        onClick={() => handleAction(() => onAnalyzeSelection(selection.text))}
        title="AI 聊天"
      >
        <MessageSquare className="h-4 w-4" />
      </Button>
    </div>
  );
}
