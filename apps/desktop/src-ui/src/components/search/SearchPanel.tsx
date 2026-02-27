import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, X, FileText, Clock, Trash2 } from 'lucide-react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAppStore } from '@/stores/useAppStore';
import { useTranslation } from '@/i18n';
import type { SearchResult, SearchHistoryEntry, SearchOptions } from '@aidocplus/shared-types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

export function SearchPanel() {
  const { t } = useTranslation();
  const { currentProject, openTab } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [options, setOptions] = useState<SearchOptions>({
    query: '',
    searchContent: true,
    matchCase: false,
    matchWholeWord: false,
    useRegex: false,
    limit: 50
  });

  // Open search panel with keyboard shortcut
  useHotkeys('meta+shift+f, ctrl+shift+f', (e) => {
    e.preventDefault();
    setOpen(true);
    setTimeout(() => document.getElementById('search-input')?.focus(), 100);
  });

  // Open search panel via custom event (from toolbar button)
  useEffect(() => {
    const handler = () => {
      setOpen(true);
      setTimeout(() => document.getElementById('search-input')?.focus(), 100);
    };
    window.addEventListener('open-search', handler);
    return () => window.removeEventListener('open-search', handler);
  }, []);

  // Close with Escape
  useHotkeys('escape', () => {
    if (open) {
      setOpen(false);
    }
  }, { enableOnFormTags: true }, [open]);

  // Load search history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('search-history');
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, []);

  // Perform search when query changes
  const performSearch = useCallback(async () => {
    if (!query.trim() || !currentProject) {
      setResults([]);
      setShowHistory(true);
      return;
    }

    setIsSearching(true);
    setShowHistory(false);

    try {
      const searchOpts: SearchOptions = {
        ...options,
        query: query.trim()
      };

      const searchResults = await invoke<SearchResult[]>('search_documents', {
        projectId: currentProject.id,
        options: searchOpts
      });

      setResults(searchResults);

      // Add to search history
      if (searchResults.length > 0) {
        const historyEntry: SearchHistoryEntry = {
          query: query.trim(),
          timestamp: Date.now(),
          resultCount: searchResults.length
        };

        const newHistory = [
          historyEntry,
          ...searchHistory.filter(h => h.query !== query.trim())
        ].slice(0, 10); // Keep only last 10 searches

        setSearchHistory(newHistory);
        localStorage.setItem('search-history', JSON.stringify(newHistory));
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [query, currentProject, options, searchHistory]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, options.searchContent, options.matchCase, options.matchWholeWord, options.useRegex, performSearch]);

  const handleResultClick = async (result: SearchResult) => {
    await openTab(result.documentId);
    setOpen(false);
  };

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
  };

  const handleClearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('search-history');
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <>
      {/* Search trigger button - could be added to toolbar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col bg-card">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 bg-card">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Search className="w-5 h-5" />
              {t('search.title')}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          {/* Search Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              title={t('search.searchHistory', { defaultValue: 'Search history' })}
            >
              <Clock className="w-4 h-4" />
            </Button>
          </div>

          {/* Search Options */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Switch
                id="search-content"
                checked={options.searchContent}
                onCheckedChange={(checked) => setOptions({ ...options, searchContent: checked })}
              />
              <Label htmlFor="search-content" className="cursor-pointer">
                {t('search.searchInContent')}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="match-case"
                checked={options.matchCase}
                onCheckedChange={(checked) => setOptions({ ...options, matchCase: checked })}
              />
              <Label htmlFor="match-case" className="cursor-pointer">
                {t('search.matchCase')}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="whole-word"
                checked={options.matchWholeWord}
                onCheckedChange={(checked) => setOptions({ ...options, matchWholeWord: checked })}
              />
              <Label htmlFor="whole-word" className="cursor-pointer">
                {t('search.matchWholeWord')}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="use-regex"
                checked={options.useRegex}
                onCheckedChange={(checked) => setOptions({ ...options, useRegex: checked })}
              />
              <Label htmlFor="use-regex" className="cursor-pointer">
                {t('search.useRegex')}
              </Label>
            </div>
          </div>

          <Separator />

          {/* Results */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              {isSearching ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-sm text-muted-foreground">
                    {t('search.searching')}
                  </div>
                </div>
              ) : showHistory && searchHistory.length > 0 && !query ? (
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{t('search.searchHistory')}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearHistory}
                      className="h-6 text-xs"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      {t('search.clearHistory')}
                    </Button>
                  </div>
                  {searchHistory.map((entry, index) => (
                    <button
                      key={index}
                      onClick={() => handleHistoryClick(entry.query)}
                      className="w-full text-left px-3 py-2 rounded hover:bg-accent flex items-center justify-between group"
                    >
                      <span className="text-sm">{entry.query}</span>
                      <span className="text-xs text-muted-foreground">
                        {entry.resultCount} {t('search.results', { defaultValue: 'results' })}
                      </span>
                    </button>
                  ))}
                </div>
              ) : results.length > 0 ? (
                <div className="p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t('search.foundResults', { count: results.length })}
                  </p>
                  {results.map((result) => (
                    <div
                      key={result.documentId}
                      onClick={() => handleResultClick(result)}
                      className="p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">
                            {highlightMatch(result.title, query)}
                          </h4>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t('search.foundResults', { count: result.matches.length })}
                          </div>
                          {result.matches.slice(0, 2).map((match, matchIndex) => (
                            <div
                              key={matchIndex}
                              className="mt-1 text-xs text-muted-foreground truncate"
                            >
                              {match.preview && (
                                <span>
                                  ...{highlightMatch(match.preview, query)}...
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : query ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Search className="w-12 h-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('search.noResults')}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Search className="w-12 h-12 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t('search.placeholder')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ⌘⇧F or Ctrl+Shift+F
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SearchPanel;
