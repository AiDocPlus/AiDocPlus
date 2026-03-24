# 散文文档类型（Essay）— 完整设计规划

> 文档类型 ID: `essay`  
> 布局模式: `full`（三栏单篇模式）  
> 类别: `creative`  
> 文件后缀: `.aidoc-essay`

---

## 一、设计理念

散文是一种"形散神聚"的文学体裁，强调意境、修辞、情感线索和文学性。与小说的多章节叙事管理、日记的按日条目管理不同，散文文档类型聚焦于**单篇作品的深度创作辅助**：

| 维度 | 小说 | 日记 | **散文** |
|------|------|------|----------|
| 管理粒度 | 卷/章/场景 | 日期/条目 | **段落/结构角色** |
| 左栏功能 | 卷章树+设定集 | 日历+条目列表 | **段落导航+素材库+写作设置** |
| AI 重点 | 续写/角色/伏笔 | 反思/心情/日报 | **修辞/意象/结构/风格/意境** |
| 核心特色 | 世界观管理 | 情绪追踪 | **文学性分析与增强** |

---

## 二、UI 布局设计

### 2.1 整体结构（三栏）

```
┌─────────────────────────────────────────────────────────────────┐
│ 工具栏 [子类型选择] [字数] [阅读时间] [修辞高亮] [专注] [导出]   │
├──────────┬──────────────────────────────────┬───────────────────┤
│          │                                  │                   │
│  左栏     │        中栏（编辑器）             │  右栏（AI 助手）   │
│  240px   │        flex-1                    │  360px            │
│          │                                  │                   │
│ ┌──────┐ │  ┌────────────────────────────┐  │  ┌─────────────┐ │
│ │Tab栏 │ │  │                            │  │  │ 快捷操作栏  │ │
│ │导航  │ │  │                            │  │  │ ─────────── │ │
│ │素材  │ │  │       Markdown 编辑器       │  │  │             │ │
│ │设置  │ │  │                            │  │  │  消息列表    │ │
│ │──────│ │  │                            │  │  │             │ │
│ │      │ │  │                            │  │  │             │ │
│ │ 内容  │ │  │                            │  │  │             │ │
│ │ 区域  │ │  │                            │  │  │ ─────────── │ │
│ │      │ │  │                            │  │  │  输入区域    │ │
│ └──────┘ │  └────────────────────────────┘  │  └─────────────┘ │
│          │  状态栏 [字数|段落|修辞|阅读时间]  │                   │
└──────────┴──────────────────────────────────┴───────────────────┘
```

### 2.2 左栏 — 三个 Tab 页

#### Tab 1: 段落导航（MapPin 图标）

自动解析文章内容，按段落生成导航列表：

```
┌─ 段落导航 ─────────────────────┐
│ 🏷️ 结构视图                    │
│                                │
│  ▸ [开] 第1段: "月光如水，洒..."  │  ← 点击跳转
│  ▸ [承] 第2段: "记得那年夏天..."  │  ← 结构角色标签
│  ▸ [承] 第3段: "母亲常说..."     │
│  ▸ [转] 第4段: "然而时光荏苒..."  │  ← 可拖拽重排
│  ▸ [合] 第5段: "如今再回首..."   │
│                                │
│ ─────────────────────────────  │
│ 📊 结构分析                     │
│  主题线索: 乡愁·时光             │
│  情感走势: ━━╱━━╲━━━╱━━        │  ← 迷你情感曲线
│  修辞密度: ████░░ 68%           │
│  结构评分: ★★★★☆ 4.2          │
└────────────────────────────────┘
```

**功能详细**：
- 自动按空行/段落分割文本，生成段落列表
- 每个段落显示结构角色标签：**开**（开篇/引子）、**承**（承接/展开）、**转**（转折/深化）、**合**（收束/升华）
- 结构角色可手动标注，也可 AI 自动识别
- 点击段落跳转到编辑器对应位置
- 拖拽段落可调整顺序
- 底部显示结构分析摘要：主题线索、情感走势迷你图、修辞密度、结构评分

