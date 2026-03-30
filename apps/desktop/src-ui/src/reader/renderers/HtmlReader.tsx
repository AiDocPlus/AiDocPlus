import { useMemo } from 'react';
import type { ReaderThemeConfig } from '../useReaderStore';

const FONT_FAMILIES: Record<string, string> = {
  system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif',
  serif: '"Songti SC", "SimSun", "STSong", "Noto Serif SC", Georgia, "Times New Roman", serif',
  sans: '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif',
  kai: '"Kaiti SC", "STKaiti", "KaiTi", "Noto Serif SC", serif',
};

interface HtmlReaderProps {
  content: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  paragraphSpacing: number;
  contentWidth: number;
  theme: ReaderThemeConfig;
}

export function HtmlReader({ content, fontSize, fontFamily, lineHeight, paragraphSpacing, contentWidth, theme }: HtmlReaderProps) {
  const styledContent = useMemo(() => {
    const fontStack = FONT_FAMILIES[fontFamily] ?? FONT_FAMILIES.system;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-size: ${fontSize}px;
      font-family: ${fontStack};
      line-height: ${lineHeight};
      background-color: ${theme.bg};
      color: ${theme.text};
      padding: 40px 48px;
      max-width: ${contentWidth}px;
      margin: 0 auto;
      text-rendering: optimizeLegibility;
    }
    h1, h2, h3, h4, h5, h6 { color: ${theme.heading}; }
    p { text-indent: 2em; margin-bottom: calc(1em + ${paragraphSpacing}em); }
    h1, h2, h3, h4, h5, h6 { text-align: center; text-indent: 0; }
    pre + p, blockquote + p, ul + p, ol + p, table + p, hr + p { text-indent: 0; }
    li > p { text-indent: 0; }
    img { max-width: 100%; height: auto; }
    a { color: ${theme.accent}; }
    code, pre { background-color: ${theme.codeBg}; }
  </style>
</head>
<body>${content}</body>
</html>`;
  }, [content, fontSize, fontFamily, lineHeight, contentWidth, theme]);

  return (
    <iframe
      srcDoc={styledContent}
      sandbox=""
      className="w-full h-full border-0"
      title="HTML content"
    />
  );
}
