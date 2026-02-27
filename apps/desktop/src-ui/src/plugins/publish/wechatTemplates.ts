/**
 * 微信公众号排版模板
 * 每个模板定义一组内联样式，应用到正文 HTML 的各个标签上
 * 微信只支持内联 style，不支持 <style> 或外部 CSS
 */

export interface WechatTemplate {
  id: string;
  name: string;
  description: string;
  styles: {
    body: string;
    h1: string;
    h2: string;
    h3: string;
    h4: string;
    p: string;
    blockquote: string;
    code: string;
    pre: string;
    a: string;
    img: string;
    ul: string;
    ol: string;
    li: string;
    hr: string;
    strong: string;
    em: string;
    table: string;
    th: string;
    td: string;
  };
}

export const WECHAT_TEMPLATES: WechatTemplate[] = [
  // ── 1. 经典绿 ──
  {
    id: 'classic-green',
    name: '经典绿',
    description: '微信官方风格，绿色强调',
    styles: {
      body: 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.8;color:#333;word-wrap:break-word;',
      h1: 'font-size:22px;font-weight:bold;color:#1a1a1a;margin:24px 0 12px 0;padding-bottom:8px;border-bottom:1px solid #eee;',
      h2: 'font-size:20px;font-weight:bold;color:#1a1a1a;margin:20px 0 10px 0;padding-bottom:6px;border-bottom:1px solid #f0f0f0;',
      h3: 'font-size:18px;font-weight:bold;color:#1a1a1a;margin:16px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#1a1a1a;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;',
      blockquote: 'border-left:3px solid #07C160;padding:10px 16px;margin:16px 0;background:#f8f8f8;color:#666;font-size:15px;',
      code: 'background:#f5f5f5;padding:2px 6px;border-radius:3px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#c7254e;',
      pre: 'background:#2d2d2d;color:#ccc;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:16px 0;',
      a: 'color:#576b95;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:4px;margin:12px 0;',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:4px 0;line-height:1.8;',
      hr: 'border:none;border-top:1px solid #eee;margin:24px 0;',
      strong: 'color:#07C160;font-weight:bold;',
      em: 'font-style:italic;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#f8f8f8;border:1px solid #e8e8e8;padding:8px 12px;text-align:left;font-weight:bold;',
      td: 'border:1px solid #e8e8e8;padding:8px 12px;text-align:left;',
    },
  },

  // ── 2. 商务蓝 ──
  {
    id: 'business-blue',
    name: '商务蓝',
    description: '专业商务风格，蓝色主题',
    styles: {
      body: 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.75;color:#2c3e50;word-wrap:break-word;',
      h1: 'font-size:24px;font-weight:bold;color:#1a365d;margin:28px 0 14px 0;padding-bottom:10px;border-bottom:2px solid #3182ce;',
      h2: 'font-size:20px;font-weight:bold;color:#2b6cb0;margin:22px 0 10px 0;padding-left:12px;border-left:4px solid #3182ce;',
      h3: 'font-size:18px;font-weight:bold;color:#2c5282;margin:18px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#2c5282;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;letter-spacing:0.5px;',
      blockquote: 'border-left:4px solid #3182ce;padding:12px 20px;margin:16px 0;background:#ebf8ff;color:#2c5282;font-size:15px;border-radius:0 4px 4px 0;',
      code: 'background:#edf2f7;padding:2px 6px;border-radius:3px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#2b6cb0;',
      pre: 'background:#1a202c;color:#e2e8f0;padding:16px;border-radius:6px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:16px 0;',
      a: 'color:#3182ce;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:6px;margin:12px 0;box-shadow:0 2px 8px rgba(0,0,0,0.1);',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:6px 0;line-height:1.75;',
      hr: 'border:none;border-top:2px solid #e2e8f0;margin:28px 0;',
      strong: 'color:#2b6cb0;font-weight:bold;',
      em: 'font-style:italic;color:#4a5568;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#ebf8ff;border:1px solid #bee3f8;padding:10px 14px;text-align:left;font-weight:bold;color:#2c5282;',
      td: 'border:1px solid #e2e8f0;padding:10px 14px;text-align:left;',
    },
  },

  // ── 3. 暖橙 ──
  {
    id: 'warm-orange',
    name: '暖橙',
    description: '温暖活力风格，橙色主题',
    styles: {
      body: 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.8;color:#44403c;word-wrap:break-word;',
      h1: 'font-size:24px;font-weight:bold;color:#c2410c;margin:28px 0 14px 0;text-align:center;',
      h2: 'font-size:20px;font-weight:bold;color:#ea580c;margin:22px 0 10px 0;padding-bottom:6px;border-bottom:2px dashed #fed7aa;',
      h3: 'font-size:18px;font-weight:bold;color:#9a3412;margin:16px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#9a3412;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;',
      blockquote: 'border-left:3px solid #fb923c;padding:12px 16px;margin:16px 0;background:#fff7ed;color:#9a3412;font-size:15px;border-radius:0 8px 8px 0;',
      code: 'background:#fff7ed;padding:2px 6px;border-radius:3px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#c2410c;',
      pre: 'background:#431407;color:#fed7aa;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:16px 0;',
      a: 'color:#ea580c;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:8px;margin:12px 0;',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:4px 0;line-height:1.8;',
      hr: 'border:none;height:2px;background:linear-gradient(to right,#fed7aa,#fb923c,#fed7aa);margin:24px 0;',
      strong: 'color:#c2410c;font-weight:bold;',
      em: 'font-style:italic;color:#78716c;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#fff7ed;border:1px solid #fed7aa;padding:8px 12px;text-align:left;font-weight:bold;color:#9a3412;',
      td: 'border:1px solid #fed7aa;padding:8px 12px;text-align:left;',
    },
  },

  // ── 4. 优雅紫 ──
  {
    id: 'elegant-purple',
    name: '优雅紫',
    description: '高雅知性风格，紫色主题',
    styles: {
      body: 'font-family:"Georgia","PingFang SC","Microsoft YaHei",serif;font-size:16px;line-height:1.9;color:#374151;word-wrap:break-word;',
      h1: 'font-size:24px;font-weight:bold;color:#6b21a8;margin:28px 0 14px 0;text-align:center;letter-spacing:2px;',
      h2: 'font-size:20px;font-weight:bold;color:#7c3aed;margin:22px 0 10px 0;padding-left:14px;border-left:4px solid #a78bfa;',
      h3: 'font-size:18px;font-weight:bold;color:#6b21a8;margin:16px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#6b21a8;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;text-indent:2em;',
      blockquote: 'border-left:3px solid #a78bfa;padding:12px 20px;margin:16px 0;background:#faf5ff;color:#6b21a8;font-size:15px;font-style:italic;',
      code: 'background:#f5f3ff;padding:2px 6px;border-radius:3px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#7c3aed;',
      pre: 'background:#1e1b4b;color:#c4b5fd;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:16px 0;',
      a: 'color:#7c3aed;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:8px;margin:12px 0;box-shadow:0 4px 12px rgba(124,58,237,0.15);',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:6px 0;line-height:1.9;',
      hr: 'border:none;height:1px;background:linear-gradient(to right,transparent,#a78bfa,transparent);margin:28px 0;',
      strong: 'color:#7c3aed;font-weight:bold;',
      em: 'font-style:italic;color:#6b7280;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#faf5ff;border:1px solid #e9d5ff;padding:10px 14px;text-align:left;font-weight:bold;color:#6b21a8;',
      td: 'border:1px solid #e9d5ff;padding:10px 14px;text-align:left;',
    },
  },

  // ── 5. 极简黑白 ──
  {
    id: 'minimal-bw',
    name: '极简黑白',
    description: '极简主义，黑白灰配色',
    styles: {
      body: 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:2;color:#1a1a1a;word-wrap:break-word;',
      h1: 'font-size:26px;font-weight:900;color:#000;margin:32px 0 16px 0;letter-spacing:1px;',
      h2: 'font-size:22px;font-weight:700;color:#000;margin:24px 0 12px 0;',
      h3: 'font-size:18px;font-weight:700;color:#000;margin:18px 0 8px 0;',
      h4: 'font-size:16px;font-weight:700;color:#000;margin:14px 0 6px 0;',
      p: 'margin:0 0 20px 0;text-align:justify;letter-spacing:0.5px;',
      blockquote: 'border-left:4px solid #000;padding:12px 20px;margin:20px 0;background:#fafafa;color:#333;font-size:15px;',
      code: 'background:#f0f0f0;padding:2px 6px;border-radius:2px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#333;',
      pre: 'background:#111;color:#ddd;padding:20px;border-radius:0;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:20px 0;',
      a: 'color:#000;text-decoration:underline;',
      img: 'max-width:100%;height:auto;margin:16px 0;',
      ul: 'padding-left:20px;margin:16px 0;',
      ol: 'padding-left:20px;margin:16px 0;',
      li: 'margin:8px 0;line-height:2;',
      hr: 'border:none;border-top:2px solid #000;margin:32px 0;',
      strong: 'color:#000;font-weight:900;',
      em: 'font-style:italic;',
      table: 'width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;',
      th: 'background:#000;color:#fff;border:1px solid #000;padding:10px 14px;text-align:left;font-weight:bold;',
      td: 'border:1px solid #ddd;padding:10px 14px;text-align:left;',
    },
  },

  // ── 6. 清新粉 ──
  {
    id: 'fresh-pink',
    name: '清新粉',
    description: '少女风格，粉色主题',
    styles: {
      body: 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.8;color:#4a4a4a;word-wrap:break-word;',
      h1: 'font-size:22px;font-weight:bold;color:#db2777;margin:24px 0 12px 0;text-align:center;',
      h2: 'font-size:20px;font-weight:bold;color:#ec4899;margin:20px 0 10px 0;padding-bottom:6px;border-bottom:2px solid #fbcfe8;',
      h3: 'font-size:18px;font-weight:bold;color:#be185d;margin:16px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#be185d;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;',
      blockquote: 'border-left:3px solid #f9a8d4;padding:12px 16px;margin:16px 0;background:#fdf2f8;color:#9d174d;font-size:15px;border-radius:0 12px 12px 0;',
      code: 'background:#fdf2f8;padding:2px 6px;border-radius:10px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#db2777;',
      pre: 'background:#831843;color:#fce7f3;padding:16px;border-radius:12px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:16px 0;',
      a: 'color:#ec4899;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:12px;margin:12px 0;',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:4px 0;line-height:1.8;',
      hr: 'border:none;height:2px;background:linear-gradient(to right,#fce7f3,#ec4899,#fce7f3);margin:24px 0;',
      strong: 'color:#db2777;font-weight:bold;',
      em: 'font-style:italic;color:#9ca3af;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#fdf2f8;border:1px solid #fbcfe8;padding:8px 12px;text-align:left;font-weight:bold;color:#9d174d;',
      td: 'border:1px solid #fbcfe8;padding:8px 12px;text-align:left;',
    },
  },

  // ── 7. 科技灰 ──
  {
    id: 'tech-gray',
    name: '科技灰',
    description: '科技感风格，深灰主题',
    styles: {
      body: 'font-family:"SF Mono",-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.75;color:#d1d5db;word-wrap:break-word;background:#111827;',
      h1: 'font-size:24px;font-weight:bold;color:#f9fafb;margin:28px 0 14px 0;padding-bottom:8px;border-bottom:1px solid #374151;',
      h2: 'font-size:20px;font-weight:bold;color:#e5e7eb;margin:22px 0 10px 0;padding-left:12px;border-left:3px solid #6366f1;',
      h3: 'font-size:18px;font-weight:bold;color:#e5e7eb;margin:16px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#e5e7eb;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;',
      blockquote: 'border-left:3px solid #6366f1;padding:12px 16px;margin:16px 0;background:#1f2937;color:#9ca3af;font-size:15px;',
      code: 'background:#1f2937;padding:2px 6px;border-radius:4px;font-size:14px;font-family:"SF Mono",Menlo,Monaco,Consolas,monospace;color:#a78bfa;',
      pre: 'background:#0f172a;color:#e2e8f0;padding:16px;border-radius:6px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:"SF Mono",Menlo,Monaco,Consolas,monospace;margin:16px 0;border:1px solid #1e293b;',
      a: 'color:#818cf8;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:6px;margin:12px 0;',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:4px 0;line-height:1.75;',
      hr: 'border:none;border-top:1px solid #374151;margin:24px 0;',
      strong: 'color:#818cf8;font-weight:bold;',
      em: 'font-style:italic;color:#9ca3af;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#1f2937;border:1px solid #374151;padding:8px 12px;text-align:left;font-weight:bold;color:#e5e7eb;',
      td: 'border:1px solid #374151;padding:8px 12px;text-align:left;color:#d1d5db;',
    },
  },

  // ── 8. 自然绿 ──
  {
    id: 'nature-green',
    name: '自然绿',
    description: '清新自然风格，绿色主题',
    styles: {
      body: 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.85;color:#374151;word-wrap:break-word;',
      h1: 'font-size:24px;font-weight:bold;color:#166534;margin:28px 0 14px 0;text-align:center;letter-spacing:1px;',
      h2: 'font-size:20px;font-weight:bold;color:#15803d;margin:22px 0 10px 0;padding:4px 12px;background:#f0fdf4;border-radius:4px;',
      h3: 'font-size:18px;font-weight:bold;color:#166534;margin:16px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#166534;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;',
      blockquote: 'border-left:4px solid #4ade80;padding:12px 16px;margin:16px 0;background:#f0fdf4;color:#166534;font-size:15px;border-radius:0 8px 8px 0;',
      code: 'background:#f0fdf4;padding:2px 6px;border-radius:3px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#15803d;',
      pre: 'background:#14532d;color:#bbf7d0;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:16px 0;',
      a: 'color:#16a34a;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:8px;margin:12px 0;',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:4px 0;line-height:1.85;',
      hr: 'border:none;height:2px;background:linear-gradient(to right,#dcfce7,#4ade80,#dcfce7);margin:24px 0;',
      strong: 'color:#15803d;font-weight:bold;',
      em: 'font-style:italic;color:#6b7280;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#f0fdf4;border:1px solid #bbf7d0;padding:8px 12px;text-align:left;font-weight:bold;color:#166534;',
      td: 'border:1px solid #dcfce7;padding:8px 12px;text-align:left;',
    },
  },

  // ── 9. 中国红 ──
  {
    id: 'chinese-red',
    name: '中国红',
    description: '传统中国风，红色主题',
    styles: {
      body: 'font-family:"楷体","KaiTi","STKaiti","PingFang SC","Microsoft YaHei",serif;font-size:16px;line-height:2;color:#292524;word-wrap:break-word;',
      h1: 'font-size:24px;font-weight:bold;color:#991b1b;margin:28px 0 14px 0;text-align:center;letter-spacing:4px;',
      h2: 'font-size:20px;font-weight:bold;color:#b91c1c;margin:22px 0 10px 0;padding-bottom:6px;border-bottom:2px solid #fca5a5;',
      h3: 'font-size:18px;font-weight:bold;color:#991b1b;margin:16px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#991b1b;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;text-indent:2em;',
      blockquote: 'border-left:4px solid #dc2626;padding:12px 20px;margin:16px 0;background:#fef2f2;color:#7f1d1d;font-size:15px;font-style:italic;',
      code: 'background:#fef2f2;padding:2px 6px;border-radius:2px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#b91c1c;',
      pre: 'background:#450a0a;color:#fecaca;padding:16px;border-radius:4px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:16px 0;',
      a: 'color:#dc2626;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:4px;margin:12px 0;border:1px solid #fecaca;',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:6px 0;line-height:2;',
      hr: 'border:none;height:1px;background:#dc2626;margin:28px 40px;',
      strong: 'color:#dc2626;font-weight:bold;',
      em: 'font-style:italic;color:#78716c;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#fef2f2;border:1px solid #fecaca;padding:10px 14px;text-align:left;font-weight:bold;color:#991b1b;',
      td: 'border:1px solid #fecaca;padding:10px 14px;text-align:left;',
    },
  },

  // ── 10. 海洋蓝绿 ──
  {
    id: 'ocean-teal',
    name: '海洋蓝绿',
    description: '清凉海洋风格，蓝绿主题',
    styles: {
      body: 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.8;color:#334155;word-wrap:break-word;',
      h1: 'font-size:24px;font-weight:bold;color:#0f766e;margin:28px 0 14px 0;padding-bottom:8px;border-bottom:2px solid #5eead4;',
      h2: 'font-size:20px;font-weight:bold;color:#0d9488;margin:22px 0 10px 0;padding-left:12px;border-left:4px solid #2dd4bf;',
      h3: 'font-size:18px;font-weight:bold;color:#0f766e;margin:16px 0 8px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#0f766e;margin:14px 0 6px 0;',
      p: 'margin:0 0 16px 0;text-align:justify;',
      blockquote: 'border-left:3px solid #2dd4bf;padding:12px 16px;margin:16px 0;background:#f0fdfa;color:#115e59;font-size:15px;border-radius:0 6px 6px 0;',
      code: 'background:#f0fdfa;padding:2px 6px;border-radius:3px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;color:#0d9488;',
      pre: 'background:#042f2e;color:#99f6e4;padding:16px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:16px 0;',
      a: 'color:#0d9488;text-decoration:none;',
      img: 'max-width:100%;height:auto;border-radius:8px;margin:12px 0;',
      ul: 'padding-left:24px;margin:12px 0;',
      ol: 'padding-left:24px;margin:12px 0;',
      li: 'margin:4px 0;line-height:1.8;',
      hr: 'border:none;height:2px;background:linear-gradient(to right,#ccfbf1,#2dd4bf,#ccfbf1);margin:24px 0;',
      strong: 'color:#0d9488;font-weight:bold;',
      em: 'font-style:italic;color:#64748b;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'background:#f0fdfa;border:1px solid #99f6e4;padding:8px 12px;text-align:left;font-weight:bold;color:#0f766e;',
      td: 'border:1px solid #ccfbf1;padding:8px 12px;text-align:left;',
    },
  },

  // ── 11. 学术论文 ──
  {
    id: 'academic',
    name: '学术论文',
    description: '学术严谨风格，适合专业文章',
    styles: {
      body: 'font-family:"Times New Roman","宋体","SimSun","PingFang SC",serif;font-size:16px;line-height:2;color:#1a1a1a;word-wrap:break-word;',
      h1: 'font-size:22px;font-weight:bold;color:#000;margin:28px 0 14px 0;text-align:center;',
      h2: 'font-size:20px;font-weight:bold;color:#000;margin:24px 0 12px 0;',
      h3: 'font-size:18px;font-weight:bold;color:#000;margin:20px 0 10px 0;',
      h4: 'font-size:16px;font-weight:bold;color:#000;margin:16px 0 8px 0;',
      p: 'margin:0 0 12px 0;text-align:justify;text-indent:2em;',
      blockquote: 'border-left:2px solid #999;padding:8px 16px;margin:16px 32px;color:#555;font-size:15px;',
      code: 'background:#f5f5f5;padding:1px 4px;border-radius:2px;font-size:14px;font-family:"Courier New",Courier,monospace;',
      pre: 'background:#f8f8f8;color:#333;padding:16px;border:1px solid #ddd;overflow-x:auto;font-size:13px;line-height:1.5;font-family:"Courier New",Courier,monospace;margin:16px 0;',
      a: 'color:#0066cc;text-decoration:underline;',
      img: 'max-width:100%;height:auto;margin:16px auto;display:block;',
      ul: 'padding-left:32px;margin:12px 0;',
      ol: 'padding-left:32px;margin:12px 0;',
      li: 'margin:4px 0;line-height:2;',
      hr: 'border:none;border-top:1px solid #ccc;margin:24px 0;',
      strong: 'font-weight:bold;',
      em: 'font-style:italic;',
      table: 'width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;',
      th: 'border-top:2px solid #000;border-bottom:1px solid #000;padding:8px 12px;text-align:left;font-weight:bold;',
      td: 'border-bottom:1px solid #ddd;padding:8px 12px;text-align:left;',
    },
  },

  // ── 12. 杂志风 ──
  {
    id: 'magazine',
    name: '杂志风',
    description: '时尚杂志风格，大气排版',
    styles: {
      body: 'font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;font-size:16px;line-height:1.9;color:#333;word-wrap:break-word;',
      h1: 'font-size:28px;font-weight:900;color:#111;margin:36px 0 16px 0;letter-spacing:2px;text-transform:uppercase;',
      h2: 'font-size:22px;font-weight:700;color:#222;margin:28px 0 12px 0;padding-bottom:8px;border-bottom:3px solid #111;',
      h3: 'font-size:18px;font-weight:700;color:#333;margin:20px 0 8px 0;text-transform:uppercase;letter-spacing:1px;',
      h4: 'font-size:16px;font-weight:700;color:#333;margin:16px 0 6px 0;',
      p: 'margin:0 0 18px 0;text-align:justify;letter-spacing:0.3px;',
      blockquote: 'padding:20px 24px;margin:24px 0;background:#f8f8f8;font-size:18px;font-style:italic;color:#555;border-left:none;border-top:2px solid #111;border-bottom:2px solid #111;',
      code: 'background:#f0f0f0;padding:2px 6px;border-radius:2px;font-size:14px;font-family:Menlo,Monaco,Consolas,monospace;',
      pre: 'background:#1a1a1a;color:#e0e0e0;padding:20px;border-radius:0;overflow-x:auto;font-size:14px;line-height:1.6;font-family:Menlo,Monaco,Consolas,monospace;margin:20px 0;',
      a: 'color:#111;text-decoration:underline;font-weight:600;',
      img: 'max-width:100%;height:auto;margin:20px 0;',
      ul: 'padding-left:20px;margin:16px 0;',
      ol: 'padding-left:20px;margin:16px 0;',
      li: 'margin:8px 0;line-height:1.9;',
      hr: 'border:none;border-top:3px solid #111;margin:32px 0;',
      strong: 'font-weight:900;color:#111;',
      em: 'font-style:italic;',
      table: 'width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;',
      th: 'background:#111;color:#fff;border:none;padding:12px 16px;text-align:left;font-weight:bold;text-transform:uppercase;letter-spacing:1px;',
      td: 'border-bottom:1px solid #eee;padding:12px 16px;text-align:left;',
    },
  },
];

