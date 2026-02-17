import { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Folder } from 'lucide-react';
import { message } from '@tauri-apps/plugin-dialog';
import { useTranslation } from '@/i18n';

type Mode = 'move' | 'copy';

interface ProjectPickerDialogProps {
  open: boolean;
  mode: Mode;
  onClose: () => void;
}

export function ProjectPickerDialog({ open, mode, onClose }: ProjectPickerDialogProps) {
  const { t } = useTranslation();
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
        await message(t('projectPicker.moveSuccess', { defaultValue: '文档 "{{docTitle}}" 已移动到项目 "{{projectName}}"', docTitle: currentDocument.title, projectName: targetProject?.name }), { title: t('projectPicker.moveSuccessTitle', { defaultValue: '移动成功' }) });
      } else {
        await copyDocumentToProject(currentDocument.id, currentDocument.projectId, selectedProjectId);
        const targetProject = projects.find(p => p.id === selectedProjectId);
        await message(t('projectPicker.copySuccess', { defaultValue: '文档 "{{docTitle}}" 已复制到项目 "{{projectName}}"', docTitle: currentDocument.title, projectName: targetProject?.name }), { title: t('projectPicker.copySuccessTitle', { defaultValue: '复制成功' }) });
      }
      onClose();
    } catch (err) {
      await message(t('projectPicker.operationFailed', { defaultValue: '操作失败: {{error}}', error: String(err) }), { title: t('projectPicker.errorTitle', { defaultValue: '错误' }), kind: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{mode === 'move' ? t('projectPicker.moveTitle', { defaultValue: '移动文档到...' }) : t('projectPicker.copyTitle', { defaultValue: '复制文档到...' })}</DialogTitle>
        </DialogHeader>

        {!currentDocument ? (
          <p className="text-sm text-muted-foreground py-4">{t('projectPicker.noDocument', { defaultValue: '请先打开一个文档' })}</p>
        ) : otherProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('projectPicker.noProjects', { defaultValue: '没有其他项目可选，请先创建新项目' })}</p>
        ) : (
          <>
            <div className="text-sm text-muted-foreground mb-2">
              {mode === 'move'
                ? t('projectPicker.moveDesc', { defaultValue: '将 "{{title}}" 移动到：', title: currentDocument.title })
                : t('projectPicker.copyDesc', { defaultValue: '复制 "{{title}}" 到：', title: currentDocument.title })}
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
            {t('projectPicker.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedProjectId || isProcessing}
          >
            {isProcessing ? t('projectPicker.processing', { defaultValue: '处理中...' }) : (mode === 'move' ? t('projectPicker.move', { defaultValue: '移动' }) : t('projectPicker.copy', { defaultValue: '复制' }))}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
