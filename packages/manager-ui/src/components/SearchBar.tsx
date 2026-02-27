import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useResourceStore } from '../stores/useResourceStore';

export function SearchBar() {
  const { t } = useTranslation();
  const searchQuery = useResourceStore((s) => s.searchQuery);
  const setSearchQuery = useResourceStore((s) => s.setSearchQuery);

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('common.searchPlaceholder', { defaultValue: '搜索名称、描述、标签...' })}
        className="h-9 w-64 rounded-lg border border-input bg-background pl-9 pr-3 outline-none focus:ring-1 focus:ring-ring text-sm transition-all duration-200 focus:w-80"
      />
    </div>
  );
}
