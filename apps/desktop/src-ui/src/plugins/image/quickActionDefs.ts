/**
 * 图片插件 AI 快捷操作定义
 *
 * 按 8 个分类组织，覆盖图形设计常用场景。
 * 用户可完全自定义。架构与表格插件一致。
 */

// ── 类型定义 ──

export interface QuickActionCategory {
  id: string;
  label: string;
  icon: string;
  order: number;
  builtin?: boolean;
}

export type ExecutionMode = 'direct' | 'ai' | 'hybrid';

export interface QuickActionItem {
  id: string;
  categoryId: string;
  label: string;
  icon: string;
  prompt: string;
  order: number;
  builtin?: boolean;
  hidden?: boolean;
  executionMode?: ExecutionMode;
  directAction?: string;
  keywords?: string[];
  dangerous?: boolean;
}

export interface QuickActionStore {
  categories: QuickActionCategory[];
  items: QuickActionItem[];
  version: number;
  favorites?: string[];
  recentUsed?: string[];
}

const STORAGE_KEY = '_image_quick_actions';
const CURRENT_VERSION = 1;

// ── 默认内置分类（8 类） ──

const DEFAULT_CATEGORIES: QuickActionCategory[] = [
  { id: 'shape',     label: '图形',   icon: 'Shapes',       order: 0, builtin: true },
  { id: 'text',      label: '文字',   icon: 'Type',         order: 1, builtin: true },
  { id: 'layout',    label: '布局',   icon: 'LayoutGrid',   order: 2, builtin: true },
  { id: 'style',     label: '样式',   icon: 'Palette',      order: 3, builtin: true },
  { id: 'generate',  label: '生成',   icon: 'Wand2',        order: 4, builtin: true },
  { id: 'edit',      label: '编辑',   icon: 'Pencil',       order: 5, builtin: true },
  { id: 'export',    label: '导出',   icon: 'Download',     order: 6, builtin: true },
  { id: 'scene',     label: '场景',   icon: 'LayoutTemplate', order: 7, builtin: true },
];

// ── 默认内置操作项 ──

