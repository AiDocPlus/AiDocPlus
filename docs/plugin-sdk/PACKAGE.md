# 插件开发者工具包 (SDK) 清单

本文档列出发送给外部插件开发者的所有文件。

## 必需文件

### 1. 核心类型和常量

```
src-ui/src/plugins/
├── types.ts                          # 插件类型定义
├── constants.ts                      # UUID 常量和分类
└── i18n-loader.ts                    # i18n 注册工具
```

### 2. SDK 框架层

```
src-ui/src/plugins/_framework/
├── PluginHostAPI.ts                  # 核心 API 和 usePluginHost hook
├── PluginPanelLayout.tsx             # 内容生成类布局
├── ToolPluginLayout.tsx              # 功能执行类布局
├── AIContentDialog.tsx               # AI 内容生成弹窗
├── PluginPromptBuilderDialog.tsx     # 提示词构造器
├── pluginUtils.ts                    # 工具函数
├── ui.ts                             # UI 组件 re-export
├── index.ts                          # 入口文件
└── i18n/
    ├── zh.json                       # 框架层中文翻译
    ├── en.json                       # 框架层英文翻译
    └── ja.json                       # 框架层日文翻译
```

### 3. 依赖的类型定义

```
packages/shared-types/
├── src/
│   ├── document.ts                   # Document 类型
│   ├── plugin.ts                     # PluginManifest 类型
│   └── index.ts                      # 导出入口
└── package.json
```

## 可选文件（参考实现）

### 4. 示例插件

```
docs/plugin-sdk/
├── README.md                         # 开发指南
├── PACKAGE.md                        # 本文件
└── examples/
    ├── content-generation/           # 内容生成类示例
    │   ├── index.ts
    │   ├── SummaryPluginPanel.tsx
    │   └── i18n/
    │       ├── zh.json
    │       ├── en.json
    │       └── ja.json
    └── functional/                   # 功能执行类示例
        ├── index.ts
        ├── ToolPluginPanel.tsx
        └── i18n/
            ├── zh.json
            ├── en.json
            └── ja.json
```

## 依赖说明

插件开发者需要自行安装以下依赖：

```json
{
  "dependencies": {
    "react": "^19.0.0",
    "lucide-react": "^0.x.x",
    "i18next": "^23.x.x"
  }
}
```

## 发送方式建议

### 方式 1: 打包为 ZIP

```bash
# 创建 SDK 目录结构
mkdir -p aidocplus-plugin-sdk/plugins/_framework/i18n
mkdir -p aidocplus-plugin-sdk/shared-types/src
mkdir -p aidocplus-plugin-sdk/examples

# 复制核心文件
cp src-ui/src/plugins/types.ts aidocplus-plugin-sdk/plugins/
cp src-ui/src/plugins/constants.ts aidocplus-plugin-sdk/plugins/
cp src-ui/src/plugins/i18n-loader.ts aidocplus-plugin-sdk/plugins/

# 复制框架层
cp -r src-ui/src/plugins/_framework/* aidocplus-plugin-sdk/plugins/_framework/

# 复制共享类型
cp -r packages/shared-types/src/* aidocplus-plugin-sdk/shared-types/src/
cp packages/shared-types/package.json aidocplus-plugin-sdk/shared-types/

# 复制文档和示例
cp -r docs/plugin-sdk/* aidocplus-plugin-sdk/

# 打包
zip -r aidocplus-plugin-sdk.zip aidocplus-plugin-sdk/
```

### 方式 2: 提供 Git 仓库

创建一个独立的 Git 仓库，包含所有 SDK 文件，开发者可以直接 clone。

### 方式 3: 发布为 NPM 包

将 SDK 发布为 `@aidocplus/plugin-sdk` NPM 包，开发者通过 npm install 安装。

## 注意事项

1. **路径映射**: 开发者需要在 tsconfig.json 中配置路径别名：
   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/plugins/*": ["./src/plugins/*"],
         "@aidocplus/shared-types": ["./shared-types/src"]
       }
     }
   }
   ```

2. **版本兼容**: SDK 文件应标记版本号，确保与主程序版本匹配

3. **UI 组件**: `ui.ts` re-export 的组件依赖主程序的 Radix UI + Tailwind CSS 样式，开发者需要确保样式兼容

4. **测试环境**: 建议提供测试环境或 mock API，方便开发者离线开发

## 联系方式

- 官网: https://aidocplus.com
- 邮箱: support@aidocplus.com
