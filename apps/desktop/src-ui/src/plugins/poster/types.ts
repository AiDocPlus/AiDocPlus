/**
 * 海报主题
 */
export interface PosterTheme {
  key: string;
  label: string;
  description: string;
  primaryColor: string;
  bgColor: string;
  textColor: string;
}

/**
 * 海报数据
 */
export interface PosterData {
  html: string;
  theme: string;
  generatedAt: number;
  lastPrompt?: string;
}

/**
 * 内置主题列表
 */
export const POSTER_THEMES: PosterTheme[] = [
  {
    key: 'modern-blue',
    label: '现代蓝',
    description: '简洁现代的蓝色主题',
    primaryColor: '#2563eb',
    bgColor: '#f0f9ff',
    textColor: '#1e293b',
  },
  {
    key: 'warm-orange',
    label: '暖橙色',
    description: '温暖活力的橙色主题',
    primaryColor: '#ea580c',
    bgColor: '#fff7ed',
    textColor: '#1c1917',
  },
  {
    key: 'forest-green',
    label: '森林绿',
    description: '自然清新的绿色主题',
    primaryColor: '#16a34a',
    bgColor: '#f0fdf4',
    textColor: '#14532d',
  },
  {
    key: 'elegant-purple',
    label: '优雅紫',
    description: '高贵优雅的紫色主题',
    primaryColor: '#9333ea',
    bgColor: '#faf5ff',
    textColor: '#3b0764',
  },
  {
    key: 'dark-mode',
    label: '暗色模式',
    description: '深色背景的专业主题',
    primaryColor: '#60a5fa',
    bgColor: '#0f172a',
    textColor: '#e2e8f0',
  },
];