#### Tab 2: 素材库（Palette 图标）

个人写作素材的收集与管理：

```
┌─ 素材库 ───────────────────────┐
│ [+ 新建素材] [搜索...]          │
│                                │
│ 📌 灵感片段 (3)                 │
│  · "秋天的第一片落叶..."         │
│  · "城市的霓虹从不眠..."         │
│  · "老屋门前的石榴树..."         │
│                                │
│ 💬 引用语录 (2)                 │
│  · "生活在别处" —— 昆德拉        │
│  · "人生若只如初见" —— 纳兰性德   │
│                                │
│ 🎨 意象笔记 (4)                 │
│  · 月光 → 思乡、孤独、纯净       │
│  · 雨 → 忧愁、洗涤、新生         │
│  · 老树 → 岁月、坚守、沧桑       │
│  · 燕子 → 归来、春天、离别        │
│                                │
│ 📎 参考文段 (1)                 │
│  · 朱自清《背影》节选            │
└────────────────────────────────┘
```

**功能详细**：
- 4 种素材分类：**灵感片段**、**引用语录**、**意象笔记**、**参考文段**
- 每条素材支持：标题、内容、标签、来源
- 搜索过滤功能
- 双击或拖拽素材可插入到编辑器
- 素材与文档一起保存（存储在 JSON content 中）

#### Tab 3: 写作设置（Settings 图标）

```
┌─ 写作设置 ──────────────────────┐
│                                 │
│ 散文子类型                       │
│ ┌───────────────────────────┐   │
│ │ ▼ 抒情散文                 │   │  ← 下拉选择
│ └───────────────────────────┘   │
│                                 │
│ 主题/线索                        │
│ ┌───────────────────────────┐   │
│ │ 乡愁与时光                  │   │
│ └───────────────────────────┘   │
│                                 │
│ 关键意象                         │
│ [月光] [老屋] [石榴树] [+]       │  ← 标签输入
│                                 │
│ 目标风格                         │
│ ┌───────────────────────────┐   │
│ │ ▼ 自由风格                 │   │  ← 或选择名家风格
│ └───────────────────────────┘   │
│                                 │
│ 目标字数  ┌──────┐              │
│           │ 2000 │              │
│           └──────┘              │
│                                 │
│ 情感基调                         │
│ ○ 温暖  ● 忧伤  ○ 豪放          │
│ ○ 淡然  ○ 激昂  ○ 自定义        │
│                                 │
│ ─────────────────────────────   │
│ 🎯 名家风格参考                  │
│  · 朱自清 — 清新质朴，细腻真挚    │
│  · 余秋雨 — 厚重磅礴，历史文化    │
│  · 林清玄 — 禅意悠远，淡泊宁静    │
│  · 汪曾祺 — 平淡从容，烟火气      │
│  · 张晓风 — 华美深情，哲思飞扬    │
│  · 史铁生 — 沉静深邃，生命省思    │
│  · 冰心 — 温婉细腻，爱与美        │
│  · 三毛 — 洒脱自由，异域风情      │
└─────────────────────────────────┘
```

### 2.3 中栏 — 编辑器区域

