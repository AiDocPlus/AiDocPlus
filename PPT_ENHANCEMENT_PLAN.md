# AiDocPlus PPT 功能专业级增强方案

> 调研日期：2025-03-14
> 目标：将 PPT 功能从基础水平提升到专业级，达到主流 PPT 编辑软件水平

---

## 一、当前实现分析

### 1.1 现有架构

```
apps/desktop/src-ui/src/plugins/ppt/
├── index.ts                 # 插件注册入口
├── manifest.json            # 插件元数据（majorCategory: functional）
├── PptPluginPanel.tsx       # 主面板（PluginPanelLayout）
├── SlideDeck.tsx            # 幻灯片主界面（工具栏 + 缩略图 + 预览）
├── SlidePreview.tsx         # CSS 渲染预览组件（5 种布局）
├── SlideEditor.tsx          # 简单表单编辑器
├── SlideShow.tsx            # 全屏播放（键盘/鼠标控制）
├── pptxExport.ts            # PptxGenJS 导出
├── slideAiPrompts.ts        # AI 生成 prompt + Markdown 解析
├── PptGenerateDialog.tsx    # 提示词构造器弹窗
├── PptTemplateManager.tsx   # 模板管理
└── i18n/{zh,en,ja}.json     # 国际化
```

### 1.2 现有数据模型

```typescript
// 布局类型（5 种）
type SlideLayout = 'title' | 'section' | 'content' | 'two-column' | 'image-text' | 'blank';

// 单张幻灯片
interface Slide {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  content: string[];      // 纯文本要点数组
  notes?: string;         // 演讲者备注
  order: number;
}

// PPT 主题
interface PptTheme {
  id: string;
  name: string;
  colors: PptThemeColors;
  fonts: { title: string; body: string };
  fontSizes?: PptThemeFontSizes;
}

// 幻灯片集合
interface SlidesDeck {
  slides: Slide[];
  theme: PptTheme;
  aspectRatio: '16:9' | '4:3';
}
```

### 1.3 当前能力与主流软件差距

| 功能 | 当前 AiDocPlus | PowerPoint | WPS | Keynote | 差距 |
|------|---------------|------------|-----|---------|------|
| 布局类型 | 5 种 | 11 种 | 8 种 | 12 种 | ⚠️ 中等 |
| 主题模板 | 8 个内置 | 40+ | 30+ | 30+ | ⚠️ 较大 |
| 图片插入 | ❌ | ✅ 完整 | ✅ 完整 | ✅ 完整 | ⚠️ 较大 |
| 图表 | ❌ | 20+ 类型 | 15+ | 12+ | ⚠️ 较大 |
| 形状/图标 | ❌ | 200+ | 150+ | 100+ | ⚠️ 较大 |
| 动画效果 | ❌ | 50+ | 40+ | 30+ | ⚠️ 较大 |
| 过渡效果 | ❌ | 30+ | 25+ | 20+ | ⚠️ 较大 |
| 富文本 | ❌ 纯文本 | ✅ 完整 | ✅ 完整 | ✅ 完整 | ⚠️ 较大 |
| PPTX 导入 | ❌ | ✅ | ✅ | ❌ | - |
| 撤销/重做 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 拖拽排序 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 全屏播放 | ✅ 基础 | ✅ 完整 | ✅ 完整 | ✅ 完整 | ⚠️ 中等 |
| 演讲者视图 | ❌ | ✅ | ✅ | ✅ | ⚠️ 中等 |
| 母版编辑 | ❌ | ✅ | ✅ | ✅ | ⚠️ 中等 |
| AI 生成 | ✅ | ❌ | ❌ | ❌ | ✅ 优势 |

---

## 二、可用开源库调研

### 2.1 PPTX 生成库

