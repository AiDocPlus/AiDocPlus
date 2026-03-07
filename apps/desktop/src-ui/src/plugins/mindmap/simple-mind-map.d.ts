/**
 * simple-mind-map 类型声明
 *
 * 为 simple-mind-map 库及其插件提供基础类型声明，
 * 避免 TypeScript 隐式 any 类型错误。
 */

declare module 'simple-mind-map' {
  interface MindMapOptions {
    el: HTMLElement;
    data?: any;
    viewData?: any;
    readonly?: boolean;
    layout?: string;
    theme?: string;
    themeConfig?: Record<string, any>;
    fit?: boolean;
    enableAutoEnterTextEditWhenKeydown?: boolean;
    isEndNodeTextEditOnClickOuter?: boolean;
    nodeTextEditZIndex?: number;
    maxHistoryCount?: number;
    addHistoryTime?: number;
    alwaysShowExpandBtn?: boolean;
    expandBtnStyle?: Record<string, any>;
    openPerformance?: boolean;
    enableShortcutOnlyWhenMouseInSvg?: boolean;
    defaultInsertSecondLevelNodeText?: string;
    defaultInsertBelowSecondLevelNodeText?: string;
    errorHandler?: (code: string, error: Error) => void;
    [key: string]: any;
  }

  class MindMap {
    constructor(opt: MindMapOptions);
    static usePlugin(plugin: any, opt?: any): typeof MindMap;
    static hasPlugin(plugin: any): number;
    static pluginList: any[];
    static defineTheme(name: string, config: Record<string, any>): void;

    el: HTMLElement;
    opt: MindMapOptions;
    view: {
      fit: () => void;
      reset: () => void;
      getTransformData: () => any;
      setScale: (scale: number, cx?: number, cy?: number) => void;
      translateXTo: (x: number) => void;
      translateYTo: (y: number) => void;
      translateXY: (x: number, y: number) => void;
      scale: number;
      x: number;
      y: number;
    };
    renderer: any;
    command: any;
    doExport: any;
    miniMap: any;
    svg: any;
    draw: any;

    on(event: string, fn: (...args: any[]) => void): void;
    off(event: string, fn: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    render(callback?: () => void, source?: string): void;
    reRender(callback?: () => void, source?: string): void;
    resize(): void;
    setData(data: any): void;
    getData(withConfig?: boolean): any;
    setTheme(theme: string, notRender?: boolean): void;
    getTheme(): string;
    setLayout(layout: string, notRender?: boolean): void;
    getLayout(): string;
    setMode(mode: 'readonly' | 'edit'): void;
    execCommand(command: string, ...args: any[]): void;
    export(type: string, ...args: any[]): Promise<any>;
    getSvgData(opt?: any): any;
    destroy(): void;
    addPlugin(plugin: any, opt?: any): void;
    removePlugin(plugin: any): void;
  }

  export default MindMap;
}

declare module 'simple-mind-map/src/plugins/Drag.js' {
  const Drag: any;
  export default Drag;
}

declare module 'simple-mind-map/src/plugins/Select.js' {
  const Select: any;
  export default Select;
}

declare module 'simple-mind-map/src/plugins/Export.js' {
  const Export: any;
  export default Export;
}

declare module 'simple-mind-map/src/plugins/MiniMap.js' {
  const MiniMap: any;
  export default MiniMap;
}

declare module 'simple-mind-map/src/plugins/RichText.js' {
  const RichText: any;
  export default RichText;
}

declare module 'simple-mind-map/src/plugins/Search.js' {
  const Search: any;
  export default Search;
}

declare module 'simple-mind-map/src/plugins/Watermark.js' {
  const Watermark: any;
  export default Watermark;
}

declare module 'simple-mind-map/src/plugins/TouchEvent.js' {
  const TouchEvent: any;
  export default TouchEvent;
}

declare module 'simple-mind-map/src/plugins/ExportXMind.js' {
  const ExportXMind: any;
  export default ExportXMind;
}

declare module 'simple-mind-map/src/plugins/ExportPDF.js' {
  const ExportPDF: any;
  export default ExportPDF;
}

declare module 'simple-mind-map/src/plugins/Scrollbar.js' {
  const Scrollbar: any;
  export default Scrollbar;
}

declare module 'simple-mind-map/src/plugins/KeyboardNavigation.js' {
  const KeyboardNavigation: any;
  export default KeyboardNavigation;
}

declare module 'simple-mind-map/src/plugins/RainbowLines.js' {
  const RainbowLines: any;
  export default RainbowLines;
}

declare module 'simple-mind-map/src/plugins/AssociativeLine.js' {
  const AssociativeLine: any;
  export default AssociativeLine;
}
