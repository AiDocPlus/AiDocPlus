/**
 * 帮助中心 - 左侧文档导航栏
 */

import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, FileText, X } from 'lucide-react';
import { HELP_CATEGORIES } from './helpDocs';
import { searchDocs, type SearchResult } from './helpSearch';

interface HelpSidebarProps {
  activeDocId: string;
  onSelectDoc: (docId: string) => void;
}

export function HelpSidebar({ activeDocId, onSelectDoc }: HelpSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    () => {
      // 默认只展开活动文档所在的分类
      const activeCat = HELP_CATEGORIES.find(c => c.docs.some(d => d.id === activeDocId));
      return new Set(activeCat ? [activeCat.id] : []);
    }
  );

  // 切换文档时自动展开对应分类
  useEffect(() => {
    const cat = HELP_CATEGORIES.find(c => c.docs.some(d => d.id === activeDocId));
    if (cat && !expandedCategories.has(cat.id)) {
      setExpandedCategories(prev => new Set([...prev, cat.id]));
    }
  }, [activeDocId]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchDocs(searchQuery);
  }, [searchQuery]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const handleSearchResultClick = (result: SearchResult) => {
    onSelectDoc(result.doc.id);
    setSearchQuery('');
  };

  return (
    <div className="help-sidebar flex flex-col h-full w-[260px] shrink-0 border-r">
      {/* 搜索框 */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索帮助文档..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="清除搜索"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 搜索结果 */}
      {searchResults ? (
        <div className="flex-1 overflow-y-auto help-scroll p-2">
          {searchResults.length === 0 ? (
            <p className="text-sm text-muted-foreground p-3 text-center">未找到相关文档</p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">
                找到 {searchResults.length} 个结果
              </p>
              {searchResults.map(result => (
                <button
                  key={result.doc.id}
                  onClick={() => handleSearchResultClick(result)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent text-sm transition-colors"
                >
                  <div className="font-medium">{result.doc.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {result.snippet}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 文档目录树 */
        <div className="flex-1 overflow-y-auto help-scroll">
          <nav className="p-3 space-y-0.5">
            {HELP_CATEGORIES.map(cat => (
              <div key={cat.id}>
                {/* 分类标题 */}
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium rounded-lg hover:bg-accent transition-colors"
                >
                  {expandedCategories.has(cat.id) ? (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  <span>{cat.icon}</span>
                  <span>{cat.title}</span>
                </button>

                {/* 分类下的文档列表 */}
                {expandedCategories.has(cat.id) && (
                  <div className="ml-6 space-y-0.5">
                    {cat.docs.map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => onSelectDoc(doc.id)}
                        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors ${
                          activeDocId === doc.id
                            ? 'bg-blue-500 text-white font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
