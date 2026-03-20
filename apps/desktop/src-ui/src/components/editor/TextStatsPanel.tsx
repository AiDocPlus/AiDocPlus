/**
 * TextStatsPanel — 详细文本统计面板
 *
 * 点击状态栏统计区域时弹出，显示详细的文本统计信息
 */
import { memo, useMemo } from 'react';
import { getTextStats } from '@/lib/textUtils';

const PANEL_STYLE: React.CSSProperties = {
  fontFamily: "'宋体', 'SimSun', serif",
  fontSize: '14px',
};

interface TextStatsPanelProps {
  content: string;
  visible: boolean;
  onClose: () => void;
}

export const TextStatsPanel = memo(function TextStatsPanel({ content, visible, onClose }: TextStatsPanelProps) {
  const stats = useMemo(() => getTextStats(content), [content]);
  const readingTime = Math.max(1, Math.ceil(stats.chars / 300));

  if (!visible) return null;

  const rows = [
    ['总字符数（含空格）', stats.chars],
    ['字符数（不含空格）', stats.charsNoSpace],
    ['中文字符数', stats.chineseChars],
    ['英文单词数', stats.englishWords],
    ['总词数', stats.words],
    ['总行数', stats.lines],
    ['非空行数', stats.nonEmptyLines],
    ['段落数', stats.paragraphs],
    ['句子数', stats.sentences],
    ['预估阅读时间', `${readingTime} 分钟`],
  ];

  return (
    <div
      className="absolute bottom-8 left-4 z-50 border rounded-lg shadow-xl p-3 w-64"
      style={{ ...PANEL_STYLE, backgroundColor: 'hsl(var(--card))', opacity: 1 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">文本统计</span>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label as string} className="border-b border-border/50 last:border-0">
              <td className="py-1 text-muted-foreground">{label}</td>
              <td className="py-1 text-right font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
