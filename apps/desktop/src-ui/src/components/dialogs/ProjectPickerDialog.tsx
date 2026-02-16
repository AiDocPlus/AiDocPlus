import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Folder } from 'lucide-react';
import { message } from '@tauri-apps/plugin-dialog';

type Mode = 'move' | 'copy';

interface ProjectPickerDialogProps {
  open: boolean;
  mode: Mode;
  onClose: () => void;
}

export function ProjectPickerDialog({ open, mode, onClose }: ProjectPickerDialogProps) {
  const { projects, currentDocument, moveDocumentToProject, copyDocumentToProject } = useAppStore();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // 过滤掉当前项目
  const otherProjects = projects.filter(p => p.id !== currentDocument?.projectId);

  useEffect(() => {
    if (open) {
      setSelectedProjectId(null);
      setIsProcessing(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!selectedProjectId || !currentDocument) return;

    setIsProcessing(true);
    try {
      if (mode === 'move') {
        await moveDocumentToProject(currentDocument.id, currentDocument.projectId, selectedProjectId);
        const targetProject = projects.find(p => p.id === selectedProjectId);
        await message(`文档 "${currentDocument.title}" 已移动到项目 "${targetProject?.name}"`, { title: '移动成功' });
      } else {
        await copyDocumentToProject(currentDocument.id, currentDocument.projectId, selectedProjectId);
        const targetProject = projects.find(p => p.id === selectedProjectId);
        await message(`文档 "${currentDocument.title}" 已复制到项目 "${targetProject?.name}"`, { title: '复制成功' });
      }
      onClose();
    } catch (err) {
      await message(`操作失败: ${err}`, { title: '错误', kind: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{mode === 'move' ? '移动文档到...' : '复制文档到...'}</DialogTitle>
        </DialogHeader>

        {!currentDocument ? (
          <p className="text-sm text-muted-foreground py-4">请先打开一个文档</p>
        ) : otherProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">没有其他项目可选，请先创建新项目</p>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              {mode === 'move' ? '将' : '复制'} "<span className="font-medium text-foreground">{currentDocument.title}</span>" {mode === 'move' ? '移动' : '复制'}到：
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {otherProjects.map(project => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors ${
                    selectedProjectId === project.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  <Folder className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{project.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedProjectId || isProcessing}
          >
            {isProcessing ? '处理中...' : (mode === 'move' ? '移动' : '复制')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
