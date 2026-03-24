/**
 * EssayTemplateDialog.tsx — 散文写作模板选择对话框
 *
 * Phase 4: 模板选择与应用
 * - 按子类型分类展示
 * - 模板卡片预览
 * - 应用模板到当前文档
 * - 空白文档选项
 */

import { useState } from 'react';
import { X, FileText, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getAllTemplates, getTemplatesBySubtype, type EssayTemplate } from './essayTemplates';
import { ESSAY_SUBTYPE_OPTIONS, ESSAY_SUBTYPE_LABEL } from './constants';
import type { EssaySubtype } from './types';
import { DIALOG_STYLE } from './constants';

interface EssayTemplateDialogProps {
  onSelect: (template: EssayTemplate | null) => void;
  onClose: () => void;
}

export default function EssayTemplateDialog({ onSelect, onClose }: EssayTemplateDialogProps) {
  const [activeSubtype, setActiveSubtype] = useState<EssaySubtype | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const templates = activeSubtype === 'all'
    ? getAllTemplates()
    : getTemplatesBySubtype(activeSubtype);

  const selectedTemplate = selectedId ? templates.find(t => t.id === selectedId) ?? null : null;

  const handleApply = () => {
    onSelect(selectedTemplate);
    onClose();
  };

  const handleBlank = () => {
    onSelect(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-card border rounded-lg shadow-2xl w-[720px] max-h-[85vh] flex flex-col"
        style={DIALOG_STYLE}
      >
        {/* ── 顶部标题 ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold">选择写作模板</h2>
            <p className="text-xs text-muted-foreground mt-0.5">选择一个模板快速开始，或使用空白文档</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* ── 子类型筛选 Tab ── */}
        <div className="flex items-center gap-1 px-4 py-2 border-b flex-shrink-0 overflow-x-auto">
          <button
            className={cn(
              'text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors',
              activeSubtype === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground',
            )}
            onClick={() => setActiveSubtype('all')}
          >
            全部 ({getAllTemplates().length})
          </button>
          {ESSAY_SUBTYPE_OPTIONS.map(opt => {
            const count = getTemplatesBySubtype(opt.value).length;
            if (count === 0) return null;
            return (
              <button
                key={opt.value}
                className={cn(
                  'text-xs px-3 py-1 rounded-full whitespace-nowrap transition-colors',
                  activeSubtype === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                )}
                onClick={() => setActiveSubtype(opt.value)}
              >
                {opt.label} ({count})
              </button>
            );
          })}
        </div>

        {/* ── 模板列表 ── */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          <div className="grid grid-cols-2 gap-3">
            {templates.map(tpl => {
              const isSelected = selectedId === tpl.id;
              const isExpanded = expandedId === tpl.id;

              return (
                <div
                  key={tpl.id}
                  className={cn(
                    'border rounded-lg cursor-pointer transition-all duration-150 overflow-hidden',
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30',
                  )}
                  onClick={() => setSelectedId(isSelected ? null : tpl.id)}
                >
                  {/* 卡片头部 */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {ESSAY_SUBTYPE_LABEL[tpl.subtype]}
                          </span>
                          <span className="text-[10px] text-muted-foreground">{tpl.targetWordCount}字</span>
                        </div>
                        <h3 className="text-sm font-medium truncate">{tpl.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tpl.description}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* 关键意象标签 */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tpl.keyImagery.map((img, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/80 text-muted-foreground">
                          {img}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 展开预览按钮 */}
                  <button
                    className="w-full px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground border-t bg-muted/20 text-left flex items-center justify-between"
                    onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : tpl.id); }}
                  >
                    <span>{isExpanded ? '收起结构' : '查看结构框架'}</span>
                    <span>{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {/* 展开后的结构框架 */}
                  {isExpanded && (
                    <div className="px-3 py-2 border-t bg-muted/10 space-y-1.5">
                      {tpl.skeleton.map((s, i) => (
                        <div key={i} className="flex gap-2 text-xs">
                          <span className={cn(
                            'flex-shrink-0 w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white',
                            s.role === 'open' && 'bg-blue-400',
                            s.role === 'carry' && 'bg-green-400',
                            s.role === 'turn' && 'bg-orange-400',
                            s.role === 'close' && 'bg-purple-400',
                          )}>
                            {s.role === 'open' ? '起' : s.role === 'carry' ? '承' : s.role === 'turn' ? '转' : '合'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{s.label}</span>
                            <p className="text-muted-foreground text-[11px] mt-0.5">{s.prompt}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 底部操作 ── */}
        <div className="flex items-center justify-between px-4 py-3 border-t flex-shrink-0 bg-muted/20">
          <Button variant="outline" size="sm" className="text-xs" onClick={handleBlank}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            空白文档
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs" onClick={onClose}>取消</Button>
            <Button
              size="sm" className="text-xs"
              disabled={!selectedTemplate}
              onClick={handleApply}
            >
              使用模板
              {selectedTemplate && <span className="ml-1 opacity-70">「{selectedTemplate.title}」</span>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
