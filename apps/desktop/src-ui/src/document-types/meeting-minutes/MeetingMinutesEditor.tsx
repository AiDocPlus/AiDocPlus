/**
 * MeetingMinutesEditor — 会议纪要专属编辑器
 *
 * 基于 DocTypeEditorBase，增加：
 * - 行动项自动检测和统计
 * - 工具栏快速插入行动项表格行和决议模板
 * - 状态栏显示行动项数和决议数
 */
import { useState, useMemo, useCallback } from 'react';
import { ClipboardList, Plus, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import DocTypeEditorBase from '../_shared/DocTypeEditorBase';
import { TOOLBAR_CLASS } from '../_shared/styles';

function countActionItems(content: string) {
  // 检测表格中的行动项行（包含序号、事项、负责人等）
  const tableRows = (content.match(/\|\s*\d+\s*\|/g) || []).length;
  // 检测 TODO / 行动项 / 待办关键词
  const todoItems = (content.match(/(?:TODO|待办|行动项|负责人[：:]\s*\S+)/gi) || []).length;
  return Math.max(tableRows, todoItems);
}

function countResolutions(content: string) {
  return (content.match(/(?:决议|决定|通过|批准|同意)[：:]/g) || []).length;
}

export default function MeetingMinutesEditor({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const [currentContent, setCurrentContent] = useState(doc.content || '');

  const actionItems = useMemo(() => countActionItems(currentContent), [currentContent]);
  const resolutions = useMemo(() => countResolutions(currentContent), [currentContent]);

  const handleInsertActionRow = useCallback(() => {
    const row = `| ${actionItems + 1} | | | | 待完成 |`;
    window.dispatchEvent(new CustomEvent('doctype-insert-text', {
      detail: { documentId: doc.id, text: '\n' + row },
    }));
  }, [doc.id, actionItems]);

  const handleInsertResolution = useCallback(() => {
    window.dispatchEvent(new CustomEvent('doctype-insert-text', {
      detail: { documentId: doc.id, text: '\n\n**决议：**\n\n- 决议内容...\n- 执行时间：\n- 负责人：\n' },
    }));
  }, [doc.id]);

  return (
    <DocTypeEditorBase
      host={host}
      document={doc}
      placeholder={t('meeting.placeholder', { defaultValue: '开始记录会议内容...' })}
      onContentChange={setCurrentContent}
      toolbarAbove={
        <div className={TOOLBAR_CLASS}>
          <ClipboardList className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{doc.title}</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleInsertActionRow}>
            <Plus className="h-3 w-3" />
            {t('meeting.addActionItem', { defaultValue: '添加行动项' })}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleInsertResolution}>
            <ListChecks className="h-3 w-3" />
            {t('meeting.addResolution', { defaultValue: '添加决议' })}
          </Button>
        </div>
      }
      statusBarRight={
        <span className="flex items-center gap-3">
          <span>{actionItems} {t('meeting.actionItems', { defaultValue: '行动项' })}</span>
          <span>{resolutions} {t('meeting.resolutions', { defaultValue: '决议' })}</span>
          <span>{t('docType.meetingMinutes', { defaultValue: '会议纪要' })}</span>
        </span>
      }
    />
  );
}
