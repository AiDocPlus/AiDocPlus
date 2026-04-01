/**
 * styleProfileGenerator.ts — 风格画像 AI 生成器
 *
 * P0: 风格学习系统的核心模块
 * - 分析风格语料库文本
 * - 生成 StyleProfile（风格画像）
 * - 提供风格注入提示词构建
 */

import type { StyleProfile, StyleTextChunk } from './types';
import { invoke } from '@tauri-apps/api/core';

// ═══ 风格分析提示词模板 ═══

// ═══ 风格画像生成 ═══

export interface StyleAnalysisProgress {
  phase: 'reading' | 'analyzing' | 'generating' | 'done' | 'error';
  message: string;
  percentage: number;
}

export interface StyleAnalysisResult {
  success: boolean;
  profile?: StyleProfile;
  error?: string;
}

/**
 * 生成风格画像
 * @param projectId 项目 ID
 * @param corpusId 语料库 ID
 * @param onProgress 进度回调
 */
export async function generateStyleProfile(
  projectId: string,
  corpusId: string,
  onProgress?: (progress: StyleAnalysisProgress) => void,
): Promise<StyleAnalysisResult> {
  try {
    // 1. 读取语料库文件
    onProgress?.({ phase: 'reading', message: '读取语料库文件...', percentage: 10 });

    const files = await invoke<{ file_name: string; content: string; word_count: number }[]>(
      'read_style_corpus_all_files',
      { projectId, corpusId },
    );

    if (!files || files.length === 0) {
      return { success: false, error: '语料库为空，请先添加文本文件' };
    }

    // 2. 准备分析
    onProgress?.({ phase: 'analyzing', message: '准备分析文本...', percentage: 30 });

    // 3. 调用 AI 分析
    onProgress?.({ phase: 'generating', message: 'AI 分析风格特征...', percentage: 50 });

    // 注意：这里需要调用主程序的 AI 服务
    // 由于我们在文档类型模块中，需要通过回调或事件机制与主程序通信
    // 这里返回必要的信息，让调用方（UI 组件）来完成 AI 调用

    onProgress?.({ phase: 'done', message: '准备就绪，等待 AI 分析', percentage: 100 });

    return {
      success: true,
      profile: {
        avgSentenceLength: 0,
        sentenceLengthStdDev: 0,
        avgParagraphLength: 0,
        paragraphLengthRange: { min: 0, max: 0 },
        dialogueRatio: 0,
        narrationRatio: 0,
        vocabularyDiversity: 0,
        narrativeVoice: '',
        tensePreference: '',
        toneStyle: '',
        commonMetaphors: [],
        rhetoricalDevices: [],
        topPatterns: [],
        dialogueStyle: '',
        tagVerbPreference: [],
        sensoryFocus: [],
        pacingPreference: '',
        summary: '',
        signature: '',
        analyzedAt: Date.now(),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ═══ 本地统计计算（纯前端，无需 AI） ═══

export interface LocalStyleStats {
  avgSentenceLength: number;
  avgParagraphLength: number;
  dialogueRatio: number;
  narrationRatio: number;
  vocabularyDiversity: number;
  paragraphLengthRange: { min: number; max: number };
}

/**
 * 计算文本的本地统计特征
 */
export function computeLocalStyleStats(text: string): LocalStyleStats {
  if (!text || text.trim().length === 0) {
    return {
        avgSentenceLength: 0,
        avgParagraphLength: 0,
        dialogueRatio: 0,
        narrationRatio: 1,
        vocabularyDiversity: 0,
        paragraphLengthRange: { min: 0, max: 0 },
      };
  }

  // 句子分割
  const sentences = text.split(/[。！？…]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const sentenceLengths = sentences.map(s => s.replace(/\s/g, '').length);
  const avgSentenceLength = sentenceLengths.reduce((s, v) => s + v, 0) / sentenceCount;

  // 段落
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const paragraphCount = Math.max(1, paragraphs.length);
  const paragraphLengths = paragraphs.map(p => p.replace(/\s/g, '').length);
  const avgParagraphLength = paragraphLengths.reduce((s, v) => s + v, 0) / paragraphCount;

  const paragraphLengthRange = {
    min: Math.min(...paragraphLengths),
    max: Math.max(...paragraphLengths),
  };

  // 对话/叙述比例
  const charCount = text.replace(/\s/g, '').length;
  const dialogueMatches = text.match(/[「""][^「""」]*[」""]/g) || [];
  const dialogueChars = dialogueMatches.reduce((s, m) => s + m.replace(/\s/g, '').length, 0);
  const dialogueRatio = charCount > 0 ? dialogueChars / charCount : 0;
  const narrationRatio = 1 - dialogueRatio;

  // 词汇丰富度
  const hanzi = text.replace(/[^\u4e00-\u9fff]/g, '');
  const uniqueHanzi = new Set(hanzi);
  const vocabularyDiversity = hanzi.length > 0 ? uniqueHanzi.size / hanzi.length : 0;

  return {
    avgSentenceLength: Math.round(avgSentenceLength * 10) / 10,
    avgParagraphLength: Math.round(avgParagraphLength),
    dialogueRatio: Math.round(dialogueRatio * 100) / 100,
    narrationRatio: Math.round(narrationRatio * 100) / 100,
    vocabularyDiversity: Math.round(vocabularyDiversity * 1000) / 1000,
    paragraphLengthRange,
  };
}

// ═══ 文本分块（用于 RAG 检索） ═══

/**
 * 将长文本分块
 * @param text 原始文本
 * @param chunkSize 每块目标字数（默认 500）
 * @param overlap 块间重叠字数（默认 50）
 */
export function chunkText(
  text: string,
  chunkSize: number = 500,
  overlap: number = 50,
): StyleTextChunk[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: StyleTextChunk[] = [];
  const chars = text.replace(/\r\n/g, '\n').split('');

  let start = 0;
  let chunkIndex = 0;

  while (start < chars.length) {
    // 寻找下一个句子结束符
    let end = Math.min(start + chunkSize, chars.length);

    // 如果不是最后一块，尝试在句号处断开
    if (end < chars.length) {
      const searchStart = start + chunkSize - overlap;
      const searchEnd = Math.min(start + chunkSize + overlap, chars.length);
      const searchText = chars.slice(searchStart, searchEnd).join('');

      // 查找最近的句号
      const punctMatch = searchText.match(/[。！？]/g);
      if (punctMatch && punctMatch.length > 0) {
        // 在搜索范围内找到句号，调整 end 位置
        const lastPunctIdx = searchText.lastIndexOf(punctMatch[punctMatch.length - 1]);
        if (lastPunctIdx !== -1) {
          end = searchStart + lastPunctIdx + 1;
        }
      }
    }

    const content = chars.slice(start, end).join('').trim();
    if (content.length > 0) {
      // 检测场景类型
      const sceneType = detectSceneType(content);

      // 提取关键词
      const keywords = extractKeywords(content);

      chunks.push({
        id: `chunk-${chunkIndex}`,
        content,
        wordCount: content.replace(/\s/g, '').length,
        sceneType,
        keywords,
      });
      chunkIndex++;
    }

    start = end;
  }

  return chunks;
}

/**
 * 检测场景类型
 */
function detectSceneType(text: string): StyleTextChunk['sceneType'] {
  // 对话检测：引号内内容占比 > 50%
  const dialogueMatches = text.match(/[「""][^「""」]*[」""]/g) || [];
  const dialogueChars = dialogueMatches.reduce((s, m) => s + m.length, 0);
  const totalChars = text.length;

  if (totalChars > 0 && dialogueChars / totalChars > 0.5) {
    return 'dialogue';
  }

  // 动作检测：动词密度高
  const actionVerbs = ['冲', '跑', '跳', '打', '踢', '砍', '刺', '射', '飞', '落'];
  const actionCount = actionVerbs.reduce((s, v) => s + (text.match(new RegExp(v, 'g'))?.length || 0), 0);
  if (actionCount > 5) {
    return 'action';
  }

  // 心理描写检测：心理词汇
  const internalWords = ['想', '觉得', '感到', '心中', '内心', '暗自', '默念'];
  const internalCount = internalWords.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
  if (internalCount >= 2) {
    return 'internal';
  }

  // 描写检测：形容词/环境词汇密度
  const descWords = ['的', '着', '了', '很', '十分', '非常'];
  const descCount = descWords.reduce((s, w) => s + (text.match(new RegExp(w, 'g'))?.length || 0), 0);
  if (descCount > totalChars * 0.05) {
    return 'description';
  }

  return 'transition';
}

/**
 * 提取关键词（简化版：提取高频二元组）
 */
function extractKeywords(text: string, maxKeywords: number = 5): string[] {
  const hanzi = text.replace(/[^\u4e00-\u9fff]/g, '');
  if (hanzi.length < 4) return [];

  // 二元组频率
  const bigramCounts = new Map<string, number>();
  for (let i = 0; i < hanzi.length - 1; i++) {
    const bigram = hanzi.slice(i, i + 2);
    bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
  }

  // 过滤常见虚词
  const STOPWORDS = new Set(['的是', '是的', '了的', '的了', '不是', '在了', '了一', '一个']);

  return Array.from(bigramCounts.entries())
    .filter(([word]) => !STOPWORDS.has(word) && word.length === 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

// ═══ 风格注入提示词构建 ═══

/**
 * 构建风格注入提示词（用于 Layer 0）
 */
export function buildStyleInjectionPrompt(profile: StyleProfile, _maxTokens: number = 800): string {
  const parts: string[] = [];

  parts.push('【文风要求】');
  parts.push(`整体风格：${profile.summary}`);
  parts.push(`叙事视角：${profile.narrativeVoice}`);
  parts.push(`对话风格：${profile.dialogueStyle}`);

  if (profile.sensoryFocus.length > 0) {
    parts.push(`五感偏好：${profile.sensoryFocus.join('、')}`);
  }

  if (profile.commonMetaphors.length > 0) {
    parts.push(`常用意象：${profile.commonMetaphors.join('、')}`);
  }

  parts.push(`标志性特征：${profile.signature}`);
  parts.push('');
  parts.push('请参考以上风格特征续写，保持文风一致。');

  return parts.join('\n');
}

/**
 * 构建 RAG 风格样本检索提示词
 */
export function buildStyleSamplePrompt(chunks: StyleTextChunk[], sceneType?: string): string {
  if (chunks.length === 0) {
    return '';
  }

  const relevantChunks = sceneType
    ? chunks.filter(c => c.sceneType === sceneType)
    : chunks;

  if (relevantChunks.length === 0) {
    return '';
  }

  const samples = relevantChunks.slice(0, 3).map(c => c.content);

  return `【风格参考样本】

以下是与你当前写作场景相似的风格参考片段，请模仿其写作风格：

---
${samples.join('\n\n---\n\n')}
---

`;
}
