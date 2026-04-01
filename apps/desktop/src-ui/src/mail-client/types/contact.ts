// ── 联系人类型定义（增强版：含单位、分类、内嵌专属模板） ──

/** 联系人 */
export interface Contact {
  id: string;
  /** 邮箱（必填） */
  email: string;
  /** 姓名 */
  name: string;
  /** 单位/机构 */
  organization?: string;
  /** 分类（期刊/出版社/学术会议等） */
  category?: string;
  /** 备注 */
  note?: string;
  /** 分组 ID */
  groupId?: string;
  /** 收藏 */
  starred?: boolean;
  /** 创建时间 */
  createdAt?: number;
  /** 额外字段（如电话、地址等，从 CSV 导入保留） */
  extraFields?: Record<string, string>;

  // 内嵌专属投稿模板（完全独立于通用模板库）
  /** 专属主题模板（支持 {{变量}}） */
  customSubjectTemplate?: string;
  /** 专属正文模板（支持 {{变量}}） */
  customBodyTemplate?: string;
}

/** 联系人分组 */
export interface ContactGroup {
  id: string;
  name: string;
  color?: string;
}
