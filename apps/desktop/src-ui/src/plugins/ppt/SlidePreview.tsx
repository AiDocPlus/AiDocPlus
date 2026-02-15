import { useRef, useEffect } from 'react';
import type { Slide, PptTheme } from '@aidocplus/shared-types';
import { DEFAULT_FONT_SIZES } from '@aidocplus/shared-types';

interface SlidePreviewProps {
  slide: Slide;
  theme: PptTheme;
  width?: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SlidePreview({ slide, theme, width, selected, onClick, className = '' }: SlidePreviewProps) {
  const autoFit = width === undefined;
  const resolvedWidth = width ?? 320;
  const height = autoFit ? undefined : resolvedWidth * 9 / 16;
  const scale = autoFit ? undefined : resolvedWidth / 960;

  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  // 自适应模式：监听外框尺寸，直接设置内部 transform，避免 state 更新闪烁
  useEffect(() => {
    if (!autoFit) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cw = entry.contentRect.width;
        if (cw > 0) {
          inner.style.transform = `scale(${cw / 960})`;
        }
      }
    });
    observer.observe(outer);
    return () => observer.disconnect();
  }, [autoFit]);

  return (
    <div
      ref={outerRef}
      className={`relative cursor-pointer rounded-md overflow-hidden ${
        selected ? 'border-[3px] border-primary ring-2 ring-primary/30 shadow-xl shadow-primary/20' : 'border-2 border-border hover:border-primary/50'
      } ${className}`}
      style={autoFit
        ? { width: '100%', aspectRatio: '16 / 9' }
        : { width: resolvedWidth, height }
      }
      onClick={onClick}
    >
      <div
        ref={innerRef}
        className="origin-top-left absolute"
        style={{
          width: 960,
          height: 540,
          transform: autoFit ? 'scale(0.5)' : `scale(${scale})`,
          backgroundColor: theme.colors.background,
          color: theme.colors.text,
          fontFamily: theme.fonts.body,
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {slide.layout === 'title' && (
          <TitleLayout slide={slide} theme={theme} />
        )}
        {slide.layout === 'section' && (
          <SectionLayout slide={slide} theme={theme} />
        )}
        {slide.layout === 'content' && (
          <ContentLayout slide={slide} theme={theme} />
        )}
        {slide.layout === 'two-column' && (
          <TwoColumnLayout slide={slide} theme={theme} />
        )}
        {(slide.layout === 'blank' || slide.layout === 'image-text') && (
          <ContentLayout slide={slide} theme={theme} />
        )}
      </div>
    </div>
  );
}

function TitleLayout({ slide, theme }: { slide: Slide; theme: PptTheme }) {
  const fs = { ...DEFAULT_FONT_SIZES, ...theme.fontSizes };
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-6">
      <div
        style={{
          fontSize: fs.title,
          fontWeight: 700,
          fontFamily: theme.fonts.title,
          color: theme.colors.primary,
          lineHeight: 1.3,
        }}
      >
        {slide.title}
      </div>
      {slide.subtitle && (
        <div
          style={{
            fontSize: fs.subtitle,
            color: theme.colors.secondary,
            fontFamily: theme.fonts.body,
          }}
        >
          {slide.subtitle}
        </div>
      )}
      <div
        style={{
          width: 120,
          height: 4,
          backgroundColor: theme.colors.accent,
          borderRadius: 2,
          marginTop: 8,
        }}
      />
    </div>
  );
}

function SectionLayout({ slide, theme }: { slide: Slide; theme: PptTheme }) {
  const fs = { ...DEFAULT_FONT_SIZES, ...theme.fontSizes };
  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-4">
      <div
        style={{
          width: 60,
          height: 4,
          backgroundColor: theme.colors.accent,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          fontSize: Math.round(fs.title * 0.83),
          fontWeight: 700,
          fontFamily: theme.fonts.title,
          color: theme.colors.primary,
          lineHeight: 1.3,
        }}
      >
        {slide.title}
      </div>
      {slide.subtitle && (
        <div style={{ fontSize: Math.round(fs.subtitle * 0.83), color: theme.colors.secondary }}>
          {slide.subtitle}
        </div>
      )}
    </div>
  );
}

function ContentLayout({ slide, theme }: { slide: Slide; theme: PptTheme }) {
  const fs = { ...DEFAULT_FONT_SIZES, ...theme.fontSizes };
  return (
    <div className="flex flex-col h-full">
      <div
        style={{
          fontSize: fs.heading,
          fontWeight: 700,
          fontFamily: theme.fonts.title,
          color: theme.colors.primary,
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: `3px solid ${theme.colors.accent}`,
        }}
      >
        {slide.title}
      </div>
      <div className="flex-1 flex flex-col gap-3" style={{ paddingTop: 8 }}>
        {slide.content.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: theme.colors.accent,
                marginTop: 8,
                flexShrink: 0,
              }}
            />
            <div style={{ fontSize: fs.body, lineHeight: 1.6 }}>{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TwoColumnLayout({ slide, theme }: { slide: Slide; theme: PptTheme }) {
  const fs = { ...DEFAULT_FONT_SIZES, ...theme.fontSizes };
  const separatorIdx = slide.content.indexOf('---');
  const leftItems = separatorIdx >= 0 ? slide.content.slice(0, separatorIdx) : slide.content.slice(0, Math.ceil(slide.content.length / 2));
  const rightItems = separatorIdx >= 0 ? slide.content.slice(separatorIdx + 1) : slide.content.slice(Math.ceil(slide.content.length / 2));
  const colBodySize = Math.round(fs.body * 0.9);

  return (
    <div className="flex flex-col h-full">
      <div
        style={{
          fontSize: fs.heading,
          fontWeight: 700,
          fontFamily: theme.fonts.title,
          color: theme.colors.primary,
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: `3px solid ${theme.colors.accent}`,
        }}
      >
        {slide.title}
      </div>
      <div className="flex-1 flex gap-8" style={{ paddingTop: 8 }}>
        <div className="flex-1 flex flex-col gap-3">
          {leftItems.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: theme.colors.accent, marginTop: 8, flexShrink: 0,
                }}
              />
              <div style={{ fontSize: colBodySize, lineHeight: 1.6 }}>{item}</div>
            </div>
          ))}
        </div>
        <div style={{ width: 2, backgroundColor: theme.colors.accent, opacity: 0.3 }} />
        <div className="flex-1 flex flex-col gap-3">
          {rightItems.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  backgroundColor: theme.colors.secondary, marginTop: 8, flexShrink: 0,
                }}
              />
              <div style={{ fontSize: colBodySize, lineHeight: 1.6 }}>{item}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