**工具栏（顶部）**— 对照小说/日记工具栏，包含全部通用按钮：

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [◀左栏] [子类型▼] | [新建] [关闭] [全关] | [保存] [全保] |                   │
│ [版本历史] [仪表盘] [导出] [设置] | [修辞高亮] [意象标注] [专注] [外观▼] ─→ [AI▶] │
└──────────────────────────────────────────────────────────────────────────────┘
```

按钮明细（从左到右）：

| 按钮 | 图标 | 快捷键 | 说明 |
|------|------|--------|------|
| 左栏开关 | PanelLeftOpen/Close | — | 显示/隐藏左栏 |
| 散文子类型 | Feather+ChevronDown | — | 下拉切换子类型（抒情/叙事/议论/游记/哲理） |
| ── 分隔线 ── | | | |
| 新建散文 | FilePlus | ⌘N | 新建空白散文（重置当前文档） |
| 关闭标签 | X | — | 关闭当前标签页 |
| 关闭所有标签 | XCircle | — | 关闭所有标签页 |
| ── 分隔线 ── | | | |
| 保存 | Save | ⌘S | 保存当前文档 |
| 全部保存 | SaveAll | ⌘⇧S | 保存所有已修改的文档 |
| ── 分隔线 ── | | | |
| 版本历史 | History | — | 查看/恢复快照 |
| 仪表盘 | BarChart3 | — | 统计面板（字数、修辞、结构评分等） |
| 导出 | FileDown | — | 导出为 Markdown / 纯文本 |
| 设置 | Settings | — | 打开写作设置弹窗 |
| ── 分隔线 ── | | | |
| 修辞高亮 | Sparkles | — | 切换修辞手法高亮显示 |
| 意象标注 | Palette | — | 切换意象关键词高亮显示 |
| 专注模式 | Maximize2 | ⌘E | 隐藏左右栏，沉浸写作 |
| 编辑器外观 | Type+ChevronDown | — | 字体、字号、行距、主题等 |
| ── 弹性空白 ── | | | 推送右侧按钮到最右 |
| AI 开关 | PanelRightOpen/Close | — | 显示/隐藏 AI 助手面板 |

**编辑器**：
- Markdown 编辑器，与小说/日记共用底层
- 支持选中文本弹出 AI 快捷操作浮动工具栏（参照小说的 SelectionToolbar）
- 修辞高亮模式：自动检测并用彩色下划线标注修辞手法
- 意象高亮模式：自动识别并标注核心意象词汇

**选中文本浮动工具栏**：
```
┌──────────────────────────────────────────┐
│ [润色] [扩写] [修辞增强] [意象化] [精简] │
└──────────────────────────────────────────┘
```

**状态栏（底部）**：
```
📝 1,856字 | 📄 12段 | ✨ 8处修辞 | ⏱ 约6分钟阅读 | 💾 已保存
```

### 2.4 右栏 — AI 助手面板

完全参照 NovelAISidebar / DiaryAISidebar 的架构：

- 多会话管理（新建/切换/删除，持久化存储）
- 流式输出 + think 标签折叠 + Markdown 渲染
- AI 服务选择器（select 下拉菜单）
- 联网开关
- 深度思考开关
- 上下文模式切换
- 消息操作（复制/重新生成/编辑/插入到文章）
- 系统提示词编辑面板

---

## 三、数据结构设计

### 3.1 核心类型 (`types.ts`)

```typescript
// ═══ 散文子类型 ═══
export type EssaySubtype =
  | 'lyrical'      // 抒情散文
  | 'narrative'    // 叙事散文
  | 'argumentative' // 议论散文
  | 'travel'       // 游记散文
  | 'philosophical' // 哲理散文
  | 'custom';       // 自定义

// ═══ 情感基调 ═══
export type EssayMood =
  | 'warm'       // 温暖
  | 'melancholy' // 忧伤
  | 'heroic'     // 豪放
  | 'serene'     // 淡然
  | 'passionate' // 激昂
  | 'custom';     // 自定义

// ═══ 结构角色（起承转合）═══
export type ParagraphRole = 'open' | 'carry' | 'turn' | 'close' | 'none';

// ═══ 名家风格 ═══
export type MasterStyle =
  | 'zhu-ziqing'   // 朱自清
  | 'yu-qiuyu'     // 余秋雨
  | 'lin-qingxuan'  // 林清玄
  | 'wang-zengqi'   // 汪曾祺
  | 'zhang-xiaofeng' // 张晓风
  | 'shi-tiesheng'  // 史铁生
  | 'bing-xin'     // 冰心
  | 'san-mao'      // 三毛
  | 'free';         // 自由风格

// ═══ 素材类型 ═══
export type MaterialType = 'inspiration' | 'quote' | 'imagery' | 'reference';

