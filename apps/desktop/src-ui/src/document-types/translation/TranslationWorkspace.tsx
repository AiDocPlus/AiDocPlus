/**
 * TranslationWorkspace — 中英文翻译双栏编辑器
 * standard 布局：此组件只负责双栏编辑，AI 侧栏由平台 DocumentWorkspace 自动提供 ChatPanel
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Languages, Sparkles, ArrowLeftRight, Trash2 } from 'lucide-react';
import { MarkdownEditor } from '@/components/editor/MarkdownEditor';
import {
  parseTranslationContent, createEmptyTranslationContent,
  type TranslationDocumentContent,
} from './types';

export default function TranslationWorkspace({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const [trans, setTrans] = useState<TranslationDocumentContent>(() =>
    parseTranslationContent(doc.content || '') || createEmptyTranslationContent()
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [sourceLine, setSourceLine] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 文档切换时重新加载
  useEffect(() => {
    const d = host.doc.getDocument();
    setTrans(parseTranslationContent(d.content || '') || createEmptyTranslationContent());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  // 保存（debounced）
  const saveTrans = useCallback((updated: TranslationDocumentContent) => {
    setTrans(updated);
    host.doc.updateInMemory({ content: JSON.stringify(updated) });
    host.doc.markDirty();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { host.doc.save(); }, 3000);
  }, [host.doc]);

  const handleSourceChange = useCallback((val: string) => {
    saveTrans({ ...trans, source: val });
  }, [trans, saveTrans]);

  const handleTargetChange = useCallback((val: string) => {
    saveTrans({ ...trans, target: val });
  }, [trans, saveTrans]);

  const handleToggleDirection = useCallback(() => {
    saveTrans({ ...trans, direction: trans.direction === 'zh-en' ? 'en-zh' : 'zh-en' });
  }, [trans, saveTrans]);

  const handleSwap = useCallback(() => {
    saveTrans({ ...trans, source: trans.target, target: trans.source, direction: trans.direction === 'zh-en' ? 'en-zh' : 'zh-en' });
  }, [trans, saveTrans]);

  // 一键翻译（流式，实时显示）
  const handleAITranslate = useCallback(async () => {
    if (isTranslating || !host.ai.isAvailable() || !trans.source.trim()) return;
    setIsTranslating(true);
    saveTrans({ ...trans, target: '' });
    try {
      const srcLang = trans.direction === 'zh-en' ? '中文' : '英文';
      const tgtLang = trans.direction === 'zh-en' ? '英文' : '中文';
      let accumulated = '';
      await host.ai.chatStream(
        [
          { role: 'system', content: '你是专业的中英文翻译助手。翻译时注重信、达、雅。只输出译文，不要添加任何说明。' },
          { role: 'user', content: `请将以下${srcLang}翻译为${tgtLang}：\n\n${trans.source}` },
        ],
        (chunk) => {
          accumulated += chunk;
          setTrans(prev => ({ ...prev, target: accumulated }));
        },
      );
      saveTrans({ ...trans, target: accumulated.trim() });
    } catch (err) {
      console.error('[Translation] AI error:', err);
    } finally {
      setIsTranslating(false);
    }
  }, [isTranslating, host.ai, trans, saveTrans]);

  const handleClearTarget = useCallback(() => {
    saveTrans({ ...trans, target: '' });
  }, [trans, saveTrans]);

  const sourceWordCount = trans.source.replace(/\s/g, '').length;
  const targetWordCount = trans.target.replace(/\s/g, '').length;
  const dirLabel = trans.direction === 'zh-en' ? '中文 → 英文' : '英文 → 中文';

  return (
    <div className="h-full flex flex-col">
      {/* 翻译工具栏 */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b flex-shrink-0 bg-card">
        <Languages className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium truncate">{doc.title}</span>
        <div className="flex-1" />
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleToggleDirection}>
          <ArrowLeftRight className="h-3 w-3" />{dirLabel}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleSwap}
          title={t('translation.swap', { defaultValue: '交换原文和译文' })}>
          <ArrowLeftRight className="h-3 w-3" />{t('translation.swap', { defaultValue: '交换' })}
        </Button>
        <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={handleAITranslate}
          disabled={isTranslating || !trans.source.trim()}>
          <Sparkles className="h-3 w-3" />
          {isTranslating ? t('translation.translating', { defaultValue: '翻译中...' }) : t('translation.aiTranslateAll', { defaultValue: '一键翻译' })}
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleClearTarget} disabled={!trans.target.trim()}
          title={t('translation.clearTarget', { defaultValue: '清空译文' })}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* 双栏编辑器 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左栏：原文 */}
        <div className="flex-1 flex flex-col border-r min-w-0">
          <div className="px-3 py-1 border-b bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
            {trans.direction === 'zh-en' ? t('translation.sourceZh', { defaultValue: '原文（中文）' }) : t('translation.sourceEn', { defaultValue: '原文（英文）' })}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <MarkdownEditor
              value={trans.source}
              onChange={handleSourceChange}
              placeholder={trans.direction === 'zh-en' ? t('translation.sourcePlaceholderZh', { defaultValue: '在此输入或粘贴中文原文...' }) : t('translation.sourcePlaceholderEn', { defaultValue: '在此输入或粘贴英文原文...' })}
              showToolbar={true}
              showViewModeSwitch={true}
              showStatusBar={true}
              editorId={`trans-source-${doc.id}`}
              theme="light"
              onCursorLineChange={setSourceLine}
            />
          </div>
        </div>

        {/* 右栏：译文 */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-3 py-1 border-b bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
            {trans.direction === 'zh-en' ? t('translation.targetEn', { defaultValue: '译文（英文）' }) : t('translation.targetZh', { defaultValue: '译文（中文）' })}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <MarkdownEditor
              value={trans.target}
              onChange={handleTargetChange}
              placeholder={isTranslating ? t('translation.translating', { defaultValue: '翻译中...' }) : t('translation.targetPlaceholderEn', { defaultValue: 'AI 翻译结果将显示在此，也可手动编辑...' })}
              showToolbar={true}
              showViewModeSwitch={true}
              showStatusBar={true}
              editorId={`trans-target-${doc.id}`}
              theme="light"
              initialLine={sourceLine}
            />
          </div>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div className="flex items-center gap-4 px-3 py-1 border-t text-xs text-muted-foreground flex-shrink-0 bg-card">
        <span>{t('translation.sourceCount', { defaultValue: '原文 {{count}} 字', count: sourceWordCount })}</span>
        <span>{t('translation.targetCount', { defaultValue: '译文 {{count}} 字', count: targetWordCount })}</span>
        {isTranslating && <span className="text-primary animate-pulse">{t('translation.translating', { defaultValue: '翻译中...' })}</span>}
      </div>
    </div>
  );
}
