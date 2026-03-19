/**
 * AcademicPaperEditor — 学术论文专属编辑器
 *
 * 基于 DocTypeEditorBase，增加：
 * - 论文结构检测（摘要/引言/方法/结果/讨论/结论 完整性检查）
 * - 工具栏显示结构完整度
 * - 状态栏显示各章节字数和引用数量
 */
import { useState, useMemo, useCallback } from 'react';
import { GraduationCap, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import DocTypeEditorBase from '../_shared/DocTypeEditorBase';
import { TOOLBAR_CLASS } from '../_shared/styles';

const PAPER_SECTIONS = [
  { key: 'abstract', pattern: /\*?\*?摘要\*?\*?|abstract/i },
  { key: 'intro', pattern: /##\s*(1[.、]?\s*)?(引言|Introduction)/i },
  { key: 'literature', pattern: /##\s*(2[.、]?\s*)?(文献综述|Literature)/i },
  { key: 'method', pattern: /##\s*(3[.、]?\s*)?(研究方法|Method)/i },
  { key: 'result', pattern: /##\s*(4[.、]?\s*)?(结果|Result)/i },
  { key: 'discussion', pattern: /##\s*(5[.、]?\s*)?(讨论|Discussion)/i },
  { key: 'conclusion', pattern: /##\s*(6[.、]?\s*)?(结论|Conclusion)/i },
  { key: 'references', pattern: /##\s*(参考文献|Reference)/i },
];

const SECTION_LABELS: Record<string, string> = {
  abstract: '摘要', intro: '引言', literature: '文献综述', method: '方法',
  result: '结果', discussion: '讨论', conclusion: '结论', references: '参考文献',
};

function analyzeStructure(content: string) {
  return PAPER_SECTIONS.map(sec => ({
    key: sec.key,
    label: SECTION_LABELS[sec.key] || sec.key,
    present: sec.pattern.test(content),
  }));
}

function countReferences(content: string) {
  // 计算引用标记 [1] [2] 等
  const refs = new Set((content.match(/\[(\d+)\]/g) || []).map(m => m));
  return refs.size;
}

export default function AcademicPaperEditor({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const [currentContent, setCurrentContent] = useState(doc.content || '');

  const structure = useMemo(() => analyzeStructure(currentContent), [currentContent]);
  const presentCount = structure.filter(s => s.present).length;
  const refCount = useMemo(() => countReferences(currentContent), [currentContent]);
  const allPresent = presentCount === structure.length;

  const handleInsertRef = useCallback(() => {
    window.dispatchEvent(new CustomEvent('doctype-insert-text', {
      detail: { documentId: doc.id, text: '\n\n## 参考文献\n\n[1] \n[2] \n[3] \n' },
    }));
  }, [doc.id]);

  return (
    <DocTypeEditorBase
      host={host}
      document={doc}
      placeholder={t('academic.placeholder', { defaultValue: '开始撰写学术论文...' })}
      onContentChange={setCurrentContent}
      toolbarAbove={
        <div className={TOOLBAR_CLASS}>
          <GraduationCap className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{doc.title}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-xs">
            {allPresent
              ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
            <span className="text-muted-foreground">{presentCount}/{structure.length}</span>
            {structure.filter(s => !s.present).slice(0, 3).map(s => (
              <span key={s.key} className="text-amber-600 dark:text-amber-400 text-[11px]">
                {t('academic.missing', { defaultValue: '缺{{section}}', section: s.label })}
              </span>
            ))}
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleInsertRef}>
            <Plus className="h-3 w-3" />
            {t('academic.addReferences', { defaultValue: '参考文献' })}
          </Button>
        </div>
      }
      statusBarRight={
        <span className="flex items-center gap-3">
          <span>{refCount} {t('academic.citations', { defaultValue: '引用' })}</span>
          <span>{t('docType.academicPaper', { defaultValue: '学术论文' })}</span>
        </span>
      }
    />
  );
}
