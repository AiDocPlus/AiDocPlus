import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

interface CreateCategoryDialogProps {
  onConfirm: (key: string, name: string, icon: string) => void;
  onClose: () => void;
}

export function CreateCategoryDialog({ onConfirm, onClose }: CreateCategoryDialogProps) {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');

  const handleConfirm = () => {
    if (!key.trim() || !name.trim()) return;
    onConfirm(key.trim(), name.trim(), icon.trim());
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl max-h-[80vh] top-[5vh] translate-y-0 overflow-hidden flex flex-col p-0">
        {/* 标题栏 */}
        <DialogHeader className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b space-y-0">
          <DialogTitle>
            {t('common.createCategory', { defaultValue: '新建分类' })}
          </DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        {/* 表单 */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('category.key', { defaultValue: 'Key（英文标识）' })}
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="例如: writing, coding"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('category.name', { defaultValue: '分类名称' })}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="例如: 写作, 编程"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('category.icon', { defaultValue: '图标（Emoji）' })}
            </label>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
              placeholder="📁"
            />
          </div>
        </div>

        {/* 按钮栏 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!key.trim() || !name.trim()}
          >
            {t('common.confirm', { defaultValue: '确定' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
