/**
 * 功能执行类插件面板示例
 * 使用 ToolPluginLayout 布局组件
 */
import type { PluginPanelProps } from '@/plugins/types';
import { usePluginHost } from '@/plugins/_framework/PluginHostAPI';
import { ToolPluginLayout } from '@/plugins/_framework/ToolPluginLayout';
import { AIContentDialog } from '@/plugins/_framework/AIContentDialog';
import { Button } from '@/plugins/_framework/ui';
import { useState, useCallback } from 'react';
import { Wrench, Sparkles, Download } from 'lucide-react';

interface ToolStorageData {
  lastResult?: string;
  createdAt?: number;
}

export function ToolPluginPanel(_props: PluginPanelProps) {
  const host = usePluginHost();

  // 功能执行类插件使用 storage 存储数据（非 pluginData）
  const savedData = host.storage.get<ToolStorageData>('data');
  const [result, setResult] = useState<string | null>(savedData?.lastResult ?? null);
  const [status, setStatus] = useState('');
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  // 处理导入正文
  const handleImportContent = useCallback(() => {
    const content = host.content.getDocumentContent();
    if (content) {
      setResult(`Imported content (${content.length} chars)`);
      host.ui.showStatus('Content imported');
    } else {
      host.ui.showStatus('Document is empty', true);
    }
  }, [host]);

  // 保存结果到 storage
  const saveResult = useCallback((newResult: string) => {
    setResult(newResult);
    host.storage.set('data', {
      lastResult: newResult,
      createdAt: Date.now(),
    });
  }, [host]);

  // 导出结果
  const handleExport = useCallback(async () => {
    if (!result) return;

    const filePath = await host.ui.showSaveDialog({
      defaultName: 'result.txt',
      extensions: ['txt'],
    });

    if (!filePath) return;

    try {
      // 将字符串转换为字节数组
      const encoder = new TextEncoder();
      const data = Array.from(encoder.encode(result));

      await host.platform.invoke('write_binary_file', {
        path: filePath,
        data,
      });

      host.ui.showStatus('Exported successfully');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Export failed';
      host.ui.showStatus(errorMsg, true);
    }
  }, [result, host]);

  // AI 生成完成回调
  const handleAIGenerated = useCallback((generated: string) => {
    saveResult(generated);
    setStatus('AI generation completed');
  }, [saveResult]);

  // 监听主题变化示例
  // host.events.on('theme:changed', (data) => {
  //   console.log('Theme changed to:', data.theme);
  // });

  return (
    <>
      <ToolPluginLayout
        pluginIcon={Wrench}
        pluginTitle="Tool Example"
        pluginDesc="A functional plugin that works independently of documents"
        onImportContent={handleImportContent}
        extraToolbar={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiDialogOpen(true)}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            AI Generate
          </Button>
        }
        hasContent={!!result}
        statusMsg={status}
        onStatusClose={() => setStatus('')}
      >
        {result ? (
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Result</h3>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap bg-muted p-4 rounded-lg">
              {result}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Import content or use AI to generate</p>
            </div>
          </div>
        )}
      </ToolPluginLayout>

      <AIContentDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        title="AI Content Generation"
        description="Generate content using AI"
        systemPrompt="You are a helpful assistant. Generate content based on the user's request."
        referenceContent={host.content.getDocumentContent()}
        onGenerated={handleAIGenerated}
      />
    </>
  );
}
