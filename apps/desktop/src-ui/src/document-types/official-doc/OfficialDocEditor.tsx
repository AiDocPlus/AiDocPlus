/**
 * OfficialDocEditor — 公文写作专属编辑器
 *
 * 基于 DocTypeEditorBase，增加：
 * - 公文格式检测提示条（标题、发文字号、落款等规范性检查）
 * - 工具栏增加公文格式化快捷按钮
 * - 状态栏显示公文格式合规指标
 */
import { useState, useCallback, useMemo } from 'react';
import { FileCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import DocTypeEditorBase from '../_shared/DocTypeEditorBase';
import { TOOLBAR_CLASS } from '../_shared/styles';

/** 公文格式检测项 */
interface FormatCheckItem {
  id: string;
  label: string;
  passed: boolean;
}

function checkOfficialFormat(content: string, t: (k: string, o?: Record<string, unknown>) => string): FormatCheckItem[] {
  const checks: FormatCheckItem[] = [];
  checks.push({
    id: 'title',
    label: t('officialDoc.checkTitle', { defaultValue: '标题' }),
    passed: /^#\s+.+/m.test(content),
  });
  checks.push({
    id: 'number',
    label: t('officialDoc.checkNumber', { defaultValue: '发文字号' }),
    passed: /docNumber|发文字号|文号/.test(content) && !/docNumber:\s*""/.test(content),
  });
  checks.push({
    id: 'date',
    label: t('officialDoc.checkDate', { defaultValue: '日期' }),
    passed: /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/.test(content),
  });
  checks.push({
    id: 'signature',
    label: t('officialDoc.checkSignature', { defaultValue: '落款单位' }),
    passed: /特此|此致|单位|部门|办公室|委员会/.test(content),
  });
  return checks;
}

export default function OfficialDocEditor({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const [currentContent, setCurrentContent] = useState(doc.content || '');

  const formatChecks = useMemo(() => checkOfficialFormat(currentContent, t), [currentContent, t]);
  const passedCount = formatChecks.filter(c => c.passed).length;
  const allPassed = passedCount === formatChecks.length;

  const handleInsertNotice = useCallback(() => {
    window.dispatchEvent(new CustomEvent('doctype-insert-text', {
      detail: { documentId: doc.id, text: '\n\n特此通知。\n\n附件：无\n\nXXXX单位\n' + new Date().toISOString().slice(0, 10) },
    }));
  }, [doc.id]);

  const handleInsertHeader = useCallback(() => {
    window.dispatchEvent(new CustomEvent('doctype-insert-text', {
      detail: { documentId: doc.id, text: '---\ntitle: ""\ndocNumber: ""\nissueDate: "' + new Date().toISOString().slice(0, 10) + '"\n---\n' },
    }));
  }, [doc.id]);

  return (
    <DocTypeEditorBase
      host={host}
      document={doc}
      placeholder={t('officialDoc.placeholder', { defaultValue: '开始撰写公文...' })}
      onContentChange={setCurrentContent}
      toolbarAbove={
        <div className={TOOLBAR_CLASS}>
          <FileCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{doc.title}</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleInsertHeader}>
            {t('officialDoc.insertHeader', { defaultValue: '插入红头' })}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleInsertNotice}>
            {t('officialDoc.insertSignature', { defaultValue: '插入落款' })}
          </Button>
        </div>
      }
      editorAbove={
        <div className="flex items-center gap-2 px-3 py-1 border-b bg-muted/30 text-xs flex-shrink-0">
          {allPassed
            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
          <span className="text-muted-foreground">
            {t('officialDoc.formatStatus', { defaultValue: '格式检查 {{passed}}/{{total}}', passed: passedCount, total: formatChecks.length })}
          </span>
          {formatChecks.filter(c => !c.passed).map(c => (
            <span key={c.id} className="text-amber-600 dark:text-amber-400">
              {t('officialDoc.missing', { defaultValue: '缺 {{item}}', item: c.label })}
            </span>
          ))}
        </div>
      }
      statusBarRight={
        <span className="text-xs text-muted-foreground">
          {t('docType.officialDoc', { defaultValue: '公文写作' })}
        </span>
      }
    />
  );
}
