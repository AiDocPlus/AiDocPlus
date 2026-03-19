/**
 * novelExport.ts — 全书导出工具函数
 *
 * 支持导出格式：Markdown / 纯文本 / 大纲 / 设定集
 */

import type { NovelDocumentContent } from './types';
import { getChapterWordCount, getVolumeWordCount } from './types';

export interface ExportOptions {
  includeOutline: boolean;
  includeSummary: boolean;
  includeAuthorNotes: boolean;
  includeForeshadowing: boolean;
  includeWordCount: boolean;
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeOutline: false,
  includeSummary: false,
  includeAuthorNotes: false,
  includeForeshadowing: false,
  includeWordCount: true,
};

/**
 * 导出为 Markdown（含目录和字数统计）
 */
export function exportToMarkdown(novel: NovelDocumentContent, opts: Partial<ExportOptions> = {}): string {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const parts: string[] = [];

  // 标题
  const title = novel.settings.synopsis ? novel.settings.synopsis.split('\n')[0].slice(0, 50) : '小说';
  parts.push(`# ${title}\n`);

  // 目录
  parts.push('## 目录\n');
  for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const vwc = getVolumeWordCount(vol);
    parts.push(`- **${vol.title}**${o.includeWordCount ? ` (${vwc}字)` : ''}`);
    for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const cwc = getChapterWordCount(ch);
      parts.push(`  - ${ch.title}${o.includeWordCount ? ` (${cwc}字)` : ''}`);
    }
  }
  parts.push('');

  // 正文
  for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    parts.push(`\n---\n\n## ${vol.title}\n`);
    if (vol.synopsis) parts.push(`> ${vol.synopsis}\n`);

    for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
      parts.push(`### ${ch.title}\n`);

      if (o.includeOutline && ch.outline) {
        parts.push(`> **大纲**: ${ch.outline}\n`);
      }
      if (o.includeSummary && ch.summary) {
        parts.push(`> **摘要**: ${ch.summary}\n`);
      }
      if (o.includeAuthorNotes && ch.authorNotes) {
        parts.push(`> **作者注**: ${ch.authorNotes}\n`);
      }

      if (ch.scenes && ch.scenes.length > 0) {
        for (const sc of [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder)) {
          if (sc.content) {
            parts.push(`#### ${sc.title}\n`);
            parts.push(sc.content);
            parts.push('');
          }
        }
      } else if (ch.content) {
        parts.push(ch.content);
        parts.push('');
      }

      if (o.includeWordCount) {
        parts.push(`*— ${getChapterWordCount(ch)} 字 —*\n`);
      }
    }
  }

  // 伏笔附录
  if (o.includeForeshadowing && novel.settings.foreshadowing.length > 0) {
    parts.push('\n---\n\n## 伏笔清单\n');
    for (const fs of novel.settings.foreshadowing) {
      const statusLabel = fs.status === 'open' ? '🟡未解' : fs.status === 'resolved' ? '✅已解' : '⚪放弃';
      parts.push(`- ${statusLabel} ${fs.content}${fs.note ? ` — ${fs.note}` : ''}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * 导出为纯文本（去除 Markdown 标记）
 */
export function exportToPlainText(novel: NovelDocumentContent): string {
  const parts: string[] = [];

  for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    parts.push(`\n${vol.title}\n${'='.repeat(vol.title.length)}\n`);

    for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
      parts.push(`\n${ch.title}\n${'-'.repeat(ch.title.length)}\n`);
      const stripMd = (text: string) => text
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/~~(.+?)~~/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/^\s*[-*+]\s+/gm, '')
        .replace(/^\s*\d+\.\s+/gm, '')
        .replace(/\[(.+?)\]\(.+?\)/g, '$1');
      if (ch.scenes && ch.scenes.length > 0) {
        for (const sc of [...ch.scenes].sort((a, b) => a.sortOrder - b.sortOrder)) {
          if (sc.content) parts.push(stripMd(sc.content));
        }
      } else if (ch.content) {
        parts.push(stripMd(ch.content));
      }
    }
  }

  return parts.join('\n');
}

/**
 * 导出大纲（仅卷/章标题 + 大纲 + 摘要）
 */
export function exportOutline(novel: NovelDocumentContent): string {
  const parts: string[] = [];
  parts.push('# 大纲\n');

  if (novel.settings.outlineGlobal) {
    parts.push('## 全局大纲\n');
    parts.push(novel.settings.outlineGlobal);
    parts.push('');
  }

  for (const vol of [...novel.volumes].sort((a, b) => a.sortOrder - b.sortOrder)) {
    parts.push(`\n## ${vol.title}\n`);
    if (vol.synopsis) parts.push(`> ${vol.synopsis}\n`);

    for (const ch of [...vol.chapters].sort((a, b) => a.sortOrder - b.sortOrder)) {
      parts.push(`### ${ch.title}`);
      if (ch.outline) parts.push(`\n大纲：${ch.outline}`);
      if (ch.summary) parts.push(`\n摘要：${ch.summary}`);
      parts.push('');
    }
  }

  return parts.join('\n');
}

/**
 * 导出设定集（角色档案、地点、世界观、时间线、伏笔）
 */
export function exportSettings(novel: NovelDocumentContent): string {
  const s = novel.settings;
  const parts: string[] = [];

  parts.push('# 设定集\n');

  // 基本信息
  if (s.genre || s.era || s.style) {
    parts.push('## 基本信息\n');
    if (s.genre) parts.push(`- **题材**: ${s.genre}`);
    if (s.era) parts.push(`- **时代**: ${s.era}`);
    if (s.style) parts.push(`- **风格**: ${s.style}`);
    parts.push('');
  }

  // 梗概
  if (s.synopsis) {
    parts.push('## 故事梗概\n');
    parts.push(s.synopsis);
    parts.push('');
  }

  // 角色
  if (s.characters.length > 0) {
    parts.push('## 角色档案\n');
    for (const c of s.characters) {
      const roleLabel = c.role === 'protagonist' ? '主角' : c.role === 'antagonist' ? '反派' : c.role === 'supporting' ? '配角' : '龙套';
      parts.push(`### ${c.name}（${roleLabel}）\n`);
      if (c.aliases?.length) parts.push(`- **别名**: ${c.aliases.join('、')}`);
      if (c.gender) parts.push(`- **性别**: ${c.gender}`);
      if (c.age) parts.push(`- **年龄**: ${c.age}`);
      if (c.appearance) parts.push(`- **外貌**: ${c.appearance}`);
      if (c.personality) parts.push(`- **性格**: ${c.personality}`);
      if (c.background) parts.push(`- **背景**: ${c.background}`);
      if (c.motivation) parts.push(`- **动机**: ${c.motivation}`);
      if (c.arc) parts.push(`- **人物弧光**: ${c.arc}`);
      if (c.dialogueStyle) parts.push(`- **对话风格**: ${c.dialogueStyle}`);
      if (c.description) parts.push(`\n${c.description}`);
      parts.push('');
    }
  }

  // 地点
  if (s.locations.length > 0) {
    parts.push('## 地点设定\n');
    for (const l of s.locations) {
      parts.push(`### ${l.name}${l.type ? ` (${l.type})` : ''}\n`);
      if (l.description) parts.push(l.description);
      if (l.atmosphere) parts.push(`\n*氛围*: ${l.atmosphere}`);
      if (l.significance) parts.push(`\n*故事意义*: ${l.significance}`);
      parts.push('');
    }
  }

  // 世界观
  if (s.worldView || s.worldRules || s.worldGeography || s.worldCulture || s.historicalBackground) {
    parts.push('## 世界观\n');
    if (s.worldView) parts.push(s.worldView + '\n');
    if (s.worldRules) parts.push(`### 规则设定\n${s.worldRules}\n`);
    if (s.worldGeography) parts.push(`### 地理设定\n${s.worldGeography}\n`);
    if (s.worldCulture) parts.push(`### 文化/社会\n${s.worldCulture}\n`);
    if (s.historicalBackground) parts.push(`### 历史背景\n${s.historicalBackground}\n`);
  }

  // 时间线
  if (s.timeline.length > 0) {
    parts.push('## 时间线\n');
    for (const e of [...s.timeline].sort((a, b) => a.sortOrder - b.sortOrder)) {
      const imp = e.importance === 'turning-point' ? '⚡' : e.importance === 'major' ? '⭐' : '○';
      parts.push(`- ${imp} **${e.date || '?'}** ${e.title}${e.description ? ` — ${e.description}` : ''}`);
    }
    parts.push('');
  }

  // 伏笔
  if (s.foreshadowing.length > 0) {
    parts.push('## 伏笔追踪\n');
    for (const f of s.foreshadowing) {
      const statusLabel = f.status === 'open' ? '🟡未解' : f.status === 'resolved' ? '✅已解' : '⚪放弃';
      parts.push(`- ${statusLabel} ${f.content}${f.note ? ` — ${f.note}` : ''}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}
