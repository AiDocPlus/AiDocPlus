import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const mod = isMac ? '⌘' : 'Ctrl';

const shortcuts = [
  { category: '文件', items: [
    { keys: `${mod}+N`, desc: '新建文档' },
    { keys: `${mod}+Shift+N`, desc: '新建项目' },
    { keys: `${mod}+S`, desc: '保存' },
    { keys: `${mod}+Shift+S`, desc: '全部保存' },
    { keys: `${mod}+I`, desc: '导入文件' },
    { keys: `${mod}+W`, desc: '关闭文档' },
  ]},
  { category: '编辑', items: [
    { keys: `${mod}+Z`, desc: '撤销' },
    { keys: `${mod}+Shift+Z`, desc: '重做' },
    { keys: `${mod}+X`, desc: '剪切' },
    { keys: `${mod}+C`, desc: '复制' },
    { keys: `${mod}+V`, desc: '粘贴' },
    { keys: `${mod}+A`, desc: '全选' },
    { keys: `${mod}+F`, desc: '查找' },
  ]},
  { category: '视图', items: [
    { keys: `${mod}+B`, desc: '切换侧边栏' },
    { keys: `${mod}+J`, desc: '切换 AI 助手' },
    { keys: `${mod}+L`, desc: '切换布局' },
    { keys: `${mod}+H`, desc: '版本历史' },
  ]},
  { category: '标签页', items: [
    { keys: `${mod}+Tab`, desc: '下一个标签' },
    { keys: `${mod}+Shift+Tab`, desc: '上一个标签' },
    { keys: `${mod}+1~9`, desc: '切换到指定标签' },
  ]},
];

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>快捷键参考</DialogTitle>
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
