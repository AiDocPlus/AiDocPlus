import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Contact } from './types';
import { isValidEmail } from './utils';

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: Contact[];
  onInputChange?: (text: string) => void;
  onFocus?: () => void;
  showSuggestions?: boolean;
  onSelectSuggestion?: (contact: Contact) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onDuplicate?: (email: string) => void;
  onBlur?: () => void;
}

/** 邮件地址提取：支持 "Name <email>" 和纯 email */
function extractEmail(tag: string): string {
  const match = tag.match(/<([^>]+)>/);
  return match ? match[1] : tag;
}

/** 常见邮箱域名列表 */
const COMMON_DOMAINS = [
  'qq.com', '163.com', '126.com', 'yeah.net', 'sina.com',
  'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com',
  'foxmail.com', 'icloud.com', 'live.com', 'mail.com',
];

export function TagInput({
  value, onChange, placeholder,
  suggestions, onInputChange, onFocus,
  showSuggestions, onSelectSuggestion, inputRef: externalRef,
  onDuplicate, onBlur,
}: TagInputProps) {
  const [inputText, setInputText] = useState('');
  const [domainSuggestions, setDomainSuggestions] = useState<string[]>([]);
  const internalRef = useRef<HTMLInputElement>(null);
  const ref = externalRef || internalRef;
  const containerRef = useRef<HTMLDivElement>(null);

  // 将逗号分隔的字符串解析为 tags
  const tags = value.split(',').map(s => s.trim()).filter(Boolean);

  // F3: 去重辅助
  const isDuplicate = useCallback((newEmail: string) => {
    const normalized = extractEmail(newEmail).toLowerCase();
    return tags.some(t => extractEmail(t).toLowerCase() === normalized);
  }, [tags]);

  const commitTag = useCallback((text: string) => {
    const trimmed = text.trim().replace(/,+$/, '').trim();
    if (!trimmed) return;
    if (isDuplicate(trimmed)) {
      onDuplicate?.(extractEmail(trimmed));
      setInputText('');
      if (onInputChange) onInputChange('');
      return;
    }
    const newTags = [...tags, trimmed];
    onChange(newTags.join(', '));
    setInputText('');
    if (onInputChange) onInputChange('');
  }, [tags, onChange, onInputChange, isDuplicate, onDuplicate]);

  const removeTag = useCallback((index: number) => {
    const newTags = tags.filter((_, i) => i !== index);
    onChange(newTags.join(', '));
  }, [tags, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (inputText.trim()) {
        e.preventDefault();
        commitTag(inputText);
      }
    } else if (e.key === 'Backspace' && !inputText && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }, [inputText, tags, commitTag, removeTag]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // 域名自动补全：当输入包含 @ 时显示匹配的域名
    const atIdx = val.lastIndexOf('@');
    if (atIdx >= 0) {
      const partial = val.substring(atIdx + 1).toLowerCase();
      if ((partial && !partial.includes('.')) || (partial.includes('.') && !COMMON_DOMAINS.includes(partial))) {
        setDomainSuggestions(COMMON_DOMAINS.filter(d => d.startsWith(partial)).map(d => val.substring(0, atIdx + 1) + d));
      } else if (!partial) {
        setDomainSuggestions(COMMON_DOMAINS.slice(0, 6).map(d => val.substring(0, atIdx + 1) + d));
      } else {
        setDomainSuggestions([]);
      }
    } else {
      setDomainSuggestions([]);
    }
    // 如果输入了逗号，提交当前文本
    if (val.includes(',')) {
      const parts = val.split(',');
      // 累积所有逗号前面的有效部分，一次性提交
      const toAdd: string[] = [];
      const existingEmails = new Set(tags.map(t => extractEmail(t).toLowerCase()));
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i].trim();
        if (part) {
          const email = extractEmail(part).toLowerCase();
          if (existingEmails.has(email)) {
            onDuplicate?.(email);
          } else {
            existingEmails.add(email);
            toAdd.push(part);
          }
        }
      }
      if (toAdd.length > 0) {
        onChange([...tags, ...toAdd].join(', '));
      }
      const remaining = parts[parts.length - 1];
      setInputText(remaining);
      if (onInputChange) onInputChange(remaining);
    } else {
      setInputText(val);
      if (onInputChange) onInputChange(val);
    }
  }, [tags, onChange, onInputChange, onDuplicate]);

  const selectDomainSuggestion = useCallback((fullEmail: string) => {
    setDomainSuggestions([]);
    commitTag(fullEmail);
  }, [commitTag]);

  const handleBlur = useCallback(() => {
    // 失去焦点时提交剩余文本
    if (inputText.trim()) {
      commitTag(inputText);
    }
    setDomainSuggestions([]);
    onBlur?.();
  }, [inputText, commitTag, onBlur]);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (text.includes(',') || text.includes(';') || text.includes('\n')) {
      e.preventDefault();
      const parts = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
      // F3: 粘贴时去重
      const existingEmails = new Set(tags.map(t => extractEmail(t).toLowerCase()));
      const unique: string[] = [];
      for (const part of parts) {
        const email = extractEmail(part).toLowerCase();
        if (!existingEmails.has(email)) {
          existingEmails.add(email);
          unique.push(part);
        } else {
          onDuplicate?.(email);
        }
      }
      if (unique.length) {
        const newTags = [...tags, ...unique];
        onChange(newTags.join(', '));
      }
      setInputText('');
    }
  }, [tags, onChange, onDuplicate]);

  // 点击容器聚焦输入框
  const handleContainerClick = useCallback(() => {
    if (ref.current) ref.current.focus();
  }, [ref]);

  // 外部 value 变化时（如加载草稿）同步清空 inputText
  useEffect(() => {
    setInputText('');
  }, [value]);

  return (
    <div className="relative flex-1">
      <div
        ref={containerRef}
        className="flex flex-wrap items-center gap-1 min-h-[28px] px-2 py-0.5 border rounded-md bg-background cursor-text focus-within:ring-1 focus-within:ring-ring"
        onClick={handleContainerClick}
      >
        {tags.map((tag, i) => {
          const email = extractEmail(tag);
          const valid = isValidEmail(email);
          return (
            <span
              key={`${tag}-${i}`}
              className={`inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-xs font-mono max-w-[200px] ${
                valid
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              <span className="truncate">{tag}</span>
              <button
                type="button"
                className="flex-shrink-0 hover:bg-primary/20 rounded-sm p-0"
                onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          ref={ref}
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={onFocus}
          onPaste={handlePaste}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-sm font-mono py-0.5"
          style={{ border: 'none', boxShadow: 'none' }}
        />
      </div>
      {/* 域名自动补全下拉 */}
      {domainSuggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md shadow-lg max-h-[200px] overflow-y-auto" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
          {domainSuggestions.map(email => (
            <div key={email}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent text-sm font-mono"
              onMouseDown={(e) => { e.preventDefault(); selectDomainSuggestion(email); }}>
              {email}
            </div>
          ))}
        </div>
      )}
      {/* 联系人建议下拉 */}
      {domainSuggestions.length === 0 && showSuggestions && suggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 border rounded-md shadow-lg max-h-[200px] overflow-y-auto" style={{ backgroundColor: 'hsl(var(--background))', opacity: 1 }}>
          {suggestions.map(c => (
            <div key={c.id}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-accent text-sm"
              onMouseDown={(e) => { e.preventDefault(); if (onSelectSuggestion) onSelectSuggestion(c); }}>
              <div className="flex-1 min-w-0">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground ml-1.5 font-mono text-xs">&lt;{c.email}&gt;</span>
              </div>
              {c.note && <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{c.note}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
