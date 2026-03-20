/**
 * bookmarks.ts — CodeMirror 6 书签扩展
 *
 * 功能：
 * - 点击行号 gutter 切换书签
 * - Ctrl+F2 切换当前行书签
 * - F2 / Shift+F2 在书签间导航
 * - 清除所有书签
 * - 蓝色圆点 gutter 标记
 */
import {
  StateField, StateEffect, RangeSet,
  type Extension, type EditorState,
} from '@codemirror/state';
import {
  EditorView, GutterMarker, gutter,
} from '@codemirror/view';

// ── Effects ──

export const toggleBookmarkEffect = StateEffect.define<number>(); // line position
export const clearBookmarksEffect = StateEffect.define<void>();

// ── Gutter Marker ──

class BookmarkMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('div');
    el.style.width = '8px';
    el.style.height = '8px';
    el.style.borderRadius = '50%';
    el.style.backgroundColor = '#3b82f6';
    el.style.margin = '4px auto';
    return el;
  }
}

const bookmarkMarker = new BookmarkMarker();

// ── StateField ──

export const bookmarkField = StateField.define<RangeSet<GutterMarker>>({
  create() {
    return RangeSet.empty;
  },
  update(bookmarks, tr) {
    // Map existing bookmarks through document changes
    bookmarks = bookmarks.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(toggleBookmarkEffect)) {
        const pos = effect.value;
        const line = tr.state.doc.lineAt(pos);
        const lineStart = line.from;

        // Check if bookmark already exists on this line
        let hasBookmark = false;
        const newRanges: { from: number; to: number }[] = [];
        const cursor = bookmarks.iter();
        while (cursor.value) {
          const bmLine = tr.state.doc.lineAt(cursor.from);
          if (bmLine.number === line.number) {
            hasBookmark = true;
          } else {
            newRanges.push({ from: cursor.from, to: cursor.from });
          }
          cursor.next();
        }

        if (hasBookmark) {
          // Remove bookmark
          bookmarks = RangeSet.of(
            newRanges.map(r => bookmarkMarker.range(r.from)),
            true,
          );
        } else {
          // Add bookmark
          newRanges.push({ from: lineStart, to: lineStart });
          newRanges.sort((a, b) => a.from - b.from);
          bookmarks = RangeSet.of(
            newRanges.map(r => bookmarkMarker.range(r.from)),
            true,
          );
        }
      } else if (effect.is(clearBookmarksEffect)) {
        bookmarks = RangeSet.empty;
      }
    }
    return bookmarks;
  },
});

// ── Gutter ──

const bookmarkGutter = gutter({
  class: 'cm-bookmark-gutter',
  markers: (view) => view.state.field(bookmarkField),
  initialSpacer: () => bookmarkMarker,
  domEventHandlers: {
    mousedown(view, line) {
      view.dispatch({
        effects: toggleBookmarkEffect.of(line.from),
      });
      return true;
    },
  },
});

// ── Helper functions ──

/** 获取所有书签位置（排序） */
function getBookmarkPositions(state: EditorState): number[] {
  const positions: number[] = [];
  const cursor = state.field(bookmarkField).iter();
  while (cursor.value) {
    positions.push(cursor.from);
    cursor.next();
  }
  return positions.sort((a, b) => a - b);
}

/** 跳转到下一个书签 */
export function nextBookmark(view: EditorView): boolean {
  const positions = getBookmarkPositions(view.state);
  if (positions.length === 0) return false;
  const cursorPos = view.state.selection.main.from;
  // 找到第一个在光标之后的书签
  const next = positions.find(p => p > cursorPos);
  const target = next ?? positions[0]; // 循环到第一个
  view.dispatch({
    selection: { anchor: target },
    effects: EditorView.scrollIntoView(target, { y: 'center' }),
  });
  view.focus();
  return true;
}

/** 跳转到上一个书签 */
export function prevBookmark(view: EditorView): boolean {
  const positions = getBookmarkPositions(view.state);
  if (positions.length === 0) return false;
  const cursorPos = view.state.selection.main.from;
  // 找到最后一个在光标之前的书签
  const prev = [...positions].reverse().find(p => p < cursorPos);
  const target = prev ?? positions[positions.length - 1]; // 循环到最后一个
  view.dispatch({
    selection: { anchor: target },
    effects: EditorView.scrollIntoView(target, { y: 'center' }),
  });
  view.focus();
  return true;
}

/** 切换当前行书签 */
export function toggleBookmark(view: EditorView): boolean {
  const pos = view.state.selection.main.from;
  view.dispatch({ effects: toggleBookmarkEffect.of(pos) });
  return true;
}

/** 清除所有书签 */
export function clearAllBookmarks(view: EditorView): boolean {
  view.dispatch({ effects: clearBookmarksEffect.of() });
  return true;
}

// ── Extension ──

export function bookmarkExtension(): Extension {
  return [
    bookmarkField,
    bookmarkGutter,
  ];
}
