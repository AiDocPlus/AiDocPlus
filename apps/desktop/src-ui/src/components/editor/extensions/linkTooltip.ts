import { EditorView, hoverTooltip } from '@codemirror/view';
import i18n from '@/i18n';
import type { Tooltip } from '@codemirror/view';

/**
 * 链接悬浮预览：鼠标悬停在 Markdown 链接上时显示 URL，可点击打开
 */
export const linkHoverTooltip = hoverTooltip((view: EditorView, pos: number): Tooltip | null => {
  // 获取光标所在行
  const line = view.state.doc.lineAt(pos);
  const lineText = line.text;
  const offset = pos - line.from;

  // 在行内查找所有 Markdown 链接 [text](url)
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const url = match[2];
      return {
        pos: line.from + start,
        end: line.from + end,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-link-tooltip';
          dom.style.cssText = 'padding:4px 8px;font-size:12px;max-width:400px;overflow:hidden;';

          const link = document.createElement('a');
          link.href = url;
          link.textContent = url.length > 60 ? url.slice(0, 57) + '...' : url;
          link.title = url;
          link.style.cssText = 'color:var(--cm-link-color, #2563eb);text-decoration:underline;word-break:break-all;cursor:pointer;';
          link.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(url, '_blank', 'noopener,noreferrer');
          });

          const hint = document.createElement('span');
          hint.textContent = ` — ${i18n.t('editor.clickToOpen', { defaultValue: '点击打开' })}`;
          hint.style.cssText = 'color:var(--cm-hint-color, #888);font-size:11px;';

          dom.appendChild(link);
          dom.appendChild(hint);
          return { dom };
        },
      };
    }
  }

  // 也检查图片链接 ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = imgRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offset >= start && offset <= end) {
      const url = match[2];
      const alt = match[1];
      return {
        pos: line.from + start,
        end: line.from + end,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.className = 'cm-link-tooltip';
          dom.style.cssText = 'padding:4px 8px;font-size:12px;max-width:300px;';

          // 尝试显示图片缩略图
          if (/^https?:\/\//i.test(url)) {
            const img = document.createElement('img');
            img.src = url;
            img.alt = alt || i18n.t('editor.imagePreview', { defaultValue: '图片预览' });
            img.style.cssText = 'max-width:280px;max-height:150px;border-radius:4px;display:block;margin-bottom:4px;';
            img.onerror = () => { img.style.display = 'none'; };
            dom.appendChild(img);
          }

          const urlSpan = document.createElement('div');
          urlSpan.textContent = url.length > 50 ? url.slice(0, 47) + '...' : url;
          urlSpan.style.cssText = 'color:var(--cm-hint-color, #888);font-size:11px;word-break:break-all;';
          dom.appendChild(urlSpan);

          return { dom };
        },
      };
    }
  }

  return null;
});
