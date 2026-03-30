/**
 * 导入对话框
 *
 * 支持从多种格式导入大纲：Markdown、OPML、JSON、缩进文本
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText,
  FileCode,
  FileJson,
  Upload,
  Check,
  ClipboardPaste,
  FolderOpen,
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

import type { OutlineNode } from '../types';
import { parseClipboardOutlineText, parseOutlineImport } from '../converters/importParsers';

type ImportFormat = 'markdown' | 'opml' | 'json' | 'indented';

export type ImportStrategy = 'append-root' | 'replace-outline' | 'insert-children';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeNodeId?: string | null;
  onImport: (nodes: OutlineNode[], strategy: ImportStrategy) => void;
}

export function ImportDialog({ isOpen, onClose, onImport, activeNodeId }: ImportDialogProps) {
  const { t } = useTranslation();
  const [format, setFormat] = useState<ImportFormat>('markdown');
  const [strategy, setStrategy] = useState<ImportStrategy>('append-root');
  const [inputText, setInputText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 格式选项
  const formatOptions = useMemo(
    () => [
      {
        value: 'markdown',
        label: t('outline.import.markdown', { defaultValue: 'Markdown' }),
        description: t('outline.import.markdownDesc', {
          defaultValue: '支持标题、列表、缩进层级',
        }),
        icon: FileText,
      },
      {
        value: 'opml',
        label: t('outline.import.opml', { defaultValue: 'OPML' }),
        description: t('outline.import.opmlDesc', {
          defaultValue: '标准大纲格式，来自其他大纲软件',
        }),
        icon: FileCode,
      },
      {
        value: 'json',
        label: t('outline.import.json', { defaultValue: 'JSON' }),
        description: t('outline.import.jsonDesc', {
          defaultValue: '之前导出的 JSON 数据',
        }),
        icon: FileJson,
      },
      {
        value: 'indented',
        label: t('outline.import.indented', { defaultValue: '缩进文本' }),
        description: t('outline.import.indentedDesc', {
          defaultValue: '使用 Tab 或空格缩进的文本',
        }),
        icon: FileText,
      },
    ],
    [t]
  );

  // 执行导入
  const handleImport = useCallback(() => {
    setIsImporting(true);
    setError(null);

    try {
      if (strategy === 'insert-children' && !activeNodeId) {
        setError(t('outline.import.needActiveNode', { defaultValue: '“插入为当前节点子节点”需要先激活一个节点' }));
        setIsImporting(false);
        return;
      }

      const result = parseOutlineImport(format, inputText);
      if (result.error) {
        setError(result.error);
        setIsImporting(false);
        return;
      }
      const nodes = result.nodes;

      if (nodes.length === 0) {
        setError(t('outline.import.noData', { defaultValue: '未能解析出有效数据' }));
        setIsImporting(false);
        return;
      }

      onImport(nodes, strategy);
      setImportSuccess(true);
      setTimeout(() => {
        onClose();
        setInputText('');
        setImportSuccess(false);
      }, 1000);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : t('outline.import.parseError', { defaultValue: '解析失败，请检查格式' });
      setError(msg);
    } finally {
      setIsImporting(false);
    }
  }, [format, inputText, onImport, onClose, t, strategy, activeNodeId]);

  // 从文件导入
  const handleFileImport = useCallback(async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          {
            name: 'Documents',
            extensions: ['md', 'txt', 'opml', 'json'],
          },
        ],
      });

      if (filePath && typeof filePath === 'string') {
        const text = await invoke<string>('read_file', { path: filePath });
        setInputText(text);

        // 根据文件扩展名自动选择格式
        if (filePath.endsWith('.opml')) {
          setFormat('opml');
        } else if (filePath.endsWith('.json')) {
          setFormat('json');
        } else {
          setFormat('markdown');
        }
      }
    } catch (err) {
      console.error('File import failed:', err);
    }
  }, []);

  // 从剪贴板粘贴
  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputText(text);
      const parsed = parseClipboardOutlineText(text);
      if (!parsed.error) {
        setFormat(parsed.format === 'ai-response' ? 'markdown' : parsed.format);
      }
    } catch (err) {
      console.error('Paste failed:', err);
    }
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t('outline.import.title', { defaultValue: '导入大纲' })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 格式选择 */}
          <RadioGroup
            value={format}
            onValueChange={(value) => setFormat(value as ImportFormat)}
            className="grid grid-cols-2 gap-2"
          >
            {formatOptions.map((fmt) => (
              <Label
                key={fmt.value}
                htmlFor={fmt.value}
                className="flex items-start gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has(:checked)]:bg-accent"
              >
                <RadioGroupItem value={fmt.value} id={fmt.value} className="mt-1" />
                <fmt.icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{fmt.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmt.description}
                  </div>
                </div>
              </Label>
            ))}
          </RadioGroup>

          {/* 导入策略 */}
          <div className="space-y-2">
            <Label>{t('outline.import.strategy', { defaultValue: '导入方式' })}</Label>
            <RadioGroup
              value={strategy}
              onValueChange={(v) => setStrategy(v as ImportStrategy)}
              className="grid grid-cols-3 gap-2"
            >
              <Label
                htmlFor="import-strategy-append"
                className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has(:checked)]:bg-accent"
              >
                <RadioGroupItem value="append-root" id="import-strategy-append" />
                <span className="text-sm">
                  {t('outline.import.strategy.append', { defaultValue: '追加到根节点' })}
                </span>
              </Label>
              <Label
                htmlFor="import-strategy-replace"
                className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has(:checked)]:bg-accent"
              >
                <RadioGroupItem value="replace-outline" id="import-strategy-replace" />
                <span className="text-sm">
                  {t('outline.import.strategy.replace', { defaultValue: '替换当前大纲' })}
                </span>
              </Label>
              <Label
                htmlFor="import-strategy-insert"
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors [&:has(:checked)]:bg-accent',
                  !activeNodeId && 'opacity-50 cursor-not-allowed'
                )}
              >
                <RadioGroupItem
                  value="insert-children"
                  id="import-strategy-insert"
                  disabled={!activeNodeId}
                />
                <span className="text-sm">
                  {t('outline.import.strategy.insert', { defaultValue: '插入为当前节点子节点' })}
                </span>
              </Label>
            </RadioGroup>
          </div>

          {/* 输入区域 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                {t('outline.import.content', { defaultValue: '内容' })}
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFileImport}
                  className="h-7 text-xs"
                >
                  <FolderOpen className="h-3.5 w-3.5 mr-1" />
                  {t('outline.import.fromFile', { defaultValue: '从文件' })}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePaste}
                  className="h-7 text-xs"
                >
                  <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                  {t('outline.import.paste', { defaultValue: '粘贴' })}
                </Button>
              </div>
            </div>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('outline.import.placeholder', {
                defaultValue:
                  '在此粘贴或输入内容，或点击上方按钮从文件导入...',
              })}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel', { defaultValue: '取消' })}
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || !inputText.trim()}
          >
            {isImporting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {t('outline.import.importing', { defaultValue: '导入中...' })}
              </>
            ) : importSuccess ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                {t('outline.import.success', { defaultValue: '导入成功' })}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {t('outline.import.import', { defaultValue: '导入' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportDialog;