export interface EssayMaterial {
  id: string;
  type: MaterialType;
  title: string;
  content: string;
  source?: string;      // 来源（引用语录的作者等）
  tags: string[];
  createdAt: string;     // ISO date
}

// ═══ 段落信息（自动解析 + 手动标注）═══
export interface EssayParagraph {
  id: string;
  index: number;        // 段落序号
  preview: string;      // 前30字预览
  role: ParagraphRole;  // 结构角色
  roleManual: boolean;  // 是否手动标注
  startOffset: number;  // 在正文中的起始位置
  endOffset: number;    // 结束位置
  wordCount: number;
}

// ═══ 修辞标注 ═══
export type RhetoricType =
  | 'metaphor'       // 比喻
  | 'personification' // 拟人
  | 'parallelism'    // 排比
  | 'synesthesia'    // 通感
  | 'hyperbole'      // 夸张
  | 'rhetorical-question' // 反问
  | 'contrast'       // 对比
  | 'allusion'       // 引用/用典
  | 'repetition'     // 反复
  | 'symbolism'      // 象征
  | 'other';

export interface RhetoricAnnotation {
  id: string;
  type: RhetoricType;
  startOffset: number;
  endOffset: number;
  text: string;         // 原文片段
  note?: string;        // 批注说明
  autoDetected: boolean; // 是否自动检测
}

// ═══ 意象标注 ═══
export interface ImageryAnnotation {
  id: string;
  keyword: string;       // 意象关键词（月光、雨、老树等）
  meaning: string;       // 象征含义
  occurrences: number[]; // 出现位置（offset 数组）
}

// ═══ 写作设置 ═══
export interface EssaySettings {
  subtype: EssaySubtype;
  theme: string;            // 主题/线索
  keyImagery: string[];     // 关键意象列表
  targetStyle: MasterStyle;
  customStyleDesc?: string; // 自定义风格描述
  targetWordCount: number;
  mood: EssayMood;
  customMoodDesc?: string;
}

// ═══ 快照 ═══
export interface EssaySnapshot {
  id: string;
  content: string;
  wordCount: number;
  createdAt: string;
  label?: string;
}

// ═══ 分析缓存 ═══
export interface EssayAnalysisCache {
  lastAnalyzedAt: string;
  contentHash: string;       // 用于判断内容是否变化
  rhetoricsCount: number;
  imageryCount: number;
  structureScore: number;    // 1-5
  literaryScore: number;     // 1-5
  emotionFlow: number[];     // 每段情感强度 0-10
  themeSummary: string;
}

// ═══ 文档顶级结构 ═══
export interface EssayDocumentContent {
  version: number;
  content: string;           // Markdown 正文

  // 元数据
  title: string;
  subtitle?: string;
  author?: string;
  createdAt: string;
  updatedAt: string;

  // 写作设置
  settings: EssaySettings;

  // 素材库
  materials: EssayMaterial[];

  // 段落信息（自动解析 + 缓存）
  paragraphs: EssayParagraph[];

  // 修辞标注
  rhetorics: RhetoricAnnotation[];

  // 意象标注
  imagery: ImageryAnnotation[];

  // 快照
  snapshots: EssaySnapshot[];

  // 分析缓存
  analysisCache?: EssayAnalysisCache;
}
```

### 3.2 工具函数 (`types.ts` 中)

```typescript
// 生成唯一 ID
function genId(prefix: string): string;

// ── 段落管理 ──
function parseParagraphs(content: string): EssayParagraph[];
function getParagraphByIndex(essay: EssayDocumentContent, index: number): EssayParagraph | null;
function updateParagraphRole(essay: EssayDocumentContent, paragraphId: string, role: ParagraphRole): EssayDocumentContent;

// ── 素材管理 ──
function addMaterial(essay: EssayDocumentContent, material: Omit<EssayMaterial, 'id' | 'createdAt'>): EssayDocumentContent;
function updateMaterial(essay: EssayDocumentContent, id: string, updates: Partial<EssayMaterial>): EssayDocumentContent;
function deleteMaterial(essay: EssayDocumentContent, id: string): EssayDocumentContent;
function getMaterialsByType(essay: EssayDocumentContent, type: MaterialType): EssayMaterial[];

