/**
 * 任务清单内置模板
 *
 * 20+ 模板覆盖日常情景
 */
import type { TaskList, TaskPriority } from './types';
import { createEmptyList, createEmptyTask } from './types';

export interface TaskListTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  category: 'daily' | 'weekly' | 'project' | 'meeting' | 'personal' | 'life' | 'finance';
  icon: string;
  tasks: Array<{
    content: string;
    priority: TaskPriority;
  }>;
}

/**
 * 内置模板列表
 */
export const TASKLIST_TEMPLATES: TaskListTemplate[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 日常规划
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'workday-plan',
    nameKey: 'taskList.templates.workdayPlan',
    descriptionKey: 'taskList.templates.workdayPlanDesc',
    category: 'daily',
    icon: '📅',
    tasks: [
      { content: '查看今日日程安排', priority: 'high' },
      { content: '处理重要邮件\n筛选需要回复的邮件，优先处理紧急事项', priority: 'high' },
      { content: '完成核心工作任务', priority: 'high' },
      { content: '团队沟通与协作', priority: 'medium' },
      { content: '文档整理与归档', priority: 'low' },
      { content: '回顾今日工作，规划明日任务', priority: 'medium' },
    ],
  },
  {
    id: 'weekend-plan',
    nameKey: 'taskList.templates.weekendPlan',
    descriptionKey: 'taskList.templates.weekendPlanDesc',
    category: 'daily',
    icon: '🏖️',
    tasks: [
      { content: '睡到自然醒，补充睡眠', priority: 'low' },
      { content: '整理房间\n打扫卫生、洗衣服、整理物品', priority: 'medium' },
      { content: '阅读或学习', priority: 'medium' },
      { content: '运动锻炼\n跑步、健身或户外活动', priority: 'medium' },
      { content: '陪伴家人朋友', priority: 'high' },
      { content: '为下周做准备', priority: 'low' },
    ],
  },
  {
    id: 'morning-routine',
    nameKey: 'taskList.templates.morningRoutine',
    descriptionKey: 'taskList.templates.morningRoutineDesc',
    category: 'daily',
    icon: '🌅',
    tasks: [
      { content: '起床，喝一杯温水', priority: 'high' },
      { content: '晨间运动或冥想\n15-30分钟的轻度运动或冥想', priority: 'medium' },
      { content: '洗漱、整理仪表', priority: 'high' },
      { content: '健康早餐', priority: 'high' },
      { content: '查看日程和待办事项', priority: 'medium' },
      { content: '规划今日重点任务', priority: 'high' },
    ],
  },
  {
    id: 'evening-review',
    nameKey: 'taskList.templates.eveningReview',
    descriptionKey: 'taskList.templates.eveningReviewDesc',
    category: 'daily',
    icon: '🌙',
    tasks: [
      { content: '回顾今日完成的任务', priority: 'medium' },
      { content: '记录今日收获与反思', priority: 'medium' },
      { content: '整理明日待办事项', priority: 'high' },
      { content: '准备明日需要的物品', priority: 'low' },
      { content: '放松身心\n阅读、听音乐或轻度运动', priority: 'medium' },
      { content: '按时休息', priority: 'high' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 周/月规划
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'weekly-plan',
    nameKey: 'taskList.templates.weeklyPlan',
    descriptionKey: 'taskList.templates.weeklyPlanDesc',
    category: 'weekly',
    icon: '📆',
    tasks: [
      { content: '回顾上周目标完成情况', priority: 'high' },
      { content: '设定本周核心目标（1-3个）', priority: 'high' },
      { content: '分解目标到每日任务', priority: 'high' },
      { content: '安排重要会议和约会', priority: 'medium' },
      { content: '预留弹性时间处理突发事务', priority: 'medium' },
      { content: '规划本周学习和自我提升时间', priority: 'medium' },
      { content: '安排运动和休息时间', priority: 'medium' },
    ],
  },
  {
    id: 'monthly-goals',
    nameKey: 'taskList.templates.monthlyGoals',
    descriptionKey: 'taskList.templates.monthlyGoalsDesc',
    category: 'weekly',
    icon: '🎯',
    tasks: [
      { content: '回顾上月目标完成率', priority: 'high' },
      { content: '设定本月核心目标\n工作、学习、生活各1-2个', priority: 'high' },
      { content: '将月目标分解为周里程碑', priority: 'high' },
      { content: '安排本月重要事件和截止日期', priority: 'high' },
      { content: '预算本月开支', priority: 'medium' },
      { content: '规划本月社交活动', priority: 'low' },
      { content: '设定阅读和学习计划', priority: 'medium' },
    ],
  },
  {
    id: 'quarterly-planning',
    nameKey: 'taskList.templates.quarterlyPlanning',
    descriptionKey: 'taskList.templates.quarterlyPlanningDesc',
    category: 'weekly',
    icon: '📊',
    tasks: [
      { content: '回顾上季度关键成果', priority: 'high' },
      { content: '设定本季度OKR\n目标 + 关键结果', priority: 'high' },
      { content: '分解为月度里程碑', priority: 'high' },
      { content: '识别关键项目和任务', priority: 'high' },
      { content: '评估所需资源和支持', priority: 'medium' },
      { content: '设置检查点和回顾时间', priority: 'medium' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 项目管理
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'project-kickoff',
    nameKey: 'taskList.templates.projectKickoff',
    descriptionKey: 'taskList.templates.projectKickoffDesc',
    category: 'project',
    icon: '🚀',
    tasks: [
      { content: '明确项目目标和范围', priority: 'high' },
      { content: '识别关键利益相关者', priority: 'high' },
      { content: '制定项目计划和时间线', priority: 'high' },
      { content: '分配团队角色和职责', priority: 'high' },
      { content: '建立沟通机制', priority: 'medium' },
      { content: '设置项目里程碑', priority: 'medium' },
      { content: '识别风险和制定应对策略', priority: 'medium' },
      { content: '召开项目启动会议', priority: 'high' },
    ],
  },
  {
    id: 'project-closure',
    nameKey: 'taskList.templates.projectClosure',
    descriptionKey: 'taskList.templates.projectClosureDesc',
    category: 'project',
    icon: '🏁',
    tasks: [
      { content: '确认所有任务已完成', priority: 'high' },
      { content: '进行最终质量检查', priority: 'high' },
      { content: '整理项目文档和资料', priority: 'high' },
      { content: '撰写项目总结报告', priority: 'high' },
      { content: '召开项目复盘会议', priority: 'medium' },
      { content: '收集团队反馈和经验教训', priority: 'medium' },
      { content: '归档项目资产', priority: 'medium' },
      { content: '解散团队或重新分配资源', priority: 'low' },
    ],
  },
  {
    id: 'sprint-planning',
    nameKey: 'taskList.templates.sprintPlanning',
    descriptionKey: 'taskList.templates.sprintPlanningDesc',
    category: 'project',
    icon: '⚡',
    tasks: [
      { content: '回顾上Sprint完成情况', priority: 'high' },
      { content: '确认产品Backlog优先级', priority: 'high' },
      { content: '选择本Sprint目标', priority: 'high' },
      { content: '分解用户故事为任务', priority: 'high' },
      { content: '评估任务工作量', priority: 'medium' },
      { content: '分配任务给团队成员', priority: 'medium' },
      { content: '确认Sprint计划可行性', priority: 'high' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 会议
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'meeting-prep',
    nameKey: 'taskList.templates.meetingPrep',
    descriptionKey: 'taskList.templates.meetingPrepDesc',
    category: 'meeting',
    icon: '📋',
    tasks: [
      { content: '明确会议目的和预期成果', priority: 'high' },
      { content: '准备会议议程', priority: 'high' },
      { content: '邀请参会人员', priority: 'high' },
      { content: '预订会议室或设置在线会议', priority: 'high' },
      { content: '准备会议材料和演示文稿', priority: 'medium' },
      { content: '提前发送议程和相关资料', priority: 'medium' },
      { content: '准备需要讨论的问题清单', priority: 'medium' },
    ],
  },
  {
    id: 'meeting-followup',
    nameKey: 'taskList.templates.meetingFollowup',
    descriptionKey: 'taskList.templates.meetingFollowupDesc',
    category: 'meeting',
    icon: '✅',
    tasks: [
      { content: '整理会议纪要', priority: 'high' },
      { content: '列出决议事项和行动项', priority: 'high' },
      { content: '分配责任人及截止日期', priority: 'high' },
      { content: '发送会议纪要给参会者', priority: 'high' },
      { content: '设置提醒跟进进度', priority: 'medium' },
      { content: '更新相关项目计划', priority: 'medium' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 个人发展
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'study-plan',
    nameKey: 'taskList.templates.studyPlan',
    descriptionKey: 'taskList.templates.studyPlanDesc',
    category: 'personal',
    icon: '📚',
    tasks: [
      { content: '设定学习目标\n明确要掌握的技能或知识', priority: 'high' },
      { content: '收集学习资源\n书籍、课程、教程等', priority: 'medium' },
      { content: '制定学习计划和时间表', priority: 'high' },
      { content: '每日学习任务', priority: 'high' },
      { content: '练习和应用所学知识', priority: 'medium' },
      { content: '定期复习和总结', priority: 'medium' },
      { content: '寻求反馈和指导', priority: 'low' },
    ],
  },
  {
    id: 'reading-list',
    nameKey: 'taskList.templates.readingList',
    descriptionKey: 'taskList.templates.readingListDesc',
    category: 'personal',
    icon: '📖',
    tasks: [
      { content: '整理待读书单', priority: 'medium' },
      { content: '设定阅读目标（如每月2本）', priority: 'high' },
      { content: '安排每日阅读时间', priority: 'medium' },
      { content: '做阅读笔记', priority: 'medium' },
      { content: '写读后感或总结', priority: 'low' },
      { content: '分享阅读心得', priority: 'low' },
    ],
  },
  {
    id: 'skill-improvement',
    nameKey: 'taskList.templates.skillImprovement',
    descriptionKey: 'taskList.templates.skillImprovementDesc',
    category: 'personal',
    icon: '💪',
    tasks: [
      { content: '识别需要提升的技能', priority: 'high' },
      { content: '评估当前水平', priority: 'medium' },
      { content: '设定目标水平', priority: 'high' },
      { content: '寻找学习资源和方法', priority: 'medium' },
      { content: '制定练习计划', priority: 'high' },
      { content: '定期检查进度', priority: 'medium' },
      { content: '寻找实践机会', priority: 'medium' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 生活管理
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'travel-prep',
    nameKey: 'taskList.templates.travelPrep',
    descriptionKey: 'taskList.templates.travelPrepDesc',
    category: 'life',
    icon: '✈️',
    tasks: [
      { content: '确定行程和预订交通', priority: 'high' },
      { content: '预订住宿', priority: 'high' },
      { content: '办理签证（如需要）', priority: 'high' },
      { content: '准备证件\n身份证、护照、驾照等', priority: 'high' },
      { content: '列出行李清单并打包', priority: 'medium' },
      { content: '安排宠物或植物照料', priority: 'medium' },
      { content: '设置邮件和消息自动回复', priority: 'low' },
      { content: '查询目的地天气和景点', priority: 'medium' },
      { content: '兑换货币或准备支付方式', priority: 'medium' },
    ],
  },
  {
    id: 'moving-checklist',
    nameKey: 'taskList.templates.movingChecklist',
    descriptionKey: 'taskList.templates.movingChecklistDesc',
    category: 'life',
    icon: '🏠',
    tasks: [
      { content: '确定搬家日期', priority: 'high' },
      { content: '联系搬家公司或准备车辆', priority: 'high' },
      { content: '整理物品，区分保留/捐赠/丢弃', priority: 'high' },
      { content: '准备打包材料', priority: 'medium' },
      { content: '按房间分类打包', priority: 'high' },
      { content: '标记箱子内容和目的地', priority: 'medium' },
      { content: '更改地址和订阅转发', priority: 'high' },
      { content: '通知相关机构\n银行、保险、邮局等', priority: 'high' },
      { content: '办理水电气过户', priority: 'high' },
      { content: '清洁旧住所', priority: 'medium' },
    ],
  },
  {
    id: 'shopping-list',
    nameKey: 'taskList.templates.shoppingList',
    descriptionKey: 'taskList.templates.shoppingListDesc',
    category: 'life',
    icon: '🛒',
    tasks: [
      { content: '检查冰箱和储物柜，列出缺少的物品', priority: 'medium' },
      { content: '列出日常用品\n纸巾、洗漱用品等', priority: 'medium' },
      { content: '列出食品和饮料', priority: 'medium' },
      { content: '检查是否有特价或促销', priority: 'low' },
      { content: '准备购物袋', priority: 'low' },
    ],
  },
  {
    id: 'fitness-plan',
    nameKey: 'taskList.templates.fitnessPlan',
    descriptionKey: 'taskList.templates.fitnessPlanDesc',
    category: 'life',
    icon: '🏋️',
    tasks: [
      { content: '设定健身目标\n减脂/增肌/保持健康', priority: 'high' },
      { content: '制定每周运动计划', priority: 'high' },
      { content: '准备运动装备', priority: 'medium' },
      { content: '每日运动任务', priority: 'high' },
      { content: '记录运动数据', priority: 'medium' },
      { content: '调整饮食计划', priority: 'medium' },
      { content: '定期测量和评估进度', priority: 'medium' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 财务
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'monthly-budget',
    nameKey: 'taskList.templates.monthlyBudget',
    descriptionKey: 'taskList.templates.monthlyBudgetDesc',
    category: 'finance',
    icon: '💰',
    tasks: [
      { content: '统计上月收支情况', priority: 'high' },
      { content: '设定本月预算类别\n住房、餐饮、交通、娱乐等', priority: 'high' },
      { content: '分配各类别预算金额', priority: 'high' },
      { content: '设置自动储蓄', priority: 'medium' },
      { content: '跟踪每笔支出', priority: 'medium' },
      { content: '月底总结和调整', priority: 'medium' },
    ],
  },
  {
    id: 'financial-audit',
    nameKey: 'taskList.templates.financialAudit',
    descriptionKey: 'taskList.templates.financialAuditDesc',
    category: 'finance',
    icon: '📊',
    tasks: [
      { content: '整理所有账户信息', priority: 'high' },
      { content: '核对银行对账单', priority: 'high' },
      { content: '检查信用卡账单', priority: 'high' },
      { content: '审查订阅服务\n取消不需要的订阅', priority: 'medium' },
      { content: '评估投资组合', priority: 'medium' },
      { content: '检查保险覆盖', priority: 'medium' },
      { content: '更新财务目标', priority: 'medium' },
      { content: '制定下阶段财务计划', priority: 'high' },
    ],
  },
];

/**
 * 从模板创建任务列表
 */
export function createListFromTemplate(
  template: TaskListTemplate,
  listName: string,
  icon?: string,
): TaskList {
  const list = createEmptyList(listName, icon || template.icon);

  list.tasks = template.tasks.map((t, index) => ({
    ...createEmptyTask(),
    content: t.content,
    priority: t.priority,
    sortOrder: index,
  }));

  return list;
}

/**
 * 按分类分组模板
 */
export function groupTemplatesByCategory(
  templates: TaskListTemplate[],
): Record<string, TaskListTemplate[]> {
  const groups: Record<string, TaskListTemplate[]> = {};

  for (const template of templates) {
    if (!groups[template.category]) {
      groups[template.category] = [];
    }
    groups[template.category].push(template);
  }

  // 按预定义顺序排序
  const order = ['daily', 'weekly', 'project', 'meeting', 'personal', 'life', 'finance'];
  const sorted: Record<string, TaskListTemplate[]> = {};

  for (const cat of order) {
    if (groups[cat]) {
      sorted[cat] = groups[cat];
    }
  }

  return sorted;
}
