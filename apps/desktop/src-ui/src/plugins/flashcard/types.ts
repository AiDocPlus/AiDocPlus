/**
 * 卡片类型
 */
export type CardType = 'concept' | 'qa' | 'fill' | 'keyword';

/**
 * 单张闪卡
 */
export interface Flashcard {
  id: string;
  type: CardType;
  front: string;
  back: string;
  mastered: boolean;
  lastReview?: number;
}

/**
 * 闪卡数据
 */
export interface FlashcardData {
  cards: Flashcard[];
  generatedAt: number;
  lastPrompt?: string;
}

/**
 * 卡片类型标签
 */
export const CARD_TYPE_LABELS: Record<CardType, string> = {
  concept: '概念定义',
  qa: '问答对',
  fill: '填空题',
  keyword: '关键词',
};

/**
 * 生成唯一 ID
 */
export function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
