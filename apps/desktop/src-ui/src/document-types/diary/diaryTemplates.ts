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
  // D1.3: 引导式写作模板
  {
    id: 'five-minute',
    name: '5分钟日记',
    icon: '⏱️',
    description: '快速记录，降低写作门槛',
    content: `## 今天最重要的一件事

（一句话概括）

## 今天的情绪关键词

（用1-3个词描述）

## 一个小确幸

（哪怕很小的开心事）
`,
  },
  {
    id: 'deep-reflection',
    name: '深度反思',
    icon: '🔍',
    description: '引导式深度自我探索',
    content: `## 今天什么事最让我在意？



## 它让我产生了什么感受？

（不评判，只是感受）

## 这种感受让我想到了什么？

（过去的经历？某个人？某种模式？）

## 如果重来一次，我会怎么做？



## 我从中学到了什么？


`,
  },
  {
    id: 'time-capsule',
    name: '时间胶囊',
    icon: '💊',
    description: '写给未来的自己',
    content: `## 写给 ___（日期）的自己

亲爱的未来的我：

现在的我正在经历：


我最担心的是：


我最期待的是：


我想告诉你：


此刻的我，
___年___月___日
`,
  },
  {
    id: 'emotion-awareness',
    name: '情绪觉察',
    icon: '🧠',
    description: '正念情绪觉察练习',
    content: `## 此刻我的身体感受

（扫描身体，哪里紧张？哪里放松？）

## 我当前最明显的情绪



## 这个情绪的强度（1-10）



## 这个情绪想告诉我什么？



## 我可以为自己做什么？


`,
  },
  {
    id: 'goal-check',
    name: '目标检视',
    icon: '🎯',
    description: '定期检视目标进展',
    content: `## 我的核心目标

1. 
2. 
3. 

## 本周为目标做了什么



## 遇到的障碍



## 下一步行动计划



## 目标达成信心（1-10）


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
