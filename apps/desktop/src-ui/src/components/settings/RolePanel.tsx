import { useState } from 'react';
import { Plus, Trash2, Check, Pencil, ChevronDown, ChevronRight } from 'lucide-react';
import { BUILT_IN_ROLES, getAllRoles, getActiveRoleInstance, getInstanceSystemPrompt, getRoleForInstance } from '@aidocplus/shared-types';
import type { RoleSettings, RoleInstance, UserRole } from '@aidocplus/shared-types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';

interface RolePanelProps {
  role: RoleSettings;
  onCreateInstance: (instance: RoleInstance) => void;
  onUpdateInstance: (id: string, updates: Partial<RoleInstance>) => void;
  onDeleteInstance: (id: string) => void;
  onSetActive: (id: string) => void;
  t: (key: string, opts?: { defaultValue?: string }) => string;
}

export function RolePanel({ role, onCreateInstance, onUpdateInstance, onDeleteInstance, onSetActive, t }: RolePanelProps) {
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSystemPrompt, setEditSystemPrompt] = useState('');
  const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null);

  const activeInstance = getActiveRoleInstance(role);
  const allRoles = getAllRoles(role);

  function handleCreateInstance(roleTemplate: UserRole) {
    const instance: RoleInstance = {
      id: crypto.randomUUID(),
      name: roleTemplate.name,
      roleId: roleTemplate.id,
      icon: roleTemplate.icon,
      description: roleTemplate.description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      plugins: [],
      promptTemplateIds: [],
      projectTemplateIds: [],
      docTemplateIds: [],
    };
    onCreateInstance(instance);
    setShowRoleSelector(false);
  }

  function startEdit(instance: RoleInstance) {
    setEditingInstanceId(instance.id);
    setEditName(instance.name);
    setEditSystemPrompt(instance.systemPrompt ?? '');
  }

  function saveEdit(instanceId: string) {
    onUpdateInstance(instanceId, {
      name: editName.trim() || editName,
      systemPrompt: editSystemPrompt.trim() || undefined,
    });
    setEditingInstanceId(null);
  }

  function handleDelete(instanceId: string) {
    const confirmed = window.confirm(t('settings.roleSettings.deleteInstanceConfirm', { defaultValue: '确定删除该角色实例吗？' }));
    if (confirmed) {
      onDeleteInstance(instanceId);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold mb-1">{t('settings.roleSettings.title', { defaultValue: '角色管理' })}</h3>
        <p className="text-sm text-muted-foreground">
          {t('settings.roleSettings.description', { defaultValue: '基于角色模板创建角色实例，激活后 AI 将自动适配该角色的专业知识和写作风格。' })}
        </p>
      </div>

      <Separator />

      {/* 当前激活实例 */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          {t('settings.roleSettings.activeInstance', { defaultValue: '当前激活角色' })}
        </Label>
        {activeInstance ? (
          <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <span className="text-lg">{activeInstance.icon}</span>
            <span className="font-medium">{activeInstance.name}</span>
            <span className="text-muted-foreground text-xs">
              {(() => { const r = getRoleForInstance(activeInstance); return r ? `（${r.name}）` : ''; })()}
            </span>
            <button
              onClick={() => onSetActive('')}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
            >
              {t('settings.roleSettings.deactivate', { defaultValue: '取消激活' })}
            </button>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground p-2 bg-muted/30 rounded-lg">
            {t('settings.roleSettings.noActiveInstance', { defaultValue: '未激活任何角色（使用通用模式）' })}
          </div>
        )}
      </div>

      <Separator />

      {/* 角色实例列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-sm font-medium">
            {t('settings.roleSettings.instances', { defaultValue: '我的角色实例' })}
            {role.instances.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground">({role.instances.length})</span>
            )}
          </Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRoleSelector(!showRoleSelector)}
          >
            <Plus className="w-3 h-3 mr-1" />
            {t('settings.roleSettings.createInstance', { defaultValue: '新建实例' })}
          </Button>
        </div>

        {/* 角色模板选择器 */}
        {showRoleSelector && (
          <div className="mb-4 p-3 border rounded-lg bg-muted/20">
            <p className="text-xs text-muted-foreground mb-3">
              {t('settings.roleSettings.selectTemplate', { defaultValue: '选择角色模板来创建实例：' })}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {allRoles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleCreateInstance(r)}
                  className="text-left p-2 rounded-lg border hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{r.icon}</span>
                    <div>
                      <div className="text-xs font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowRoleSelector(false)}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {t('common.cancel', { defaultValue: '取消' })}
            </button>
          </div>
        )}

        {/* 实例列表 */}
        {role.instances.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            <p className="mb-2">🎭</p>
            <p>{t('settings.roleSettings.noInstances', { defaultValue: '暂无角色实例' })}</p>
            <p className="text-xs mt-1">{t('settings.roleSettings.noInstancesHint', { defaultValue: '点击"新建实例"从角色模板创建' })}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {role.instances.map((instance) => {
              const isActive = role.activeInstanceId === instance.id;
              const isEditing = editingInstanceId === instance.id;
              const isExpanded = expandedInstanceId === instance.id;
              const roleTemplate = getRoleForInstance(instance);
              const effectivePrompt = getInstanceSystemPrompt(instance);

              return (
                <div
                  key={instance.id}
                  className={`border rounded-lg transition-all ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  {/* 实例头部 */}
                  <div className="flex items-center gap-2 p-3">
                    <span className="text-lg">{instance.icon}</span>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="h-6 text-sm py-0 px-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(instance.id);
                            if (e.key === 'Escape') setEditingInstanceId(null);
                          }}
                        />
                      ) : (
                        <div className="font-medium text-sm truncate">{instance.name}</div>
                      )}
                      {roleTemplate && (
                        <div className="text-xs text-muted-foreground">{roleTemplate.icon} {roleTemplate.name}</div>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(instance.id)}
                            className="p-1 hover:bg-primary/10 rounded text-primary"
                            title={t('common.save', { defaultValue: '保存' })}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setEditingInstanceId(null)}
                            className="p-1 hover:bg-muted rounded text-muted-foreground text-xs"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          {!isActive && (
                            <button
                              onClick={() => onSetActive(instance.id)}
                              className="px-2 py-1 text-xs rounded border hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                            >
                              {t('settings.roleSettings.activate', { defaultValue: '激活' })}
                            </button>
                          )}
                          {isActive && (
                            <span className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground">
                              {t('settings.roleSettings.active', { defaultValue: '激活中' })}
                            </span>
                          )}
                          <button
                            onClick={() => startEdit(instance)}
                            className="p-1 hover:bg-muted rounded"
                            title={t('common.edit', { defaultValue: '编辑' })}
                          >
                            <Pencil className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(instance.id)}
                            className="p-1 hover:bg-destructive/10 rounded"
                            title={t('common.delete', { defaultValue: '删除' })}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                          <button
                            onClick={() => setExpandedInstanceId(isExpanded ? null : instance.id)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isExpanded
                              ? <ChevronDown className="w-3 h-3 text-muted-foreground" />
                              : <ChevronRight className="w-3 h-3 text-muted-foreground" />
                            }
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 展开详情 */}
                  {isExpanded && !isEditing && (
                    <div className="px-3 pb-3 border-t pt-3 space-y-3">
                      {/* System Prompt 编辑 */}
                      <div>
                        <Label className="text-xs font-medium mb-1 block">
                          {t('settings.roleSettings.systemPrompt', { defaultValue: 'System Prompt（留空使用角色模板默认值）' })}
                        </Label>
                        <textarea
                          value={editSystemPrompt}
                          onChange={(e) => setEditSystemPrompt(e.target.value)}
                          onFocus={() => { if (editingInstanceId !== instance.id) { setEditingInstanceId(instance.id); setEditName(instance.name); setEditSystemPrompt(instance.systemPrompt ?? ''); } }}
                          placeholder={effectivePrompt || t('settings.roleSettings.promptPlaceholder', { defaultValue: '使用角色模板的默认 System Prompt…' })}
                          className="w-full text-xs font-mono bg-muted/30 border rounded p-2 resize-none h-24 focus:outline-none focus:ring-1 focus:ring-primary"
                          readOnly={editingInstanceId !== instance.id}
                        />
                        {editingInstanceId !== instance.id && effectivePrompt && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono bg-muted/20 p-1 rounded">
                            {effectivePrompt}
                          </p>
                        )}
                      </div>

                      {/* 资源统计 */}
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>🧩 {instance.plugins.length} {t('settings.roleSettings.plugins', { defaultValue: '插件' })}</span>
                        <span>📋 {instance.promptTemplateIds.length} {t('settings.roleSettings.promptTemplates', { defaultValue: '提示词' })}</span>
                        <span>📁 {instance.projectTemplateIds.length} {t('settings.roleSettings.projectTemplates', { defaultValue: '项目模板' })}</span>
                        <span>📄 {instance.docTemplateIds.length} {t('settings.roleSettings.docTemplates', { defaultValue: '文档模板' })}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Separator />

      {/* 内置角色模板预览 */}
      <div>
        <Label className="text-sm font-medium mb-3 block">
          {t('settings.roleSettings.builtinRoles', { defaultValue: '内置角色模板' })}
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            {t('settings.roleSettings.builtinRolesHint', { defaultValue: '（点击"新建实例"从这些模板创建）' })}
          </span>
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {BUILT_IN_ROLES.map((r) => (
            <div
              key={r.id}
              className="p-2 rounded-lg border border-border/50 bg-muted/10"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{r.icon}</span>
                <span className="font-medium text-xs">{r.name}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
