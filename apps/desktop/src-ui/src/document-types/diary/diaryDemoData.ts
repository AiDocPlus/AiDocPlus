/**
 * 日记示例数据 — 30天示例日记
 */
import type { DiaryDocumentContent } from './types';

function genId(prefix: string, idx: number): string {
  return `${prefix}_demo_${idx}`;
}

export function createDemoDiaryContent(): DiaryDocumentContent {
  const workJournal = { id: genId('dj', 1), name: '工作日记', icon: '💼', color: '#3b82f6', sortOrder: 0 };
  const lifeJournal = { id: genId('dj', 2), name: '生活日记', icon: '🌱', color: '#22c55e', sortOrder: 1 };

  const today = new Date();
  const entries = [];

  const sampleData: { dayOffset: number; journalIdx: number; title: string; content: string; mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible'; weather: 'sunny' | 'cloudy' | 'rainy' | 'overcast'; temp: number; tags: string[] }[] = [
    { dayOffset: 0, journalIdx: 0, title: '项目进展顺利', content: '今天完成了日记模块的核心架构设计，三栏布局的方案确定了。\n\n## 完成的工作\n- 数据模型设计\n- 日历组件原型\n- 工具栏布局\n\n## 明日计划\n- AI 侧栏设计\n- 导出功能', mood: 'great', weather: 'sunny', temp: 22, tags: ['工作', '编程'] },
    { dayOffset: -1, journalIdx: 1, title: '周末散步', content: '下午去公园散了步，春天的花开得很好。\n\n看到有老人在打太极，小朋友在放风筝，很平和的画面。', mood: 'good', weather: 'sunny', temp: 20, tags: ['运动', '生活'] },
    { dayOffset: -2, journalIdx: 0, title: '代码审查', content: '今天做了三个 PR 的代码审查，发现了几个潜在的性能问题。\n\n## 发现的问题\n1. 不必要的重渲染\n2. 数据没有做缓存\n3. 回调函数没有 useCallback\n\n写了改进建议给同事。', mood: 'okay', weather: 'cloudy', temp: 18, tags: ['工作', '代码审查'] },
    { dayOffset: -3, journalIdx: 1, title: '读了一本好书', content: '今天读完了《原子习惯》，核心观点是微小改变带来巨大变化。\n\n## 关键启发\n- 习惯叠加法：在已有习惯后面加新习惯\n- 环境设计：让好习惯变得明显\n- 两分钟规则：任何新习惯都从两分钟开始', mood: 'great', weather: 'overcast', temp: 16, tags: ['阅读', '自我提升'] },
    { dayOffset: -5, journalIdx: 0, title: '紧急bug修复', content: '线上出了一个严重bug，花了大半天排查。最终发现是一个边界条件没处理好。\n\n教训：上线前要更仔细地测试边界情况。', mood: 'bad', weather: 'rainy', temp: 14, tags: ['工作', 'bug'] },
    { dayOffset: -7, journalIdx: 1, title: '和朋友聚餐', content: '晚上和大学同学聚了餐，聊了很多近况。\n\n大家都在各自的领域努力着，虽然方向不同，但都在成长。\n\n约好下个月再聚。', mood: 'great', weather: 'sunny', temp: 21, tags: ['社交', '朋友'] },
    { dayOffset: -10, journalIdx: 0, title: '学习新技术', content: '今天花时间学习了 Rust 的所有权系统。\n\n## 笔记\n- 所有权是 Rust 独特的内存管理方式\n- 每个值有且只有一个所有者\n- 借用可以是不可变的或可变的，但不能同时存在', mood: 'good', weather: 'cloudy', temp: 17, tags: ['学习', 'Rust'] },
    { dayOffset: -14, journalIdx: 1, title: '心情低落的一天', content: '今天没什么特别的事，但就是觉得心情不太好。\n\n可能是最近太累了，需要好好休息一下。\n\n晚上泡了个澡，听了会音乐，感觉稍微好了一些。', mood: 'bad', weather: 'rainy', temp: 12, tags: ['心情', '休息'] },
    { dayOffset: -20, journalIdx: 0, title: '月度总结', content: '## 本月完成\n- 项目 A 上线\n- 学习了 3 个新技术\n- 团队效率提升 20%\n\n## 下月目标\n- 完成日记模块\n- 开始 AI 助手开发\n\n总的来说，这个月收获不少。', mood: 'good', weather: 'sunny', temp: 19, tags: ['工作', '总结'] },
    { dayOffset: -25, journalIdx: 1, title: '早起跑步', content: '今天 6 点就起来跑步了，跑了 5 公里。\n\n早晨的空气特别清新，跑完之后整个人都精神了。\n\n目标是这个月跑够 100 公里。', mood: 'great', weather: 'sunny', temp: 15, tags: ['运动', '跑步'] },
  ];

  for (let i = 0; i < sampleData.length; i++) {
    const s = sampleData[i];
    const d = new Date(today);
    d.setDate(d.getDate() + s.dayOffset);
    const dateStr = d.toISOString().slice(0, 10);
    const journal = s.journalIdx === 0 ? workJournal : lifeJournal;
    entries.push({
      id: genId('de', i),
      journalId: journal.id,
      date: dateStr,
      time: `${String(8 + Math.floor(Math.random() * 12)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      title: s.title,
      content: s.content,
      mood: s.mood,
      weather: { type: s.weather, temperature: s.temp },
      location: undefined,
      tags: s.tags,
      privateNote: undefined,
      templateId: undefined,
      wordCount: s.content.replace(/\s/g, '').length,
      createdAt: d.getTime(),
      updatedAt: d.getTime(),
      starred: i === 0 || i === 3,
    });
  }

  return {
    version: 1,
    settings: {
      defaultJournalId: workJournal.id,
      defaultTemplate: 'freewrite',
      weekStartsOn: 1,
      showWeather: true,
      showMood: true,
      showLocation: true,
      dailyPromptEnabled: false,
      tags: ['工作', '生活', '编程', '阅读', '运动', '社交', '学习', '心情', '自我提升'],
    },
    journals: [workJournal, lifeJournal],
    entries,
    metadata: {
      currentStreak: 2,
      longestStreak: 5,
      totalEntries: entries.length,
      totalWords: entries.reduce((sum, e) => sum + e.wordCount, 0),
      customTemplates: [],
    },
  };
}
