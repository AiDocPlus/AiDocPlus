import PptxGenJS from 'pptxgenjs';
import type { SlidesDeck, Slide, PptTheme, PptThemeFontSizes } from '@aidocplus/shared-types';
import { DEFAULT_FONT_SIZES } from '@aidocplus/shared-types';

/** 将预览像素字号转换为 PPTX 磅值（基准 960px → 10”，约 0.75x） */
function getFontSizes(theme: PptTheme): PptThemeFontSizes {
  const fs = { ...DEFAULT_FONT_SIZES, ...theme.fontSizes };
  return {
    title: Math.round(fs.title * 0.75),
    subtitle: Math.round(fs.subtitle * 0.75),
    heading: Math.round(fs.heading * 0.75),
    body: Math.round(fs.body * 0.75),
  };
}

export interface PptxExportOptions {
  includeNotes?: boolean;
  aspectRatio?: '16:9' | '4:3';
  theme?: PptTheme;
}

/**
 * 将 SlidesDeck 导出为 PPTX Blob
 */
export async function exportToPptx(
  deck: SlidesDeck,
  options: PptxExportOptions = {},
): Promise<Blob> {
  const theme = options.theme || deck.theme;
  const includeNotes = options.includeNotes ?? true;
  const aspectRatio = options.aspectRatio || deck.aspectRatio || '16:9';

  const pptx = new PptxGenJS();

  // 设置演示文稿属性
  pptx.layout = aspectRatio === '16:9' ? 'LAYOUT_WIDE' : 'LAYOUT_4x3';

  // 定义母版页
  pptx.defineSlideMaster({
    title: 'MASTER',
    background: { color: theme.colors.background.replace('#', '') },
  });

  // 逐张生成幻灯片
  for (const slide of deck.slides) {
    const pptSlide = pptx.addSlide({ masterName: 'MASTER' });

    // 设置背景色
    pptSlide.background = { color: theme.colors.background.replace('#', '') };

    // 根据版式渲染
    switch (slide.layout) {
      case 'title':
        renderTitleSlide(pptSlide, slide, theme);
        break;
      case 'section':
        renderSectionSlide(pptSlide, slide, theme);
        break;
      case 'two-column':
        renderTwoColumnSlide(pptSlide, slide, theme);
        break;
      case 'content':
      default:
        renderContentSlide(pptSlide, slide, theme);
        break;
    }

    // 演讲者备注
    if (includeNotes && slide.notes) {
      pptSlide.addNotes(slide.notes);
    }
  }

  // 生成 Blob
  const output = await pptx.write({ outputType: 'blob' });
  return output as Blob;
}

/** 封面页 */
function renderTitleSlide(pptSlide: PptxGenJS.Slide, slide: Slide, theme: PptTheme) {
  const fs = getFontSizes(theme);
  // 主标题
  pptSlide.addText(slide.title, {
    x: 0.5,
    y: 1.5,
    w: '90%',
    h: 2,
    fontSize: fs.title,
    fontFace: theme.fonts.title,
    color: theme.colors.primary.replace('#', ''),
    align: 'center',
    valign: 'bottom',
    bold: true,
  });

  // 副标题
  if (slide.subtitle) {
    pptSlide.addText(slide.subtitle, {
      x: 0.5,
      y: 3.8,
      w: '90%',
      h: 1,
      fontSize: fs.subtitle,
      fontFace: theme.fonts.body,
      color: theme.colors.secondary.replace('#', ''),
      align: 'center',
      valign: 'top',
    });
  }

  // 底部装饰线
  pptSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 3,
    y: 3.5,
    w: 4,
    h: 0.05,
    fill: { color: theme.colors.accent.replace('#', '') },
  });
}

/** 章节分隔页 */
function renderSectionSlide(pptSlide: PptxGenJS.Slide, slide: Slide, theme: PptTheme) {
  const fs = getFontSizes(theme);
  // 背景色块
  pptSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0,
    y: 0,
    w: '100%',
    h: '100%',
    fill: { color: theme.colors.primary.replace('#', '') },
  });

  pptSlide.addText(slide.title, {
    x: 0.5,
    y: 2,
    w: '90%',
    h: 2,
    fontSize: Math.round(fs.title * 0.83),
    fontFace: theme.fonts.title,
    color: 'FFFFFF',
    align: 'center',
    valign: 'middle',
    bold: true,
  });
}

/** 内容页 */
function renderContentSlide(pptSlide: PptxGenJS.Slide, slide: Slide, theme: PptTheme) {
  const fs = getFontSizes(theme);
  // 标题
  pptSlide.addText(slide.title, {
    x: 0.5,
    y: 0.3,
    w: '90%',
    h: 0.8,
    fontSize: fs.heading,
    fontFace: theme.fonts.title,
    color: theme.colors.primary.replace('#', ''),
    bold: true,
    valign: 'middle',
  });

  // 标题下方装饰线
  pptSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 0.5,
    y: 1.15,
    w: 1.5,
    h: 0.04,
    fill: { color: theme.colors.accent.replace('#', '') },
  });

  // 内容要点
  if (slide.content.length > 0) {
    const bullets = slide.content.map(text => ({
      text,
      options: {
        fontSize: fs.body,
        fontFace: theme.fonts.body,
        color: theme.colors.text.replace('#', ''),
        bullet: { code: '2022' as const },
        paraSpaceAfter: 8,
      },
    }));

    pptSlide.addText(bullets, {
      x: 0.5,
      y: 1.4,
      w: '90%',
      h: 3.8,
      valign: 'top',
    });
  }
}

/** 双栏页 */
function renderTwoColumnSlide(pptSlide: PptxGenJS.Slide, slide: Slide, theme: PptTheme) {
  const fs = getFontSizes(theme);
  // 标题
  pptSlide.addText(slide.title, {
    x: 0.5,
    y: 0.3,
    w: '90%',
    h: 0.8,
    fontSize: fs.heading,
    fontFace: theme.fonts.title,
    color: theme.colors.primary.replace('#', ''),
    bold: true,
    valign: 'middle',
  });

  // 分割内容为左右两栏
  const sepIdx = slide.content.indexOf('---');
  const leftItems = sepIdx >= 0 ? slide.content.slice(0, sepIdx) : slide.content.slice(0, Math.ceil(slide.content.length / 2));
  const rightItems = sepIdx >= 0 ? slide.content.slice(sepIdx + 1) : slide.content.slice(Math.ceil(slide.content.length / 2));
  const colBodySize = Math.round(fs.body * 0.9);

  const makeBullets = (items: string[]) =>
    items.map(text => ({
      text,
      options: {
        fontSize: colBodySize,
        fontFace: theme.fonts.body,
        color: theme.colors.text.replace('#', ''),
        bullet: { code: '2022' as const },
        paraSpaceAfter: 6,
      },
    }));

  // 左栏
  if (leftItems.length > 0) {
    pptSlide.addText(makeBullets(leftItems), {
      x: 0.5,
      y: 1.4,
      w: 4.2,
      h: 3.8,
      valign: 'top',
    });
  }

  // 右栏
  if (rightItems.length > 0) {
    pptSlide.addText(makeBullets(rightItems), {
      x: 5.2,
      y: 1.4,
      w: 4.2,
      h: 3.8,
      valign: 'top',
    });
  }

  // 中间分隔线
  pptSlide.addShape('rect' as PptxGenJS.ShapeType, {
    x: 4.9,
    y: 1.6,
    w: 0.02,
    h: 3.2,
    fill: { color: theme.colors.accent.replace('#', '') },
  });
}
