import { useState } from 'react';
import { X } from 'lucide-react';
import { useResourceStore } from '../stores/useResourceStore';
import type { ResourceTypeConfig, ManifestBase } from '@aidocplus/manager-shared';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

interface CreateDialogProps {
  config: ResourceTypeConfig;
  onConfirm: (category: string, id: string, manifest: Record<string, unknown>, contentFiles: Array<{ filename: string; content: string }>) => void;
  onClose: () => void;
}

export function CreateDialog({ config, onConfirm, onClose }: CreateDialogProps) {
  const categories = useResourceStore((s) => s.categories);

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]?.key || '');
  const [icon, setIcon] = useState('📄');

  const handleSubmit = () => {
    if (!id.trim() || !name.trim() || !category) return;

    const now = new Date().toISOString();
    const manifest: Partial<ManifestBase> & Record<string, unknown> = {
      ...config.defaultManifest,
      id: id.trim(),
      name: name.trim(),
      description: description.trim(),
      icon,
      majorCategory: category,
      subCategory: '',
      createdAt: now,
      updatedAt: now,
    };

    const contentFiles = config.contentFiles.map((spec) => ({
      filename: spec.filename,
      content: spec.defaultContent,
    }));

    onConfirm(category, id.trim(), manifest, contentFiles);
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl max-h-[80vh] top-[5vh] translate-y-0 overflow-hidden flex flex-col p-0">
        {/* 标题栏 */}
        <DialogHeader className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b space-y-0">
          <DialogTitle>新建{config.resourceLabel}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* 表单 */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium">ID（英文，用于目录名）</label>
            <input
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
              className="w-full h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="my-resource-id"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="资源名称"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">描述</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="简短描述"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
              >
                {categories.map((cat) => (
                  <option key={cat.key} value={cat.key}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">图标</label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!id.trim() || !name.trim() || !category}
          >
            创建
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