| 库 | GitHub Stars | NPM 周下载 | 特点 | 推荐度 |
|---|-------------|-----------|------|--------|
| **[PptxGenJS](https://github.com/gitbrent/PptxGenJS)** | 4.5k+ | 200k+ | 最流行，支持图表/表格/200+形状，浏览器+Node | ⭐⭐⭐⭐⭐ |
| [pptx-automizer](https://github.com/singerla/pptx-automizer) | 500+ | 30k+ | 模板驱动，适合修改现有模板 | ⭐⭐⭐ |
| officegen | - | 50k+ | 多格式（DOCX/XLSX/PPTX），维护较少 | ⭐⭐ |

**PptxGenJS 核心能力**：
- ✅ 图表：柱状、折线、饼图、散点、雷达、组合图等
- ✅ 表格：自定义样式、合并单元格
- ✅ 形状：200+ 种形状（矩形、圆形、箭头、星形等）
- ✅ 图片：支持 base64、URL、文件路径
- ✅ 文本：富文本、字体、颜色、对齐
- ⚠️ 动画：有限的入场动画支持
- ✅ 母版：支持 Slide Master

### 2.2 PPTX 解析库（导入）

| 库 | 环境 | 特点 | 推荐度 |
|---|------|------|--------|
| **[pptx-parser](https://www.npmjs.com/package/pptx-parser)** | 浏览器 | 纯 JS，解析为 JSON，MIT 协议 | ⭐⭐⭐⭐ |
| [node-pptx-parser](https://www.npmjs.com/package/node-pptx-parser) | Node.js | 保留格式、换行、段落 | ⭐⭐⭐ |
| [js-pptx](https://github.com/won21kr/js-pptx) | Node.js | 读写 PPTX，保留所有内容 | ⭐⭐⭐ |

### 2.3 Canvas/设计编辑器

| 库 | 特点 | 性能 | 文档 | 推荐度 |
|---|------|------|------|--------|
| **[Konva.js](https://konvajs.org/)** | react-konva 封装好，性能优先 | 高 | 完善 | ⭐⭐⭐⭐⭐ |
| [Fabric.js](https://fabricjs.com/) | 对象模型，内置富文本 | 中 | 完善 | ⭐⭐⭐⭐ |

**Konva.js 优势**：
- 官方 React 封装（react-konva）
- 内置对象选中、缩放、旋转（Transformer）
- 良好的事件系统
- 性能优化（缓存、虚拟化）

参考：
- [Konva Canvas Editor 教程](https://konvajs.org/docs/sandbox/Canvas_Editor.html)
- [Konva vs Fabric.js 对比](https://www.oreateai.com/blog/konvajs-vs-fabricjs-choosing-your-canvas-companion/)

### 2.4 HTML 演示框架（过渡动画参考）

| 库 | 特点 | 链接 |
|---|------|------|
| **[Reveal.js](https://revealjs.com/)** | 最流行，完整过渡动画、PDF 导出、演讲者视图 | [过渡效果文档](https://revealjs.com/transitions/) |
| [impress.js](https://github.com/impress/impress.js/) | 3D/缩放效果 | GitHub |

### 2.5 其他库

| 用途 | 推荐库 | 说明 |
|------|-------|------|
| 富文本编辑 | **[TipTap](https://tiptap.dev/)** | 基于 ProseMirror，扩展性好，社区活跃 |
| 过渡动画 | **[Framer Motion](https://www.framer.com/motion/)** | 声明式，与 React 集成好，性能优秀 |
| 图表渲染 | **[ECharts](https://echarts.apache.org/)** | 类型丰富，支持导出图片，中文文档完善 |
| 图标 | **Lucide React** | 项目已用，图标丰富，支持 SVG |

---

## 三、分阶段增强方案

### Phase 1: 基础增强（2-3 周）[P0 优先级]

#### 1.1 扩展布局类型（3 天）

**目标**：从 5 种扩展到 11 种

```typescript
type SlideLayout =
  // 现有（5 种）
  | 'title'           // 封面（大标题 + 副标题）
  | 'section'         // 章节分隔页
  | 'content'         // 标题 + 要点列表
  | 'two-column'      // 双栏
  | 'blank'           // 空白
  // 新增（6 种）
  | 'title-content'   // 标题 + 内容（下方）
  | 'image-left'      // 左图右文
  | 'image-right'     // 左文右图
  | 'image-full'      // 全屏图片 + 标题覆盖
  | 'quote'           // 引用/名言页
  | 'comparison';     // 对比页（左右两栏对比）
```

**实现文件**：
- `packages/shared-types/src/index.ts` — 类型定义扩展
- `apps/desktop/src-ui/src/plugins/ppt/SlidePreview.tsx` — 新增布局渲染函数
- `apps/desktop/src-ui/src/plugins/ppt/SlideEditor.tsx` — 布局选择器 UI
- `apps/desktop/src-ui/src/plugins/ppt/pptxExport.ts` — 导出新布局

#### 1.2 图片插入与管理（4 天）

**数据模型**：

```typescript
interface ImageRef {
  id: string;
  type: 'file' | 'url' | 'base64';
  src: string;           // 文件路径 / URL / base64 data URL
  alt?: string;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover' | 'fill';
}

// Slide 扩展
interface Slide {
  // ... 现有字段
  images?: ImageRef[];
  backgroundImage?: ImageRef;
}
```

**UI 实现**：
1. 工具栏「插入图片」按钮 → 调用 `host.ui.showOpenDialog`
2. 图片管理侧边栏（缩略图列表、拖拽调整、删除/替换）
3. 图片编辑弹窗（尺寸、适配方式）

**导出适配**：
- PptxGenJS 原生支持：`pptSlide.addImage({ data: base64, x, y, w, h })`

#### 1.3 富文本编辑（4 天）

**技术选型**：TipTap（基于 ProseMirror）

**数据模型**：

```typescript
// 富文本使用 ProseMirror Document JSON 格式
type RichTextContent = {
  type: 'doc';
  content: Array<{
    type: 'paragraph' | 'bulletList';
    content?: Array<{
      type: 'text';
      text: string;
      marks?: Array<{ type: 'bold' | 'italic' | 'underline' | 'color'; attrs?: object }>;
    }>;
  }>;
};

// Slide 扩展
interface Slide {
  content: string[];           // 保留作为纯文本 fallback
  richContent?: RichTextContent[];  // 新增富文本版本
  richTitle?: RichTextContent;      // 标题富文本
}
```

**UI 实现**：
- 创建 `RichTextEditor.tsx` 组件（基于 TipTap）
- 工具栏：加粗、斜体、下划线、颜色、字号
- 点击标题/要点区域直接编辑

#### 1.4 主题系统增强（2 天）

**实现方案**：
1. 新增内置主题 — 从 8 个扩展到 20+
2. 按风格分类：商务、学术、创意、极简、科技、教育
3. 主题编辑器弹窗（颜色选择器、字体选择、字号预设）

---

### Phase 2: 可视化增强（2-3 周）[P1 优先级]

#### 2.1 Canvas 编辑器基础（5 天）

**技术选型**：Konva.js + react-konva

**架构设计**：

```
┌─────────────────────────────────────────────────────┐
│                    SlideCanvasEditor                │
│  ┌───────────────────────────────────────────────┐  │
│  │                Stage (Konva)                  │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │              Layer                      │  │  │
│  │  │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │  │  │
│  │  │  │Text │ │Image│ │Chart│ │Shape│       │  │  │
│  │  │  └─────┘ └─────┘ └─────┘ └─────┘       │  │  │
│  │  │  Transformer (选中/缩放/旋转)            │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │            工具栏（插入/对齐/层级）            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**核心数据模型**：

```typescript
interface CanvasObject {
  id: string;
  type: 'text' | 'image' | 'shape' | 'chart' | 'icon';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  props: TextProps | ImageProps | ShapeProps | ChartProps;
}

// Slide 扩展
interface Slide {
  // ...
  canvasObjects?: CanvasObject[];
  useCanvas?: boolean;  // 是否使用 Canvas 模式
}
```

**实现文件**：
- `components/canvas/SlideCanvasEditor.tsx` — 主组件
- `components/canvas/CanvasStage.tsx` — Konva Stage 封装
- `components/canvas/CanvasToolbar.tsx` — 工具栏
- `components/canvas/objects/` — 各类型对象组件

#### 2.2 形状绘制（3 天）

**支持的形状**（Konva 原生）：
- 基础：矩形、圆形、椭圆、三角形
- 线条：直线、箭头、曲线
- 复合：星形、多边形

```typescript
interface ShapeProps {
  shapeType: 'rect' | 'circle' | 'ellipse' | 'triangle' | 'star' | 'polygon' | 'line' | 'arrow';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;  // 矩形圆角
  points?: number[];      // 线条/多边形点
  numPoints?: number;     // 星形角数
}
```

#### 2.3 图表集成（4 天）

**支持的图表类型**：
- 柱状图（垂直/水平）
- 折线图（单线/多线）
- 饼图/环形图
- 条形图
- 面积图

**数据模型**：

```typescript
interface ChartRef {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'area';
  data: {
    labels: string[];
    series: Array<{ name?: string; values: number[] }>;
  };
  options?: EChartsOption;
}

// Canvas 对象扩展
interface ChartCanvasObject extends CanvasObject {
  type: 'chart';
  props: ChartRef;
}
```

**实现**：
- 图表编辑器组件（数据表格输入、类型切换、颜色主题）
- 图表渲染为图片后插入 Canvas（ECharts getDataURL）

#### 2.4 图标插入（2 天）

**图标集成**：
- 从 Lucide 图标库选择
- 插入为 SVG → Konva Path
- 支持颜色、大小调整

---

### Phase 3: 动态效果（1-2 周）[P1 优先级]

#### 3.1 过渡动画（3 天）

**技术选型**：Framer Motion

**支持的过渡效果（16 种）**：

| 类型 | 效果 | 数量 |
|------|------|------|
| 淡入淡出 | fade, crossfade | 2 |
| 滑动 | slide-left, slide-right, slide-up, slide-down | 4 |
| 缩放 | zoom-in, zoom-out | 2 |
| 推挤 | push-left, push-right, push-up, push-down | 4 |
| 翻转 | flip-x, flip-y | 2 |
| 立体 | cube-left, cube-right | 2 |

**数据模型**：

```typescript
interface SlideTransition {
  type: 'fade' | 'slide' | 'zoom' | 'push' | 'flip' | 'cube' | 'none';
  direction?: 'left' | 'right' | 'up' | 'down';
  duration: number;      // 毫秒
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

interface Slide {
  // ...
  transition?: SlideTransition;
}

interface SlidesDeck {
  // ...
  defaultTransition?: SlideTransition;
}
```

#### 3.2 演讲者视图（4 天）

**功能设计**：

```
┌─────────────────────────────────────────────────────┐
│                    演讲者视图                        │
│  ┌───────────────────────┬───────────────────────┐  │
│  │    当前幻灯片          │     下一张预览        │  │
│  │    (大图)             │     (小图)           │  │
│  ├───────────────────────┴───────────────────────┤  │
│  │                 演讲者备注                      │  │
│  │    （大字体可滚动）                             │  │
│  ├───────────────────────────────────────────────┤  │
│  │  计时器 00:15:30    页码 5/12    时钟 14:30   │  │
│  │  [开始计时] [重置] [画笔] [激光笔] [黑屏]      │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**实现**：双窗口模式（Tauri WebviewWindow）
- 主窗口：演讲者视图
- 投影窗口：全屏幻灯片
- 通过 Tauri 事件系统同步状态

#### 3.3 动画导出（2 天）

**PPTX 动画支持**（PptxGenJS）：
- 入场动画：appear, fade, fly, float, split, wipe, shape, zoom
- 配置位置：`pptSlide.animation = { type: 'appear', delay: 500 }`

---

### Phase 4: 高级功能（2-3 周）[P2 优先级]

#### 4.1 PPTX 文件导入（5 天）

**技术选型**：pptx-parser

**实现流程**：

```
用户选择 .pptx 文件
        ↓
Tauri 读取文件为 ArrayBuffer
        ↓
pptx-parser 解析为 JSON
        ↓
转换器：PPTX JSON → SlidesDeck
        ↓
加载到编辑器
```

**转换策略**：

| PPTX 元素 | AiDocPlus 对应 | 备注 |
|-----------|---------------|------|
| Slide | Slide | 直接映射 |
| Shape/Text | CanvasObject | 位置/大小转换 |
| Image | ImageRef | Base64 嵌入 |
| Chart | ChartRef + 静态图 | 图表转为图片 |
| Theme | PptTheme | 提取颜色/字体 |
| Animation | 简化或忽略 | 复杂动画难以完全还原 |

#### 4.2 母版编辑器（4 天）

**数据模型**：

```typescript
interface SlideMaster {
  id: string;
  name: string;
  background?: { color?: string; image?: ImageRef };
  placeholders: Array<{
    id: string;
    type: 'title' | 'content' | 'footer' | 'page-number' | 'date' | 'logo';
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  defaultTransition?: SlideTransition;
}

interface SlidesDeck {
  // ...
  master?: SlideMaster;
}
```

#### 4.3 幻灯片模板库（3 天）

**数据存储**：
- 内置模板：`resources/doc-templates/data/slide-templates/`
- 用户模板：`~/AiDocPlus/SlideTemplates/`

**模板结构**：

```typescript
interface SlideTemplate {
  id: string;
  name: string;
  category: 'cover' | 'content' | 'chart' | 'image' | 'ending';
  thumbnail: string;    // base64 缩略图
  slide: Slide;
}
```

---

### Phase 5: AI 增强（持续）[P2 优先级]

#### 5.1 AI 图表生成

**流程**：
1. 用户描述需求（如「展示 2024 年季度销售额对比」）
2. AI 分析文档内容 + 提取数据
3. 生成 ECharts 配置
4. 渲染图表并插入幻灯片

#### 5.2 AI 布局优化建议

**功能**：
- 分析当前幻灯片内容密度
- 建议更适合的布局类型
- 检测文字过多/过少
- 推荐配色调整

#### 5.3 AI 动画推荐

**功能**：
- 根据内容类型推荐过渡动画
- 生成渐进式列表建议

---

## 四、技术架构设计

### 4.1 数据模型完整定义

```typescript
// ============================================
// 核心类型（扩展后）
// ============================================

// 布局类型（11 种）
type SlideLayout =
  | 'title' | 'section' | 'content' | 'two-column' | 'blank'
  | 'title-content' | 'image-left' | 'image-right' | 'image-full' | 'quote' | 'comparison';

// 图片引用
interface ImageRef {
  id: string;
  type: 'file' | 'url' | 'base64';
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  fit?: 'contain' | 'cover' | 'fill';
}

// 富文本内容
interface RichTextContent {
  type: 'doc';
  content: RichTextNode[];
}

interface RichTextNode {
  type: 'paragraph' | 'bulletList' | 'orderedList';
  content?: RichTextLeaf[];
}

interface RichTextLeaf {
  type: 'text';
  text: string;
  marks?: Array<{ type: 'bold' | 'italic' | 'underline' | 'color'; attrs?: object }>;
}

// Canvas 对象
interface CanvasObject {
  id: string;
  type: 'text' | 'image' | 'shape' | 'chart' | 'icon';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  props: TextObjectProps | ImageObjectProps | ShapeObjectProps | ChartObjectProps | IconObjectProps;
}

// 过渡动画
interface SlideTransition {
  type: 'fade' | 'slide' | 'zoom' | 'push' | 'flip' | 'cube' | 'none';
  direction?: 'left' | 'right' | 'up' | 'down';
  duration: number;
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

// 幻灯片（完整定义）
interface Slide {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle?: string;
  content: string[];           // 纯文本要点（fallback）
  richContent?: RichTextContent[];  // 富文本要点
  richTitle?: RichTextContent;      // 富文本标题
  notes?: string;
  order: number;

  // 新增字段
  images?: ImageRef[];
  backgroundImage?: ImageRef;
  backgroundColor?: string;
  canvasObjects?: CanvasObject[];
  useCanvas?: boolean;
  transition?: SlideTransition;
}

// 幻灯片母版
interface SlideMaster {
  id: string;
  name: string;
  background?: { color?: string; image?: ImageRef };
  placeholders: Placeholder[];
  defaultTransition?: SlideTransition;
}

interface Placeholder {
  id: string;
  type: 'title' | 'content' | 'footer' | 'page-number' | 'date' | 'logo';
  x: number;
  y: number;
  width: number;
  height: number;
}

// 幻灯片集合（完整定义）
interface SlidesDeck {
  slides: Slide[];
  theme: PptTheme;
  aspectRatio: '16:9' | '4:3';
  title?: string;
  master?: SlideMaster;
  defaultTransition?: SlideTransition;
}
```

### 4.2 文件结构规划

```
apps/desktop/src-ui/src/plugins/ppt/
├── index.ts                      # 插件注册
├── manifest.json
├── PptPluginPanel.tsx            # 主面板入口
│
├── components/
│   ├── SlideDeck.tsx             # 幻灯片主界面
│   ├── SlideList.tsx             # 左侧缩略图列表
│   ├── SlidePreview.tsx          # CSS 预览（简单模式）
│   ├── SlideEditor.tsx           # 表单编辑器
│   ├── SlideShow.tsx             # 全屏播放
│   ├── SpeakerView.tsx           # 演讲者视图（新增）
│   │
│   ├── canvas/                   # Canvas 编辑器模块
│   │   ├── SlideCanvasEditor.tsx # Canvas 编辑器主组件
│   │   ├── CanvasStage.tsx       # Konva Stage 封装
│   │   ├── CanvasToolbar.tsx     # 工具栏
│   │   ├── CanvasPropertyPanel.tsx
│   │   └── objects/              # Canvas 对象组件
│   │       ├── TextObject.tsx
│   │       ├── ImageObject.tsx
│   │       ├── ShapeObject.tsx
│   │       ├── ChartObject.tsx
│   │       └── IconObject.tsx
│   │
│   ├── charts/                   # 图表模块
│   │   ├── ChartEditor.tsx
│   │   ├── ChartPreview.tsx
│   │   └── chartPresets.ts
│   │
│   ├── richtext/                 # 富文本模块
│   │   ├── RichTextEditor.tsx
│   │   └── RichTextToolbar.tsx
│   │
│   ├── dialogs/                  # 弹窗组件
│   │   ├── PptGenerateDialog.tsx
│   │   ├── ThemeEditorDialog.tsx
│   │   ├── TransitionPicker.tsx
│   │   ├── TemplateLibraryDialog.tsx
│   │   └── MasterEditorDialog.tsx
│   │
│   └── toolbar/                  # 工具栏组件
│       ├── MainToolbar.tsx
│       ├── InsertMenu.tsx
│       ├── LayoutPicker.tsx
│       └── ThemePicker.tsx
│
├── services/
│   ├── pptxExport.ts             # PPTX 导出
│   ├── pptImporter.ts            # PPTX 导入（新增）
│   ├── chartRenderer.ts          # 图表渲染服务
│   └── imageProcessor.ts         # 图片压缩/处理
│
├── hooks/
│   ├── useSlideDeck.ts           # 幻灯片数据管理
│   ├── useCanvasEditor.ts        # Canvas 编辑器
│   ├── usePresentation.ts        # 演示播放
│   └── useRichText.ts            # 富文本编辑
│
├── utils/
│   ├── slideAiPrompts.ts         # AI 生成 prompts
│   ├── slideConverter.ts         # 格式转换
│   ├── transitionPresets.ts      # 过渡动画预设
│   ├── layoutPresets.ts          # 布局预设
│   └── themePresets.ts           # 主题预设
│
├── types.ts                      # 类型定义
│
└── i18n/
    ├── zh.json
    ├── en.json
    └── ja.json
```

---

## 五、实施优先级与时间估算

| Phase | 功能 | 优先级 | 预估时间 | 依赖 |
|-------|------|--------|---------|------|
| **Phase 1** | | **P0** | **2-3 周** | |
| 1.1 | 扩展布局类型 | P0 | 3 天 | 无 |
| 1.2 | 图片插入与管理 | P0 | 4 天 | 无 |
| 1.3 | 富文本编辑 | P1 | 4 天 | 无 |
| 1.4 | 主题系统增强 | P1 | 2 天 | 无 |
| **Phase 2** | | **P1** | **2-3 周** | |
| 2.1 | Canvas 编辑器基础 | P0 | 5 天 | Phase 1.2 |
| 2.2 | 形状绘制 | P1 | 3 天 | 2.1 |
| 2.3 | 图表集成 | P1 | 4 天 | 2.1 |
| 2.4 | 图标插入 | P2 | 2 天 | 2.1 |
| **Phase 3** | | **P1** | **1-2 周** | |
| 3.1 | 过渡动画 | P0 | 3 天 | Phase 1 |
| 3.2 | 演讲者视图 | P1 | 4 天 | 3.1 |
| 3.3 | 动画导出 | P2 | 2 天 | 3.1 |
| **Phase 4** | | **P2** | **2-3 周** | |
| 4.1 | PPTX 导入 | P1 | 5 天 | Phase 2 |
| 4.2 | 母版编辑器 | P2 | 4 天 | Phase 1 |
| 4.3 | 幻灯片模板库 | P2 | 3 天 | Phase 1 |
| **Phase 5** | | **P2** | **持续** | |
| 5.1 | AI 图表生成 | P2 | 3 天 | Phase 2.3 |
| 5.2 | AI 布局优化 | P3 | 2 天 | 无 |
| 5.3 | AI 动画推荐 | P3 | 2 天 | Phase 3.1 |

**总预估**：8-12 周（约 2-3 个月）完整实现所有功能

---

## 六、关键技术难点与解决方案

### 6.1 Canvas 性能优化

**问题**：多对象、高分辨率幻灯片可能卡顿

**解决方案**：
1. 虚拟化渲染（仅渲染视口内对象）
2. 对象层级缓存（Konva 内置）
3. 降级模式（复杂幻灯片回退到 CSS 渲染）

### 6.2 PPTX 导入兼容性

**问题**：PowerPoint 功能复杂，难以完全还原

**解决方案**：
1. 设置合理预期（提示用户可能丢失部分格式）
2. 优先支持常用元素（文本、图片、形状、表格）
3. 复杂效果（3D、视频、宏）提示不支持

### 6.3 富文本与 Canvas 的协调

**问题**：TipTap 富文本与 Konva Canvas 的集成复杂

**解决方案**：
1. 方案 A：富文本在 Canvas 外编辑，渲染时转为图片（推荐，简单可靠）
2. 方案 B：使用 Konva Text + 自定义富文本渲染器

### 6.4 双窗口演讲者视图同步

**问题**：主窗口与投影窗口的状态同步

**解决方案**：
1. 使用 Tauri 事件系统（`emit`/`listen`）
2. 投影窗口监听主窗口的翻页事件
3. 或使用 BroadcastChannel API

---

## 七、依赖安装

```bash
# Canvas 编辑器
pnpm add konva react-konva

# 富文本编辑
pnpm add @tiptap/react @tiptap/starter-kit @tiptap/extension-color @tiptap/extension-text-style

# 过渡动画
pnpm add framer-motion

# 图表
pnpm add echarts echarts-for-react

# PPTX 解析（导入）
pnpm add pptx-parser

# PptxGenJS（已有）
# pnpm add pptxgenjs
```

---

## 八、验收标准

### Phase 1 验收
- [ ] 支持 11 种布局类型
- [ ] 可插入/删除/调整图片
- [ ] 标题和要点支持加粗、斜体、颜色
- [ ] 内置 20+ 主题

### Phase 2 验收
- [ ] Canvas 编辑器正常工作
- [ ] 可绘制形状（矩形、圆形、线条）
- [ ] 可插入并编辑图表（柱状、折线、饼图）
- [ ] 可插入 Lucide 图标

### Phase 3 验收
- [ ] 播放时展示过渡动画（16 种）
- [ ] 演讲者视图独立窗口
- [ ] 计时器、画笔功能正常
- [ ] PPTX 导出包含动画

### Phase 4 验收
- [ ] 可导入 .pptx 文件（保留主要内容）
- [ ] 母版编辑器可编辑占位符
- [ ] 模板库可浏览和插入模板

### Phase 5 验收
- [ ] AI 可根据描述生成图表
- [ ] AI 可给出布局优化建议

---

## 九、参考资料

### PptxGenJS
- [PptxGenJS 官方文档](https://gitbrent.github.io/PptxGenJS/)
- [PptxGenJS Charts API](https://gitbrent.github.io/PptxGenJS/docs/api-charts/)
- [PptxGenJS Tables API](https://gitbrent.github.io/PptxGenJS/docs/api-tables.html)
- [PptxGenJS Shapes API](https://gitbrent.github.io/PptxGenJS/docs/api-shapes/)
- [PptxGenJS GitHub](https://github.com/gitbrent/PptxGenJS)

### Canvas/演示框架
- [Konva.js 官方文档](https://konvajs.org/)
- [Konva Canvas Editor 教程](https://konvajs.org/docs/sandbox/Canvas_Editor.html)
- [react-konva](https://github.com/konvajs/react-konva)
- [Konva vs Fabric.js 对比](https://www.oreateai.com/blog/konvajs-vs-fabricjs-choosing-your-canvas-companion/)
- [Reveal.js Transitions](https://revealjs.com/transitions/)

### PPTX 解析
- [pptx-parser NPM](https://www.npmjs.com/package/pptx-parser)
- [node-pptx-parser](https://www.npmjs.com/package/node-pptx-parser)

### 富文本编辑
- [TipTap 官方文档](https://tiptap.dev/)
- [ProseMirror](https://prosemirror.net/)

### 动画
- [Framer Motion](https://www.framer.com/motion/)

### 图表
- [ECharts 官方文档](https://echarts.apache.org/)
- [echarts-for-react](https://github.com/hustcc/echarts-for-react)
