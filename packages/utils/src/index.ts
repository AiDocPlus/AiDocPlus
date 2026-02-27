/**
 * Utility functions for AiDocPlus
 */

import type { Document, DocumentVersion, ExportFormat } from '@aidocplus/shared-types';

// ============================================================
// ID Generation
// ============================================================

/**
 * Generate a unique ID using crypto API
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}${randomStr}` : `${timestamp}${randomStr}`;
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ============================================================
// Date Utilities
// ============================================================

/**
 * Format a date to locale string
 */
export function formatDate(date: Date, locale: string = 'zh-CN'): string {
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date, locale: string = 'zh-CN'): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSecs < 60) return rtf.format(-diffSecs, 'second');
  if (diffMins < 60) return rtf.format(-diffMins, 'minute');
  if (diffHours < 24) return rtf.format(-diffHours, 'hour');
  if (diffDays < 30) return rtf.format(-diffDays, 'day');

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return rtf.format(-diffMonths, 'month');

  const diffYears = Math.floor(diffDays / 365);
  return rtf.format(-diffYears, 'year');
}

// ============================================================
// String Utilities
// ============================================================

/**
 * Truncate text to specified length with ellipsis
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Strip markdown formatting
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '') // Headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
    .replace(/\*([^*]+)\*/g, '$1') // Italic
    .replace(/`([^`]+)`/g, '$1') // Inline code
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1') // Images
    .replace(/^\s*[-*+]\s+/gm, '') // Lists
    .replace(/^\s*\d+\.\s+/gm, ''); // Numbered lists
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  const cleanText = text.trim();
  if (!cleanText) return 0;

  // Handle Chinese characters
  const chineseChars = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
  // Handle words (space-separated)
  const words = cleanText.split(/\s+/).filter((word) => word.length > 0 && !/[\u4e00-\u9fa5]/.test(word)).length;

  return chineseChars + words;
}

/**
 * Count characters in text
 */
export function countCharacters(text: string): number {
  return text.length;
}

// ============================================================
// Document Utilities
// ============================================================

/**
 * Create a new document version
 */
export function createDocumentVersion(
  documentId: string,
  content: string,
  authorNotes: string,
  createdBy: 'user' | 'ai',
  changeDescription?: string
): DocumentVersion {
  return {
    id: generateId('version'),
    documentId,
    content,
    authorNotes,
    createdAt: new Date(),
    createdBy,
    changeDescription,
  };
}

/**
 * Get document statistics
 */
export interface DocumentStats {
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  readingTime: number; // in minutes
}

export function getDocumentStats(content: string): DocumentStats {
  const words = countWords(content);
  const chars = countCharacters(content);
  const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const readingTime = Math.ceil(words / 200); // Average reading speed: 200 words/min

  return {
    wordCount: words,
    characterCount: chars,
    paragraphCount,
    readingTime,
  };
}

// ============================================================
// File Utilities
// ============================================================

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Get MIME type for file extension
 */
export function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    md: 'text/markdown',
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    js: 'text/javascript',
    json: 'application/json',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Validate export format
 */
export function isValidExportFormat(format: string): format is ExportFormat {
  return ['md', 'docx', 'xlsx', 'pptx', 'html', 'pdf'].includes(format);
}

/**
 * Convert export format to file extension
 */
export function exportFormatToExtension(format: ExportFormat): string {
  const extensions: Record<ExportFormat, string> = {
    md: 'md',
    docx: 'docx',
    xlsx: 'xlsx',
    pptx: 'pptx',
    html: 'html',
    pdf: 'pdf',
  };
  return extensions[format];
}

// ============================================================
// Debounce and Throttle
// ============================================================

/**
 * Debounce function execution
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function execution
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ============================================================
// Deep Clone
// ============================================================

/**
 * Deep clone an object using structured clone
 */
export function deepClone<T>(obj: T): T {
  if (typeof structuredClone !== 'undefined') {
    return structuredClone(obj);
  }

  // Fallback for older environments
  return JSON.parse(JSON.stringify(obj));
}

// ============================================================
// Async Utilities
// ============================================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry async function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts?: number; baseDelay?: number; maxDelay?: number } = {}
): Promise<T> {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000 } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = Math.min(baseDelay * 2 ** (attempt - 1), maxDelay);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
