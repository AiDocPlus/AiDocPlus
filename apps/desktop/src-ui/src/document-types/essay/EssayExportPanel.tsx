/**
 * EssayExportPanel.tsx — 散文导出与快照面板
 *
 * Phase 7: 导出与快照
 * - 多格式导出（Word/PDF/HTML/Markdown/纯文本）
 * - 快照管理（创建/恢复/比较）
 * - 导出设置（样式/元数据/水印）
 * - 批量导出
 * - 分享链接
 */

import { useState } from 'react';
import {
  Download, FileText, File, Globe, Code,
  Camera, RotateCcw, Share2,
  X, Loader2, Copy, Link,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { EssayDocumentContent } from './types';

interface ExportSettings {
  format: 'word' | 'pdf' | 'html' | 'markdown' | 'txt';
  includeMetadata: boolean;
  includeAnalysis: boolean;
  includeWatermark: boolean;
  watermarkText?: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  pageMargin: number;
}

interface EssayExportPanelProps {
  essay: EssayDocumentContent;
  onCreateSnapshot: (title: string) => Promise<void>;
  onRestoreSnapshot: (snapshotId: string) => Promise<void>;
  onDeleteSnapshot: (snapshotId: string) => Promise<void>;
  onExportDocument: (format: string, settings: ExportSettings) => Promise<void>;
  onShareDocument: (options: { type: string; expiresIn?: number }) => Promise<string>;
}

export default function EssayExportPanel({
  essay,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onExportDocument,
  onShareDocument,
}: EssayExportPanelProps) {
  const [activeTab, setActiveTab] = useState<'export' | 'snapshot' | 'share'>('export');
  const snapshots = essay.snapshots;
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'word',
    includeMetadata: true,
    includeAnalysis: false,
    includeWatermark: false,
    watermarkText: '',
    fontSize: 16,
    fontFamily: '宋体',
    lineHeight: 1.8,
    pageMargin: 2,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [shareLink, setShareLink] = useState('');
  const [shareExpiry, setShareExpiry] = useState(24); // 小时
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false);
  const [newSnapshotTitle, setNewSnapshotTitle] = useState('');
  const [newSnapshotDescription, setNewSnapshotDescription] = useState('');
  const [newSnapshotTags, setNewSnapshotTags] = useState('');

  // 导出格式选项
  const exportFormats = [
    { value: 'word', label: 'Word 文档', icon: <FileText className="h-4 w-4" />, ext: '.docx' },
    { value: 'pdf', label: 'PDF 文档', icon: <File className="h-4 w-4" />, ext: '.pdf' },
    { value: 'html', label: 'HTML 网页', icon: <Globe className="h-4 w-4" />, ext: '.html' },
    { value: 'markdown', label: 'Markdown', icon: <Code className="h-4 w-4" />, ext: '.md' },
    { value: 'txt', label: '纯文本', icon: <FileText className="h-4 w-4" />, ext: '.txt' },
  ];

  // 字体选项
  const fontFamilies = [
    { value: '宋体', label: '宋体' },
    { value: '黑体', label: '黑体' },
    { value: '楷体', label: '楷体' },
    { value: '微软雅黑', label: '微软雅黑' },
    { value: 'Times New Roman', label: 'Times New Roman' },
  ];


  // 处理导出
  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    try {
      // 模拟导出进度
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 200);

      await onExportDocument(exportSettings.format, exportSettings);
      
      clearInterval(progressInterval);
      setExportProgress(100);
      
      setTimeout(() => {
        setIsExporting(false);
        setExportProgress(0);
      }, 500);
    } catch (error) {
      console.error('导出失败:', error);
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // 创建快照
  const handleCreateSnapshot = async () => {
    if (!newSnapshotTitle.trim()) return;
    await onCreateSnapshot(newSnapshotTitle.trim());
    setShowSnapshotDialog(false);
    setNewSnapshotTitle('');
    setNewSnapshotDescription('');
    setNewSnapshotTags('');
  };

  // 生成分享链接
  const handleGenerateShareLink = async () => {
    try {
      const link = await onShareDocument({
        type: 'readonly',
        expiresIn: shareExpiry,
      });
      setShareLink(link);
    } catch (error) {
      console.error('生成分享链接失败:', error);
    }
  };

  // 复制分享链接
  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
  };

  // 删除快照
  const handleDeleteSnapshot = async (snapshotId: string) => {
    await onDeleteSnapshot(snapshotId);
  };

  // 恢复快照
  const handleRestoreSnapshot = async (snapshotId: string) => {
    await onRestoreSnapshot(snapshotId);
  };

  return (
    <div className="space-y-6">
      {/* 标签切换 */}
      <div className="flex border-b">
        <Button
          variant={activeTab === 'export' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          onClick={() => setActiveTab('export')}
        >
          <Download className="h-4 w-4 mr-2" />
          导出文档
        </Button>
        <Button
          variant={activeTab === 'snapshot' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          onClick={() => setActiveTab('snapshot')}
        >
          <Camera className="h-4 w-4 mr-2" />
          快照管理
        </Button>
        <Button
          variant={activeTab === 'share' ? 'default' : 'ghost'}
          size="sm"
          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
          onClick={() => setActiveTab('share')}
        >
          <Share2 className="h-4 w-4 mr-2" />
          分享链接
        </Button>
      </div>

      {/* 导出面板 */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          {/* 格式选择 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">导出格式</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {exportFormats.map(format => (
                <Button
                  key={format.value}
                  variant={exportSettings.format === format.value ? 'default' : 'outline'}
                  className="h-auto p-3 flex flex-col items-center gap-2"
                  onClick={() => setExportSettings(prev => ({ ...prev, format: format.value as any }))}
                >
                  {format.icon}
                  <span className="text-sm">{format.label}</span>
                  <span className="text-xs text-muted-foreground">{format.ext}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* 导出设置 */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">导出设置</Label>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-metadata" className="text-sm">包含元数据</Label>
                  <Switch
                    id="include-metadata"
                    checked={exportSettings.includeMetadata}
                    onCheckedChange={(checked) => setExportSettings(prev => ({ ...prev, includeMetadata: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-analysis" className="text-sm">包含文学分析</Label>
                  <Switch
                    id="include-analysis"
                    checked={exportSettings.includeAnalysis}
                    onCheckedChange={(checked) => setExportSettings(prev => ({ ...prev, includeAnalysis: checked }))}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label htmlFor="include-watermark" className="text-sm">添加水印</Label>
                  <Switch
                    id="include-watermark"
                    checked={exportSettings.includeWatermark}
                    onCheckedChange={(checked) => setExportSettings(prev => ({ ...prev, includeWatermark: checked }))}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="font-family" className="text-sm">字体</Label>
                  <Select value={exportSettings.fontFamily} onValueChange={(value) => setExportSettings(prev => ({ ...prev, fontFamily: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fontFamilies.map(font => (
                        <SelectItem key={font.value} value={font.value}>
                          {font.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="font-size" className="text-sm">字号</Label>
                  <Select value={exportSettings.fontSize.toString()} onValueChange={(value) => setExportSettings(prev => ({ ...prev, fontSize: parseInt(value) }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">12px</SelectItem>
                      <SelectItem value="14">14px</SelectItem>
                      <SelectItem value="16">16px</SelectItem>
                      <SelectItem value="18">18px</SelectItem>
                      <SelectItem value="20">20px</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {exportSettings.includeWatermark && (
              <div>
                <Label htmlFor="watermark-text" className="text-sm">水印文字</Label>
                <Input
                  id="watermark-text"
                  value={exportSettings.watermarkText}
                  onChange={(e) => setExportSettings(prev => ({ ...prev, watermarkText: e.target.value }))}
                  placeholder="请输入水印文字"
                />
              </div>
            )}
          </div>

          {/* 导出按钮 */}
          <div className="space-y-3">
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  导出中... {exportProgress}%
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  导出文档
                </>
              )}
            </Button>

            {isExporting && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 快照管理面板 */}
      {activeTab === 'snapshot' && (
        <div className="space-y-6">
          {/* 创建快照按钮 */}
          <Dialog open={showSnapshotDialog} onOpenChange={setShowSnapshotDialog}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                创建快照
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建快照</DialogTitle>
                <DialogDescription>
                  为当前文档创建一个快照版本，方便后续恢复和比较。
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="snapshot-title">快照标题</Label>
                  <Input
                    id="snapshot-title"
                    value={newSnapshotTitle}
                    onChange={(e) => setNewSnapshotTitle(e.target.value)}
                    placeholder="请输入快照标题"
                  />
                </div>
                <div>
                  <Label htmlFor="snapshot-description">描述（可选）</Label>
                  <Textarea
                    id="snapshot-description"
                    value={newSnapshotDescription}
                    onChange={(e) => setNewSnapshotDescription(e.target.value)}
                    placeholder="请输入快照描述"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="snapshot-tags">标签（可选）</Label>
                  <Input
                    id="snapshot-tags"
                    value={newSnapshotTags}
                    onChange={(e) => setNewSnapshotTags(e.target.value)}
                    placeholder="请输入标签，用逗号分隔"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowSnapshotDialog(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreateSnapshot} disabled={!newSnapshotTitle.trim()}>
                    创建快照
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* 快照列表 */}
          <div className="space-y-3">
            {snapshots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Camera className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>暂无快照</p>
              </div>
            ) : (
              snapshots.map(snapshot => (
                <div key={snapshot.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{snapshot.label || '未命名快照'}</h4>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(snapshot.createdAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center">
                          <FileText className="h-3 w-3 mr-1" />
                          {snapshot.wordCount} 字
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestoreSnapshot(snapshot.id)}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSnapshot(snapshot.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 分享面板 */}
      {activeTab === 'share' && (
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="share-expiry" className="text-sm">链接有效期</Label>
              <Select value={shareExpiry.toString()} onValueChange={(value) => setShareExpiry(parseInt(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 小时</SelectItem>
                  <SelectItem value="6">6 小时</SelectItem>
                  <SelectItem value="24">24 小时</SelectItem>
                  <SelectItem value="72">3 天</SelectItem>
                  <SelectItem value="168">7 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGenerateShareLink} className="w-full">
              <Link className="h-4 w-4 mr-2" />
              生成分享链接
            </Button>

            {shareLink && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Input value={shareLink} readOnly />
                  <Button variant="outline" size="sm" onClick={handleCopyShareLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>链接将在 {shareExpiry} 小时后过期</p>
                  <p>任何拥有此链接的人都可以查看文档</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
