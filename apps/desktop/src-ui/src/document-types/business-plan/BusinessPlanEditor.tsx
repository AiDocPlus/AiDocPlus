/**
 * BusinessPlanEditor — 商业计划书专属编辑器
 *
 * 基于 DocTypeEditorBase，增加：
 * - 章节完成度侧边指示（各章节填写进度可视化）
 * - 工具栏显示章节导航
 * - 状态栏显示已完成/待完成章节数
 */
import { useState, useMemo } from 'react';
import { BarChart3, CheckCircle2, Circle } from 'lucide-react';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import DocTypeEditorBase from '../_shared/DocTypeEditorBase';
import { TOOLBAR_CLASS } from '../_shared/styles';

const EXPECTED_SECTIONS = [
  { key: 'overview', pattern: /##\s*(一|1)[、.]?\s*(项目概述|Executive Summary)/i },
  { key: 'market', pattern: /##\s*(二|2)[、.]?\s*(市场分析|Market Analysis)/i },
  { key: 'product', pattern: /##\s*(三|3)[、.]?\s*(产品|Product)/i },
  { key: 'model', pattern: /##\s*(四|4)[、.]?\s*(商业模式|Business Model)/i },
  { key: 'marketing', pattern: /##\s*(五|5)[、.]?\s*(营销|Marketing)/i },
  { key: 'team', pattern: /##\s*(六|6)[、.]?\s*(团队|Team)/i },
  { key: 'financial', pattern: /##\s*(七|7)[、.]?\s*(财务|Financial)/i },
  { key: 'funding', pattern: /##\s*(八|8)[、.]?\s*(融资|Funding)/i },
];

function checkSections(content: string) {
  return EXPECTED_SECTIONS.map(sec => {
    const match = sec.pattern.test(content);
    // 检查该章节是否有实质内容（至少30字）
    if (!match) return { key: sec.key, hasHeading: false, hasContent: false };
    const idx = content.search(sec.pattern);
    const nextHeading = content.slice(idx + 5).search(/^##\s/m);
    const sectionText = nextHeading > 0 ? content.slice(idx, idx + 5 + nextHeading) : content.slice(idx);
    const textOnly = sectionText.replace(/^##.+$/m, '').replace(/\s/g, '');
    return { key: sec.key, hasHeading: true, hasContent: textOnly.length > 30 };
  });
}

export default function BusinessPlanEditor({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const [currentContent, setCurrentContent] = useState(doc.content || '');

  const sections = useMemo(() => checkSections(currentContent), [currentContent]);
  const completed = sections.filter(s => s.hasContent).length;

  return (
    <DocTypeEditorBase
      host={host}
      document={doc}
      placeholder={t('businessPlan.placeholder', { defaultValue: '开始撰写商业计划书...' })}
      onContentChange={setCurrentContent}
      toolbarAbove={
        <div className={TOOLBAR_CLASS}>
          <BarChart3 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{doc.title}</span>
          <div className="flex-1" />
          <div className="flex items-center gap-0.5">
            {sections.map(sec => (
              <div key={sec.key} title={sec.key} className="w-2 h-2 rounded-full"
                style={{ backgroundColor: sec.hasContent ? 'var(--color-green-500)' : sec.hasHeading ? 'var(--color-amber-400)' : 'var(--color-muted)' }} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground ml-1">
            {completed}/{sections.length}
          </span>
        </div>
      }
      statusBarRight={
        <span className="flex items-center gap-2">
          {sections.map(sec => (
            <span key={sec.key} title={sec.key}>
              {sec.hasContent
                ? <CheckCircle2 className="h-3 w-3 text-green-500" />
                : <Circle className="h-3 w-3 text-muted-foreground/40" />}
            </span>
          ))}
          <span>{t('docType.businessPlan', { defaultValue: '商业计划书' })}</span>
        </span>
      }
    />
  );
}