/**
 * 将模板样式应用到 HTML 内容
 * 遍历所有标签，添加对应的内联 style
 */
export function applyTemplate(html: string, template: WechatTemplate): string {
  const { styles } = template;

  // 包裹 body 样式
  let result = html;

  // 替换各标签的 style（先移除已有 style，再添加模板 style）
  const tagMap: Record<string, string> = {
    h1: styles.h1,
    h2: styles.h2,
    h3: styles.h3,
    h4: styles.h4,
    h5: styles.h4,
    h6: styles.h4,
    p: styles.p,
    blockquote: styles.blockquote,
    code: styles.code,
    pre: styles.pre,
    a: styles.a,
    img: styles.img,
    ul: styles.ul,
    ol: styles.ol,
    li: styles.li,
    hr: styles.hr,
    strong: styles.strong,
    em: styles.em,
    table: styles.table,
    th: styles.th,
    td: styles.td,
  };

  for (const [tag, style] of Object.entries(tagMap)) {
    // 匹配 <tag ...> 或 <tag>，替换或添加 style 属性
    const regex = new RegExp(`<${tag}(\\s[^>]*)?>`, 'gi');
    result = result.replace(regex, (match) => {
      // 移除已有的 style 属性
      const cleaned = match.replace(/\s*style="[^"]*"/gi, '');
      // 在标签名后插入 style
      return cleaned.replace(new RegExp(`<${tag}`, 'i'), `<${tag} style="${style}"`);
    });
  }

  // 用 body 样式包裹整个内容
  result = `<div style="${styles.body}">${result}</div>`;

  return result;
}
