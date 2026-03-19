/**
 * ScreenplayEditor — 电影剧本专属编辑器
 *
 * 基于 DocTypeEditorBase，增加：
 * - 场景数统计和预估时长（1页≈1分钟）
 * - 工具栏快速插入场景/对白模板
 * - 状态栏显示场景数和预估时长
 */
import { useState, useMemo, useCallback } from 'react';
import { Film, Plus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DocTypeEditorProps } from '@/doctype-sdk/types';
import { useTranslation } from '@/i18n';
import DocTypeEditorBase from '../_shared/DocTypeEditorBase';
import { TOOLBAR_CLASS } from '../_shared/styles';

function countScenes(content: string) {
  // 匹配场景标题：## 场景X / INT. / EXT. / 内景 / 外景
  return (content.match(/(?:^##\s*场景|^(?:INT|EXT|内景|外景)[.\s—])/gmi) || []).length;
}

export default function ScreenplayEditor({ document: doc, host }: DocTypeEditorProps) {
  const { t } = useTranslation();
  const [currentContent, setCurrentContent] = useState(doc.content || '');

  const sceneCount = useMemo(() => countScenes(currentContent), [currentContent]);
  const wordCount = currentContent.replace(/\s/g, '').length;
  // 粗略估算：中文 500字/页，1页≈1分钟
  const estimatedMinutes = Math.max(1, Math.round(wordCount / 500));

  const handleInsertScene = useCallback(() => {
    const num = sceneCount + 1;
    window.dispatchEvent(new CustomEvent('doctype-insert-text', {
      detail: {
        documentId: doc.id,
        text: `\n\n## 场景${num}：内景 — 地点 — 时间\n\n（场景描述：环境、氛围、人物位置）\n\n`,
      },
    }));
  }, [doc.id, sceneCount]);

  const handleInsertDialogue = useCallback(() => {
    window.dispatchEvent(new CustomEvent('doctype-insert-text', {
      detail: {
        documentId: doc.id,
        text: '\n\n**角色名**\n（表情/动作）对白内容...\n\n',
      },
    }));
  }, [doc.id]);

  return (
    <DocTypeEditorBase
      host={host}
      document={doc}
      placeholder={t('screenplay.placeholder', { defaultValue: '开始创作剧本...' })}
      onContentChange={setCurrentContent}
      toolbarAbove={
        <div className={TOOLBAR_CLASS}>
          <Film className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium truncate">{doc.title}</span>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleInsertScene}>
            <Plus className="h-3 w-3" />
            {t('screenplay.addScene', { defaultValue: '添加场景' })}
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleInsertDialogue}>
            <MessageSquare className="h-3 w-3" />
            {t('screenplay.addDialogue', { defaultValue: '添加对白' })}
          </Button>
        </div>
      }
      statusBarRight={
        <span className="flex items-center gap-3">
          <span>{sceneCount} {t('screenplay.scenes', { defaultValue: '场景' })}</span>
          <span>≈ {estimatedMinutes} {t('screenplay.minutes', { defaultValue: '分钟' })}</span>
          <span>{t('docType.screenplay', { defaultValue: '电影剧本' })}</span>
        </span>
      }
    />
  );
}
