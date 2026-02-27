import { useTranslation } from 'react-i18next';
import type { ResourceItem, ResourceChanges } from '@aidocplus/manager-shared';

interface CommonFieldsEditorProps {
  resource: ResourceItem;
  onChange: (changes: ResourceChanges) => void;
}

export function CommonFieldsEditor({ resource, onChange }: CommonFieldsEditorProps) {
  const { t } = useTranslation();
  const m = resource.manifest;

  const updateField = (key: string, value: unknown) => {
    onChange({
      manifest: { [key]: value } as Partial<typeof m>,
    });
  };

  return (
    <div className="space-y-5 p-5 border rounded-lg">
      <h3 className="text-sm font-semibold text-muted-foreground">
        {t('resource.basicInfo', { defaultValue: '基本信息' })}
      </h3>

      <div className="grid grid-cols-2 gap-4">
        {/* 名称 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t('resource.name', { defaultValue: '名称' })}
          </label>
          <input
            type="text"
            value={m.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* ID */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t('resource.id', { defaultValue: 'ID' })}
          </label>
          <input
            type="text"
            value={m.id}
            disabled
            className="w-full h-9 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground font-mono"
          />
        </div>
      </div>

      {/* 描述 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {t('resource.description', { defaultValue: '描述' })}
        </label>
        <input
          type="text"
          value={m.description}
          onChange={(e) => updateField('description', e.target.value)}
          className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* 图标 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t('resource.icon', { defaultValue: '图标' })}
          </label>
          <input
            type="text"
            value={m.icon}
            onChange={(e) => updateField('icon', e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* 排序 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t('resource.order', { defaultValue: '排序' })}
          </label>
          <input
            type="number"
            value={m.order}
            onChange={(e) => updateField('order', parseInt(e.target.value) || 0)}
            className="w-full h-9 rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* 启用 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            {t('common.enabled', { defaultValue: '启用' })}
          </label>
          <div className="flex items-center h-9">
            <button
              onClick={() => updateField('enabled', !m.enabled)}
              className={`w-11 h-6 rounded-full transition-colors ${
                m.enabled ? 'bg-primary' : 'bg-input'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  m.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
            <span className="ml-2 text-sm text-muted-foreground">
              {m.enabled ? t('common.on', { defaultValue: '开' }) : t('common.off', { defaultValue: '关' })}
            </span>
          </div>
        </div>
      </div>

      {/* 标签 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">
          {t('resource.tags', { defaultValue: '标签' })}
        </label>
        <div className="flex flex-wrap gap-1.5 items-center min-h-[36px] p-2 rounded-md border border-input bg-white">
          {m.tags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary text-xs"
            >
              {tag}
              <button
                onClick={() => {
                  const newTags = [...m.tags];
                  newTags.splice(i, 1);
                  updateField('tags', newTags);
                }}
                className="text-muted-foreground hover:text-destructive transition-colors"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            placeholder={t('resource.addTag', { defaultValue: '输入标签后回车' })}
            className="flex-1 min-w-[100px] h-6 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const input = e.currentTarget;
                const val = input.value.trim();
                if (val && !m.tags.includes(val)) {
                  updateField('tags', [...m.tags, val]);
                  input.value = '';
                }
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
