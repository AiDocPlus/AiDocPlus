import { create } from 'zustand';
import type {
  ResourceSummary,
  CategoryDefinition,
  ResourceItem,
} from '@aidocplus/manager-shared';

export type SortMode = 'manual' | 'alpha';

interface ResourceStoreState {
  // 资源列表
  resources: ResourceSummary[];
  // 分类列表
  categories: CategoryDefinition[];
  // 当前选中的分类 key（null 表示「全部」）
  selectedCategory: string | null;
  // 当前选中的资源（编辑中）
  selectedResource: ResourceItem | null;
  // 多选的资源路径（批量操作用）
  checkedPaths: Set<string>;
  // 搜索关键词
  searchQuery: string;
  // 数据目录
  dataDir: string;
  // 加载状态
  isLoading: boolean;
  // 错误信息
  error: string | null;

  // 排序模式
  categorySortMode: SortMode;
  resourceSortMode: SortMode;

  // 批量模式
  batchMode: boolean;

  // 面板折叠状态
  categoryPanelCollapsed: boolean;
  resourcePanelCollapsed: boolean;

  // 面板宽度
  categoryPanelWidth: number;
  resourcePanelWidth: number;

  // Actions
  setResources: (resources: ResourceSummary[]) => void;
  setCategories: (categories: CategoryDefinition[]) => void;
  setSelectedCategory: (key: string | null) => void;
  setSelectedResource: (resource: ResourceItem | null) => void;
  toggleChecked: (path: string) => void;
  setAllChecked: (paths: string[]) => void;
  clearChecked: () => void;
  setSearchQuery: (query: string) => void;
  setDataDir: (dir: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setCategorySortMode: (mode: SortMode) => void;
  setResourceSortMode: (mode: SortMode) => void;
  setBatchMode: (mode: boolean) => void;
  setCategoryPanelCollapsed: (collapsed: boolean) => void;
  setResourcePanelCollapsed: (collapsed: boolean) => void;
  setCategoryPanelWidth: (width: number | ((prev: number) => number)) => void;
  setResourcePanelWidth: (width: number | ((prev: number) => number)) => void;

  // 计算属性
  filteredResources: () => ResourceSummary[];
  sortedCategories: () => CategoryDefinition[];
}

export const useResourceStore = create<ResourceStoreState>((set, get) => ({
  resources: [],
  categories: [],
  selectedCategory: null,
  selectedResource: null,
  checkedPaths: new Set(),
  searchQuery: '',
  dataDir: '',
  isLoading: false,
  error: null,
  categorySortMode: 'manual',
  resourceSortMode: 'manual',
  batchMode: false,
  categoryPanelCollapsed: false,
  resourcePanelCollapsed: false,
  categoryPanelWidth: 160,
  resourcePanelWidth: 280,

  setResources: (resources) => set({ resources }),
  setCategories: (categories) => set({ categories }),
  setSelectedCategory: (key) => set({ selectedCategory: key }),
  setSelectedResource: (resource) => set({ selectedResource: resource }),

  toggleChecked: (path) =>
    set((state) => {
      const next = new Set(state.checkedPaths);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { checkedPaths: next };
    }),

  setAllChecked: (paths) => set({ checkedPaths: new Set(paths) }),
  clearChecked: () => set({ checkedPaths: new Set() }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDataDir: (dir) => set({ dataDir: dir }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setCategorySortMode: (mode) => set({ categorySortMode: mode }),
  setResourceSortMode: (mode) => set({ resourceSortMode: mode }),
  setBatchMode: (mode) => set({ batchMode: mode, checkedPaths: mode ? new Set() : new Set() }),
  setCategoryPanelCollapsed: (collapsed) => set({ categoryPanelCollapsed: collapsed }),
  setResourcePanelCollapsed: (collapsed) => set({ resourcePanelCollapsed: collapsed }),
  setCategoryPanelWidth: (width) => set((state) => ({
    categoryPanelWidth: typeof width === 'function' ? width(state.categoryPanelWidth) : width,
  })),
  setResourcePanelWidth: (width) => set((state) => ({
    resourcePanelWidth: typeof width === 'function' ? width(state.resourcePanelWidth) : width,
  })),

  filteredResources: () => {
    const { resources, selectedCategory, searchQuery } = get();
    let filtered = resources;

    // 按分类筛选
    if (selectedCategory) {
      filtered = filtered.filter(
        (r) => r.majorCategory === selectedCategory
      );
    }

    // 按搜索关键词筛选
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.tags.some((t) => t.toLowerCase().includes(q)) ||
          r.id.toLowerCase().includes(q)
      );
    }

    // 排序（order 是分类内排序）
    const { resourceSortMode } = get();
    if (resourceSortMode === 'alpha') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'));
    } else if (selectedCategory) {
      // 选中分类时：按分类内 order 排序
      filtered = [...filtered].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'zh-Hans'));
    }
    // "全部"视图：保持 Rust 端返回的顺序（按分类分组 + 组内 order）

    return filtered;
  },

  sortedCategories: () => {
    const { categories, categorySortMode } = get();
    const sorted = [...categories];
    if (categorySortMode === 'alpha') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans'));
    } else {
      sorted.sort((a, b) => a.order - b.order);
    }
    return sorted;
  },
}));