// ── 修辞标注 ──
function addRhetoric(essay: EssayDocumentContent, rhetoric: Omit<RhetoricAnnotation, 'id'>): EssayDocumentContent;
function removeRhetoric(essay: EssayDocumentContent, id: string): EssayDocumentContent;
function getRhetoricsByType(essay: EssayDocumentContent, type: RhetoricType): RhetoricAnnotation[];

// ── 意象标注 ──
function addImagery(essay: EssayDocumentContent, imagery: Omit<ImageryAnnotation, 'id'>): EssayDocumentContent;
function removeImagery(essay: EssayDocumentContent, id: string): EssayDocumentContent;

// ── 快照 ──
function createSnapshot(essay: EssayDocumentContent, label?: string): EssayDocumentContent;
function restoreSnapshot(essay: EssayDocumentContent, snapshotId: string): EssayDocumentContent;

// ── 统计 ──
function getWordCount(content: string): number;
function getReadingTime(content: string): number;  // 分钟
function getRhetoricCount(essay: EssayDocumentContent): number;
function getParagraphCount(essay: EssayDocumentContent): number;

// ── 内容提取 ──
function extractPlainText(content: string): string;  // JSON → 纯文本
function createEmptyContent(): string;  // 空文档 JSON
```

---

## 四、AI 上下文引擎 (`essayContext.ts`)

### 4.1 写作阶段检测

```typescript
export type EssayPhase = 'blank' | 'drafting' | 'structuring' | 'polishing';

function detectEssayPhase(essay: EssayDocumentContent): EssayPhase {
  // blank: 正文为空或 < 50 字
  // drafting: 正文 < 500 字，修辞标注少
  // structuring: 正文 >= 500 字，正在调整结构
  // polishing: 大部分段落已标注结构角色，进入润色阶段
}
```

### 4.2 上下文模式

```typescript
export type EssayContextMode = 'paragraph' | 'full' | 'materials' | 'style';

