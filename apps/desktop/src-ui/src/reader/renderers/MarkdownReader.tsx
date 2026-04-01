import { useMemo } from 'react';
import { MarkdownPreview } from '@/components/editor/MarkdownPreview';
import type { ReaderThemeConfig } from '../useReaderStore';

const FONT_FAMILIES: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Songti SC", "SimSun", "STSong", "Noto Serif SC", Georgia, "Times New Roman", serif',
  sans: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif',
};

interface MarkdownReaderProps {
  content: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  paragraphSpacing: number;
  contentWidth: number;
  theme: ReaderThemeConfig;
}

export function MarkdownReader({ content, fontSize, fontFamily, lineHeight, paragraphSpacing, contentWidth, theme }: MarkdownReaderProps) {
  const style = useMemo(() => ({
    fontFamily: FONT_FAMILIES[fontFamily] ?? FONT_FAMILIES.system,
    backgroundColor: theme.bg,
    color: theme.text,
    '--reader-line-height': String(lineHeight),
    '--reader-paragraph-spacing': `${paragraphSpacing}em`,
    '--reader-text': theme.text,
    '--reader-heading': theme.heading,
    '--reader-muted': theme.muted,
    '--reader-accent': theme.accent,
    '--reader-code-bg': theme.codeBg,
  } as React.CSSProperties), [fontFamily, lineHeight, paragraphSpacing, theme]);

  return (
    <div className="h-full overflow-auto reader-markdown flex justify-center" style={style}>
      <div className="w-full px-10 py-14" style={{ maxWidth: `${contentWidth}px` }}>
        <MarkdownPreview
          content={content}
          fontSize={fontSize}
          theme={theme.mode === 'dark' ? 'dark' : 'light'}
          disableTruncation
          noInlineLineHeight
        />
      </div>
    </div>
  );
}
