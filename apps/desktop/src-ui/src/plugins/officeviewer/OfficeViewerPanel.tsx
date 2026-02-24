import { useState, useCallback } from 'react';
import type { PluginPanelProps } from '../types';
import { usePluginHost } from '../_framework/PluginHostAPI';
import { ToolPluginLayout } from '../_framework/ToolPluginLayout';
import { Button } from '../_framework/ui';
import { FileSearch, Upload, Trash2 } from 'lucide-react';
import { PdfViewer } from './components/PdfViewer';
import { DocxViewer } from './components/DocxViewer';
import { XlsxViewer } from './components/XlsxViewer';
import { PptxViewer } from './components/PptxViewer';
import { FileDropZone } from './components/FileDropZone';
import type { OfficeFile, OfficeViewerStorage, SupportedFileType } from './types';

export function OfficeViewerPanel(_props: PluginPanelProps) {
  const host = usePluginHost();
  const t = host.platform.t;

  // 从存储恢复数据
  const storage = host.storage.get<OfficeViewerStorage>('officeData') || {
    recentFiles: [],
    maxRecentFiles: 20,
  };

  const [currentFile, setCurrentFile] = useState<OfficeFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusIsError, setStatusIsError] = useState(false);

  // 从文件扩展名推断类型
  const inferFileType = (fileName: string): SupportedFileType | null => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'pdf';
      case 'docx': return 'docx';
      case 'xlsx':
      case 'xls': return 'xlsx';
      case 'pptx':
      case 'ppt': return 'pptx';
      default: return null;
    }
  };

  // 加载文件（仅创建文件元信息，不读取数据）
  const loadFile = useCallback(async (filePath: string, fileName: string) => {
    const fileType = inferFileType(fileName);
    if (!fileType) {
      setStatusMsg(t('unsupportedFormat'));
      setStatusIsError(true);
      return;
    }

    setLoading(true);
    setStatusMsg(null);

    try {
      const newFile: OfficeFile = {
        id: `file_${Date.now()}`,
        name: fileName,
        path: filePath,
        type: fileType,
        size: 0, // 稍后由预览器获取
        lastOpened: Date.now(),
      };

      setCurrentFile(newFile);
      setStatusMsg(t('fileLoaded', { name: fileName }));
      setStatusIsError(false);

      // 更新最近文件列表
      updateRecentFiles(newFile);
    } catch (err) {
      setStatusMsg(`${t('loadFailed')}: ${err instanceof Error ? err.message : String(err)}`);
      setStatusIsError(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 更新最近文件列表
  const updateRecentFiles = useCallback((newFile: OfficeFile) => {
    const current = host.storage.get<OfficeViewerStorage>('officeData') || { recentFiles: [], maxRecentFiles: 20 };
    const filtered = current.recentFiles.filter(f => f.path !== newFile.path);
    const updated = [newFile, ...filtered].slice(0, current.maxRecentFiles);
    host.storage.set('officeData', { ...current, recentFiles: updated });
  }, [host.storage]);

  // 打开文件对话框
  const handleOpenFile = useCallback(async () => {
    const filePath = await host.ui.showOpenDialog({
      filters: [
        { name: 'Office 文档', extensions: ['pdf', 'docx', 'xlsx', 'xls', 'pptx', 'ppt'] },
        { name: 'PDF 文件', extensions: ['pdf'] },
        { name: 'Word 文档', extensions: ['docx'] },
        { name: 'Excel 表格', extensions: ['xlsx', 'xls'] },
        { name: 'PowerPoint', extensions: ['pptx', 'ppt'] },
      ],
    });
    if (filePath) {
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'file';
      await loadFile(filePath, fileName);
    }
  }, [host.ui, loadFile]);

  // 清除当前文件
  const handleClear = useCallback(() => {
    setCurrentFile(null);
    setStatusMsg(null);
  }, []);

  // 错误处理回调
  const handleError = useCallback((error: string) => {
    setStatusMsg(error);
    setStatusIsError(true);
  }, []);

  // 渲染预览组件
  const renderViewer = () => {
    if (!currentFile) return null;

    const viewerProps = {
      filePath: currentFile.path,
      fileName: currentFile.name,
      onError: handleError,
    };

    switch (currentFile.type) {
      case 'pdf':
        return <PdfViewer {...viewerProps} />;
      case 'docx':
        return <DocxViewer {...viewerProps} />;
      case 'xlsx':
        return <XlsxViewer {...viewerProps} />;
      case 'pptx':
        return <PptxViewer {...viewerProps} />;
      default:
        return <div className="p-4 text-center text-muted-foreground">{t('unsupportedFormat')}</div>;
    }
  };

  return (
    <ToolPluginLayout
      pluginIcon={<FileSearch className="h-12 w-12 text-muted-foreground/50" />}
      pluginTitle={t('title')}
      pluginDesc={t('description')}
      onImportContent={() => { /* 功能执行类不需要实现 */ }}
      hasContent={true}
      statusMsg={statusMsg}
      statusIsError={statusIsError}
      extraToolbar={
        <>
          <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={handleOpenFile}>
            <Upload className="h-3 w-3" />
            {t('openFile')}
          </Button>
          {currentFile && (
            <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-destructive" onClick={handleClear}>
              <Trash2 className="h-3 w-3" />
              {t('clear')}
            </Button>
          )}
        </>
      }
    >
      <FileDropZone
        onFileDrop={loadFile}
        loading={loading}
        currentFile={currentFile}
        recentFiles={storage.recentFiles}
        onLoadRecent={loadFile}
        t={t}
      >
        {renderViewer()}
      </FileDropZone>
    </ToolPluginLayout>
  );
}
