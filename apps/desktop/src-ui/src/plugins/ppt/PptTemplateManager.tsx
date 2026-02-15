import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../_framework/ui';
import { usePluginHost } from '../_framework/PluginHostAPI';
import type { PptPromptTemplate } from './slideAiPrompts';
import {
  getAllPptTemplates,
  savePptTemplate,
  deletePptTemplate,
} from './slideAiPrompts';

interface PptTemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplatesChanged: () => void;
}

type EditingTemplate = {
  id: string;
  name: string;
  description: string;
  defaultTopic: string;
  suggestedSlideCount: string;
  promptTemplate: string;
  builtin: boolean;
  isNew: boolean;
};

function emptyTemplate(): EditingTemplate {
  return {
    id: `custom-${Date.now()}`,
    name: '',
    description: '',
    defaultTopic: '',
    suggestedSlideCount: '10',
    promptTemplate: '',
    builtin: false,
    isNew: true,
  };
}

function toEditing(tpl: PptPromptTemplate): EditingTemplate {
  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    defaultTopic: tpl.defaultTopic,
    suggestedSlideCount: String(tpl.suggestedSlideCount),
    promptTemplate: tpl.promptTemplate || '',
    builtin: !!tpl.builtin,
    isNew: false,
  };
}

export function PptTemplateManager({ open, onOpenChange, onTemplatesChanged }: PptTemplateManagerProps) {
  const host = usePluginHost();
  const t = host.platform.t;
  const [templates, setTemplates] = useState<PptPromptTemplate[]>([]);
  const [editing, setEditing] = useState<EditingTemplate | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // 加载模板列表
  useEffect(() => {
    if (open) {
      setTemplates(getAllPptTemplates());
      setEditing(null);
      setDeleteConfirmId(null);
    }
  }, [open]);

  const refreshTemplates = () => {
    setTemplates(getAllPptTemplates());
    onTemplatesChanged();
  };

  const handleSave = () => {
    if (!editing || !editing.name.trim()) return;

    const tpl: PptPromptTemplate = {
      id: editing.isNew && editing.builtin
        ? `custom-${Date.now()}`  // 内置模板另存为新模板
        : editing.id,
      name: editing.name.trim(),
      description: editing.description.trim(),
      defaultTopic: editing.defaultTopic.trim(),
      suggestedSlideCount: parseInt(editing.suggestedSlideCount, 10) || 10,
      promptTemplate: editing.promptTemplate.trim() || undefined,
      builtin: false,
    };

    savePptTemplate(tpl);
    refreshTemplates();
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    deletePptTemplate(id);
    refreshTemplates();
    setDeleteConfirmId(null);
    if (editing?.id === id) setEditing(null);
  };

  const handleEditBuiltin = (tpl: PptPromptTemplate) => {
    // 编辑内置模板 → 创建副本
    const ed = toEditing(tpl);
    ed.isNew = true; // 标记为新建（将另存为自定义）
    ed.name = `${tpl.name}（自定义）`;
    setEditing(ed);
  };

  // 分组：内置 vs 自定义
  const builtinTemplates = templates.filter(t => t.builtin);
  const customTemplates = templates.filter(t => !t.builtin);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('slides.templateManagerTitle', { defaultValue: 'PPT 提示词模板管理' })}</DialogTitle>
          <DialogDescription>
            {t('slides.templateManagerDesc', { defaultValue: '管理内置和自定义的 PPT 提示词模板。内置模板可复制为自定义模板后编辑。' })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {editing ? (
            /* ── 编辑/新建表单 ── */
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {editing.isNew
                    ? t('slides.templateNew', { defaultValue: '新建模板' })
                    : t('slides.templateEdit', { defaultValue: '编辑模板' })}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setEditing(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">{t('slides.templateName', { defaultValue: '模板名称' })}</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="例如：技术分享"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t('slides.templateTopic', { defaultValue: '默认主题' })}</Label>
                  <Input
                    value={editing.defaultTopic}
                    onChange={(e) => setEditing({ ...editing, defaultTopic: e.target.value })}
                    placeholder="例如：微服务架构实践"
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('slides.templateDesc', { defaultValue: '描述' })}</Label>
                <Input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="简要描述模板适用场景"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('slides.templateSlideCount', { defaultValue: '建议页数' })}</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={editing.suggestedSlideCount}
                  onChange={(e) => setEditing({ ...editing, suggestedSlideCount: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-20 h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{t('slides.templatePrompt', { defaultValue: '提示词模板内容（可选，留空则自动生成）' })}</Label>
                <textarea
                  value={editing.promptTemplate}
                  onChange={(e) => setEditing({ ...editing, promptTemplate: e.target.value })}
                  placeholder="自定义提示词模板内容，可使用 {topic} 和 {content} 占位符..."
                  className="w-full min-h-[120px] px-3 py-2 text-sm border rounded-md bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                  style={{ fontFamily: '宋体, system-ui, sans-serif', fontSize: 16 }}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  {t('common.cancel', { defaultValue: '取消' })}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={!editing.name.trim()}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {t('common.save', { defaultValue: '保存' })}
                </Button>
              </div>
            </div>
          ) : (
            /* ── 模板列表 ── */
            <>
              {/* 新建按钮 */}
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed"
                onClick={() => setEditing(emptyTemplate())}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {t('slides.templateAdd', { defaultValue: '新建自定义模板' })}
              </Button>

              {/* 自定义模板 */}
              {customTemplates.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('slides.templateCustom', { defaultValue: '自定义模板' })}（{customTemplates.length}）
                  </span>
                  <div className="space-y-1">
                    {customTemplates.map((tpl) => (
                      <TemplateRow
                        key={tpl.id}
                        template={tpl}
                        onEdit={() => setEditing(toEditing(tpl))}
                        onDelete={() => setDeleteConfirmId(tpl.id)}
                        deleteConfirm={deleteConfirmId === tpl.id}
                        onDeleteConfirm={() => handleDelete(tpl.id)}
                        onDeleteCancel={() => setDeleteConfirmId(null)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 内置模板 */}
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {t('slides.templateBuiltin', { defaultValue: '内置模板' })}（{builtinTemplates.length}）
                </span>
                <div className="space-y-1">
                  {builtinTemplates.map((tpl) => (
                    <TemplateRow
                      key={tpl.id}
                      template={tpl}
                      onEdit={() => handleEditBuiltin(tpl)}
                      isBuiltin
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close', { defaultValue: '关闭' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
  isBuiltin,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel,
}: {
  template: PptPromptTemplate;
  onEdit: () => void;
  onDelete?: () => void;
  isBuiltin?: boolean;
  deleteConfirm?: boolean;
  onDeleteConfirm?: () => void;
  onDeleteCancel?: () => void;
}) {
  const host = usePluginHost();
  const t = host.platform.t;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-md border hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{template.name}</span>
          {isBuiltin && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {t('slides.templateBuiltinBadge', { defaultValue: '内置' })}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {template.suggestedSlideCount} {t('slides.templatePages', { defaultValue: '页' })}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{template.description}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {deleteConfirm ? (
          <>
            <span className="text-xs text-destructive mr-1">{t('slides.templateDeleteConfirm', { defaultValue: '确认删除？' })}</span>
            <Button variant="destructive" size="icon" className="h-7 w-7" onClick={onDeleteConfirm}>
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={onDeleteCancel}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
              title={isBuiltin
                ? t('slides.templateCopyEdit', { defaultValue: '复制为自定义模板' })
                : t('slides.templateEdit', { defaultValue: '编辑模板' })}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {!isBuiltin && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
                title={t('slides.templateDelete', { defaultValue: '删除模板' })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
