import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { useTranslation } from '@/i18n';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const mod = isMac ? '⌘' : 'Ctrl';

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const { t } = useTranslation();

  const shortcuts = useMemo(() => [
    { category: t('shortcuts.catFile', { defaultValue: '文件' }), items: [
      { keys: `${mod}+N`, desc: t('shortcuts.newDocument', { defaultValue: '新建文档' }) },
      { keys: `${mod}+Shift+N`, desc: t('shortcuts.newProject', { defaultValue: '新建项目' }) },
      { keys: `${mod}+S`, desc: t('shortcuts.save', { defaultValue: '保存' }) },
      { keys: `${mod}+Shift+S`, desc: t('shortcuts.saveAll', { defaultValue: '全部保存' }) },
      { keys: `${mod}+Shift+T`, desc: t('shortcuts.newFromTemplate', { defaultValue: '从模板新建' }) },
      { keys: `${mod}+I`, desc: t('shortcuts.importFile', { defaultValue: '导入文件' }) },
      { keys: `${mod}+W`, desc: t('shortcuts.closeDocument', { defaultValue: '关闭文档' }) },
    ]},
    { category: t('shortcuts.catEdit', { defaultValue: '编辑' }), items: [
      { keys: `${mod}+Z`, desc: t('shortcuts.undo', { defaultValue: '撤销' }) },
      { keys: `${mod}+Shift+Z`, desc: t('shortcuts.redo', { defaultValue: '重做' }) },
      { keys: `${mod}+X`, desc: t('shortcuts.cut', { defaultValue: '剪切' }) },
      { keys: `${mod}+C`, desc: t('shortcuts.copy', { defaultValue: '复制' }) },
      { keys: `${mod}+V`, desc: t('shortcuts.paste', { defaultValue: '粘贴' }) },
      { keys: `${mod}+A`, desc: t('shortcuts.selectAll', { defaultValue: '全选' }) },
      { keys: `${mod}+F`, desc: t('shortcuts.find', { defaultValue: '查找' }) },
    ]},
    { category: t('shortcuts.catView', { defaultValue: '视图' }), items: [
      { keys: `${mod}+B`, desc: t('shortcuts.toggleSidebar', { defaultValue: '切换侧边栏' }) },
      { keys: `${mod}+J`, desc: t('shortcuts.toggleChat', { defaultValue: '切换 AI 助手' }) },
      { keys: `${mod}+L`, desc: t('shortcuts.toggleLayout', { defaultValue: '切换布局' }) },
      { keys: `${mod}+H`, desc: t('shortcuts.versionHistory', { defaultValue: '版本历史' }) },
    ]},
    { category: t('shortcuts.catTabs', { defaultValue: '标签页' }), items: [
      { keys: `${mod}+Tab`, desc: t('shortcuts.nextTab', { defaultValue: '下一个标签' }) },
      { keys: `${mod}+Shift+Tab`, desc: t('shortcuts.prevTab', { defaultValue: '上一个标签' }) },
      { keys: `${mod}+1~9`, desc: t('shortcuts.switchToTab', { defaultValue: '切换到指定标签' }) },
    ]},
  ], [t]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('shortcuts.reference', { defaultValue: '快捷键参考' })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {shortcuts.map(group => (
            <div key={group.category}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.category}</h3>
              <div className="space-y-1">
                {group.items.map(item => (
                  <div key={item.keys} className="flex items-center justify-between py-1 px-2 rounded hover:bg-accent text-sm">
                    <span>{item.desc}</span>
                    <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{item.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
