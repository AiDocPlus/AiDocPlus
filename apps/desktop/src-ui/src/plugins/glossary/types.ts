/**
 * 术语条目
 */
export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  aliases: string[];
  frequency: number;
  translation?: string;
}

/**
 * 术语表数据
 */
export interface GlossaryData {
  terms: GlossaryTerm[];
  generatedAt: number;
  lastPrompt?: string;
}

/**
 * 排序方式
 */
export type SortMode = 'alpha' | 'frequency' | 'order';

/**
 * 生成唯一 ID
 */
export function generateTermId(): string {
  return `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