const DEFAULT_ITEMS: QuickActionItem[] = [

  // ━━ 图形 (shape) ━━
  { id: 'shape_rect',     categoryId: 'shape', label: '添加矩形',     icon: 'Square',      order: 0, builtin: true,
    executionMode: 'direct', directAction: 'add_rect', keywords: ['矩形', '方块', 'jx', 'fk'],
    prompt: '在画布上添加一个矩形' },
  { id: 'shape_circle',   categoryId: 'shape', label: '添加圆形',     icon: 'Circle',      order: 1, builtin: true,
    executionMode: 'direct', directAction: 'add_circle', keywords: ['圆形', '圈', 'yx', 'q'],
    prompt: '在画布上添加一个圆形' },
  { id: 'shape_triangle', categoryId: 'shape', label: '添加三角形',   icon: 'Triangle',    order: 2, builtin: true,
    executionMode: 'direct', directAction: 'add_triangle', keywords: ['三角形', 'sjx'],
    prompt: '在画布上添加一个三角形' },
  { id: 'shape_star',     categoryId: 'shape', label: '添加星形',     icon: 'Star',        order: 3, builtin: true,
    executionMode: 'direct', directAction: 'add_star', keywords: ['星形', '五角星', 'xx', 'wjx'],
    prompt: '在画布上添加一个星形' },
  { id: 'shape_arrow',    categoryId: 'shape', label: '添加箭头',     icon: 'ArrowRight',  order: 4, builtin: true,
    executionMode: 'direct', directAction: 'add_arrow', keywords: ['箭头', 'jt'],
    prompt: '在画布上添加一个箭头' },
  { id: 'shape_line',     categoryId: 'shape', label: '添加线条',     icon: 'Minus',       order: 5, builtin: true,
    executionMode: 'direct', directAction: 'add_line', keywords: ['线条', '直线', 'xt', 'zx'],
    prompt: '在画布上添加一条线' },
  { id: 'shape_flowchart', categoryId: 'shape', label: 'AI 生成流程图', icon: 'GitBranch', order: 6, builtin: true,
    executionMode: 'ai', keywords: ['流程图', '流程', 'lct', 'lc'],
    prompt: '请根据我的描述生成一个流程图，使用矩形表示步骤、菱形表示判断、箭头表示流向。输出为 SVG 格式。' },
  { id: 'shape_diagram',  categoryId: 'shape', label: 'AI 生成示意图', icon: 'Network',    order: 7, builtin: true,
    executionMode: 'ai', keywords: ['示意图', '架构图', 'syt', 'jgt'],
    prompt: '请根据我的描述生成一个示意图/架构图，用简洁的图形和连线表达概念关系。输出为 SVG 格式。' },

  // ━━ 文字 (text) ━━
  { id: 'text_title',     categoryId: 'text', label: '添加标题',       icon: 'Heading',    order: 0, builtin: true,
    executionMode: 'direct', directAction: 'add_title', keywords: ['标题', 'bt'],
    prompt: '添加一个大号标题文本' },
  { id: 'text_body',      categoryId: 'text', label: '添加正文',       icon: 'AlignLeft',  order: 1, builtin: true,
    executionMode: 'direct', directAction: 'add_body', keywords: ['正文', '段落', 'zw', 'dl'],
    prompt: '添加正文文本' },
  { id: 'text_caption',   categoryId: 'text', label: '添加说明文字',   icon: 'Type',       order: 2, builtin: true,
    executionMode: 'direct', directAction: 'add_caption', keywords: ['说明', '注释', 'sm', 'zs'],
    prompt: '添加小号说明文字' },
  { id: 'text_ai_rewrite', categoryId: 'text', label: 'AI 改写文案',  icon: 'Wand2',      order: 3, builtin: true,
    executionMode: 'ai', keywords: ['改写', '润色', 'gx', 'rs'],
    prompt: '请改写/润色画布上选中的文本内容，使其更加专业、精炼。保持原意不变。' },
  { id: 'text_ai_generate', categoryId: 'text', label: 'AI 生成文案', icon: 'Sparkles',   order: 4, builtin: true,
    executionMode: 'ai', keywords: ['生成', '文案', 'sc', 'wa'],
    prompt: '请根据我的描述和画布上的图形元素，生成合适的文案标题和正文内容。' },
  { id: 'text_ai_translate', categoryId: 'text', label: 'AI 翻译文本', icon: 'Languages', order: 5, builtin: true,
    executionMode: 'ai', keywords: ['翻译', 'translate', 'fy'],
    prompt: '请将画布上所有文本内容翻译为英文，保持排版不变。' },

  // ━━ 布局 (layout) ━━
  { id: 'layout_align_left',   categoryId: 'layout', label: '左对齐',       icon: 'AlignStartVertical',    order: 0, builtin: true,
    executionMode: 'direct', directAction: 'align_left', keywords: ['左对齐', 'zdq'],
    prompt: '将选中的对象左对齐' },
  { id: 'layout_align_center', categoryId: 'layout', label: '水平居中',     icon: 'AlignCenterVertical',   order: 1, builtin: true,
    executionMode: 'direct', directAction: 'align_centerH', keywords: ['水平居中', 'spjz'],
    prompt: '将选中的对象水平居中对齐' },
  { id: 'layout_align_right',  categoryId: 'layout', label: '右对齐',       icon: 'AlignEndVertical',      order: 2, builtin: true,
    executionMode: 'direct', directAction: 'align_right', keywords: ['右对齐', 'ydq'],
    prompt: '将选中的对象右对齐' },
  { id: 'layout_align_top',    categoryId: 'layout', label: '顶部对齐',     icon: 'AlignStartHorizontal',  order: 3, builtin: true,
    executionMode: 'direct', directAction: 'align_top', keywords: ['顶部对齐', 'dbdq'],
    prompt: '将选中的对象顶部对齐' },
  { id: 'layout_align_middle', categoryId: 'layout', label: '垂直居中',     icon: 'AlignCenterHorizontal', order: 4, builtin: true,
    executionMode: 'direct', directAction: 'align_centerV', keywords: ['垂直居中', 'czjz'],
    prompt: '将选中的对象垂直居中对齐' },
  { id: 'layout_align_bottom', categoryId: 'layout', label: '底部对齐',     icon: 'AlignEndHorizontal',    order: 5, builtin: true,
    executionMode: 'direct', directAction: 'align_bottom', keywords: ['底部对齐', 'dbdq'],
    prompt: '将选中的对象底部对齐' },
  { id: 'layout_distribute_h', categoryId: 'layout', label: '水平等距',     icon: 'LayoutGrid',  order: 6, builtin: true,
    executionMode: 'direct', directAction: 'distribute_h', keywords: ['水平等距', '均匀', 'spdj', 'jy'],
    prompt: '将选中的对象水平等间距分布' },
  { id: 'layout_distribute_v', categoryId: 'layout', label: '垂直等距',     icon: 'LayoutGrid',  order: 7, builtin: true,
    executionMode: 'direct', directAction: 'distribute_v', keywords: ['垂直等距', '均匀', 'czdj', 'jy'],
    prompt: '将选中的对象垂直等间距分布' },
  { id: 'layout_group',        categoryId: 'layout', label: '编组',         icon: 'Group',       order: 8, builtin: true,
    executionMode: 'direct', directAction: 'group', keywords: ['编组', '组合', 'bz', 'zh'],
    prompt: '将选中的对象编组' },
  { id: 'layout_ungroup',      categoryId: 'layout', label: '取消编组',     icon: 'Ungroup',     order: 9, builtin: true,
    executionMode: 'direct', directAction: 'ungroup', keywords: ['取消编组', '解组', 'qxbz', 'jz'],
    prompt: '取消选中对象的编组' },
  { id: 'layout_ai_arrange',   categoryId: 'layout', label: 'AI 智能排版', icon: 'Sparkles',    order: 10, builtin: true,
    executionMode: 'ai', keywords: ['排版', '智能布局', 'pb', 'znbj'],
    prompt: '请分析画布上的所有元素，建议最佳的排版布局方案（对齐、间距、层次），并生成调整动作。' },

  // ━━ 样式 (style) ━━
  { id: 'style_fill_color',   categoryId: 'style', label: '修改填充色',   icon: 'Palette',     order: 0, builtin: true,
    executionMode: 'ai', keywords: ['填充色', '颜色', 'tcs', 'ys'],
    prompt: '请为画布上选中的对象推荐合适的填充颜色。' },
  { id: 'style_stroke',       categoryId: 'style', label: '修改描边',     icon: 'Pencil',      order: 1, builtin: true,
    executionMode: 'ai', keywords: ['描边', '边框', 'mb', 'bk'],
    prompt: '请为选中对象设置合适的描边样式（颜色、粗细、虚线）。' },
  { id: 'style_shadow',       categoryId: 'style', label: '添加阴影',     icon: 'Layers',      order: 2, builtin: true,
    executionMode: 'ai', keywords: ['阴影', 'yy'],
    prompt: '请为选中对象添加阴影效果，生成修改动作。' },
  { id: 'style_ai_palette',   categoryId: 'style', label: 'AI 配色方案', icon: 'Sparkles',    order: 3, builtin: true,
    executionMode: 'ai', keywords: ['配色', '色彩', '方案', 'ps', 'sc', 'fa'],
    prompt: '请根据画布当前的风格和用途，推荐一套和谐的配色方案，包含主色、辅助色和强调色，并生成修改动作。' },
  { id: 'style_ai_beautify',  categoryId: 'style', label: 'AI 一键美化', icon: 'Wand2',       order: 4, builtin: true,
    executionMode: 'ai', keywords: ['美化', '优化', 'mh', 'yh'],
    prompt: '请分析当前画布的视觉效果，建议并执行美化优化（统一配色、改善间距、增强对比度等）。' },
  { id: 'style_opacity',      categoryId: 'style', label: '调整透明度',   icon: 'Eye',         order: 5, builtin: true,
    executionMode: 'ai', keywords: ['透明度', 'opacity', 'tmd'],
    prompt: '请为选中对象建议合适的透明度设置。' },

  // ━━ 生成 (generate) ━━
  { id: 'gen_icon',          categoryId: 'generate', label: 'AI 生成图标',   icon: 'Image',      order: 0, builtin: true,
    executionMode: 'ai', keywords: ['图标', 'icon', 'tb'],
    prompt: '请根据我的描述生成一个简洁的矢量图标（SVG 格式），适合放在画布上使用。' },
  { id: 'gen_illustration',  categoryId: 'generate', label: 'AI 生成插图',   icon: 'ImagePlus',  order: 1, builtin: true,
    executionMode: 'ai', keywords: ['插图', '图片', 'ct', 'tp'],
    prompt: '请根据我的描述生成一个简约风格的插图/矢量图形（SVG），适合作为画布的装饰元素。' },
  { id: 'gen_pattern',       categoryId: 'generate', label: 'AI 生成图案',   icon: 'Grid3x3',    order: 2, builtin: true,
    executionMode: 'ai', keywords: ['图案', '纹理', 'ta', 'wl'],
    prompt: '请生成一个重复图案/纹理背景（SVG 格式），如几何图案、波纹、点阵等。' },
  { id: 'gen_badge',         categoryId: 'generate', label: 'AI 生成徽章',   icon: 'Award',      order: 3, builtin: true,
    executionMode: 'ai', keywords: ['徽章', '标志', 'hz', 'bz'],
    prompt: '请根据描述生成一个徽章/标志设计（SVG），包含图形和文字。' },
  { id: 'gen_chart',         categoryId: 'generate', label: 'AI 生成图表',   icon: 'BarChart3',  order: 4, builtin: true,
    executionMode: 'ai', keywords: ['图表', '柱状图', 'chart', 'tb', 'zzt'],
    prompt: '请根据我提供的数据生成一个图表（SVG 格式），可以是柱状图、折线图、饼图等。' },
  { id: 'gen_infographic',   categoryId: 'generate', label: 'AI 生成信息图', icon: 'LayoutDashboard', order: 5, builtin: true,
    executionMode: 'ai', keywords: ['信息图', 'infographic', 'xxt'],
    prompt: '请根据我的数据和描述生成一个简约的信息图/数据可视化（SVG），包含数据展示和文字说明。' },

  // ━━ 编辑 (edit) ━━
  { id: 'edit_delete_selected', categoryId: 'edit', label: '删除选中',     icon: 'Trash2',      order: 0, builtin: true,
    executionMode: 'direct', directAction: 'delete_selected', keywords: ['删除', 'sc'], dangerous: true,
    prompt: '删除当前选中的对象' },
  { id: 'edit_select_all',    categoryId: 'edit', label: '全选',           icon: 'CheckSquare', order: 1, builtin: true,
    executionMode: 'direct', directAction: 'select_all', keywords: ['全选', 'qx'],
    prompt: '选中画布上所有对象' },
  { id: 'edit_undo',          categoryId: 'edit', label: '撤销',           icon: 'Undo2',       order: 2, builtin: true,
    executionMode: 'direct', directAction: 'undo', keywords: ['撤销', 'cx'],
    prompt: '撤销上一步操作' },
  { id: 'edit_redo',          categoryId: 'edit', label: '重做',           icon: 'Redo2',       order: 3, builtin: true,
    executionMode: 'direct', directAction: 'redo', keywords: ['重做', 'cz'],
    prompt: '重做上一步撤销的操作' },
  { id: 'edit_flip_h',        categoryId: 'edit', label: '水平翻转',       icon: 'FlipHorizontal', order: 4, builtin: true,
    executionMode: 'direct', directAction: 'flip_h', keywords: ['水平翻转', 'spfz'],
    prompt: '水平翻转选中对象' },
  { id: 'edit_flip_v',        categoryId: 'edit', label: '垂直翻转',       icon: 'FlipVertical',   order: 5, builtin: true,
    executionMode: 'direct', directAction: 'flip_v', keywords: ['垂直翻转', 'czfz'],
    prompt: '垂直翻转选中对象' },
  { id: 'edit_lock',          categoryId: 'edit', label: '锁定对象',       icon: 'Lock',        order: 6, builtin: true,
    executionMode: 'direct', directAction: 'lock', keywords: ['锁定', 'sd'],
    prompt: '锁定选中对象，防止移动和编辑' },
  { id: 'edit_bring_forward', categoryId: 'edit', label: '上移一层',       icon: 'ArrowUp',     order: 7, builtin: true,
    executionMode: 'direct', directAction: 'bring_forward', keywords: ['上移', '图层', 'sy', 'tc'],
    prompt: '将选中对象上移一层' },
  { id: 'edit_send_backward', categoryId: 'edit', label: '下移一层',       icon: 'ArrowDown',   order: 8, builtin: true,
    executionMode: 'direct', directAction: 'send_backward', keywords: ['下移', '图层', 'xy', 'tc'],
    prompt: '将选中对象下移一层' },
  { id: 'edit_clear_canvas',  categoryId: 'edit', label: '清空画布',       icon: 'Trash2',      order: 9, builtin: true,
    executionMode: 'direct', directAction: 'clear_canvas', keywords: ['清空', '重置', 'qk', 'cz'], dangerous: true,
    prompt: '清空画布上的所有内容' },

  // ━━ 导出 (export) ━━
  { id: 'export_png',         categoryId: 'export', label: '导出 PNG',     icon: 'Image',      order: 0, builtin: true,
    executionMode: 'direct', directAction: 'export_png', keywords: ['png', '导出'],
    prompt: '将画布导出为 PNG 图片' },
  { id: 'export_svg',         categoryId: 'export', label: '导出 SVG',     icon: 'FileCode',   order: 1, builtin: true,
    executionMode: 'direct', directAction: 'export_svg', keywords: ['svg', '矢量'],
    prompt: '将画布导出为 SVG 矢量图' },
  { id: 'export_jpeg',        categoryId: 'export', label: '导出 JPEG',    icon: 'Image',      order: 2, builtin: true,
    executionMode: 'direct', directAction: 'export_jpeg', keywords: ['jpeg', 'jpg'],
    prompt: '将画布导出为 JPEG 图片' },
  { id: 'export_clipboard',   categoryId: 'export', label: '复制到剪贴板', icon: 'Clipboard',  order: 3, builtin: true,
    executionMode: 'direct', directAction: 'copy_clipboard', keywords: ['剪贴板', '复制', 'jtb', 'fz'],
    prompt: '将画布内容复制到系统剪贴板' },

  // ━━ 场景 (scene) ━━
  { id: 'scene_poster',       categoryId: 'scene', label: 'AI 海报设计',   icon: 'LayoutTemplate', order: 0, builtin: true,
    executionMode: 'ai', keywords: ['海报', '宣传', 'hb', 'xc'],
    prompt: '请帮我设计一张海报，包含标题、副标题、主图区域和装饰元素，使用专业的排版布局。' },
  { id: 'scene_card',         categoryId: 'scene', label: 'AI 名片设计',   icon: 'CreditCard',    order: 1, builtin: true,
    executionMode: 'ai', keywords: ['名片', 'mp'],
    prompt: '请帮我设计一张商务名片，包含姓名、职位、联系方式和公司Logo位置。画布尺寸调整为 90×54mm（1063×637px）。' },
  { id: 'scene_banner',       categoryId: 'scene', label: 'AI Banner 设计', icon: 'Monitor',      order: 2, builtin: true,
    executionMode: 'ai', keywords: ['banner', '横幅', '广告', 'hf', 'gg'],
    prompt: '请帮我设计一个网页横幅/Banner，包含吸引眼球的标题、行动号召文字和视觉元素。' },
  { id: 'scene_social',       categoryId: 'scene', label: 'AI 社交图片',   icon: 'Share2',        order: 3, builtin: true,
    executionMode: 'ai', keywords: ['社交', '朋友圈', 'sq', 'pyq'],
    prompt: '请帮我设计一张适合社交媒体分享的图片，风格简约现代，包含醒目的文字和装饰元素。' },
  { id: 'scene_ppt_slide',    categoryId: 'scene', label: 'AI PPT 页面',   icon: 'Presentation',  order: 4, builtin: true,
    executionMode: 'ai', keywords: ['ppt', '演示', '幻灯片', 'ys', 'hdp'],
    prompt: '请帮我设计一个 PPT 演示页面（1920×1080），包含标题、要点列表和视觉辅助元素。' },
  { id: 'scene_certificate',  categoryId: 'scene', label: 'AI 证书设计',   icon: 'Award',         order: 5, builtin: true,
    executionMode: 'ai', keywords: ['证书', '奖状', 'zs', 'jz'],
    prompt: '请帮我设计一张证书/奖状模板，包含边框装饰、标题、正文和签名区域。' },
  { id: 'scene_diagram',      categoryId: 'scene', label: 'AI 概念图',     icon: 'Network',       order: 6, builtin: true,
    executionMode: 'ai', keywords: ['概念图', '关系图', 'gnt', 'gxt'],
    prompt: '请帮我创建一个概念关系图，用不同形状和连线展示概念之间的层次和关联关系。' },
  { id: 'scene_wireframe',    categoryId: 'scene', label: 'AI 线框图',     icon: 'LayoutDashboard', order: 7, builtin: true,
    executionMode: 'ai', keywords: ['线框', '原型', 'xk', 'yx'],
    prompt: '请帮我创建一个网页/APP 线框图原型，用简单的矩形和文字表示UI元素布局。' },
];

// ── 持久化 ──

export function loadQuickActionStore(): QuickActionStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuickActionStore;
      if (parsed.version === CURRENT_VERSION) return parsed;
    }
  } catch { /* ignore */ }
  return {
    categories: DEFAULT_CATEGORIES,
    items: DEFAULT_ITEMS,
    version: CURRENT_VERSION,
    favorites: [],
    recentUsed: [],
  };
}

export function saveQuickActionStore(store: QuickActionStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch { /* ignore */ }
}

export function toggleFavorite(store: QuickActionStore, itemId: string): QuickActionStore {
  const favs = new Set(store.favorites || []);
  if (favs.has(itemId)) favs.delete(itemId);
  else favs.add(itemId);
  return { ...store, favorites: [...favs] };
}

export function recordRecentUsed(store: QuickActionStore, itemId: string): QuickActionStore {
  const recent = (store.recentUsed || []).filter(id => id !== itemId);
  recent.unshift(itemId);
  if (recent.length > 20) recent.length = 20;
  return { ...store, recentUsed: recent };
}
