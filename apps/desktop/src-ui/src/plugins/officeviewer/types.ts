/**
 * Office 预览器插件类型定义
 */

export type SupportedFileType = 'pdf' | 'docx' | 'xlsx' | 'pptx';

export interface OfficeFile {
  id: string;
  name: string;
  path: string;
  type: SupportedFileType;
  size: number;
  lastOpened: number;
}

export interface OfficeViewerStorage {
  recentFiles: OfficeFile[];
  maxRecentFiles: number;
}

export interface ViewerProps {
  fileData: Uint8Array;
  fileName: string;
  onError: (error: string) => void;
}

export interface FileDropZoneProps {
  children: React.ReactNode;
  onFileDrop: (path: string, name: string) => void;
  loading: boolean;
  currentFile: OfficeFile | null;
  recentFiles: OfficeFile[];
  onLoadRecent: (path: string, name: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}
