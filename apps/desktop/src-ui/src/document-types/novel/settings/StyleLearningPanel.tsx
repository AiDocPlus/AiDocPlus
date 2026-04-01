/**
 * StyleLearningPanel — 风格学习面板
 *
 * P0: 风格学习系统的核心 UI
 * - 管理风格语料库（导入/删除）
 * - 分析风格画像
 * - 展示风格画像详情
 */
import { useState } from 'react';
import { Trash2, Upload, Sparkles, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import type { NovelDocumentContent, StyleCorpus, StyleProfile } from '../types';
import { chunkText } from '../styleProfileGenerator';

interface StyleLearningPanelProps {
  novel: NovelDocumentContent;
  projectId: string;
  onNovelChange: (novel: NovelDocumentContent) => void;
  /** AI 分析回调（由调用方实现） */
  onAnalyzeStyle?: (corpusId: string, text: string) => Promise<StyleProfile | null>;
}

export default function StyleLearningPanel({
  novel,
  projectId,
  onNovelChange,
  onAnalyzeStyle,
}: StyleLearningPanelProps) {
  const [corpora, setCorpora] = useState<StyleCorpus[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 加载语料库列表
  const loadCorpora = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await invoke<StyleCorpus[]>('load_style_corpus_list', { projectId });
      setCorpora(list || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useState(() => {
    loadCorpora();
  });

  // 导入文件
  const handleImportFiles = async () => {
    const files = await open({
      multiple: true,
      filters: [{ name: 'Text Files', extensions: ['txt', 'md'] }],
    });
    if (!files) return;

    setLoading(true);
    setError(null);
    try {
      const corpusId = `corpus-${Date.now()}`;
      const corpusName = `语料库 ${corpora.length + 1}`;

      // 创建语料库条目
      const newCorpus: StyleCorpus = {
        id: corpusId,
        name: corpusName,
        sourceType: 'upload',
        files: [],
        totalWords: 0,
        totalChunks: 0,
        importedAt: Date.now(),
      };

      // 读取并保存每个文件
      let totalWords = 0;
      const fileList: { fileName: string; content: string }[] = [];

      for (const filePath of files as string[]) {
        const fileName = filePath.split(/[/\\]/).pop() || 'unknown.txt';
        const content = await invoke<string>('read_file', { path: filePath });
        const wordCount = content.replace(/\s/g, '').length;
        totalWords += wordCount;
        fileList.push({ fileName, content });

        // 保存到后端
        await invoke('save_style_corpus_file', {
          projectId,
          corpusId,
          fileName,
          content,
        });
      }

      // 更新索引
      const updatedCorpora = [...corpora, {
        ...newCorpus,
        files: fileList.map((f, i) => ({
          id: `file-${i}`,
          fileName: f.fileName,
          chunks: [],
          wordCount: f.content.replace(/\s/g, '').length,
          importedAt: Date.now(),
        })),
        totalWords,
      }];

      await invoke('save_style_corpus_list', { projectId, list: updatedCorpora });
      setCorpora(updatedCorpora);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // 分析风格
  const handleAnalyze = async (corpus: StyleCorpus) => {
    if (!onAnalyzeStyle) {
      setError('AI 分析功能未配置');
      return;
    }

    setAnalyzingId(corpus.id);
    setError(null);
    try {
      // 读取所有文件内容
      const files = await invoke<{ fileName: string; content: string }[]>(
        'read_style_corpus_all_files',
        { projectId, corpusId: corpus.id },
      );

      if (!files || files.length === 0) {
        setError('语料库为空');
        return;
      }

      const allText = files.map(f => f.content).join('\n\n');

      // 调用 AI 分析
      const profile = await onAnalyzeStyle(corpus.id, allText);

      if (profile) {
        // 保存风格画像
        await invoke('save_style_profile', {
          projectId,
          corpusId: corpus.id,
          profile,
        });

        // 更新本地状态
        setCorpora(corpora.map(c =>
          c.id === corpus.id ? { ...c, styleProfile: profile, analyzedAt: Date.now() } : c,
        ));

        // 分块并保存索引
        const chunks = chunkText(allText);
        await invoke('save_style_chunks_index', {
          projectId,
          corpusId: corpus.id,
          chunks,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzingId(null);
    }
  };

  // 删除语料库
  const handleDelete = async (corpusId: string) => {
    try {
    await invoke('delete_style_corpus', { projectId, corpusId });
    const updated = corpora.filter(c => c.id !== corpusId);
    await invoke('save_style_corpus_list', { projectId, list: updated });
    setCorpora(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // 激活语料库（设为当前使用的风格）
  const handleActivate = (corpus: StyleCorpus) => {
    if (!corpus.styleProfile) {
      setError('请先分析风格画像');
      return;
    }
    onNovelChange({
      ...novel,
      settings: {
        ...novel.settings,
        styleCorpusIds: [corpus.id],
        activeStyleProfile: corpus.styleProfile,
      },
    });
  };

  // 检查是否已激活
  const isActive = (corpusId: string) => {
    return novel.settings.styleCorpusIds?.includes(corpusId);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-3 px-3 py-2 border-b flex-shrink-0">
        <span className="text-sm font-medium">风格语料库</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">{corpora.length} 个语料库</span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-xs gap-1"
          onClick={handleImportFiles}
          disabled={loading}
        >
          <Upload className="h-3 w-3" />
          导入文件
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-destructive/10 text-destructive text-xs rounded flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
          <button className="ml-auto hover:text-destructive/80" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* 语料库列表 */}
      <div className="flex-1 overflow-auto p-2 space-y-2">
        {loading && corpora.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            加载中...
          </div>
        )}

        {corpora.length === 0 && !loading && (
          <div className="text-center text-xs text-muted-foreground py-8">
            <FileText className="h-8 w-8 mx-auto opacity-20 mb-2" />
            <p>暂无风格语料库</p>
            <p className="text-[10px] mt-1">导入小说文本，AI 将学习其写作风格</p>
          </div>
        )}

        {corpora.map(corpus => (
          <div
            key={corpus.id}
            className={cn(
              'rounded border p-3 space-y-2',
              isActive(corpus.id) && 'ring-1 ring-primary bg-primary/5',
            )}
          >
            {/* 标题行 */}
            <div className="flex items-center gap-2">
              {isActive(corpus.id) && <CheckCircle className="h-4 w-4 text-primary" />}
              <input
                className="flex-1 text-sm bg-transparent border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                value={corpus.name}
                onChange={e => {
                  const updated = corpora.map(c =>
                    c.id === corpus.id ? { ...c, name: e.target.value } : c,
                  );
                  setCorpora(updated);
                  invoke('save_style_corpus_list', { projectId, list: updated });
                }}
                placeholder="语料库名称"
              />
              <span className="text-xs text-muted-foreground">
                {Math.round(corpus.totalWords / 1000)}k 字
              </span>
            </div>

            {/* 文件统计 */}
            <div className="text-xs text-muted-foreground">
              {corpus.files.length} 个文件
              {corpus.analyzedAt && ` | 已分析`}
            </div>

            {/* 风格画像预览 */}
            {corpus.styleProfile && (
              <div className="text-xs bg-muted/50 rounded p-2 space-y-1">
                <div className="font-medium">风格画像</div>
                <div className="text-muted-foreground line-clamp-2">
                  {corpus.styleProfile.summary}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {corpus.styleProfile.sensoryFocus?.slice(0, 3).map(s => (
                    <span key={s} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center gap-2">
              {!corpus.styleProfile && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs gap-1 flex-1"
                  onClick={() => handleAnalyze(corpus)}
                  disabled={analyzingId === corpus.id}
                >
                  {analyzingId === corpus.id ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      分析风格
                    </>
                  )}
                </Button>
              )}
              {!isActive(corpus.id) && corpus.styleProfile && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 text-xs flex-1"
                  onClick={() => handleActivate(corpus)}
                >
                  激活使用
                </Button>
              )}
              {isActive(corpus.id) && (
                <span className="text-xs text-primary flex-1 text-center">当前使用中</span>
              )}
              <button
                className="p-1.5 rounded hover:bg-destructive/10 text-destructive"
                title="删除"
                onClick={() => handleDelete(corpus.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 底部说明 */}
      <div className="px-3 py-2 border-t text-xs text-muted-foreground flex-shrink-0">
        <p>💡 导入你喜欢的作家作品，AI 将学习其写作风格并在续写时模仿。</p>
      </div>
    </div>
  );
}
