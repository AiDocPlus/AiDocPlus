/**
 * 题目类型
 */
export type QuestionType = 'single' | 'multiple' | 'truefalse';

/**
 * 单道题目
 */
export interface QuizQuestion {
  id: number;
  type: QuestionType;
  question: string;
  options: string[];
  answer: string[];        // 正确答案（单选/判断为单元素数组，多选为多元素数组）
  explanation: string;     // 答案解析
  score: number;           // 本题分值
}

/**
 * 题型配置
 */
export interface QuizConfig {
  title: string;
  singleCount: number;     // 单选题数量
  multipleCount: number;   // 多选题数量
  trueFalseCount: number;  // 判断题数量
  singleScore: number;     // 每道单选题分值
  multipleScore: number;   // 每道多选题分值
  trueFalseScore: number;  // 每道判断题分值
}

/**
 * 完整测试题数据
 */
export interface QuizData {
  title: string;
  questions: QuizQuestion[];
  totalScore: number;
  config: QuizConfig;
  generatedAt: number;     // 生成时间戳
}

/**
 * 默认配置
 */
export const DEFAULT_QUIZ_CONFIG: QuizConfig = {
  title: '测试题',
  singleCount: 10,
  multipleCount: 10,
  trueFalseCount: 10,
  singleScore: 4,
  multipleScore: 4,
  trueFalseScore: 2,
};

/**
 * 计算总分
 */
export function calcTotalScore(config: QuizConfig): number {
  return (
    config.singleCount * config.singleScore +
    config.multipleCount * config.multipleScore +
    config.trueFalseCount * config.trueFalseScore
  );
}
