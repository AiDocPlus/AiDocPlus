// ── 文本选择右键菜单 ──

import { useEffect, useRef, useState } from 'react';
import { useReaderStore } from '../../useReaderStore';
import { HIGHLIGHT_COLORS, type HighlightColor } from '../../types/annotations';
import { useTranslation } from '@/i18n';
import { colors } from '../../styles';

interface SelectionContextMenuProps {
  x: number;
  y: number;
  selectedText: string;
  filename: string;
  scrollPosition?: number;
  progressPercent?: number;
  onClose: () => void;
}

export function SelectionContextMenu({
  x, y, selectedText, filename, scrollPosition, progressPercent, onClose,
}: SelectionContextMenuProps) {
  const { t } = useTranslation();
  const addAnnotation = useReaderStore(s => s.addAnnotation);
  const ref = useRef<HTMLDivElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  // 调整位置防止超出视口
  const menuWidth = 180;
  const menuHeight = showColors ? 240 : showNote ? 200 : 160;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const posX = x + menuWidth > vw ? vw - menuWidth - 8 : x;
  const posY = y + menuHeight > vh ? vh - menuHeight - 8 : y;

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleHighlight = (color: HighlightColor) => {
    addAnnotation({
      id: `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      filename,
      type: 'highlight',
      color,
      position: {
        scrollPosition: scrollPosition ?? 0,
        progressPercent: progressPercent ?? 0,
      },
      textSnapshot: {
        text: selectedText.slice(0, 200),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleAddNote = () => {
    addAnnotation({
      id: `ann-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      filename,
      type: 'note',
      position: {
        scrollPosition: scrollPosition ?? 0,
        progressPercent: progressPercent ?? 0,
      },
      textSnapshot: {
        text: selectedText.slice(0, 200),
      },
      note: noteText || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText).catch(() => {});
    onClose();
  };

  const handleSearchWeb = () => {
    const query = encodeURIComponent(selectedText.slice(0, 100));
    window.open(`https://www.google.com/search?q=${query}`, '_blank');
    onClose();
  };

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: posX,
    top: posY,
    zIndex: 1000,
    minWidth: menuWidth,
    background: colors.bgCard,
    border: `1px solid ${colors.borderMain}`,
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    padding: '4px 0',
    fontSize: 13,
  };

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '6px 12px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    color: '#334155',
    fontSize: 13,
  };

  return (
    <div ref={ref} style={menuStyle}>
      {!showColors && !showNote ? (
        <>
          <button style={itemStyle}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => setShowColors(true)}
          >
            <span style={{ fontSize: 14 }}>🖍</span>
            {t('reader.highlight', { defaultValue: '高亮选中文本' })}
          </button>
          <button style={itemStyle}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => setShowNote(true)}
          >
            <span style={{ fontSize: 14 }}>📝</span>
            {t('reader.addNote', { defaultValue: '添加笔记' })}
          </button>
          <div style={{ height: 1, background: '#e2e8f0', margin: '2px 0' }} />
          <button style={itemStyle}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={handleCopy}
          >
            <span style={{ fontSize: 14 }}>📋</span>
            {t('reader.copyText', { defaultValue: '复制' })}
          </button>
          <button style={itemStyle}
            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={handleSearchWeb}
          >
            <span style={{ fontSize: 14 }}>🔍</span>
            {t('reader.searchWeb', { defaultValue: '搜索网页' })}
          </button>
        </>
      ) : showColors ? (
        <>
          <div style={{ padding: '6px 12px', fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
            {t('reader.chooseHighlightColor', { defaultValue: '选择高亮颜色' })}
          </div>
          <div style={{ display: 'flex', gap: 6, padding: '4px 12px 8px', flexWrap: 'wrap' }}>
            {HIGHLIGHT_COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => handleHighlight(c.id)}
                title={t(c.labelKey, { defaultValue: c.id })}
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: `2px solid ${c.border}`,
                  background: c.bg,
                  cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              />
            ))}
          </div>
          <button style={{ ...itemStyle, color: '#94a3b8', justifyContent: 'center' }}
            onClick={() => setShowColors(false)}
          >
            {t('reader.cancel', { defaultValue: '取消' })}
          </button>
        </>
      ) : (
        /* showNote */
        <>
          <div style={{ padding: '8px 12px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              {t('reader.selectedSnippet', { defaultValue: '选中文本' })}
            </div>
            <div style={{
              fontSize: 12, color: '#475569', maxHeight: 48, overflow: 'hidden',
              padding: '4px 6px', background: '#f8fafc', borderRadius: 4,
              border: '1px solid #e2e8f0', lineHeight: 1.4,
            }}>
              {selectedText.slice(0, 100)}{selectedText.length > 100 ? '...' : ''}
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder={t('reader.notePlaceholder', { defaultValue: '输入笔记...' })}
              style={{
                width: '100%', marginTop: 6, padding: '6px 8px',
                border: '1px solid #e2e8f0', borderRadius: 4,
                fontSize: 13, resize: 'none', minHeight: 48,
                outline: 'none', boxSizing: 'border-box',
              }}
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, padding: '4px 12px' }}>
            <button style={{
              flex: 1, padding: '5px', border: '1px solid #e2e8f0', borderRadius: 4,
              background: 'transparent', cursor: 'pointer', fontSize: 12, color: '#64748b',
            }} onClick={() => setShowNote(false)}>
              {t('reader.cancel', { defaultValue: '取消' })}
            </button>
            <button style={{
              flex: 1, padding: '5px', border: 'none', borderRadius: 4,
              background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            }} onClick={handleAddNote}>
              {t('reader.saveNote', { defaultValue: '保存' })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
