/**
 * 内容生成类插件面板示例
 * 使用 PluginPanelLayout 布局组件
 */
import type { PluginPanelProps } from '@/plugins/types';
import { usePluginHost } from '@/plugins/_framework/PluginHostAPI';
import { PluginPanelLayout } from '@/plugins/_framework/PluginPanelLayout';
import { useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';

interface SummaryPluginData {
  summary?: string;
  style?: string;
}

export function SummaryPluginPanel({
  document,
  content,
  pluginData,
  onPluginDataChange,
  onRequestSave,
}: PluginPanelProps) {
  const host = usePluginHost();

  // 从 pluginData 读取已保存的数据
  const savedData = (pluginData as SummaryPluginData) ?? {};
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(savedData.summary ?? null);

  // 生成摘要
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;

    setGenerating(true);
    try {
      // 获取文档内容
      const docContent = host.content.getDocumentContent();
      if (!docContent.trim()) {
        host.ui.showStatus('Document is empty', true);
        return;
      }

      // 截断内容（按用户设置）
      const truncatedContent = host.ai.truncateContent(docContent);

      // 调用 AI
      const systemPrompt = `你是一个专业的文档摘要助手。请根据用户的要求，对以下文档内容进行摘要。

摘要要求：${prompt}

文档内容：
${truncatedContent}`;

      const response = await host.ai.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '请生成摘要' },
      ], { maxTokens: 2048 });

      // 更新状态
      setSummary(response);

      // 保存到 pluginData
      const newData: SummaryPluginData = {
        ...savedData,
        summary: response,
        style: prompt,
      };
      onPluginDataChange(newData);

      // 触发磁盘保存
      onRequestSave?.();

      host.ui.showStatus('Summary generated');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Generation failed';
      host.ui.showStatus(errorMsg, true);
    } finally {
      setGenerating(false);
    }
  }, [prompt, generating, savedData, host, onPluginDataChange, onRequestSave]);

  // 清空内容
  const handleClear = useCallback(() => {
    setSummary(null);
    setPrompt('');
    onPluginDataChange({});
    host.ui.showStatus('Cleared');
  }, [host, onPluginDataChange]);

  return (
    <PluginPanelLayout
      pluginIcon={Sparkles}
      pluginTitle="Summary Example"
      pluginDesc="Generate document summaries with AI"
      prompt={prompt}
      onPromptChange={setPrompt}
      promptPlaceholder="e.g., 生成一段 100 字左右的摘要"
      generating={generating}
      onGenerate={handleGenerate}
      generateLabel="Generate Summary"
      onClear={summary ? handleClear : undefined}
      hasContent={!!summary}
    >
      {summary && (
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">Summary</h3>
          <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap">
            {summary}
          </div>
        </div>
      )}
    </PluginPanelLayout>
  );
}
