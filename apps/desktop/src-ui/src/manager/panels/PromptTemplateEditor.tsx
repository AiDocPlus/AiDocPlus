import type { EditorPanelProps } from '@aidocplus/manager-shared';

export function PromptTemplateEditor({ resource, onChange }: EditorPanelProps) {
  const content = resource.contentFiles['content.md'] || '';

  return (
    <div className="space-y-5 p-5 border rounded-lg">
      <h3 className="text-sm font-semibold text-muted-foreground">
        提示词模板特有字段
      </h3>

      {/* 提示词内容 */}
      <div className="space-y-2">
        <label className="font-medium">提示词内容 (Markdown)</label>
        <textarea
          value={content}
          onChange={(e) => onChange({ contentFiles: { 'content.md': e.target.value } })}
          rows={16}
          className="w-full rounded-md border border-input bg-white px-3 py-2 outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
          placeholder="请输入提示词模板内容..."
        />
      </div>

      {/* i18n */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="font-medium">英文名称</label>
          <input
            type="text"
            value={(resource.manifest.i18n?.en?.name as string) || ''}
            onChange={(e) => {
              const i18n = resource.manifest.i18n || {};
              const en = i18n.en || {};
              onChange({ manifest: { i18n: { ...i18n, en: { ...en, name: e.target.value } } } });
            }}
            className="w-full h-10 rounded-md border border-input bg-white px-3 outline-none focus:ring-1 focus:ring-ring"
            placeholder="English name"
          />
        </div>
        <div className="space-y-2">
          <label className="font-medium">英文描述</label>
          <input
            type="text"
            value={(resource.manifest.i18n?.en?.description as string) || ''}
            onChange={(e) => {
              const i18n = resource.manifest.i18n || {};
              const en = i18n.en || {};
              onChange({ manifest: { i18n: { ...i18n, en: { ...en, description: e.target.value } } } });
            }}
            className="w-full h-10 rounded-md border border-input bg-white px-3 outline-none focus:ring-1 focus:ring-ring"
            placeholder="English description"
          />
        </div>
      </div>
    </div>
  );
}
