/**
 * 共享高亮颜色选择器
 *
 * 36 色预设网格 + 自定义颜色按钮，工具栏和浮动菜单共用
 */

import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { HIGHLIGHT_COLORS, loadCustomColors, saveCustomColor } from '../types';
import { Pipette } from 'lucide-react';

interface HighlightColorPickerProps {
  disabled?: boolean;
  onSelect: (color: string | null) => void;
  /** 选中后是否关闭弹出层 */
  closeOnSelect?: boolean;
  /** 额外 CSS class */
  className?: string;
}

export function HighlightColorPicker({
  disabled,
  onSelect,
  closeOnSelect = false,
  className,
}: HighlightColorPickerProps) {
  const { t } = useTranslation();
  const [customColors, setCustomColors] = useState<string[]>(loadCustomColors);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleSelect = useCallback(
    (color: string) => {
      onSelect(color);
      if (closeOnSelect) return;
    },
    [onSelect, closeOnSelect]
  );

  const handleClear = useCallback(() => {
    onSelect(null);
  }, [onSelect]);

  const handleCustomColor = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const color = e.target.value;
      saveCustomColor(color);
      setCustomColors(loadCustomColors());
      onSelect(color);
    },
    [onSelect]
  );

  return (
    <div className={cn('p-2', className)}>
      <button
        type="button"
        className="mb-2 flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted transition-colors"
        disabled={disabled}
        onClick={handleClear}
      >
        {t('outline.toolbar.clearHighlight', { defaultValue: '清除高亮' })}
      </button>

      {/* 36 色网格 (6x6) */}
      <div className="grid grid-cols-6 gap-1">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.name}
            type="button"
            disabled={disabled}
            onClick={() => handleSelect(c.value)}
            className="h-6 w-full rounded border border-border/50 hover:ring-2 hover:ring-primary/30 hover:scale-110 transition-transform disabled:opacity-40"
            style={{ backgroundColor: c.value }}
            title={c.name}
            aria-label={c.name}
          />
        ))}
      </div>

      {/* 自定义颜色区域 */}
      <div className="mt-2 border-t border-border/60 pt-2">
        {/* 最近自定义色 */}
        {customColors.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {customColors.map((color) => (
              <button
                key={color}
                type="button"
                disabled={disabled}
                onClick={() => handleSelect(color)}
                className="h-6 w-6 rounded border border-border/50 hover:ring-2 hover:ring-primary/30 transition-transform disabled:opacity-40"
                style={{ backgroundColor: color }}
                title={color}
                aria-label={color}
              />
            ))}
          </div>
        )}

        {/* 自定义颜色按钮 */}
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => colorInputRef.current?.click()}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Pipette className="h-3.5 w-3.5" />
            {t('outline.toolbar.customColor', { defaultValue: '自定义颜色' })}
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 opacity-0 cursor-pointer"
            value="#fef3c7"
            onChange={handleCustomColor}
            tabIndex={-1}
          />
        </div>
      </div>
    </div>
  );
}

export default HighlightColorPicker;
