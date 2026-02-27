import { useState } from 'react';
import { X } from 'lucide-react';
import { useResourceStore } from '../stores/useResourceStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';

interface BatchDialogProps {
  onBatchEnable: (paths: string[], enabled: boolean) => void;
  onBatchMove: (paths: string[], category: string) => void;
  onClose: () => void;
}

export function BatchDialog({ onBatchEnable, onBatchMove, onClose }: BatchDialogProps) {
  const categories = useResourceStore((s) => s.categories);
  const checkedPaths = useResourceStore((s) => s.checkedPaths);
  const [moveCategory, setMoveCategory] = useState(categories[0]?.key || '');

  const count = checkedPaths.size;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-xl max-h-[80vh] top-[5vh] translate-y-0 overflow-hidden flex flex-col p-0">
        <DialogHeader className="flex-row items-center justify-between px-6 pt-6 pb-4 border-b space-y-0">
          <DialogTitle>批量操作（已选 {count} 项）</DialogTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {count === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              请先在资源列表中勾选要操作的资源
            </div>
          ) : (
            <>
              {/* 批量启用/禁用 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">启用/禁用</label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onBatchEnable(Array.from(checkedPaths), true)}
                  >
                    全部启用
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => onBatchEnable(Array.from(checkedPaths), false)}
                  >
                    全部禁用
                  </Button>
                </div>
              </div>

              {/* 批量移动分类 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">移动到分类</label>
                <div className="flex gap-2">
                  <select
                    value={moveCategory}
                    onChange={(e) => setMoveCategory(e.target.value)}
                    className="flex-1 h-10 rounded-md border border-input bg-background px-3 shadow-sm outline-none focus:ring-1 focus:ring-ring"
                  >
                    {categories.map((cat) => (
                      <option key={cat.key} value={cat.key}>{cat.name}</option>
                    ))}
                  </select>
                  <Button
                    onClick={() => onBatchMove(Array.from(checkedPaths), moveCategory)}
                    disabled={!moveCategory}
                  >
                    移动
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
