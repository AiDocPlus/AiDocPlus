import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // 未使用变量：错误（忽略以 _ 开头的参数）
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      // 禁止 console.log（允许 warn/error/info 用于合理日志）
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      // 禁止 debugger
      'no-debugger': 'error',
      // 优先 const
      'prefer-const': 'warn',
      // 禁止 var
      'no-var': 'error',
    },
  },
])
