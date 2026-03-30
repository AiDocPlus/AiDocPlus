/**
 * simple-mind-map 类型补充声明
 *
 * 包自带 types/index.d.ts，这里只补充包类型中缺失的部分：
 * 1. 插件 src 路径的模块声明（包类型只声明了 types/src/plugins/*.d.ts）
 * 2. 通过 declare module 增强包类型
 */

// 补充包类型中缺失的插件 src 路径声明
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