// paragraph: 当前段落 + 前后段落上下文
// full: 全文 + 设置 + 分析
// materials: 全文 + 素材库内容
// style: 全文 + 目标风格描述 + 名家风格参考
```

### 4.3 智能系统提示词

根据散文子类型和写作阶段动态生成 system prompt：

```typescript
function buildEssaySystemPrompt(
  essay: EssayDocumentContent,
  mode: EssayContextMode,
): string {
  // 基础角色：专业散文写作顾问
  // + 子类型专属指导（抒情/叙事/议论/游记/哲理）
  // + 阶段专属建议（blank/drafting/structuring/polishing）
  // + 目标风格参考
  // + 当前分析缓存摘要
}
```

### 4.4 子类型专属提示词

| 子类型 | AI 角色重点 |
|--------|------------|
| 抒情散文 | 注重意象营造、情感渲染、修辞运用、抒情节奏 |
| 叙事散文 | 注重故事线索、人物刻画、细节描写、叙事视角 |
| 议论散文 | 注重论点提炼、论据选择、逻辑推理、说服力 |
| 游记散文 | 注重景物描写、文化底蕴、感官体验、行文节奏 |
| 哲理散文 | 注重思辨深度、哲理提炼、意象象征、深层感悟 |

---

## 五、AI 快捷操作 (`essayQuickActions.ts`)

### 8 大分类，约 40 个操作

#### 1. 创作类（PenLine）
| ID | 名称 | 描述 |
|----|------|------|
| `create_continue` | AI 续写 | 根据上下文续写散文正文 |
| `create_expand` | 扩写段落 | 对选中段落进行扩展，增加细节和描写 |
| `create_opening` | 生成开头 | 根据主题和风格生成引人入胜的开头 |
| `create_ending` | 生成结尾 | 根据全文生成升华性的结尾 |
| `create_transition` | 过渡段 | 在两段之间生成自然的过渡段落 |

#### 2. 修辞类（Sparkles）
| ID | 名称 | 描述 |
|----|------|------|
| `rhetoric_suggest` | 修辞建议 | 分析选中文段，建议可用的修辞手法 |
| `rhetoric_metaphor` | 比喻生成 | 为描述对象生成精妙的比喻 |
| `rhetoric_parallelism` | 排比生成 | 将选中内容改写为排比句式 |
| `rhetoric_synesthesia` | 通感描写 | 将单一感官描写转化为通感描写 |
| `rhetoric_personify` | 拟人化 | 将景物/事物描写转化为拟人化表达 |

#### 3. 意象类（Palette）
| ID | 名称 | 描述 |
|----|------|------|
| `imagery_analyze` | 意象分析 | 分析全文意象使用情况和象征含义 |
| `imagery_expand` | 意象扩展 | 围绕核心意象生成衍生描写 |
| `imagery_atmosphere` | 意境营造 | 根据情感基调营造特定意境 |
| `imagery_sensory` | 五感描写 | 为场景增加视觉/听觉/嗅觉/触觉/味觉描写 |
| `imagery_symbol` | 象征建议 | 推荐可用的象征意象及其文化含义 |

#### 4. 结构类（LayoutGrid）
| ID | 名称 | 描述 |
|----|------|------|
| `struct_analyze` | 结构分析 | 分析全文"形散神聚"程度，评估结构合理性 |
| `struct_roles` | 自动标注结构 | AI 自动识别各段的起承转合角色 |
| `struct_reorder` | 段落重组建议 | 建议更优的段落排列顺序 |
| `struct_theme` | 主题提炼 | 从全文中提炼核心主题和线索 |
| `struct_logic` | 逻辑检查 | 检查段落间的逻辑衔接是否自然 |

#### 5. 风格类（Brush）
| ID | 名称 | 描述 |
|----|------|------|
| `style_analyze` | 风格分析 | 分析当前写作风格特征 |
| `style_imitate` | 风格模仿 | 按目标名家风格改写选中段落 |
| `style_score` | 文学性评分 | 从多个维度评估文章文学性（1-5） |
| `style_fingerprint` | 风格指纹 | 生成详细的写作风格指纹报告 |
| `style_compare` | 风格对比 | 将当前风格与目标名家风格做对比分析 |

#### 6. 润色类（Wand2）
| ID | 名称 | 描述 |
|----|------|------|
| `polish_language` | 语言润色 | 提升语言表达的文学性和精确性 |
| `polish_rhythm` | 节奏调整 | 优化句子长短交错的节奏感 |
| `polish_emotion` | 情感升华 | 加深情感表达的感染力 |
| `polish_visual` | 画面感增强 | 增加画面描写，提升读者的代入感 |
| `polish_simplify` | 精简文字 | 删除冗余表达，使文字更凝练 |

#### 7. 审视类（Eye）
| ID | 名称 | 描述 |
|----|------|------|
| `review_reader` | 读者视角审视 | 以读者身份阅读全文，指出阅读体验问题 |
| `review_emotion` | 情感线索追踪 | 追踪全文情感变化脉络，检查是否连贯 |
| `review_coherence` | 主题一致性 | 检查全文是否始终围绕核心主题 |
| `review_proofread` | 语言校对 | 检查错别字、病句、标点问题 |
| `review_originality` | 原创性检查 | 检查是否有陈词滥调或过度模仿 |

#### 8. 素材类（BookOpen）
| ID | 名称 | 描述 |
|----|------|------|
| `material_inspire` | 灵感生成 | 根据主题和意象生成创作灵感 |
| `material_quote` | 引用推荐 | 推荐与主题相关的名言、诗句、典故 |
| `material_imagery` | 意象素材 | 生成与主题相关的意象及其文化含义 |
| `material_opening` | 开头灵感 | 提供多种不同风格的开头方案 |
| `material_related` | 相关阅读 | 推荐与当前主题相关的散文佳作 |

---

## 六、AI 建议芯片与阶段指示 (`essaySuggestions.ts`)

### 6.1 阶段指示器

| 阶段 | 标签 | 颜色 |
|------|------|------|
| blank | 空白 | text-muted-foreground |
| drafting | 初稿 | text-amber-600 |
| structuring | 构思 | text-blue-600 |
| polishing | 润色 | text-green-600 |

### 6.2 动态建议芯片

**blank 阶段**：
- 🔥 开始写作 — 根据主题生成开头
- 💡 获取灵感 — 生成写作灵感和切入角度
- 📋 拟定结构 — 生成散文大纲/结构框架

**drafting 阶段**：
- ✏️ 续写下段 — 续写正文
- 🎨 增加意象 — 为当前段落增加意象描写
- 🔀 换个角度 — 从不同视角重写当前段落

**structuring 阶段**：
- 📊 结构分析 — 分析全文起承转合
- 🔗 逻辑梳理 — 检查段落间衔接
- 🎯 主题聚焦 — 检查是否形散神聚

**polishing 阶段**：
- ✨ 全文润色 — 提升整体语言质量
- 👁️ 读者审视 — 以读者视角审阅
- 📝 生成摘要 — 生成文章摘要/简介

---

## 七、文件结构

```
src/document-types/essay/
├── definition.ts              # DocTypeDefinition 注册定义
├── types.ts                   # 数据结构 + 工具函数
├── EssayDocWorkspace.tsx       # 主工作区（三栏布局容器）
├── EssayAISidebar.tsx          # AI 助手面板
├── essayContext.ts            # AI 上下文引擎（阶段检测+系统提示词）
├── essayQuickActions.ts       # 快捷操作定义（8类~40个）
├── essaySuggestions.ts        # 动态建议芯片+阶段指示
├── essayAnalysis.ts           # 文本分析工具（修辞检测、意象统计等）
├── constants.ts               # 常量（名家风格描述、修辞类型标签等）
├── components/
│   ├── ParagraphNavigator.tsx  # 段落导航面板
│   ├── MaterialLibrary.tsx     # 素材库面板
│   ├── EssaySettingsPanel.tsx  # 写作设置面板
│   ├── RhetoricHighlighter.tsx # 修辞高亮渲染器
│   ├── EmotionFlowChart.tsx    # 情感走势迷你图
│   └── EssayStatusBar.tsx      # 状态栏
└── i18n/
    ├── zh.ts                  # 中文翻译
    └── en.ts                  # 英文翻译
