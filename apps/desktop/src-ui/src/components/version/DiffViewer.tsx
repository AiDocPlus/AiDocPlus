import { useState, useRef, useEffect, useMemo } from 'react';
import { FileText, Columns, List } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { DocumentVersion } from '@aidocplus/shared-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { MergeView } from '@codemirror/merge';
import { EditorView, lineNumbers } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { unifiedMergeView } from '@codemirror/merge';
import { format } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';

interface DiffViewerProps {
  open: boolean;
  onClose: () => void;
  leftVersion?: DocumentVersion;
  rightVersion?: DocumentVersion;
  leftLabel?: string;
  rightLabel?: string;
}

export function DiffViewer({
  open,
  onClose,
  leftVersion,
  rightVersion,
  leftLabel,
  rightLabel
}: DiffViewerProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
  const mergeContainerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const unifiedContainerRef = useRef<HTMLDivElement>(null);
  const unifiedViewRef = useRef<EditorView | null>(null);

  const isDark = useMemo(() => {
    return document.documentElement.classList.contains('dark');
  }, [open]);

  const leftContent = leftVersion?.content ?? '';
  const rightContent = rightVersion?.content ?? '';

  const formatDate = (timestamp: number) => {
    const language = localStorage.getItem('aidocplus-language') || 'zh';
    const locale = language === 'en' ? enUS : zhCN;
    try {
      return format(new Date(timestamp * 1000), 'PPp', { locale });
    } catch {
      return new Date(timestamp * 1000).toLocaleString();
    }
  };

  // 统计变更行数
  const stats = useMemo(() => {
    const leftLines = leftContent.split('\n');
    const rightLines = rightContent.split('\n');
    const leftSet = new Set(leftLines);
    const rightSet = new Set(rightLines);
    const additions = rightLines.filter(l => !leftSet.has(l)).length;
    const deletions = leftLines.filter(l => !rightSet.has(l)).length;
    return { additions, deletions, changes: additions + deletions };
  }, [leftContent, rightContent]);

  // 共享扩展
  const sharedExtensions = useMemo(() => [
    lineNumbers(),
    EditorView.editable.of(false),
    EditorState.readOnly.of(true),
    EditorView.lineWrapping,
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    ...(isDark ? [oneDark] : []),
  ], [isDark]);

  // 并排模式：MergeView
  useEffect(() => {
    if (!open || viewMode !== 'side-by-side' || !mergeContainerRef.current) return;
    // 清理旧实例
    mergeViewRef.current?.destroy();
    mergeViewRef.current = null;

    const mv = new MergeView({
      parent: mergeContainerRef.current,
      a: {
        doc: leftContent,
        extensions: sharedExtensions,
      },
      b: {
        doc: rightContent,
        extensions: sharedExtensions,
      },
      collapseUnchanged: { margin: 3, minSize: 4 },
      highlightChanges: true,
      gutter: true,
    });
    mergeViewRef.current = mv;

    return () => {
      mv.destroy();
      mergeViewRef.current = null;
    };
  }, [open, viewMode, leftContent, rightContent, sharedExtensions]);

  // 统一模式：unifiedMergeView
  useEffect(() => {
    if (!open || viewMode !== 'unified' || !unifiedContainerRef.current) return;
    unifiedViewRef.current?.destroy();
    unifiedViewRef.current = null;

    const state = EditorState.create({
      doc: rightContent,
      extensions: [
        ...sharedExtensions,
        unifiedMergeView({
          original: leftContent,
          highlightChanges: true,
          gutter: true,
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: unifiedContainerRef.current,
    });
    unifiedViewRef.current = view;

    return () => {
      view.destroy();
      unifiedViewRef.current = null;
    };
  }, [open, viewMode, leftContent, rightContent, sharedExtensions]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col bg-card">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-card">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {t('version.diffViewer')}
          </DialogTitle>
        </DialogHeader>

        {/* Stats */}
        <div className="px-4 py-2 bg-muted border-b flex items-center gap-4 text-sm shrink-0">
          <div className="flex items-center gap-1">
            <span className="font-medium">{t('version.changes', { defaultValue: '变更' })}:</span>
            <span className="text-muted-foreground">{stats.changes}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-green-600">{t('version.additions', { defaultValue: '新增' })}:</span>
            <span className="text-green-600">+{stats.additions}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium text-red-600">{t('version.deletions', { defaultValue: '删除' })}:</span>
            <span className="text-red-600">-{stats.deletions}</span>
          </div>
          {leftVersion && (
            <div className="ml-auto text-xs text-muted-foreground">
              {leftLabel || formatDate(leftVersion.createdAt)} → {rightLabel || (rightVersion ? formatDate(rightVersion.createdAt) : '')}
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as typeof viewMode)} className="px-4 shrink-0">
          <TabsList className="w-full">
            <TabsTrigger value="side-by-side" className="flex items-center gap-2">
              <Columns className="w-4 h-4" />
              {t('version.sideBySide', { defaultValue: '并排对比' })}
            </TabsTrigger>
            <TabsTrigger value="unified" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              {t('version.unified', { defaultValue: '统一视图' })}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Diff Content — CodeMirror MergeView */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div
            ref={mergeContainerRef}
            className="h-full"
            style={{ display: viewMode === 'side-by-side' ? 'block' : 'none' }}
          />
          <div
            ref={unifiedContainerRef}
            className="h-full"
            style={{ display: viewMode === 'unified' ? 'block' : 'none' }}
          />
        </div>

        <div className="border-t p-4 flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DiffViewer;
