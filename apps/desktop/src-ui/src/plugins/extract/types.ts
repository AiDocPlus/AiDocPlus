/**
 * 提取字段定义
 */
export interface ExtractField {
  key: string;
  label: string;
}

/**
 * 内置提取模板
 */
export interface ExtractTemplate {
  key: string;
  label: string;
  description: string;
  fields: ExtractField[];
}

/**
 * 单条提取结果（一行数据）
 */
export type ExtractRow = Record<string, string>;

/**
 * 一次提取的完整结果
 */
export interface Extraction {
  templateKey: string;
  templateLabel: string;
  fields: ExtractField[];
  rows: ExtractRow[];
  generatedAt: number;
}

/**
 * 插件数据
 */
export interface ExtractData {
  extractions: Record<string, Extraction>;
  lastPrompt?: string;
}

/**
 * 内置提取模板列表
 */
export const EXTRACT_TEMPLATES: ExtractTemplate[] = [
  {
    key: 'meeting',
    label: '会议纪要',
    description: '提取参会人、议题、决议、行动项',
    fields: [
      { key: 'topic', label: '议题' },
      { key: 'decision', label: '决议' },
      { key: 'action', label: '行动项' },
      { key: 'owner', label: '负责人' },
      { key: 'deadline', label: '截止日期' },
    ],
  },
  {
    key: 'contract',
    label: '合同要素',
    description: '提取甲乙方、金额、期限、关键条款',
    fields: [
      { key: 'party', label: '当事方' },
      { key: 'amount', label: '金额' },
      { key: 'period', label: '期限' },
      { key: 'clause', label: '关键条款' },
      { key: 'note', label: '备注' },
    ],
  },
  {
    key: 'person',
    label: '人物信息',
    description: '提取姓名、职位、联系方式等',
    fields: [
      { key: 'name', label: '姓名' },
      { key: 'title', label: '职位/头衔' },
      { key: 'org', label: '所属机构' },
      { key: 'contact', label: '联系方式' },
      { key: 'note', label: '备注' },
    ],
  },
  {
    key: 'timeline',
    label: '时间事件',
    description: '提取日期和对应事件',
    fields: [
      { key: 'date', label: '日期/时间' },
      { key: 'event', label: '事件' },
      { key: 'location', label: '地点' },
      { key: 'participant', label: '相关人员' },
    ],
  },
  {
    key: 'custom',
    label: '自定义提取',
    description: '描述你要提取的信息，AI 自动构建字段',
    fields: [],
  },
];