```

---

## 八、definition.ts 注册定义

```typescript
import { lazy } from 'react';
import type { DocTypeDefinition } from '@/doctype-sdk/types';

const EssayDocWorkspace = lazy(() => import('./EssayDocWorkspace'));

export const essayDocType: DocTypeDefinition = {
  id: 'essay',
  version: 1,
  labelKey: 'doctype.essay.label',         // 散文
  descriptionKey: 'doctype.essay.description', // 散文写作工作区
  icon: 'Feather',                         // 羽毛笔图标
  fileSuffix: '.aidoc-essay',
  category: 'creative',
  EditorComponent: EssayDocWorkspace,
  layoutMode: 'full',
  createEmptyContent: () => JSON.stringify({
    version: 1,
    content: '',
    title: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      subtype: 'lyrical',
      theme: '',
      keyImagery: [],
      targetStyle: 'free',
      targetWordCount: 2000,
      mood: 'warm',
    },
    materials: [],
    paragraphs: [],
    rhetorics: [],
    imagery: [],
    snapshots: [],
  }),
  extractPlainText: (content: string) => {
    try {
      const data = JSON.parse(content);
      return data.content || '';
    } catch {
      return content;
    }
  },
  defaultSystemPrompt: '你是一位专业的散文写作顾问...',
  aiQuickActions: [
    { id: 'continue', labelKey: 'essay.ai.continue', icon: 'PenLine',
      promptTemplate: '请续写以下散文正文...' },
    { id: 'rhetoric', labelKey: 'essay.ai.rhetoric', icon: 'Sparkles',
      promptTemplate: '请为以下段落建议修辞手法...' },
    { id: 'polish', labelKey: 'essay.ai.polish', icon: 'Wand2',
      promptTemplate: '请对以下散文段落进行润色...' },
  ],
};
```

---

## 九、实现阶段规划

### Phase 1: 基础框架（核心骨架）
- [ ] `types.ts` — 数据结构 + 基础工具函数
- [ ] `constants.ts` — 名家风格、修辞类型等常量
- [ ] `definition.ts` — 注册定义
- [ ] `EssayDocWorkspace.tsx` — 三栏布局骨架
- [ ] 在 `register.ts` 中注册
- [ ] i18n 基础词条

### Phase 2: 编辑器核心
- [ ] 中栏编辑器集成（Markdown 编辑器）
- [ ] 工具栏（子类型选择、字数、阅读时间等）
- [ ] 状态栏
- [ ] 保存/加载功能
- [ ] 键盘快捷键

### Phase 3: 左栏面板
- [ ] 段落导航面板（自动解析 + 结构角色标注）
- [ ] 素材库面板（CRUD + 分类 + 搜索）
- [ ] 写作设置面板（子类型、主题、风格等）

### Phase 4: AI 助手面板
- [ ] `essayContext.ts` — 上下文引擎
- [ ] `essayQuickActions.ts` — 快捷操作定义
- [ ] `essaySuggestions.ts` — 建议芯片
- [ ] `EssayAISidebar.tsx` — AI 面板（多会话+流式+消息操作）

### Phase 5: 高级文学分析
- [ ] `essayAnalysis.ts` — 修辞检测、意象统计
- [ ] 修辞高亮渲染器
- [ ] 情感走势迷你图
- [ ] 结构评分
- [ ] 文学性评分

### Phase 6: 选中文本浮动工具栏
- [ ] 选中文本弹出 AI 快捷操作
- [ ] 修辞增强、意象化、润色、扩写、精简

### Phase 7: 导出与快照
- [ ] 内容快照管理
- [ ] 导出为 Markdown / 纯文本
- [ ] 可选导出分析报告

---

## 十、与现有系统的集成点

| 集成点 | 说明 |
|--------|------|
| `doctype-sdk/registry.ts` | 通过 `registerDocType(essayDocType)` 注册 |
| `register.ts` | 添加 `import { essayDocType } from './essay/definition'` |
| `_shared/styles.ts` | 复用消息气泡、快捷操作栏、工具栏等共享样式 |
| `host.doc` | 使用 `updateInMemory` 更新文档内容 |
| `host.ai` | 使用 `sendChatMessage` 调用 AI |
| `host.storage` | 使用持久化存储保存 AI 会话等 |
| `host.ui` | 使用 toast、confirm 等 UI 组件 |
| i18n | 在 `zh.ts` / `en.ts` 中添加散文相关翻译 |

---

## 十一、设计要点总结

1. **形散神聚的结构分析** — 散文最核心的文学特征，通过段落角色标注和结构分析来辅助
2. **修辞手法智能识别** — 自动检测并高亮修辞手法，是散文区别于其他文档类型的关键特色
3. **意象系统** — 意象是散文的灵魂，提供意象收集、标注、分析、营造的完整工具链
4. **名家风格参考** — 内置 8 位经典散文大家的风格描述，支持风格模仿和对比
5. **散文子类型适配** — 5 种主要散文子类型，每种有差异化的 AI 提示和分析标准
6. **素材库** — 创作过程中随手收集灵感、引用、意象的便捷工具
7. **文学性量化评估** — 通过修辞密度、意象丰富度、结构评分等维度量化文学性
8. **所有弹出菜单不透明** — 遵循全局 UI 规则，使用实色背景
9. **AI 服务使用 select 下拉** — 遵循全局 UI 规则
10. **右侧必须有 AI 聊天面板** — 遵循全局 UI 规则
