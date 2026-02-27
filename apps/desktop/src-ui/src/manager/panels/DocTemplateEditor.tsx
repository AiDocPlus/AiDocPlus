import type { EditorPanelProps } from '@aidocplus/manager-shared';

export function DocTemplateEditor({ resource, onChange }: EditorPanelProps) {
  const contentJson = resource.contentFiles['content.json'] || '{}';
  const m = resource.manifest as Record<string, unknown>;

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(contentJson);
  } catch {
    // ignore
  }

  const updateContentField = (field: string, value: unknown) => {
    const updated = { ...parsed, [field]: value };
    onChange({ contentFiles: { 'content.json': JSON.stringify(updated, null, 2) } });
  };

  const updateManifestField = (field: string, value: unknown) => {
    onChange({ manifest: { [field]: value } });
  };

  return (
    <div className="space-y-5 p-5 border rounded-lg">
      <h3 className="text-sm font-semibold text-muted-foreground">文档模板内容</h3>

      {/* 提示词（原 authorNotes） */}
      <div className="space-y-2">
        <label className="font-medium">提示词</label>
        <textarea
          value={(parsed.authorNotes as string) || ''}
          onChange={(e) => updateContentField('authorNotes', e.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-white px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-y"
          placeholder="AI 生成文档时使用的提示词..."
        />
      </div>

      {/* 素材内容（原 content） */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-medium">素材内容</label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={!!m.includeContent}
              onChange={(e) => updateManifestField('includeContent', e.target.checked)}
              className="rounded"
            />
            包含素材
          </label>
        </div>
        <textarea
          value={(parsed.content as string) || ''}
          onChange={(e) => updateContentField('content', e.target.value)}
          rows={8}
          className="w-full rounded-md border border-input bg-white px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
          placeholder="模板素材内容..."
        />
      </div>

      {/* 正文内容（aiGeneratedContent） */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-medium">正文内容</label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={!!m.includeAiContent}
              onChange={(e) => updateManifestField('includeAiContent', e.target.checked)}
              className="rounded"
            />
            包含正文
          </label>
        </div>
        <textarea
          value={(parsed.aiGeneratedContent as string) || ''}
          onChange={(e) => updateContentField('aiGeneratedContent', e.target.value)}
          rows={6}
          className="w-full rounded-md border border-input bg-white px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
          placeholder="AI 生成的正文内容..."
        />
      </div>

      {/* 预设插件 */}
      <div className="space-y-2">
        <label className="font-medium">预设插件</label>
        <input
          type="text"
          value={((m.enabledPlugins as string[]) || []).join(', ')}
          onChange={(e) => {
            const plugins = e.target.value
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
            updateManifestField('enabledPlugins', plugins);
          }}
          className="w-full h-10 rounded-md border border-input bg-white px-3 outline-none focus:ring-1 focus:ring-ring"
          placeholder="插件ID，多个用逗号分隔（如 ppt, outline）"
        />
      </div>

      {/* 插件数据 */}
      <div className="space-y-2">
        <label className="font-medium">插件数据（JSON）</label>
        <textarea
          value={parsed.pluginData ? JSON.stringify(parsed.pluginData, null, 2) : ''}
          onChange={(e) => {
            const val = e.target.value.trim();
            if (!val) {
              updateContentField('pluginData', null);
            } else {
              try {
                updateContentField('pluginData', JSON.parse(val));
              } catch {
                // 输入中的 JSON 暂时无效，不更新
              }
            }
          }}
          rows={4}
          className="w-full rounded-md border border-input bg-white px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-y font-mono text-xs"
          placeholder='{"pluginId": {...}}'
        />
      </div>
    </div>
  );
}
