import { useState, useCallback, useEffect, useMemo } from 'react';

interface UseCodingEditorExtensionsParams {
  activeLang: string;
  wordWrap: boolean;
  editorTheme: string;
  handleRunRef: React.RefObject<(() => void) | null>;
  handleSaveRef: React.RefObject<(() => void) | null>;
  gotoLineRef: React.RefObject<(() => void) | null>;
  outputRef: React.RefObject<HTMLPreElement | null>;
}

export function useCodingEditorExtensions({
  activeLang,
  wordWrap,
  editorTheme,
  handleRunRef,
  handleSaveRef,
  gotoLineRef,
  outputRef,
}: UseCodingEditorExtensionsParams) {
  const [cmLangExts, setCmLangExts] = useState<any[]>([]);
  const [cmKeymapExts, setCmKeymapExts] = useState<any[]>([]);
  const [cmTheme, setCmTheme] = useState<any>(undefined);

  // 主题加载函数
  const loadEditorTheme = useCallback(async (themeId: string) => {
    if (themeId === 'light') {
      setCmTheme(undefined);
    } else if (themeId === 'oneDark') {
      const m = await import('@codemirror/theme-one-dark');
      setCmTheme(m.oneDark);
    } else {
      // auto: 跟随系统
      const isDark = document.documentElement.classList.contains('dark');
      if (isDark) {
        const m = await import('@codemirror/theme-one-dark');
        setCmTheme(m.oneDark);
      } else {
        setCmTheme(undefined);
      }
    }
  }, []);

  // 加载快捷键（只加载一次）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const keyMod = await import('@codemirror/view');
        if (cancelled) return;
        const runKeymap = keyMod.keymap.of([
          { key: 'Mod-Enter', run: () => { handleRunRef.current?.(); return true; } },
          { key: 'Mod-Shift-Enter', run: () => { handleRunRef.current?.(); setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); return true; } },
          { key: 'Mod-s', run: () => { handleSaveRef.current?.(); return true; } },
          { key: 'Mod-g', run: () => { gotoLineRef.current?.(); return true; } },
        ]);
        setCmKeymapExts([runKeymap]);
      } catch (err) {
        console.warn('加载 CodeMirror 快捷键失败:', err);
      }
      try {
        await loadEditorTheme(editorTheme);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // 按 activeLang 动态加载语言扩展
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const langMod = await import('@codemirror/language');
        const langDataMod = await import('@codemirror/language-data');
        const { LanguageDescription } = await import('@codemirror/language');
        if (cancelled) return;

        // 映射语言名 → CodeMirror language-data 名称
        const cmLangMap: Record<string, string> = {
          python: 'Python', html: 'HTML', javascript: 'JavaScript', typescript: 'TypeScript',
          json: 'JSON', markdown: 'Markdown', css: 'CSS', xml: 'XML',
          yaml: 'YAML', toml: 'TOML', shell: 'Shell', sql: 'SQL',
        };
        const cmName = cmLangMap[activeLang];
        const exts: any[] = [];

        if (cmName) {
          const desc = LanguageDescription.matchLanguageName(langDataMod.languages, cmName, true);
          if (desc) {
            const langSupport = await desc.load();
            exts.push(langSupport);
          }
        }

        // Python 用 4 空格缩进
        if (activeLang === 'python') {
          exts.push(langMod.indentUnit.of('    '));
        } else {
          exts.push(langMod.indentUnit.of('  '));
        }

        if (!cancelled) setCmLangExts(exts);
      } catch (err) {
        console.warn('加载语言扩展失败:', err);
        if (!cancelled) setCmLangExts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [activeLang]);

  // word wrap 扩展
  const [cmWrapExt, setCmWrapExt] = useState<any[]>([]);
  useEffect(() => {
    if (wordWrap) {
      import('@codemirror/view').then(m => setCmWrapExt([m.EditorView.lineWrapping]));
    } else {
      setCmWrapExt([]);
    }
  }, [wordWrap]);

  // 合并扩展
  const cmExts = useMemo(() => [...cmLangExts, ...cmKeymapExts, ...cmWrapExt], [cmLangExts, cmKeymapExts, cmWrapExt]);

  // 监听系统主题变化（仅 auto 模式生效）
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (editorTheme === 'auto') {
        loadEditorTheme('auto');
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [editorTheme, loadEditorTheme]);

  // 响应 editorTheme 设置变化
  useEffect(() => {
    loadEditorTheme(editorTheme);
  }, [editorTheme, loadEditorTheme]);

  return { cmExts, cmTheme };
}
