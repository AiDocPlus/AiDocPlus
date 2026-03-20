/**
 * 日记内置模板定义
 */
import type { DiaryTemplate } from './types';

export const BUILTIN_TEMPLATES: DiaryTemplate[] = [
  {
    id: 'freewrite',
    name: '自由书写',
    icon: '✍️',
    description: '空白页面，随心所欲地写',
    content: '',
  },
  {
    id: 'morning-pages',
    name: '晨间日记',
    icon: '🌅',
    description: '今日计划、心态、感恩',
    content: `## 今日计划

- 

## 心态

今天的状态如何？

## 感恩三件事

1. 
2. 
3. 
`,
  },
  {
    id: 'evening-review',
    name: '晚间复盘',
    icon: '🌙',
    description: '今日成就、问题、明日计划',
    content: `## 今日成就



## 遇到的问题



## 明日计划



## 今日感悟


`,
  },
  {
    id: 'gratitude',
    name: '感恩日记',
    icon: '🙏',
    description: '记录感恩的事与反思',
    content: `## 今天感恩的三件事

1. 
2. 
3. 

## 为什么感恩



## 如何回馈


`,
  },
  {
    id: 'work-log',
    name: '工作日志',
    icon: '💼',
    description: '任务、问题、学习、明日重点',
    content: `## 完成的任务

- [ ] 

## 遇到的问题



## 学到的东西



## 明日重点


`,
  },
  {
    id: 'weekly-review',
    name: '周回顾',
    icon: '📅',
    description: '本周总结与下周目标',
    content: `## 本周回顾



## 重要成果



## 下周目标



## 本周心情总结


`,
  },
  {
    id: 'mood-check',
    name: '心情记录',
    icon: '💭',
    description: '心情、原因、应对方式',
    content: `## 今天的心情



## 原因分析



## 应对方式



## 自我关怀计划


`,
  },
  {
    id: 'travel',
    name: '旅行日记',
    icon: '✈️',
    description: '目的地、行程、感受',
    content: `## 目的地



## 今日行程



## 所见所感



## 美食推荐



## 旅行贴士


`,
  },
];

/** 根据 ID 获取模板 */
export function getTemplateById(id: string, customTemplates?: DiaryTemplate[]): DiaryTemplate | undefined {
  const found = BUILTIN_TEMPLATES.find(t => t.id === id);
  if (found) return found;
  return customTemplates?.find(t => t.id === id);
}

/** 获取所有模板（内置 + 自定义） */
export function getAllTemplates(customTemplates?: DiaryTemplate[]): DiaryTemplate[] {
  return [...BUILTIN_TEMPLATES, ...(customTemplates || [])];
}
