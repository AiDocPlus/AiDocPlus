import { useState, useCallback, type DragEvent } from 'react';
import type { FileDropZoneProps, SupportedFileType } from '../types';
import { Upload, FileText, FileSpreadsheet, FileType, Presentation, Clock, Loader2 } from 'lucide-react';

export function FileDropZone({
  children,
  onFileDrop: _onFileDrop,
  loading,
  currentFile,
  recentFiles,
  onLoadRecent,
  t,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // 注意：浏览器环境下无法直接获取文件完整路径
    // 需要通过 Tauri 的文件对话框来选择文件
  }, []);

  const getFileIcon = (type: SupportedFileType) => {
    switch (type) {
      case 'pdf': return FileType;
      case 'docx': return FileText;
      case 'xlsx': return FileSpreadsheet;
      case 'pptx': return Presentation;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 如果正在加载，显示加载状态
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">{t('rendering')}</p>
        </div>
      </div>
    );
  }

  // 如果有文件正在显示，显示预览内容
  if (currentFile) {
    return <div className="h-full">{children}</div>;
  }

  return (
    <div
      className="h-full flex flex-col"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽区域 */}
      <div
        className={`flex-1 flex items-center justify-center border-2 border-dashed rounded-lg m-4 transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/30 hover:border-muted-foreground/50'
        }`}
      >
        <div className="text-center space-y-4 p-8">
          <Upload className={`h-12 w-12 mx-auto ${isDragging ? 'text-primary' : 'text-muted-foreground/50'}`} />
          <div>
            <p className="text-lg font-medium text-muted-foreground">{t('dropFileHere')}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">{t('supportedFormats')}</p>
          </div>
        </div>
      </div>

      {/* 最近文件 */}
      {recentFiles.length > 0 && (
        <div className="border-t flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('recentFiles')}</span>
          </div>
          <div className="max-h-[200px] overflow-y-auto">
            {recentFiles.slice(0, 5).map(file => {
              const Icon = getFileIcon(file.type);
              return (
                <button
                  key={file.id}
                  onClick={() => onLoadRecent(file.path, file.name)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/50 text-left transition-colors"
                >
                  <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)} · {formatTime(file.lastOpened)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
